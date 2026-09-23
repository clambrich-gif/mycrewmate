export type TenantStatus = "pilot" | "active" | "suspended" | "archived";

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

export const ACTIVE_PILOT_TENANT = RSC_MAYEN_PILOT_TENANT;
