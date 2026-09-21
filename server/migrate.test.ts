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
  duplicateOnAlter?: boolean;
}) {
  const columnExists = [...(options?.columnExists ?? [])];
  const execute = vi.fn(async (query: string) => {
    if (query.includes("GET_LOCK")) return [[{ acquired: 1 }]];
    if (query.includes("RELEASE_LOCK")) return [[{ released: 1 }]];
    if (query.includes("SELECT created_at")) return [[]];
    if (query.includes("information_schema.COLUMNS")) {
      return [
        columnExists.shift()
          ? [{ columnType: options?.columnType ?? "varchar(500)" }]
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

    expect(result).toEqual({ appliedMigrations: 1, compatibleColumnsSkipped: 1 });
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

    expect(result).toEqual({ appliedMigrations: 1, compatibleColumnsSkipped: 1 });
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
