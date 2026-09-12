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

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  Montag: "Mo",
  Dienstag: "Di",
  Mittwoch: "Mi",
  Donnerstag: "Do",
  Freitag: "Fr",
  Samstag: "Sa",
  Sonntag: "So",
};

type HelperAvailability = {
  willHelp: "ja" | "nein";
  availFri: "ja" | "nein" | "vielleicht";
  availSat: "ja" | "nein" | "vielleicht";
  availSun: "ja" | "nein" | "vielleicht";
};

/**
 * Für Montag bis Donnerstag existieren in der Helferkartei bewusst keine
 * separaten Verfügbarkeitsfelder. Aktive Helfer gelten an diesen Tagen daher
 * als auswählbar; Freitag bis Sonntag verwenden weiterhin die gepflegten
 * Tagesangaben.
 */
export function helperAvailableOnDay(
  helper: HelperAvailability,
  day: Weekday
): boolean {
  if (helper.willHelp !== "ja") return false;
  if (day === "Freitag") return helper.availFri === "ja";
  if (day === "Samstag") return helper.availSat === "ja";
  if (day === "Sonntag") return helper.availSun === "ja";
  return true;
}
