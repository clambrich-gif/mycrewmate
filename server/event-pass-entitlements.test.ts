import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_PACKAGE_ENTITLEMENTS,
  productAllowsAppRoute,
  productAllowsCapability,
  productAllowsPlanningModule,
} from "../shared/product-packages";

describe("Paket 2: Event-Pass-Entitlements", () => {
  it("beschränkt den Event Pass auf eine Veranstaltung und maximal 50 Helfer", () => {
    const eventPass = PRODUCT_PACKAGE_ENTITLEMENTS.event_pass;

    expect(eventPass.maxEventsPerTenant).toBe(1);
    expect(eventPass.maxHelpersPerEvent).toBe(50);
    expect(eventPass.maxPersonalPlanningAccesses).toBe(0);
  });

  it("erlaubt im Event Pass nur den kompakten Kernumfang", () => {
    expect(productAllowsCapability("event_pass", "helpers")).toBe(true);
    expect(productAllowsCapability("event_pass", "schedule")).toBe(true);
    expect(productAllowsCapability("event_pass", "preparation")).toBe(true);
    expect(productAllowsCapability("event_pass", "pdf")).toBe(true);

    expect(productAllowsCapability("event_pass", "additional_events")).toBe(false);
    expect(productAllowsCapability("event_pass", "personal_accesses")).toBe(false);
    expect(productAllowsCapability("event_pass", "chat")).toBe(false);
    expect(productAllowsCapability("event_pass", "excel")).toBe(false);
    expect(productAllowsCapability("event_pass", "project_backup")).toBe(false);
    expect(productAllowsCapability("event_pass", "locations")).toBe(false);
    expect(productAllowsCapability("event_pass", "finances")).toBe(false);
    expect(productAllowsCapability("event_pass", "donations")).toBe(false);
  });

  it("hält Produktumfang und persönliche Fachbereichsrechte getrennt", () => {
    expect(productAllowsPlanningModule("event_pass", "helpers")).toBe(true);
    expect(productAllowsPlanningModule("event_pass", "schedule")).toBe(true);
    expect(productAllowsPlanningModule("event_pass", "preparation")).toBe(true);
    expect(productAllowsPlanningModule("event_pass", "pdf")).toBe(true);

    expect(productAllowsPlanningModule("event_pass", "contacts")).toBe(false);
    expect(productAllowsPlanningModule("event_pass", "postprocessing")).toBe(false);
    expect(productAllowsPlanningModule("event_pass", "materials")).toBe(false);
    expect(productAllowsPlanningModule("event_pass", "donations")).toBe(false);
    expect(productAllowsPlanningModule("event_pass", "finances")).toBe(false);
    expect(productAllowsPlanningModule("event_pass", "locations")).toBe(false);
  });

  it("blendet gesperrte App-Bereiche für den Event Pass aus, ohne andere Pakete vorzugreifen", () => {
    expect(productAllowsAppRoute("event_pass", "/helfer")).toBe(true);
    expect(productAllowsAppRoute("event_pass", "/einsatzplan")).toBe(true);
    expect(productAllowsAppRoute("event_pass", "/vorbereitung")).toBe(true);
    expect(productAllowsAppRoute("event_pass", "/pdf-export")).toBe(true);
    expect(productAllowsAppRoute("event_pass", "/material")).toBe(false);
    expect(productAllowsAppRoute("event_pass", "/spenden")).toBe(false);
    expect(productAllowsAppRoute("event_pass", "/orte")).toBe(false);
    expect(productAllowsAppRoute("pro", "/material")).toBe(true);
  });

  it("verankert Scopebindung, Mengenlimit und API-Gates serverseitig", () => {
    const db = readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
    const router = readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");

    expect(db).toContain("getTenantProductEntitlement");
    expect(db).toContain("getEventForTenantById");
    expect(db).toContain("assertCurrentProductHelperCapacity");
    expect(db).toContain("maxHelpersPerEvent");
    expect(router).toContain("enforceProductEventScope");
    expect(router).toContain("requireCurrentProductCapability(\"additional_events\")");
    expect(router).toContain("requireCurrentProductCapability(\"personal_accesses\")");
    expect(router).toContain("requireCurrentProductCapability(\"chat\")");
    expect(router).toContain("productCapabilityProcedure(\"excel\")");
    expect(router).toContain("productCapabilityProcedure(\"project_backup\")");
  });
});
