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
  // Historischer Wert: bleibt ausschließlich für die verlustfreie Übernahme
  // älterer Zugänge erhalten. Neue Zugänge verwenden moduleAccess.
  "read_all",
] as const;

export type PlanningModule = (typeof PLANNING_MODULES)[number];

export const EDITABLE_PLANNING_MODULES = PLANNING_MODULES.filter(
  (module): module is Exclude<PlanningModule, "read_all"> => module !== "read_all"
);

export type EditablePlanningModule = (typeof EDITABLE_PLANNING_MODULES)[number];

export const PLANNING_MODULE_ACCESS_LEVELS = ["off", "read", "write"] as const;
export type PlanningModuleAccessLevel =
  (typeof PLANNING_MODULE_ACCESS_LEVELS)[number];

/**
 * Fachbereichsstufen eines individuellen Planungsteamzugangs.
 *
 * off   = nicht sichtbar und serverseitig nicht lesbar
 * read  = sichtbar, aber ausschließlich lesend
 * write = lesen und innerhalb des Bereichs bearbeiten
 */
export type PlanningModuleAccess = Partial<
  Record<EditablePlanningModule, PlanningModuleAccessLevel>
>;

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

/** Historische Kurzform für den bisherigen, globalen Lesezugriff. */
export const READONLY_PLANNER_PERMISSIONS: readonly PlanningModule[] = ["read_all"];

export const FULL_PLANNER_MODULE_ACCESS: Readonly<
  Record<EditablePlanningModule, PlanningModuleAccessLevel>
> = Object.freeze(
  Object.fromEntries(
    EDITABLE_PLANNING_MODULES.map(module => [module, "write"])
  ) as Record<EditablePlanningModule, PlanningModuleAccessLevel>
);

export const READONLY_PLANNER_MODULE_ACCESS: Readonly<
  Record<EditablePlanningModule, PlanningModuleAccessLevel>
> = Object.freeze(
  Object.fromEntries(
    EDITABLE_PLANNING_MODULES.map(module => [module, "read"])
  ) as Record<EditablePlanningModule, PlanningModuleAccessLevel>
);

export const PLANNING_MODULE_META: Record<PlanningModule, { label: string; description: string }> = {
  contacts: {
    label: "Ansprechpartner",
    description: "Ansprechpartner und ihre Stammdaten ansehen oder verwalten.",
  },
  helpers: {
    label: "Helfer",
    description: "Helfer, Rückmeldungen und Verfügbarkeiten ansehen oder pflegen.",
  },
  schedule: {
    label: "Einsatzplan",
    description: "Schichten, Besetzungen und Bereichskontakte ansehen oder verwalten.",
  },
  preparation: {
    label: "Vorbereitung",
    description: "Aufgaben und Genehmigungen der Vorbereitung ansehen oder bearbeiten.",
  },
  postprocessing: {
    label: "Nachbereitung",
    description: "Nachbereitungsaufgaben ansehen oder bearbeiten.",
  },
  materials: {
    label: "Material",
    description: "Materialbedarf und Beschaffung ansehen oder bearbeiten.",
  },
  donations: {
    label: "Spenden",
    description: "Verpflegungs- und Sachspenden ansehen oder bearbeiten.",
  },
  finances: {
    label: "Finanzen",
    description: "Finanzpositionen ansehen oder bearbeiten.",
  },
  pdf: {
    label: "PDF-Ausgabe",
    description: "PDF-Ausgaben ansehen oder konfigurieren und erzeugen.",
  },
  read_all: {
    label: "Nur lesen",
    description: "Historischer Gesamt-Lesezugriff für alle Planungsbereiche.",
  },
};

export function isPlanningModule(value: string): value is PlanningModule {
  return (PLANNING_MODULES as readonly string[]).includes(value);
}

export function isEditablePlanningModule(value: string): value is EditablePlanningModule {
  return (EDITABLE_PLANNING_MODULES as readonly string[]).includes(value);
}

export function isPlanningModuleAccessLevel(
  value: unknown
): value is PlanningModuleAccessLevel {
  return (PLANNING_MODULE_ACCESS_LEVELS as readonly unknown[]).includes(value);
}

export function normalizePlanningModules(values: readonly string[] | null | undefined) {
  const normalized = new Set<PlanningModule>();
  for (const value of values ?? []) {
    if (isPlanningModule(value)) normalized.add(value);
  }
  return Array.from(normalized) as PlanningModule[];
}

export function emptyPlanningModuleAccess(): PlanningModuleAccess {
  return {};
}

/**
 * Übernimmt robuste Werte aus der Datenbank oder API. Nicht bekannte Felder
 * werden verworfen, fehlende Fachbereiche bleiben bewusst auf „aus“.
 */
export function normalizePlanningModuleAccess(value: unknown): PlanningModuleAccess {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const normalized: PlanningModuleAccess = {};
  for (const module of EDITABLE_PLANNING_MODULES) {
    const level = source[module];
    if (isPlanningModuleAccessLevel(level)) normalized[module] = level;
  }
  return normalized;
}

/**
 * Liest ältere Arrays verlustfrei ein. Ein leeres Array war vor der
 * Dreistufen-Einführung bewusst als globaler Lesezugriff definiert und wird
 * deshalb niemals stillschweigend zu „alles aus“ umgedeutet.
 */
export function moduleAccessFromLegacyPermissions(
  legacyPermissions: readonly PlanningModule[] | null | undefined
): PlanningModuleAccess {
  const permissions = legacyPermissions ?? [];
  const explicitModules = permissions.filter(m => m !== "read_all");
  if (explicitModules.length > 0) {
    const access: PlanningModuleAccess = {};
    for (const module of EDITABLE_PLANNING_MODULES) {
      if (explicitModules.includes(module)) access[module] = "write";
    }
    return access;
  }
  if (permissions.length === 0 || permissions.includes("read_all")) {
    return { ...READONLY_PLANNER_MODULE_ACCESS };
  }
  const access: PlanningModuleAccess = {};
  for (const module of EDITABLE_PLANNING_MODULES) {
    if (permissions.includes(module)) access[module] = "write";
  }
  return access;
}

/** Gibt die effektive Stufe zurück; Arraywerte werden als Altbestand behandelt. */
export function planningModuleAccessLevel(
  access: PlanningModuleAccess | readonly PlanningModule[] | null | undefined,
  module: EditablePlanningModule
): PlanningModuleAccessLevel {
  if (Array.isArray(access)) {
    return moduleAccessFromLegacyPermissions(access)[module] ?? "off";
  }
  return normalizePlanningModuleAccess(access)[module] ?? "off";
}

export function mayReadPlanningModule(
  access: PlanningModuleAccess | readonly PlanningModule[] | null | undefined,
  module: EditablePlanningModule
) {
  const level = planningModuleAccessLevel(access, module);
  return level === "read" || level === "write";
}

export function mayWritePlanningModule(
  access: PlanningModuleAccess | readonly PlanningModule[] | null | undefined,
  module: EditablePlanningModule
) {
  return planningModuleAccessLevel(access, module) === "write";
}

export function moduleAccessHasAnyPermission(
  access: PlanningModuleAccess | readonly PlanningModule[] | null | undefined
) {
  return EDITABLE_PLANNING_MODULES.some(
    module => planningModuleAccessLevel(access, module) !== "off"
  );
}

/** Für ältere API-Konsumenten: liefert nur aktive Schreibrechte. */
export function legacyPermissionsFromModuleAccess(
  access: PlanningModuleAccess | null | undefined
): PlanningModule[] {
  return EDITABLE_PLANNING_MODULES.filter(
    module => planningModuleAccessLevel(access, module) === "write"
  );
}
