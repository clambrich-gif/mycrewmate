export type EventDateRange = {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
};

export type EventCountdownState =
  | { kind: "unconfigured" }
  | { kind: "upcoming"; days: number; hours: number }
  | { kind: "live"; day: number; totalDays: number }
  | { kind: "completed" };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

/** Prüft ein kalendergültiges, zeitzonenfreies Datum aus einem Date-Input. */
export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const { year, month, day } = parts(value);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

/** Liefert eine verständliche Validierungsmeldung oder null für einen gültigen Bereich. */
export function eventDateRangeError({ startDate, endDate }: EventDateRange) {
  const start = startDate || null;
  const end = endDate || null;
  if (!start && !end) return null;
  if (!start || !end)
    return "Bitte Start- und Enddatum gemeinsam eintragen oder beide Felder leeren.";
  if (!isIsoCalendarDate(start) || !isIsoCalendarDate(end))
    return "Bitte gültige Kalenderdaten eingeben.";
  if (start > end) return "Das Enddatum darf nicht vor dem Startdatum liegen.";
  return null;
}

/** Formatiert einen gespeicherten Eventtag ohne Zeitzonenverschiebung. */
export function formatEventDate(value: string | null | undefined) {
  if (!value || !isIsoCalendarDate(value)) return "";
  const { year, month, day } = parts(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

/** Formatiert einen Eventzeitraum kurz und lesbar für Nachrichten und Hinweise. */
export function formatEventDuration({ startDate, endDate }: EventDateRange) {
  const error = eventDateRangeError({ startDate, endDate });
  if (error || !startDate || !endDate) return "an den Veranstaltungstagen";
  if (startDate === endDate) return formatEventDate(startDate);

  const start = parts(startDate);
  const end = parts(endDate);
  const twoDigits = (value: number) => String(value).padStart(2, "0");

  if (start.year === end.year && start.month === end.month) {
    return `${twoDigits(start.day)}.–${twoDigits(end.day)}.${twoDigits(end.month)}.${end.year}`;
  }
  if (start.year === end.year) {
    return `${twoDigits(start.day)}.${twoDigits(start.month)}.–${twoDigits(end.day)}.${twoDigits(end.month)}.${end.year}`;
  }
  return `${formatEventDate(startDate)}–${formatEventDate(endDate)}`;
}

function localStartOfDate(value: string) {
  const { year, month, day } = parts(value);
  return new Date(year, month - 1, day);
}

function calendarDayDistance(from: string, to: Date) {
  const { year, month, day } = parts(from);
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  const fromUtc = Date.UTC(year, month - 1, day);
  return Math.floor((toUtc - fromUtc) / DAY_MS);
}

/** Berechnet den Dashboardzustand auf Basis lokaler Kalendertage. */
export function eventCountdownState(
  range: EventDateRange,
  now = new Date()
): EventCountdownState {
  const error = eventDateRangeError(range);
  if (error || !range.startDate || !range.endDate) return { kind: "unconfigured" };

  const startsAt = localStartOfDate(range.startDate);
  const endsAfter = localStartOfDate(range.endDate);
  endsAfter.setDate(endsAfter.getDate() + 1);

  if (now < startsAt) {
    const remaining = startsAt.getTime() - now.getTime();
    return {
      kind: "upcoming",
      days: Math.floor(remaining / DAY_MS),
      hours: Math.floor((remaining % DAY_MS) / (60 * 60 * 1000)),
    };
  }
  if (now >= endsAfter) return { kind: "completed" };

  const startParts = parts(range.startDate);
  const endParts = parts(range.endDate);
  const totalDays =
    Math.floor(
      (Date.UTC(endParts.year, endParts.month - 1, endParts.day) -
        Date.UTC(startParts.year, startParts.month - 1, startParts.day)) /
        DAY_MS
    ) + 1;
  return {
    kind: "live",
    day: Math.min(totalDays, Math.max(1, calendarDayDistance(range.startDate, now) + 1)),
    totalDays,
  };
}
