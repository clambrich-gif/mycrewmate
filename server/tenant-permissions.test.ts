import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EDITABLE_PLANNING_MODULES,
  FULL_PLANNER_PERMISSIONS,
  mayReadPlanningModule,
  mayWritePlanningModule,
  normalizePlanningModules,
  type PlanningModule,
} from "@shared/tenant-permissions";
import { visibleNavigationItemsWithPermissions } from "../client/src/lib/nav";

describe("Vereins- und Bereichsrechte-Modell", () => {
  it("erlaubt Admins und Vollberechtigten alle Module", () => {
    for (const mod of EDITABLE_PLANNING_MODULES) {
      expect(mayReadPlanningModule(FULL_PLANNER_PERMISSIONS, mod)).toBe(true);
      expect(mayWritePlanningModule(FULL_PLANNER_PERMISSIONS, mod)).toBe(true);
    }
  });

  it("erlaubt bei 'read_all' nur lesenden Zugriff auf Fachbereiche", () => {
    const permissions: PlanningModule[] = ["read_all"];
    for (const mod of EDITABLE_PLANNING_MODULES) {
      expect(mayReadPlanningModule(permissions, mod)).toBe(true);
      expect(mayWritePlanningModule(permissions, mod)).toBe(false);
    }
  });

  it("begrenzt Schreibrechte strikt auf die zugewiesenen Module", () => {
    const permissions: PlanningModule[] = ["helpers", "donations"];
    expect(mayWritePlanningModule(permissions, "helpers")).toBe(true);
    expect(mayWritePlanningModule(permissions, "donations")).toBe(true);
    expect(mayWritePlanningModule(permissions, "schedule")).toBe(false);
    expect(mayWritePlanningModule(permissions, "materials")).toBe(false);
  });

  it("blendet im Menü nicht autorisierte Bereiche für das Planungsteam aus", () => {
    const permissions: PlanningModule[] = ["helpers"];
    const items = visibleNavigationItemsWithPermissions("user", permissions);
    const hrefs = items.map(i => i.href);

    expect(hrefs).toContain("/helfer");
    expect(hrefs).toContain("/"); // Dashboard bleibt sichtbar
    expect(hrefs).not.toContain("/material");
    expect(hrefs).not.toContain("/spenden");
    expect(hrefs).not.toContain("/vorbereitung");
  });

  it("zeigt dem Administrator immer alle administrativen Menüpunkte an", () => {
    const items = visibleNavigationItemsWithPermissions("admin", null);
    const hrefs = items.map(i => i.href);

    expect(hrefs).toContain("/sicherheit");
    expect(hrefs).toContain("/finanzen");
    expect(hrefs).toContain("/ansprechpartner");
    expect(hrefs).toContain("/helfer");
  });

  it("verankert E-Mail und Modulrechte im Router und Datenbankschema", () => {
    const schemaSource = readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    const routerSource = readFileSync(
      path.resolve(__dirname, "./routers.ts"),
      "utf8"
    );

    expect(schemaSource).toContain('email: varchar("email", { length: 320 })');
    expect(schemaSource).toContain('modulePermissions: json("modulePermissions")');
    expect(routerSource).toContain("function moduleWriteProcedure(");
    expect(routerSource).toContain("function moduleReadProcedure(");
    expect(routerSource).toContain("myPermissions: scopedProtectedProcedure.query(");
  });
});
