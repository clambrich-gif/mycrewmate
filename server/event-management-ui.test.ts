import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Veranstaltungsverwaltung aus dem Dashboard", () => {
  it("öffnet den bestehenden Verwaltungsdialog nur über die interne UI-Schnittstelle", () => {
    const eventManager = source("client/src/lib/event-management.ts");
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const layout = source("client/src/components/Layout.tsx");

    expect(eventManager).toContain(
      'EVENT_MANAGER_OPEN_EVENT = "mycrewmate:open-event-manager"'
    );
    expect(eventManager).toContain("requestEventManagerOpen(eventId?: number)");
    expect(dashboard).toContain("requestEventManagerOpen(event.id)");
    expect(dashboard).toContain("Veranstaltungen und Zeitraum verwalten");
    expect(layout).toContain(
      "window.addEventListener(EVENT_MANAGER_OPEN_EVENT"
    );
    expect(layout).toContain('effectiveNavigationRole !== "admin"');
    expect(layout).toContain(
      "setEventManagerFocusEventId(targetEventId ?? eventId)"
    );
  });
});
