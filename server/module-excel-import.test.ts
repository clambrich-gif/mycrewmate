import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  normalizeModuleSheetRange,
  removeCopiedModuleIds,
} from "./module-excel-import";

describe("modularer Ansprechpartner-Excel-Import", () => {
  it("prüft alle tatsächlich belegten Zeilen trotz veraltetem Excel-Blattbereich", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["ID", "Name", "Rufnummer", "Bemerkung", "Reihenfolge"],
      [1, "Bestehend Eins", "02651 100", "", 0],
      ["", "Neu Zwei", "02651 200", "", 1],
      ["", "Neu Drei", "02651 300", "", 2],
      ["", "Neu Vier", "02651 400", "", 3],
    ]);
    sheet["!ref"] = "A1:E2";

    normalizeModuleSheetRange(sheet, "ANSPRECHPARTNER");

    expect(sheet["!ref"]).toBe("A1:E5");
    expect(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      })
    ).toHaveLength(4);
  });

  it("behandelt mitkopierte IDs in weiteren Ansprechpartnerzeilen als Neuanlagen", () => {
    const currentRows: Record<string, unknown>[] = [
      { ID: 11, Name: "Bestehend Eins" },
    ];
    const importedRows: Record<string, unknown>[] = [
      { ID: 11, Name: "Bestehend Eins" },
      { ID: 11, Name: "Neu Zwei" },
      { ID: 11, Name: "Neu Drei" },
    ];

    expect(
      removeCopiedModuleIds(
        "ANSPRECHPARTNER",
        importedRows,
        currentRows
      )
    ).toBe(2);
    expect(importedRows.map(row => row.ID)).toEqual([11, "", ""]);
  });

  it("lässt eindeutige IDs für echte Bestandsänderungen unverändert", () => {
    const currentRows: Record<string, unknown>[] = [
      { ID: 11, Name: "Bestehend Eins" },
      { ID: 12, Name: "Bestehend Zwei" },
    ];
    const importedRows: Record<string, unknown>[] = [
      { ID: 11, Name: "Bestehend Eins" },
      { ID: 12, Name: "Bestehend Zwei" },
      { ID: "", Name: "Neu Drei" },
    ];

    expect(
      removeCopiedModuleIds(
        "ANSPRECHPARTNER",
        importedRows,
        currentRows
      )
    ).toBe(0);
    expect(importedRows.map(row => row.ID)).toEqual([11, 12, ""]);
  });
});
