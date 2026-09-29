import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EDITABLE_PLANNING_MODULES,
  mayReadPlanningModule,
  mayWritePlanningModule,
  type PlanningModuleAccess,
} from "@shared/tenant-permissions";

describe("direkte Fachbereichsrechte", () => {
  const exampleAccess: PlanningModuleAccess = {
    contacts: "read",
    helpers: "write",
    donations: "write",
    schedule: "read",
    preparation: "write",
    postprocessing: "off",
    materials: "off",
    finances: "off",
    pdf: "read",
    locations: "read",
  };

  it("speichert pro Fachbereich ausschließlich Aus, Lesen oder Schreiben", () => {
    for (const module of EDITABLE_PLANNING_MODULES) {
      expect(["off", "read", "write"]).toContain(exampleAccess[module]);
    }
  });

  it("unterscheidet Leserechte zuverlässig von Schreibrechten", () => {
    expect(mayReadPlanningModule(exampleAccess, "schedule")).toBe(true);
    expect(mayWritePlanningModule(exampleAccess, "schedule")).toBe(false);
    expect(mayReadPlanningModule(exampleAccess, "preparation")).toBe(true);
    expect(mayWritePlanningModule(exampleAccess, "preparation")).toBe(true);
    expect(mayReadPlanningModule(exampleAccess, "finances")).toBe(false);
    expect(mayWritePlanningModule(exampleAccess, "finances")).toBe(false);
  });

  it("zeigt die drei direkten Schalter ohne Stufen- oder Vorlagenlogik", () => {
    const manager = readFileSync(
      path.resolve(process.cwd(), "client/src/components/PlanningTeamAccessManager.tsx"),
      "utf8"
    );

    expect(manager).toContain("Fachbereichsrechte direkt festlegen");
    expect(manager).toContain('setModuleLevel("off")');
    expect(manager).toContain('setModuleLevel("read")');
    expect(manager).toContain('setModuleLevel("write")');
    expect(manager).not.toContain("Freigabestufe auswählen");
    expect(manager).not.toContain("Stufe wiederherstellen");
  });
});
