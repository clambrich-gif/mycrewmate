import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getSecuritySettings: vi.fn(),
  recordFailedPlanningTeamPasswordLogin: vi.fn(),
  clearPlanningTeamLoginFailuresIfUnlocked: vi.fn(),
  unlockPlanningTeamLogin: vi.fn(),
  lockPlanningTeamLogin: vi.fn(),
  recordActivityLog: vi.fn(),
  getTenantAdminCredentialsByEmail: vi.fn(),
  listPlanningTeamAccessCredentialsByEmail: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  resolveTenantForUser: vi.fn(),
  getPlanningTeamAccessTenantId: vi.fn(),
}));
const presenceMocks = vi.hoisted(() => ({
  getOnlinePresenceCounts: vi.fn(),
  recordSessionPresence: vi.fn(),
  removeSessionPresence: vi.fn(),
}));
const sdkMocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./session-presence", () => presenceMocks);
vi.mock("./_core/sdk", () => ({ sdk: sdkMocks }));

import { appRouter } from "./routers";
import {
  ADMIN_PASSWORD_OPEN_ID,
  clearPasswordLoginFailures,
  hashPassword,
  PLANNING_TEAM_MAX_ATTEMPTS,
} from "./password-auth";

let passwordHash = "";

function context(
  role: "user" | "admin" | null = null,
  remoteAddress = "127.0.0.50"
): TrpcContext {
  const user = role
    ? {
        id: role === "admin" ? 1 : 2,
        openId: role === "admin" ? ADMIN_PASSWORD_OPEN_ID : `${role}-test`,
        name: role === "admin" ? "Administrator" : "Planungsteam",
        email: null,
        loginMethod: "test",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress },
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("DoS-Schutz und manuelle Sperre für das Planungsteam", () => {
  beforeAll(async () => {
    passwordHash = await hashPassword("Richtiges-Planungsteam-Passwort!");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearPasswordLoginFailures("personal:127.0.0.50");
    clearPasswordLoginFailures("personal:127.0.0.99");
    clearPasswordLoginFailures("personal:10.0.0.1");
    sdkMocks.createSessionToken.mockResolvedValue("signed-session");
    presenceMocks.recordSessionPresence.mockResolvedValue(true);
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.unlockPlanningTeamLogin.mockResolvedValue({
      failedAttempts: 0,
      locked: false,
    });
    dbMocks.lockPlanningTeamLogin.mockResolvedValue({
      locked: true,
    });
    dbMocks.recordActivityLog.mockResolvedValue(undefined);
    dbMocks.getTenantAdminCredentialsByEmail.mockResolvedValue(undefined);
    dbMocks.getPlanningTeamAccessTenantId.mockResolvedValue("rsc-eifelland-mayen");
    dbMocks.listPlanningTeamAccessCredentialsByEmail.mockResolvedValue([{
      id: 1,
      label: "Team",
      email: "team@example.invalid",
      passwordHash,
      sessionVersion: 1,
    }]);
    dbMocks.getUserByOpenId.mockImplementation(async (openId: string) => ({
      id: 11,
      openId,
    }));
    dbMocks.resolveTenantForUser.mockResolvedValue({
      tenantId: "rsc-eifelland-mayen",
      role: "planner",
      isDefault: true,
      tenantName: "RSC Eifelland Mayen e. V.",
      tenantStatus: "pilot",
    });
  });

  it("aktiviert nach 5 Fehlversuchen eine zeitbasierte Abklingzeit (Cooldown) pro Client-Anschluss", async () => {
    dbMocks.getSecuritySettings.mockResolvedValue({
      passwordHash,
      planningTeamFailedAttempts: 0,
      planningTeamLocked: false,
    });

    const attackerCaller = appRouter.createCaller(context(null, "127.0.0.50"));
    for (let attempt = 1; attempt <= PLANNING_TEAM_MAX_ATTEMPTS; attempt++) {
      await expect(
        attackerCaller.auth.passwordLogin({
          email: "team@example.invalid",
          password: `falsch-${attempt}`,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    // Der nächste Versuch löst den gemeinsamen 15-Minuten-Cooldown aus.
    await expect(
      attackerCaller.auth.passwordLogin({
        email: "team@example.invalid",
        password: "falsch-6",
      })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("Zu viele Fehlversuche"),
    });

    // Weiterer Versuch vom selben Angreifer wird während der Abklingzeit abgewiesen
    await expect(
      attackerCaller.auth.passwordLogin({
        email: "team@example.invalid",
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("Zu viele Fehlversuche"),
    });

    // WICHTIGER DoS-SCHUTZ: Ein legitimer Nutzer von einem anderen Anschluss kann sich weiterhin einloggen!
    const legitimateCaller = appRouter.createCaller(context(null, "10.0.0.1"));
    await expect(
      legitimateCaller.auth.passwordLogin({
        email: "team@example.invalid",
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).resolves.toEqual({
      success: true,
      tenantId: "rsc-eifelland-mayen",
    });

    expect(sdkMocks.createSessionToken).toHaveBeenCalledTimes(1);
  });

  it("blockiert alle Anmeldungen, wenn ein Administrator den Zugang gezielt manuell gesperrt hat", async () => {
    dbMocks.getSecuritySettings.mockResolvedValue({
      passwordHash,
      planningTeamFailedAttempts: 0,
      planningTeamLocked: true,
    });

    const caller = appRouter.createCaller(context(null, "10.0.0.1"));
    await expect(
      caller.auth.passwordLogin({
        email: "team@example.invalid",
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("durch einen Administrator gesperrt"),
    });
    expect(sdkMocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("lässt ausschließlich Administratoren die Planungsteam-Sperre manuell verhängen und aufheben", async () => {
    const adminCaller = appRouter.createCaller(context("admin"));
    await expect(adminCaller.auth.lockPlanningTeam()).resolves.toEqual({
      success: true,
    });
    expect(dbMocks.lockPlanningTeamLogin).toHaveBeenCalledTimes(1);

    await expect(adminCaller.auth.unlockPlanningTeamLock()).resolves.toEqual({
      success: true,
    });
    expect(dbMocks.unlockPlanningTeamLogin).toHaveBeenCalledTimes(1);
    expect(dbMocks.recordActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Zugangsschutz",
        subject: expect.stringContaining("aufgehoben"),
      })
    );

    dbMocks.unlockPlanningTeamLogin.mockClear();
    dbMocks.lockPlanningTeamLogin.mockClear();
    dbMocks.recordActivityLog.mockClear();
    const planningCaller = appRouter.createCaller(context("user"));
    await expect(
      planningCaller.auth.unlockPlanningTeamLock()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      planningCaller.auth.lockPlanningTeam()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.unlockPlanningTeamLogin).not.toHaveBeenCalled();
    expect(dbMocks.lockPlanningTeamLogin).not.toHaveBeenCalled();
    expect(dbMocks.recordActivityLog).not.toHaveBeenCalled();
  });
});
