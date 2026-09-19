import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import {
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAYS,
} from "../shared/weekdays";

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
  events: [
    {
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: [...WEEKDAYS],
      startDate: "2026-06-19",
      endDate: "2026-06-21",
      pdfLogoKey: "pdf-logos/events/2026/1/logo.png",
      pdfLogoUrl: "/manus-storage/pdf-logos/events/2026/1/logo.png",
      pdfLogoFallback: "none",
    },
  ],
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
      availMon: "nein",
      availTue: "nein",
      availWed: "nein",
      availThu: "nein",
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
      companion: "+ Kind Beispiel",
      willHelp: "ja",
      availMon: "nein",
      availTue: "nein",
      availWed: "nein",
      availThu: "nein",
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
      allowFlexibleAssignment: true,
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
  post_tasks: [
    {
      id: 61,
      year: 2026,
      eventId: 1,
      category: "Logistik",
      task: "Kühlwagen reinigen",
      dueText: "22.09.2026",
      locationId: null,
      contactId: 10,
      status: "inArbeit",
      note: "Übergabe mit Vermieter abstimmen",
      sortOrder: 0,
      deleted: false,
    },
  ],
  materials: [],
  marketing: [],
  approvals: [],
  cakes: [],
  finances: [],
  locations: [],
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
  Mo: "nein",
  Di: "nein",
  Mi: "nein",
  Do: "nein",
  Fr: "ja",
  Sa: "nein",
  So: "nein",
  "Bestätigt?": "nein",
});

describe("Projektdatei und modularer Excel-Import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.prep_tasks.splice(0, data.prep_tasks.length);
    (data.helpers.find(helper => helper.name === "Alex Beispiel") as any).availFri =
      "ja";
    dbMocks.getDb.mockResolvedValue(fakeDb());
  });

  it("speichert den vollständigen Stand kompakt als validiertes JSON", async () => {
    const exported = await exportProjectFile();
    expect(exported.buffer.subarray(0, 1).toString()).toBe("{");
    expect(exported.buffer.length).toBeLessThan(20_000);

    const parsed = parseProjectFile(exported.buffer.toString("base64"));
    expect(parsed.document.metadata).toMatchObject({
      format: "RSC-HELFERPLANUNG-PROJEKTDATEI",
      version: 14,
      eventId: 1,
      eventName: "MyEifelRide",
      year: 2026,
      activeDays: [...WEEKDAYS],
      startDate: "2026-06-19",
      endDate: "2026-06-21",
      pdfLogoKey: "pdf-logos/events/2026/1/logo.png",
      pdfLogoUrl: "/manus-storage/pdf-logos/events/2026/1/logo.png",
      pdfLogoFallback: "none",
    });
    expect(parsed.document.helpers).toHaveLength(2);
    expect(parsed.document.helpers.find(helper => helper.name === "Alex Beispiel")).toMatchObject({
      companion: "+ Kind Beispiel",
    });
    expect(parsed.document.shifts[0].slots[0]).toMatchObject({
      helperSourceId: 21,
      helperName: "Alex Beispiel",
    });
    expect(parsed.document.post[0]).toMatchObject({
      category: "Logistik",
      task: "Kühlwagen reinigen",
      dueText: "22.09.2026",
      locationSourceId: null,
      locationName: "",
    });
  });

  it("führt geänderte Veranstaltungstage im JSON-Vergleich als eigene Änderung", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    document.metadata.activeDays = ["Freitag", "Samstag"];

    const preview = await previewProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    );

    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "VERANSTALTUNG",
          action: "update",
          fields: ["activeDays"],
        }),
      ])
    );
  });

  it("speichert und vergleicht die PDF-Bildkonfiguration des Events", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    document.metadata.pdfLogoKey = null;
    document.metadata.pdfLogoUrl = null;
    document.metadata.pdfLogoFallback = "brand";

    const preview = await previewProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    );

    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "VERANSTALTUNG:update:pdfImage",
          fields: ["pdfLogoKey", "pdfLogoUrl"],
        }),
        expect.objectContaining({
          key: "VERANSTALTUNG:update:pdfLogoFallback",
          fields: ["pdfLogoFallback"],
        }),
      ])
    );
  });

  it("bereinigt Schichten außerhalb der gespeicherten Veranstaltungstage", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    document.metadata.activeDays = ["Samstag", "Sonntag"];

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    ).document;

    expect(parsed.shifts).toEqual([]);
    expect(parsed.warnings).toContain(
      "EINSATZPLAN „Anmeldung“ wurde entfernt, weil Freitag nicht als Veranstaltungstag aktiv ist."
    );
  });

  it("entfernt Zuweisungen nicht verfügbarer Helfer im JSON-Restore", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    const assignedHelper = document.helpers.find(
      (item: any) => item.name === "Alex Beispiel"
    );
    assignedHelper.availFri = "nein";

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    ).document;

    expect(parsed.shifts[0].slots).toEqual([]);
    expect(parsed.warnings.join(" ")).toContain("Alex Beispiel");
    expect(parsed.warnings.join(" ")).toContain("nicht verfügbar");
  });

  it("entkoppelt gelöschte Ansprechpartner und entfernt ihre verwaisten Helferzuweisungen", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    document.contacts = [];
    document.helpers = document.helpers.filter(
      (helper: any) => helper.name === "Chris Leitung"
    );

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    ).document;

    expect(parsed.helpers).toEqual([
      expect.objectContaining({ name: "Chris Leitung", contactName: "" }),
    ]);
    expect(parsed.shifts[0]).toMatchObject({
      areaContactName: "",
      slots: [],
    });
  });

  it("akzeptiert zulässige Doppelbelegungen im Projektstand mit Warnung", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    const parallelShift = structuredClone(document.shifts[0]);
    parallelShift.sourceId += 1;
    parallelShift.task = "Parallele Aufgabe";
    document.shifts.push(parallelShift);

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    );

    expect(parsed.document.shifts).toHaveLength(2);
    expect(parsed.document.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Doppelbelegung: Alex Beispiel"),
      ])
    );
  });

  it("lädt Projektdateien der Version 1 mit den bisherigen Werktagsregeln", async () => {
    const exported = await exportProjectFile();
    const document = JSON.parse(exported.buffer.toString("utf8"));
    document.metadata.version = 1;
    delete document.metadata.activeDays;
    for (const helper of document.helpers) {
      delete helper.availMon;
      delete helper.availTue;
      delete helper.availWed;
      delete helper.availThu;
    }

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(document)).toString("base64")
    );
    expect(parsed.document.metadata.version).toBe(14);
    expect(parsed.document.metadata.activeDays).toEqual([...WEEKDAYS]);
    expect(parsed.document.metadata).toMatchObject({
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
    });
    expect(parsed.document.helpers[0]).toMatchObject({
      availMon: "ja",
      availTue: "ja",
      availWed: "ja",
      availThu: "ja",
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
      document.helpers.find(
        (item: any) => item.name === "Alex Beispiel"
      )[WEEKDAY_AVAILABILITY_FIELDS[day]] = "ja";
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

  it("bereinigt beim Ansprechpartnerimport eine nicht verfügbare Altzuweisung statt abzubrechen", async () => {
    (data.helpers.find(helper => helper.name === "Alex Beispiel") as any).availFri =
      "nein";

    const preview = await previewModuleExcelImport(
      moduleSheet("ANSPRECHPARTNER", [
        {
          ID: 10,
          Name: "Chris Leitung",
          Rufnummer: "0123",
          Bemerkung: "",
          Reihenfolge: 0,
        },
      ]),
      "ANSPRECHPARTNER"
    );

    expect(preview.changes).toContainEqual(
      expect.objectContaining({ area: "ZUORDNUNGEN", action: "delete" })
    );
    expect(preview.warnings.join(" ")).toContain("Alex Beispiel");
    expect(preview.warnings.join(" ")).toContain("nicht verfügbar");
  });

  it("behält bei fehlenden Mo-bis-Do-Spalten im Helfer-Modulimport bestehende Verfügbarkeiten bei", async () => {
    const withoutWeekdays = (row: ReturnType<typeof helperRow>) => {
      const { Mo: _mo, Di: _di, Mi: _mi, Do: _do, ...legacy } = row;
      return legacy;
    };
    const preview = await previewModuleExcelImport(
      helperSheet([
        withoutWeekdays(helperRow("Chris Leitung", "Chris Leitung")),
        withoutWeekdays(helperRow("Alex Beispiel", "Chris Leitung")),
      ]),
      "HELFER"
    );

    const helperUpdates = preview.changes.filter(
      change => change.area === "HELFER" && change.action === "update"
    );
    expect(helperUpdates).toHaveLength(2);
    for (const change of helperUpdates) {
      expect(change.after).toMatchObject({
        availMon: "nein",
        availTue: "nein",
        availWed: "nein",
        availThu: "nein",
      });
    }
  });

  it("akzeptiert eine alte Ansprechpartner-ID im Helfer-Preview und entkoppelt nur den unauflösbaren Bezug", async () => {
    const staleReference = {
      ...helperRow("Alex Beispiel", "Archivierte Leitung"),
      "Ansprechpartner-ID": 999_999,
    };
    const preview = await previewModuleExcelImport(
      helperSheet([
        helperRow("Chris Leitung", "Chris Leitung"),
        staleReference,
      ]),
      "HELFER"
    );

    expect(preview.rowsChecked).toBe(2);
    expect(preview.warnings).toContain(
      "HELFER Zeile 3: Ansprechpartner: Fehlende Ansprechpartnerreferenz ID 999999. Der Datensatz bleibt erhalten, die Zuordnung wird entfernt."
    );
    expect(preview.changes).toContainEqual(
      expect.objectContaining({
        area: "HELFER",
        action: "update",
        label: "Alex Beispiel",
      })
    );
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
            ? [
                "ANSPRECHPARTNER",
                "HELFER",
                "EINSATZPLAN",
                "VORBEREITUNG",
                "NACHBEREITUNG",
                "MATERIAL",
                "MARKETING",
                "GENEHMIGUNGEN",
                "ZUORDNUNGEN",
              ].includes(change.area)
            : area === "EINSATZPLAN"
              ? ["EINSATZPLAN", "ZUORDNUNGEN"].includes(change.area)
              : change.area === area
        )
      ).toBe(true);
    }
  );

  it.each([
    ["Stand", "Bestellt", "bestellt"],
    ["Bestellt", "ja", "geliefert"],
  ] as const)(
    "importiert Materialstatus aus der Spalte %s (%s) als %s",
    async (column, value, expectedStatus) => {
      const preview = await previewModuleExcelImport(
        moduleSheet("MATERIAL", [
          {
            Artikel: `Kabelbinder ${column}`,
            [column]: value,
          },
        ]),
        "MATERIAL"
      );

      expect(preview.changes).toContainEqual(
        expect.objectContaining({
          area: "MATERIAL",
          action: "create",
          after: expect.objectContaining({ status: expectedStatus }),
        })
      );
    }
  );

  it("erhält neue Vorbereitungsfelder und ergänzt Defaults für alte Projektdateien", async () => {
    (data.prep_tasks as any[]).push({
      id: 60,
      year: 2026,
      eventId: 1,
      category: "Behörden",
      task: "Sondernutzung beantragen",
      dueText: "Ende März",
      contactId: 10,
      status: "abgelehnt",
      statusWording: "genehmigung",
      note: "Ablehnung begründen lassen",
      sortOrder: 2,
    });

    const exported = await exportProjectFile();
    const current = parseProjectFile(exported.buffer.toString("base64")).document;
    expect(current.prep[0]).toMatchObject({
      category: "Behörden",
      status: "abgelehnt",
      statusWording: "genehmigung",
    });

    const legacy = structuredClone(current);
    delete (legacy.prep[0] as any).category;
    delete (legacy.prep[0] as any).statusWording;
    const parsedLegacy = parseProjectFile(
      Buffer.from(JSON.stringify(legacy)).toString("base64")
    ).document;
    expect(parsedLegacy.prep[0]).toMatchObject({
      category: "",
      status: "abgelehnt",
      statusWording: "aufgabe",
    });
  });

  it("erhaelt manualOkConfirmed in Schichten und migriert v5-Dateien sauber", async () => {
    const exported = await exportProjectFile();
    const current = parseProjectFile(exported.buffer.toString("base64")).document;
    expect(current.shifts[0]).toHaveProperty("manualOkConfirmed");

    const legacyV5 = structuredClone(current);
    legacyV5.metadata.version = 5;
    delete (legacyV5.shifts[0] as any).manualOkConfirmed;
    const parsedV5 = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV5)).toString("base64")
    ).document;
    expect(parsedV5.metadata.version).toBe(14);
    expect(parsedV5.shifts[0].manualOkConfirmed).toBe(false);
  });

  it("erhaelt manualDoubleConflictAccepted in Schichten und migriert v6-Dateien sauber", async () => {
    const exported = await exportProjectFile();
    const current = parseProjectFile(exported.buffer.toString("base64")).document;
    expect(current.shifts[0]).toHaveProperty("manualDoubleConflictAccepted");

    const legacyV6 = structuredClone(current);
    legacyV6.metadata.version = 6;
    delete (legacyV6.shifts[0] as any).manualDoubleConflictAccepted;
    const parsedV6 = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV6)).toString("base64")
    ).document;
    expect(parsedV6.metadata.version).toBe(14);
    expect(parsedV6.shifts[0].manualDoubleConflictAccepted).toBe(false);
  });

  it("erhaelt locations und migriert v7-Dateien ohne Orte sauber auf Version 8", async () => {
    const exported = await exportProjectFile();
    const current = parseProjectFile(exported.buffer.toString("base64")).document;
    expect(current).toHaveProperty("locations");

    const legacyV7 = structuredClone(current);
    legacyV7.metadata.version = 7;
    delete (legacyV7 as any).locations;
    delete (legacyV7.shifts[0] as any).locationName;
    const parsedV7 = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV7)).toString("base64")
    ).document;
    expect(parsedV7.metadata.version).toBe(14);
    expect(parsedV7.locations).toEqual([]);
    expect(parsedV7.shifts[0].locationName).toBe("");
  });

  it("erhaelt Materialstandorte und migriert v8-Dateien sauber auf Version 9", async () => {
    (data.materials as any[]).push({
      id: 91,
      year: 2026,
      eventId: 1,
      article: "Absperrband",
      category: "Strecke",
      quantity: "5",
      unit: "Rollen",
      locationId: 5,
      contactId: null,
      status: "geliefert",
      note: "Am Bauhof deponieren",
      sortOrder: 1,
    });

    const exported = await exportProjectFile();
    const current = parseProjectFile(exported.buffer.toString("base64")).document;
    expect(current.materials[0]).toHaveProperty("locationName");

    const legacyV8 = structuredClone(current);
    legacyV8.metadata.version = 8;
    delete (legacyV8.materials[0] as any).locationSourceId;
    delete (legacyV8.materials[0] as any).locationName;
    const parsedV8 = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV8)).toString("base64")
    ).document;
    expect(parsedV8.metadata.version).toBe(14);
    expect(parsedV8.materials[0].locationName).toBe("");
  });
  it("erhaelt Standort-Logos und migriert v9-Dateien sauber auf Version 10", async () => {
    (data.locations as any[]).push({
      id: 55,
      year: 2026,
      eventId: 1,
      name: "Mayen / Viehmarkt",
      latitude: 50.3271,
      longitude: 7.2215,
      logoKey: "location-logos/events/2026/1/viehmarkt.png",
      logoUrl: "/manus-storage/location-logos/events/2026/1/viehmarkt.png",
      sortOrder: 0,
    });

    const exported = await exportProjectFile();
    const current = parseProjectFile(exported.buffer.toString("base64")).document;
    expect(current.locations[0]).toMatchObject({
      logoKey: "location-logos/events/2026/1/viehmarkt.png",
      logoUrl: "/manus-storage/location-logos/events/2026/1/viehmarkt.png",
    });

    const legacyV9 = structuredClone(current);
    legacyV9.metadata.version = 9;
    delete (legacyV9.locations[0] as any).logoKey;
    delete (legacyV9.locations[0] as any).logoUrl;
    const parsedV9 = parseProjectFile(Buffer.from(JSON.stringify(legacyV9)).toString("base64")).document;
    expect(parsedV9.metadata.version).toBe(14);
    expect(parsedV9.locations[0].logoKey).toBeNull();
    expect(parsedV9.locations[0].logoUrl).toBeNull();
  });

  it("migriert v10-Dateien mit bisherigen Nachbereitungen auf die erweiterten Felder", async () => {
    const exported = await exportProjectFile();
    const legacyV10 = parseProjectFile(exported.buffer.toString("base64")).document;
    legacyV10.metadata.version = 10;
    delete (legacyV10.post[0] as any).category;
    delete (legacyV10.post[0] as any).dueText;
    delete (legacyV10.post[0] as any).locationSourceId;
    delete (legacyV10.post[0] as any).locationName;

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV10)).toString("base64")
    ).document;

    expect(parsed.metadata.version).toBe(14);
    expect(parsed.post[0]).toMatchObject({
      category: "",
      dueText: "",
      locationSourceId: null,
      locationName: "",
    });
  });

  it("migriert v11-Dateien mit bisherigem Ja/Nein-Bestellt-Feld sauber auf dreistufigen Stand", async () => {
    const exported = await exportProjectFile();
    const legacyV11 = parseProjectFile(exported.buffer.toString("base64")).document;
    legacyV11.metadata.version = 11;
    (legacyV11 as any).materials = [
      {
        sourceId: 901,
        article: "Flatterband",
        category: "Strecke",
        quantity: "10",
        unit: "Rollen",
        locationSourceId: null,
        locationName: "",
        contactSourceId: null,
        contactName: "",
        ordered: "ja",
        note: "",
        sortOrder: 0,
      },
    ];

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV11)).toString("base64")
    ).document;
    expect(parsed.metadata.version).toBe(14);
    expect(parsed.materials[0].status).toBe("geliefert");
  });

  it("migriert v12-Dateien ohne Start-/Enddatum sauber auf Version 13", async () => {
    const exported = await exportProjectFile();
    const legacyV12 = parseProjectFile(exported.buffer.toString("base64")).document;
    legacyV12.metadata.version = 12;
    delete (legacyV12.metadata as any).startDate;
    delete (legacyV12.metadata as any).endDate;

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV12)).toString("base64")
    ).document;
    expect(parsed.metadata.version).toBe(14);
    expect(parsed.metadata.startDate).toBeNull();
    expect(parsed.metadata.endDate).toBeNull();
  });

  it("migriert v13-Dateien mit Kuchenspenden ohne Eigenschaften sauber auf Version 14", async () => {
    const exported = await exportProjectFile();
    const legacyV13 = parseProjectFile(exported.buffer.toString("base64")).document;
    legacyV13.metadata.version = 13;
    (legacyV13 as any).cakes = [
      {
        sourceId: 991,
        donor: "Josi Volli",
        cake: "Käsekuchen",
        dropoffTime: "Fr. 10:00",
        note: "ohne Rosinen",
        sortOrder: 0,
      },
    ];

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(legacyV13)).toString("base64")
    ).document;
    expect(parsed.metadata.version).toBe(14);
    expect(parsed.cakes[0]).toMatchObject({
      donor: "Josi Volli",
      cake: "Käsekuchen",
      vegan: false,
      glutenFree: false,
      lactoseFree: false,
      containsNuts: false,
      note: "ohne Rosinen",
    });
  });
});
