import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_CAPABILITIES,
  PRODUCT_PACKAGE_ENTITLEMENTS,
  productAllowsAppRoute,
  productAllowsCapability,
  productAllowsPlanningModule,
} from "../shared/product-packages";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Paket 4: Pro-Entitlements", () => {
  it("begrenzt Pro auf fünf Veranstaltungen, 350 Helfer und 14 persönliche Teamzugänge", () => {
    const pro = PRODUCT_PACKAGE_ENTITLEMENTS.pro;

    expect(pro.maxEventsPerYear).toBe(5);
    expect(pro.maxHelpersPerEvent).toBe(350);
    expect(pro.maxPersonalPlanningAccesses).toBe(14);
  });

  it("schaltet den vollständigen Pro-Umfang inklusive Chat, Karten und GPX frei", () => {
    for (const capability of PRODUCT_CAPABILITIES) {
      expect(productAllowsCapability("pro", capability)).toBe(true);
    }

    expect(productAllowsPlanningModule("pro", "donations")).toBe(true);
    expect(productAllowsPlanningModule("pro", "finances")).toBe(true);
    expect(productAllowsAppRoute("pro", "/spenden")).toBe(true);
    expect(productAllowsAppRoute("pro", "/finanzen")).toBe(true);
    expect(productAllowsCapability("pro", "chat")).toBe(true);
    expect(productAllowsCapability("pro", "maps_gpx")).toBe(true);
  });

  it("verankert die Pro-Limits transaktionssicher am Datenrand", () => {
    const db = source("server/db.ts");

    expect(db).toContain("assertCurrentProductEventCapacity");
    expect(db).toContain("assertCurrentProductHelperCapacity");
    expect(db).toContain("assertCurrentProductPlanningTeamAccessCapacity");
    expect(db).toContain('entitlement.packageId === "pro"');
    expect(db).toContain("eq(planningTeamAccesses.isTenantAdmin, false)");
    expect(db).toContain("PRODUCT_PACKAGE_META[entitlement.packageId].name");
  });

  it("schützt Chat und GPX serverseitig und aktiviert die Oberflächen für Pro", () => {
    const router = source("server/routers.ts");
    const layout = source("client/src/components/Layout.tsx");
    const locations = source("client/src/pages/Locations.tsx");
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(router).toContain('requireCurrentProductCapability("chat")');
    expect(router).toContain('productModuleReadProcedure("locations", "maps_gpx")');
    expect(router).toContain('productModuleWriteProcedure("locations", "maps_gpx")');
    expect(layout).toContain("productAllowsChat");
    expect(locations).toContain('productAllowsCapability(productPackageId, "maps_gpx")');
    expect(dashboard).toContain('productAllowsCapability(tenantProduct.data?.packageId ?? "pro", "maps_gpx")');
  });

  it("sperrt auch pausierte oder abgelaufene Pro-Zuordnungen serverseitig", () => {
    const router = source("server/routers.ts");

    expect(router).toContain("if (!entitlement.isUsable)");
    expect(router).toContain("PRODUCT_PACKAGE_META[entitlement.packageId].name");
  });
});
