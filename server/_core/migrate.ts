import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

const MIGRATIONS_TABLE = "__drizzle_migrations";
const MIGRATION_LOCK_NAME = "mycrewmate_schema_migrations";
const COMPLETE_SCHEMA_SNAPSHOT = "0052_snapshot.json";
const COMPLETE_SCHEMA_FINAL_MIGRATION = "0053_integrated_preparation_areas";

export type MigrationFile = {
  folderMillis: number;
  hash: string;
  sql: string[];
  tag: string;
};

type JournalEntry = {
  when: number;
  tag: string;
};

type MigrationJournal = {
  entries: JournalEntry[];
};

type ColumnExistsRow = RowDataPacket & {
  columnType?: string;
};

type TableExistsRow = RowDataPacket & {
  tableName?: string;
};

type SchemaColumnRow = RowDataPacket & {
  tableName?: string;
  columnName?: string;
  columnType?: string;
};

type DrizzleSnapshot = {
  tables: Record<
    string,
    {
      name: string;
      columns: Record<string, { name: string; type: string }>;
    }
  >;
};

type LastMigrationRow = RowDataPacket & {
  created_at?: number | string | null;
};

type AdvisoryLockRow = RowDataPacket & {
  acquired?: number | string | null;
};

export type MigrationConnection = Pick<Connection, "execute" | "query" | "end">;

function migrationDirectory() {
  return path.resolve(process.cwd(), "drizzle");
}

export function readProjectMigrations(
  rootDirectory = migrationDirectory()
): MigrationFile[] {
  const journalPath = path.join(rootDirectory, "meta", "_journal.json");
  const journal = JSON.parse(
    fs.readFileSync(journalPath, "utf8")
  ) as MigrationJournal;

  return journal.entries.map(entry => {
    const filePath = path.join(rootDirectory, `${entry.tag}.sql`);
    const rawSql = fs.readFileSync(filePath, "utf8");

    return {
      folderMillis: entry.when,
      hash: crypto.createHash("sha256").update(rawSql).digest("hex"),
      sql: rawSql
        .split("--> statement-breakpoint")
        .map(statement => statement.trim())
        .filter(Boolean),
      tag: entry.tag,
    };
  });
}

function parseAddColumnStatement(statement: string) {
  const match = statement.match(
    /^ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s+ADD\s+(?:COLUMN\s+)?`?([A-Za-z0-9_]+)`?\s+([^;]+);?$/i
  );

  return match
    ? {
        tableName: match[1],
        columnName: match[2],
        expectedType: match[3].trim().split(/\s+/)[0].toLowerCase(),
      }
    : null;
}

type CreateTableStatement = {
  tableName: string;
  columns: Array<{ columnName: string; expectedType: string }>;
};

function parseCreateTableStatement(statement: string): CreateTableStatement | null {
  const match = statement.match(
    /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*\(([\s\S]+)\)\s*;?$/i
  );
  if (!match) return null;

  const columns = match[2]
    .split("\n")
    .map(definition => definition.trim().replace(/,$/, ""))
    .map(definition => {
      const column = definition.match(/^`([A-Za-z0-9_]+)`\s+(.+)$/);
      return column
        ? {
            columnName: column[1],
            expectedType: column[2].trim().split(/\s+/)[0].toLowerCase(),
          }
        : null;
    })
    .filter((column): column is { columnName: string; expectedType: string } =>
      Boolean(column)
    );

  return columns.length > 0 ? { tableName: match[1], columns } : null;
}

function normalizeColumnType(type: string) {
  const normalized = type.toLowerCase().replace(/\s+/g, "");
  return normalized === "boolean" ? "tinyint(1)" : normalized;
}

async function compatibleColumnExists(
  connection: MigrationConnection,
  tableName: string,
  columnName: string,
  expectedType: string
) {
  const [rows] = await connection.execute<ColumnExistsRow[]>(
    `SELECT COLUMN_TYPE AS columnType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return normalizeColumnType(rows[0]?.columnType ?? "") === normalizeColumnType(expectedType);
}

async function compatibleTableExists(
  connection: MigrationConnection,
  createTable: CreateTableStatement
) {
  const [rows] = await connection.execute<TableExistsRow[]>(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [createTable.tableName]
  );
  if (!rows[0]?.tableName) return false;

  const compatibility = await Promise.all(
    createTable.columns.map(column =>
      compatibleColumnExists(
        connection,
        createTable.tableName,
        column.columnName,
        column.expectedType
      )
    )
  );
  return compatibility.every(Boolean);
}

function isDuplicateColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_FIELDNAME"
  );
}

async function ensureMigrationLedger(connection: MigrationConnection) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`
  );
}

async function lastMigrationTimestamp(connection: MigrationConnection) {
  const [rows] = await connection.execute<LastMigrationRow[]>(
    `SELECT created_at
     FROM \`${MIGRATIONS_TABLE}\`
     ORDER BY created_at DESC
     LIMIT 1`
  );

  return Number(rows[0]?.created_at ?? 0);
}

async function bootstrapCompleteLegacySchema(
  connection: MigrationConnection,
  migrations: MigrationFile[],
  lastAppliedAt: number
) {
  const finalMigration = migrations.at(-1);
  if (
    finalMigration?.tag !== COMPLETE_SCHEMA_FINAL_MIGRATION ||
    lastAppliedAt >= finalMigration.folderMillis
  ) {
    return false;
  }

  const snapshotPath = path.join(migrationDirectory(), "meta", COMPLETE_SCHEMA_SNAPSHOT);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as DrizzleSnapshot;
  const [rows] = await connection.execute<SchemaColumnRow[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const actualColumns = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (!row.tableName || !row.columnName || !row.columnType) continue;
    const tableColumns = actualColumns.get(row.tableName) ?? new Map<string, string>();
    tableColumns.set(row.columnName, row.columnType);
    actualColumns.set(row.tableName, tableColumns);
  }

  const schemaMatchesSnapshot = Object.values(snapshot.tables).every(table =>
    Object.values(table.columns).every(column => {
      const actualType = actualColumns.get(table.name)?.get(column.name);
      return actualType && normalizeColumnType(actualType) === normalizeColumnType(column.type);
    })
  );
  if (!schemaMatchesSnapshot) return false;

  // 0053 verschiebt die beiden ehemaligen Fachbereiche atomar in die
  // Vorbereitung. Nur ein bereits leerer Altbestand beweist daher, dass die
  // Datenübernahme früher vollständig erfolgt ist und das Journal fehlt.
  const [legacyRows] = await connection.execute<RowDataPacket[]>(
    `SELECT (
       (SELECT COUNT(*) FROM \`marketing\`) +
       (SELECT COUNT(*) FROM \`approvals\`)
     ) AS remainingRows`
  );
  if (Number(legacyRows[0]?.remainingRows ?? -1) !== 0) return false;

  const missingLedgerEntries = migrations.filter(
    migration => migration.folderMillis > lastAppliedAt
  );
  for (const migration of missingLedgerEntries) {
    await connection.execute(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (\`hash\`, \`created_at\`) VALUES (?, ?)`,
      [migration.hash, migration.folderMillis]
    );
  }
  console.info(
    `[Migration] Vollständig kompatibles Legacy-Schema erkannt; ${missingLedgerEntries.length} fehlende Journal-Einträge sicher ergänzt.`
  );
  return true;
}

async function acquireMigrationLock(connection: MigrationConnection) {
  const [rows] = await connection.execute<AdvisoryLockRow[]>(
    "SELECT GET_LOCK(?, 60) AS acquired",
    [MIGRATION_LOCK_NAME]
  );
  if (Number(rows[0]?.acquired) !== 1) {
    throw new Error(
      "Die Datenbankmigration wird bereits von einem anderen MyCrewMate-Container ausgeführt."
    );
  }
}

async function releaseMigrationLock(connection: MigrationConnection) {
  await connection.execute("SELECT RELEASE_LOCK(?)", [MIGRATION_LOCK_NAME]);
}

export async function applyProjectMigrations(
  connection: MigrationConnection,
  migrations: MigrationFile[]
) {
  await acquireMigrationLock(connection);
  try {
    await ensureMigrationLedger(connection);
    const lastAppliedAt = await lastMigrationTimestamp(connection);
    const bootstrappedLegacySchema = await bootstrapCompleteLegacySchema(
      connection,
      migrations,
      lastAppliedAt
    );
    const pendingMigrations = migrations.filter(
      migration =>
        migration.folderMillis >
        (bootstrappedLegacySchema ? migrations.at(-1)?.folderMillis ?? 0 : lastAppliedAt)
    );
    let compatibleColumnsSkipped = 0;
    let compatibleTablesSkipped = 0;

    for (const migration of pendingMigrations) {
      for (const statement of migration.sql) {
        const addedColumn = parseAddColumnStatement(statement);
        const createdTable = parseCreateTableStatement(statement);
        if (createdTable && (await compatibleTableExists(connection, createdTable))) {
          compatibleTablesSkipped += 1;
          console.info(
            `[Migration] ${migration.tag}: vorhandene Tabelle ${createdTable.tableName} mit bestätigtem Basisschema übernommen.`
          );
          continue;
        }
        if (
          addedColumn &&
          (await compatibleColumnExists(
            connection,
            addedColumn.tableName,
            addedColumn.columnName,
            addedColumn.expectedType
          ))
        ) {
          compatibleColumnsSkipped += 1;
          console.info(
            `[Migration] ${migration.tag}: vorhandene Spalte ${addedColumn.tableName}.${addedColumn.columnName} kompatibel übernommen.`
          );
          continue;
        }

        try {
          // Migrationsdateien sind versioniert und Teil des Container-Images,
          // enthalten also keine Nutzereingaben. Das Textprotokoll ist hier
          // erforderlich, weil MySQL Transaktionsbefehle wie START TRANSACTION
          // nicht über das Prepared-Statement-Protokoll ausführen kann.
          await connection.query(statement);
        } catch (error) {
          // Nur ein nachgewiesen vorhandenes Ziel einer ALTER ... ADD-Operation
          // darf übernommen werden. Jeder andere SQL-Fehler bleibt absichtlich
          // ein harter Startabbruch, um Datenverlust oder Teilschemata zu vermeiden.
          if (
            addedColumn &&
            isDuplicateColumnError(error) &&
            (await compatibleColumnExists(
              connection,
              addedColumn.tableName,
              addedColumn.columnName,
              addedColumn.expectedType
            ))
          ) {
            compatibleColumnsSkipped += 1;
            console.info(
              `[Migration] ${migration.tag}: parallel/vorher angelegte Spalte ${addedColumn.tableName}.${addedColumn.columnName} kompatibel übernommen.`
            );
            continue;
          }

          throw error;
        }
      }

      await connection.execute(
        `INSERT INTO \`${MIGRATIONS_TABLE}\` (\`hash\`, \`created_at\`) VALUES (?, ?)`,
        [migration.hash, migration.folderMillis]
      );
    }

    return {
      appliedMigrations: pendingMigrations.length,
      compatibleColumnsSkipped,
      compatibleTablesSkipped,
    };
  } finally {
    await releaseMigrationLock(connection);
  }
}

export async function runProjectMigrations() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL ist für Datenbankmigrationen erforderlich.");
  }

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const result = await applyProjectMigrations(
      connection,
      readProjectMigrations()
    );
    console.info(
      `[Migration] Abgeschlossen: ${result.appliedMigrations} Migration(en), ${result.compatibleColumnsSkipped} kompatible Spalte(n) und ${result.compatibleTablesSkipped} kompatible Tabelle(n) übernommen.`
    );
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runProjectMigrations().catch(error => {
    console.error("[Migration] MyCrewMate konnte die Datenbank nicht migrieren.", error);
    process.exitCode = 1;
  });
}
