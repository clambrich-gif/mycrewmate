import { describe, expect, it } from "vitest";
import {
  NAV,
  navigationItemClasses,
  PLANNING_TEAM_HIDDEN_PATHS,
  visibleNavigationItems,
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

  it("formatiert jeden sichtbaren Navigationseintrag für das Planungsteam einheitlich kräftig", () => {
    for (const item of visibleNavigationItems("user")) {
      const classes = navigationItemClasses("user", item.href, false);
      expect(classes).toContain("font-semibold");
      expect(classes).toContain("text-slate-800");
      expect(classes).toContain("hover:bg-accent");
    }
  });

  it("erhält für alle aktiven Planungsteam-Ziele die Klickbarkeit und einen sichtbaren Fokus", () => {
    for (const item of visibleNavigationItems("user")) {
      const classes = navigationItemClasses("user", item.href, true);
      expect(classes).toContain("bg-primary");
      expect(classes).toContain("font-semibold");
      expect(classes).toContain("text-primary-foreground");
    }
  });

  it("gibt Administratoren weiterhin alle Navigationseinträge mit derselben klaren Typografie", () => {
    expect(visibleNavigationItems("admin")).toEqual(NAV);
    expect(navigationItemClasses("admin", "/helfer", false)).toBe(
      "font-semibold text-slate-800 hover:bg-accent"
    );
    expect(navigationItemClasses("admin", "/helfer", true)).toBe(
      "bg-primary font-semibold text-primary-foreground"
    );
  });
});
