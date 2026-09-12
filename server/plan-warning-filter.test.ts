import { describe, expect, it } from "vitest";
import {
  parsePlanWarningFilter,
  planWarningHref,
} from "../client/src/lib/plan-warning-filter";

describe("Dashboard-Warnungsnavigation", () => {
  it("erzeugt stabile Einsatzplan-URLs für beide Warnungsarten", () => {
    expect(planWarningHref("konflikte")).toBe(
      "/einsatzplan?warnung=konflikte"
    );
    expect(planWarningHref("ausfaelle")).toBe(
      "/einsatzplan?warnung=ausfaelle"
    );
  });

  it("akzeptiert nur unterstützte Warnfilter", () => {
    expect(parsePlanWarningFilter("konflikte")).toBe("konflikte");
    expect(parsePlanWarningFilter("ausfaelle")).toBe("ausfaelle");
    expect(parsePlanWarningFilter("unbekannt")).toBe("alle");
    expect(parsePlanWarningFilter(null)).toBe("alle");
  });
});
