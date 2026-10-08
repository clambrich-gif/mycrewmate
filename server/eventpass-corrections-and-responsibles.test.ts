import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

describe("Event-Pass Korrekturen und Verantwortlichkeiten", () => {
  it("Punkt 1: Begrüßung und Klemmi bei Erstanmeldung auch für persönliche Vereinsadmins", () => {
    const schema = source("drizzle/schema.ts");
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");

    expect(schema).toContain('onboardingPending: boolean("onboardingPending")');
    expect(db).toContain("isTenantAdminOnboardingPending");
    expect(db).toContain("completeTenantAdminOnboarding");
    expect(routers).toContain("completeFirstLoginOnboarding");
  });

  it("Punkt 2: Spendenfeld bei Helfer-Neuanlage mit Schloss gesichert und Kuchenfeld in Übersicht geschützt", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("allowsDonations");
    expect(helpers).toContain("KlemmiUpgradeDialog");
    expect(helpers).toContain("Spendenverwaltung erst ab Paket Pro verfügbar");
    expect(helpers).toContain("disabled={!allowsDonations}");
  });

  it("Punkt 3: Event Pass legt Helfer ohne Ansprechpartner an", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain('const isEventPass = currentPackageId === "event_pass"');
    expect(helpers).toContain('setNewHelperContactId("none")');
    expect(helpers).toContain("Im Event Pass gibt es keine Ansprechpartner. Helfer werden direkt gemeinsam organisiert.");
    expect(helpers).not.toContain("const defaultContactId");
  });

  it("Punkt 4: PDF-Ausgabe im Event Pass ohne Fehler & freundlicher Upgrade-Hinweis bei Ansprechpartnern", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");

    expect(pdfExport).toContain("KlemmiUpgradeDialog");
    expect(pdfExport).toContain('setUpgradeCapability("contacts")');
  });

  it("Punkt 5: Dashboard bereinigt – keine Verpflegungsspende und nur Hauptansprechpartner im Event Pass", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("allowsDonations");
    expect(dashboard).toContain("isEventPass");
    expect(dashboard).toContain("Hauptansprechpartner");
  });

  it("Punkt 6: Admin-Name wird in der Master-Admin-Übersicht namentlich angezeigt", () => {
    const db = source("server/db.ts");
    const masterPortal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain("adminName");
    expect(db).toContain("adminEmail");
    expect(masterPortal).toContain("Admin: {tenant.adminActivation.adminName}");
  });

  it("Punkt 7: Fester Verantwortlicher und optionaler Helfer in Vor- und Nachbereitung", () => {
    const routers = source("server/routers.ts");
    const prep = source("client/src/pages/Preparation.tsx");
    const post = source("client/src/pages/PostProcessing.tsx");

    expect(routers).toContain("helperId");
    expect(prep).toContain("Unterstützender Helfer");
    expect(prep).toContain("Kein zusätzlicher Helfer");
    expect(post).toContain("Unterstützender Helfer");
    expect(post).toContain("Kein zusätzlicher Helfer");
  });

  it("Punkt 8: Event Pass blendet Planfreigabe aus und sperrt Benachrichtigungen zusätzlich serverseitig", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const routers = source("server/routers.ts");

    expect(plan).toContain("const canManagePlanRelease = canEditPlan && !isEventPass");
    expect(plan).toContain("enabled: canManagePlanRelease");
    expect(plan).toContain("{canManagePlanRelease && (");
    expect(routers).toContain("const planReleaseAdminProcedure = scheduleAdminProcedure.use");
    expect(routers).toContain("Planfreigaben und Ansprechpartner-Benachrichtigungen sind im Event Pass nicht vorgesehen.");
  });

  it("Punkt 9: Pilot-Support bleibt im Event Pass dem Hauptadministrator vorbehalten", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("showSupport={!isEventPass || isPrimaryTenantAdmin}");
    expect(dashboard).toContain("{showSupport && <a");
    expect(dashboard).toContain("Pilotkontakt: {tenant.contactEmail}");
  });

  it("Punkt 10: Nicht berechtigte Zugänge erhalten beim Laden einen verständlichen Hinweis", () => {
    const saveLoad = source("client/src/components/SaveLoadModal.tsx");

    expect(saveLoad).toContain("Projektstände können nur von Administratoren geladen werden.");
    expect(saveLoad).toContain("const openLoadDialog = () => {");
    expect(saveLoad).toContain("aria-disabled={!isAdmin}");
    expect(saveLoad).not.toMatch(/\n\s+disabled=\{!isAdmin\}/);
  });
});
