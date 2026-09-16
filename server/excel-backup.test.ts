import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));
const contextMocks = vi.hoisted(() => ({
  currentEventId: vi.fn(() => 1),
  currentEventYear: vi.fn(() => 2026),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./year-context", () => contextMocks);

import {
  BACKUP_RESTORE_LOG_RETENTION_DAYS,
  MAX_BACKUP_RESTORE_LOGS_PER_SCOPE,
  backupRestoreLogIdsToPrune,
  buildSelectedDocument,
  comparableProjectContent,
  diffDocuments,
  exportBackupExcel,
  normalizeImportedTime,
  parseBackupWorkbook,
  previewBackupRestore,
  reconcileContactSelfHelpers,
} from "./excel-backup";

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
      note: "Bitte anrufen",
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

function mutateWorkbook(
  buffer: Buffer,
  mutate: (workbook: XLSX.WorkBook) => void
) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  mutate(workbook);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function replaceSheet(workbook: XLSX.WorkBook, name: string, rows: any[]) {
  workbook.Sheets[name] = XLSX.utils.json_to_sheet(rows);
}

describe("Excel-Datensicherung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.finances.splice(0, data.finances.length);
    dbMocks.getDb.mockResolvedValue(fakeDb());
  });

  it("exportiert alle Pflichtblätter einschließlich leerer Tabellen mit Kopfzeilen", async () => {
    const result = await exportBackupExcel();
    const workbook = XLSX.read(result.buffer, {
      type: "buffer",
      cellStyles: true,
    });

    expect(workbook.SheetNames).toEqual([
      "SICHERUNG_INFO",
      "ANSPRECHPARTNER",
      "HELFER",
      "EINSATZPLAN",
      "VORBEREITUNG",
      "NACHBEREITUNG",
      "MATERIAL",
      "MARKETING",
      "GENEHMIGUNGEN",
      "KUCHEN",
      "FINANZEN",
    ]);
    expect(workbook.Sheets.VORBEREITUNG.A1.v).toBe("ID");
    expect(workbook.Sheets.HELFER["!cols"]?.[0]?.hidden).toBe(true);
    expect(workbook.Sheets.HELFER["!cols"]?.[1]?.hidden).toBe(true);
  });

  it("erkennt eine aus der Excel-Sicherung entfernte Helferzeile und Zuordnung", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      replaceSheet(
        workbook,
        "HELFER",
        helperRows.filter(row => row.Name !== "Alex Beispiel")
      );
      const shiftRows = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.EINSATZPLAN
      );
      shiftRows[0]["Helfer 1 ID"] = "";
      shiftRows[0]["Helfer 1"] = "";
      replaceSheet(workbook, "EINSATZPLAN", shiftRows);
    });

    const preview = await previewBackupRestore(changed.toString("base64"));
    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "HELFER",
          action: "delete",
          label: "Alex Beispiel",
        }),
        expect.objectContaining({ area: "ZUORDNUNGEN", action: "delete" }),
      ])
    );
  });

  it("ordnet gleichnamige Einsatzplanaufgaben anhand der gesamten Schichtidentität zu", () => {
    const saturdayTent = {
      sourceId: 30,
      day: "Samstag",
      area: "Aufbau",
      task: "Zelte",
      startTime: "09:00",
      endTime: "11:50",
      needed: 2,
      note: "",
      sortOrder: 0,
      areaContactSourceId: 10,
      areaContactName: "Chris Leitung",
      slots: [],
    };
    const sundayTent = {
      ...saturdayTent,
      sourceId: 31,
      day: "Sonntag",
      area: "Abbau",
      startTime: "10:00",
      endTime: "15:00",
      needed: 3,
      note: "Anhänger abholen",
    };
    const current: any = {
      contacts: [],
      helpers: [],
      shifts: [saturdayTent, sundayTent],
      prep: [],
      post: [],
      materials: [],
      marketing: [],
      approvals: [],
      cakes: [],
      finances: [],
    };
    const desired: any = {
      ...structuredClone(current),
      shifts: [
        {
          ...saturdayTent,
          sourceId: 2190004,
          areaContactSourceId: 20,
          areaContactName: "Neue Leitung",
        },
        {
          ...sundayTent,
          sourceId: 2190005,
          areaContactSourceId: 20,
          areaContactName: "Neue Leitung",
        },
      ],
    };

    const changes = diffDocuments(current, desired);
    const shiftUpdateKeys = changes
      .filter(change => change.area === "EINSATZPLAN")
      .map(change => change.key);

    expect(shiftUpdateKeys).toEqual([
      "EINSATZPLAN:update:30",
      "EINSATZPLAN:update:31",
    ]);
    expect(new Set(shiftUpdateKeys).size).toBe(shiftUpdateKeys.length);
  });

  it("erzeugt keine doppelten Updates, wenn mehrere importierte Zeilen dieselbe Identität beanspruchen", () => {
    const currentShift = {
      sourceId: 50,
      day: "Freitag",
      area: "Parkplatz",
      task: "Einweisung",
      startTime: "08:00",
      endTime: "10:00",
      needed: 1,
      note: "",
      sortOrder: 0,
      areaContactSourceId: null,
      areaContactName: "",
      slots: [],
    };
    const current: any = {
      contacts: [],
      helpers: [],
      shifts: [currentShift],
      prep: [],
      post: [],
      materials: [],
      marketing: [],
      approvals: [],
      cakes: [],
      finances: [],
    };
    const desired: any = {
      ...structuredClone(current),
      shifts: [
        { ...currentShift, sourceId: null, note: "Erste Kopie" },
        { ...currentShift, sourceId: null, note: "Zweite Kopie" },
      ],
    };

    const changes = diffDocuments(current, desired);
    const shiftChanges = changes.filter(change => change.area === "EINSATZPLAN");
    const updateKeys = shiftChanges
      .filter(change => change.action === "update")
      .map(change => change.key);
    const createKeys = shiftChanges
      .filter(change => change.action === "create")
      .map(change => change.key);

    expect(updateKeys).toEqual(["EINSATZPLAN:update:50"]);
    expect(createKeys).toEqual(["EINSATZPLAN:new:1"]);
    expect(new Set(shiftChanges.map(change => change.key)).size).toBe(
      shiftChanges.length
    );
  });

  it("erhält bei alten Helferblättern ohne Mo-bis-Do-Spalten die bisherige Werktagsverfügbarkeit", async () => {
    const exported = await exportBackupExcel();
    const legacy = mutateWorkbook(exported.buffer, workbook => {
      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      for (const row of helperRows) {
        delete row.Mo;
        delete row.Di;
        delete row.Mi;
        delete row.Do;
      }
      replaceSheet(workbook, "HELFER", helperRows);
    });

    const parsed = parseBackupWorkbook(legacy.toString("base64"));
    expect(parsed.helpers).toHaveLength(2);
    for (const helper of parsed.helpers) {
      expect(helper).toMatchObject({
        availMon: "ja",
        availTue: "ja",
        availWed: "ja",
        availThu: "ja",
      });
    }
  });

  it("übernimmt bei Teilselektion nur die markierte Änderung", async () => {
    data.finances.splice(0, data.finances.length, {
      id: 60,
      year: 2026,
      eventId: 1,
      category: "Startgeld",
      income: 1000,
      expense: 0,
      note: null,
      sortOrder: 0,
    } as never);
    const exported = await exportBackupExcel();
    const current = parseBackupWorkbook(exported.buffer.toString("base64"));
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      replaceSheet(
        workbook,
        "HELFER",
        helperRows.filter(row => row.Name !== "Alex Beispiel")
      );
      const shiftRows = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.EINSATZPLAN
      );
      shiftRows[0]["Helfer 1 ID"] = "";
      shiftRows[0]["Helfer 1"] = "";
      replaceSheet(workbook, "EINSATZPLAN", shiftRows);
      const financeRows = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.FINANZEN
      );
      financeRows[0].Einnahmen = 99;
      replaceSheet(workbook, "FINANZEN", financeRows);
    });
    const desired = parseBackupWorkbook(changed.toString("base64"));
    const changes = diffDocuments(current, desired);
    const financeChange = changes.find(change => change.area === "FINANZEN");
    expect(financeChange).toBeDefined();

    const selected = buildSelectedDocument(current, desired, changes, [
      financeChange!.key,
    ]);
    const selectedChanges = diffDocuments(current, selected);

    expect(selectedChanges).toEqual([
      expect.objectContaining({ area: "FINANZEN", action: "update" }),
    ]);
    expect(selected.helpers.some(row => row.name === "Alex Beispiel")).toBe(
      true
    );
    expect(selected.shifts[0].slots).toHaveLength(1);
  });

  it("blockiert eine Tag-Deaktivierung ohne zugehörige Schichtlöschung", async () => {
    const exported = await exportBackupExcel();
    const current = parseBackupWorkbook(exported.buffer.toString("base64"));
    const desired = structuredClone(current);
    desired.metadata.activeDays = ["Samstag", "Sonntag"];
    desired.shifts = [];
    const changes = [
      {
        key: "VERANSTALTUNG:update:activeDays",
        area: "VERANSTALTUNG" as const,
        action: "update" as const,
        label: "Aktive Veranstaltungstage",
        fields: ["activeDays"],
        before: { activeDays: current.metadata.activeDays },
        after: { activeDays: desired.metadata.activeDays },
      },
      ...diffDocuments(current, desired),
    ];

    expect(() =>
      buildSelectedDocument(current, desired, changes, [
        "VERANSTALTUNG:update:activeDays",
      ])
    ).toThrow("zugehörigen Einsatzplanänderungen");
  });

  it("akzeptiert neue Ansprechpartner und ihre verknüpfte eigene Helferzeile ohne IDs", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const contactRows = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.ANSPRECHPARTNER
      );
      contactRows.push({
        ID: "",
        Name: "Dana Neu",
        Rufnummer: "0999",
        Bemerkung: "",
        Reihenfolge: 10,
      });
      replaceSheet(workbook, "ANSPRECHPARTNER", contactRows);
      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      helperRows.push({
        ID: "",
        "Ansprechpartner-ID": "",
        Ansprechpartner: "Dana Neu",
        Name: "Dana Neu",
        "E-Mail": "",
        Telefon: "0999",
        Bemerkung: "",
        "Helfen?": "ja",
        Fr: "ja",
        Sa: "nein",
        So: "nein",
        "Bestätigt?": "nein",
      });
      replaceSheet(workbook, "HELFER", helperRows);
    });

    const parsed = parseBackupWorkbook(changed.toString("base64"));
    expect(parsed.contacts.at(-1)).toMatchObject({
      name: "Dana Neu",
      sourceId: null,
    });
    expect(parsed.helpers.at(-1)).toMatchObject({
      name: "Dana Neu",
      contactName: "Dana Neu",
      contactSourceId: null,
    });
  });

  it("verknüpft einen gleichnamigen Helfer beim Import automatisch mit seinem Ansprechpartner", () => {
    const helpers: any[] = [
      {
        sourceId: 21,
        contactSourceId: null,
        contactName: "",
        name: "Klaus Anton",
        email: "",
        phone: "",
        note: "",
        willHelp: "ja",
        availMon: "vielleicht",
        availTue: "vielleicht",
        availWed: "vielleicht",
        availThu: "vielleicht",
        availFri: "ja",
        availSat: "ja",
        availSun: "ja",
        confirmed: "nein",
      },
    ];

    expect(
      reconcileContactSelfHelpers(
        [{ sourceId: 11, name: "Klaus Anton", phone: "02651 123", note: "", sortOrder: 0 }],
        helpers
      )
    ).toEqual({ linked: 1, created: 0 });
    expect(helpers[0]).toMatchObject({
      name: "Klaus Anton",
      contactSourceId: 11,
      contactName: "Klaus Anton",
    });
  });

  it("ergänzt einen fehlenden eigenen Ansprechpartner-Helfer automatisch", () => {
    const helpers: any[] = [];

    expect(
      reconcileContactSelfHelpers(
        [{ sourceId: 11, name: "Klaus Anton", phone: "02651 123", note: "", sortOrder: 0 }],
        helpers
      )
    ).toEqual({ linked: 0, created: 1 });
    expect(helpers).toEqual([
      expect.objectContaining({
        sourceId: null,
        contactSourceId: 11,
        contactName: "Klaus Anton",
        name: "Klaus Anton",
        phone: "02651 123",
      }),
    ]);
  });

  it("normalisiert ISO-Zeitstempel und Excel-Tagesbruchteile vor der Einsatzplanvalidierung", () => {
    expect(normalizeImportedTime("1899-12-31T08:00:00.000Z")).toBe("08:00");
    expect(normalizeImportedTime("2027-06-14 17:45:30")).toBe("17:45");
    expect(normalizeImportedTime(8 / 24)).toBe("08:00");
    expect(normalizeImportedTime(0.5)).toBe("12:00");
    expect(normalizeImportedTime("08:30")).toBe("08:30");
  });

  it("akzeptiert ISO-Zeitwerte im Einsatzplan ohne die 16-Zeichen-Freitagabe zu verletzen", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.EINSATZPLAN);
      rows[0].Beginn = "1899-12-31T08:00:00.000Z";
      rows[0].Ende = "1899-12-31T10:00:00.000Z";
      replaceSheet(workbook, "EINSATZPLAN", rows);
    });

    expect(parseBackupWorkbook(changed.toString("base64")).shifts[0]).toMatchObject({
      startTime: "08:00",
      endTime: "10:00",
    });
  });

  it("repariert veraltete Ansprechpartnerreferenzen vor der Wiederherstellung ohne Helfer zu verwerfen", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      const helper = helperRows.find(row => row.Name === "Alex Beispiel");
      helper["Ansprechpartner-ID"] = 999_999;
      helper.Ansprechpartner = "Nicht mehr vorhandene Leitung";
      replaceSheet(workbook, "HELFER", helperRows);
    });

    const parsed = parseBackupWorkbook(changed.toString("base64"));
    const helper = parsed.helpers.find(row => row.name === "Alex Beispiel");

    expect(helper).toMatchObject({
      contactSourceId: null,
      contactName: "",
      name: "Alex Beispiel",
    });
    expect(parsed.warnings).toContain(
      "HELFER Zeile 3: Ansprechpartner: Fehlende Ansprechpartnerreferenz ID 999999. Der Datensatz bleibt erhalten, die Zuordnung wird entfernt."
    );
    expect(comparableProjectContent(parsed).helpers).toContainEqual(
      expect.objectContaining({ name: "Alex Beispiel", contactName: "" })
    );
  });

  it("verknüpft einen ID-basierten Ansprechpartnerbezug auch ohne alten Namen kanonisch neu", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      const helper = helperRows.find(row => row.Name === "Alex Beispiel");
      helper["Ansprechpartner-ID"] = 10;
      helper.Ansprechpartner = "";
      replaceSheet(workbook, "HELFER", helperRows);
    });

    const parsed = parseBackupWorkbook(changed.toString("base64"));
    expect(parsed.helpers.find(row => row.name === "Alex Beispiel")).toMatchObject({
      contactSourceId: 10,
      contactName: "Chris Leitung",
    });
  });

  it("vereinheitlicht leere und unterschiedliche Ansprechpartner innerhalb eines Einsatzbereichs", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const contactRows = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.ANSPRECHPARTNER
      );
      contactRows.push({
        ID: 11,
        Name: "Alex Leitung",
        Rufnummer: "0999",
        Bemerkung: "",
        Reihenfolge: 1,
      });
      replaceSheet(workbook, "ANSPRECHPARTNER", contactRows);

      const helperRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      helperRows.push({
        ID: 22,
        "Ansprechpartner-ID": 11,
        Ansprechpartner: "Alex Leitung",
        Name: "Alex Leitung",
        "E-Mail": "",
        Telefon: "0999",
        Bemerkung: "",
        "Helfen?": "ja",
        Mo: "ja",
        Di: "ja",
        Mi: "ja",
        Do: "ja",
        Fr: "ja",
        Sa: "ja",
        So: "ja",
        "Bestätigt?": "nein",
      });
      replaceSheet(workbook, "HELFER", helperRows);

      const [shift] = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.EINSATZPLAN
      );
      for (let slot = 1; slot <= 20; slot++) {
        shift[`Helfer ${slot} ID`] = "";
        shift[`Helfer ${slot}`] = "";
      }
      const shifts = [
        {
          ...shift,
          Bereich: "Putzen",
          Aufgabe: "Aufbau",
          "Bereichsansprechpartner-ID": "",
          Bereichsansprechpartner: "",
        },
        {
          ...shift,
          ID: "",
          Bereich: "Putzen",
          Aufgabe: "Sortieren",
          Beginn: "10:00",
          Ende: "11:00",
          "Bereichsansprechpartner-ID": 10,
          Bereichsansprechpartner: "Chris Leitung",
        },
        {
          ...shift,
          ID: "",
          Bereich: "Putzen",
          Aufgabe: "Abschluss",
          Beginn: "11:00",
          Ende: "12:00",
          "Bereichsansprechpartner-ID": 11,
          Bereichsansprechpartner: "Alex Leitung",
        },
      ];
      replaceSheet(workbook, "EINSATZPLAN", shifts);
    });

    const parsed = parseBackupWorkbook(changed.toString("base64"));
    expect(parsed.shifts).toHaveLength(3);
    expect(parsed.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "Putzen",
          areaContactSourceId: 10,
          areaContactName: "Chris Leitung",
        }),
      ])
    );
    expect(
      parsed.shifts.every(
        row =>
          row.areaContactSourceId === 10 &&
          row.areaContactName === "Chris Leitung"
      )
    ).toBe(true);
  });

  it("blockiert zeitlich überlappende Doppelbelegungen", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.EINSATZPLAN);
      rows.push({
        ...rows[0],
        ID: "",
        Aufgabe: "Parallelaufgabe",
        Beginn: "09:00",
        Ende: "11:00",
      });
      replaceSheet(workbook, "EINSATZPLAN", rows);
    });

    expect(() => parseBackupWorkbook(changed.toString("base64"))).toThrow(
      "Doppelbelegung"
    );
  });

  it("blockiert Zuweisungen nicht verfügbarer Helfer", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets.HELFER);
      const assignedHelper = rows.find(row => row.Name === "Alex Beispiel");
      assignedHelper.Fr = "nein";
      replaceSheet(workbook, "HELFER", rows);
    });

    expect(() => parseBackupWorkbook(changed.toString("base64"))).toThrow(
      "Alex Beispiel"
    );
  });

  it("weist Sicherungen einer anderen Veranstaltung zurück", async () => {
    const exported = await exportBackupExcel();
    const changed = mutateWorkbook(exported.buffer, workbook => {
      const rows = XLSX.utils.sheet_to_json<any>(
        workbook.Sheets.SICHERUNG_INFO
      );
      const eventRow = rows.find(row => row.Schlüssel === "Veranstaltungs-ID");
      eventRow.Wert = 99;
      replaceSheet(workbook, "SICHERUNG_INFO", rows);
    });

    await expect(
      previewBackupRestore(changed.toString("base64"))
    ).rejects.toThrow("Sicherung gehört");
  });

  it("weist ein vorgetäuscht übergroßes XLSX-Archiv vor dem Entpacken zurück", async () => {
    const exported = await exportBackupExcel();
    const hostile = Buffer.from(exported.buffer);
    const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    const centralOffset = hostile.indexOf(signature);
    expect(centralOffset).toBeGreaterThanOrEqual(0);
    hostile.writeUInt32LE(100_000_001, centralOffset + 24);

    expect(() => parseBackupWorkbook(hostile.toString("base64"))).toThrow(
      "entpackt größer als 100 MB"
    );
  });

  it("weist manipulierte Central- und Local-Header vor dem SheetJS-Entpacken zurück", async () => {
    const exported = await exportBackupExcel();
    const hostile = Buffer.from(exported.buffer);
    const centralSignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    let centralOffset = hostile.indexOf(centralSignature);
    while (centralOffset >= 0) {
      const method = hostile.readUInt16LE(centralOffset + 10);
      const uncompressed = hostile.readUInt32LE(centralOffset + 24);
      if (method === 8 && uncompressed > 100) break;
      centralOffset = hostile.indexOf(centralSignature, centralOffset + 4);
    }
    expect(centralOffset).toBeGreaterThanOrEqual(0);
    const localOffset = hostile.readUInt32LE(centralOffset + 42);
    hostile.writeUInt32LE(1, centralOffset + 24);
    const flags = hostile.readUInt16LE(centralOffset + 8);
    if ((flags & 0x8) === 0) hostile.writeUInt32LE(1, localOffset + 22);

    expect(() => parseBackupWorkbook(hostile.toString("base64"))).toThrow(
      /ZIP-Größen|sichere Größenlimit/
    );
  });

  it("bereinigt Wiederherstellungsprotokolle nach 90 Tagen und über 100 Vorgängen", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const cutoff = new Date(
      now.getTime() - BACKUP_RESTORE_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const entries = Array.from(
      { length: MAX_BACKUP_RESTORE_LOGS_PER_SCOPE + 2 },
      (_, index) => ({
        id: index + 1,
        createdAt: new Date(now.getTime() - index * 60_000),
      })
    );
    entries.push({ id: 999, createdAt: new Date(cutoff.getTime() - 1) });

    expect(backupRestoreLogIdsToPrune(entries, cutoff).sort((a, b) => a - b)).toEqual([
      101,
      102,
      999,
    ]);
  });
});
