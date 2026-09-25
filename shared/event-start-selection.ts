import { isIsoCalendarDate } from "./event-dates";

export const EVENT_START_SELECTION_SESSION_PREFIX =
  "mycrewmate:event-start-selection:";

export function eventStartSelectionSessionKey(tenantId: string) {
  return `${EVENT_START_SELECTION_SESSION_PREFIX}${tenantId}`;
}

export type StartSelectableEvent = {
  id: number;
  year: number;
  name: string;
  startDate: string | null | undefined;
};

/**
 * Ermittelt aus den für einen Zugang freigegebenen Veranstaltungen die nächste
 * Veranstaltung mit gültigem Startdatum. Der heutige Kalendertag zählt als
 * bevorstehender Starttag, vergangene oder undatierte Einträge nicht.
 */
export function nearestUpcomingEvent<T extends StartSelectableEvent>(
  events: readonly T[],
  today = new Date()
): T | null {
  const calendarToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const candidates = events.filter(
    event =>
      typeof event.startDate === "string" &&
      isIsoCalendarDate(event.startDate) &&
      event.startDate >= calendarToday
  );

  if (candidates.length === 0) return null;

  return [...candidates].sort(
    (left, right) =>
      left.startDate!.localeCompare(right.startDate!) ||
      left.name.localeCompare(right.name, "de") ||
      left.id - right.id
  )[0];
}
