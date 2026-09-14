import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  findContactSelfHelperRow,
  normalizeModuleSheetRange,
  preserveMissingOptionalModuleColumns,
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

  it("entfernt bei Helfern mitkopierte IDs aus zusätzlichen neuen Zeilen", () => {
    const currentRows: Record<string, unknown>[] = [
      { ID: 21, Name: "Bestehender Helfer" },
    ];
    const importedRows: Record<string, unknown>[] = [
      { ID: 21, Name: "Bestehender Helfer" },
      { ID: 21, Name: "Neu kopierter Helfer" },
    ];

    expect(removeCopiedModuleIds("HELFER", importedRows, currentRows)).toBe(1);
    expect(importedRows.map(row => row.ID)).toEqual([21, ""]);
  });

  it("behandelt fehlende optionale Spalten als unverändert, vorhandene Leerwerte aber als bewusste Leerung", () => {
    const existing: Record<string, unknown>[] = [
      {
        ID: 21,
        Name: "Alex Beispiel",
        "E-Mail": "alex@example.test",
        Telefon: "01234",
        Bemerkung: "Bitte morgens einteilen",
      },
    ];
    const importWithMissingColumns: Record<string, unknown>[] = [
      { ID: 21, Name: "Alex Beispiel", Telefon: "" },
    ];

    const preserved = preserveMissingOptionalModuleColumns(
      "HELFER",
      importWithMissingColumns,
      existing,
      new Set(["ID", "Name", "Telefon"])
    );

    expect(preserved).toBeGreaterThan(0);
    expect(importWithMissingColumns[0]).toMatchObject({
      "E-Mail": "alex@example.test",
      Bemerkung: "Bitte morgens einteilen",
      Telefon: "",
    });
  });

  it("verwendet den gleichnamigen Selbsthelfer statt des ersten betreuten Helfers", () => {
    const helpers: Record<string, unknown>[] = [
      {
        ID: 21,
        "Ansprechpartner-ID": 11,
        Name: "Benedikt Braun",
      },
      {
        ID: 22,
        "Ansprechpartner-ID": 11,
        Name: "Martin Reis",
      },
    ];

    expect(
      findContactSelfHelperRow(
        { ID: 11, Name: "Martin Reis" },
        helpers,
        [{ ID: 11, Name: "Martin Reis" }]
      )?.ID
    ).toBe(22);
    expect(helpers[0].Name).toBe("Benedikt Braun");
  });

  it("benennt bei einer echten Ansprechpartner-Umbenennung nur den bisherigen Selbsthelfer um", () => {
    const helpers: Record<string, unknown>[] = [
      {
        ID: 21,
        "Ansprechpartner-ID": 11,
        Name: "Benedikt Braun",
      },
      {
        ID: 22,
        "Ansprechpartner-ID": 11,
        Name: "Alter Name",
      },
    ];

    expect(
      findContactSelfHelperRow(
        { ID: 11, Name: "Neuer Name" },
        helpers,
        [{ ID: 11, Name: "Alter Name" }]
      )?.ID
    ).toBe(22);
  });

  it("legt bei fehlendem Selbsthelfer einen neuen an, statt einen betreuten Helfer umzubenennen", () => {
    const helpers: Record<string, unknown>[] = [
      {
        ID: 21,
        "Ansprechpartner-ID": 11,
        Name: "Benedikt Braun",
      },
    ];

    expect(
      findContactSelfHelperRow(
        { ID: 11, Name: "Martin Reis" },
        helpers,
        [{ ID: 11, Name: "Martin Reis" }]
      )
    ).toBeUndefined();
  });
});
