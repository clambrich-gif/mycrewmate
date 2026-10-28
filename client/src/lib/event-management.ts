export const EVENT_MANAGER_OPEN_EVENT = "mycrewmate:open-event-manager";

export type EventManagerOpenDetail = {
  eventId?: number;
};

/** Öffnet die zentrale Veranstaltungsverwaltung für die gewählte Veranstaltung. */
export function requestEventManagerOpen(eventId?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<EventManagerOpenDetail>(EVENT_MANAGER_OPEN_EVENT, {
      detail: { eventId },
    })
  );
}
