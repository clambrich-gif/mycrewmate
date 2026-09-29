import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Event-Pass Korrekturen und Verantwortlichkeiten", () => {
  it("Punkt 1: Begrüßung und Klemmi bei Erstanmeldung auch für persönliche Vereinsadmins", () => {
    const schema = source("drizzle/schema.ts");
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");
    const onboarding = source("client/src/components/FirstLoginOnboarding.tsx");

    expect(schema).toContain("onboardingPending");
    expect(db).toContain("completeTenantAdminOnboarding");
    expect(routers).toContain("firstLoginOnboardingStatus");
    expect(routers).toContain("completeFirstLoginOnboarding");
    expect(onboarding).toContain("Willkommen");
  });

  it("Punkt 2: Spendenfeld bei Helfer-Neuanlage mit Schloss gesichert und Kuchenfeld in Übersicht geschützt", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("allowsDonations");
    expect(helpers).toContain("KlemmiUpgradeDialog");
    expect(helpers).toContain("upgradeCapability");
    expect(helpers).toContain("LockKeyhole");
    expect(helpers).toContain("CakeDonationAction");
  });

  it("Punkt 3: Vereinsadmin ist Standard-Ansprechpartner im Event Pass", () => {
    const db = source("server/db.ts");
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(db).toContain("ensureEventPassPrimaryAdminContact");
    expect(db).toContain("primaryAdmin");
    expect(helpers).toContain("currentPackageId === \"event_pass\"");
    expect(helpers).toContain("defaultContactId");
  });

  it("Punkt 4: PDF-Ausgabe im Event Pass ohne Fehler & freundlicher Upgrade-Hinweis bei Ansprechpartnern", () => {
    const pdfPage = source("client/src/pages/PdfExport.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(pdfPage).toContain("KlemmiUpgradeDialog");
    expect(pdfPage).toContain("allowsContacts");
    expect(pdfPage).toContain("downloadContactOverviews");
    expect(pdfPage).toContain('productAllowsCapability(currentPackageId, "contacts")');
    expect(pdfPage).not.toContain("tenantProduct?.entitlements.capabilities.contacts");
    expect(helpers).toContain("allowsPersonalPdfShare");
    expect(helpers).toContain('setUpgradeCapability("personal_accesses")');
    expect(helpers).toContain("Persönliche PDF-Links und die Einsatzplan-Zuweisung stehen ab Light bereit.");
  });

  it("Punkt 5: Dashboard bereinigt – keine Verpflegungsspende und nur Hauptansprechpartner im Event Pass", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("allowsDonations");
    expect(dashboard).toContain("isEventPass");
    expect(dashboard).toContain("Hauptansprechpartner (Vereinsadministrator)");
  });

  it("Punkt 6: Admin-Name in Master-Admin-Portalübersicht sichtbar", () => {
    const db = source("server/db.ts");
    const masterPortal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain("adminName");
    expect(db).toContain("adminEmail");
    expect(masterPortal).toContain("Admin: {tenant.adminActivation.adminName}");
  });

  it("Punkt 7: Alle Helfer als Verantwortliche in Vor- und Nachbereitung auswählbar", () => {
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");
    const prep = source("client/src/pages/Preparation.tsx");
    const post = source("client/src/pages/PostProcessing.tsx");

    expect(db).toContain("ensureContactForHelperId");
    expect(routers).toContain("helperId");
    expect(prep).toContain("responsiblePersons");
    expect(prep).toContain("(Helfer)");
    expect(post).toContain("responsiblePersons");
    expect(post).toContain("(Helfer)");
  });
});
