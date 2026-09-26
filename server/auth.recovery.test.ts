import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const dbMocks = vi.hoisted(() => ({
  getSecuritySettings: vi.fn(),
  setAdminPasswordHash: vi.fn(),
  recordFailedAdminPasswordLogin: vi.fn(),
  clearAdminPasswordLoginFailures: vi.fn(),
  createAdminPasswordResetRequest: vi.fn(),
  resetAdminPasswordWithEmailToken: vi.fn(),
  upsertUser: vi.fn(),
  recordActivityLog: vi.fn(),
  getEvent: vi.fn(),
  withPlanningWriteLock: vi.fn((callback: () => unknown) => callback()),
}));
const sdkMocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
}));
const mailMocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/sdk", () => ({ sdk: sdkMocks }));
vi.mock("./mail-service", async importOriginal => {
  const actual = await importOriginal<typeof import("./mail-service")>();
  return {
    ...actual,
    sendTransactionalEmail: mailMocks.sendTransactionalEmail,
  };
});

import { appRouter } from "./routers";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.123" },
    } as any,
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as any,
  };
  return { ctx, cookies };
}

describe("auth.resetAdminWithKey (Master Recovery Key)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.setAdminPasswordHash.mockResolvedValue({ affectedRows: 1 });
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.recordActivityLog.mockResolvedValue(undefined);
    sdkMocks.createSessionToken.mockResolvedValue("test-admin-session-token");
  });

  it("lädt den gesetzten ADMIN_RECOVERY_KEY als serverseitiges Geheimnis", () => {
    expect(ENV.adminRecoveryKey).toHaveLength(16);
  });

  it("lehnt falschen Recovery Key ab, ohne Daten oder Sitzung zu ändern", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetAdminWithKey({
        recoveryKey: "falscher-key-1234",
        newPassword: "NeuesAdminPasswort2026!",
      })
    ).rejects.toThrow("Master Recovery Key ist nicht korrekt");

    expect(dbMocks.setAdminPasswordHash).not.toHaveBeenCalled();
    expect(dbMocks.upsertUser).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(0);
  });

  it("setzt bei gültigem Recovery Key das Passwort zurück und stellt eine Admin-Sitzung aus", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resetAdminWithKey({
      recoveryKey: ENV.adminRecoveryKey,
      newPassword: "NeuesSuperSicheresAdminPasswort2026!",
    });

    expect(result).toEqual({ success: true });
    expect(dbMocks.setAdminPasswordHash).toHaveBeenCalledTimes(1);
    expect(dbMocks.setAdminPasswordHash.mock.calls[0]?.[0]).not.toBe(
      "NeuesSuperSicheresAdminPasswort2026!"
    );
    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "shared-password-admin",
        role: "admin",
      })
    );
    expect(dbMocks.recordActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Zugangsschutz",
        subject: "Administratorpasswort über Recovery-Key zurückgesetzt",
      })
    );
    expect(sdkMocks.createSessionToken).toHaveBeenCalledWith(
      "shared-password-admin",
      expect.objectContaining({ expiresInMs: 43_200_000 })
    );
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      value: "test-admin-session-token",
      options: expect.objectContaining({ secure: true, httpOnly: true, path: "/" }),
    });
  });
});

describe("auth.adminPasswordLogin & Master-Reset (Sicherheitssystem mit info@mycrewmate.de)", () => {
  it("sperrt den Masterzugang nach dem 5. Fehlversuch global und verweist auf den Reset", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    dbMocks.getSecuritySettings.mockResolvedValue({
      id: 1,
      adminPasswordHash: "$2a$10$abcdefghijklmnopqrstuuNOPASSWORDMATCH",
      adminLocked: false,
      adminFailedAttempts: 0,
    } as any);

    let attempts = 0;
    dbMocks.recordFailedAdminPasswordLogin.mockImplementation(async (max = 5) => {
      attempts += 1;
      return { failedAttempts: attempts, locked: attempts >= max };
    });

    for (let i = 1; i <= 4; i += 1) {
      await expect(
        caller.auth.adminPasswordLogin({ password: `falsch-${i}` })
      ).rejects.toThrow("Administratorpasswort ist nicht korrekt");
    }

    await expect(
      caller.auth.adminPasswordLogin({ password: "falsch-5" })
    ).rejects.toThrow("Der Masterzugang ist nach fünf Fehlversuchen gesperrt");
  });

  it("versendet den Reset-Link ausschließlich an info@mycrewmate.de und akzeptiert ein neues Passwort", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    let sentTo: string | null = null;
    let capturedResetUrl: string | null = null;
    mailMocks.sendTransactionalEmail.mockImplementation(async (options: any) => {
      sentTo = options.to;
      capturedResetUrl = options.text.match(/https?:\/\/[^\s]+/)?.[0] ?? null;
      return { success: true };
    });
    dbMocks.createAdminPasswordResetRequest.mockResolvedValue({
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const requestResult = await caller.auth.requestAdminPasswordReset();
    expect(requestResult).toEqual({ accepted: true });
    expect(sentTo).toBe("info@mycrewmate.de");
    expect(capturedResetUrl).toContain("admin.mycrewmate.de");
    expect(capturedResetUrl).toContain("reset=");

    const token = new URL(capturedResetUrl!).searchParams.get("reset")!;
    expect(token).toBeTruthy();

    dbMocks.resetAdminPasswordWithEmailToken.mockResolvedValue({
      resetAt: new Date(),
    } as any);

    const resetResult = await caller.auth.resetAdminPasswordWithEmailToken({
      token,
      newPassword: "NeuesMasterSicheresPasswort2026!",
    });

    expect(resetResult).toEqual({ success: true, requiresLogin: true });
  });
});
