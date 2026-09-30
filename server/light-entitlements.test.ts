import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_PACKAGE_ENTITLEMENTS,
  productAllowsAppRoute,
  productAllowsCapability,
  productAllowsPlanningModule,
  requiredUpgradePackageForCapability,
} from "../shared/product-packages";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Paket 3: Light-Entitlements", () => {
  it("begrenzt Light auf eine Hauptveranstaltung, 150 Helfer und fünf Teamzugänge", () => {
    const light = PRODUCT_PACKAGE_ENTITLEMENTS.light;

    expect(light.maxEventsPerYear).toBe(1);
    expect(light.maxHelpersPerEvent).toBe(150);
    expect(light.maxPersonalPlanningAccesses).toBe(5);
  });

  it("schaltet die Light-Kernmodule frei und hält Pro-Erweiterungen gesperrt", () => {
    for (const capability of [
      "contacts",
      "helpers",
      "schedule",
      "preparation",
      "postprocessing",
      "materials",
      "locations",
      "pdf",
      "event_years",
      "event_backup",
    ] as const) {
      expect(productAllowsCapability("light", capability)).toBe(true);
    }
    for (const capability of [
      "additional_events",
      "chat",
      "donations",
      "finances",
      "maps_gpx",
      "excel",
      "project_backup",
      "marketing",
      "approvals",
    ] as const) {
      expect(productAllowsCapability("light", capability)).toBe(false);
    }

    expect(productAllowsPlanningModule("light", "materials")).toBe(true);
    expect(productAllowsPlanningModule("light", "finances")).toBe(false);
    expect(productAllowsAppRoute("light", "/material")).toBe(true);
    expect(productAllowsAppRoute("light", "/spenden")).toBe(false);
    expect(productAllowsAppRoute("light", "/finanzen")).toBe(false);
  });

  it("empfiehlt ohne Zahlungs- oder Checkoutfluss das passende nächste Paket", () => {
    expect(requiredUpgradePackageForCapability("event_pass", "personal_accesses")).toBe("light");
    expect(requiredUpgradePackageForCapability("light", "maps_gpx")).toBe("pro");
    expect(requiredUpgradePackageForCapability("light", "donations")).toBe("pro");
    expect(requiredUpgradePackageForCapability("pro", "chat")).toBeNull();
  });

  it("verankert Mengen-, GPX- und Routenprüfungen auf dem Server", () => {
    const db = source("server/db.ts");
    const router = source("server/routers.ts");

    expect(db).toContain("assertCurrentProductEventCapacity");
    expect(db).toContain("assertCurrentProductPlanningTeamAccessCapacity");
    expect(db).toContain("maxEventsPerYear");
    expect(db).toContain("maxPersonalPlanningAccesses");
    expect(router).toContain('productModuleReadProcedure("locations", "maps_gpx")');
    expect(router).toContain('productModuleWriteProcedure("locations", "maps_gpx")');
    expect(router).toContain('productCapabilityAdminProcedure("maps_gpx")');
  });

  it("zeigt gesperrte Funktionen über Klemmi statt über einen Checkout", () => {
    const dialog = source("client/src/components/KlemmiUpgradeDialog.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const locations = source("client/src/pages/Locations.tsx");
    const portal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(dialog).toContain("Klemmi hat einen Hinweis");
    expect(dialog).toContain("keinen öffentlichen Checkout");
    expect(layout).toContain("KlemmiUpgradeDialog");
    expect(locations).toContain("gpx-upgrade-notice");
    expect(portal).toContain('data-slot="tenant-package-filter"');
    expect(portal).toContain("filteredActiveTenants");
  });
});
