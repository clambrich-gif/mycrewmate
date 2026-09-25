import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { MigrationConnection, MigrationFile } from "./_core/migrate";
import { applyProjectMigrations, readProjectMigrations } from "./_core/migrate";

function migration(statements: string[]): MigrationFile {
  return {
    folderMillis: 100,
    hash: "migration-hash",
    sql: statements,
    tag: "0001_compatible_column",
  };
}

function createConnection(options?: {
  columnExists?: boolean[];
  columnType?: string;
  columnTypes?: string[];
  tableExists?: boolean;
  snapshotCompatible?: boolean;
  legacyRows?: number;
  duplicateOnAlter?: boolean;
}) {
  const columnExists = [...(options?.columnExists ?? [])];
  const columnTypes = [...(options?.columnTypes ?? [])];
  const execute = vi.fn(async (query: string) => {
    if (query.includes("GET_LOCK")) return [[{ acquired: 1 }]];
    if (query.includes("RELEASE_LOCK")) return [[{ released: 1 }]];
    if (query.includes("SELECT created_at")) return [[]];
    if (query.includes("information_schema.TABLES")) {
      return options?.tableExists ? [[{ tableName: "approvals" }]] : [[]];
    }
    if (query.includes("TABLE_NAME AS tableName")) {
      if (!options?.snapshotCompatible) return [[]];
      const snapshot = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "drizzle/meta/0052_snapshot.json"), "utf8")
      );
      return [
        Object.values(snapshot.tables).flatMap((table: any) =>
          Object.values(table.columns).map((column: any) => ({
            tableName: table.name,
            columnName: column.name,
            columnType: column.type,
          }))
        ),
      ];
    }
    if (query.includes("remainingRows")) {
      return [[{ remainingRows: options?.legacyRows ?? 0 }]];
    }
    if (query.includes("information_schema.COLUMNS")) {
      return [
        columnExists.shift()
          ? [{ columnType: columnTypes.shift() ?? options?.columnType ?? "varchar(500)" }]
          : [],
      ];
    }
    return [[]];
  });
  const query = vi.fn(async (statement: string) => {
    if (options?.duplicateOnAlter && statement.startsWith("ALTER TABLE")) {
      const error = Object.assign(new Error("Duplicate column name 'pdfLogoKey'"), {
        code: "ER_DUP_FIELDNAME",
      });
      throw error;
    }
    return [[]];
  });

  return { execute, query, end: vi.fn() } as unknown as MigrationConnection & {
    execute: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

describe("applyProjectMigrations", () => {
  it("übernimmt eine bereits vorhandene Zielspalte und schreibt die Migration ins Journal", async () => {
    const connection = createConnection({ columnExists: [true] });

    const result = await applyProjectMigrations(
      connection,
      [migration([
        "ALTER TABLE `events` ADD `pdfLogoKey` varchar(500);",
        "UPDATE `events` SET `pdfLogoKey` = NULL;",
      ])]
    );

    expect(result).toEqual({
      appliedMigrations: 1,
      compatibleColumnsSkipped: 1,
      compatibleTablesSkipped: 0,
    });
    expect(connection.execute).not.toHaveBeenCalledWith(
      "ALTER TABLE `events` ADD `pdfLogoKey` varchar(500);"
    );
    expect(connection.query).toHaveBeenCalledWith(
      "UPDATE `events` SET `pdfLogoKey` = NULL;"
    );
    expect(connection.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `__drizzle_migrations`"),
      ["migration-hash", 100]
    );
  });

  it("akzeptiert einen Duplikatfehler nur nach der bestätigten Existenz genau dieser Spalte", async () => {
    const connection = createConnection({
      columnExists: [false, true],
      duplicateOnAlter: true,
    });

    const result = await applyProjectMigrations(
      connection,
      [migration(["ALTER TABLE `events` ADD `pdfLogoKey` varchar(500);"])]
    );

    expect(result).toEqual({
      appliedMigrations: 1,
      compatibleColumnsSkipped: 1,
      compatibleTablesSkipped: 0,
    });
  });

  it("akzeptiert keine gleichnamige Spalte mit abweichendem Typ", async () => {
    const connection = createConnection({
      columnExists: [true, true],
      columnType: "int",
      duplicateOnAlter: true,
    });

    await expect(
      applyProjectMigrations(
        connection,
        [migration(["ALTER TABLE `events` ADD `pdfLogoKey` varchar(500);"])]
      )
    ).rejects.toThrow("Duplicate column name");
  });

  it("übernimmt eine vorbestehende historische Tabelle nur bei bestätigtem Basisschema", async () => {
    const connection = createConnection({
      tableExists: true,
      columnExists: [true, true],
      columnTypes: ["int", "varchar(300)"],
    });

    const result = await applyProjectMigrations(
      connection,
      [
        migration([
          "CREATE TABLE `approvals` (\n  `id` int AUTO_INCREMENT NOT NULL,\n  `request` varchar(300) NOT NULL,\n  CONSTRAINT `approvals_id` PRIMARY KEY(`id`)\n);",
        ])
      ]
    );

    expect(result).toEqual({
      appliedMigrations: 1,
      compatibleColumnsSkipped: 0,
      compatibleTablesSkipped: 1,
    });
    expect(connection.query).not.toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE `approvals`")
    );
  });

  it("blockiert eine vorbestehende Tabelle mit abweichendem Basisschema", async () => {
    const connection = createConnection({
      tableExists: true,
      columnExists: [true, true],
      columnTypes: ["int", "varchar(200)"],
    });
    const existingTableError = Object.assign(
      new Error("Table 'approvals' already exists"),
      { code: "ER_TABLE_EXISTS_ERROR" }
    );
    connection.query.mockRejectedValue(existingTableError);

    await expect(
      applyProjectMigrations(
        connection,
        [
          migration([
            "CREATE TABLE `approvals` (\n  `id` int AUTO_INCREMENT NOT NULL,\n  `request` varchar(300) NOT NULL,\n  CONSTRAINT `approvals_id` PRIMARY KEY(`id`)\n);",
          ])
        ]
      )
    ).rejects.toThrow("already exists");
  });

  it("ergänzt Legacy-Journal-Einträge und führt spätere Mandantenmigrationen regulär aus", async () => {
    const connection = createConnection({ snapshotCompatible: true, legacyRows: 0 });
    const migrations = readProjectMigrations();
    // Nach dem historischen Stand 0053 folgen regulär die Mandanten- und Rechtemigrationen.
    const expectedNewMigrations = migrations.filter(
      m =>
        m.tag === "0054_quiet_white_tiger" ||
        m.tag === "0055_outstanding_silver_fox" ||
        m.tag === "0056_broken_captain_america" ||
        m.tag === "0057_glossy_the_captain" ||
        m.tag === "0058_open_chat" ||
        m.tag === "0059_puzzling_swordsman" ||
        m.tag === "0060_powerful_mister_sinister" ||
        m.tag === "0061_tenant_scoped_audit_logs" ||
        m.tag === "0062_release_archived_access_emails" ||
        m.tag === "0063_tenant_scoped_coadmin_presence" ||
        m.tag === "0064_first_login_onboarding" ||
        m.tag === "0065_remove_archived_tenant_accesses" ||
        m.tag === "0066_military_scarlet_witch" ||
        m.tag === "0067_broad_infant_terrible"
    ).length;

    const result = await applyProjectMigrations(connection, migrations);

    expect(result).toEqual({
      appliedMigrations: expectedNewMigrations,
      compatibleColumnsSkipped: 0,
      compatibleTablesSkipped: 0,
    });
    expect(
      connection.execute.mock.calls.filter(([query]) =>
        String(query).includes("INSERT INTO `__drizzle_migrations`")
      )
    ).toHaveLength(migrations.length);
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE `tenants`")
    );
  });

  it("verweigert den Legacy-Bootstrap bei noch nicht übertragenen Altdaten", async () => {
    const connection = createConnection({ snapshotCompatible: true, legacyRows: 1 });
    connection.query.mockRejectedValue(
      Object.assign(new Error("Table 'users' already exists"), {
        code: "ER_TABLE_EXISTS_ERROR",
      })
    );

    await expect(
      applyProjectMigrations(connection, readProjectMigrations())
    ).rejects.toThrow("already exists");
    expect(
      connection.execute.mock.calls.filter(([query]) =>
        String(query).includes("INSERT INTO `__drizzle_migrations`")
      )
    ).toHaveLength(0);
  });

  it("blockiert andere Datenbankfehler weiterhin", async () => {
    const connection = createConnection();
    connection.query.mockImplementation(async (statement: string) => {
      if (statement.startsWith("UPDATE")) throw new Error("Berechtigung verweigert");
      return [[]];
    });

    await expect(
      applyProjectMigrations(connection, [migration(["UPDATE `events` SET `name` = `name`; "])])
    ).rejects.toThrow("Berechtigung verweigert");
  });

  it("führt Transaktionsbefehle über das Textprotokoll statt Prepared Statements aus", async () => {
    const connection = createConnection();

    await applyProjectMigrations(
      connection,
      [migration(["START TRANSACTION;", "COMMIT;"])]
    );

    expect(connection.query).toHaveBeenCalledWith("START TRANSACTION;");
    expect(connection.query).toHaveBeenCalledWith("COMMIT;");
    expect(connection.execute).not.toHaveBeenCalledWith("START TRANSACTION;");
  });

  it("gleicht die historischen Logo-Einstellungen ohne Kollationsabhängigkeit ab", () => {
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "drizzle/0014_fat_dracula.sql"),
      "utf8"
    );

    expect(migrationSql).toContain(
      "CONVERT(`event`.`name` USING BINARY) = CONVERT(`settings`.`eventName` USING BINARY)"
    );
    expect(migrationSql).toContain(
      "CONVERT(CAST(`event`.`year` AS CHAR) USING BINARY) = CONVERT(`settings`.`eventYear` USING BINARY)"
    );
  });

  it("trennt die transaktionale Abschlussmigration in einzeln ausführbare Statements", () => {
    const finalMigration = readProjectMigrations().find(
      candidate => candidate.tag === "0053_integrated_preparation_areas"
    );

    expect(finalMigration?.sql).toEqual([
      "START TRANSACTION;",
      expect.stringContaining("FROM `marketing`;"),
      expect.stringContaining("FROM `approvals`;"),
      "DELETE FROM `marketing`;",
      "DELETE FROM `approvals`;",
      "COMMIT;",
    ]);
  });
});
