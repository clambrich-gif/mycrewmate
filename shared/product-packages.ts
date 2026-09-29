export const PRODUCT_PACKAGE_IDS = [
  "event_pass",
  "light",
  "pro",
  "enterprise",
] as const;

export type ProductPackageId = (typeof PRODUCT_PACKAGE_IDS)[number];

export const DEFAULT_PRODUCT_PACKAGE_ID: ProductPackageId = "pro";

export const PRODUCT_ASSIGNMENT_STATUSES = [
  "test",
  "active",
  "paused",
  "expired",
] as const;

export type ProductAssignmentStatus = (typeof PRODUCT_ASSIGNMENT_STATUSES)[number];

export const DEFAULT_PRODUCT_ASSIGNMENT_STATUS: ProductAssignmentStatus = "test";

/**
 * Produktrechte stehen bewusst neben den persönlichen Fachbereichsrechten.
 * Erstere beschreiben den vertraglich verfügbaren Funktionsumfang eines Vereins;
 * letztere regeln, welche einzelne Person innerhalb dieses Umfangs sehen oder
 * bearbeiten darf.
 */
export const PRODUCT_CAPABILITIES = [
  "additional_events",
  "event_years",
  "event_deletion",
  "contacts",
  "helpers",
  "schedule",
  "preparation",
  "postprocessing",
  "materials",
  "donations",
  "finances",
  "pdf",
  "locations",
  "chat",
  "personal_accesses",
  "excel",
  "project_backup",
  "marketing",
  "approvals",
] as const;

export type ProductCapability = (typeof PRODUCT_CAPABILITIES)[number];

export type ProductPackageEntitlements = {
  maxEventsPerTenant: number | null;
  maxHelpersPerEvent: number | null;
  maxPersonalPlanningAccesses: number | null;
  capabilities: Readonly<Record<ProductCapability, boolean>>;
};

const UNLIMITED_PRODUCT_CAPABILITIES: Readonly<Record<ProductCapability, boolean>> =
  Object.freeze(
    Object.fromEntries(PRODUCT_CAPABILITIES.map(capability => [capability, true])) as Record<
      ProductCapability,
      boolean
    >
  );

const EVENT_PASS_CAPABILITIES: Readonly<Record<ProductCapability, boolean>> = Object.freeze({
  ...UNLIMITED_PRODUCT_CAPABILITIES,
  additional_events: false,
  event_years: false,
  event_deletion: false,
  contacts: false,
  postprocessing: false,
  materials: false,
  donations: false,
  finances: false,
  locations: false,
  chat: false,
  personal_accesses: false,
  excel: false,
  project_backup: false,
  marketing: false,
  approvals: false,
});

const EVENT_PASS_ROUTE_ALLOWLIST = new Set([
  "/",
  "/dashboard",
  "/helfer",
  "/einsatzplan",
  "/vorbereitung",
  "/pdf-export",
  "/sicherheit",
  "/hilfe",
  "/login",
  "/aktivieren",
]);

export const PRODUCT_PACKAGE_ENTITLEMENTS: Readonly<
  Record<ProductPackageId, ProductPackageEntitlements>
> = Object.freeze({
  event_pass: {
    maxEventsPerTenant: 1,
    maxHelpersPerEvent: 50,
    maxPersonalPlanningAccesses: 0,
    capabilities: EVENT_PASS_CAPABILITIES,
  },
  // Paket 2 aktiviert bewusst nur den Event Pass. Light, Pro und Enterprise
  // behalten bis zu ihren jeweiligen Ausbaupaketen ihren bisherigen Umfang.
  light: {
    maxEventsPerTenant: null,
    maxHelpersPerEvent: null,
    maxPersonalPlanningAccesses: null,
    capabilities: UNLIMITED_PRODUCT_CAPABILITIES,
  },
  pro: {
    maxEventsPerTenant: null,
    maxHelpersPerEvent: null,
    maxPersonalPlanningAccesses: null,
    capabilities: UNLIMITED_PRODUCT_CAPABILITIES,
  },
  enterprise: {
    maxEventsPerTenant: null,
    maxHelpersPerEvent: null,
    maxPersonalPlanningAccesses: null,
    capabilities: UNLIMITED_PRODUCT_CAPABILITIES,
  },
});

export function productAllowsCapability(
  packageId: ProductPackageId,
  capability: ProductCapability
) {
  return PRODUCT_PACKAGE_ENTITLEMENTS[packageId].capabilities[capability];
}

export function productAllowsPlanningModule(
  packageId: ProductPackageId,
  module: import("./tenant-permissions").EditablePlanningModule
) {
  const capabilityByModule: Record<
    import("./tenant-permissions").EditablePlanningModule,
    ProductCapability
  > = {
    contacts: "contacts",
    helpers: "helpers",
    schedule: "schedule",
    preparation: "preparation",
    postprocessing: "postprocessing",
    materials: "materials",
    donations: "donations",
    finances: "finances",
    pdf: "pdf",
    locations: "locations",
  };
  return productAllowsCapability(packageId, capabilityByModule[module]);
}

export function productAllowsAppRoute(packageId: ProductPackageId, path: string) {
  return packageId !== "event_pass" || EVENT_PASS_ROUTE_ALLOWLIST.has(path);
}

export type ProductPackageMeta = {
  name: string;
  priceLabel: string;
  shortDescription: string;
  assignmentStatusLabel: Record<ProductAssignmentStatus, string>;
};

/**
 * Zentrale, bewusst produktneutrale Grundlage für die Paketsteuerung.
 * Paket 1 zeigt und speichert diese Zuordnung ausschließlich im Master-Admin;
 * fachliche Modul- und Mengenprüfungen folgen schrittweise in den Paketen 2–5.
 */
export const PRODUCT_PACKAGE_META: Record<ProductPackageId, ProductPackageMeta> = {
  event_pass: {
    name: "Event Pass",
    priceLabel: "69 € · einmalig",
    shortDescription: "Eine klar abgegrenzte Veranstaltung.",
    assignmentStatusLabel: {
      test: "Testzugang",
      active: "Aktiv",
      paused: "Pausiert",
      expired: "Abgelaufen",
    },
  },
  light: {
    name: "Light",
    priceLabel: "149 € · Veranstaltungsjahr",
    shortDescription: "Der feste Ablauf für eine Hauptveranstaltung.",
    assignmentStatusLabel: {
      test: "Testzugang",
      active: "Aktiv",
      paused: "Pausiert",
      expired: "Abgelaufen",
    },
  },
  pro: {
    name: "Pro",
    priceLabel: "299 € · Veranstaltungsjahr",
    shortDescription: "Der volle Vereinsumfang für aktive Teams.",
    assignmentStatusLabel: {
      test: "Testzugang",
      active: "Aktiv",
      paused: "Pausiert",
      expired: "Abgelaufen",
    },
  },
  enterprise: {
    name: "Enterprise",
    priceLabel: "ab 449 € · Veranstaltungsjahr",
    shortDescription: "Pro plus individuell vereinbarte Erweiterungen.",
    assignmentStatusLabel: {
      test: "Testzugang",
      active: "Aktiv",
      paused: "Pausiert",
      expired: "Abgelaufen",
    },
  },
};

export function isProductPackageId(value: unknown): value is ProductPackageId {
  return typeof value === "string" && PRODUCT_PACKAGE_IDS.includes(value as ProductPackageId);
}

export function isProductAssignmentStatus(value: unknown): value is ProductAssignmentStatus {
  return (
    typeof value === "string" &&
    PRODUCT_ASSIGNMENT_STATUSES.includes(value as ProductAssignmentStatus)
  );
}
