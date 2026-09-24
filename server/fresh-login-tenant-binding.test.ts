import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";

const reqWithOldRscScope = {
  headers: {
    "x-tenant-id": "rsc-eifelland-mayen",
    "x-event-year": "2026",
    "x-event-id": "1",
  },
  socket: { remoteAddress: "127.0.0.1" },
} as any;

describe("Frische persönliche Anmeldung bindet den richtigen Verein", () => {
  it("gibt für einen Bunefix-Admin trotz altem RSC-Browserheader ausschließlich Bunefix zurück", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      planningTeamLocked: false,
    } as any);
    vi.spyOn(db, "getTenantAdminCredentialsByEmail").mockResolvedValue({
      userId: 818,
      userOpenId: "tenant-admin:bunefix.admin@example.invalid",
      userName: "Bernd Bunefix",
      passwordHash: "$2a$10$hashedBunefix",
      sessionVersion: 1,
      mustChangePassword: false,
      status: "active",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    const resolveTenant = vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
      tenantId: "bunefix",
      role: "tenant_admin",
      isDefault: true,
      tenantName: "Bunefix",
      tenantStatus: "pilot",
    });

    const caller = appRouter.createCaller({
      user: null,
      req: reqWithOldRscScope,
      res: { cookie: vi.fn(), setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(
      caller.auth.passwordLogin({
        email: "bunefix.admin@example.invalid",
        password: "Bunefix-sicher-123",
      })
    ).resolves.toEqual({
      success: true,
      mustChangePassword: false,
      tenantId: "bunefix",
    });

    expect(resolveTenant).toHaveBeenCalledWith({
      userId: 818,
      userOpenId: "tenant-admin:bunefix.admin@example.invalid",
      allowPilotFallback: false,
    });
  });
});
