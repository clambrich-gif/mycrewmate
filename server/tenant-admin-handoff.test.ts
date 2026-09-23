import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Vereinsadmin-Verwaltung, Marktstart-Sperre & Handoff", () => {
  const schemaSource = readFileSync(path.resolve(__dirname, "../drizzle/schema.ts"), "utf8");
  const dbSource = readFileSync(path.resolve(__dirname, "db.ts"), "utf8");
  const routersSource = readFileSync(path.resolve(__dirname, "routers.ts"), "utf8");
  const portalSource = readFileSync(path.resolve(__dirname, "../client/src/pages/MasterAdminPortal.tsx"), "utf8");
  const layoutSource = readFileSync(path.resolve(__dirname, "../client/src/components/Layout.tsx"), "utf8");

  it("definiert die Tabellen für Vereinsadmin-Credentials, Handoffs und Launch-Settings", () => {
    expect(schemaSource).toContain("export const tenantAdminCredentials = mysqlTable(");
    expect(schemaSource).toContain("export const platformTenantHandoffs = mysqlTable(");
    expect(schemaSource).toContain("export const platformLaunchSettings = mysqlTable(");
  });

  it("enthält Datenbankfunktionen zur Anlage von Vereinsadmins mit Einmalpasswort und sicheren Handoffs", () => {
    expect(dbSource).toContain("export async function createOrUpdateTenantAdminForPlatformAdmin");
    expect(dbSource).toContain("export async function createPlatformTenantHandoff");
    expect(dbSource).toContain("export async function consumePlatformTenantHandoff");
    expect(dbSource).toContain("export async function getPlatformLaunchSettings");
  });

  it("stellt tRPC-Routen für Vereinsadmin-Erstellung, Launch-Settings und Handoff bereit", () => {
    expect(routersSource).toContain("createTenantAdmin: masterAdminProcedure");
    expect(routersSource).toContain("launchSettings: masterAdminProcedure");
    expect(routersSource).toContain("createHandoffLink: masterAdminProcedure");
    expect(routersSource).toContain("consumeHandoffToken: publicProcedure");
  });

  it("erlaubt Vereinsadmins die Anmeldung per E-Mail und Passwort", () => {
    expect(routersSource).toContain('email: z.string().trim().email("Bitte E-Mail-Adresse eingeben").max(320)');
    expect(routersSource).toContain("getTenantAdminCredentialsByEmail(input.email)");
    expect(routersSource).toContain("getPlanningTeamAccessCredentialByEmail(input.email)");
    expect(layoutSource).toContain("loginEmail");
    expect(layoutSource).toContain("Ihre Berechtigungen erkennt MyCrewMate automatisch.");
  });

  it("verhindert neue doppelte E-Mail-Zugänge zwischen Vereinsadmin und Planungsteam", () => {
    expect(dbSource).toContain("assertNoActiveTenantAdminEmailConflict");
    expect(dbSource).toContain("bereits einem aktiven Vereinsadministrator zugeordnet");
    expect(dbSource).toContain("bereits einem Planungsteam-Zugang zugeordnet");
  });

  it("stellt im Master-Portal Bedienelemente für Handoff und Vereinsadmin-Erstellung bereit", () => {
    expect(portalSource).toContain("In Vereinsansicht wechseln");
    expect(portalSource).toContain("Admin-Zugang anlegen");
    expect(portalSource).toContain("createTenantAdmin.mutate");
    expect(portalSource).toContain("createHandoff.mutate");
  });

  it("leitet einen Master-Handoff stets auf die geschützte Vereins-App statt erneut ins Master-Portal", () => {
    expect(portalSource).toContain('import { appUrl } from "@/lib/site-host";');
    expect(portalSource).toContain('appUrl("/", `?handoff=${encodeURIComponent(result.handoffToken)}`)');
    expect(portalSource).not.toContain("window.location.origin}/?handoff=");
  });

  it("erlaubt dem Plattform-Inhaber nach einem Handoff nur die ausgewählte laufende Vereinsansicht", () => {
    expect(dbSource).toContain("input.userOpenId === ADMIN_PASSWORD_OPEN_ID && preferredTenantId");
    expect(dbSource).toContain('notEq(tenants.status, "suspended")');
    expect(dbSource).toContain('notEq(tenants.status, "archived")');
    expect(routersSource).toContain("userOpenId: user.openId");
  });

  it("prüft einen fehlerhaften Einmal-Wechsel-Link nur einmal und entfernt ihn danach aus der Adresse", () => {
    expect(layoutSource).toContain("const attemptedHandoffTokenRef = useRef<string | null>(null);");
    expect(layoutSource).toContain("attemptedHandoffTokenRef.current !== token");
    expect(layoutSource).toContain("attemptedHandoffTokenRef.current = token;");
    expect(layoutSource).toContain("removeHandoffFromAddress();");
  });
});
