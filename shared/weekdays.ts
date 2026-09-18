import { toMinutes } from "./shift-time";

export const WEEKDAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type AvailabilityValue = "ja" | "nein" | "vielleicht";

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  Montag: "Mo",
  Dienstag: "Di",
  Mittwoch: "Mi",
  Donnerstag: "Do",
  Freitag: "Fr",
  Samstag: "Sa",
  Sonntag: "So",
};

export const WEEKDAY_AVAILABILITY_FIELDS = {
  Montag: "availMon",
  Dienstag: "availTue",
  Mittwoch: "availWed",
  Donnerstag: "availThu",
  Freitag: "availFri",
  Samstag: "availSat",
  Sonntag: "availSun",
} as const satisfies Record<Weekday, string>;

export type AvailabilityField = (typeof WEEKDAY_AVAILABILITY_FIELDS)[Weekday];

/** Optionale, tagesbezogene Zeitfenster. Leere Werte bedeuten ganztägig. */
export const WEEKDAY_AVAILABILITY_TIME_FIELDS = {
  Montag: { start: "availMonStart", end: "availMonEnd" },
  Dienstag: { start: "availTueStart", end: "availTueEnd" },
  Mittwoch: { start: "availWedStart", end: "availWedEnd" },
  Donnerstag: { start: "availThuStart", end: "availThuEnd" },
  Freitag: { start: "availFriStart", end: "availFriEnd" },
  Samstag: { start: "availSatStart", end: "availSatEnd" },
  Sonntag: { start: "availSunStart", end: "availSunEnd" },
} as const satisfies Record<Weekday, { start: string; end: string }>;

export type AvailabilityTimeField =
  (typeof WEEKDAY_AVAILABILITY_TIME_FIELDS)[Weekday]["start" | "end"];

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && WEEKDAYS.includes(value as Weekday);
}

/**
 * Normalisiert ausgeschriebene Wochentage sowie die UI-Kurzformen. Damit
 * Verfügbarkeiten auch bei importierten oder älteren Datensätzen zuverlässig
 * dem korrekten Tagesfeld zugeordnet werden.
 */
export function normalizeWeekday(value: unknown): Weekday | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("de-DE");
  const match = WEEKDAYS.find(
    day =>
      day.toLocaleLowerCase("de-DE") === normalized ||
      WEEKDAY_SHORT_LABELS[day].toLocaleLowerCase("de-DE") === normalized
  );
  return match ?? null;
}

/** Entfernt ungültige und doppelte Werte und stellt die Kalenderreihenfolge her. */
export function orderedWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  const selected = new Set(value.filter(isWeekday));
  return WEEKDAYS.filter(day => selected.has(day));
}

/** Bestehende Datensätze ohne Konfiguration bleiben mit allen Wochentagen nutzbar. */
export function eventWeekdays(value: unknown): Weekday[] {
  const selected = orderedWeekdays(value);
  return selected.length ? selected : [...WEEKDAYS];
}

type HelperAvailability = {
  willHelp: "ja" | "nein";
} &
  Partial<Record<AvailabilityField, AvailabilityValue>> &
  Partial<Record<AvailabilityTimeField, string | null>>;

export type ShiftAvailabilityLike = {
  day: Weekday | string;
  startTime?: string | null;
  endTime?: string | null;
  allowFlexibleAssignment?: boolean | null;
};

/**
 * Ein Helfer gilt als noch nicht erstkontaktiert, solange die in der
 * Veranstaltung aktiven Tage durchgängig auf dem Standardwert "?" stehen und
 * weder seine Hilfsbereitschaft noch seine Bestätigung verändert wurde.
 * Änderungen an nicht aktiven Wochentagen fließen bewusst nicht ein.
 */
type HelperFirstContactStatus = HelperAvailability & {
  confirmed: "ja" | "nein";
};

export function isHelperWithoutFirstContact(
  helper: HelperFirstContactStatus,
  activeDays: unknown
): boolean {
  return (
    helper.willHelp === "ja" &&
    helper.confirmed === "nein" &&
    eventWeekdays(activeDays).every(
      day => helper[WEEKDAY_AVAILABILITY_FIELDS[day]] === "vielleicht"
    )
  );
}

export function helperAvailableOnDay(
  helper: HelperAvailability,
  day: Weekday
): boolean {
  if (helper.willHelp !== "ja") return false;
  const value = helper[WEEKDAY_AVAILABILITY_FIELDS[day]];
  if (value !== undefined) return value === "ja";
  return (
    day === "Montag" ||
    day === "Dienstag" ||
    day === "Mittwoch" ||
    day === "Donnerstag"
  );
}

/** Liefert das gespeicherte Zeitfenster; ohne vollständige, gültige Werte gilt ganztägig. */
export function helperAvailabilityWindow(
  helper: HelperAvailability,
  day: Weekday
) {
  const fields = WEEKDAY_AVAILABILITY_TIME_FIELDS[day];
  const start = helper[fields.start]?.trim() ?? "";
  const end = helper[fields.end]?.trim() ?? "";
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes)
    return null;
  return { start, end, startMinutes, endMinutes };
}

export function helperHasTimedAvailability(
  helper: HelperAvailability,
  day: Weekday
) {
  return helperAvailabilityWindow(helper, day) !== null;
}

/**
 * Ein Helfer muss für eine zeitlich definierte Schicht den gesamten Zeitraum
 * abdecken. Ganztägige Schichten bleiben bewusst nur an den Tagesstatus
 * gebunden, weil keine belastbare Uhrzeit zum Abgleich vorliegt.
 */
export function helperAvailableForShift(
  helper: HelperAvailability,
  shift: ShiftAvailabilityLike
): boolean {
  const day = normalizeWeekday(shift.day);
  if (!day || !helperAvailableOnDay(helper, day))
    return false;
  const shiftStart = toMinutes(shift.startTime);
  const shiftEnd = toMinutes(shift.endTime);
  if (
    shiftStart === null ||
    shiftEnd === null ||
    shiftEnd <= shiftStart
  )
    return true;
  const window = helperAvailabilityWindow(helper, day);
  return !window || (shiftStart >= window.startMinutes && shiftEnd <= window.endMinutes);
}

/** Prüft eine echte Zeitüberschneidung für ausdrücklich flexible Schichten. */
export function helperAvailableForFlexibleShift(
  helper: HelperAvailability,
  shift: ShiftAvailabilityLike
): boolean {
  const day = normalizeWeekday(shift.day);
  if (!day || !helperAvailableOnDay(helper, day))
    return false;
  const shiftStart = toMinutes(shift.startTime);
  const shiftEnd = toMinutes(shift.endTime);
  if (shiftStart === null || shiftEnd === null || shiftEnd <= shiftStart)
    return true;
  const window = helperAvailabilityWindow(helper, day);
  return !window || (window.startMinutes < shiftEnd && shiftStart < window.endMinutes);
}

/** Regulär ist vollständige Abdeckung nötig; flexibel genügt Teilüberschneidung. */
export function helperEligibleForShift(
  helper: HelperAvailability,
  shift: ShiftAvailabilityLike
): boolean {
  return (
    helperAvailableForShift(helper, shift) ||
    (Boolean(shift.allowFlexibleAssignment) &&
      helperAvailableForFlexibleShift(helper, shift))
  );
}

export function helperAvailabilityWindowLabel(
  helper: HelperAvailability,
  day: Weekday
) {
  const window = helperAvailabilityWindow(helper, day);
  if (!window) return "Ganztägig verfügbar";
  return `Verfügbar: ${window.start} – ${window.end} Uhr`;
}
