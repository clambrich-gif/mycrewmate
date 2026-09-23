import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";
import { ADMIN_PASSWORD_OPEN_ID } from "./password-auth";

const PUMBA_TENANT = "testverein-pumba";
const PUMBA_EVENT_ID = 601;
const RSC_EVENT_ID = 701;

const mockReq = (headers: Record<string, string> = {}) =>
  ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  }) as any;

function adminCaller() {
  return appRouter.createCaller({
    user: {
      id: 44,
      openId: ADMIN_PASSWORD_OPEN_ID,
      role: "admin",
      name: "Pumba-Administration",
      email: null,
      sessionVersion: 1,
      avatarUrl: null,
      accountBlocked: false,
      lastSignedIn: new Date(),
    },
    req: mockReq({
      "x-tenant-id": PUMBA_TENANT,
      "x-event-year": "2027",
      "x-event-id": String(PUMBA_EVENT_ID),
    }),
    res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
  });
}

function preparePumbaScope() {
  vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
    tenantId: PUMBA_TENANT,
    tenantName: "Testverein Pumba",
    tenantStatus: "pilot",
    role: "tenant_admin",
    isDefault: true,
  } as any);
  vi.spyOn(db, "listEventYears").mockResolvedValue([
    { year: 2027, label: "2027" },
  ] as any);
  vi.spyOn(db, "listEvents").mockResolvedValue([
    { id: PUMBA_EVENT_ID, year: 2027, name: "Pumba-Vereinsfest" },
  ] as any);
  vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
    adminPasswordHash: "$2a$10$hashedAdmin",
  } as any);
  vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
  vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async callback =>
    callback()
  );
}

describe("Mandantenisolation – Planungsteamzugänge", () => {
  it("liefert in der Pumba-Zugangsverwaltung ausschließlich Pumba-Ansprechpartner", async () => {
    preparePumbaScope();
    const pumbaContacts = [
      {
        id: 501,
        name: "Pia Pumba",
        email: "pia.pumba@example.invalid",
        year: 2027,
        eventId: PUMBA_EVENT_ID,
        eventName: "Pumba-Vereinsfest",
      },
    ];
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue(
      pumbaContacts as any
    );

    await expect(
      adminCaller().planningTeamAccesses.availableContacts()
    ).resolves.toEqual(pumbaContacts);
  });

  it("weist einen RSC-Ansprechpartner beim Anlegen eines Pumba-Zugangs serverseitig ab", async () => {
    preparePumbaScope();
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      {
        id: 501,
        name: "Pia Pumba",
        email: "pia.pumba@example.invalid",
        year: 2027,
        eventId: PUMBA_EVENT_ID,
        eventName: "Pumba-Vereinsfest",
      },
    ] as any);
    const createAccess = vi.spyOn(db, "createPlanningTeamAccess");

    await expect(
      adminCaller().planningTeamAccesses.create({
        label: "Peter Lustig",
        contactId: 101,
        email: "peter.lustig@example.invalid",
        password: "SicheresPasswort!123",
        eventIds: [PUMBA_EVENT_ID],
        currentAdminPassword: "admin-passwort",
      })
    ).rejects.toThrow("Der ausgewählte Ansprechpartner gehört nicht zum aktuellen Verein.");
    expect(createAccess).not.toHaveBeenCalled();
  });

  it("weist eine RSC-Veranstaltung beim Anlegen eines Pumba-Zugangs serverseitig ab", async () => {
    preparePumbaScope();
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      {
        id: 501,
        name: "Pia Pumba",
        email: "pia.pumba@example.invalid",
        year: 2027,
        eventId: PUMBA_EVENT_ID,
        eventName: "Pumba-Vereinsfest",
      },
    ] as any);
    const createAccess = vi.spyOn(db, "createPlanningTeamAccess");

    await expect(
      adminCaller().planningTeamAccesses.create({
        label: "Pia Pumba",
        contactId: 501,
        email: "pia.pumba@example.invalid",
        password: "SicheresPasswort!123",
        eventIds: [RSC_EVENT_ID],
        currentAdminPassword: "admin-passwort",
      })
    ).rejects.toThrow("Mindestens eine ausgewählte Veranstaltung gehört nicht zum aktuellen Verein.");
    expect(createAccess).not.toHaveBeenCalled();
  });

  it("erteilt eine Berechtigung nur für den eigenen Ansprechpartner und die eigene Veranstaltung", async () => {
    preparePumbaScope();
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      {
        id: 501,
        name: "Pia Pumba",
        email: "pia.pumba@example.invalid",
        year: 2027,
        eventId: PUMBA_EVENT_ID,
        eventName: "Pumba-Vereinsfest",
      },
    ] as any);
    const createAccess = vi.spyOn(db, "createPlanningTeamAccess").mockResolvedValue({
      id: 901,
      contactId: 501,
      label: "Pia Pumba",
      eventIds: [PUMBA_EVENT_ID],
    } as any);

    await adminCaller().planningTeamAccesses.create({
      label: "Pia Pumba",
      contactId: 501,
      email: "pia.pumba@example.invalid",
      password: "SicheresPasswort!123",
      eventIds: [PUMBA_EVENT_ID],
      currentAdminPassword: "admin-passwort",
    });

    expect(createAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 501,
        eventIds: [PUMBA_EVENT_ID],
      })
    );
  });

  it("verankert die Datenbankabfragen und E-Mail-Regeln zusätzlich serverseitig", () => {
    const database = readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
    const schema = readFileSync(path.resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const router = readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");

    expect(database).toContain("eq(events.tenantId, tenant())");
    expect(database).toContain("requirePlanningTeamAccessForTenant");
    expect(database).toContain("assertNoPlanningTeamEmailConflict");
    expect(database).toContain("Ein Planungsteam-Zugang muss genau einem Verein zugeordnet sein");
    expect(schema).toContain("planning_team_access_email_unique");
    expect(router).toContain("assertPlanningTeamAccessReferencesInScope");
    expect(router).toContain("list: tenantAccessAdminProcedure.query(() => db.listPlanningTeamAccesses())");
  });
});
