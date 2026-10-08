import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";
import { ADMIN_PASSWORD_OPEN_ID } from "./password-auth";

const mockReq = (headers: Record<string, string> = {}) =>
  ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  }) as any;

const eventPassEntitlement = {
  packageId: "event_pass",
  status: "active",
  startsOn: null,
  endsOn: null,
  eventId: 73,
  isUsable: true,
  entitlements: {
    maxPersonalPlanningAccesses: 0,
  },
} as any;

function adminCaller() {
  return appRouter.createCaller({
    user: {
      id: 1,
      openId: ADMIN_PASSWORD_OPEN_ID,
      role: "admin",
      name: "Vereinsadministration",
      email: null,
      loginMethod: "password",
      sessionVersion: 1,
      avatarUrl: null,
      accountBlocked: false,
      lastSignedIn: new Date(),
    },
    req: mockReq({ "x-event-year": "2027", "x-event-id": "73" }),
    res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
  });
}

beforeEach(() => {
  vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
    tenantId: "verein-am-rad",
    role: "tenant_admin",
    isDefault: true,
    tenantName: "Verein am Rad e. V.",
    tenantStatus: "active",
  } as any);
  vi.spyOn(db, "getCurrentTenantProductEntitlement").mockResolvedValue(
    eventPassEntitlement
  );
  vi.spyOn(db, "getTenant").mockResolvedValue({
    id: "verein-am-rad",
    name: "Verein am Rad e. V.",
  } as any);
  vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
    adminPasswordHash: "$2a$10$hashed-admin",
  } as any);
  vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
  vi.spyOn(passwordAuth, "hashPassword").mockResolvedValue("$2a$10$hashed-team" as any);
  vi.spyOn(db, "recordActivityLog").mockResolvedValue(undefined as any);
});

describe("Gemeinsamer Event-Pass-Teamzugang", () => {
  it("zeigt eine neutrale Teamkennung statt einer privaten E-Mail-Adresse", async () => {
    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([]);

    await expect(adminCaller().eventPassSharedAccess.status()).resolves.toMatchObject({
      configured: false,
      identifier: "eventpass-verein-am-rad",
      eventId: 73,
    });
  });

  it("legt genau einen veranstaltungsgebundenen Teamzugang ohne Ansprechpartner an", async () => {
    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([]);
    const createSpy = vi.spyOn(db, "createPlanningTeamAccess").mockResolvedValue({
      id: 91,
    } as any);

    const result = await adminCaller().eventPassSharedAccess.save({
      password: "sicheres-teamkennwort-2027",
      passwordConfirmation: "sicheres-teamkennwort-2027",
      currentAdminPassword: "admin-passwort-2027",
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Gemeinsamer Event-Pass-Zugang",
        contactId: null,
        email: "eventpass-verein-am-rad",
        eventIds: [73],
        isSharedEventPassAccess: true,
        mustChangePassword: false,
      })
    );
    expect(result).toEqual({
      success: true,
      identifier: "eventpass-verein-am-rad",
      replacedExistingAccess: false,
    });
  });

  it("ersetzt beim Kennwortwechsel den bestehenden Zugang und erhöht damit dessen Sitzungsstand", async () => {
    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([
      {
        id: 91,
        contactId: null,
        contactName: null,
        label: "Gemeinsamer Event-Pass-Zugang",
        email: "eventpass-verein-am-rad",
        modulePermissions: [],
        moduleAccess: {},
        isTenantAdmin: false,
        eventIds: [73],
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
    const updateSpy = vi.spyOn(db, "updatePlanningTeamAccess").mockResolvedValue({
      id: 91,
    } as any);

    const result = await adminCaller().eventPassSharedAccess.save({
      password: "neues-sicheres-teamkennwort-2027",
      passwordConfirmation: "neues-sicheres-teamkennwort-2027",
      currentAdminPassword: "admin-passwort-2027",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 91,
        contactId: null,
        eventIds: [73],
        passwordHash: "$2a$10$hashed-team",
      })
    );
    expect(result.replacedExistingAccess).toBe(true);
  });

  it("akzeptiert keine abweichende Kennwortwiederholung", async () => {
    await expect(
      adminCaller().eventPassSharedAccess.save({
        password: "sicheres-teamkennwort-2027",
        passwordConfirmation: "abweichendes-teamkennwort-2027",
        currentAdminPassword: "admin-passwort-2027",
      })
    ).rejects.toThrow("Die beiden Passwörter stimmen nicht überein.");
  });
});
