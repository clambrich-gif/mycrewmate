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

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && WEEKDAYS.includes(value as Weekday);
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
} & Partial<Record<AvailabilityField, AvailabilityValue>>;

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
