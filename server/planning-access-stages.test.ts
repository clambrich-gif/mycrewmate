import { describe, expect, it } from "vitest";
import {
  EDITABLE_PLANNING_MODULES,
  mayReadPlanningModule,
  mayWritePlanningModule,
  type PlanningModuleAccess,
} from "@shared/tenant-permissions";
import {
  PLANNING_ACCESS_STAGES,
  PLANNING_ACCESS_STAGE_META,
  planningAccessStageDefaults,
  planningAccessStageExceptionCount,
} from "@shared/planning-access-stages";

describe("4-Stufen-Freigabemodell und individuelle Ausnahmen", () => {
  it("bietet alle 4 definierten Freigabestufen mit Metadaten an", () => {
    expect(PLANNING_ACCESS_STAGES).toEqual([
      "stage_1",
      "stage_2",
      "stage_3",
      "stage_4",
    ]);

    for (const stage of PLANNING_ACCESS_STAGES) {
      const meta = PLANNING_ACCESS_STAGE_META[stage];
      expect(meta.title).toBeTruthy();
      expect(meta.shortTitle).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.focus).toBeTruthy();
    }
  });

  it("konfiguriert Stufe 1 ausschließlich für Kontakte, Helfer und Spenden", () => {
    const stage1 = planningAccessStageDefaults("stage_1");

    expect(stage1.contacts).toBe("read");
    expect(stage1.helpers).toBe("write");
    expect(stage1.donations).toBe("write");

    expect(stage1.schedule).toBe("off");
    expect(stage1.preparation).toBe("off");
    expect(stage1.postprocessing).toBe("off");
    expect(stage1.materials).toBe("off");
    expect(stage1.finances).toBe("off");
    expect(stage1.locations).toBe("off");
    expect(stage1.pdf).toBe("off");

    expect(mayReadPlanningModule(stage1, "helpers")).toBe(true);
    expect(mayWritePlanningModule(stage1, "helpers")).toBe(true);
    expect(mayReadPlanningModule(stage1, "schedule")).toBe(false);
  });

  it("schaltet in Stufe 2 den Einsatzplan und PDF nur als Leseansicht frei", () => {
    const stage2 = planningAccessStageDefaults("stage_2");

    expect(stage2.schedule).toBe("read");
    expect(stage2.pdf).toBe("read");
    expect(mayReadPlanningModule(stage2, "schedule")).toBe(true);
    expect(mayWritePlanningModule(stage2, "schedule")).toBe(false);
    expect(mayReadPlanningModule(stage2, "pdf")).toBe(true);
    expect(mayWritePlanningModule(stage2, "pdf")).toBe(false);

    expect(stage2.materials).toBe("off");
    expect(stage2.finances).toBe("off");
  });

  it("erlaubt individuelle Ausnahmen auf einer Stufe und zählt Abweichungen präzise", () => {
    const stage1Defaults = planningAccessStageDefaults("stage_1");
    expect(planningAccessStageExceptionCount(stage1Defaults, "stage_1")).toBe(0);

    const customizedStage1: PlanningModuleAccess = {
      ...stage1Defaults,
      schedule: "read", // Ausnahme 1: darf Einsatzplan trotz Stufe 1 sehen
      preparation: "write", // Ausnahme 2: hilft beim Aufbau mit
    };

    expect(
      planningAccessStageExceptionCount(customizedStage1, "stage_1")
    ).toBe(2);
    expect(mayReadPlanningModule(customizedStage1, "schedule")).toBe(true);
    expect(mayWritePlanningModule(customizedStage1, "schedule")).toBe(false);
    expect(mayWritePlanningModule(customizedStage1, "preparation")).toBe(true);
  });

  it("erlaubt das Zurücksetzen einer individuellen Anpassung auf die Stufen-Standards", () => {
    const customized: PlanningModuleAccess = {
      ...planningAccessStageDefaults("stage_1"),
      schedule: "write",
      finances: "read",
    };

    expect(planningAccessStageExceptionCount(customized, "stage_1")).toBe(2);

    const restored = planningAccessStageDefaults("stage_1");
    expect(planningAccessStageExceptionCount(restored, "stage_1")).toBe(0);
    expect(restored.schedule).toBe("off");
    expect(restored.finances).toBe("off");
  });

  it("schützt Finanzen standardmäßig in allen 4 Basisstufen vor versehentlicher Freigabe", () => {
    for (const stage of PLANNING_ACCESS_STAGES) {
      const defaults = planningAccessStageDefaults(stage);
      expect(defaults.finances).toBe("off");
      expect(mayReadPlanningModule(defaults, "finances")).toBe(false);
      expect(mayWritePlanningModule(defaults, "finances")).toBe(false);
    }
  });

  it("hält alle bearbeitbaren Fachbereiche in jeder Stufe vollständig und konsistent vor", () => {
    for (const stage of PLANNING_ACCESS_STAGES) {
      const defaults = planningAccessStageDefaults(stage);
      for (const module of EDITABLE_PLANNING_MODULES) {
        expect(["off", "read", "write"]).toContain(defaults[module]);
      }
    }
  });
});
