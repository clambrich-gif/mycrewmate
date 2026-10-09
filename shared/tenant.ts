export type TenantStatus =
  | "pilot"
  | "sample"
  | "active"
  | "suspended"
  | "archived";

export interface TenantBranding {
  platformName: string;
  organizationName: string;
  organizationSubtitle: string;
  badgeLabel?: string;
  logoUrl?: string | null;
}

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  legalName: string;
  status: TenantStatus;
  planName: string;
  defaultEventName: string;
  supportEmail: string;
  contactEmail: string;
  branding: TenantBranding;
}

/** Ausschließlich fiktive, lokale Mustervereine für Vorschau- und Testzwecke. */
export const KIRMESVEREIN_SAMPLE_TENANT: TenantConfig = {
  id: "kirmesverein-musterstadt",
  slug: "kirmesverein-musterstadt",
  name: "Kirmesverein Musterstadt e. V.",
  legalName: "Kirmesverein Musterstadt e. V.",
  status: "sample",
  planName: "Musterverein",
  defaultEventName: "Musterstädter Kirmes 2027",
  supportEmail: "support@mycrewmate.de",
  contactEmail: "info@mycrewmate.de",
  branding: {
    platformName: "MyCrewMate",
    organizationName: "Kirmesverein Musterstadt e. V.",
    organizationSubtitle: "KIRMES- & EVENTPLANUNG",
    badgeLabel: "Musterverein",
    logoUrl: null,
  },
};

export const SCHUETZENVEREIN_SAMPLE_TENANT: TenantConfig = {
  id: "schuetzenverein-musterhausen",
  slug: "schuetzenverein-musterhausen",
  name: "Schützenverein Musterhausen e. V.",
  legalName: "Schützenverein Musterhausen e. V.",
  status: "sample",
  planName: "Musterverein",
  defaultEventName: "Schützenfest Musterhausen 2027",
  supportEmail: "support@mycrewmate.de",
  contactEmail: "info@mycrewmate.de",
  branding: {
    platformName: "MyCrewMate",
    organizationName: "Schützenverein Musterhausen e. V.",
    organizationSubtitle: "SCHÜTZENFEST- & EVENTPLANUNG",
    badgeLabel: "Musterverein",
    logoUrl: null,
  },
};

export const TENANT_CATALOG: readonly TenantConfig[] = [
  KIRMESVEREIN_SAMPLE_TENANT,
  SCHUETZENVEREIN_SAMPLE_TENANT,
];
