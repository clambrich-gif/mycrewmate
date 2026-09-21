import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

const MIGRATIONS_TABLE = "__drizzle_migrations";
const MIGRATION_LOCK_NAME = "mycrewmate_schema_migrations";

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
    const pendingMigrations = migrations.filter(
      migration => migration.folderMillis > lastAppliedAt
    );
    let compatibleColumnsSkipped = 0;

    for (const migration of pendingMigrations) {
      for (const statement of migration.sql) {
        const addedColumn = parseAddColumnStatement(statement);
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
      `[Migration] Abgeschlossen: ${result.appliedMigrations} Migration(en), ${result.compatibleColumnsSkipped} kompatible Spalte(n) übernommen.`
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
