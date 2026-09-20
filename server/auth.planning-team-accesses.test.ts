import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";
import {
  ADMIN_PASSWORD_OPEN_ID,
  planningTeamAccessOpenId,
  SHARED_PASSWORD_OPEN_ID,
} from "./password-auth";

const mockReq = (headers: Record<string, string> = {}) =>
  ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  }) as any;

describe("Event-based Access Control für Planungsteam", () => {
  it("filtert Veranstaltungen für Administratoren uneingeschränkt und für Planungsteam strikt nach Freigaben", async () => {
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide 2027" } as any,
      { id: 11, year: 2027, name: "Sommerfest 2027" } as any,
    ]);
    vi.spyOn(db, "listEventsForPlanningTeamAccess").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide 2027" } as any,
    ]);

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const planerCaller = appRouter.createCaller({
      user: {
        id: 2,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "EifelRide Team 2027",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const adminEvents = await adminCaller.events.list({ year: 2027 });
    expect(adminEvents.map(e => e.id)).toEqual([10, 11]);

    const planerEvents = await planerCaller.events.list({ year: 2027 });
    expect(planerEvents.map(e => e.id)).toEqual([10]);
  });

  it("sperrt nicht freigegebene Veranstaltungen serverseitig für das Planungsteam", async () => {
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(false);
    vi.spyOn(db, "listContacts").mockResolvedValue([]);

    const planerCaller = appRouter.createCaller({
      user: {
        id: 2,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "EifelRide Team 2027",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq({
        "x-event-year": "2027",
        "x-event-id": "11",
      }),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(planerCaller.contacts.list()).rejects.toThrow(
      "Dieser Planungsteam-Zugang ist für die gewählte Veranstaltung nicht freigegeben."
    );
  });

  it("weist alte globale Planungsteam-Sitzungen zurück, damit sie keine Eventfreigaben umgehen", async () => {
    const legacyCaller = appRouter.createCaller({
      user: {
        id: 2,
        openId: SHARED_PASSWORD_OPEN_ID,
        role: "user",
        name: "Altes Planungsteam",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(legacyCaller.events.list({ year: 2027 })).rejects.toThrow(
      "Dieser Planungsteam-Zugang wurde ersetzt. Bitte erneut anmelden."
    );
  });

  it("verlangt für das Anlegen und Bearbeiten von Planungsteam-Zugängen das Administratorpasswort", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      adminPasswordHash: "$2a$10$hashedadminpassword",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(false);

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(
      adminCaller.planningTeamAccesses.create({
        label: "Neues Team",
        password: "sicheres-passwort-123",
        eventIds: [10],
        currentAdminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort ist nicht korrekt");
  });
});
