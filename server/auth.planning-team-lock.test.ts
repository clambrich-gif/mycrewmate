import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getSecuritySettings: vi.fn(),
  recordFailedPlanningTeamPasswordLogin: vi.fn(),
  clearPlanningTeamLoginFailuresIfUnlocked: vi.fn(),
  unlockPlanningTeamLogin: vi.fn(),
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
import { hashPassword, PLANNING_TEAM_MAX_ATTEMPTS } from "./password-auth";

let passwordHash = "";

function context(role: "user" | "admin" | null = null): TrpcContext {
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
      socket: { remoteAddress: "127.0.0.50" },
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("dauerhafte Planungsteam-Login-Sperre", () => {
  beforeAll(async () => {
    passwordHash = await hashPassword("Richtiges-Planungsteam-Passwort!");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sdkMocks.createSessionToken.mockResolvedValue("signed-session");
    presenceMocks.recordSessionPresence.mockResolvedValue(true);
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.unlockPlanningTeamLogin.mockResolvedValue({
      failedAttempts: 0,
      locked: false,
    });
  });

  it("sperrt nach fünf falschen Eingaben dauerhaft und prüft danach kein Passwort mehr", async () => {
    let failedAttempts = 0;
    let locked = false;
    dbMocks.getSecuritySettings.mockImplementation(async () => ({
      passwordHash,
      planningTeamFailedAttempts: failedAttempts,
      planningTeamLocked: locked,
    }));
    dbMocks.recordFailedPlanningTeamPasswordLogin.mockImplementation(
      async (maxAttempts: number) => {
        failedAttempts = Math.min(failedAttempts + 1, maxAttempts);
        locked = failedAttempts >= maxAttempts;
        return { failedAttempts, locked };
      }
    );

    const caller = appRouter.createCaller(context());
    for (let attempt = 1; attempt < PLANNING_TEAM_MAX_ATTEMPTS; attempt++) {
      await expect(
        caller.auth.passwordLogin({ password: `falsch-${attempt}` })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      caller.auth.passwordLogin({ password: "falsch-5" })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("Administrator muss die Sperre aufheben"),
    });
    await expect(
      caller.auth.passwordLogin({
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    expect(dbMocks.recordFailedPlanningTeamPasswordLogin).toHaveBeenCalledTimes(
      PLANNING_TEAM_MAX_ATTEMPTS
    );
    expect(dbMocks.clearPlanningTeamLoginFailuresIfUnlocked).not.toHaveBeenCalled();
    expect(sdkMocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("verhindert eine Anmeldung, wenn die Sperre während der Passwortprüfung gesetzt wird", async () => {
    dbMocks.getSecuritySettings.mockResolvedValue({
      passwordHash,
      planningTeamFailedAttempts: 4,
      planningTeamLocked: false,
    });
    dbMocks.clearPlanningTeamLoginFailuresIfUnlocked.mockResolvedValue(false);

    const caller = appRouter.createCaller(context());
    await expect(
      caller.auth.passwordLogin({
        password: "Richtiges-Planungsteam-Passwort!",
      })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("Administrator muss die Sperre aufheben"),
    });
    expect(sdkMocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("lässt ausschließlich Administratoren die Planungsteam-Sperre aufheben", async () => {
    const adminCaller = appRouter.createCaller(context("admin"));
    await expect(adminCaller.auth.unlockPlanningTeamLock()).resolves.toEqual({
      success: true,
    });
    expect(dbMocks.unlockPlanningTeamLogin).toHaveBeenCalledTimes(1);

    dbMocks.unlockPlanningTeamLogin.mockClear();
    const planningCaller = appRouter.createCaller(context("user"));
    await expect(
      planningCaller.auth.unlockPlanningTeamLock()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.unlockPlanningTeamLogin).not.toHaveBeenCalled();
  });
});
