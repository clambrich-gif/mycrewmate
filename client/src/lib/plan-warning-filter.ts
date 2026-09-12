export const PLAN_WARNING_QUERY_KEY = "warnung";

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

export function parsePlanWarningFilter(
  value: string | null
): PlanWarningSelection {
  return value === "konflikte" || value === "ausfaelle" ? value : "alle";
}

export function planWarningHref(filter: PlanWarningFilter) {
  const params = new URLSearchParams({ [PLAN_WARNING_QUERY_KEY]: filter });
  return `/einsatzplan?${params.toString()}`;
}
