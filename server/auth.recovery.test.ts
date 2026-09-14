import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const dbMocks = vi.hoisted(() => ({
  getSecuritySettings: vi.fn(),
  setAdminPasswordHash: vi.fn(),
  upsertUser: vi.fn(),
  getEvent: vi.fn(),
  withPlanningWriteLock: vi.fn((callback: () => unknown) => callback()),
}));
const sdkMocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/sdk", () => ({ sdk: sdkMocks }));

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
