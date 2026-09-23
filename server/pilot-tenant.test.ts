import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("RSC-Pilot-Grundlage", () => {
  it("definiert den Pilotmandanten RSC Eifelland Mayen e. V. mit Status pilot", () => {
    const tenantSource = fs.readFileSync(
      path.resolve(__dirname, "../shared/tenant.ts"),
      "utf-8"
    );
    expect(tenantSource).toContain("RSC Eifelland Mayen e. V.");
    expect(tenantSource).toContain('"pilot"');
    expect(tenantSource).toContain("MyEifelRide 2027");
    expect(tenantSource).toContain("Kirmesverein Musterstadt e. V.");
    expect(tenantSource).toContain("Schützenverein Musterhausen e. V.");
    expect(tenantSource).toContain("TENANT_CATALOG");
  });

  it("ordnet Veranstaltungen in einer nicht-destruktiven Migration einem Mandanten zu", () => {
    const schemaSource = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    const migrationSource = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/0054_quiet_white_tiger.sql"),
      "utf-8"
    );
    expect(schemaSource).toContain('export const tenants = mysqlTable');
    expect(schemaSource).toContain('tenantId: varchar("tenantId"');
    expect(migrationSource).toContain('CREATE TABLE `tenants`');
    expect(migrationSource).toContain("'rsc-eifelland-mayen'");
    expect(migrationSource).toContain("'kirmesverein-musterstadt'");
    expect(migrationSource).toContain("'schuetzenverein-musterhausen'");
    expect(migrationSource).toContain("CREATE INDEX `events_year_fk_idx`");
    expect(migrationSource).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it("leitet den Mandanten getrennt über Browser, API und Eventabfragen weiter", () => {
    const contextSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/contexts/YearContext.tsx"),
      "utf-8"
    );
    const clientSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/main.tsx"),
      "utf-8"
    );
    const dbSource = fs.readFileSync(
      path.resolve(__dirname, "../server/db.ts"),
      "utf-8"
    );
    expect(contextSource).toContain("mycrewmate:tenant-id");
    expect(clientSource).toContain('"x-tenant-id"');
    expect(dbSource).toContain("eq(events.tenantId, tenant())");
  });

  it("beschränkt den Mandantenwechsler auf Administratoren", () => {
    const routerSource = fs.readFileSync(
      path.resolve(__dirname, "../server/routers.ts"),
      "utf-8"
    );
    const layoutSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/Layout.tsx"),
      "utf-8"
    );
    expect(routerSource).toContain("tenants: router");
    expect(routerSource).toContain('ctx.user.role !== "admin"');
    expect(layoutSource).toContain("Testmandant");
    expect(layoutSource).toContain("selectTenant");
  });

  it("zeigt das Pilot-Badge im Anwendungs-Layout an", () => {
    const layoutSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/Layout.tsx"),
      "utf-8"
    );
    expect(layoutSource).toContain("ACTIVE_PILOT_TENANT");
    expect(layoutSource).toContain("Pilot");
  });

  it("zeigt den geschlossenen RSC-Pilotbetrieb im Dashboard transparent an", () => {
    const dashboardSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"),
      "utf-8"
    );
    expect(dashboardSource).toContain("PilotTenantInfoCard");
    expect(dashboardSource).toContain("Keine Bezahl- oder Freischaltfunktion aktiv");
    expect(dashboardSource).toContain("Pilot-Support");
  });

  it("zeigt Enterprise auf der Angebotsseite mit ab 449 Euro pro Jahr an", () => {
    const offerSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/OfferDemo.tsx"),
      "utf-8"
    );
    expect(offerSource).toContain('pricePrefix: "ab"');
    expect(offerSource).toContain("ab");
    expect(offerSource).toContain("449");
  });
});
