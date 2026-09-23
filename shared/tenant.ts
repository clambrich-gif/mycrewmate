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

export const RSC_MAYEN_PILOT_TENANT: TenantConfig = {
  id: "rsc-eifelland-mayen",
  slug: "rsc-mayen",
  name: "RSC Eifelland Mayen e. V.",
  legalName: "Radsportclub Eifelland Mayen e. V.",
  status: "pilot",
  planName: "Pilotbetrieb",
  defaultEventName: "MyEifelRide 2027",
  supportEmail: "support@mycrewmate.de",
  contactEmail: "info@mycrewmate.de",
  branding: {
    platformName: "MyCrewMate",
    organizationName: "RSC Eifelland Mayen e. V.",
    organizationSubtitle: "VEREINS- & EVENTPLANUNG",
    badgeLabel: "Pilotverein",
    logoUrl: null,
  },
};

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
  RSC_MAYEN_PILOT_TENANT,
  KIRMESVEREIN_SAMPLE_TENANT,
  SCHUETZENVEREIN_SAMPLE_TENANT,
];

export const ACTIVE_PILOT_TENANT = RSC_MAYEN_PILOT_TENANT;
