import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";
import { planningTeamAccessOpenId } from "./password-auth";

const req = (headers: Record<string, string> = {}) =>
  ({ headers, socket: { remoteAddress: "127.0.0.1" } }) as any;

const delegatedUser = {
  id: 47,
  openId: planningTeamAccessOpenId(77),
  role: "user" as const,
  name: "Stellvertretung Testverein",
  email: "stellvertretung@testverein.invalid",
  sessionVersion: 1,
  avatarUrl: null,
  accountBlocked: false,
  lastSignedIn: new Date(),
};

function delegatedCaller(user = delegatedUser) {
  return appRouter.createCaller({
    user,
    req: req({
      "x-event-year": "2026",
      "x-event-id": "701",
    }),
    res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
    tenantId: "testverein-nord",
    role: "planner",
    isDefault: true,
    tenantName: "Testverein Nord e. V.",
    tenantStatus: "pilot",
    updatedAt: new Date(),
  });
  vi.spyOn(db, "isPlanningTeamAccessPasswordChangeRequired").mockResolvedValue(false);
  vi.spyOn(db, "getPlanningTeamAccessCredentialForCurrentTenant").mockResolvedValue({
    id: 77,
    label: "Stellvertretung Testverein",
    contactName: "Stellvertretung Testverein",
    email: "stellvertretung@testverein.invalid",
    modulePermissions: [],
    isTenantAdmin: true,
    passwordHash: "$2a$10$delegatedAdmin",
    mustChangePassword: false,
    sessionVersion: 1,
  } as any);
});

describe("funktionale Rechtegrenzen einer Vereinsadministrator-Stellvertretung", () => {
  it("liefert volle Vereinsrechte und den klaren Stellvertreterstatus", async () => {
    const caller = delegatedCaller();

    await expect(caller.planningTeamAccesses.myPermissions()).resolves.toEqual(
      expect.arrayContaining([
        "contacts",
        "helpers",
        "schedule",
        "preparation",
        "postprocessing",
        "materials",
        "donations",
        "finances",
        "pdf",
        "read_all",
      ])
    );
    await expect(caller.planningTeamAccesses.administrativeContext()).resolves.toEqual({
      isTenantAdmin: true,
      isPrimaryTenantAdmin: false,
    });
  });

  it("leitet den Hauptadministratorstatus nie allein aus der generischen Nutzerrolle ab", async () => {
    const technicallyAdminRoleDelegate = {
      ...delegatedUser,
      role: "admin" as const,
    };

    await expect(
      delegatedCaller(technicallyAdminRoleDelegate).planningTeamAccesses.administrativeContext()
    ).resolves.toEqual({
      isTenantAdmin: true,
      isPrimaryTenantAdmin: false,
    });
  });

  it("verweigert Rechte sofort, wenn der Zugang im aktuellen Verein nicht existiert", async () => {
    vi.spyOn(db, "getPlanningTeamAccessCredentialForCurrentTenant").mockResolvedValue(
      undefined
    );
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(true);

    await expect(
      delegatedCaller().planningTeamAccesses.myPermissions()
    ).rejects.toThrow(
      "Dieser Planungsteam-Zugang gehört nicht zum aktuell angemeldeten Verein."
    );
  });

  it("darf normale Zugänge mit eigener Passwortbestätigung verwalten", async () => {
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      { id: 19, name: "Neue Helferin" },
    ] as any);
    vi.spyOn(db, "listEventYears").mockResolvedValue([{ year: 2026 }] as any);
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 701, year: 2026, name: "Nordfest" },
    ] as any);
    const createSpy = vi.spyOn(db, "createPlanningTeamAccess").mockResolvedValue({
      id: 78,
      label: "Neue Helferin",
      isTenantAdmin: false,
      eventIds: [701],
    } as any);

    await delegatedCaller().planningTeamAccesses.create({
      label: "Neue Helferin",
      contactId: 19,
      email: "neue-helferin@testverein.invalid",
      modulePermissions: ["helpers"],
      eventIds: [701],
      password: "temporäres-sicheres-passwort",
      currentAdminPassword: "eigenes-bestaetigungs-passwort",
      isTenantAdmin: false,
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 19,
        isTenantAdmin: false,
        modulePermissions: ["helpers"],
      })
    );
  });

  it("darf weder eine weitere Stellvertretung ernennen noch eine bestehende ändern", async () => {
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      { id: 19, name: "Neue Helferin" },
    ] as any);
    vi.spyOn(db, "listEventYears").mockResolvedValue([{ year: 2026 }] as any);
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 701, year: 2026, name: "Nordfest" },
    ] as any);

    await expect(
      delegatedCaller().planningTeamAccesses.create({
        label: "Weitere Stellvertretung",
        contactId: 19,
        email: "weitere-stellvertretung@testverein.invalid",
        modulePermissions: ["helpers"],
        eventIds: [701],
        password: "temporäres-sicheres-passwort",
        currentAdminPassword: "eigenes-bestaetigungs-passwort",
        isTenantAdmin: true,
      })
    ).rejects.toThrow(
      "Nur der Vereinsadministrator darf eine administrative Stellvertretung vergeben oder ändern."
    );

    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([
      {
        id: 88,
        label: "Bestehende Stellvertretung",
        contactId: 19,
        email: "bestehend@testverein.invalid",
        modulePermissions: [],
        isTenantAdmin: true,
        eventIds: [701],
      },
    ] as any);

    await expect(
      delegatedCaller().planningTeamAccesses.remove({
        id: 88,
        currentAdminPassword: "eigenes-bestaetigungs-passwort",
      })
    ).rejects.toThrow(
      "Nur der Vereinsadministrator darf eine administrative Stellvertretung vergeben oder ändern."
    );
  });
});
