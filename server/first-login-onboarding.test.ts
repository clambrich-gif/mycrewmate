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

  it("zeigt die Klemmi-Begrüßung vor dem dauerhaften Abschluss und behält den Status bis dahin", () => {
    const onboarding = readFileSync(
      path.resolve(process.cwd(), "client/src/components/FirstLoginOnboarding.tsx"),
      "utf8"
    );
    const intro = readFileSync(
      path.resolve(process.cwd(), "client/src/components/FirstLoginKlemmiIntro.tsx"),
      "utf8"
    );

    expect(onboarding).toContain('"welcome" | "klemmi" | "co_admin"');
    expect(onboarding).toContain('setStep("klemmi")');
    expect(onboarding).toContain("open={open && step === \"klemmi\"}");
    expect(onboarding).toContain("isCoAdmin={isCoAdmin}");
    expect(onboarding).toContain("onComplete={finishKlemmiIntro}");
    expect(intro).toContain('"first-login-co-admin"');
    expect(intro).toContain("KLEMMI_CO_ADMIN_TEXT");
    expect(intro).toContain("Und nein – nicht weil ich verklemmt bin");
    expect(intro).not.toContain("Klemmi lacht über seinen eigenen Witz.");
    expect(intro).toContain("Co-Admin-Tipp:");
    expect(intro).toContain("window.setTimeout(onComplete, 360)");
  });

  it("richtet Klemmis Einstieg dynamisch am echten Hilfeschalter aus und schützt die Mobilansicht", () => {
    const intro = readFileSync(
      path.resolve(process.cwd(), "client/src/components/FirstLoginKlemmiIntro.tsx"),
      "utf8"
    );
    const css = readFileSync(path.resolve(process.cwd(), "client/src/index.css"), "utf8");
    const mascot = readFileSync(
      path.resolve(process.cwd(), "client/src/components/KlemmiMascot.tsx"),
      "utf8"
    );
    const voice = readFileSync(
      path.resolve(process.cwd(), "client/src/hooks/useKlemmiVoice.ts"),
      "utf8"
    );
    const preview = readFileSync(
      path.resolve(process.cwd(), "client/src/pages/KlemmiFirstLoginPreview.tsx"),
      "utf8"
    );

    expect(intro).toContain('"[data-klemmi-trigger]"');
    expect(intro).toContain("data-klemmi-first-login-highlight");
    expect(intro).toContain("Verstanden – danke, Klemmi!");
    expect(intro).toContain("KlemmiMascot isSpeaking={isSpeaking || externalSpeaking} decorative");
    expect(intro).toContain("klemmi-first-login-question");
    expect(intro).toContain("externalNarrationComplete");
    expect(intro).toContain("data-klemmi-finish-control");
    expect(intro).toContain("data-klemmi-mobile-caption");
    expect(intro).toContain("setNarrationComplete(true)");
    expect(intro).toContain("overflow-visible");
    expect(mascot).toContain("klemmi-face-eye");
    expect(mascot).toContain("klemmi-face-mouth");
    expect(mascot).not.toContain("<Hand");
    expect(voice).toContain("const [isSpeaking, setIsSpeaking] = useState(false)");
    expect(voice).toContain("audio.onplay = () => setIsSpeaking(true)");
    expect(css).toContain("@keyframes klemmi-first-login-enter");
    expect(css).toContain("@keyframes klemmi-first-login-question-float");
    expect(css).toContain("@keyframes klemmi-speaking-mouth");
    expect(css).toContain("Der bewegte Mund überdeckt das vorhandene Lächeln vollständig");
    expect(css).toContain(".klemmi-guide-mascot");
    expect(css).toContain("bottom: calc(100% - 0.65rem)");
    expect(css).toContain("@media (max-width: 639px)");
    expect(css).toContain(".klemmi-first-login-question {\n    display: none;");
    expect(css).toContain("[data-klemmi-finish-control][data-klemmi-narration-complete=\"false\"]");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(preview).toContain('data-klemmi-trigger="staging-preview"');
    expect(preview).toContain("Standardansicht mit Ton starten");
    expect(preview).toContain("Co-Admin-Hinweis mit Ton starten");
    expect(preview).toContain("new Audio(klemmiAudioUrl(clipId))");
    expect(preview).toContain("autoSpeak={false}");
    expect(preview).toContain("audio.onplay = () => setPreviewSpeaking(true)");
    expect(preview).toContain("externalSpeaking={previewSpeaking}");
    expect(preview).toContain("externalNarrationComplete={previewNarrationComplete}");
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
