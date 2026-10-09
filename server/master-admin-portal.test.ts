import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isMasterAdminHost,
  isMasterAdminRequestHost,
  MASTER_ADMIN_HOST,
} from "../shared/platform-admin";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Master-Admin-Portal", () => {
  it("akzeptiert im Produktionsbetrieb ausschließlich die Master-Domain", () => {
    expect(MASTER_ADMIN_HOST).toBe("admin.mycrewmate.de");
    expect(isMasterAdminHost("admin.mycrewmate.de")).toBe(true);
    expect(isMasterAdminHost("app.mycrewmate.de")).toBe(false);
    expect(isMasterAdminHost("mycrewmate.de")).toBe(false);
    expect(isMasterAdminRequestHost("admin.mycrewmate.de", "production")).toBe(true);
    expect(isMasterAdminRequestHost("app.mycrewmate.de", "production")).toBe(false);
    expect(
      isMasterAdminRequestHost("3000-preview.manus.computer", "production")
    ).toBe(false);
  });

  it("erlaubt die Master-Vorschau nur außerhalb der Produktion", () => {
    expect(
      isMasterAdminRequestHost("3000-preview.manus.computer", "development")
    ).toBe(true);
    expect(isMasterAdminRequestHost("localhost", "test")).toBe(true);
  });

  it("schützt die Plattformübersicht durch Master-Identität und Hostprüfung", () => {
    const routers = source("server/routers.ts");
    expect(routers).toContain("const masterAdminProcedure");
    expect(routers).toContain("isMasterAdminRequestHost");
    expect(routers).toContain("ctx.user.openId === ADMIN_PASSWORD_OPEN_ID");
    expect(routers).toContain("platformAdmin: router");
    expect(routers).toContain("tenantOverview: masterAdminProcedure");
  });

  it("trennt die Master-Oberfläche von der Vereinsnavigation", () => {
    const app = source("client/src/App.tsx");
    const page = source("client/src/pages/MasterAdminPortal.tsx");
    expect(app).toContain("isMasterAdminSite");
    expect(app).toContain("MasterAdminRouter");
    expect(app).toContain('path="/master-admin"');
    expect(page).toContain("platformAdmin.tenantOverview.useQuery");
    expect(page).toContain("Verein anlegen");
  });

  it("richtet die Master-MFA primär über QR-Scan ein und hält die manuelle Eingabe nur als Ausweichweg bereit", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(page).toContain('import { MfaEnrollmentQr } from "@/components/MfaEnrollmentQr"');
    expect(page).toContain("QR-Code mit dem Smartphone scannen");
    expect(page).toContain("otpauthUri={setup.otpauthUri}");
    expect(page).toContain("QR-Code kann nicht gescannt werden? Schlüssel manuell eingeben");
    expect(page).toContain("[font-variant-numeric:slashed-zero]");
    expect(page).toContain("Erst nach einem korrekt geprüften App-Code wird die Master-MFA gespeichert");
  });

  it("erhält offene Master-Dialoge bei einem späteren Übersichts-Refetchfehler", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    // Die Vollseiten-Fehleransicht ist ausschließlich für den ersten Abruf
    // ohne bereits geladene Daten erlaubt. Ein späterer Fehler bleibt als
    // Hinweis im bestehenden Portalbaum, sodass Formulardialoge gemountet bleiben.
    expect(page).toContain("if (overview.error && !overview.data && !isVisualPreview)");
    expect(page).toContain('data-slot="master-overview-refresh-error"');
    expect(page).toContain("Bereits geladene Daten und offene Eingaben bleiben erhalten.");
    expect(page).toContain("overviewNeedsRenewedLogin ? false : overview.isFetching");
    expect(page).toContain("overviewNeedsRenewedLogin ? void logout() : void overview.refetch()");
  });

  it("erlaubt Masteraktionen nur für interne Pilot- und Mustervereine", () => {
    const routers = source("server/routers.ts");
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(routers).toContain("createTenant: masterAdminProcedure");
    expect(routers).toContain('status: z.enum(["pilot", "sample"])');
    expect(routers).toContain("updateTenantLifecycle: masterAdminProcedure");
    expect(routers).toContain('z.enum(["pilot", "sample", "suspended", "archived"])');
    expect(db).toContain("export async function createTenantForPlatformAdmin");
    expect(db).toContain("export async function updateTenantLifecycleForPlatformAdmin");
    expect(db).toContain('"active" ist absichtlich nicht möglich');
    expect(page).toContain("Der Status <strong>Aktiv</strong> ist vor dem Marktstart bewusst nicht verfügbar.");
  });

  it("trennt archivierte Vereine von der laufenden Verwaltung und erlaubt nur eine bewusste Reaktivierung", () => {
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain('notEq(tenants.status, "archived")');
    expect(page).toContain('const activeTenants = allTenants.filter(tenant => tenant.status !== "archived")');
    expect(page).toContain('const archivedTenants = allTenants.filter(tenant => tenant.status === "archived")');
    expect(page).toContain("Archivierte Vereine");
    expect(page).toContain("Verein archivieren?");
    expect(page).toContain('status: "archived"');
    expect(page).toContain('status: "pilot"');
    expect(page).toContain("Als Pilot reaktivieren");
    expect(page).toContain("historischen Nachweis");
    expect(page).toContain("Alle Vereinsberechtigungen werden endgültig entfernt");
    expect(page).toContain("müssen sämtliche Zugänge bewusst neu vergeben werden");
    expect(page).toContain("utils.platformAdmin.accessInventory.invalidate()");
    expect(routers).toContain("listTenantAdministratorNotificationRecipients(input.tenantId)");
    expect(routers).toContain('status: updated.status === "archived" ? "archived" : "paused"');
  });

  it("benachrichtigt beim Pausieren nur nach einem erfolgreichen Statuswechsel alle hinterlegten Vereinsadmins", () => {
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain("listTenantAdministratorNotificationRecipients");
    expect(db).toContain("eq(planningTeamAccesses.isTenantAdmin, true)");
    expect(routers).toContain("notifyTenantAdministratorsAboutAccessStatus");
    expect(routers).toContain('input.status === "paused"');
    expect(routers).toContain("updated.previousStatus !== \"paused\"");
    expect(routers).toContain("assertTenantProductUsableForLogin");
    expect(routers).toContain("await assertTenantProductUsableForLogin(tenantId)");
    expect(page).toContain("Administratoren wurden per E-Mail informiert.");
  });

  it("trennt laufende Kennzahlen klar von archivierten Vereinen und deren Veranstaltungen", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");
    expect(page).toContain("const managedEventCount = activeTenants.reduce");
    expect(page).toContain("Vereine in Verwaltung");
    expect(page).toContain("Veranstaltungen in Verwaltung");
    expect(page).toContain("Vereine im Archiv");
    expect(page).toContain("xl:grid-cols-4");
  });

  it("stellt persönliche Zugänge nur im geschützten Masterportal bereit und entfernt Testzugänge kontrolliert", () => {
    const routers = source("server/routers.ts");
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(routers).toContain("accessInventory: masterAdminProcedure");
    expect(routers).toContain("deleteTestAccess: masterAdminProcedure");
    expect(db).toContain("export async function listPlatformAccessInventoryForPlatformAdmin");
    expect(db).toContain("export async function deletePlatformAccessForMasterAdmin");
    expect(db).toContain("Passworthashes\n * sowie Einladungs-Token bleiben dabei konsequent außerhalb der Antwort");
    expect(db).toContain("Dieser Zugang ist kein löschbarer persönlicher Vereinsadmin-Testzugang");
    expect(page).toContain('data-slot="tenant-access-panel"');
    expect(page).toContain("Zugänge ({accesses.length})");
    expect(page).toContain("tenantIds.includes(tenant.id)");
    expect(page).toContain("E-Mail-Dublette");
    expect(page).toContain("Zugang endgültig entfernen?");
    expect(page).not.toContain("Zugänge &amp; Testbereinigung");
    expect(page).toContain("Ansprechpartner, Helfer, Aufgaben und Veranstaltungsdaten bleiben unverändert erhalten.");
  });

  it("zeigt den aktuellen digitalen Vertragsstatus je Verein ohne Planungsdaten offenzulegen", () => {
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain("contractAcceptanceRows");
    expect(db).toContain("tenantContractAcceptances");
    expect(db).toContain("confirmedDocumentCount");
    expect(page).toContain("TenantContractAcceptanceStatus");
    expect(page).toContain("Zustimmungen für den Vereinszugang vollständig.");
    expect(page).toContain("Zustimmungen für den Vereinszugang noch offen.");
  });

  it("zeigt je Verein einen aggregierten MFA-Status ohne Sicherheitsgeheimnisse", () => {
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain("mfaEnabled: tenantAdminCredentials.mfaEnabled");
    expect(db).toContain("mfaEnabled: 0");
    expect(page).toContain("function TenantMfaStatus");
    expect(page).toContain('data-slot="tenant-mfa-status"');
    expect(page).toContain("MFA-Status:");
  });

  it("ermöglicht eine bewusst bestätigte Neugenerierung der acht Master-Notfallcodes", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");
    const router = source("server/routers.ts");
    const db = source("server/db.ts");

    expect(page).toContain("Acht Master-Notfallcodes neu erzeugen");
    expect(page).toContain("regenerateRecoveryCodes.mutate");
    expect(router).toContain("regenerateMfaRecoveryCodes: baseProtectedProcedure");
    expect(page).toContain("Alle bisherigen Notfallcodes werden sofort ungültig");
    expect(db).toContain("replaceMasterMfaRecoveryCodes");
  });

  it("erstellt neue Vereine mit Startveranstaltung und eindeutiger serverseitiger Kennung", () => {
    const db = source("server/db.ts");
    expect(db).toContain("function tenantSlugFromName");
    expect(db).toContain("async function nextAvailableTenantId");
    expect(db).toContain("const tenantId = await nextAvailableTenantId(tx, name)");
    expect(db).toContain("Ein Verein mit diesem Namen ist bereits angelegt");
    expect(db).toContain("await tx.insert(events).values");
    expect(db).toContain("initialEventYear");
  });

  it("entfernt interne Pilot- und Testvereine kontrolliert ohne vereinsbezogene Sonderlöschsperre", () => {
    const routers = source("server/routers.ts");
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(routers).toContain("deleteInternalTestTenant: masterAdminProcedure");
    expect(db).toContain("export async function deleteInternalTestTenantForPlatformAdmin");
    expect(db).not.toContain("DEFAULT_TENANT_ID");
    expect(db).toContain("Es gibt keine vereinsbezogene technische Löschsperre");
    expect(db).toContain("await tx.delete(events).where(eq(events.tenantId, tenantId))");
    expect(page).toContain("Verein mit allen Daten endgültig löschen?");
    expect(page).toContain("Verein endgültig löschen");
    expect(page).toContain("kann nicht rückgängig gemacht werden");
    expect(page).toContain('tenant.status !== "active"');
    expect(page).toContain("filteredArchivedTenants.map(tenant => (");
    expect(page).not.toContain('tenant.id !== "rsc-eifelland-mayen"');
  });
});


describe("Master-Admin-Bereinigung", () => {
  it("hält aktive MFA-Details eingeklappt und erklärt eine abgelaufene Sitzung klar", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");
    expect(page).toContain("Sicherheitsdetails");
    expect(page).toContain("<Collapsible open={detailsOpen}");
    expect(page).toContain("Sitzung abgelaufen.");
    expect(page).toContain("Abmelden und neu anmelden");
  });

  it("entfernt die frühere Schulungsfunktion aus erreichbaren Oberflächen und Routen", () => {
    const app = source("client/src/App.tsx");
    const page = source("client/src/pages/MasterAdminPortal.tsx");
    const router = source("server/routers.ts");
    const schema = source("drizzle/schema.ts");
    const migration = source("drizzle/0100_chemical_captain_marvel.sql");
    const help = source("client/src/pages/Help.tsx");
    expect(app).not.toContain('path="/wbt"');
    expect(app).not.toContain("WbtPortal");
    expect(page).not.toContain("WBT-Schulungslinks erstellen");
    expect(router).not.toContain("createWbtTrainingLink");
    expect(router).not.toContain("wbt: router");
    expect(schema).not.toContain("wbt_training_links");
    expect(migration).toContain("DROP TABLE IF EXISTS `wbt_training_links`");
    expect(help).not.toContain("Web-Based-Training (WBT)");
  });

  it("trennt Pilotzugänge sprachlich von der öffentlichen Vereinsdemo", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(page).toContain('return status === "test"\n    ? "Pilotzugang"');
    expect(page).toContain("Zustimmungen für den Vereinszugang vollständig.");
    expect(page).not.toContain("Marktstart noch nicht aktiv");
    expect(page).not.toContain("Keine öffentliche Registrierung, kein Checkout und keine Zahlungsanbindung.");
  });
});
