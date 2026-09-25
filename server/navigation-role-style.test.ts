import { describe, expect, it } from "vitest";
import {
  activeNavigationAccess,
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
      "/orte",
    ]);

    const planningTeamPaths = visibleNavigationItems("user").map(item => item.href);
    const adminPaths = visibleNavigationItems("admin").map(item => item.href);

    for (const path of PLANNING_TEAM_HIDDEN_PATHS) {
      expect(planningTeamPaths).not.toContain(path);
      expect(adminPaths).toContain(path);
    }
    expect(planningTeamPaths).not.toContain("/berechtigungen");
    expect(adminPaths).not.toContain("/berechtigungen");
    expect(planningTeamPaths).not.toContain("/excel");
    expect(adminPaths).not.toContain("/excel");
    expect(planningTeamPaths).toEqual([
      "/",
      "/helfer",
      "/einsatzplan",
      "/vorbereitung",
      "/nachbereitung",
      "/material",
      "/spenden",
      "/pdf-export",
      "/hilfe",
    ]);
  });

  it("behält für das Planungsteam die gewohnte Reihenfolge und hält alle verfügbaren Ziele gleich lesbar", () => {
    expect(PLANNING_TEAM_EDITING_PATHS).toEqual([
      "/helfer",
      "/vorbereitung",
      "/nachbereitung",
      "/material",
      "/spenden",
    ]);
    expect(PLANNING_TEAM_OVERVIEW_PATHS).toEqual([
      "/",
      "/einsatzplan",
      "/hilfe",
    ]);
    expect(visibleNavigationSections("user")).toEqual([
      { id: "default", label: null, items: visibleNavigationItems("user") },
    ]);

    for (const path of PLANNING_TEAM_EDITING_PATHS) {
      const classes = navigationItemClasses("user", path, false);
      expect(classes).toContain("font-medium");
      expect(classes).toContain("text-slate-800");
      expect(classes).toContain("hover:bg-slate-100");
      expect(classes).toContain("hover:text-slate-900");
    }
    for (const path of PLANNING_TEAM_OVERVIEW_PATHS) {
      const classes = navigationItemClasses("user", path, false);
      expect(classes).toContain("font-medium");
      expect(classes).toContain("text-slate-800");
      expect(classes).toContain("hover:bg-slate-100");
      expect(classes).toContain("hover:text-slate-900");
    }
  });

  it("erhält für alle aktiven Planungsteam-Ziele eine klare aktive Darstellung", () => {
    for (const item of visibleNavigationItems("user")) {
      const classes = navigationItemClasses("user", item.href, false);
      expect(classes).toContain("hover:bg-slate-100");
      const activeClasses = navigationItemClasses("user", item.href, true);
      expect(activeClasses).toContain("bg-[var(--mycrewmate-orange)]");
      expect(activeClasses).toContain("hover:bg-[var(--mycrewmate-orange-hover)]");
      expect(activeClasses).toContain("font-semibold");
      expect(activeClasses).toContain("text-white");
    }
  });

  it("gibt Administratoren weiterhin alle Navigationseinträge mit derselben klaren Typografie", () => {
    expect(visibleNavigationItems("admin")).toEqual(NAV);
    expect(visibleNavigationSections("admin")).toEqual([
      { id: "default", label: null, items: NAV },
    ]);
    expect(navigationItemClasses("admin", "/helfer", false)).toBe(
      "font-medium text-slate-800 hover:bg-slate-100 hover:text-slate-900"
    );
    expect(navigationItemClasses("admin", "/sicherheit", false)).toBe(
      "font-medium text-slate-800 hover:bg-slate-100 hover:text-slate-900"
    );
    expect(NAV.find(item => item.href === "/sicherheit")?.label).toBe(
      "Schutz & Protokoll"
    );
    expect(NAV.map(item => item.label)).not.toContain("Protokoll");
    expect(navigationItemClasses("admin", "/helfer", true)).toBe(
      "bg-[var(--mycrewmate-orange)] font-semibold text-white shadow-sm hover:bg-[var(--mycrewmate-orange-hover)] focus-visible:ring-[var(--mycrewmate-orange)]"
    );
  });

  it("zeigt im aktiven Punkt nur dann einen Stift, wenn der Bereich tatsächlich bearbeitbar ist", () => {
    expect(activeNavigationAccess("admin", "/einsatzplan", [])).toBe("edit");
    expect(activeNavigationAccess("user", "/einsatzplan", ["schedule"])).toBe("read");
    expect(activeNavigationAccess("user", "/helfer", ["helpers"])).toBe("edit");
    expect(activeNavigationAccess("user", "/vorbereitung", ["read_all"])).toBe("read");
    expect(activeNavigationAccess("user", "/material", [])).toBe("read");
  });
});
