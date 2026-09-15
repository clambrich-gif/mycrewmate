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

  it("verwirft scope-fremde technische IDs bei Ansprechpartnern, Helfern, Schichten und Fachlisten", () => {
    const examples: Array<{
      area:
        | "ANSPRECHPARTNER"
        | "HELFER"
        | "EINSATZPLAN"
        | "VORBEREITUNG"
        | "NACHBEREITUNG"
        | "MATERIAL"
        | "MARKETING"
        | "GENEHMIGUNGEN"
        | "KUCHEN"
        | "FINANZEN";
      row: Record<string, unknown>;
    }> = [
      { area: "ANSPRECHPARTNER", row: { ID: 999, Name: "Fremder Kontakt" } },
      { area: "HELFER", row: { ID: 999, Name: "Fremder Helfer" } },
      {
        area: "EINSATZPLAN",
        row: {
          ID: 999,
          Tag: "Freitag",
          Bereich: "Nord",
          Aufgabe: "Fremde Schicht",
          Beginn: "09:00",
          Ende: "10:00",
        },
      },
      { area: "VORBEREITUNG", row: { ID: 999, Aufgabe: "Fremde Vorbereitung" } },
      { area: "NACHBEREITUNG", row: { ID: 999, Aufgabe: "Fremde Nachbereitung" } },
      { area: "MATERIAL", row: { ID: 999, Artikel: "Fremdes Material" } },
      { area: "MARKETING", row: { ID: 999, Maßnahme: "Fremdes Marketing" } },
      { area: "GENEHMIGUNGEN", row: { ID: 999, Antrag: "Fremder Antrag" } },
      { area: "KUCHEN", row: { ID: 999, Spender: "Fremd", Kuchen: "Kuchen" } },
      { area: "FINANZEN", row: { ID: 999, Kategorie: "Fremde Finanzen" } },
    ];

    for (const { area, row } of examples) {
      const imported = [{ ...row }];
      expect(removeCopiedModuleIds(area, imported, [])).toBe(1);
      expect(imported[0].ID).toBe("");
    }
  });

  it("verwirft eine kopierte Schicht-ID, wenn die fachliche Identität zu einer anderen Schicht gehört", () => {
    const currentRows: Record<string, unknown>[] = [
      {
        ID: 41,
        Tag: "Freitag",
        Bereich: "Nord",
        Aufgabe: "Start",
        Beginn: "09:00",
        Ende: "10:00",
      },
      {
        ID: 42,
        Tag: "Freitag",
        Bereich: "Süd",
        Aufgabe: "Ziel",
        Beginn: "10:00",
        Ende: "11:00",
      },
    ];
    const importedRows = [{ ...currentRows[1], ID: 41 }];

    expect(
      removeCopiedModuleIds("EINSATZPLAN", importedRows, currentRows)
    ).toBe(1);
    expect(importedRows[0].ID).toBe("");
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
