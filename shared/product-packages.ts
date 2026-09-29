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
