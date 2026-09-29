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
  "maps_gpx",
] as const;

export type ProductCapability = (typeof PRODUCT_CAPABILITIES)[number];

export type ProductPackageEntitlements = {
  /** Höchstzahl von Veranstaltungen innerhalb eines Veranstaltungsjahres. */
  maxEventsPerYear: number | null;
  /** Historischer Kompatibilitätswert für den einmaligen Event Pass. */
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
  maps_gpx: false,
});

/**
 * Light ist bewusst kein verkleinertes Pro: Es begleitet eine jährliche
 * Hauptveranstaltung mit einem kleinen persönlichen Team. Live-Kommunikation,
 * Spenden/Finanzen sowie Karten- und Streckenplanung bleiben Pro vorbehalten.
 */
const LIGHT_CAPABILITIES: Readonly<Record<ProductCapability, boolean>> = Object.freeze({
  ...UNLIMITED_PRODUCT_CAPABILITIES,
  additional_events: false,
  event_deletion: false,
  donations: false,
  finances: false,
  chat: false,
  excel: false,
  project_backup: false,
  marketing: false,
  approvals: false,
  maps_gpx: false,
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
    maxEventsPerYear: 1,
    maxEventsPerTenant: 1,
    maxHelpersPerEvent: 50,
    maxPersonalPlanningAccesses: 0,
    capabilities: EVENT_PASS_CAPABILITIES,
  },
  light: {
    maxEventsPerYear: 1,
    maxEventsPerTenant: null,
    maxHelpersPerEvent: 150,
    maxPersonalPlanningAccesses: 5,
    capabilities: LIGHT_CAPABILITIES,
  },
  pro: {
    maxEventsPerYear: null,
    maxEventsPerTenant: null,
    maxHelpersPerEvent: null,
    maxPersonalPlanningAccesses: null,
    capabilities: UNLIMITED_PRODUCT_CAPABILITIES,
  },
  enterprise: {
    maxEventsPerYear: null,
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
  if (packageId === "event_pass") return EVENT_PASS_ROUTE_ALLOWLIST.has(path);
  const capability = productCapabilityForAppRoute(path);
  return !capability || productAllowsCapability(packageId, capability);
}

const PRODUCT_ROUTE_CAPABILITY: Readonly<Partial<Record<string, ProductCapability>>> = {
  "/ansprechpartner": "contacts",
  "/helfer": "helpers",
  "/einsatzplan": "schedule",
  "/vorbereitung": "preparation",
  "/nachbereitung": "postprocessing",
  "/material": "materials",
  "/spenden": "donations",
  "/kuchen": "donations",
  "/finanzen": "finances",
  "/pdf-export": "pdf",
  "/orte": "locations",
  "/marketing": "marketing",
  "/genehmigungen": "approvals",
};

export function productCapabilityForAppRoute(path: string): ProductCapability | null {
  return PRODUCT_ROUTE_CAPABILITY[path] ?? null;
}

/** Ermittelt das kleinste reguläre Paket, das eine gesperrte Funktion enthält. */
export function requiredUpgradePackageForCapability(
  currentPackageId: ProductPackageId,
  capability: ProductCapability
): ProductPackageId | null {
  if (productAllowsCapability(currentPackageId, capability)) return null;
  if (productAllowsCapability("light", capability)) return "light";
  if (productAllowsCapability("pro", capability)) return "pro";
  return "enterprise";
}

export type ProductPackageMeta = {
  name: string;
  priceLabel: string;
  shortDescription: string;
  assignmentStatusLabel: Record<ProductAssignmentStatus, string>;
};

/**
 * Zentrale Grundlage für die Paketsteuerung. Paketzuordnung, serverseitige
 * Entitlements und individuelle Fachbereichsrechte bleiben bewusst getrennt.
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
