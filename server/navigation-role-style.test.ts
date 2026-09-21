import { describe, expect, it } from "vitest";
import {
  NAV,
  navigationItemClasses,
  PLANNING_TEAM_EDITING_PATHS,
  PLANNING_TEAM_HIDDEN_PATHS,
  PLANNING_TEAM_OVERVIEW_PATHS,
  visibleNavigationItems,
  visibleNavigationSections,
} from "../client/src/lib/nav";

describe("rollenabhängige Navigation", () => {
  it("führt die Fachmodule ohne Marketing und Genehmigungen in der vorgesehenen Reihenfolge", () => {
    expect(NAV.slice(0, 10).map(item => item.label)).toEqual([
      "Dashboard",
      "Ansprechpartner",
      "Helfer",
      "Einsatzplan",
      "Vorbereitung",
      "Nachbereitung",
      "Material",
      "Spenden",
      "Finanzen",
      "PDF-Ausgabe",
    ]);
    expect(NAV.map(item => item.label)).not.toContain("Marketing");
    expect(NAV.map(item => item.label)).not.toContain("Genehmigungen");
  });

  it("blendet für das Planungsteam nur die vorgegebenen Verwaltungsbereiche aus", () => {
    expect(PLANNING_TEAM_HIDDEN_PATHS).toEqual([
      "/ansprechpartner",
      "/finanzen",
      "/excel",
      "/orte",
    ]);

    const planningTeamPaths = visibleNavigationItems("user").map(item => item.href);
    const adminPaths = visibleNavigationItems("admin").map(item => item.href);

    for (const path of PLANNING_TEAM_HIDDEN_PATHS) {
      expect(planningTeamPaths).not.toContain(path);
      expect(adminPaths).toContain(path);
    }
    expect(planningTeamPaths).toEqual([
      "/",
      "/helfer",
      "/einsatzplan",
      "/vorbereitung",
      "/nachbereitung",
      "/material",
      "/spenden",
      "/pdf-export",
      "/berechtigungen",
      "/hilfe",
    ]);
  });

  it("behält für das Planungsteam die gewohnte Reihenfolge und differenziert nur die Typografie", () => {
    expect(PLANNING_TEAM_EDITING_PATHS).toEqual([
      "/helfer",
      "/vorbereitung",
      "/nachbereitung",
      "/material",
      "/spenden",
      "/pdf-export",
    ]);
    expect(PLANNING_TEAM_OVERVIEW_PATHS).toEqual([
      "/",
      "/einsatzplan",
      "/berechtigungen",
      "/hilfe",
    ]);
    expect(visibleNavigationSections("user")).toEqual([
      { id: "default", label: null, items: visibleNavigationItems("user") },
    ]);

    for (const path of PLANNING_TEAM_EDITING_PATHS) {
      const classes = navigationItemClasses("user", path, false);
      expect(classes).toContain("font-semibold");
      expect(classes).toContain("text-slate-900");
      expect(classes).toContain("hover:bg-slate-100");
      expect(classes).toContain("hover:text-slate-900");
    }
    for (const path of PLANNING_TEAM_OVERVIEW_PATHS) {
      const classes = navigationItemClasses("user", path, false);
      expect(classes).toContain("font-normal");
      expect(classes).toContain("text-slate-500");
      expect(classes).toContain("hover:bg-slate-100");
      expect(classes).toContain("hover:text-slate-900");
    }
  });

  it("erhält für alle aktiven Planungsteam-Ziele eine klare aktive Darstellung", () => {
    for (const item of visibleNavigationItems("user")) {
      const classes = navigationItemClasses("user", item.href, false);
      expect(classes).toContain("hover:bg-slate-100");
      const activeClasses = navigationItemClasses("user", item.href, true);
      expect(activeClasses).toContain("bg-primary");
      expect(activeClasses).toContain("hover:bg-primary/90");
      expect(activeClasses).toContain("font-semibold");
      expect(activeClasses).toContain("text-primary-foreground");
    }
  });

  it("gibt Administratoren weiterhin alle Navigationseinträge mit derselben klaren Typografie", () => {
    expect(visibleNavigationItems("admin")).toEqual(NAV);
    expect(visibleNavigationSections("admin")).toEqual([
      { id: "default", label: null, items: NAV },
    ]);
    expect(navigationItemClasses("admin", "/helfer", false)).toBe(
      "font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-900"
    );
    expect(navigationItemClasses("admin", "/helfer", true)).toBe(
      "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
    );
  });
});
