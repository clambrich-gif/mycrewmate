export const PLAN_WARNING_QUERY_KEY = "warnung";
export const PLAN_STATUS_QUERY_KEY = "status";
export const TASK_STATUS_QUERY_KEY = "status";
export const HELPER_CONFIRMATION_QUERY_KEY = "bestaetigt";
export const HELPER_ASSIGNMENT_QUERY_KEY = "eingeteilt";
export const HELPER_FIRST_CONTACT_QUERY_KEY = "erstkontakt";

export const PLAN_WARNING_FILTERS = {
  konflikte: {
    label: "Nur Doppelbelegungen",
    summary: "Es werden nur Schichten mit zeitlichen Doppelbelegungen angezeigt.",
  },
  ausfaelle: {
    label: "Nur Ausfälle",
    summary: "Es werden nur Schichten mit ausgefallenen Helfern angezeigt.",
  },
} as const;

export type PlanWarningFilter = keyof typeof PLAN_WARNING_FILTERS;
export type PlanWarningSelection = "alle" | PlanWarningFilter;
export type PlanStatusFilter = "alle" | "OFFEN" | "KNAPP" | "OK";
export type TaskStatusFilter =
  | "alle"
  | "offen"
  | "inArbeit"
  | "erledigt"
  | "abgelehnt";
export type HelperConfirmationFilter = "alle" | "ja" | "nein";
export type HelperFirstContactFilter = "alle" | "offen";

export type DashboardTarget =
  | { path: "/einsatzplan" }
  | { path: "/einsatzplan"; warning: PlanWarningFilter }
  | { path: "/einsatzplan"; status: Exclude<PlanStatusFilter, "alle"> }
  | { path: "/vorbereitung" }
  | {
      path: "/helfer";
      confirmed: Exclude<HelperConfirmationFilter, "alle">;
      assigned: true;
    }
  | {
      path: "/helfer";
      firstContact: "offen";
    }
  | {
      path: "/vorbereitung" | "/nachbereitung";
      status: "offen" | "abgelehnt";
    };

export function parsePlanWarningFilter(
  value: string | null
): PlanWarningSelection {
  return value === "konflikte" || value === "ausfaelle" ? value : "alle";
}

export function parsePlanStatusFilter(value: string | null): PlanStatusFilter {
  return value === "OFFEN" || value === "KNAPP" || value === "OK"
    ? value
    : "alle";
}

export function parseTaskStatusFilter(value: string | null): TaskStatusFilter {
  return value === "offen" ||
    value === "inArbeit" ||
    value === "erledigt" ||
    value === "abgelehnt"
    ? value
    : "alle";
}

export function parseHelperConfirmationFilter(
  value: string | null
): HelperConfirmationFilter {
  return value === "ja" || value === "nein" ? value : "alle";
}

export function parseHelperAssignmentFilter(value: string | null) {
  return value === "ja";
}

export function parseHelperFirstContactFilter(
  value: string | null
): HelperFirstContactFilter {
  return value === "offen" ? "offen" : "alle";
}

export function dashboardTargetHref(target: DashboardTarget) {
  const params = new URLSearchParams();
  if ("warning" in target) params.set(PLAN_WARNING_QUERY_KEY, target.warning);
  if ("status" in target) params.set(PLAN_STATUS_QUERY_KEY, target.status);
  if ("confirmed" in target) {
    params.set(HELPER_CONFIRMATION_QUERY_KEY, target.confirmed);
  }
  if ("assigned" in target && target.assigned) {
    params.set(HELPER_ASSIGNMENT_QUERY_KEY, "ja");
  }
  if ("firstContact" in target) {
    params.set(HELPER_FIRST_CONTACT_QUERY_KEY, target.firstContact);
  }
  return `${target.path}?${params.toString()}`;
}
