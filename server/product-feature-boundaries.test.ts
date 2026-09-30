import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWhatsAppShareUrl } from "../client/src/lib/whatsappShare";
import { productAllowsCapability } from "../shared/product-packages";

const source = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Produktgrenzen: Marke, WhatsApp und Event-Sicherung", () => {
  it("hält individuelles Branding und automatische WhatsApp-Vorlagen bis Pro gesperrt", () => {
    for (const packageId of ["event_pass", "light"] as const) {
      expect(productAllowsCapability(packageId, "custom_branding")).toBe(false);
      expect(productAllowsCapability(packageId, "whatsapp_templates")).toBe(
        false
      );
    }
    expect(productAllowsCapability("pro", "custom_branding")).toBe(true);
    expect(productAllowsCapability("pro", "whatsapp_templates")).toBe(true);
    expect(productAllowsCapability("enterprise", "custom_branding")).toBe(true);
    expect(productAllowsCapability("enterprise", "whatsapp_templates")).toBe(
      true
    );
  });

  it("öffnet bei einer leeren WhatsApp-Nachricht einen wirklich leeren Zielchat", () => {
    expect(buildWhatsAppShareUrl("", "0171 1234567")).toBe(
      "https://wa.me/491711234567"
    );
    expect(buildWhatsAppShareUrl("", null)).toBe("https://wa.me/");
    expect(buildWhatsAppShareUrl("Hallo", "0171 1234567")).toBe(
      "https://wa.me/491711234567?text=Hallo"
    );
  });

  it("erzwingt Marken- und Vorlagengrenzen auf dem Server und im PDF-Renderer", () => {
    const router = source("server/routers.ts");
    const pdf = source("server/pdf.ts");

    expect(router).toContain(
      'productCapabilityAdminProcedure("custom_branding")'
    );
    expect(router).toContain(`productAllowsCapability(
          product.packageId,
          "whatsapp_templates"`);
    expect(router).toContain("logoFallback: allowsCustomBranding");
    expect(pdf).toContain(`productAllowsCapability(
    product.packageId,
    "custom_branding"`);
    expect(pdf).toContain("loadMyCrewMateWordmarkBuffer()");
    expect(pdf).toContain("shouldUseMyCrewMateWordmark");
    expect(pdf).toContain("hasCustomEventLogo: Boolean(logoBuffer)");
    expect(pdf).toContain("const CUSTOM_EVENT_LOGO_STANDARD_SIZE = 128");
    expect(pdf).toContain("const CUSTOM_EVENT_LOGO_COMPACT_SIZE = 78");
    expect(pdf).toContain(
      "const logoWidth = usesMyCrewMateWordmark ? 172 : CUSTOM_EVENT_LOGO_STANDARD_SIZE"
    );
    expect(pdf).toContain(
      "const logoWidth = usesMyCrewMateWordmark ? 172 : CUSTOM_EVENT_LOGO_COMPACT_SIZE"
    );
    expect(pdf).toContain("const logoSafeHeaderHeight = usesMyCrewMateWordmark");
    expect(pdf).toContain("? logoHeight + 8");
    expect(pdf).toContain("function helperPdfLocationLink(");
    expect(pdf).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(pdf).toContain(
      'const MYCREWMATE_PDF_TAGLINE = "Gemeinsam planen. Entspannt veranstalten."'
    );
    expect(pdf).toContain("const MYCREWMATE_PDF_FOOTER");
  });

  it("zeigt auf der Oberfläche Sperren, ohne den direkten WhatsApp-Kontakt zu sperren", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(pdfExport).toContain("Frei konfigurierbares Logo ab Pro verfügbar");
    expect(pdfExport).toContain("WhatsApp-Vorlagen mit Platzhaltern ab Pro");
    expect(helpers).toContain(
      'buildWhatsAppShareUrl("", whatsAppTargetHelper.phone)'
    );
    expect(helpers).toContain("WhatsApp-Chat öffnen");
    expect(dashboard).toContain("Eigenes Eventlogo ab Pro verfügbar");
  });

  it("bindet die Event-Pass-Sicherung nur an die begrenzte Sicherungsfreigabe", () => {
    expect(productAllowsCapability("event_pass", "event_backup")).toBe(true);
    expect(productAllowsCapability("event_pass", "excel")).toBe(false);
    expect(productAllowsCapability("event_pass", "project_backup")).toBe(false);
    expect(productAllowsCapability("light", "event_backup")).toBe(false);
    const router = source("server/routers.ts");
    const saveLoad = source("client/src/components/SaveLoadModal.tsx");

    expect(router).toContain("requireBackupCapability");
    expect(router).toContain(
      'capability === "project_backup" ? "event_backup" : "excel"'
    );
    expect(saveLoad).toContain("const canUseExcel = productAllowsCapability(");
    expect(saveLoad).toContain("{canUseExcel && (");
    expect(source("client/src/components/Layout.tsx")).toContain(
      "<LazySaveLoadControls"
    );
  });

  it("stellt die globale Klemmi-Stummschaltung bereit, ohne Texte auszublenden", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const greeting = source("client/src/components/KlemmiLoginGreeting.tsx");
    const voice = source("client/src/hooks/useKlemmiVoice.ts");
    const muteState = source("client/src/lib/dashboard-klemmi-muted.ts");
    const helperGuide = source("client/src/components/KlemmiHelperGuide.tsx");

    expect(dashboard).toContain("Klemmi-Stimme stummschalten");
    expect(dashboard).toContain("persistKlemmiMuted(next)");
    expect(layout).toContain("KLEMMI_MUTE_EVENT");
    expect(greeting).toContain("muted?: boolean");
    expect(voice).toContain("onMutedChange?: (muted: boolean) => void");
    expect(voice).toContain("getKlemmiMuted");
    expect(voice).toContain("window.addEventListener(KLEMMI_MUTE_EVENT");
    expect(voice).toContain("if (muted) cancel();");
    expect(helperGuide).toContain("useKlemmiVoice()");
    expect(muteState).toContain('"mycrewmate:klemmi-muted"');
    expect(muteState).toContain("KLEMMI_MUTE_EVENT");
  });
});
