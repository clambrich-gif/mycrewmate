import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { planningTeamAccessOpenId } from "./password-auth";

const mockReq = (headers: Record<string, string> = {}) =>
  ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  }) as any;

describe("Erst-Login-Onboarding", () => {
  beforeEach(() => {
    vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
      tenantId: "rsc-eifelland-mayen",
      role: "planner",
      isDefault: true,
      tenantName: "RSC Eifelland Mayen e. V.",
      tenantStatus: "pilot",
    });
    vi.spyOn(db, "getPlanningTeamAccessTenantId").mockResolvedValue(
      "rsc-eifelland-mayen"
    );
    vi.spyOn(db, "getUserByOpenId").mockImplementation(async openId => ({
      id: 990,
      openId,
    }) as any);
  });

  it("lässt den Willkommenshinweis automatisch erst nach 15 Sekunden weiterlaufen", () => {
    const component = readFileSync(
      path.resolve(process.cwd(), "client/src/components/FirstLoginOnboarding.tsx"),
      "utf8"
    );

    expect(component).toContain("const WELCOME_DURATION_MS = 15_000;");
    expect(component).toContain("elapsed >= WELCOME_DURATION_MS");
  });

  it("liefert pending true für ein neues Planungsteam-Konto mit ausstehendem Onboarding", async () => {
    vi.spyOn(db, "getPlanningTeamAccessCredentialForCurrentTenant").mockResolvedValue({
      id: 42,
      email: "peter.lustig@example.com",
      name: "Peter Lustig",
      tenantId: "rsc-eifelland-mayen",
      permissions: {
        contacts: true,
        helpers: true,
        assignments: true,
        preparation: true,
        postprocessing: true,
        materials: true,
        donations: true,
        finances: true,
        pdf: true,
      },
      mustChangePassword: false,
      initialPasswordActive: false,
      isTenantAdmin: true,
      onboardingPending: true,
      passwordHash: "hash",
      sessionVersion: 1,
    });

    const caller = appRouter.createCaller({
      user: {
        id: 42,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "Peter Lustig",
        email: "peter.lustig@example.com",
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const status = await caller.auth.firstLoginOnboardingStatus();
    expect(status).toEqual({
      pending: true,
      name: "Peter Lustig",
      isCoAdmin: true,
    });
  });

  it("markiert das Onboarding über completeFirstLoginOnboarding dauerhaft als abgeschlossen", async () => {
    const completeSpy = vi
      .spyOn(db, "completePlanningTeamOnboarding")
      .mockResolvedValue(true);

    const caller = appRouter.createCaller({
      user: {
        id: 42,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "Peter Lustig",
        email: "peter.lustig@example.com",
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await caller.auth.completeFirstLoginOnboarding();
    expect(result).toEqual({ success: true });
    expect(completeSpy).toHaveBeenCalledWith(42, "rsc-eifelland-mayen");
  });

  it("liefert pending false für Konten ohne ausstehendes Onboarding", async () => {
    vi.spyOn(db, "getPlanningTeamAccessCredentialForCurrentTenant").mockResolvedValue({
      id: 42,
      email: "peter.lustig@example.com",
      name: "Peter Lustig",
      tenantId: "rsc-eifelland-mayen",
      permissions: {
        contacts: false,
        helpers: true,
        assignments: false,
        preparation: false,
        postprocessing: false,
        materials: false,
        donations: false,
        finances: false,
        pdf: false,
      },
      mustChangePassword: false,
      initialPasswordActive: false,
      isTenantAdmin: false,
      onboardingPending: false,
      passwordHash: "hash",
      sessionVersion: 1,
    });

    const caller = appRouter.createCaller({
      user: {
        id: 42,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "Peter Lustig",
        email: "peter.lustig@example.com",
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const status = await caller.auth.firstLoginOnboardingStatus();
    expect(status).toEqual({
      pending: false,
      name: "Peter Lustig",
      isCoAdmin: false,
    });
  });
});
