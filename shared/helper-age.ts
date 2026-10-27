export const ISO_CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

type CalendarDay = {
  year: number;
  month: number;
  day: number;
};

function parseCalendarDay(value: string): CalendarDay | null {
  if (!ISO_CALENDAR_DAY.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  return { year, month, day };
}

function germanCalendarDay(now: Date): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/**
 * Akzeptiert ausschließlich echte Kalendertage, die nicht in der Zukunft liegen.
 * Das Datum bleibt serverintern; die Oberfläche erhält lediglich das berechnete Alter.
 */
export function isValidBirthDate(value: string, now = new Date()) {
  const birthDate = parseCalendarDay(value);
  if (!birthDate) return false;
  const today = germanCalendarDay(now);
  return (
    birthDate.year < today.year ||
    (birthDate.year === today.year &&
      (birthDate.month < today.month ||
        (birthDate.month === today.month && birthDate.day <= today.day)))
  );
}

/** Berechnet das vollendete Lebensalter nach dem deutschen Kalendertag. */
export function ageInYears(birthDate: string, now = new Date()): number | null {
  const birth = parseCalendarDay(birthDate);
  if (!birth || !isValidBirthDate(birthDate, now)) return null;
  const today = germanCalendarDay(now);
  const birthdayThisYearHasPassed =
    today.month > birth.month ||
    (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (birthdayThisYearHasPassed ? 0 : 1);
}
