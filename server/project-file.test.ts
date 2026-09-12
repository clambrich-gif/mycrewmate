import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { WEEKDAYS } from "../shared/weekdays";

const dbMocks = vi.hoisted(() => ({ getDb: vi.fn() }));
const contextMocks = vi.hoisted(() => ({
  currentEventId: vi.fn(() => 1),
  currentEventYear: vi.fn(() => 2026),
}));
vi.mock("./db", () => dbMocks);
vi.mock("./year-context", () => contextMocks);

import {
  exportProjectFile,
  parseProjectFile,
  previewProjectFile,
} from "./project-file";
import { comparableProjectContent, exportProjectExcel } from "./excel-backup";
import {
  previewModuleExcelImport,
  type ModuleImportArea,
} from "./module-excel-import";

const tableName = (table: any) => table[Symbol.for("drizzle:Name")];
const data = {
  events: [{ id: 1, year: 2026, name: "MyEifelRide" }],
  contacts: [
    {
      id: 10,
      year: 2026,
      eventId: 1,
      name: "Chris Leitung",
      phone: "0123",
      note: null,
      sortOrder: 0,
    },
  ],
  helpers: [
    {
      id: 20,
      year: 2026,
      eventId: 1,
      contactId: 10,
      name: "Chris Leitung",
      email: null,
      phone: "0123",
      note: null,
      willHelp: "ja",
      availFri: "ja",
      availSat: "ja",
      availSun: "nein",
      confirmed: "nein",
    },
    {
      id: 21,
      year: 2026,
      eventId: 1,
      contactId: 10,
      name: "Alex Beispiel",
      email: "alex@example.test",
      phone: "0456",
      note: null,
      willHelp: "ja",
      availFri: "ja",
      availSat: "ja",
      availSun: "nein",
      confirmed: "ja",
    },
  ],
  shifts: [
    {
      id: 30,
      year: 2026,
      eventId: 1,
      day: "Freitag",
      area: "Start",
      task: "Anmeldung",
      startTime: "08:00",
      endTime: "10:00",
      needed: 1,
      note: null,
      sortOrder: 0,
    },
  ],
  shift_area_contacts: [
    { id: 40, year: 2026, eventId: 1, area: "Start", contactId: 10 },
  ],
  assignments: [{ id: 50, shiftId: 30, helperId: 21, slot: 0 }],
  prep_tasks: [],
  post_tasks: [],
  materials: [],
  marketing: [],
  approvals: [],
  cakes: [],
  finances: [],
};

function fakeDb() {
  return {
    select() {
      return {
        from(table: any) {
          const rows = data[tableName(table) as keyof typeof data] ?? [];
          const chain: any = {
            where: () => chain,
            limit: async (limit: number) => rows.slice(0, limit),
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(rows).then(resolve),
          };
          return chain;
        },
      };
    },
  };
}

const helperSheet = (rows: Record<string, unknown>[]) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "HELFER"
  );
  return (
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
  ).toString("base64");
};

const moduleSheet = (
  area: ModuleImportArea,
  rows: Record<string, unknown>[]
) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), area);
  return (
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
  ).toString("base64");
};

const helperRow = (name: string, contact = "") => ({
  Name: name,
  Ansprechpartner: contact,
  "E-Mail": "",
  Telefon: "",
  Bemerkung: "",
  "Helfen?": "ja",
  Fr: "ja",
  Sa: "nein",
  So: "nein",
  "Bestätigt?": "nein",
});

describe("Projektdatei und modularer Excel-Import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getDb.mockResolvedValue(fakeDb());
  });

  it("speichert den vollständigen Stand kompakt als validiertes JSON", async () => {
    const exported = await exportProjectFile();
    expect(exported.buffer.subarray(0, 1).toString()).toBe("{");
    expect(exported.buffer.length).toBeLessThan(20_000);

    const parsed = parseProjectFile(exported.buffer.toString("base64"));
    expect(parsed.document.metadata).toMatchObject({
      format: "RSC-HELFERPLANUNG-PROJEKTDATEI",
      version: 1,
      eventId: 1,
      eventName: "MyEifelRide",
      year: 2026,
    });
    expect(parsed.document.helpers).toHaveLength(2);
    expect(parsed.document.shifts[0].slots[0]).toMatchObject({
      helperSourceId: 21,
      helperName: "Alex Beispiel",
    });
  });

  it("kennzeichnet den Excel-Gesamtexport eindeutig als reine Projektübersicht", async () => {
    const exported = await exportProjectExcel();
    const workbook = XLSX.read(exported.buffer, { type: "buffer" });
    expect(workbook.SheetNames[0]).toBe("PROJEKT_INFO");
    expect(workbook.Sheets.SICHERUNG_INFO).toBeUndefined();
    const info = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets.PROJEKT_INFO
    );
    expect(info).toContainEqual(
      expect.objectContaining({
        Schlüssel: "Format",
        Wert: "RSC-HELFERPLANUNG-PROJEKTUEBERSICHT",
      })
    );
  });

  it("meldet bei unverändertem JSON-Projektstand keine Änderungen", async () => {
    const exported = await exportProjectFile();
    const preview = await previewProjectFile(
      exported.buffer.toString("base64")
    );
    expect(preview.changes).toEqual([]);
    expect(preview.totals).toMatchObject({
      created: 0,
      updated: 0,
      deleted: 0,
    });
  });

  it("vergleicht einen vollständig neu aufgebauten Projektstand unabhängig von neuen Datenbank-IDs", async () => {
    const exported = await exportProjectFile();
    const saved = parseProjectFile(exported.buffer.toString("base64")).document;
    const restored = structuredClone(saved);
    restored.contacts[0].sourceId = 1010;
    restored.helpers[0].sourceId = 2020;
    restored.helpers[0].contactSourceId = 1010;
    restored.helpers[1].sourceId = 2021;
    restored.helpers[1].contactSourceId = 1010;
    restored.shifts[0].sourceId = 3030;
    restored.shifts[0].areaContactSourceId = 1010;
    restored.shifts[0].slots[0].helperSourceId = 2021;
    restored.contacts[0] = Object.fromEntries(
      Object.entries(restored.contacts[0]).reverse()
    );
    restored.helpers[0] = Object.fromEntries(
      Object.entries(restored.helpers[0]).reverse()
    );

    expect(comparableProjectContent(restored)).toEqual(
      comparableProjectContent(saved)
    );
  });

  it.each(WEEKDAYS)(
    "akzeptiert %s-Schichten in JSON-Projektdateien",
    async day => {
      const exported = await exportProjectFile();
      const document = JSON.parse(exported.buffer.toString("utf8"));
      document.shifts[0].day = day;
      const parsed = parseProjectFile(
        Buffer.from(JSON.stringify(document)).toString("base64")
      );
      expect(parsed.document.shifts[0].day).toBe(day);
    }
  );

  it("weist fremde oder beschädigte Dateien verständlich zurück", () => {
    expect(() =>
      parseProjectFile(Buffer.from("kein json").toString("base64"))
    ).toThrow("kein gültiges JSON");
    expect(() =>
      parseProjectFile(
        Buffer.from(JSON.stringify({ metadata: { format: "FREMD" } })).toString(
          "base64"
        )
      )
    ).toThrow("Speicherdatei ist ungültig");
  });

  it.each([
    ["foo", "", "beide leer oder beide gesetzt"],
    ["10:00", "09:00", "Ende muss nach dem Beginn"],
    ["25:00", "26:00", "Format HH:MM"],
  ])(
    "weist ungültige JSON-Schichtzeiten %s–%s zurück",
    async (startTime, endTime, message) => {
      const exported = await exportProjectFile();
      const document = JSON.parse(exported.buffer.toString("utf8"));
      document.shifts[0].startTime = startTime;
      document.shifts[0].endTime = endTime;
      expect(() =>
        parseProjectFile(
          Buffer.from(JSON.stringify(document)).toString("base64")
        )
      ).toThrow(message);
    }
  );

  it("erkennt im Helfer-Einzelblatt neue und gelöschte Helfer samt direkter Zuordnungsfolge", async () => {
    const preview = await previewModuleExcelImport(
      helperSheet([
        helperRow("Chris Leitung", "Chris Leitung"),
        helperRow("Dana Neu"),
      ]),
      "HELFER"
    );

    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "HELFER",
          action: "delete",
          label: "Alex Beispiel",
        }),
        expect.objectContaining({
          area: "HELFER",
          action: "create",
          label: "Dana Neu",
        }),
        expect.objectContaining({ area: "ZUORDNUNGEN", action: "delete" }),
      ])
    );
    expect(preview.totals).toMatchObject({ created: 1, deleted: 2 });
    expect(preview.warnings.join(" ")).toContain("Umbenennung ohne ID");
  });

  it.each<{
    area: ModuleImportArea;
    row: Record<string, unknown>;
    expectedArea: string;
  }>([
    {
      area: "ANSPRECHPARTNER",
      row: { Name: "Dana Leitung", Rufnummer: "0999" },
      expectedArea: "ANSPRECHPARTNER",
    },
    {
      area: "EINSATZPLAN",
      row: {
        Tag: "Montag",
        Bereich: "Ziel",
        Aufgabe: "Zielausgabe",
        Beginn: "10:00",
        Ende: "12:00",
        Bedarf: 2,
      },
      expectedArea: "EINSATZPLAN",
    },
    {
      area: "VORBEREITUNG",
      row: { Aufgabe: "Beschilderung prüfen" },
      expectedArea: "VORBEREITUNG",
    },
    {
      area: "NACHBEREITUNG",
      row: { Aufgabe: "Gelände reinigen" },
      expectedArea: "NACHBEREITUNG",
    },
    {
      area: "MATERIAL",
      row: { Artikel: "Absperrgitter", Menge: "20", Einheit: "Stück" },
      expectedArea: "MATERIAL",
    },
    {
      area: "MARKETING",
      row: { Maßnahme: "Pressemitteilung", Kanal: "Zeitung" },
      expectedArea: "MARKETING",
    },
    {
      area: "GENEHMIGUNGEN",
      row: { Antrag: "Straßensperrung" },
      expectedArea: "GENEHMIGUNGEN",
    },
    {
      area: "KUCHEN",
      row: { Spender: "Beispiel Person", Kuchen: "Apfelkuchen" },
      expectedArea: "KUCHEN",
    },
    {
      area: "FINANZEN",
      row: { Kategorie: "Startgeld", Einnahmen: 100, Ausgaben: 0 },
      expectedArea: "FINANZEN",
    },
  ])(
    "importiert $area unabhängig als Einzelblatt",
    async ({ area, row, expectedArea }) => {
      const preview = await previewModuleExcelImport(
        moduleSheet(area, [row]),
        area
      );
      expect(preview.changes).toContainEqual(
        expect.objectContaining({ area: expectedArea, action: "create" })
      );
      expect(
        preview.changes.every(change =>
          area === "ANSPRECHPARTNER"
            ? ["ANSPRECHPARTNER", "HELFER"].includes(change.area)
            : area === "EINSATZPLAN"
              ? ["EINSATZPLAN", "ZUORDNUNGEN"].includes(change.area)
              : change.area === area
        )
      ).toBe(true);
    }
  );
});
