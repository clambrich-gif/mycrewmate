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
    expect(routersSource).toContain("email: z.string().trim().email().max(320).optional()");
    expect(routersSource).toContain("getTenantAdminCredentialsByEmail(input.email)");
    expect(layoutSource).toContain("adminEmail");
    expect(layoutSource).toContain("E-Mail-Adresse (für persönliche Vereins-Administratoren");
  });

  it("stellt im Master-Portal Bedienelemente für Handoff und Vereinsadmin-Erstellung bereit", () => {
    expect(portalSource).toContain("In Vereinsansicht wechseln");
    expect(portalSource).toContain("Admin-Zugang anlegen");
    expect(portalSource).toContain("createTenantAdmin.mutate");
    expect(portalSource).toContain("createHandoff.mutate");
  });
});
