import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getSecuritySettings: vi.fn(),
  recordFailedPlanningTeamPasswordLogin: vi.fn(),
  clearPlanningTeamLoginFailuresIfUnlocked: vi.fn(),
  unlockPlanningTeamLogin: vi.fn(),
  lockPlanningTeamLogin: vi.fn(),
  listPlanningTeamAccessCredentials: vi.fn(),
  upsertUser: vi.fn(),
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
  clearPlanningTeamFailures,
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
        openId: `${role}-test`,
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
    clearPlanningTeamFailures("planning:127.0.0.50");
    clearPlanningTeamFailures("planning:127.0.0.99");
    clearPlanningTeamFailures("planning:10.0.0.1");
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
    dbMocks.listPlanningTeamAccessCredentials.mockResolvedValue([
      { id: 1, label: "Team", passwordHash, sessionVersion: 1 },
    ]);
  });

  it("aktiviert nach 5 Fehlversuchen eine zeitbasierte Abklingzeit (Cooldown) pro Client-Anschluss", async () => {
    dbMocks.getSecuritySettings.mockResolvedValue({
      passwordHash,
      planningTeamFailedAttempts: 0,
      planningTeamLocked: false,
    });

    const attackerCaller = appRouter.createCaller(context(null, "127.0.0.50"));
    for (let attempt = 1; attempt < PLANNING_TEAM_MAX_ATTEMPTS; attempt++) {
      await expect(
        attackerCaller.auth.passwordLogin({ password: `falsch-${attempt}` })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    // 5. Versuch löst Cooldown aus
    await expect(
      attackerCaller.auth.passwordLogin({ password: "falsch-5" })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("Zu viele Fehlversuche. Bitte warten Sie"),
    });

    // Weiterer Versuch vom selben Angreifer wird während der Abklingzeit abgewiesen
    await expect(
      attackerCaller.auth.passwordLogin({
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("Bitte warten Sie"),
    });

    // WICHTIGER DoS-SCHUTZ: Ein legitimer Nutzer von einem anderen Anschluss kann sich weiterhin einloggen!
    const legitimateCaller = appRouter.createCaller(context(null, "10.0.0.1"));
    await expect(
      legitimateCaller.auth.passwordLogin({
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).resolves.toEqual({ success: true });

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

    dbMocks.unlockPlanningTeamLogin.mockClear();
    dbMocks.lockPlanningTeamLogin.mockClear();
    const planningCaller = appRouter.createCaller(context("user"));
    await expect(
      planningCaller.auth.unlockPlanningTeamLock()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      planningCaller.auth.lockPlanningTeam()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.unlockPlanningTeamLogin).not.toHaveBeenCalled();
    expect(dbMocks.lockPlanningTeamLogin).not.toHaveBeenCalled();
  });
});
