import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { currentEventId, currentEventYear } from "./year-context";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Wiederherstellung einer persönlichen Veranstaltungswahl", () => {
  it("setzt einen nach Archivlöschung ungültigen Browserwert auf eine aktive Veranstaltung mit Zeitraum zurück", async () => {
    const fallbackEvent = {
      id: 1020001,
      tenantId: "rsc-eifelland-mayen",
      year: 2027,
      name: "MyEifelRide",
      startDate: "2027-06-11",
      endDate: "2027-06-13",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      status: "active",
    } as any;

    vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
      tenantId: "rsc-eifelland-mayen",
      role: "tenant_admin",
      isDefault: true,
      tenantName: "RSC Eifelland Mayen e. V.",
      tenantStatus: "pilot",
    } as any);
    vi.spyOn(db, "getCurrentTenantProductEntitlement").mockResolvedValue({
      packageId: "pro",
      isUsable: true,
      eventId: null,
    } as any);
    vi.spyOn(db, "listEventYears").mockResolvedValue([
      { year: 2027, label: "Veranstaltungsjahr 2027" },
    ] as any);
    vi.spyOn(db, "listEvents").mockImplementation(async selectedYear =>
      selectedYear === 2027 ? [fallbackEvent] : []
    );
    vi.spyOn(db, "getEvent").mockImplementation(async () =>
      currentEventId() === fallbackEvent.id &&
      currentEventYear() === fallbackEvent.year
        ? fallbackEvent
        : undefined
    );

    const caller = appRouter.createCaller({
      user: {
        id: 17,
        openId: "persoenlicher-rsc-admin",
        role: "admin",
        name: "RSC Administration",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      // Die ID 1020002 stand beispielhaft für eine endgültig entfernte
      // Altveranstaltung und darf kein Dashboard im Leerzustand festhalten.
      req: {
        headers: {
          host: "app.mycrewmate.de",
          "x-tenant-id": "rsc-eifelland-mayen",
          "x-event-year": "2027",
          "x-event-id": "1020002",
        },
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res: { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(caller.events.current()).resolves.toMatchObject({
      id: 1020001,
      year: 2027,
      startDate: "2027-06-11",
      endDate: "2027-06-13",
    });
  });
});
