import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as XLSX from "xlsx";
import {
  approvals,
  assignments,
  backupRestoreLogs,
  cakes,
  contacts,
  events,
  eventYears,
  finances,
  helpers,
  marketing,
  materials,
  postTasks,
  prepTasks,
  shiftAreaContacts,
  shifts,
} from "../drizzle/schema";
import {
  eventWeekdays,
  helperAvailableOnDay,
  orderedWeekdays,
  WEEKDAYS,
  type Weekday,
} from "../shared/weekdays";
import { overlaps, toMinutes } from "./logic";
import { currentEventId, currentEventYear } from "./year-context";
import { getDb, type AuditActor } from "./db";

const BACKUP_FORMAT = "RSC-HELFERPLANUNG-SICHERUNG";
const BACKUP_VERSION = 1;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_CHANGES = 5_000;
const MAX_UNCOMPRESSED_BYTES = 100_000_000;
const MAX_ZIP_ENTRIES = 1_000;
const MAX_CHANGE_PAYLOAD_BYTES = 8_000_000;
const MAX_CONCURRENT_EXCEL_OPERATIONS = 2;
let activeExcelOperations = 0;
const SHEETS = [
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
] as const;
export const PROJECT_EXCEL_HEADERS: Record<string, string[]> = {
  ANSPRECHPARTNER: ["ID", "Name", "Rufnummer", "Bemerkung", "Reihenfolge"],
  HELFER: [
    "ID",
    "Ansprechpartner-ID",
    "Ansprechpartner",
    "Name",
    "E-Mail",
    "Telefon",
    "Bemerkung",
    "Helfen?",
    "Mo",
    "Di",
    "Mi",
    "Do",
    "Fr",
    "Sa",
    "So",
    "Bestätigt?",
  ],
  EINSATZPLAN: [
    "ID",
    "Tag",
    "Bereich",
    "Aufgabe",
    "Beginn",
    "Ende",
    "Bedarf",
    "Bemerkung",
    "Reihenfolge",
    "Bereichsansprechpartner-ID",
    "Bereichsansprechpartner",
    ...Array.from({ length: 20 }, (_, slot) => [
      `Helfer ${slot + 1} ID`,
      `Helfer ${slot + 1}`,
    ]).flat(),
  ],
  VORBEREITUNG: [
    "ID",
    "Aufgabe",
    "Zu erledigen bis",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  NACHBEREITUNG: [
    "ID",
    "Aufgabe",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  MATERIAL: [
    "ID",
    "Artikel",
    "Kategorie",
    "Menge",
    "Einheit",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Bestellt",
    "Bemerkung",
    "Reihenfolge",
  ],
  MARKETING: [
    "ID",
    "Maßnahme",
    "Kanal",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  GENEHMIGUNGEN: [
    "ID",
    "Antrag",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  KUCHEN: ["ID", "Spender", "Kuchen", "Abgabezeit", "Bemerkung", "Reihenfolge"],
  FINANZEN: [
    "ID",
    "Kategorie",
    "Einnahmen",
    "Ausgaben",
    "Bemerkung",
    "Reihenfolge",
  ],
};

type Client = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ChangeAction = "create" | "update" | "delete";
export type BackupArea =
  | (typeof SHEETS)[number]
  | "VERANSTALTUNG"
  | "ZUORDNUNGEN";
export type BackupChange = {
  key: string;
  area: BackupArea;
  action: ChangeAction;
  label: string;
  fields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export async function withExcelOperationLimit<T>(
  operation: () => Promise<T>
): Promise<T> {
  if (activeExcelOperations >= MAX_CONCURRENT_EXCEL_OPERATIONS) {
    throw new Error(
      "Es laufen bereits mehrere Excel-Prüfungen. Bitte versuchen Sie es in wenigen Sekunden erneut."
    );
  }
  activeExcelOperations++;
  try {
    return await operation();
  } finally {
    activeExcelOperations--;
  }
}

type ContactRow = {
  sourceId: number | null;
  name: string;
  phone: string;
  note: string;
  sortOrder: number;
};
type HelperRow = {
  sourceId: number | null;
  contactSourceId: number | null;
  contactName: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  willHelp: "ja" | "nein";
  availMon: "ja" | "nein" | "vielleicht";
  availTue: "ja" | "nein" | "vielleicht";
  availWed: "ja" | "nein" | "vielleicht";
  availThu: "ja" | "nein" | "vielleicht";
  availFri: "ja" | "nein" | "vielleicht";
  availSat: "ja" | "nein" | "vielleicht";
  availSun: "ja" | "nein" | "vielleicht";
  confirmed: "ja" | "nein";
};
type ShiftRow = {
  sourceId: number | null;
  day: Weekday;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
  needed: number;
  note: string;
  sortOrder: number;
  areaContactSourceId: number | null;
  areaContactName: string;
  slots: Array<{
    slot: number;
    helperSourceId: number | null;
    helperName: string;
  }>;
};
type TaskRow = {
  sourceId: number | null;
  task: string;
  contactSourceId: number | null;
  contactName: string;
  status: "offen" | "inArbeit" | "erledigt";
  note: string;
  sortOrder: number;
};
type PrepRow = TaskRow & { dueText: string };
type MaterialRow = {
  sourceId: number | null;
  article: string;
  category: string;
  quantity: string;
  unit: string;
  contactSourceId: number | null;
  contactName: string;
  ordered: "ja" | "nein";
  note: string;
  sortOrder: number;
};
type MarketingRow = {
  sourceId: number | null;
  measure: string;
  channel: string;
  contactSourceId: number | null;
  contactName: string;
  status: "offen" | "inArbeit" | "erledigt";
  note: string;
  sortOrder: number;
};
type ApprovalRow = {
  sourceId: number | null;
  request: string;
  contactSourceId: number | null;
  contactName: string;
  status: "offen" | "beantragt" | "genehmigt" | "abgelehnt";
  note: string;
  sortOrder: number;
};
type CakeRow = {
  sourceId: number | null;
  donor: string;
  cake: string;
  dropoffTime: string;
  note: string;
  sortOrder: number;
};
type FinanceRow = {
  sourceId: number | null;
  category: string;
  income: number;
  expense: number;
  note: string;
  sortOrder: number;
};

export type BackupDocument = {
  metadata: {
    format: string;
    version: number;
    eventId: number;
    eventName: string;
    year: number;
    activeDays: Weekday[];
    pdfLogoKey: string | null;
    pdfLogoUrl: string | null;
    pdfLogoFallback: "none" | "brand";
    exportedAt: string;
  };
  contacts: ContactRow[];
  helpers: HelperRow[];
  shifts: ShiftRow[];
  prep: PrepRow[];
  post: TaskRow[];
  materials: MaterialRow[];
  marketing: MarketingRow[];
  approvals: ApprovalRow[];
  cakes: CakeRow[];
  finances: FinanceRow[];
  warnings: string[];
};

type CurrentSnapshot = {
  eventName: string;
  activeDays: Weekday[];
  pdfLogoKey: string | null;
  pdfLogoUrl: string | null;
  pdfLogoFallback: "none" | "brand";
  contacts: any[];
  helpers: any[];
  shifts: any[];
  areaContacts: any[];
  assignments: any[];
  prep: any[];
  post: any[];
  materials: any[];
  marketing: any[];
  approvals: any[];
  cakes: any[];
  finances: any[];
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
const personKey = (value: unknown) =>
  normalize(value).toLocaleLowerCase("de-DE");
const text = (value: unknown, max: number, label: string, required = false) => {
  const result = normalize(value);
  if (required && !result) throw new Error(`${label} darf nicht leer sein`);
  if (result.length > max)
    throw new Error(`${label} ist länger als ${max} Zeichen`);
  return result;
};
const nullableId = (value: unknown, label: string) => {
  if (value === null || value === undefined || normalize(value) === "")
    return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error(`${label} enthält keine gültige ID`);
  return number;
};
const integer = (value: unknown, label: string, min: number, max: number) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max)
    throw new Error(`${label} muss zwischen ${min} und ${max} liegen`);
  return number;
};
const moneyCents = (value: unknown, label: string) => {
  const number =
    typeof value === "number"
      ? value
      : Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > 100_000_000)
    throw new Error(`${label} ist kein gültiger positiver Betrag`);
  return Math.round(number * 100);
};
const enumValue = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  fallback?: T
): T => {
  const raw = normalize(value);
  const match = allowed.find(
    item => item.toLocaleLowerCase("de-DE") === raw.toLocaleLowerCase("de-DE")
  );
  if (match) return match;
  if (fallback !== undefined && !raw) return fallback;
  throw new Error(`${label} enthält den ungültigen Wert „${raw}“`);
};
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const chunk = <T>(rows: T[], size = 500) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size)
  );

function sheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Pflichtblatt „${name}“ fehlt`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  if (rows.length > MAX_ROWS_PER_SHEET)
    throw new Error(
      `Blatt „${name}“ enthält mehr als ${MAX_ROWS_PER_SHEET} Zeilen`
    );
  return rows;
}

function metadata(workbook: XLSX.WorkBook) {
  const rows = sheetRows(workbook, "SICHERUNG_INFO");
  const values = new Map(
    rows.map(row => [normalize(row.Schlüssel), normalize(row.Wert)])
  );
  const format = values.get("Format") ?? "";
  const version = Number(values.get("Version"));
  const eventId = Number(values.get("Veranstaltungs-ID"));
  const year = Number(values.get("Jahr"));
  const eventName = values.get("Veranstaltung") ?? "";
  const activeDays = orderedWeekdays(
    (values.get("Veranstaltungstage") ?? "").split(",").map(day => day.trim())
  );
  const pdfLogoKey = values.get("PDF-Bild-Schlüssel") || null;
  const pdfLogoUrl = values.get("PDF-Bild-URL") || null;
  const pdfLogoFallback: "none" | "brand" =
    values.get("PDF-Bild-Fallback") === "brand" ? "brand" : "none";
  const exportedAt = values.get("Exportiert am (UTC)") ?? "";
  if (format !== BACKUP_FORMAT || version !== BACKUP_VERSION)
    throw new Error(
      "Die Datei ist keine unterstützte RSC-Sicherungsdatei. Bitte zuerst einen aktuellen Export erstellen."
    );
  if (
    !Number.isSafeInteger(eventId) ||
    eventId <= 0 ||
    !Number.isInteger(year) ||
    !eventName ||
    !Number.isFinite(Date.parse(exportedAt))
  )
    throw new Error(
      "Die Sicherungsinformationen sind unvollständig oder beschädigt"
    );
  return {
    format,
    version,
    eventId,
    year,
    eventName,
    activeDays: activeDays.length ? activeDays : [...WEEKDAYS],
    pdfLogoKey,
    pdfLogoUrl,
    pdfLogoFallback,
    exportedAt,
  };
}

function ensureUnique<T>(
  rows: T[],
  getId: (row: T) => number | null,
  getLabel: (row: T) => string,
  sheet: string
) {
  const ids = new Set<number>();
  const labels = new Set<string>();
  for (const row of rows) {
    const id = getId(row);
    if (id !== null && ids.has(id))
      throw new Error(`${sheet}: technische ID ${id} ist doppelt vorhanden`);
    if (id !== null) ids.add(id);
    const label = personKey(getLabel(row));
    if (labels.has(label))
      throw new Error(`${sheet}: „${getLabel(row)}“ ist doppelt vorhanden`);
    labels.add(label);
  }
}

function validateZipEnvelope(buffer: Buffer) {
  const localSignature = 0x04034b50;
  const endSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const searchStart = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= searchStart; offset--) {
    if (buffer.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0)
    throw new Error("Die Excel-Datei ist kein gültiges XLSX-Archiv");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  )
    throw new Error("ZIP64-Excel-Dateien werden nicht unterstützt");
  if (entryCount > MAX_ZIP_ENTRIES)
    throw new Error("Die Excel-Datei enthält zu viele interne Dateien");
  if (centralOffset + centralSize > buffer.length)
    throw new Error("Die Excel-Datei enthält ein beschädigtes ZIP-Verzeichnis");

  let offset = centralOffset;
  let uncompressedBytes = 0;
  const localOffsets = new Set<number>();
  for (let entry = 0; entry < entryCount; entry++) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== centralSignature
    )
      throw new Error(
        "Die Excel-Datei enthält ein beschädigtes ZIP-Verzeichnis"
      );
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    if (
      compressed === 0xffffffff ||
      uncompressed === 0xffffffff ||
      localOffset === 0xffffffff
    )
      throw new Error("ZIP64-Excel-Dateien werden nicht unterstützt");
    uncompressedBytes += uncompressed;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES)
      throw new Error(
        "Die Excel-Datei ist entpackt größer als 100 MB und wird aus Sicherheitsgründen abgewiesen"
      );
    if (flags & 0x1)
      throw new Error("Verschlüsselte Excel-Dateien werden nicht unterstützt");
    if (method !== 0 && method !== 8)
      throw new Error(
        "Die Excel-Datei verwendet eine unbekannte Komprimierung"
      );
    if (localOffsets.has(localOffset))
      throw new Error("Die Excel-Datei enthält doppelte ZIP-Einträge");
    localOffsets.add(localOffset);
    if (
      localOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localOffset) !== localSignature
    )
      throw new Error("Die Excel-Datei enthält einen beschädigten ZIP-Eintrag");
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localCompressed = buffer.readUInt32LE(localOffset + 18);
    const localUncompressed = buffer.readUInt32LE(localOffset + 22);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    if (localFlags !== flags || localMethod !== method)
      throw new Error("Die Excel-Datei enthält widersprüchliche ZIP-Header");
    const usesDataDescriptor = (flags & 0x8) !== 0;
    if (
      !usesDataDescriptor &&
      (localCompressed !== compressed || localUncompressed !== uncompressed)
    )
      throw new Error("Die Excel-Datei enthält widersprüchliche ZIP-Größen");
    if (
      usesDataDescriptor &&
      ((localCompressed !== 0 && localCompressed !== compressed) ||
        (localUncompressed !== 0 && localUncompressed !== uncompressed))
    )
      throw new Error("Die Excel-Datei enthält widersprüchliche ZIP-Größen");
    const centralName = buffer.subarray(
      offset + 46,
      offset + 46 + filenameLength
    );
    const localName = buffer.subarray(
      localOffset + 30,
      localOffset + 30 + localNameLength
    );
    if (!centralName.equals(localName))
      throw new Error(
        "Die Excel-Datei enthält widersprüchliche ZIP-Dateinamen"
      );
    const payloadStart = localOffset + 30 + localNameLength + localExtraLength;
    const payloadEnd = payloadStart + compressed;
    if (payloadEnd > centralOffset || payloadEnd > buffer.length)
      throw new Error("Die Excel-Datei enthält einen beschädigten ZIP-Eintrag");
    const payload = buffer.subarray(payloadStart, payloadEnd);
    if (method === 0) {
      if (payload.length !== uncompressed)
        throw new Error("Die Excel-Datei enthält falsche ZIP-Größen");
    } else {
      try {
        const inflated = inflateRawSync(payload, {
          maxOutputLength: Math.min(
            uncompressed + 1,
            MAX_UNCOMPRESSED_BYTES - (uncompressedBytes - uncompressed) + 1
          ),
        });
        if (inflated.length !== uncompressed)
          throw new Error("Die Excel-Datei enthält falsche ZIP-Größen");
      } catch (error) {
        if (error instanceof Error && error.message.includes("ZIP-Größen"))
          throw error;
        throw new Error(
          "Die Excel-Datei überschreitet beim Entpacken das sichere Größenlimit oder ist beschädigt"
        );
      }
    }
    offset += 46 + filenameLength + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize)
    throw new Error("Die Excel-Datei enthält ein beschädigtes ZIP-Verzeichnis");
}

export function readUploadedExcelWorkbook(base64: string) {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > 15_000_000)
    throw new Error("Die Excel-Datei ist leer oder größer als 15 MB");
  validateZipEnvelope(bytes);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
  } catch {
    throw new Error("Die Excel-Datei ist beschädigt oder nicht lesbar");
  }
  return workbook;
}

export function parseBackupWorkbook(base64: string): BackupDocument {
  const workbook = readUploadedExcelWorkbook(base64);
  const meta = metadata(workbook);
  for (const required of SHEETS)
    if (!workbook.Sheets[required])
      throw new Error(`Pflichtblatt „${required}“ fehlt`);
  const warnings: string[] = [];

  const contactRows = sheetRows(workbook, "ANSPRECHPARTNER").filter(row =>
    normalize(row.Name)
  );
  const parsedContacts: ContactRow[] = contactRows.map((row, index) => ({
    sourceId: nullableId(row.ID, `ANSPRECHPARTNER Zeile ${index + 2}`),
    name: text(row.Name, 200, `ANSPRECHPARTNER Zeile ${index + 2}: Name`, true),
    phone: text(
      row.Rufnummer,
      64,
      `ANSPRECHPARTNER Zeile ${index + 2}: Rufnummer`
    ),
    note: text(
      row.Bemerkung,
      10_000,
      `ANSPRECHPARTNER Zeile ${index + 2}: Bemerkung`
    ),
    sortOrder: integer(
      row.Reihenfolge || 0,
      `ANSPRECHPARTNER Zeile ${index + 2}: Reihenfolge`,
      0,
      1_000_000
    ),
  }));
  ensureUnique(
    parsedContacts,
    row => row.sourceId,
    row => row.name,
    "ANSPRECHPARTNER"
  );
  const contactIds = new Set(
    parsedContacts.flatMap(row => (row.sourceId ? [row.sourceId] : []))
  );
  const contactNames = new Map(
    parsedContacts.map(row => [personKey(row.name), row.sourceId])
  );
  const contactRef = (idValue: unknown, nameValue: unknown, label: string) => {
    const id = nullableId(idValue, label);
    const nameKey = personKey(nameValue);
    if (!nameKey) return null;
    const byName = contactNames.get(nameKey);
    if (contactNames.has(nameKey)) return byName ?? null;
    if (id && contactIds.has(id)) return id;
    if (id || normalize(nameValue))
      warnings.push(
        `${label}: gelöschter oder unbekannter Ansprechpartner-Bezug wird geleert.`
      );
    return null;
  };

  const rawHelperRows = sheetRows(workbook, "HELFER");
  const helperHasColumn = (column: string) =>
    rawHelperRows.some(row =>
      Object.prototype.hasOwnProperty.call(row, column)
    );
  const helperRows = rawHelperRows.filter(row => normalize(row.Name));
  const parsedHelpers: HelperRow[] = helperRows.map((row, index) => ({
    sourceId: nullableId(row.ID, `HELFER Zeile ${index + 2}`),
    contactSourceId: contactRef(
      row["Ansprechpartner-ID"],
      row.Ansprechpartner,
      `HELFER Zeile ${index + 2}: Ansprechpartner`
    ),
    contactName: text(
      row.Ansprechpartner,
      200,
      `HELFER Zeile ${index + 2}: Ansprechpartner`
    ),
    name: text(row.Name, 200, `HELFER Zeile ${index + 2}: Name`, true),
    email: text(row["E-Mail"], 320, `HELFER Zeile ${index + 2}: E-Mail`),
    phone: text(row.Telefon, 64, `HELFER Zeile ${index + 2}: Telefon`),
    note: text(row.Bemerkung, 10_000, `HELFER Zeile ${index + 2}: Bemerkung`),
    willHelp: enumValue(
      row["Helfen?"],
      ["ja", "nein"] as const,
      `HELFER Zeile ${index + 2}: Helfen?`,
      "ja"
    ),
    availMon: enumValue(
      row.Mo,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Montag`,
      helperHasColumn("Mo") ? "vielleicht" : "ja"
    ),
    availTue: enumValue(
      row.Di,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Dienstag`,
      helperHasColumn("Di") ? "vielleicht" : "ja"
    ),
    availWed: enumValue(
      row.Mi,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Mittwoch`,
      helperHasColumn("Mi") ? "vielleicht" : "ja"
    ),
    availThu: enumValue(
      row.Do,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Donnerstag`,
      helperHasColumn("Do") ? "vielleicht" : "ja"
    ),
    availFri: enumValue(
      row.Fr,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Freitag`,
      "vielleicht"
    ),
    availSat: enumValue(
      row.Sa,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Samstag`,
      "vielleicht"
    ),
    availSun: enumValue(
      row.So,
      ["ja", "nein", "vielleicht"] as const,
      `HELFER Zeile ${index + 2}: Sonntag`,
      "vielleicht"
    ),
    confirmed: enumValue(
      row["Bestätigt?"],
      ["ja", "nein"] as const,
      `HELFER Zeile ${index + 2}: Bestätigt?`,
      "nein"
    ),
  }));
  ensureUnique(
    parsedHelpers,
    row => row.sourceId,
    row => row.name,
    "HELFER"
  );
  for (const contact of parsedContacts) {
    const selfHelper = parsedHelpers.find(
      helper => personKey(helper.name) === personKey(contact.name)
    );
    const linkedToContact =
      selfHelper &&
      ((contact.sourceId !== null &&
        selfHelper.contactSourceId === contact.sourceId) ||
        personKey(selfHelper.contactName) === personKey(contact.name));
    if (!linkedToContact) {
      throw new Error(
        `ANSPRECHPARTNER/HELFER: Für „${contact.name}“ muss der gleichnamige eigene Helfereintrag erhalten bleiben und diesem Ansprechpartner zugeordnet sein.`
      );
    }
  }
  const helperIds = new Set(
    parsedHelpers.flatMap(row => (row.sourceId ? [row.sourceId] : []))
  );
  const helperNames = new Map(
    parsedHelpers.map(row => [personKey(row.name), row.sourceId])
  );
  const helperRef = (idValue: unknown, nameValue: unknown, label: string) => {
    const id = nullableId(idValue, label);
    const nameKey = personKey(nameValue);
    if (!nameKey) return null;
    const byName = helperNames.get(nameKey);
    if (helperNames.has(nameKey)) return byName ?? null;
    if (id && helperIds.has(id)) return id;
    if (id || normalize(nameValue))
      warnings.push(
        `${label}: gelöschter oder unbekannter Helfer wird aus der Einteilung entfernt.`
      );
    return null;
  };

  const shiftRows = sheetRows(workbook, "EINSATZPLAN").filter(row =>
    normalize(row.Aufgabe)
  );
  const parsedShifts: ShiftRow[] = shiftRows.map((row, index) => {
    const day = enumValue(
      row.Tag,
      WEEKDAYS,
      `EINSATZPLAN Zeile ${index + 2}: Tag`
    );
    if (!meta.activeDays.includes(day))
      throw new Error(
        `EINSATZPLAN Zeile ${index + 2}: ${day} ist für diese Veranstaltung nicht aktiviert`
      );
    const startTime = text(
      row.Beginn,
      16,
      `EINSATZPLAN Zeile ${index + 2}: Beginn`
    );
    const endTime = text(row.Ende, 16, `EINSATZPLAN Zeile ${index + 2}: Ende`);
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    if (
      (startTime || endTime) &&
      (start === null || end === null || end <= start)
    )
      throw new Error(
        `EINSATZPLAN Zeile ${index + 2}: Beginn/Ende sind ungültig`
      );
    const needed = integer(
      row.Bedarf,
      `EINSATZPLAN Zeile ${index + 2}: Bedarf`,
      0,
      20
    );
    const slots = Array.from({ length: 20 }, (_, slot) => {
      const helperName = text(
        row[`Helfer ${slot + 1}`],
        200,
        `EINSATZPLAN Zeile ${index + 2}: Helfer ${slot + 1}`
      );
      const helperSourceId = helperRef(
        row[`Helfer ${slot + 1} ID`],
        helperName,
        `EINSATZPLAN Zeile ${index + 2}: Helfer ${slot + 1}`
      );
      return helperName &&
        (helperSourceId || helperNames.has(personKey(helperName)))
        ? { slot, helperSourceId, helperName }
        : null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    if (slots.some(slot => slot.slot >= needed))
      throw new Error(
        `EINSATZPLAN Zeile ${index + 2}: Ein Helfer steht außerhalb des Bedarfs`
      );
    if (
      new Set(
        slots.map(slot => slot.helperSourceId ?? personKey(slot.helperName))
      ).size !== slots.length
    )
      throw new Error(
        `EINSATZPLAN Zeile ${index + 2}: Ein Helfer ist in derselben Schicht doppelt eingetragen`
      );
    return {
      sourceId: nullableId(row.ID, `EINSATZPLAN Zeile ${index + 2}`),
      day,
      area: text(
        row.Bereich,
        200,
        `EINSATZPLAN Zeile ${index + 2}: Bereich`,
        true
      ),
      task: text(
        row.Aufgabe,
        300,
        `EINSATZPLAN Zeile ${index + 2}: Aufgabe`,
        true
      ),
      startTime,
      endTime,
      needed,
      note: text(
        row.Bemerkung,
        10_000,
        `EINSATZPLAN Zeile ${index + 2}: Bemerkung`
      ),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `EINSATZPLAN Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
      areaContactSourceId: contactRef(
        row["Bereichsansprechpartner-ID"],
        row.Bereichsansprechpartner,
        `EINSATZPLAN Zeile ${index + 2}: Bereichsansprechpartner`
      ),
      areaContactName: text(
        row.Bereichsansprechpartner,
        200,
        `EINSATZPLAN Zeile ${index + 2}: Bereichsansprechpartner`
      ),
      slots,
    };
  });
  ensureUnique(
    parsedShifts,
    row => row.sourceId,
    row => `${row.day}|${row.area}|${row.task}|${row.startTime}|${row.endTime}`,
    "EINSATZPLAN"
  );
  const areaContacts = new Map<string, string>();
  for (const row of parsedShifts) {
    const key = personKey(row.area);
    const contactKey = row.areaContactSourceId
      ? `id:${row.areaContactSourceId}`
      : `name:${personKey(row.areaContactName)}`;
    if (areaContacts.has(key) && areaContacts.get(key) !== contactKey)
      throw new Error(
        `EINSATZPLAN: Bereich „${row.area}“ hat unterschiedliche Ansprechpartner`
      );
    areaContacts.set(key, contactKey);
  }

  const parseTaskRows = (sheet: "NACHBEREITUNG", withDue = false) =>
    sheetRows(workbook, sheet)
      .filter(row => normalize(row.Aufgabe))
      .map((row, index) => ({
        sourceId: nullableId(row.ID, `${sheet} Zeile ${index + 2}`),
        task: text(
          row.Aufgabe,
          300,
          `${sheet} Zeile ${index + 2}: Aufgabe`,
          true
        ),
        ...(withDue
          ? {
              dueText: text(
                row["Zu erledigen bis"],
                200,
                `${sheet} Zeile ${index + 2}: Zu erledigen bis`
              ),
            }
          : {}),
        contactSourceId: contactRef(
          row["Verantwortlich-ID"],
          row.Verantwortlich,
          `${sheet} Zeile ${index + 2}: Verantwortlich`
        ),
        contactName: text(
          row.Verantwortlich,
          200,
          `${sheet} Zeile ${index + 2}: Verantwortlich`
        ),
        status: enumValue(
          row.Status,
          ["offen", "inArbeit", "erledigt"] as const,
          `${sheet} Zeile ${index + 2}: Status`,
          "offen"
        ),
        note: text(
          row.Bemerkung,
          10_000,
          `${sheet} Zeile ${index + 2}: Bemerkung`
        ),
        sortOrder: integer(
          row.Reihenfolge || 0,
          `${sheet} Zeile ${index + 2}: Reihenfolge`,
          0,
          1_000_000
        ),
      }));
  const parsedPrep: PrepRow[] = sheetRows(workbook, "VORBEREITUNG")
    .filter(row => normalize(row.Aufgabe))
    .map((row, index) => ({
      sourceId: nullableId(row.ID, `VORBEREITUNG Zeile ${index + 2}`),
      task: text(
        row.Aufgabe,
        300,
        `VORBEREITUNG Zeile ${index + 2}: Aufgabe`,
        true
      ),
      dueText: text(
        row["Zu erledigen bis"],
        200,
        `VORBEREITUNG Zeile ${index + 2}: Zu erledigen bis`
      ),
      contactSourceId: contactRef(
        row["Verantwortlich-ID"],
        row.Verantwortlich,
        `VORBEREITUNG Zeile ${index + 2}: Verantwortlich`
      ),
      contactName: text(
        row.Verantwortlich,
        200,
        `VORBEREITUNG Zeile ${index + 2}: Verantwortlich`
      ),
      status: enumValue(
        row.Status,
        ["offen", "inArbeit", "erledigt"] as const,
        `VORBEREITUNG Zeile ${index + 2}: Status`,
        "offen"
      ),
      note: text(
        row.Bemerkung,
        10_000,
        `VORBEREITUNG Zeile ${index + 2}: Bemerkung`
      ),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `VORBEREITUNG Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
    }));
  const parsedPost = parseTaskRows("NACHBEREITUNG") as TaskRow[];
  ensureUnique(
    parsedPrep,
    row => row.sourceId,
    row => row.task,
    "VORBEREITUNG"
  );
  ensureUnique(
    parsedPost,
    row => row.sourceId,
    row => row.task,
    "NACHBEREITUNG"
  );

  const parsedMaterials: MaterialRow[] = sheetRows(workbook, "MATERIAL")
    .filter(row => normalize(row.Artikel))
    .map((row, index) => ({
      sourceId: nullableId(row.ID, `MATERIAL Zeile ${index + 2}`),
      article: text(
        row.Artikel,
        300,
        `MATERIAL Zeile ${index + 2}: Artikel`,
        true
      ),
      category: text(
        row.Kategorie,
        120,
        `MATERIAL Zeile ${index + 2}: Kategorie`
      ),
      quantity: text(row.Menge, 40, `MATERIAL Zeile ${index + 2}: Menge`),
      unit: text(row.Einheit, 40, `MATERIAL Zeile ${index + 2}: Einheit`),
      contactSourceId: contactRef(
        row["Verantwortlich-ID"],
        row.Verantwortlich,
        `MATERIAL Zeile ${index + 2}: Verantwortlich`
      ),
      contactName: text(
        row.Verantwortlich,
        200,
        `MATERIAL Zeile ${index + 2}: Verantwortlich`
      ),
      ordered: enumValue(
        row.Bestellt,
        ["ja", "nein"] as const,
        `MATERIAL Zeile ${index + 2}: Bestellt`,
        "nein"
      ),
      note: text(
        row.Bemerkung,
        10_000,
        `MATERIAL Zeile ${index + 2}: Bemerkung`
      ),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `MATERIAL Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
    }));
  ensureUnique(
    parsedMaterials,
    row => row.sourceId,
    row => row.article,
    "MATERIAL"
  );

  const parsedMarketing: MarketingRow[] = sheetRows(workbook, "MARKETING")
    .filter(row => normalize(row.Maßnahme))
    .map((row, index) => ({
      sourceId: nullableId(row.ID, `MARKETING Zeile ${index + 2}`),
      measure: text(
        row.Maßnahme,
        300,
        `MARKETING Zeile ${index + 2}: Maßnahme`,
        true
      ),
      channel: text(row.Kanal, 160, `MARKETING Zeile ${index + 2}: Kanal`),
      contactSourceId: contactRef(
        row["Verantwortlich-ID"],
        row.Verantwortlich,
        `MARKETING Zeile ${index + 2}: Verantwortlich`
      ),
      contactName: text(
        row.Verantwortlich,
        200,
        `MARKETING Zeile ${index + 2}: Verantwortlich`
      ),
      status: enumValue(
        row.Status,
        ["offen", "inArbeit", "erledigt"] as const,
        `MARKETING Zeile ${index + 2}: Status`,
        "offen"
      ),
      note: text(
        row.Bemerkung,
        10_000,
        `MARKETING Zeile ${index + 2}: Bemerkung`
      ),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `MARKETING Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
    }));
  ensureUnique(
    parsedMarketing,
    row => row.sourceId,
    row => row.measure,
    "MARKETING"
  );

  const parsedApprovals: ApprovalRow[] = sheetRows(workbook, "GENEHMIGUNGEN")
    .filter(row => normalize(row.Antrag))
    .map((row, index) => ({
      sourceId: nullableId(row.ID, `GENEHMIGUNGEN Zeile ${index + 2}`),
      request: text(
        row.Antrag,
        300,
        `GENEHMIGUNGEN Zeile ${index + 2}: Antrag`,
        true
      ),
      contactSourceId: contactRef(
        row["Verantwortlich-ID"],
        row.Verantwortlich,
        `GENEHMIGUNGEN Zeile ${index + 2}: Verantwortlich`
      ),
      contactName: text(
        row.Verantwortlich,
        200,
        `GENEHMIGUNGEN Zeile ${index + 2}: Verantwortlich`
      ),
      status: enumValue(
        row.Status,
        ["offen", "beantragt", "genehmigt", "abgelehnt"] as const,
        `GENEHMIGUNGEN Zeile ${index + 2}: Status`,
        "offen"
      ),
      note: text(
        row.Bemerkung,
        10_000,
        `GENEHMIGUNGEN Zeile ${index + 2}: Bemerkung`
      ),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `GENEHMIGUNGEN Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
    }));
  ensureUnique(
    parsedApprovals,
    row => row.sourceId,
    row => row.request,
    "GENEHMIGUNGEN"
  );

  const parsedCakes: CakeRow[] = sheetRows(workbook, "KUCHEN")
    .filter(row => normalize(row.Spender))
    .map((row, index) => ({
      sourceId: nullableId(row.ID, `KUCHEN Zeile ${index + 2}`),
      donor: text(row.Spender, 200, `KUCHEN Zeile ${index + 2}: Spender`, true),
      cake: text(row.Kuchen, 200, `KUCHEN Zeile ${index + 2}: Kuchen`),
      dropoffTime: text(
        row.Abgabezeit,
        60,
        `KUCHEN Zeile ${index + 2}: Abgabezeit`
      ),
      note: text(row.Bemerkung, 10_000, `KUCHEN Zeile ${index + 2}: Bemerkung`),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `KUCHEN Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
    }));
  ensureUnique(
    parsedCakes,
    row => row.sourceId,
    row => `${row.donor}|${row.cake}`,
    "KUCHEN"
  );

  const parsedFinances: FinanceRow[] = sheetRows(workbook, "FINANZEN")
    .filter(row => normalize(row.Kategorie))
    .map((row, index) => ({
      sourceId: nullableId(row.ID, `FINANZEN Zeile ${index + 2}`),
      category: text(
        row.Kategorie,
        160,
        `FINANZEN Zeile ${index + 2}: Kategorie`,
        true
      ),
      income: moneyCents(
        row.Einnahmen,
        `FINANZEN Zeile ${index + 2}: Einnahmen`
      ),
      expense: moneyCents(
        row.Ausgaben,
        `FINANZEN Zeile ${index + 2}: Ausgaben`
      ),
      note: text(
        row.Bemerkung,
        10_000,
        `FINANZEN Zeile ${index + 2}: Bemerkung`
      ),
      sortOrder: integer(
        row.Reihenfolge || 0,
        `FINANZEN Zeile ${index + 2}: Reihenfolge`,
        0,
        1_000_000
      ),
    }));
  ensureUnique(
    parsedFinances,
    row => row.sourceId,
    row => row.category,
    "FINANZEN"
  );

  const helperBySourceId = new Map(
    parsedHelpers.flatMap(row =>
      row.sourceId ? [[row.sourceId, row] as const] : []
    )
  );
  const shiftBySourceId = new Map(
    parsedShifts.flatMap(row =>
      row.sourceId ? [[row.sourceId, row] as const] : []
    )
  );
  const helperShifts = new Map<string, ShiftRow[]>();
  for (const shift of parsedShifts)
    for (const slot of shift.slots) {
      const helper = slot.helperSourceId
        ? helperBySourceId.get(slot.helperSourceId)
        : parsedHelpers.find(
            item => personKey(item.name) === personKey(slot.helperName)
          );
      if (!helper) continue;
      if (!helperAvailableOnDay(helper, shift.day))
        throw new Error(
          `EINSATZPLAN „${shift.task}“: Helfer „${helper.name}“ ist an ${shift.day} nicht verfügbar`
        );
      const helperKey = slot.helperSourceId
        ? `id:${slot.helperSourceId}`
        : `name:${personKey(slot.helperName)}`;
      const list = helperShifts.get(helperKey) ?? [];
      list.push(shift);
      helperShifts.set(helperKey, list);
    }
  for (const [helperKey, assignedShifts] of Array.from(
    helperShifts.entries()
  )) {
    for (let left = 0; left < assignedShifts.length; left++)
      for (let right = left + 1; right < assignedShifts.length; right++) {
        const a = assignedShifts[left];
        const b = assignedShifts[right];
        if (overlaps(a as any, b as any))
          throw new Error(
            `Doppelbelegung: ${helperKey.startsWith("id:") ? (helperBySourceId.get(Number(helperKey.slice(3)))?.name ?? helperKey) : (parsedHelpers.find(item => personKey(item.name) === helperKey.slice(5))?.name ?? helperKey)} ist gleichzeitig in „${a.task}“ und „${b.task}“ eingeteilt`
          );
      }
  }
  void shiftBySourceId;

  return {
    metadata: meta,
    contacts: parsedContacts,
    helpers: parsedHelpers,
    shifts: parsedShifts,
    prep: parsedPrep,
    post: parsedPost,
    materials: parsedMaterials,
    marketing: parsedMarketing,
    approvals: parsedApprovals,
    cakes: parsedCakes,
    finances: parsedFinances,
    warnings: Array.from(new Set(warnings)),
  };
}

async function loadSnapshot(
  client?: Client | any,
  lockRows = false
): Promise<CurrentSnapshot> {
  const database = client ?? ((await getDb()) as Client);
  const year = currentEventYear();
  const eventId = currentEventId();
  const scope = (table: any) =>
    and(eq(table.year, year), eq(table.eventId, eventId));
  const selectRows = (
    table: any,
    condition: any,
    limit?: number
  ): Promise<any[]> => {
    let query: any = database.select().from(table).where(condition);
    if (limit !== undefined) query = query.limit(limit);
    if (lockRows) query = query.for("update");
    return query;
  };
  const [
    eventRows,
    contactRows,
    helperRows,
    shiftRows,
    areaRows,
    assignmentRows,
    prepRows,
    postRows,
    materialRows,
    marketingRows,
    approvalRows,
    cakeRows,
    financeRows,
  ] = await Promise.all([
    selectRows(events, and(eq(events.id, eventId), eq(events.year, year)), 1),
    selectRows(contacts, scope(contacts)),
    selectRows(helpers, scope(helpers)),
    selectRows(shifts, scope(shifts)),
    selectRows(shiftAreaContacts, scope(shiftAreaContacts)),
    selectRows(
      assignments,
      inArray(
        assignments.shiftId,
        database.select({ id: shifts.id }).from(shifts).where(scope(shifts))
      )
    ),
    selectRows(prepTasks, scope(prepTasks)),
    selectRows(postTasks, scope(postTasks)),
    selectRows(materials, scope(materials)),
    selectRows(marketing, scope(marketing)),
    selectRows(approvals, scope(approvals)),
    selectRows(cakes, scope(cakes)),
    selectRows(finances, scope(finances)),
  ]);
  if (!eventRows[0]) throw new Error("Veranstaltung wurde nicht gefunden");
  return {
    eventName: eventRows[0].name,
    activeDays: eventWeekdays(eventRows[0].activeDays),
    pdfLogoKey: eventRows[0].pdfLogoKey,
    pdfLogoUrl: eventRows[0].pdfLogoUrl,
    pdfLogoFallback: eventRows[0].pdfLogoFallback,
    contacts: contactRows,
    helpers: helperRows,
    shifts: shiftRows,
    areaContacts: areaRows,
    assignments: assignmentRows,
    prep: prepRows,
    post: postRows,
    materials: materialRows,
    marketing: marketingRows,
    approvals: approvalRows,
    cakes: cakeRows,
    finances: financeRows,
  };
}

function comparableCurrent(snapshot: CurrentSnapshot) {
  const clean = (row: any, fields: string[]) =>
    Object.fromEntries(
      fields.map(field => [
        field,
        row[field] ?? (field === "sortOrder" ? 0 : ""),
      ])
    );
  const contactName = new Map(snapshot.contacts.map(row => [row.id, row.name]));
  const helperName = new Map(snapshot.helpers.map(row => [row.id, row.name]));
  const areaContact = new Map(
    snapshot.areaContacts.map(row => [personKey(row.area), row.contactId])
  );
  const assignmentMap = new Map<number, any[]>();
  for (const assignment of snapshot.assignments) {
    const list = assignmentMap.get(assignment.shiftId) ?? [];
    list.push(assignment);
    assignmentMap.set(assignment.shiftId, list);
  }
  const byId = (left: any, right: any) => left.id - right.id;
  return {
    contacts: [...snapshot.contacts].sort(byId).map(row => ({
      sourceId: row.id,
      ...clean(row, ["name", "phone", "note", "sortOrder"]),
    })),
    helpers: [...snapshot.helpers].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      ...clean(row, [
        "name",
        "email",
        "phone",
        "note",
        "willHelp",
        "availMon",
        "availTue",
        "availWed",
        "availThu",
        "availFri",
        "availSat",
        "availSun",
        "confirmed",
      ]),
      availMon: row.availMon ?? "ja",
      availTue: row.availTue ?? "ja",
      availWed: row.availWed ?? "ja",
      availThu: row.availThu ?? "ja",
    })),
    shifts: [...snapshot.shifts].sort(byId).map(row => ({
      sourceId: row.id,
      ...clean(row, [
        "day",
        "area",
        "task",
        "startTime",
        "endTime",
        "needed",
        "note",
        "sortOrder",
      ]),
      areaContactSourceId: areaContact.get(personKey(row.area)) ?? null,
      areaContactName: areaContact.get(personKey(row.area))
        ? (contactName.get(areaContact.get(personKey(row.area))!) ?? "")
        : "",
      slots: (assignmentMap.get(row.id) ?? [])
        .sort((a, b) => a.slot - b.slot)
        .map(item => ({
          slot: item.slot,
          helperSourceId: item.helperId,
          helperName: helperName.get(item.helperId) ?? "",
        })),
    })),
    prep: [...snapshot.prep].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      ...clean(row, ["task", "dueText", "status", "note", "sortOrder"]),
    })),
    post: [...snapshot.post].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      ...clean(row, ["task", "status", "note", "sortOrder"]),
    })),
    materials: [...snapshot.materials].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      ...clean(row, [
        "article",
        "category",
        "quantity",
        "unit",
        "ordered",
        "note",
        "sortOrder",
      ]),
    })),
    marketing: [...snapshot.marketing].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      ...clean(row, ["measure", "channel", "status", "note", "sortOrder"]),
    })),
    approvals: [...snapshot.approvals].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      ...clean(row, ["request", "status", "note", "sortOrder"]),
    })),
    cakes: [...snapshot.cakes].sort(byId).map(row => ({
      sourceId: row.id,
      ...clean(row, ["donor", "cake", "dropoffTime", "note", "sortOrder"]),
    })),
    finances: [...snapshot.finances].sort(byId).map(row => ({
      sourceId: row.id,
      category: row.category,
      income: row.income,
      expense: row.expense,
      note: row.note ?? "",
      sortOrder: row.sortOrder,
    })),
  };
}

type ProjectCollections = Omit<BackupDocument, "metadata" | "warnings">;

const stableRecord = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).sort(([left], [right]) =>
      left.localeCompare(right, "de")
    )
  );
const stableRows = (rows: Array<Record<string, unknown>>) =>
  rows.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), "de")
  );

/**
 * Vergleicht einen wiederhergestellten Projektstand fachlich statt anhand der
 * alten Datenbank-IDs aus der Speicherdatei. Nach einem Vollreset dürfen neu
 * angelegte Datensätze neue IDs erhalten; Nutzdaten und die über Namen neu
 * aufgelösten Beziehungen müssen dagegen exakt übereinstimmen.
 */
export function comparableProjectContent(
  document: ProjectCollections | ReturnType<typeof comparableCurrent>
): Record<string, Array<Record<string, unknown>>> {
  const withoutIds = (
    rows: Array<Record<string, unknown>>,
    referenceFields: string[] = []
  ) =>
    stableRows(
      rows.map(row =>
        stableRecord(
          Object.fromEntries(
            Object.entries(row).filter(
              ([field]) =>
                field !== "sourceId" && !referenceFields.includes(field)
            )
          )
        )
      )
    );

  return {
    contacts: withoutIds(document.contacts as Array<Record<string, unknown>>),
    helpers: withoutIds(document.helpers as Array<Record<string, unknown>>, [
      "contactSourceId",
    ]),
    shifts: stableRows(
      (document.shifts as ShiftRow[]).map(row =>
        stableRecord({
          ...Object.fromEntries(
            Object.entries(row).filter(
              ([field]) =>
                field !== "sourceId" &&
                field !== "areaContactSourceId" &&
                field !== "slots"
            )
          ),
          slots: row.slots
            .map(slot => ({ slot: slot.slot, helperName: slot.helperName }))
            .sort((left, right) => left.slot - right.slot),
        })
      )
    ),
    prep: withoutIds(document.prep as Array<Record<string, unknown>>, [
      "contactSourceId",
    ]),
    post: withoutIds(document.post as Array<Record<string, unknown>>, [
      "contactSourceId",
    ]),
    materials: withoutIds(
      document.materials as Array<Record<string, unknown>>,
      ["contactSourceId"]
    ),
    marketing: withoutIds(
      document.marketing as Array<Record<string, unknown>>,
      ["contactSourceId"]
    ),
    approvals: withoutIds(
      document.approvals as Array<Record<string, unknown>>,
      ["contactSourceId"]
    ),
    cakes: withoutIds(document.cakes as Array<Record<string, unknown>>),
    finances: withoutIds(document.finances as Array<Record<string, unknown>>),
  };
}

export async function createCurrentProjectDocument(): Promise<BackupDocument> {
  const snapshot = await loadSnapshot();
  const current = comparableCurrent(snapshot) as Omit<
    BackupDocument,
    "metadata" | "warnings"
  >;
  return {
    metadata: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      eventId: currentEventId(),
      eventName: snapshot.eventName,
      year: currentEventYear(),
      activeDays: snapshot.activeDays,
      pdfLogoKey: snapshot.pdfLogoKey,
      pdfLogoUrl: snapshot.pdfLogoUrl,
      pdfLogoFallback: snapshot.pdfLogoFallback,
      exportedAt: new Date().toISOString(),
    },
    ...current,
    warnings: [],
  };
}

const AREA_CONFIG = [
  ["ANSPRECHPARTNER", "contacts", "name"],
  ["HELFER", "helpers", "name"],
  ["EINSATZPLAN", "shifts", "task"],
  ["VORBEREITUNG", "prep", "task"],
  ["NACHBEREITUNG", "post", "task"],
  ["MATERIAL", "materials", "article"],
  ["MARKETING", "marketing", "measure"],
  ["GENEHMIGUNGEN", "approvals", "request"],
  ["KUCHEN", "cakes", "donor"],
  ["FINANZEN", "finances", "category"],
] as const;
const ignoredDiffFields = new Set(["contactName", "areaContactName", "slots"]);
const documentRowIdentity = (
  area: (typeof AREA_CONFIG)[number][0],
  row: Record<string, unknown>,
  labelField: string
) =>
  personKey(
    area === "EINSATZPLAN"
      ? `${row.day ?? ""}|${row.area ?? ""}|${row.task ?? ""}|${row.startTime ?? ""}|${row.endTime ?? ""}`
      : row[labelField]
  );
const diffFieldEqual = (
  field: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
) => {
  if (field === "contactSourceId") {
    return before.contactSourceId && after.contactSourceId
      ? before.contactSourceId === after.contactSourceId
      : personKey(before.contactName) === personKey(after.contactName);
  }
  if (field === "areaContactSourceId") {
    return before.areaContactSourceId && after.areaContactSourceId
      ? before.areaContactSourceId === after.areaContactSourceId
      : personKey(before.areaContactName) === personKey(after.areaContactName);
  }
  return (
    JSON.stringify(before[field] ?? null) ===
    JSON.stringify(after[field] ?? null)
  );
};
export function diffDocuments(
  current: ReturnType<typeof comparableCurrent>,
  desired: BackupDocument
) {
  const changes: BackupChange[] = [];
  for (const [area, key, labelField] of AREA_CONFIG) {
    const beforeRows = current[key] as any[];
    const afterRows = desired[key] as any[];
    const beforeById = new Map(beforeRows.map(row => [row.sourceId, row]));
    const beforeByIdentity = new Map(
      beforeRows.map(row => [documentRowIdentity(area, row, labelField), row])
    );
    const matched = new Set<number>();
    for (let index = 0; index < afterRows.length; index++) {
      const after = afterRows[index];
      const candidate =
        (after.sourceId ? beforeById.get(after.sourceId) : undefined) ??
        beforeByIdentity.get(documentRowIdentity(area, after, labelField));
      const before =
        candidate && !matched.has(candidate.sourceId) ? candidate : undefined;
      if (!before) {
        changes.push({
          key: `${area}:new:${index}`,
          area,
          action: "create",
          label: String(after[labelField]),
          fields: Object.keys(after).filter(
            field => field !== "sourceId" && !ignoredDiffFields.has(field)
          ),
          before: null,
          after,
        });
        continue;
      }
      matched.add(before.sourceId);
      const fields = Array.from(
        new Set([...Object.keys(before), ...Object.keys(after)])
      ).filter(
        field =>
          field !== "sourceId" &&
          !ignoredDiffFields.has(field) &&
          !diffFieldEqual(field, before, after)
      );
      if (fields.length)
        changes.push({
          key: `${area}:update:${before.sourceId}`,
          area,
          action: "update",
          label: String(after[labelField]),
          fields,
          before,
          after,
        });
    }
    for (const before of beforeRows)
      if (!matched.has(before.sourceId))
        changes.push({
          key: `${area}:delete:${before.sourceId}`,
          area,
          action: "delete",
          label: String(before[labelField]),
          fields: [],
          before,
          after: null,
        });
  }
  const currentAssignments = (current.shifts as any[]).flatMap(shift =>
    shift.slots.map((slot: any) => ({
      shiftSourceId: shift.sourceId,
      shiftKey: shift.sourceId
        ? `id:${shift.sourceId}`
        : `new:${personKey(`${shift.day}|${shift.area}|${shift.task}|${shift.startTime}|${shift.endTime}`)}`,
      shiftLabel: `${shift.day} · ${shift.area} · ${shift.task}`,
      ...slot,
    }))
  );
  const desiredAssignments = desired.shifts.flatMap(shift =>
    shift.slots.map(slot => ({
      shiftSourceId: shift.sourceId,
      shiftKey: shift.sourceId
        ? `id:${shift.sourceId}`
        : `new:${personKey(`${shift.day}|${shift.area}|${shift.task}|${shift.startTime}|${shift.endTime}`)}`,
      shiftLabel: `${shift.day} · ${shift.area} · ${shift.task}`,
      ...slot,
    }))
  );
  const assignmentKey = (row: any) => `${row.shiftKey}|${row.slot}`;
  const currentMap = new Map(
    currentAssignments.map(row => [assignmentKey(row), row])
  );
  const desiredMap = new Map(
    desiredAssignments.map(row => [assignmentKey(row), row])
  );
  for (const [key, after] of Array.from(desiredMap.entries())) {
    const before = currentMap.get(key);
    if (!before)
      changes.push({
        key: `ZUORDNUNGEN:create:${key}`,
        area: "ZUORDNUNGEN",
        action: "create",
        label: `${after.shiftLabel} · Platz ${after.slot + 1}: ${after.helperName}`,
        fields: ["helperSourceId"],
        before: null,
        after,
      });
    else if (
      before.helperSourceId && after.helperSourceId
        ? before.helperSourceId !== after.helperSourceId
        : personKey(before.helperName) !== personKey(after.helperName)
    )
      changes.push({
        key: `ZUORDNUNGEN:update:${key}`,
        area: "ZUORDNUNGEN",
        action: "update",
        label: `${after.shiftLabel} · Platz ${after.slot + 1}`,
        fields: ["helperSourceId"],
        before,
        after,
      });
  }
  for (const [key, before] of Array.from(currentMap.entries()))
    if (!desiredMap.has(key))
      changes.push({
        key: `ZUORDNUNGEN:delete:${key}`,
        area: "ZUORDNUNGEN",
        action: "delete",
        label: `${before.shiftLabel} · Platz ${before.slot + 1}: ${before.helperName}`,
        fields: [],
        before,
        after: null,
      });
  if (changes.length > MAX_CHANGES)
    throw new Error(
      `Die Sicherung erzeugt mehr als ${MAX_CHANGES} Änderungen und kann nicht verarbeitet werden`
    );
  return changes;
}

function eventDaysChange(
  currentDays: Weekday[],
  desiredDays: Weekday[]
): BackupChange[] {
  const beforeDays = eventWeekdays(currentDays);
  const afterDays = eventWeekdays(desiredDays);
  if (JSON.stringify(beforeDays) === JSON.stringify(afterDays)) return [];
  return [
    {
      key: "VERANSTALTUNG:update:activeDays",
      area: "VERANSTALTUNG",
      action: "update",
      label: "Aktive Veranstaltungstage",
      fields: ["activeDays"],
      before: { activeDays: beforeDays },
      after: { activeDays: afterDays },
    },
  ];
}

function eventPdfImageChanges(
  current: Pick<
    CurrentSnapshot,
    "pdfLogoKey" | "pdfLogoUrl" | "pdfLogoFallback"
  >,
  desired: BackupDocument["metadata"]
): BackupChange[] {
  const changes: BackupChange[] = [];
  if (
    current.pdfLogoKey !== desired.pdfLogoKey ||
    current.pdfLogoUrl !== desired.pdfLogoUrl
  ) {
    changes.push({
      key: "VERANSTALTUNG:update:pdfImage",
      area: "VERANSTALTUNG",
      action: "update",
      label: "Individuelles PDF-Bild",
      fields: ["pdfLogoKey", "pdfLogoUrl"],
      before: {
        pdfLogoKey: current.pdfLogoKey,
        pdfLogoUrl: current.pdfLogoUrl,
      },
      after: {
        pdfLogoKey: desired.pdfLogoKey,
        pdfLogoUrl: desired.pdfLogoUrl,
      },
    });
  }
  if (current.pdfLogoFallback !== desired.pdfLogoFallback) {
    changes.push({
      key: "VERANSTALTUNG:update:pdfLogoFallback",
      area: "VERANSTALTUNG",
      action: "update",
      label: "PDF-Bild-Fallback",
      fields: ["pdfLogoFallback"],
      before: { pdfLogoFallback: current.pdfLogoFallback },
      after: { pdfLogoFallback: desired.pdfLogoFallback },
    });
  }
  return changes;
}

function snapshotDigest(
  snapshot: CurrentSnapshot,
  current = comparableCurrent(snapshot)
) {
  return digest({
    activeDays: snapshot.activeDays,
    pdfImage: {
      key: snapshot.pdfLogoKey,
      url: snapshot.pdfLogoUrl,
      fallback: snapshot.pdfLogoFallback,
    },
    project: current,
  });
}

function summary(changes: BackupChange[]) {
  const result = {
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    byArea: {} as Record<
      string,
      { created: number; updated: number; deleted: number }
    >,
  };
  for (const change of changes) {
    result[
      change.action === "create"
        ? "created"
        : change.action === "update"
          ? "updated"
          : "deleted"
    ]++;
    const area = result.byArea[change.area] ?? {
      created: 0,
      updated: 0,
      deleted: 0,
    };
    area[
      change.action === "create"
        ? "created"
        : change.action === "update"
          ? "updated"
          : "deleted"
    ]++;
    result.byArea[change.area] = area;
  }
  return result;
}

function serializeChangeDetails(changes: BackupChange[], warnings: string[]) {
  const details = JSON.stringify({ changes, warnings });
  if (Buffer.byteLength(details, "utf8") > MAX_CHANGE_PAYLOAD_BYTES)
    throw new Error(
      "Die Änderungsvorschau ist zu umfangreich. Bitte teilen Sie die Bearbeitung auf mehrere Sicherungen auf."
    );
  return details;
}

export function buildSelectedDocument(
  current: ReturnType<typeof comparableCurrent>,
  imported: BackupDocument,
  allChanges: BackupChange[],
  selectedChangeKeys?: string[]
): BackupDocument {
  if (selectedChangeKeys === undefined) return imported;
  const selected = new Set(selectedChangeKeys);
  if (!selected.size)
    throw new Error(
      "Bitte wählen Sie mindestens eine Änderung zur Übernahme aus"
    );
  const known = new Set(allChanges.map(change => change.key));
  for (const key of Array.from(selected))
    if (!known.has(key))
      throw new Error(
        "Die Änderungsauswahl ist veraltet. Bitte prüfen Sie die Excel-Datei erneut."
      );
  if (selected.size === allChanges.length) return imported;

  const target = structuredClone({
    ...current,
    metadata: imported.metadata,
    warnings: imported.warnings,
  }) as BackupDocument;
  const areaByName = new Map(
    AREA_CONFIG.map(([area, collection]) => [area, collection] as const)
  );

  for (const change of allChanges) {
    if (
      !selected.has(change.key) ||
      change.area === "ZUORDNUNGEN" ||
      change.area === "VERANSTALTUNG"
    )
      continue;
    const collection = areaByName.get(change.area);
    if (!collection) continue;
    const rows = target[collection] as Array<Record<string, any>>;
    if (change.action === "create" && change.after) {
      const created = structuredClone(change.after);
      if (change.area === "EINSATZPLAN") created.slots = [];
      rows.push(created);
      continue;
    }
    const sourceId = Number(change.before?.sourceId);
    const index = rows.findIndex(row => row.sourceId === sourceId);
    if (index < 0) continue;
    if (change.action === "delete") rows.splice(index, 1);
    else if (change.after) {
      const updated = structuredClone(change.after);
      if (change.area === "EINSATZPLAN") updated.slots = rows[index].slots;
      rows[index] = updated;
    }
  }

  const shiftKey = (shift: ShiftRow) =>
    shift.sourceId
      ? `id:${shift.sourceId}`
      : `new:${personKey(`${shift.day}|${shift.area}|${shift.task}|${shift.startTime}|${shift.endTime}`)}`;
  for (const change of allChanges) {
    if (!selected.has(change.key) || change.area !== "ZUORDNUNGEN") continue;
    const assignment = (change.after ?? change.before) as Record<string, any>;
    const shift = target.shifts.find(
      row => shiftKey(row) === assignment.shiftKey
    );
    if (!shift) continue;
    const slot = Number(assignment.slot);
    shift.slots = shift.slots.filter(item => item.slot !== slot);
    if (change.action !== "delete" && change.after) {
      shift.slots.push({
        slot,
        helperSourceId: Number(change.after.helperSourceId) || null,
        helperName: String(change.after.helperName ?? ""),
      });
      shift.slots.sort((left, right) => left.slot - right.slot);
    }
  }

  ensureUnique(
    target.contacts,
    row => row.sourceId,
    row => row.name,
    "ANSPRECHPARTNER"
  );
  ensureUnique(
    target.helpers,
    row => row.sourceId,
    row => row.name,
    "HELFER"
  );
  ensureUnique(
    target.shifts,
    row => row.sourceId,
    row => `${row.day}|${row.area}|${row.task}|${row.startTime}|${row.endTime}`,
    "EINSATZPLAN"
  );

  const contactById = new Map(
    target.contacts.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const contactByName = new Map(
    target.contacts.map(row => [personKey(row.name), row])
  );
  const normalizeContactRef = (row: {
    contactSourceId: number | null;
    contactName: string;
  }) => {
    const contact =
      (row.contactSourceId
        ? contactById.get(row.contactSourceId)
        : undefined) ?? contactByName.get(personKey(row.contactName));
    row.contactSourceId = contact?.sourceId ?? null;
    row.contactName = contact?.name ?? "";
  };
  for (const row of target.helpers) normalizeContactRef(row);
  for (const row of [
    ...target.prep,
    ...target.post,
    ...target.materials,
    ...target.marketing,
    ...target.approvals,
  ])
    normalizeContactRef(row);
  for (const contact of target.contacts) {
    const selfHelper = target.helpers.find(
      helper => personKey(helper.name) === personKey(contact.name)
    );
    if (!selfHelper)
      throw new Error(
        `Für den Ansprechpartner „${contact.name}“ muss auch der gleichnamige Helfereintrag ausgewählt werden.`
      );
    selfHelper.contactSourceId = contact.sourceId;
    selfHelper.contactName = contact.name;
  }

  const helperById = new Map(
    target.helpers.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const helperByName = new Map(
    target.helpers.map(row => [personKey(row.name), row])
  );
  const activeDays = new Set(eventWeekdays(target.metadata.activeDays));
  const areaContacts = new Map<string, string>();
  const helperShifts = new Map<string, ShiftRow[]>();
  for (const shift of target.shifts) {
    if (!activeDays.has(shift.day))
      throw new Error(
        `Die Auswahl ist nicht vollständig: ${shift.day} wird deaktiviert, aber die Schicht „${shift.task}“ bleibt ausgewählt. Bitte übernehmen Sie auch die zugehörigen Einsatzplanänderungen.`
      );
    const areaContact =
      (shift.areaContactSourceId
        ? contactById.get(shift.areaContactSourceId)
        : undefined) ?? contactByName.get(personKey(shift.areaContactName));
    shift.areaContactSourceId = areaContact?.sourceId ?? null;
    shift.areaContactName = areaContact?.name ?? "";
    const areaKey = personKey(shift.area);
    const contactKey = shift.areaContactSourceId
      ? `id:${shift.areaContactSourceId}`
      : `name:${personKey(shift.areaContactName)}`;
    if (areaContacts.has(areaKey) && areaContacts.get(areaKey) !== contactKey)
      throw new Error(
        `EINSATZPLAN: Bereich „${shift.area}“ hat unterschiedliche Ansprechpartner`
      );
    areaContacts.set(areaKey, contactKey);

    const seenHelpers = new Set<string>();
    shift.slots = shift.slots.flatMap(slot => {
      const helper =
        (slot.helperSourceId
          ? helperById.get(slot.helperSourceId)
          : undefined) ?? helperByName.get(personKey(slot.helperName));
      if (!helper) return [];
      if (!helperAvailableOnDay(helper, shift.day))
        throw new Error(
          `EINSATZPLAN „${shift.task}“: Helfer „${helper.name}“ ist an ${shift.day} nicht verfügbar`
        );
      if (slot.slot < 0 || slot.slot >= shift.needed)
        throw new Error(
          `EINSATZPLAN „${shift.task}“: Ein Helfer steht außerhalb des Bedarfs`
        );
      const helperKey = helper.sourceId
        ? `id:${helper.sourceId}`
        : `name:${personKey(helper.name)}`;
      if (seenHelpers.has(helperKey))
        throw new Error(
          `EINSATZPLAN „${shift.task}“: Ein Helfer ist in derselben Schicht doppelt eingetragen`
        );
      seenHelpers.add(helperKey);
      const assigned = helperShifts.get(helperKey) ?? [];
      assigned.push(shift);
      helperShifts.set(helperKey, assigned);
      return [
        {
          slot: slot.slot,
          helperSourceId: helper.sourceId,
          helperName: helper.name,
        },
      ];
    });
  }
  for (const [helperKey, assignedShifts] of Array.from(helperShifts.entries()))
    for (let left = 0; left < assignedShifts.length; left++)
      for (let right = left + 1; right < assignedShifts.length; right++)
        if (overlaps(assignedShifts[left] as any, assignedShifts[right] as any))
          throw new Error(
            `Doppelbelegung: ${helperKey} ist gleichzeitig in „${assignedShifts[left].task}“ und „${assignedShifts[right].task}“ eingeteilt`
          );

  return target;
}

export async function previewProjectDocument(
  desired: BackupDocument,
  sourceDigest: string
) {
  const snapshot = await loadSnapshot();
  if (
    desired.metadata.eventId !== currentEventId() ||
    desired.metadata.year !== currentEventYear() ||
    desired.metadata.eventName !== snapshot.eventName
  )
    throw new Error(
      `Die Sicherung gehört zu „${desired.metadata.eventName}“ (${desired.metadata.year}), ausgewählt ist „${snapshot.eventName}“ (${currentEventYear()}).`
    );
  const current = comparableCurrent(snapshot);
  const changes = [
    ...eventDaysChange(snapshot.activeDays, desired.metadata.activeDays),
    ...eventPdfImageChanges(snapshot, desired.metadata),
    ...diffDocuments(current, desired),
  ];
  serializeChangeDetails(changes, desired.warnings);
  return {
    metadata: desired.metadata,
    currentDigest: snapshotDigest(snapshot, current),
    workbookDigest: sourceDigest,
    warnings: desired.warnings,
    changes,
    totals: summary(changes),
  };
}

export async function previewBackupRestore(base64: string) {
  const bytes = Buffer.from(base64, "base64");
  return previewProjectDocument(parseBackupWorkbook(base64), digest(bytes));
}

export type BackupRestorePreview = Awaited<
  ReturnType<typeof previewBackupRestore>
>;

async function insertRows(client: any, table: any, rows: any[]) {
  for (const part of chunk(rows))
    if (part.length) await client.insert(table).values(part);
}

export async function restoreBackup(
  base64: string,
  sourceFilename: string,
  expectedCurrentDigest: string,
  actor: AuditActor,
  selectedChangeKeys?: string[]
) {
  const bytes = Buffer.from(base64, "base64");
  return restoreProjectDocument(
    parseBackupWorkbook(base64),
    digest(bytes),
    sourceFilename,
    expectedCurrentDigest,
    actor,
    selectedChangeKeys
  );
}

export async function restoreProjectDocument(
  imported: BackupDocument,
  sourceDigest: string,
  sourceFilename: string,
  expectedCurrentDigest: string,
  actor: AuditActor,
  selectedChangeKeys?: string[]
) {
  const workbookDigest = sourceDigest;
  const db = (await getDb()) as Client;
  const year = currentEventYear();
  const eventId = currentEventId();
  const scope = (table: any) =>
    and(eq(table.year, year), eq(table.eventId, eventId));
  return db.transaction(async tx => {
    const [yearLock] = await tx
      .select({ year: eventYears.year })
      .from(eventYears)
      .where(eq(eventYears.year, year))
      .limit(1)
      .for("update");
    if (!yearLock)
      throw new Error("Das gewählte Veranstaltungsjahr ist nicht verfügbar");
    const [selectedEvent] = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.year, year)))
      .limit(1);
    if (!selectedEvent)
      throw new Error(
        "Die Sicherung gehört nicht zur aktuell ausgewählten Veranstaltung"
      );
    const snapshot = await loadSnapshot(tx, true);
    if (
      imported.metadata.eventId !== eventId ||
      imported.metadata.year !== year ||
      imported.metadata.eventName !== snapshot.eventName
    )
      throw new Error(
        "Die Sicherung gehört nicht zur aktuell ausgewählten Veranstaltung"
      );
    const current = comparableCurrent(snapshot);
    const beforeDigest = snapshotDigest(snapshot, current);
    if (beforeDigest !== expectedCurrentDigest)
      throw new Error(
        "Die Planung wurde seit der Vorschau geändert. Bitte die Datei erneut prüfen."
      );
    const allChanges = [
      ...eventDaysChange(snapshot.activeDays, imported.metadata.activeDays),
      ...eventPdfImageChanges(snapshot, imported.metadata),
      ...diffDocuments(current, imported),
    ];
    const desired = buildSelectedDocument(
      current,
      imported,
      allChanges,
      selectedChangeKeys
    );
    const changes = [
      ...eventDaysChange(snapshot.activeDays, desired.metadata.activeDays),
      ...eventPdfImageChanges(snapshot, desired.metadata),
      ...diffDocuments(current, desired),
    ];
    if (!changes.length)
      throw new Error("Die Auswahl enthält keine übernehmbaren Änderungen");
    if (
      selectedChangeKeys &&
      new Set(selectedChangeKeys).size < allChanges.length
    ) {
      const selectedKeys = new Set(selectedChangeKeys);
      const appliedKeys = new Set(changes.map(change => change.key));
      const expectedByKey = new Map(
        allChanges.map(change => [change.key, change])
      );
      const appliedByKey = new Map(changes.map(change => [change.key, change]));
      const hasImplicitChanges = Array.from(appliedKeys).some(
        key => !selectedKeys.has(key)
      );
      const hasMissingChanges = Array.from(selectedKeys).some(
        key => !appliedKeys.has(key)
      );
      const hasChangedIntent = Array.from(selectedKeys).some(key => {
        const expected = expectedByKey.get(key);
        const applied = appliedByKey.get(key);
        if (!expected || !applied || expected.action !== applied.action)
          return true;
        if (expected.fields.length !== applied.fields.length) return true;
        return expected.fields.some(
          field =>
            !applied.fields.includes(field) ||
            !diffFieldEqual(
              field,
              applied.after ?? applied.before ?? {},
              expected.after ?? expected.before ?? {}
            )
        );
      });
      if (hasImplicitChanges || hasMissingChanges || hasChangedIntent)
        throw new Error(
          "Die Auswahl ist nicht vollständig: Eine gewählte Änderung benötigt weitere markierte Bezugsänderungen (zum Beispiel Helferzuordnungen oder Ansprechpartner). Bitte markieren Sie die zusammengehörigen Änderungen oder wählen Sie „Alle Änderungen übernehmen“."
        );
    }
    const auditDetails = serializeChangeDetails(changes, imported.warnings);

    if (changes.length) {
      await tx
        .update(events)
        .set({
          activeDays: desired.metadata.activeDays,
          pdfLogoKey: desired.metadata.pdfLogoKey,
          pdfLogoUrl: desired.metadata.pdfLogoUrl,
          pdfLogoFallback: desired.metadata.pdfLogoFallback,
        })
        .where(and(eq(events.id, eventId), eq(events.year, year)));
      await tx
        .delete(assignments)
        .where(
          inArray(
            assignments.shiftId,
            tx.select({ id: shifts.id }).from(shifts).where(scope(shifts))
          )
        );
      await tx.delete(shiftAreaContacts).where(scope(shiftAreaContacts));
      await tx.delete(shifts).where(scope(shifts));
      await tx.delete(prepTasks).where(scope(prepTasks));
      await tx.delete(postTasks).where(scope(postTasks));
      await tx.delete(materials).where(scope(materials));
      await tx.delete(marketing).where(scope(marketing));
      await tx.delete(approvals).where(scope(approvals));
      await tx.delete(helpers).where(scope(helpers));
      await tx.delete(contacts).where(scope(contacts));
      await tx.delete(cakes).where(scope(cakes));
      await tx.delete(finances).where(scope(finances));

      const currentContactIds = new Set(snapshot.contacts.map(row => row.id));
      const contactIdBySource = new Map<number, number>();
      const contactIdByName = new Map<string, number>();
      for (const row of desired.contacts) {
        const preservedId =
          row.sourceId && currentContactIds.has(row.sourceId)
            ? row.sourceId
            : undefined;
        const result: any = await tx.insert(contacts).values({
          ...(preservedId ? { id: preservedId } : {}),
          year,
          eventId,
          name: row.name,
          phone: row.phone || null,
          note: row.note || null,
          sortOrder: row.sortOrder,
        });
        const actualId =
          preservedId ?? Number(result?.[0]?.insertId ?? result?.insertId);
        if (row.sourceId) contactIdBySource.set(row.sourceId, actualId);
        contactIdByName.set(personKey(row.name), actualId);
      }
      const resolveContact = (sourceId: number | null, name: string) =>
        (sourceId ? contactIdBySource.get(sourceId) : undefined) ??
        contactIdByName.get(personKey(name)) ??
        null;

      const currentHelperIds = new Set(snapshot.helpers.map(row => row.id));
      const helperIdBySource = new Map<number, number>();
      const helperIdByName = new Map<string, number>();
      for (const row of desired.helpers) {
        const preservedId =
          row.sourceId && currentHelperIds.has(row.sourceId)
            ? row.sourceId
            : undefined;
        const result: any = await tx.insert(helpers).values({
          ...(preservedId ? { id: preservedId } : {}),
          year,
          eventId,
          contactId: resolveContact(row.contactSourceId, row.contactName),
          name: row.name,
          email: row.email || null,
          phone: row.phone || null,
          note: row.note || null,
          willHelp: row.willHelp,
          availMon: row.availMon,
          availTue: row.availTue,
          availWed: row.availWed,
          availThu: row.availThu,
          availFri: row.availFri,
          availSat: row.availSat,
          availSun: row.availSun,
          confirmed: row.confirmed,
        });
        const actualId =
          preservedId ?? Number(result?.[0]?.insertId ?? result?.insertId);
        if (row.sourceId) helperIdBySource.set(row.sourceId, actualId);
        helperIdByName.set(personKey(row.name), actualId);
      }
      const resolveHelper = (sourceId: number | null, name: string) =>
        (sourceId ? helperIdBySource.get(sourceId) : undefined) ??
        helperIdByName.get(personKey(name));

      const currentShiftIds = new Set(snapshot.shifts.map(row => row.id));
      const shiftIdBySource = new Map<number, number>();
      const shiftIdByKey = new Map<string, number>();
      const shiftKey = (row: ShiftRow) =>
        personKey(
          `${row.day}|${row.area}|${row.task}|${row.startTime}|${row.endTime}`
        );
      for (const row of desired.shifts) {
        const preservedId =
          row.sourceId && currentShiftIds.has(row.sourceId)
            ? row.sourceId
            : undefined;
        const result: any = await tx.insert(shifts).values({
          ...(preservedId ? { id: preservedId } : {}),
          year,
          eventId,
          day: row.day,
          area: row.area,
          task: row.task,
          startTime: row.startTime,
          endTime: row.endTime,
          needed: row.needed,
          note: row.note || null,
          sortOrder: row.sortOrder,
        });
        const actualId =
          preservedId ?? Number(result?.[0]?.insertId ?? result?.insertId);
        if (row.sourceId) shiftIdBySource.set(row.sourceId, actualId);
        shiftIdByKey.set(shiftKey(row), actualId);
      }
      const resolveShift = (row: ShiftRow) =>
        (row.sourceId ? shiftIdBySource.get(row.sourceId) : undefined) ??
        shiftIdByKey.get(shiftKey(row));
      const assignmentValues = desired.shifts.flatMap(row =>
        row.slots.flatMap(slot => {
          const shiftId = resolveShift(row);
          const helperId = resolveHelper(slot.helperSourceId, slot.helperName);
          return shiftId && helperId
            ? [{ shiftId, helperId, year, eventId, slot: slot.slot }]
            : [];
        })
      );
      await insertRows(tx, assignments, assignmentValues);
      const areaValues = Array.from(
        new Map(desired.shifts.map(row => [personKey(row.area), row])).values()
      ).flatMap(row => {
        const contactId = resolveContact(
          row.areaContactSourceId,
          row.areaContactName
        );
        return contactId ? [{ year, eventId, area: row.area, contactId }] : [];
      });
      await insertRows(tx, shiftAreaContacts, areaValues);

      const preserveId = (sourceId: number | null, currentIds: Set<number>) =>
        sourceId && currentIds.has(sourceId) ? { id: sourceId } : {};
      await insertRows(
        tx,
        prepTasks,
        desired.prep.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(snapshot.prep.map(item => item.id))
          ),
          year,
          eventId,
          task: row.task,
          dueText: row.dueText,
          contactId: resolveContact(row.contactSourceId, row.contactName),
          status: row.status,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }))
      );
      const simpleTasks = (wanted: TaskRow[], currentRows: any[]) =>
        wanted.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(currentRows.map(item => item.id))
          ),
          year,
          eventId,
          task: row.task,
          contactId: resolveContact(row.contactSourceId, row.contactName),
          status: row.status,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }));
      await insertRows(tx, postTasks, simpleTasks(desired.post, snapshot.post));
      await insertRows(
        tx,
        materials,
        desired.materials.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(snapshot.materials.map(item => item.id))
          ),
          year,
          eventId,
          article: row.article,
          category: row.category,
          quantity: row.quantity,
          unit: row.unit,
          contactId: resolveContact(row.contactSourceId, row.contactName),
          ordered: row.ordered,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }))
      );
      await insertRows(
        tx,
        marketing,
        desired.marketing.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(snapshot.marketing.map(item => item.id))
          ),
          year,
          eventId,
          measure: row.measure,
          channel: row.channel,
          contactId: resolveContact(row.contactSourceId, row.contactName),
          status: row.status,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }))
      );
      await insertRows(
        tx,
        approvals,
        desired.approvals.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(snapshot.approvals.map(item => item.id))
          ),
          year,
          eventId,
          request: row.request,
          contactId: resolveContact(row.contactSourceId, row.contactName),
          status: row.status,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }))
      );
      await insertRows(
        tx,
        cakes,
        desired.cakes.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(snapshot.cakes.map(item => item.id))
          ),
          year,
          eventId,
          donor: row.donor,
          cake: row.cake,
          dropoffTime: row.dropoffTime,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }))
      );
      await insertRows(
        tx,
        finances,
        desired.finances.map(row => ({
          ...preserveId(
            row.sourceId,
            new Set(snapshot.finances.map(item => item.id))
          ),
          year,
          eventId,
          category: row.category,
          income: row.income,
          expense: row.expense,
          note: row.note || null,
          sortOrder: row.sortOrder,
        }))
      );
    }

    const afterSnapshot = await loadSnapshot(tx);
    const after = comparableCurrent(afterSnapshot);
    const restoredContent = comparableProjectContent(after);
    const desiredContent = comparableProjectContent(desired);
    if (
      JSON.stringify(restoredContent) !== JSON.stringify(desiredContent) ||
      JSON.stringify(afterSnapshot.activeDays) !==
        JSON.stringify(desired.metadata.activeDays) ||
      afterSnapshot.pdfLogoKey !== desired.metadata.pdfLogoKey ||
      afterSnapshot.pdfLogoUrl !== desired.metadata.pdfLogoUrl ||
      afterSnapshot.pdfLogoFallback !== desired.metadata.pdfLogoFallback
    )
      throw new Error(
        "Die Wiederherstellung konnte den gespeicherten Projektstand nicht vollständig herstellen und wurde komplett zurückgerollt"
      );
    const afterDigest = snapshotDigest(afterSnapshot, after);
    const totals = summary(changes);
    await tx.insert(backupRestoreLogs).values({
      year,
      eventId,
      eventName: snapshot.eventName,
      sourceFilename: sourceFilename.slice(0, 255),
      backupExportedAt: imported.metadata.exportedAt,
      actorUserId: actor.userId,
      actorName: actor.name,
      actorRole: actor.role,
      actorLoginMethod: actor.loginMethod ?? null,
      createdCount: totals.created,
      updatedCount: totals.updated,
      deletedCount: totals.deleted,
      beforeDigest,
      afterDigest,
      workbookDigest,
      details: auditDetails,
    });
    return { ...totals, warnings: imported.warnings, afterDigest };
  });
}

export async function listBackupRestoreLogs(limit = 50) {
  const db = (await getDb()) as Client;
  return db
    .select({
      id: backupRestoreLogs.id,
      year: backupRestoreLogs.year,
      eventId: backupRestoreLogs.eventId,
      eventName: backupRestoreLogs.eventName,
      sourceFilename: backupRestoreLogs.sourceFilename,
      backupExportedAt: backupRestoreLogs.backupExportedAt,
      actorName: backupRestoreLogs.actorName,
      actorRole: backupRestoreLogs.actorRole,
      createdCount: backupRestoreLogs.createdCount,
      updatedCount: backupRestoreLogs.updatedCount,
      deletedCount: backupRestoreLogs.deletedCount,
      createdAt: backupRestoreLogs.createdAt,
    })
    .from(backupRestoreLogs)
    .where(
      and(
        eq(backupRestoreLogs.year, currentEventYear()),
        eq(backupRestoreLogs.eventId, currentEventId())
      )
    )
    .orderBy(desc(backupRestoreLogs.createdAt), desc(backupRestoreLogs.id))
    .limit(limit);
}

export async function getBackupRestoreLog(id: number) {
  const db = (await getDb()) as Client;
  const [entry] = await db
    .select()
    .from(backupRestoreLogs)
    .where(
      and(
        eq(backupRestoreLogs.id, id),
        eq(backupRestoreLogs.year, currentEventYear()),
        eq(backupRestoreLogs.eventId, currentEventId())
      )
    )
    .limit(1);
  if (!entry)
    throw new Error("Wiederherstellungsprotokoll wurde nicht gefunden");
  let parsed: { changes?: BackupChange[]; warnings?: string[] } = {};
  try {
    parsed = JSON.parse(entry.details);
  } catch {
    throw new Error("Wiederherstellungsprotokoll ist beschädigt");
  }
  return { ...entry, details: undefined, ...parsed };
}

export async function exportProjectExcel(): Promise<{
  buffer: Buffer;
  exportedAt: string;
  eventName: string;
}> {
  const snapshot = await loadSnapshot();
  const current: any = comparableCurrent(snapshot);
  const exportedAt = new Date().toISOString();
  const workbook = XLSX.utils.book_new();
  const append = (
    name: string,
    rows: Record<string, unknown>[],
    widths?: number[]
  ) => {
    const headers = PROJECT_EXCEL_HEADERS[name] ?? Object.keys(rows[0] ?? {});
    const sheet = rows.length
      ? XLSX.utils.json_to_sheet(rows, { header: headers })
      : XLSX.utils.aoa_to_sheet([headers]);
    sheet["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    } as any;
    sheet["!autofilter"] = rows.length ? { ref: sheet["!ref"]! } : undefined;
    sheet["!cols"] = (widths ?? headers.map(() => 20)).map((wch, index) =>
      typeof wch === "number"
        ? {
            wch: headers[index]?.endsWith("ID") ? 12 : wch,
            ...(headers[index]?.endsWith("ID") ? { hidden: true } : {}),
          }
        : (wch as any)
    );
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };
  append(
    "PROJEKT_INFO",
    [
      { Schlüssel: "Format", Wert: "RSC-HELFERPLANUNG-PROJEKTUEBERSICHT" },
      { Schlüssel: "Version", Wert: BACKUP_VERSION },
      { Schlüssel: "Veranstaltungs-ID", Wert: currentEventId() },
      { Schlüssel: "Veranstaltung", Wert: snapshot.eventName },
      { Schlüssel: "Jahr", Wert: currentEventYear() },
      {
        Schlüssel: "Veranstaltungstage",
        Wert: snapshot.activeDays.join(", "),
      },
      {
        Schlüssel: "Individuelles PDF-Bild",
        Wert: snapshot.pdfLogoKey ? "Hinterlegt" : "Nicht hinterlegt",
      },
      {
        Schlüssel: "PDF-Bild-Fallback",
        Wert:
          snapshot.pdfLogoFallback === "brand"
            ? "RSC-Vereinslogo"
            : "Kein Bild",
      },
      { Schlüssel: "Exportiert am (UTC)", Wert: exportedAt },
      {
        Schlüssel: "Verwendung",
        Wert: "Diese Excel-Datei dient ausschließlich der Übersicht und Dokumentation. Sie ist keine vollständige Speicherdatei. Einzelne Tabellenblätter können im jeweiligen Programmbereich gezielt importiert werden.",
      },
      {
        Schlüssel: "Wichtig",
        Wert: "Für einen späteren Modulimport Blattnamen und ausgeblendete ID-Spalten nicht verändern. Neue Zeilen erhalten eine leere ID.",
      },
    ],
    [28, 100]
  );
  append(
    "ANSPRECHPARTNER",
    current.contacts.map((row: any) => ({
      ID: row.sourceId,
      Name: row.name,
      Rufnummer: row.phone,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }))
  );
  append(
    "HELFER",
    current.helpers.map((row: any) => ({
      ID: row.sourceId,
      "Ansprechpartner-ID": row.contactSourceId ?? "",
      Ansprechpartner: row.contactName,
      Name: row.name,
      "E-Mail": row.email,
      Telefon: row.phone,
      Bemerkung: row.note,
      "Helfen?": row.willHelp,
      Mo: row.availMon,
      Di: row.availTue,
      Mi: row.availWed,
      Do: row.availThu,
      Fr: row.availFri,
      Sa: row.availSat,
      So: row.availSun,
      "Bestätigt?": row.confirmed,
    }))
  );
  append(
    "EINSATZPLAN",
    current.shifts.map((row: any) => ({
      ID: row.sourceId,
      Tag: row.day,
      Bereich: row.area,
      Aufgabe: row.task,
      Beginn: row.startTime,
      Ende: row.endTime,
      Bedarf: row.needed,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
      "Bereichsansprechpartner-ID": row.areaContactSourceId ?? "",
      Bereichsansprechpartner: row.areaContactName,
      ...Object.fromEntries(
        Array.from({ length: 20 }, (_, slot) => {
          const assignment = row.slots.find((item: any) => item.slot === slot);
          return [
            [`Helfer ${slot + 1} ID`, assignment?.helperSourceId ?? ""],
            [`Helfer ${slot + 1}`, assignment?.helperName ?? ""],
          ];
        }).flat()
      ),
    }))
  );
  const taskRows = (rows: any[], due = false) =>
    rows.map(row => ({
      ID: row.sourceId,
      Aufgabe: row.task,
      ...(due ? { "Zu erledigen bis": row.dueText } : {}),
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  append("VORBEREITUNG", taskRows(current.prep, true));
  append("NACHBEREITUNG", taskRows(current.post));
  append(
    "MATERIAL",
    current.materials.map((row: any) => ({
      ID: row.sourceId,
      Artikel: row.article,
      Kategorie: row.category,
      Menge: row.quantity,
      Einheit: row.unit,
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Bestellt: row.ordered,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }))
  );
  append(
    "MARKETING",
    current.marketing.map((row: any) => ({
      ID: row.sourceId,
      Maßnahme: row.measure,
      Kanal: row.channel,
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }))
  );
  append(
    "GENEHMIGUNGEN",
    current.approvals.map((row: any) => ({
      ID: row.sourceId,
      Antrag: row.request,
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }))
  );
  append(
    "KUCHEN",
    current.cakes.map((row: any) => ({
      ID: row.sourceId,
      Spender: row.donor,
      Kuchen: row.cake,
      Abgabezeit: row.dropoffTime,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }))
  );
  append(
    "FINANZEN",
    current.finances.map((row: any) => ({
      ID: row.sourceId,
      Kategorie: row.category,
      Einnahmen: row.income / 100,
      Ausgaben: row.expense / 100,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }))
  );
  return {
    buffer: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    }),
    exportedAt,
    eventName: snapshot.eventName,
  };
}

/** @deprecated Nur für bestehende Parser-Regressionsprüfungen; produktiv ist Excel kein Speicherformat mehr. */
export async function exportBackupExcel() {
  const result = await exportProjectExcel();
  const workbook = XLSX.read(result.buffer, {
    type: "buffer",
    cellStyles: true,
  });
  workbook.SheetNames[0] = "SICHERUNG_INFO";
  delete workbook.Sheets.PROJEKT_INFO;
  const sheet = XLSX.utils.json_to_sheet([
    { Schlüssel: "Format", Wert: BACKUP_FORMAT },
    { Schlüssel: "Version", Wert: BACKUP_VERSION },
    { Schlüssel: "Veranstaltungs-ID", Wert: currentEventId() },
    { Schlüssel: "Veranstaltung", Wert: result.eventName },
    { Schlüssel: "Jahr", Wert: currentEventYear() },
    { Schlüssel: "Exportiert am (UTC)", Wert: result.exportedAt },
  ]);
  sheet["!cols"] = [{ wch: 28 }, { wch: 100 }];
  workbook.Sheets.SICHERUNG_INFO = sheet;
  return {
    ...result,
    buffer: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    }) as Buffer,
  };
}
