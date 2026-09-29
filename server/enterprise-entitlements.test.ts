import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_CAPABILITIES,
  PRODUCT_PACKAGE_ENTITLEMENTS,
  PRODUCT_PACKAGE_META,
  productAllowsCapability,
} from "../shared/product-packages";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Paket 5: Enterprise und Auslastung", () => {
  it("hebt für Enterprise sämtliche Mengenlimits auf und behält alle Funktionen frei", () => {
    const enterprise = PRODUCT_PACKAGE_ENTITLEMENTS.enterprise;

    expect(enterprise.maxEventsPerYear).toBeNull();
    expect(enterprise.maxEventsPerTenant).toBeNull();
    expect(enterprise.maxHelpersPerEvent).toBeNull();
    expect(enterprise.maxPersonalPlanningAccesses).toBeNull();
    expect(PRODUCT_PACKAGE_META.enterprise.shortDescription).toContain("Unbegrenzte");

    for (const capability of PRODUCT_CAPABILITIES) {
      expect(productAllowsCapability("enterprise", capability)).toBe(true);
    }
  });

  it("ermittelt Produkt-Auslastung ohne personenbezogene Detaildaten", () => {
    const db = source("server/db.ts");

    expect(db).toContain("export async function getTenantProductUsage");
    expect(db).toContain("export async function getCurrentTenantProductUsage");
    expect(db).toContain("export type ProductLimitUsageMetric");
    expect(db).toContain("selectDistinct({ id: planningTeamAccesses.id })");
    expect(db).toContain("getTenantProductUsage(tenantRow.id)");
    expect(db).toContain("Pro-Paket zählen Co-Admins zusätzlich zu den 14 persönlichen");
  });

  it("liefert die Auslastung nur an Vereinsadmins und zeigt sie sicher im Master-Portal", () => {
    const router = source("server/routers.ts");
    const masterPortal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(router).toContain("usage: scopeAdminAuthProcedure.query(() => db.getCurrentTenantProductUsage())");
    expect(masterPortal).toContain('data-slot="tenant-product-usage"');
    expect(masterPortal).toContain("Paket-Auslastung");
    expect(masterPortal).toContain("Enterprise · unbegrenzt");
    expect(masterPortal).toContain("<TenantProductUsage usage={tenant.productUsage} />");
  });

  it("warnt Pro-Vereinsadmins bei 80 Prozent Helfer- oder Zugangsauslastung", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const notice = source("client/src/components/KlemmiProLimitNotice.tsx");

    expect(dashboard).toContain("trpc.tenantProduct.usage.useQuery");
    expect(dashboard).toContain("tenantProduct.data?.packageId === \"pro\"");
    expect(dashboard).toContain("<KlemmiProLimitNotice");
    expect(notice).toContain('data-slot="klemmi-pro-limit-notice"');
    expect(notice).toContain("metric.percentage >= 80");
    expect(notice).toContain("Klemmi behält das Pro-Kontingent im Blick");
  });
});
