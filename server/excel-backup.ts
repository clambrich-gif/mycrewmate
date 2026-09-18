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
  locations,
  marketing,
  materials,
  postTasks,
  prepTasks,
  shiftAreaContacts,
  shifts,
} from "../drizzle/schema";
import {
  eventWeekdays,
  helperEligibleForShift,
  helperAvailableForShift,
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
export const BACKUP_RESTORE_LOG_RETENTION_DAYS = 90;
export const MAX_BACKUP_RESTORE_LOGS_PER_SCOPE = 100;
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
  ORTE: [
    "ID",
    "Ortsname",
    "Breitengrad",
    "Längengrad",
    "Logo-Dateischlüssel",
    "Logo-URL",
    "Reihenfolge",
  ],
  ANSPRECHPARTNER: ["ID", "Name", "Rufnummer", "Bemerkung", "Reihenfolge"],
  HELFER: [
    "ID",
    "Ansprechpartner-ID",
    "Ansprechpartner",
    "Name",
    "E-Mail",
    "Telefon",
    "Bemerkung",
    "Zusätzliche Begleitung",
    "Helfen?",
    "Mo",
    "Di",
    "Mi",
    "Do",
    "Fr",
    "Sa",
    "So",
    "Mo von",
    "Mo bis",
    "Di von",
    "Di bis",
    "Mi von",
    "Mi bis",
    "Do von",
    "Do bis",
    "Fr von",
    "Fr bis",
    "Sa von",
    "Sa bis",
    "So von",
    "So bis",
    "Bestätigt?",
  ],
  EINSATZPLAN: [
    "ID",
    "Tag",
    "Bereich",
    "Aufgabe",
    "Ort-ID",
    "Ort / Standort",
    "Beginn",
    "Ende",
    "Bedarf",
    "Flexible Belegung",
    "Manuell als OK bestätigt",
    "Doppelbelegung akzeptiert",
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
    "Kategorie",
    "Aufgabe",
    "Zu erledigen bis",
    "Ort-ID",
    "Ort / Standort",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Status-Wortlaut",
    "Bemerkung",
    "Reihenfolge",
  ],
  NACHBEREITUNG: [
    "ID",
    "Kategorie",
    "Aufgabe",
    "Zu erledigen bis",
    "Ort-ID",
    "Ort / Standort",
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
    "Ort-ID",
    "Ort / Zielstandort",
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

type AreaContactRow = {
  area: string;
  areaContactSourceId: number | null;
  areaContactName: string;
};

/**
 * Ein Bereich hat fachlich genau einen Ansprechpartner. Excel-Dateien können
 * aber einzelne, leere oder voneinander abweichende Angaben enthalten. Statt
 * den Import abzubrechen, wird der erste im Blatt auflösbare Ansprechpartner
 * des Bereichs auf alle seine Schichten übertragen; leere bzw. unbekannte
 * Angaben werden dabei automatisch mitgezogen.
 */
export function reconcileAreaContacts<TRow extends AreaContactRow>(
  rows: TRow[],
  resolveContact: (row: TRow) =>
    | { sourceId: number | null; name: string }
    | undefined
) {
  const preferredContacts = new Map<
    string,
    { sourceId: number | null; name: string }
  >();

  for (const row of rows) {
    const contact = resolveContact(row);
    if (!contact) continue;
    row.areaContactSourceId = contact.sourceId;
    row.areaContactName = contact.name;
    const areaKey = personKey(row.area);
    if (areaKey && contact && !preferredContacts.has(areaKey))
      preferredContacts.set(areaKey, contact);
  }

  for (const row of rows) {
    const contact = preferredContacts.get(personKey(row.area));
    if (!contact) continue;
    row.areaContactSourceId = contact.sourceId;
    row.areaContactName = contact.name;
  }
}

type Client = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ChangeAction = "create" | "update" | "delete";
export type BackupArea =
  | (typeof SHEETS)[number]
  | "ORTE"
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
  companion: string;
  willHelp: "ja" | "nein";
  availMon: "ja" | "nein" | "vielleicht";
  availTue: "ja" | "nein" | "vielleicht";
  availWed: "ja" | "nein" | "vielleicht";
  availThu: "ja" | "nein" | "vielleicht";
  availFri: "ja" | "nein" | "vielleicht";
  availSat: "ja" | "nein" | "vielleicht";
  availSun: "ja" | "nein" | "vielleicht";
  availMonStart: string;
  availMonEnd: string;
  availTueStart: string;
  availTueEnd: string;
  availWedStart: string;
  availWedEnd: string;
  availThuStart: string;
  availThuEnd: string;
  availFriStart: string;
  availFriEnd: string;
  availSatStart: string;
  availSatEnd: string;
  availSunStart: string;
  availSunEnd: string;
  confirmed: "ja" | "nein";
};
type LocationRow = {
  sourceId: number | null;
  name: string;
  latitude: number;
  longitude: number;
  logoKey: string | null;
  logoUrl: string | null;
  sortOrder: number;
};
type ShiftRow = {
  sourceId: number | null;
  day: Weekday;
  area: string;
  task: string;
  locationSourceId: number | null;
  locationName: string;
  startTime: string;
  endTime: string;
  allowFlexibleAssignment: boolean;
  manualOkConfirmed: boolean;
  manualDoubleConflictAccepted: boolean;
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
  category: string;
  task: string;
  dueText: string;
  locationSourceId: number | null;
  locationName: string;
  contactSourceId: number | null;
  contactName: string;
  status: "offen" | "inArbeit" | "erledigt";
  note: string;
  sortOrder: number;
};
type PrepRow = {
  sourceId: number | null;
  category: string;
  task: string;
  dueText: string;
  locationSourceId: number | null;
  locationName: string;
  contactSourceId: number | null;
  contactName: string;
  status: "offen" | "inArbeit" | "erledigt" | "abgelehnt";
  statusWording: "aufgabe" | "genehmigung";
  note: string;
  sortOrder: number;
};
type MaterialRow = {
  sourceId: number | null;
  article: string;
  category: string;
  quantity: string;
  unit: string;
  locationSourceId: number | null;
  locationName: string;
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
  locations: LocationRow[];
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
  locations: any[];
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

/**
 * Excel speichert Uhrzeiten je nach Vorlage als Tagesbruchteil, Datum/Zeitwert
 * oder ISO-Text. Für den Einsatzplan wird daraus stets die interne Form HH:MM.
 * Ein nicht interpretierbarer Rest bleibt höchstens 16 Zeichen lang und wird
 * anschließend wie bisher durch die strenge Uhrzeitvalidierung abgelehnt.
 */
export function normalizeImportedTime(value: unknown) {
  if (value === null || value === undefined || normalize(value) === "") return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = ((value % 1) + 1) % 1;
    const totalMinutes = Math.round(fraction * 24 * 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(
      totalMinutes % 60
    ).padStart(2, "0")}`;
  }

  if (value instanceof Date && Number.isFinite(value.getTime()))
    return value.toISOString().slice(11, 16);

  const raw = normalize(value);
  const time = raw.match(/(?:^|[T\s])([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|\s|$)/);
  if (time)
    return `${time[1].padStart(2, "0")}:${time[2]}`;

  return raw.slice(0, 16);
}

/**
 * Ansprechpartner besitzen zwingend einen gleichnamigen eigenen Helfereintrag.
 * Bei Imports wird dieser Systemeintrag nicht als Konflikt abgelehnt, sondern
 * automatisch mit dem Ansprechpartner verknüpft. Fehlt er vollständig, wird
 * ein neuer, neutral vorbelegter Systemeintrag ergänzt.
 */
export function reconcileContactSelfHelpers(
  contactRows: ContactRow[],
  helperRows: HelperRow[]
) {
  let linked = 0;
  let created = 0;
  for (const contact of contactRows) {
    const selfHelper = helperRows.find(
      helper => personKey(helper.name) === personKey(contact.name)
    );
    if (selfHelper) {
      const needsLink =
        selfHelper.contactSourceId !== contact.sourceId ||
        selfHelper.contactName !== contact.name;
      selfHelper.contactSourceId = contact.sourceId;
      selfHelper.contactName = contact.name;
      if (needsLink) linked++;
      continue;
    }

    helperRows.push({
      sourceId: null,
      contactSourceId: contact.sourceId,
      contactName: contact.name,
      name: contact.name,
      email: "",
      phone: contact.phone,
      note: "",
      companion: "",
      willHelp: "ja",
      availMon: "vielleicht",
      availTue: "vielleicht",
      availWed: "vielleicht",
      availThu: "vielleicht",
      availFri: "vielleicht",
      availSat: "vielleicht",
      availSun: "vielleicht",
      availMonStart: "",
      availMonEnd: "",
      availTueStart: "",
      availTueEnd: "",
      availWedStart: "",
      availWedEnd: "",
      availThuStart: "",
      availThuEnd: "",
      availFriStart: "",
      availFriEnd: "",
      availSatStart: "",
      availSatEnd: "",
      availSunStart: "",
      availSunEnd: "",
      confirmed: "nein",
    });
    created++;
  }
  return { linked, created };
}

/**
 * Ein Import beschreibt stets den gewünschten Zielstand. Diese Bereinigung
 * läuft deshalb vor Vorschau, Diff und Transaktion: Verwaiste Ansprechpartner
 * werden entkoppelt, gelöschte oder nicht verfügbare Helfer aus Slots entfernt
 * und Schichten außerhalb der aktiven Festivaltage verworfen. So kann kein
 * früherer Datenrest die atomare Übernahme blockieren.
 */
export function repairImportedDocumentRelations(document: BackupDocument) {
  const addWarning = (message: string) => {
    if (!document.warnings.includes(message) && document.warnings.length < 1_000)
      document.warnings.push(message);
  };
  const contactBySourceId = new Map(
    document.contacts.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const contactByName = new Map(
    document.contacts.map(row => [personKey(row.name), row])
  );
  const canonicalizeContactReference = (
    row: { contactSourceId: number | null; contactName: string },
    label: string
  ) => {
    const contact =
      (row.contactSourceId
        ? contactBySourceId.get(row.contactSourceId)
        : undefined) ?? contactByName.get(personKey(row.contactName));
    if (contact) {
      row.contactSourceId = contact.sourceId;
      row.contactName = contact.name;
      return;
    }
    if (row.contactSourceId || personKey(row.contactName)) {
      addWarning(`${label}: fehlender Ansprechpartnerbezug wurde entfernt.`);
      row.contactSourceId = null;
      row.contactName = "";
    }
  };

  for (const row of document.helpers)
    canonicalizeContactReference(row, `Helfer „${row.name}“`);
  for (const row of [
    ...document.prep,
    ...document.post,
    ...document.materials,
    ...document.marketing,
    ...document.approvals,
  ])
    canonicalizeContactReference(
      row,
      `Eintrag „${"task" in row ? row.task : "article" in row ? row.article : "measure" in row ? row.measure : row.request}“`
    );
  const locationBySourceId = new Map(
    document.locations.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const locationByName = new Map(
    document.locations.map(row => [personKey(row.name), row])
  );
  const canonicalizeLocationReference = (
    row: { locationSourceId: number | null; locationName: string },
    label: string
  ) => {
    const location =
      (row.locationSourceId
        ? locationBySourceId.get(row.locationSourceId)
        : undefined) ?? locationByName.get(personKey(row.locationName));
    if (location) {
      row.locationSourceId = location.sourceId;
      row.locationName = location.name;
      return;
    }
    if (row.locationSourceId || personKey(row.locationName)) {
      addWarning(`${label}: fehlender Standortbezug wurde entfernt.`);
      row.locationSourceId = null;
      row.locationName = "";
    }
  };
  for (const row of document.shifts)
    canonicalizeLocationReference(row, `EINSATZPLAN „${row.task}“`);
  for (const row of document.prep)
    canonicalizeLocationReference(row, `VORBEREITUNG „${row.task}“`);
  for (const row of document.materials)
    canonicalizeLocationReference(row, `MATERIAL „${row.article}“`);
  for (const row of document.shifts) {
    const contact =
      (row.areaContactSourceId
        ? contactBySourceId.get(row.areaContactSourceId)
        : undefined) ?? contactByName.get(personKey(row.areaContactName));
    if (contact) {
      row.areaContactSourceId = contact.sourceId;
      row.areaContactName = contact.name;
    } else if (row.areaContactSourceId || personKey(row.areaContactName)) {
      addWarning(
        `Bereich „${row.area}“: fehlender Ansprechpartnerbezug wurde entfernt.`
      );
      row.areaContactSourceId = null;
      row.areaContactName = "";
    }
  }

  const selfHelperReconciliation = reconcileContactSelfHelpers(
    document.contacts,
    document.helpers
  );
  if (selfHelperReconciliation.linked)
    addWarning(
      `${selfHelperReconciliation.linked} eigene Ansprechpartner-Helfereinträge wurden automatisch korrekt zugeordnet.`
    );
  if (selfHelperReconciliation.created)
    addWarning(
      `${selfHelperReconciliation.created} fehlende eigene Ansprechpartner-Helfereinträge wurden automatisch ergänzt.`
    );

  for (const helper of document.helpers) {
    for (const [availability, startField, endField, label] of [
      ["availMon", "availMonStart", "availMonEnd", "Montag"],
      ["availTue", "availTueStart", "availTueEnd", "Dienstag"],
      ["availWed", "availWedStart", "availWedEnd", "Mittwoch"],
      ["availThu", "availThuStart", "availThuEnd", "Donnerstag"],
      ["availFri", "availFriStart", "availFriEnd", "Freitag"],
      ["availSat", "availSatStart", "availSatEnd", "Samstag"],
      ["availSun", "availSunStart", "availSunEnd", "Sonntag"],
    ] as const) {
      const start = helper[startField];
      const end = helper[endField];
      const invalid =
        (start === "") !== (end === "") ||
        (start !== "" &&
          (helper[availability] !== "ja" ||
            toMinutes(start) === null ||
            toMinutes(end) === null ||
            toMinutes(end)! <= toMinutes(start)!));
      if (!invalid) continue;
      addWarning(
        `HELFER „${helper.name}“: ungültiges Zeitfenster für ${label} wurde entfernt.`
      );
      helper[startField] = "";
      helper[endField] = "";
    }
  }

  const activeDays = new Set(eventWeekdays(document.metadata.activeDays));
  document.shifts = document.shifts.filter(shift => {
    if (activeDays.has(shift.day)) return true;
    addWarning(
      `EINSATZPLAN „${shift.task}“ wurde entfernt, weil ${shift.day} nicht als Veranstaltungstag aktiv ist.`
    );
    return false;
  });

  reconcileAreaContacts(document.shifts, row => {
    const contact =
      (row.areaContactSourceId
        ? contactBySourceId.get(row.areaContactSourceId)
        : undefined) ?? contactByName.get(personKey(row.areaContactName));
    return contact
      ? { sourceId: contact.sourceId, name: contact.name }
      : undefined;
  });

  const helperBySourceId = new Map(
    document.helpers.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const helperByName = new Map(
    document.helpers.map(row => [personKey(row.name), row])
  );
  const helperShifts = new Map<string, ShiftRow[]>();
  for (const shift of document.shifts) {
    const seenSlots = new Set<number>();
    const seenHelpers = new Set<string>();
    const repairedSlots: ShiftRow["slots"] = [];
    for (const slot of shift.slots) {
      const helper =
        (slot.helperSourceId
          ? helperBySourceId.get(slot.helperSourceId)
          : undefined) ?? helperByName.get(personKey(slot.helperName));
      if (!helper) {
        addWarning(
          `EINSATZPLAN „${shift.task}“: gelöschter oder unbekannter Helfer „${slot.helperName}“ wurde aus Platz ${slot.slot + 1} entfernt.`
        );
        continue;
      }
      if (!helperEligibleForShift(helper, shift)) {
        addWarning(
          `EINSATZPLAN „${shift.task}“: Helfer „${helper.name}“ ist für die Schichtzeit am ${shift.day} nicht verfügbar und wurde aus Platz ${slot.slot + 1} entfernt.`
        );
        continue;
      }
      if (slot.slot < 0 || slot.slot >= shift.needed) {
        addWarning(
          `EINSATZPLAN „${shift.task}“: Helfer „${helper.name}“ lag außerhalb des Bedarfs und wurde entfernt.`
        );
        continue;
      }
      const helperKey = helper.sourceId
        ? `id:${helper.sourceId}`
        : `name:${personKey(helper.name)}`;
      if (seenSlots.has(slot.slot) || seenHelpers.has(helperKey)) {
        addWarning(
          `EINSATZPLAN „${shift.task}“: doppelte Helferzuweisung für „${helper.name}“ wurde bereinigt.`
        );
        continue;
      }
      seenSlots.add(slot.slot);
      seenHelpers.add(helperKey);
      const assignedShifts = helperShifts.get(helperKey) ?? [];
      assignedShifts.push(shift);
      helperShifts.set(helperKey, assignedShifts);
      repairedSlots.push({
        slot: slot.slot,
        helperSourceId: helper.sourceId,
        helperName: helper.name,
      });
    }
    shift.slots = repairedSlots.sort((left, right) => left.slot - right.slot);
  }
  for (const [helperKey, assignedShifts] of Array.from(helperShifts.entries()))
    for (let left = 0; left < assignedShifts.length; left++)
      for (let right = left + 1; right < assignedShifts.length; right++)
        if (overlaps(assignedShifts[left] as any, assignedShifts[right] as any))
          addWarning(
            `Doppelbelegung: ${helperKey} ist gleichzeitig in „${assignedShifts[left].task}“ und „${assignedShifts[right].task}“ eingeteilt`
          );
  return document;
}

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
const coordinate = (value: unknown, label: string, min: number, max: number) => {
  const number =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(number) || number < min || number > max)
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

function normalizeSheetHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function sheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Pflichtblatt „${name}“ fehlt`);
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headerRow = (rawRows[0] ?? []).map(normalizeSheetHeader);
  const rows = rawRows.slice(1).reduce<Record<string, unknown>[]>(
    (result, values) => {
      const row: Record<string, unknown> = {};
      headerRow.forEach((header, index) => {
        if (header) row[header] = values[index] ?? "";
      });
      if (
        Object.values(row).some(value => String(value ?? "").trim() !== "")
      )
        result.push(row);
      return result;
    },
    []
  );
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
    const byName = nameKey ? contactNames.get(nameKey) : undefined;
    if (nameKey && contactNames.has(nameKey)) return byName ?? null;
    if (id && contactIds.has(id)) return id;
    if (id || nameKey) {
      const reference = id
        ? `ID ${id}`
        : `Name „${String(nameValue ?? "").trim().slice(0, 200)}“`;
      warnings.push(
        `${label}: Fehlende Ansprechpartnerreferenz ${reference}. Der Datensatz bleibt erhalten, die Zuordnung wird entfernt.`
      );
    }
    return null;
  };

  const locationRows = workbook.Sheets.ORTE
    ? sheetRows(workbook, "ORTE").filter(row => normalize(row.Ortsname))
    : [];
  const parsedLocations: LocationRow[] = locationRows.map((row, index) => ({
    sourceId: nullableId(row.ID, `ORTE Zeile ${index + 2}`),
    name: text(row.Ortsname, 200, `ORTE Zeile ${index + 2}: Ortsname`, true),
    latitude: coordinate(
      row.Breitengrad,
      `ORTE Zeile ${index + 2}: Breitengrad`,
      -90,
      90
    ),
    longitude: coordinate(
      row.Längengrad,
      `ORTE Zeile ${index + 2}: Längengrad`,
      -180,
      180
    ),
    logoKey:
      text(row["Logo-Dateischlüssel"], 500, `ORTE Zeile ${index + 2}: Logo-Dateischlüssel`) ||
      null,
    logoUrl: text(row["Logo-URL"], 700, `ORTE Zeile ${index + 2}: Logo-URL`) || null,
    sortOrder: integer(
      row.Reihenfolge || 0,
      `ORTE Zeile ${index + 2}: Reihenfolge`,
      0,
      1_000_000
    ),
  }));
  ensureUnique(parsedLocations, row => row.sourceId, row => row.name, "ORTE");
  const locationIds = new Set(
    parsedLocations.flatMap(row => (row.sourceId ? [row.sourceId] : []))
  );
  const locationNames = new Map(
    parsedLocations.map(row => [personKey(row.name), row.sourceId])
  );
  const locationRef = (idValue: unknown, nameValue: unknown, label: string) => {
    const id = nullableId(idValue, label);
    const nameKey = personKey(nameValue);
    const byName = nameKey ? locationNames.get(nameKey) : undefined;
    if (nameKey && locationNames.has(nameKey)) return byName ?? null;
    if (id && locationIds.has(id)) return id;
    if (id || nameKey)
      warnings.push(`${label}: gelöschter oder unbekannter Ort wird entfernt.`);
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
    companion: text(
      row["Zusätzliche Begleitung"] ?? row.Begleitung,
      500,
      `HELFER Zeile ${index + 2}: Zusätzliche Begleitung`
    ),
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
    availMonStart: text(normalizeImportedTime(row["Mo von"]), 5, `HELFER Zeile ${index + 2}: Montag von`),
    availMonEnd: text(normalizeImportedTime(row["Mo bis"]), 5, `HELFER Zeile ${index + 2}: Montag bis`),
    availTueStart: text(normalizeImportedTime(row["Di von"]), 5, `HELFER Zeile ${index + 2}: Dienstag von`),
    availTueEnd: text(normalizeImportedTime(row["Di bis"]), 5, `HELFER Zeile ${index + 2}: Dienstag bis`),
    availWedStart: text(normalizeImportedTime(row["Mi von"]), 5, `HELFER Zeile ${index + 2}: Mittwoch von`),
    availWedEnd: text(normalizeImportedTime(row["Mi bis"]), 5, `HELFER Zeile ${index + 2}: Mittwoch bis`),
    availThuStart: text(normalizeImportedTime(row["Do von"]), 5, `HELFER Zeile ${index + 2}: Donnerstag von`),
    availThuEnd: text(normalizeImportedTime(row["Do bis"]), 5, `HELFER Zeile ${index + 2}: Donnerstag bis`),
    availFriStart: text(normalizeImportedTime(row["Fr von"]), 5, `HELFER Zeile ${index + 2}: Freitag von`),
    availFriEnd: text(normalizeImportedTime(row["Fr bis"]), 5, `HELFER Zeile ${index + 2}: Freitag bis`),
    availSatStart: text(normalizeImportedTime(row["Sa von"]), 5, `HELFER Zeile ${index + 2}: Samstag von`),
    availSatEnd: text(normalizeImportedTime(row["Sa bis"]), 5, `HELFER Zeile ${index + 2}: Samstag bis`),
    availSunStart: text(normalizeImportedTime(row["So von"]), 5, `HELFER Zeile ${index + 2}: Sonntag von`),
    availSunEnd: text(normalizeImportedTime(row["So bis"]), 5, `HELFER Zeile ${index + 2}: Sonntag bis`),
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
  const selfHelperReconciliation = reconcileContactSelfHelpers(
    parsedContacts,
    parsedHelpers
  );
  if (selfHelperReconciliation.linked)
    warnings.push(
      `${selfHelperReconciliation.linked} eigene Ansprechpartner-Helfereinträge wurden automatisch korrekt zugeordnet.`
    );
  if (selfHelperReconciliation.created)
    warnings.push(
      `${selfHelperReconciliation.created} fehlende eigene Ansprechpartner-Helfereinträge wurden automatisch ergänzt.`
    );
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
    const startTime = normalizeImportedTime(row.Beginn);
    const endTime = normalizeImportedTime(row.Ende);
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
    const flexibleRaw = normalize(row["Flexible Belegung"]);
    const allowFlexibleAssignment = ["ja", "true", "1", "x"].includes(
      flexibleRaw.toLocaleLowerCase("de-DE")
    );
    const manualOkRaw = normalize(row["Manuell als OK bestätigt"]);
    const manualOkConfirmed = ["ja", "true", "1", "x"].includes(
      manualOkRaw.toLocaleLowerCase("de-DE")
    );
    const manualDoubleConflictRaw = normalize(
      row["Doppelbelegung akzeptiert"]
    );
    const manualDoubleConflictAccepted = ["ja", "true", "1", "x"].includes(
      manualDoubleConflictRaw.toLocaleLowerCase("de-DE")
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
      locationSourceId: locationRef(
        row["Ort-ID"],
        row["Ort / Standort"],
        `EINSATZPLAN Zeile ${index + 2}: Ort`
      ),
      locationName: text(
        row["Ort / Standort"],
        200,
        `EINSATZPLAN Zeile ${index + 2}: Ort`
      ),
      startTime,
      endTime,
      allowFlexibleAssignment,
      manualOkConfirmed,
      manualDoubleConflictAccepted,
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
  const parsedContactById = new Map(
    parsedContacts.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const parsedContactByName = new Map(
    parsedContacts.map(row => [personKey(row.name), row])
  );
  reconcileAreaContacts(parsedShifts, row =>
    (row.areaContactSourceId
      ? parsedContactById.get(row.areaContactSourceId)
      : undefined) ?? parsedContactByName.get(personKey(row.areaContactName))
  );

  const parseTaskRows = (sheet: "NACHBEREITUNG") =>
    sheetRows(workbook, sheet)
      .filter(row => normalize(row.Aufgabe))
      .map((row, index) => ({
        sourceId: nullableId(row.ID, `${sheet} Zeile ${index + 2}`),
        category: text(
          row.Kategorie ?? row.Bereich,
          120,
          `${sheet} Zeile ${index + 2}: Kategorie`
        ),
        task: text(
          row.Aufgabe,
          300,
          `${sheet} Zeile ${index + 2}: Aufgabe`,
          true
        ),
        dueText: text(
          row["Zu erledigen bis"],
          200,
          `${sheet} Zeile ${index + 2}: Zu erledigen bis`
        ),
        locationSourceId: locationRef(
          row["Ort-ID"],
          row["Ort / Standort"],
          `${sheet} Zeile ${index + 2}: Ort`
        ),
        locationName: text(
          row["Ort / Standort"],
          200,
          `${sheet} Zeile ${index + 2}: Ort`
        ),
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
      category: text(
        row.Kategorie ?? row.Bereich,
        120,
        `VORBEREITUNG Zeile ${index + 2}: Kategorie`
      ),
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
      locationSourceId: locationRef(
        row["Ort-ID"],
        row["Ort / Standort"],
        `VORBEREITUNG Zeile ${index + 2}: Ort`
      ),
      locationName: text(
        row["Ort / Standort"],
        200,
        `VORBEREITUNG Zeile ${index + 2}: Ort`
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
        ["offen", "inArbeit", "erledigt", "abgelehnt"] as const,
        `VORBEREITUNG Zeile ${index + 2}: Status`,
        "offen"
      ),
      statusWording: enumValue(
        row["Status-Wortlaut"] ?? row.StatusWortlaut,
        ["aufgabe", "genehmigung"] as const,
        `VORBEREITUNG Zeile ${index + 2}: Status-Wortlaut`,
        "aufgabe"
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
      locationSourceId: locationRef(
        row["Ort-ID"],
        row["Ort / Zielstandort"],
        `MATERIAL Zeile ${index + 2}: Ort`
      ),
      locationName: text(
        row["Ort / Zielstandort"],
        200,
        `MATERIAL Zeile ${index + 2}: Ort`
      ),
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

  return repairImportedDocumentRelations({
    metadata: meta,
    contacts: parsedContacts,
    helpers: parsedHelpers,
    locations: parsedLocations,
    shifts: parsedShifts,
    prep: parsedPrep,
    post: parsedPost,
    materials: parsedMaterials,
    marketing: parsedMarketing,
    approvals: parsedApprovals,
    cakes: parsedCakes,
    finances: parsedFinances,
    warnings: Array.from(new Set(warnings)),
  });
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
    locationRows,
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
    selectRows(locations, scope(locations)),
    selectRows(shifts, scope(shifts)),
    selectRows(shiftAreaContacts, scope(shiftAreaContacts)),
    selectRows(
      assignments,
      inArray(
        assignments.shiftId,
        database.select({ id: shifts.id }).from(shifts).where(scope(shifts))
      )
    ),
    selectRows(prepTasks, and(scope(prepTasks), eq(prepTasks.deleted, false))),
    selectRows(postTasks, and(scope(postTasks), eq(postTasks.deleted, false))),
    selectRows(materials, and(scope(materials), eq(materials.deleted, false))),
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
    locations: locationRows,
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
        row[field] ??
          (field === "sortOrder"
            ? 0
            : field === "allowFlexibleAssignment" ||
                field === "manualOkConfirmed" ||
                field === "manualDoubleConflictAccepted"
              ? false
              : ""),
      ])
    );
  const contactName = new Map(snapshot.contacts.map(row => [row.id, row.name]));
  const helperName = new Map(snapshot.helpers.map(row => [row.id, row.name]));
  const locationName = new Map(snapshot.locations.map(row => [row.id, row.name]));
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
        "companion",
        "willHelp",
        "availMon",
        "availTue",
        "availWed",
        "availThu",
        "availFri",
        "availSat",
        "availSun",
        "availMonStart",
        "availMonEnd",
        "availTueStart",
        "availTueEnd",
        "availWedStart",
        "availWedEnd",
        "availThuStart",
        "availThuEnd",
        "availFriStart",
        "availFriEnd",
        "availSatStart",
        "availSatEnd",
        "availSunStart",
        "availSunEnd",
        "confirmed",
      ]),
      availMon: row.availMon ?? "ja",
      availTue: row.availTue ?? "ja",
      availWed: row.availWed ?? "ja",
      availThu: row.availThu ?? "ja",
    })),
    locations: [...snapshot.locations].sort(byId).map(row => ({
      sourceId: row.id,
      ...clean(row, ["name", "latitude", "longitude", "sortOrder"]),
      logoKey: row.logoKey ?? null,
      logoUrl: row.logoUrl ?? null,
    })),
    shifts: [...snapshot.shifts].sort(byId).map(row => ({
      sourceId: row.id,
      ...clean(row, [
        "day",
        "area",
        "task",
        "startTime",
        "endTime",
        "allowFlexibleAssignment",
        "manualOkConfirmed",
        "manualDoubleConflictAccepted",
        "needed",
        "note",
        "sortOrder",
      ]),
      areaContactSourceId: areaContact.get(personKey(row.area)) ?? null,
      locationSourceId: row.locationId ?? null,
      locationName: row.locationId ? (locationName.get(row.locationId) ?? "") : "",
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
      locationSourceId: row.locationId ?? null,
      locationName: row.locationId ? (locationName.get(row.locationId) ?? "") : "",
      ...clean(row, [
        "category",
        "task",
        "dueText",
        "status",
        "statusWording",
        "note",
        "sortOrder",
      ]),
    })),
    post: [...snapshot.post].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      locationSourceId: row.locationId ?? null,
      locationName: row.locationId ? (locationName.get(row.locationId) ?? "") : "",
      ...clean(row, ["category", "task", "dueText", "status", "note", "sortOrder"]),
    })),
    materials: [...snapshot.materials].sort(byId).map(row => ({
      sourceId: row.id,
      contactSourceId: row.contactId,
      contactName: row.contactId ? (contactName.get(row.contactId) ?? "") : "",
      locationSourceId: row.locationId ?? null,
      locationName: row.locationId ? (locationName.get(row.locationId) ?? "") : "",
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
    locations: withoutIds(document.locations as Array<Record<string, unknown>>),
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
                field !== "locationSourceId" &&
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
      "locationSourceId",
    ]),
    post: withoutIds(document.post as Array<Record<string, unknown>>, [
      "contactSourceId",
    ]),
    materials: withoutIds(
      document.materials as Array<Record<string, unknown>>,
      ["contactSourceId", "locationSourceId"]
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

function restoreMismatchDetail(
  restored: Record<string, Array<Record<string, unknown>>>,
  desired: Record<string, Array<Record<string, unknown>>>,
  metadataMatches: {
    activeDays: boolean;
    pdfLogoKey: boolean;
    pdfLogoUrl: boolean;
    pdfLogoFallback: boolean;
  }
) {
  const differingArea = Object.keys(desired).find(
    area => JSON.stringify(restored[area] ?? []) !== JSON.stringify(desired[area] ?? [])
  );
  if (differingArea)
    return `Abweichung im Bereich ${differingArea}: erwartet ${desired[differingArea]?.length ?? 0} Einträge, wiederhergestellt ${restored[differingArea]?.length ?? 0} Einträge.`;
  if (!metadataMatches.activeDays)
    return "Die aktiven Veranstaltungstage stimmen nach der Wiederherstellung nicht mit der Vorschau überein.";
  if (
    !metadataMatches.pdfLogoKey ||
    !metadataMatches.pdfLogoUrl ||
    !metadataMatches.pdfLogoFallback
  )
    return "Die PDF-Bildkonfiguration stimmt nach der Wiederherstellung nicht mit der Vorschau überein.";
  return "Der wiederhergestellte Datenstand weicht von der geprüften Vorschau ab.";
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
  ["ORTE", "locations", "name"],
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
const ignoredDiffFields = new Set([
  "contactName",
  "areaContactName",
  "locationName",
  "slots",
]);
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
  if (field === "locationSourceId") {
    return before.locationSourceId && after.locationSourceId
      ? before.locationSourceId === after.locationSourceId
      : personKey(before.locationName) === personKey(after.locationName);
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
    const beforeRows = ((current as any)[key] ?? []) as any[];
    const afterRows = ((desired as any)[key] ?? []) as any[];
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
    target.locations,
    row => row.sourceId,
    row => row.name,
    "ORTE"
  );
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
  const locationById = new Map(
    target.locations.flatMap(row =>
      row.sourceId ? ([[row.sourceId, row]] as const) : []
    )
  );
  const locationByName = new Map(
    target.locations.map(row => [personKey(row.name), row])
  );
  const normalizeLocationRef = (row: {
    locationSourceId: number | null;
    locationName: string;
  }) => {
    const location =
      (row.locationSourceId
        ? locationById.get(row.locationSourceId)
        : undefined) ?? locationByName.get(personKey(row.locationName));
    row.locationSourceId = location?.sourceId ?? null;
    row.locationName = location?.name ?? "";
  };
  for (const row of target.shifts) normalizeLocationRef(row);
  for (const row of target.prep) normalizeLocationRef(row);
  for (const row of target.materials) normalizeLocationRef(row);
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
  reconcileAreaContacts(target.shifts, shift =>
    (shift.areaContactSourceId
      ? contactById.get(shift.areaContactSourceId)
      : undefined) ?? contactByName.get(personKey(shift.areaContactName))
  );
  const helperShifts = new Map<string, ShiftRow[]>();
  for (const shift of target.shifts) {
    if (!activeDays.has(shift.day))
      throw new Error(
        `Die Auswahl ist nicht vollständig: ${shift.day} wird deaktiviert, aber die Schicht „${shift.task}“ bleibt ausgewählt. Bitte übernehmen Sie auch die zugehörigen Einsatzplanänderungen.`
      );

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

/**
 * Manuelle Freigaben gelten immer nur für den konkret geprüften Planstand.
 * Bei einem Excel-Import dürfen sie daher nicht an einer geänderten Schicht,
 * einer geänderten Helferverfügbarkeit oder einer geänderten Zuordnung hängen
 * bleiben. Die Funktion arbeitet absichtlich auf dem bereits selektierten
 * Zielstand, damit auch Modulimporte dieselbe Sicherheitsregel einhalten.
 */
export function resetInvalidatedManualConfirmations(
  current: ReturnType<typeof comparableCurrent>,
  target: BackupDocument
) {
  const shiftIdentity = (shift: ShiftRow) =>
    personKey(
      `${shift.day}|${shift.area}|${shift.task}|${shift.startTime}|${shift.endTime}`
    );
  const helperKey = (helper: Pick<HelperRow, "sourceId" | "name">) =>
    helper.sourceId ? `id:${helper.sourceId}` : `name:${personKey(helper.name)}`;
  const slotMap = (shift: ShiftRow) =>
    new Map(
      shift.slots.map(slot => [
        slot.slot,
        helperKey({ sourceId: slot.helperSourceId, name: slot.helperName }),
      ])
    );
  const sameSlots = (left: ShiftRow, right: ShiftRow) => {
    const leftSlots = slotMap(left);
    const rightSlots = slotMap(right);
    return (
      leftSlots.size === rightSlots.size &&
      Array.from(leftSlots.entries()).every(
        ([slot, helper]) => rightSlots.get(slot) === helper
      )
    );
  };
  const currentShifts = current.shifts as ShiftRow[];
  const currentById = new Map(
    currentShifts.flatMap(shift =>
      shift.sourceId ? ([[shift.sourceId, shift]] as const) : []
    )
  );
  const currentByIdentity = new Map(
    currentShifts.map(shift => [shiftIdentity(shift), shift])
  );
  const targetById = new Map(
    target.shifts.flatMap(shift =>
      shift.sourceId ? ([[shift.sourceId, shift]] as const) : []
    )
  );
  const targetByIdentity = new Map(
    target.shifts.map(shift => [shiftIdentity(shift), shift])
  );
  const resolveCurrentShift = (shift: ShiftRow) =>
    (shift.sourceId ? currentById.get(shift.sourceId) : undefined) ??
    currentByIdentity.get(shiftIdentity(shift));
  const resolveTargetShift = (shift: ShiftRow) =>
    (shift.sourceId ? targetById.get(shift.sourceId) : undefined) ??
    targetByIdentity.get(shiftIdentity(shift));

  const helpersWithAssignmentChanges = new Set<string>();
  const collectAssignedHelpers = (shift: ShiftRow | undefined) => {
    for (const slot of shift?.slots ?? [])
      helpersWithAssignmentChanges.add(
        helperKey({ sourceId: slot.helperSourceId, name: slot.helperName })
      );
  };
  const shiftsWithFundamentalChanges = new Set<ShiftRow>();
  const shiftsWithAssignmentChanges = new Set<ShiftRow>();
  for (const shift of target.shifts) {
    const before = resolveCurrentShift(shift);
    if (!before) {
      collectAssignedHelpers(shift);
      continue;
    }
    const fundamentallyChanged =
      before.day !== shift.day ||
      before.startTime !== shift.startTime ||
      before.endTime !== shift.endTime ||
      before.allowFlexibleAssignment !== shift.allowFlexibleAssignment ||
      before.needed !== shift.needed;
    if (fundamentallyChanged) shiftsWithFundamentalChanges.add(shift);
    if (!sameSlots(before, shift)) {
      shiftsWithAssignmentChanges.add(shift);
      collectAssignedHelpers(before);
      collectAssignedHelpers(shift);
    }
  }
  for (const shift of currentShifts)
    if (!resolveTargetShift(shift)) collectAssignedHelpers(shift);

  const currentHelpers = current.helpers as HelperRow[];
  const currentHelpersByKey = new Map(
    currentHelpers.map(helper => [helperKey(helper), helper])
  );
  const targetHelpersByKey = new Map(
    target.helpers.map(helper => [helperKey(helper), helper])
  );
  const availabilityChangeAffects = (helper: HelperRow, day: Weekday) => {
    const before = currentHelpersByKey.get(helperKey(helper));
    if (!before) return false;
    const suffix =
      day === "Montag"
        ? "Mon"
        : day === "Dienstag"
          ? "Tue"
          : day === "Mittwoch"
            ? "Wed"
            : day === "Donnerstag"
              ? "Thu"
              : day === "Freitag"
                ? "Fri"
                : day === "Samstag"
                  ? "Sat"
                  : "Sun";
    const fields = [
      "willHelp",
      `avail${suffix}`,
      `avail${suffix}Start`,
      `avail${suffix}End`,
    ] as const;
    return fields.some(field => before[field as keyof HelperRow] !== helper[field as keyof HelperRow]);
  };

  const resetShiftIds = new Set<number>();
  for (const shift of target.shifts) {
    if (!shift.manualOkConfirmed && !shift.manualDoubleConflictAccepted) continue;
    const assignedHelperKeys = shift.slots.map(slot =>
      helperKey({ sourceId: slot.helperSourceId, name: slot.helperName })
    );
    const assignmentChanged = assignedHelperKeys.some(key =>
      helpersWithAssignmentChanges.has(key)
    );
    const availabilityChanged = assignedHelperKeys.some(key => {
      const helper = targetHelpersByKey.get(key);
      return helper ? availabilityChangeAffects(helper, shift.day) : false;
    });
    if (
      !shiftsWithFundamentalChanges.has(shift) &&
      !shiftsWithAssignmentChanges.has(shift) &&
      !assignmentChanged &&
      !availabilityChanged
    )
      continue;

    shift.manualOkConfirmed = false;
    shift.manualDoubleConflictAccepted = false;
    if (shift.sourceId) resetShiftIds.add(shift.sourceId);
    const message = `EINSATZPLAN „${shift.task}“: Manuelle Freigaben wurden wegen geänderter Schicht-, Zuordnungs- oder Verfügbarkeitsdaten zurückgesetzt.`;
    if (!target.warnings.includes(message)) target.warnings.push(message);
  }
  return resetShiftIds;
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
  resetInvalidatedManualConfirmations(current, desired);
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
    resetInvalidatedManualConfirmations(current, desired);
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
      await tx.delete(locations).where(scope(locations));
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

      const currentLocationIds = new Set(snapshot.locations.map(row => row.id));
      const locationIdBySource = new Map<number, number>();
      const locationIdByName = new Map<string, number>();
      for (const row of desired.locations) {
        const preservedId =
          row.sourceId && currentLocationIds.has(row.sourceId)
            ? row.sourceId
            : undefined;
        const result: any = await tx.insert(locations).values({
          ...(preservedId ? { id: preservedId } : {}),
          year,
          eventId,
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          logoKey: row.logoKey,
          logoUrl: row.logoUrl,
          sortOrder: row.sortOrder,
        });
        const actualId =
          preservedId ?? Number(result?.[0]?.insertId ?? result?.insertId);
        if (row.sourceId) locationIdBySource.set(row.sourceId, actualId);
        locationIdByName.set(personKey(row.name), actualId);
      }
      const resolveLocation = (sourceId: number | null, name: string) =>
        (sourceId ? locationIdBySource.get(sourceId) : undefined) ??
        locationIdByName.get(personKey(name)) ??
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
          companion: row.companion || null,
          willHelp: row.willHelp,
          availMon: row.availMon,
          availTue: row.availTue,
          availWed: row.availWed,
          availThu: row.availThu,
          availFri: row.availFri,
          availSat: row.availSat,
          availSun: row.availSun,
          availMonStart: row.availMonStart || null,
          availMonEnd: row.availMonEnd || null,
          availTueStart: row.availTueStart || null,
          availTueEnd: row.availTueEnd || null,
          availWedStart: row.availWedStart || null,
          availWedEnd: row.availWedEnd || null,
          availThuStart: row.availThuStart || null,
          availThuEnd: row.availThuEnd || null,
          availFriStart: row.availFriStart || null,
          availFriEnd: row.availFriEnd || null,
          availSatStart: row.availSatStart || null,
          availSatEnd: row.availSatEnd || null,
          availSunStart: row.availSunStart || null,
          availSunEnd: row.availSunEnd || null,
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
          locationId: resolveLocation(row.locationSourceId, row.locationName),
          startTime: row.startTime,
          endTime: row.endTime,
          allowFlexibleAssignment: row.allowFlexibleAssignment,
          manualOkConfirmed: row.manualOkConfirmed,
          manualDoubleConflictAccepted: row.manualDoubleConflictAccepted,
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
          category: row.category ?? "",
          task: row.task,
          dueText: row.dueText,
          locationId: resolveLocation(row.locationSourceId, row.locationName),
          contactId: resolveContact(row.contactSourceId, row.contactName),
          status: row.status,
          statusWording: row.statusWording ?? "aufgabe",
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
          category: row.category,
          task: row.task,
          dueText: row.dueText,
          locationId: resolveLocation(row.locationSourceId, row.locationName),
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
          locationId: resolveLocation(row.locationSourceId, row.locationName),
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
    const metadataMatches = {
      activeDays:
        JSON.stringify(afterSnapshot.activeDays) ===
        JSON.stringify(desired.metadata.activeDays),
      pdfLogoKey: afterSnapshot.pdfLogoKey === desired.metadata.pdfLogoKey,
      pdfLogoUrl: afterSnapshot.pdfLogoUrl === desired.metadata.pdfLogoUrl,
      pdfLogoFallback:
        afterSnapshot.pdfLogoFallback === desired.metadata.pdfLogoFallback,
    };
    if (
      JSON.stringify(restoredContent) !== JSON.stringify(desiredContent) ||
      !metadataMatches.activeDays ||
      !metadataMatches.pdfLogoKey ||
      !metadataMatches.pdfLogoUrl ||
      !metadataMatches.pdfLogoFallback
    )
      throw new Error(
        `Die Wiederherstellung wurde zum Schutz der Daten komplett zurückgerollt: ${restoreMismatchDetail(restoredContent, desiredContent, metadataMatches)}`
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
    await pruneBackupRestoreLogs(tx, { year, eventId });
    return { ...totals, warnings: imported.warnings, afterDigest };
  });
}

type BackupRestoreLogScope = { year: number; eventId: number };

function backupRestoreLogScope({ year, eventId }: BackupRestoreLogScope) {
  return and(
    eq(backupRestoreLogs.year, year),
    eq(backupRestoreLogs.eventId, eventId)
  );
}

/**
 * Hält das Protokoll pro Veranstaltung kompakt. Die Funktion ist absichtlich
 * bei jedem erfolgreichen Import sowie beim Öffnen der Protokollübersicht
 * idempotent: Einträge älter als 90 Tage und Einträge außerhalb der neuesten
 * 100 Vorgänge werden bereinigt.
 */
export async function pruneBackupRestoreLogs(
  client: Client,
  scope: BackupRestoreLogScope = {
    year: currentEventYear(),
    eventId: currentEventId(),
  },
  now = new Date()
) {
  const cutoff = new Date(
    now.getTime() - BACKUP_RESTORE_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const whereScope = backupRestoreLogScope(scope);
  const entries = await client
    .select({ id: backupRestoreLogs.id, createdAt: backupRestoreLogs.createdAt })
    .from(backupRestoreLogs)
    .where(whereScope)
    .orderBy(desc(backupRestoreLogs.createdAt), desc(backupRestoreLogs.id))
  const removableIds = backupRestoreLogIdsToPrune(entries, cutoff);
  if (removableIds.length === 0) return;

  await client
    .delete(backupRestoreLogs)
    .where(and(whereScope, inArray(backupRestoreLogs.id, removableIds)));
}

/** Liefert alte sowie überzählige IDs, die aus dem Scope entfernt werden dürfen. */
export function backupRestoreLogIdsToPrune(
  entries: Array<{ id: number; createdAt: Date }>,
  cutoff: Date
) {
  const oldIds = entries
    .filter(entry => entry.createdAt < cutoff)
    .map(entry => entry.id);
  const currentIds = entries
    .filter(entry => entry.createdAt >= cutoff)
    .sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() || right.id - left.id
    )
    .slice(MAX_BACKUP_RESTORE_LOGS_PER_SCOPE)
    .map(entry => entry.id);
  return [...oldIds, ...currentIds];
}

/** Löscht bewusst nur die Einträge der aktuell gewählten Veranstaltung. */
export async function clearBackupRestoreLogs() {
  const db = (await getDb()) as Client;
  const scope = { year: currentEventYear(), eventId: currentEventId() };
  const entries = await db
    .select({ id: backupRestoreLogs.id })
    .from(backupRestoreLogs)
    .where(backupRestoreLogScope(scope));
  await db
    .delete(backupRestoreLogs)
    .where(backupRestoreLogScope(scope));
  return { deleted: entries.length };
}

export async function listBackupRestoreLogs(limit = 50) {
  const db = (await getDb()) as Client;
  const scope = { year: currentEventYear(), eventId: currentEventId() };
  await pruneBackupRestoreLogs(db, scope);
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
    .where(backupRestoreLogScope(scope))
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
    "ORTE",
    current.locations.map((row: any) => ({
      ID: row.sourceId,
      Ortsname: row.name,
      Breitengrad: row.latitude,
      Längengrad: row.longitude,
      "Logo-Dateischlüssel": row.logoKey ?? "",
      "Logo-URL": row.logoUrl ?? "",
      Reihenfolge: row.sortOrder,
    }))
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
      "Zusätzliche Begleitung": row.companion,
      "Helfen?": row.willHelp,
      Mo: row.availMon,
      Di: row.availTue,
      Mi: row.availWed,
      Do: row.availThu,
      Fr: row.availFri,
      Sa: row.availSat,
      So: row.availSun,
      "Mo von": row.availMonStart,
      "Mo bis": row.availMonEnd,
      "Di von": row.availTueStart,
      "Di bis": row.availTueEnd,
      "Mi von": row.availWedStart,
      "Mi bis": row.availWedEnd,
      "Do von": row.availThuStart,
      "Do bis": row.availThuEnd,
      "Fr von": row.availFriStart,
      "Fr bis": row.availFriEnd,
      "Sa von": row.availSatStart,
      "Sa bis": row.availSatEnd,
      "So von": row.availSunStart,
      "So bis": row.availSunEnd,
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
      "Ort-ID": row.locationSourceId ?? "",
      "Ort / Standort": row.locationName,
      Beginn: row.startTime,
      Ende: row.endTime,
      "Flexible Belegung": row.allowFlexibleAssignment ? "Ja" : "Nein",
      "Manuell als OK bestätigt": row.manualOkConfirmed ? "Ja" : "Nein",
      "Doppelbelegung akzeptiert": row.manualDoubleConflictAccepted
        ? "Ja"
        : "Nein",
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
  const taskRows = (rows: any[], includeTaskMetadata = false, isPrep = false) =>
    rows.map(row => ({
      ID: row.sourceId,
      ...(includeTaskMetadata ? { Kategorie: row.category ?? "" } : {}),
      Aufgabe: row.task,
      ...(includeTaskMetadata ? { "Zu erledigen bis": row.dueText } : {}),
      ...(includeTaskMetadata
        ? {
            "Ort-ID": row.locationSourceId ?? "",
            "Ort / Standort": row.locationName,
          }
        : {}),
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      ...(isPrep ? { "Status-Wortlaut": row.statusWording ?? "aufgabe" } : {}),
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  append("VORBEREITUNG", taskRows(current.prep, true, true));
  append("NACHBEREITUNG", taskRows(current.post, true));
  append(
    "MATERIAL",
    current.materials.map((row: any) => ({
      ID: row.sourceId,
      Artikel: row.article,
      Kategorie: row.category,
      Menge: row.quantity,
      Einheit: row.unit,
      "Ort-ID": row.locationSourceId ?? "",
      "Ort / Zielstandort": row.locationName,
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
  const document = await createCurrentProjectDocument();
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
    {
      Schlüssel: "Veranstaltungstage",
      Wert: document.metadata.activeDays.join(", "),
    },
    {
      Schlüssel: "PDF-Bild-Schlüssel",
      Wert: document.metadata.pdfLogoKey ?? "",
    },
    {
      Schlüssel: "PDF-Bild-URL",
      Wert: document.metadata.pdfLogoUrl ?? "",
    },
    {
      Schlüssel: "PDF-Bild-Fallback",
      Wert: document.metadata.pdfLogoFallback,
    },
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
