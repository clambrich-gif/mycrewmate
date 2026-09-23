export const PLANNING_MODULES = [
  "contacts",
  "helpers",
  "schedule",
  "preparation",
  "postprocessing",
  "materials",
  "donations",
  "finances",
  "pdf",
  "read_all",
] as const;

export type PlanningModule = (typeof PLANNING_MODULES)[number];

export const EDITABLE_PLANNING_MODULES = PLANNING_MODULES.filter(
  (module): module is Exclude<PlanningModule, "read_all"> => module !== "read_all"
);

export const FULL_PLANNER_PERMISSIONS: readonly PlanningModule[] = [
  "contacts",
  "helpers",
  "schedule",
  "preparation",
  "postprocessing",
  "materials",
  "donations",
  "finances",
  "pdf",
  "read_all",
];

export const PLANNING_MODULE_META: Record<PlanningModule, { label: string; description: string }> = {
  contacts: {
    label: "Ansprechpartner & Helfer",
    description: "Ansprechpartner und Helferdaten verwalten.",
  },
  helpers: {
    label: "Helfer",
    description: "Helfer anlegen, bearbeiten und Rückmeldungen pflegen.",
  },
  schedule: {
    label: "Einsatzplan",
    description: "Schichten, Besetzungen und Bereichskontakte verwalten.",
  },
  preparation: {
    label: "Vorbereitung",
    description: "Aufgaben und Genehmigungen der Vorbereitung bearbeiten.",
  },
  postprocessing: {
    label: "Nachbereitung",
    description: "Nachbereitungsaufgaben bearbeiten.",
  },
  materials: {
    label: "Material",
    description: "Materialbedarf und Beschaffung bearbeiten.",
  },
  donations: {
    label: "Spenden",
    description: "Verpflegungs- und Sachspenden bearbeiten.",
  },
  finances: {
    label: "Finanzen",
    description: "Finanzpositionen ansehen und bearbeiten.",
  },
  pdf: {
    label: "PDF-Ausgabe",
    description: "Freigegebene Listen und Übersichten erzeugen.",
  },
  read_all: {
    label: "Nur lesen",
    description: "Alle Planungsbereiche ansehen, ohne Daten zu verändern.",
  },
};

export function isPlanningModule(value: string): value is PlanningModule {
  return (PLANNING_MODULES as readonly string[]).includes(value);
}

export function normalizePlanningModules(values: readonly string[] | null | undefined) {
  const normalized = new Set<PlanningModule>();
  for (const value of values ?? []) {
    if (isPlanningModule(value)) normalized.add(value);
  }
  return Array.from(normalized) as PlanningModule[];
}

export function mayReadPlanningModule(
  permissions: readonly PlanningModule[],
  module: Exclude<PlanningModule, "read_all">
) {
  return permissions.includes("read_all") || permissions.includes(module);
}

export function mayWritePlanningModule(
  permissions: readonly PlanningModule[],
  module: Exclude<PlanningModule, "read_all">
) {
  return permissions.includes(module);
}
