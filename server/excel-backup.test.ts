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
  buildSelectedDocument,
  diffDocuments,
  exportBackupExcel,
  parseBackupWorkbook,
  previewBackupRestore,
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
});
