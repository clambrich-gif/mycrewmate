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
    expect(page).toContain("Keine öffentliche Registrierung, kein Checkout und keine Zahlungsanbindung.");
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
    expect(page).toContain("Zugänge &amp; Testbereinigung");
    expect(page).toContain("E-Mail-Dublette");
    expect(page).toContain("Testzugang endgültig entfernen?");
    expect(page).toContain("Ansprechpartner, Helfer, Aufgaben und Veranstaltungsdaten bleiben unverändert erhalten.");
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

  it("entfernt ausschließlich interne Testvereine kontrolliert und schützt den echten Pilotverein", () => {
    const routers = source("server/routers.ts");
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(routers).toContain("deleteInternalTestTenant: masterAdminProcedure");
    expect(db).toContain("export async function deleteInternalTestTenantForPlatformAdmin");
    expect(db).toContain("tenantId === DEFAULT_TENANT_ID");
    expect(db).toContain("Der geschützte Pilotverein kann nicht endgültig entfernt werden");
    expect(db).toContain("await tx.delete(events).where(eq(events.tenantId, tenantId))");
    expect(page).toContain("Testverein endgültig entfernen");
    expect(page).toContain("kann nicht rückgängig gemacht werden");
    expect(page).toContain("Der geschützte RSC-Pilotverein kann über diese Funktion nicht entfernt werden");
    expect(page).toContain("archivedTenants.map(tenant => (");
    expect(page).toContain("tenant.id !== \"rsc-eifelland-mayen\"");
  });
});
