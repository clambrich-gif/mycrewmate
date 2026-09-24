import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { COOKIE_NAME } from "@shared/const";
import { appRouter } from "./routers";
import * as db from "./db";

const mockReq = (headers: Record<string, string> = {}) =>
  ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  }) as any;

const tenantAdminUser = {
  id: 701,
  openId: "tenant-admin:pilot.admin@example.invalid",
  role: "admin" as const,
  name: "Pilot-Administrator",
  email: "pilot.admin@example.invalid",
  sessionVersion: 1,
  avatarUrl: null,
  accountBlocked: false,
  lastSignedIn: new Date(),
};

describe("Aktivierung persönlicher Vereinsadmins", () => {
  it("bestätigt beim Einlösen eines Bunefix-Links ausschließlich Bunefix – auch mit altem RSC-Browserheader", async () => {
    vi.spyOn(db, "consumeTenantAdminInvitation").mockResolvedValue({
      userId: 811,
      tenantId: "bunefix",
      userOpenId: "tenant-admin:guenter.bunefix@example.invalid",
      userName: "Günter Bunefix",
      sessionVersion: 1,
    } as any);
    const cookieSpy = vi.fn();
    const caller = appRouter.createCaller({
      user: null,
      req: mockReq({
        "x-tenant-id": "rsc-eifelland-mayen",
        "x-event-year": "2026",
        "x-event-id": "1",
      }),
      res: { cookie: cookieSpy, setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(
      caller.auth.consumeTenantAdminInvitation({ token: "b".repeat(48) })
    ).resolves.toEqual({
      success: true,
      tenantId: "bunefix",
      mustChangePassword: true,
    });
    expect(cookieSpy).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ maxAge: expect.any(Number) })
    );
  });

  it("blendet während der Aktivierung den alten Vereinsbildschirm vollständig aus", () => {
    const layout = readFileSync(
      path.resolve(__dirname, "../client/src/components/Layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("const isCredentialBootstrapPending");
    expect(layout).toContain("if (isCredentialBootstrapPending)");
    expect(layout).toContain("const credentialBootstrapScreen");
    expect(layout).toContain('"mycrewmate:activation-tenant"');
    expect(layout).toContain("rememberActivationTenantId(result.tenantId)");
    expect(layout).toContain("clearRememberedActivationTenantId()");
    const invitationFlow = layout.slice(
      layout.indexOf("const consumeTenantInvitation")
    );
    expect(invitationFlow.indexOf('window.history.replaceState({}, "", "/");')).toBeLessThan(
      invitationFlow.indexOf("selectTenant(result.tenantId);")
    );
  });

  it("erkennt den erzwungenen Passwortwechsel und setzt danach eine neue persönliche Sitzung", async () => {
    const requiredSpy = vi
      .spyOn(db, "isTenantAdminPasswordChangeRequired")
      .mockResolvedValue(true);
    const completeSpy = vi
      .spyOn(db, "completeTenantAdminInitialPasswordChange")
      .mockResolvedValue({
        userId: tenantAdminUser.id,
        userOpenId: tenantAdminUser.openId,
        userName: tenantAdminUser.name,
        sessionVersion: 2,
      });
    vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
      tenantId: "bunefix",
      role: "tenant_admin",
      isDefault: true,
      tenantName: "Bunefix",
      tenantStatus: "pilot",
    });
    const cookieSpy = vi.fn();
    const caller = appRouter.createCaller({
      user: tenantAdminUser,
      req: mockReq(),
      res: { cookie: cookieSpy, setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(caller.auth.initialPasswordChangeStatus()).resolves.toEqual({
      mustChangePassword: true,
    });

    await expect(
      caller.auth.completeTenantAdminInitialPasswordChange({
        password: "ein-neues-sicheres-passwort-123",
        passwordConfirmation: "ein-neues-sicheres-passwort-123",
      })
    ).resolves.toEqual({
      success: true,
      mustChangePassword: false,
      tenantId: "bunefix",
    });

    expect(requiredSpy).toHaveBeenCalledWith(tenantAdminUser.id);
    expect(completeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: tenantAdminUser.id,
        passwordHash: expect.stringMatching(/^\$2/),
      })
    );
    expect(cookieSpy).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ maxAge: expect.any(Number) })
    );
  });

  it("behandelt persönliche Vereinsadmins als Passwortsitzungen und bindet sie an ihre Zugangsversion", async () => {
    const passwordAuth = await import("./password-auth");
    const sdkSource = await import("node:fs").then(fs =>
      fs.readFileSync(new URL("./_core/sdk.ts", import.meta.url), "utf8")
    );
    const dbSource = await import("node:fs").then(fs =>
      fs.readFileSync(new URL("./db.ts", import.meta.url), "utf8")
    );

    expect(
      passwordAuth.isTenantAdminPasswordOpenId(tenantAdminUser.openId)
    ).toBe(true);
    expect(sdkSource).toContain("isTenantAdminPasswordOpenId(sessionUserId)");
    expect(dbSource).toContain('openId.startsWith("tenant-admin:")');
  });
});
