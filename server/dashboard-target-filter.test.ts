import { describe, expect, it } from "vitest";
import {
  dashboardTargetHref,
  parseHelperAssignmentFilter,
  parseHelperConfirmationFilter,
  parseHelperFirstContactFilter,
  parsePlanStatusFilter,
  parsePlanWarningFilter,
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
    expect(parsePlanStatusFilter("offen")).toBe("alle");
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
});
