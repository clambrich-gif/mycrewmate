import type { ProductAssignmentStatus } from "./product-packages";

/**
 * Verständliche Auswahl im Master-Portal. Die technische Vereinsverwaltung
 * behält getrennte Statuswerte für Anmeldung, Archivierung und Datenfristen.
 */
export const TENANT_ACCESS_MODES = [
  "pilot",
  "test",
  "active",
  "paused",
  "expired",
] as const;

export type TenantAccessMode = (typeof TENANT_ACCESS_MODES)[number];

type TenantLifecycleStatus =
  | "pilot"
  | "sample"
  | "active"
  | "suspended"
  | "archived";

type TenantCreationStatus = "pilot" | "sample" | "active";

export const MYCREWMATE_SUPPORT_EMAIL = "support@mycrewmate.de";

export const TENANT_ACCESS_MODE_META: Record<
  TenantAccessMode,
  { label: string; description: string }
> = {
  pilot: {
    label: "Pilotzugang",
    description: "Abgestimmter Zugang für die laufende Pilotphase.",
  },
  test: {
    label: "Testzugang",
    description: "Unverbindlicher Zugang zum Ausprobieren.",
  },
  active: {
    label: "Aktiv",
    description: "Regulär freigeschalteter Vereinszugang.",
  },
  paused: {
    label: "Pausiert",
    description: "Anmeldung ist vorübergehend gesperrt.",
  },
  expired: {
    label: "Abgelaufen",
    description: "Anmeldung ist gesperrt, bis ein neuer Zugangsstatus gewählt wird.",
  },
};

/**
 * Übersetzt die eine sichtbare Auswahl in die weiterhin getrennt benötigten
 * internen Werte. So bleiben Archivierung, Sperren und Anmeldeschutz stabil.
 */
export function tenantCreationSetupForAccessMode(accessMode: TenantAccessMode): {
  tenantStatus: TenantCreationStatus;
  packageStatus: ProductAssignmentStatus;
  planName: string;
} {
  switch (accessMode) {
    case "pilot":
      return {
        tenantStatus: "pilot",
        packageStatus: "test",
        planName: "Pilotzugang",
      };
    case "test":
      return {
        tenantStatus: "sample",
        packageStatus: "test",
        planName: "Testzugang",
      };
    case "active":
      return {
        tenantStatus: "active",
        packageStatus: "active",
        planName: "Aktiver Zugang",
      };
    case "paused":
      return {
        tenantStatus: "sample",
        packageStatus: "paused",
        planName: "Pausierter Zugang",
      };
    case "expired":
      return {
        tenantStatus: "sample",
        packageStatus: "expired",
        planName: "Abgelaufener Zugang",
      };
  }
}

/** Ermittelt den einen verständlichen Status für die Vereinsübersicht. */
export function tenantAccessModeFromState(input: {
  tenantStatus: TenantLifecycleStatus;
  packageStatus: ProductAssignmentStatus | null | undefined;
}): TenantAccessMode {
  if (input.packageStatus === "paused" || input.tenantStatus === "suspended") {
    return "paused";
  }
  if (input.packageStatus === "expired" || input.tenantStatus === "archived") {
    return "expired";
  }
  if (input.packageStatus === "active" || input.tenantStatus === "active") {
    return "active";
  }
  return input.tenantStatus === "pilot" ? "pilot" : "test";
}

/**
 * Ein bestätigter regulärer Paketstatus beendet den Pilotzugang bewusst.
 * Dadurch bleibt der Verein samt Planungsdaten erhalten, wird aber nicht mehr
 * durch die automatische Pilotende-Routine archiviert.
 */
export function tenantStatusAfterProductAssignment(input: {
  tenantStatus: TenantLifecycleStatus;
  packageStatus: ProductAssignmentStatus;
}): TenantLifecycleStatus {
  if (input.tenantStatus === "pilot" && input.packageStatus === "active") {
    return "active";
  }
  return input.tenantStatus;
}
