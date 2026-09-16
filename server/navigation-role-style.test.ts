import { describe, expect, it } from "vitest";
import {
  NAV,
  navigationItemClasses,
  PLANNING_TEAM_FOCUS_PATHS,
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
      "Kuchen",
      "Finanzen",
      "PDF-Ausgabe",
    ]);
    expect(NAV.map(item => item.label)).not.toContain("Marketing");
    expect(NAV.map(item => item.label)).not.toContain("Genehmigungen");
  });

  it("hebt für das Planungsteam exakt Helfer, Kuchen, PDF-Ausgabe und Hilfe hervor", () => {
    expect(PLANNING_TEAM_FOCUS_PATHS).toEqual([
      "/helfer",
      "/kuchen",
      "/pdf-export",
      "/hilfe",
    ]);

    for (const item of NAV) {
      const classes = navigationItemClasses("user", item.href, false);
      if (PLANNING_TEAM_FOCUS_PATHS.includes(item.href as any)) {
        expect(classes).toContain("font-bold");
        expect(classes).toContain("text-black");
        expect(classes).toContain("opacity-100");
      } else {
        expect(classes).toContain("font-normal");
        expect(classes).toContain("text-gray-500");
      }
      expect(classes).toContain("hover:bg-slate-100");
    }
  });

  it("erhält für alle aktiven Planungsteam-Ziele die Klickbarkeit und einen sichtbaren Fokus", () => {
    for (const item of NAV) {
      const classes = navigationItemClasses("user", item.href, true);
      expect(classes).toContain("bg-slate-100");
      expect(classes).toContain("ring-1");
    }
  });

  it("ändert die bestehende Administrator-Darstellung nicht", () => {
    expect(navigationItemClasses("admin", "/helfer", false)).toBe(
      "font-medium hover:bg-accent"
    );
    expect(navigationItemClasses("admin", "/helfer", true)).toBe(
      "bg-primary font-medium text-primary-foreground"
    );
  });
});
