import {
  EDITABLE_PLANNING_MODULES,
  type EditablePlanningModule,
  type PlanningModuleAccess,
  type PlanningModuleAccessLevel,
} from "./tenant-permissions";

export const PLANNING_ACCESS_STAGES = [
  "stage_1",
  "stage_2",
  "stage_3",
  "stage_4",
] as const;

export type PlanningAccessStageId = (typeof PLANNING_ACCESS_STAGES)[number];

type PlanningAccessStageDefinition = {
  number: 1 | 2 | 3 | 4;
  title: string;
  shortTitle: string;
  description: string;
  focus: string;
  defaults: Readonly<PlanningModuleAccess>;
};

function moduleAccess(
  values: Partial<Record<EditablePlanningModule, PlanningModuleAccessLevel>>
): PlanningModuleAccess {
  return Object.fromEntries(
    EDITABLE_PLANNING_MODULES.map(module => [module, values[module] ?? "off"])
  ) as PlanningModuleAccess;
}

/**
 * Die vier Stufen sind praxistaugliche Startvorlagen. Eine Vorlage ist nie eine
 * zusätzliche Sicherheitsgrenze: Die tatsächlich gespeicherten Modulrechte
 * bleiben die alleinige, serverseitig geprüfte Quelle.
 */
export const PLANNING_ACCESS_STAGE_META: Record<
  PlanningAccessStageId,
  PlanningAccessStageDefinition
> = {
  stage_1: {
    number: 1,
    title: "Stufe 1 · Helfer gewinnen & erfassen",
    shortTitle: "Helfer organisieren",
    description:
      "Ansprechpartner konzentrieren sich auf Kontakte, Helfer, Verfügbarkeiten und Spenden.",
    focus: "Helfer, Verfügbarkeiten und Spenden",
    defaults: moduleAccess({
      contacts: "read",
      helpers: "write",
      donations: "write",
    }),
  },
  stage_2: {
    number: 2,
    title: "Stufe 2 · Einsatzplan kommunizieren",
    shortTitle: "Plan kommunizieren",
    description:
      "Der geprüfte Plan ist sichtbar; Ansprechpartner informieren Helfer und pflegen Rückmeldungen.",
    focus: "Einsatzplan ansehen, Helfer informieren und Rückmeldungen pflegen",
    defaults: moduleAccess({
      contacts: "read",
      helpers: "write",
      schedule: "read",
      donations: "write",
      pdf: "read",
    }),
  },
  stage_3: {
    number: 3,
    title: "Stufe 3 · Bereich gezielt unterstützen",
    shortTitle: "Bereich unterstützen",
    description:
      "In der heißen Phase kommen nur die für die konkrete Zusatzaufgabe nötigen Bereiche hinzu.",
    focus: "Vorbereitung, Material und Orientierung am Einsatzort",
    defaults: moduleAccess({
      contacts: "read",
      helpers: "write",
      schedule: "read",
      preparation: "write",
      materials: "write",
      donations: "write",
      pdf: "read",
      locations: "read",
    }),
  },
  stage_4: {
    number: 4,
    title: "Stufe 4 · Durchführung & Nachbereitung",
    shortTitle: "Abschluss organisieren",
    description:
      "Nach dem Event werden Rückgaben, offene Punkte, Spenden und Erfahrungen sauber abgeschlossen.",
    focus: "Materialrückgabe, Nachbereitung und Abschluss",
    defaults: moduleAccess({
      contacts: "read",
      helpers: "write",
      schedule: "read",
      postprocessing: "write",
      materials: "write",
      donations: "write",
      pdf: "read",
      locations: "read",
    }),
  },
};

export function isPlanningAccessStageId(value: unknown): value is PlanningAccessStageId {
  return (PLANNING_ACCESS_STAGES as readonly unknown[]).includes(value);
}

export function planningAccessStageDefaults(stage: PlanningAccessStageId): PlanningModuleAccess {
  return { ...PLANNING_ACCESS_STAGE_META[stage].defaults };
}

export function planningAccessStageExceptionCount(
  access: PlanningModuleAccess,
  stage: PlanningAccessStageId
) {
  const defaults = planningAccessStageDefaults(stage);
  return EDITABLE_PLANNING_MODULES.filter(
    module => (access[module] ?? "off") !== (defaults[module] ?? "off")
  ).length;
}
