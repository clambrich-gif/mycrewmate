import { describe, expect, it } from "vitest";
import {
  dashboardTargetHref,
  parseHelperAssignmentFilter,
  parseHelperConfirmationFilter,
  parseHelperFirstContactFilter,
  parsePlanDayFilter,
  parsePlanHelperFilter,
  parsePlanStatusFilter,
  parsePlanWarningFilter,
  planStatusMatchesFilter,
  parseTaskStatusFilter,
} from "../client/src/lib/dashboard-target-filter";

describe("Dashboard-Zielnavigation", () => {
  it("erzeugt stabile Einsatzplan-URLs für Warnungs- und Statusfilter", () => {
    expect(dashboardTargetHref({ path: "/einsatzplan" })).toBe(
      "/einsatzplan?"
    );
    expect(
      dashboardTargetHref({ path: "/einsatzplan", warning: "konflikte" })
    ).toBe("/einsatzplan?warnung=konflikte");
    expect(
      dashboardTargetHref({ path: "/einsatzplan", warning: "ausfaelle" })
    ).toBe("/einsatzplan?warnung=ausfaelle");
    expect(
      dashboardTargetHref({ path: "/einsatzplan", status: "OFFEN" })
    ).toBe("/einsatzplan?status=OFFEN");
    expect(
      dashboardTargetHref({ path: "/einsatzplan", status: "KNAPP" })
    ).toBe("/einsatzplan?status=KNAPP");
    expect(
      dashboardTargetHref({
        path: "/einsatzplan",
        helperId: 42,
        day: "Samstag",
      })
    ).toBe("/einsatzplan?helfer=42&tag=Samstag");
    expect(
      dashboardTargetHref({ path: "/einsatzplan", helperId: 42 })
    ).toBe("/einsatzplan?helfer=42");
  });

  it("erzeugt stabile Aufgaben-URLs für offene und abgelehnte Vorbereitung sowie Nachbereitung", () => {
    expect(dashboardTargetHref({ path: "/vorbereitung" })).toBe(
      "/vorbereitung?"
    );
    expect(
      dashboardTargetHref({ path: "/vorbereitung", status: "offen" })
    ).toBe("/vorbereitung?status=offen");
    expect(
      dashboardTargetHref({ path: "/vorbereitung", status: "abgelehnt" })
    ).toBe("/vorbereitung?status=abgelehnt");
    expect(
      dashboardTargetHref({ path: "/nachbereitung", status: "offen" })
    ).toBe("/nachbereitung?status=offen");
    expect(
      dashboardTargetHref({
        path: "/helfer",
        confirmed: "nein",
        assigned: true,
      })
    ).toBe("/helfer?bestaetigt=nein&eingeteilt=ja");
    expect(
      dashboardTargetHref({ path: "/helfer", firstContact: "offen" })
    ).toBe("/helfer?erstkontakt=offen");
  });

  it("akzeptiert ausschließlich unterstützte Filterwerte", () => {
    expect(parsePlanWarningFilter("konflikte")).toBe("konflikte");
    expect(parsePlanWarningFilter("ausfaelle")).toBe("ausfaelle");
    expect(parsePlanWarningFilter("unbekannt")).toBe("alle");
    expect(parsePlanStatusFilter("OFFEN")).toBe("OFFEN");
    expect(parsePlanStatusFilter("KNAPP")).toBe("KNAPP");
    expect(parsePlanStatusFilter("OK_MANUELL")).toBe("OK_MANUELL");
    expect(parsePlanStatusFilter("offen")).toBe("alle");
    expect(parsePlanHelperFilter("42")).toBe(42);
    expect(parsePlanHelperFilter("0")).toBeNull();
    expect(parsePlanHelperFilter("42.5")).toBeNull();
    expect(parsePlanDayFilter("Samstag")).toBe("Samstag");
    expect(parsePlanDayFilter("Feiertag")).toBeNull();
    expect(parseTaskStatusFilter("offen")).toBe("offen");
    expect(parseTaskStatusFilter("inArbeit")).toBe("inArbeit");
    expect(parseTaskStatusFilter("erledigt")).toBe("erledigt");
    expect(parseTaskStatusFilter("abgelehnt")).toBe("abgelehnt");
    expect(parseTaskStatusFilter("OFFEN")).toBe("alle");
    expect(parseTaskStatusFilter(null)).toBe("alle");
    expect(parseHelperConfirmationFilter("ja")).toBe("ja");
    expect(parseHelperConfirmationFilter("nein")).toBe("nein");
    expect(parseHelperConfirmationFilter("offen")).toBe("alle");
    expect(parseHelperAssignmentFilter("ja")).toBe(true);
    expect(parseHelperAssignmentFilter("nein")).toBe(false);
    expect(parseHelperFirstContactFilter("offen")).toBe("offen");
    expect(parseHelperFirstContactFilter("ja")).toBe("alle");
  });

  it("trennt reguläre OK-Schichten von manuell bestätigten OK-Schichten", () => {
    expect(planStatusMatchesFilter("OK_MANUELL", "OK", true)).toBe(true);
    expect(planStatusMatchesFilter("OK_MANUELL", "OK", false)).toBe(false);
    expect(planStatusMatchesFilter("OK", "OK", false)).toBe(true);
    expect(planStatusMatchesFilter("OK", "OK", true)).toBe(false);
    expect(planStatusMatchesFilter("alle", "OK", true)).toBe(true);
    expect(planStatusMatchesFilter("KNAPP", "KNAPP", false)).toBe(true);
  });
});
