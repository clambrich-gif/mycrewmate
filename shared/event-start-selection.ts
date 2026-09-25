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
 * Veranstaltung mit gültigem, zum Veranstaltungsjahr passendem Startdatum.
 * Der heutige Kalendertag zählt als bevorstehender Starttag, vergangene,
 * undatierte oder jahrfremd datierte Einträge nicht.
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
      event.startDate.startsWith(String(event.year)) &&
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

/**
 * Legt beim ersten Start eines persönlichen Zugangs immer einen gültigen
 * Veranstaltungs-Kontext fest. Gibt es keine datierte Zukunftsveranstaltung
 * (typisch bei frisch angelegten oder undatierten Testevents), wird stabil die
 * erste tatsächlich freigegebene Veranstaltung gewählt. Dadurch bleibt der
 * veranstaltungsgebundene Team-Chat nie auf einem alten Browser-Event stehen.
 */
export function initialAccessibleEvent<T extends StartSelectableEvent>(
  events: readonly T[],
  today = new Date()
): T | null {
  const upcoming = nearestUpcomingEvent(events, today);
  if (upcoming) return upcoming;
  if (events.length === 0) return null;
  return [...events].sort(
    (left, right) =>
      left.year - right.year ||
      left.name.localeCompare(right.name, "de") ||
      left.id - right.id
  )[0];
}
