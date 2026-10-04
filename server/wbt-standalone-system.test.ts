import { describe, expect, it } from "vitest";
import { WBT_TRACKS, WBT_HELPER_CHAPTERS, WBT_ADMIN_CHAPTERS } from "../client/src/wbt/wbtData";
import { INITIAL_SIMULATED_HELPERS, INITIAL_SIMULATED_SHIFTS } from "../client/src/wbt/wbtSimData";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Eigenständiges Web-Based-Training (WBT-Schulungssystem)", () => {
  it("definiert die beiden geforderten Trainingspfade 'helper' und 'admin'", () => {
    expect(WBT_TRACKS.helper).toBeDefined();
    expect(WBT_TRACKS.admin).toBeDefined();
    expect(WBT_TRACKS.helper.title).toContain("Helferkoordination");
    expect(WBT_TRACKS.admin.title).toContain("Planungsteam");
  });

  it("WBT 1 (Helferkoordination) umfasst die 7 geforderten Module inkl. 6-Schritte-Helferablauf", () => {
    const chapterIds = WBT_HELPER_CHAPTERS.map(c => c.id);
    expect(chapterIds).toEqual([
      "dashboard",
      "helpers",
      "preparation",
      "postprocessing",
      "material",
      "donations",
      "help"
    ]);

    const helperChapter = WBT_HELPER_CHAPTERS.find(c => c.id === "helpers");
    expect(helperChapter).toBeDefined();
    expect(helperChapter?.steps).toHaveLength(6);

    const stepTitles = helperChapter?.steps.map(s => s.title) ?? [];
    expect(stepTitles[0]).toContain("Schritt 1: Helfer anlegen");
    expect(stepTitles[1]).toContain("Schritt 2: Helfer erstmalig kontaktieren");
    expect(stepTitles[2]).toContain("Schritt 3: Zeiten & Spenden besprechen");
    expect(stepTitles[3]).toContain("Schritt 4: Warten auf das Planungsteam");
    expect(stepTitles[4]).toContain("Schritt 5: Helferplan versenden");
    expect(stepTitles[5]).toContain("Schritt 6: Helfer bestätigen");
  });

  it("jedes WBT-Kapitel hat eine von Klemmi formulierte Zusammenfassung am Ende", () => {
    for (const track of Object.values(WBT_TRACKS)) {
      for (const chapter of track.chapters) {
        expect(chapter.klemmiSummary).toBeDefined();
        expect(chapter.klemmiSummary.heading).toContain("Klemmi");
        expect(chapter.klemmiSummary.text.length).toBeGreaterThan(20);
        expect(chapter.klemmiSummary.takeaway.length).toBeGreaterThan(5);
      }
    }
  });

  it("stellt Klemmi vor dem ersten Schulungskapitel vor und trennt die Sprecherrollen", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "client/src/pages/WbtPortal.tsx"),
      "utf8"
    );

    expect(portal).toContain("showingIntroduction");
    expect(portal).toContain("Willkommen in der Lernwerkstatt");
    expect(portal).toContain("Hallo, ich bin Klemmi");
    expect(portal).toContain("Lernsprecher erklärt");
    expect(portal).toContain("Klemmi empfiehlt hierzu:");
  });

  it("WBT 2 (Planungsteam & Admin) enthält zusätzlich Einsatzplan, Finanzen, Orte und Schutz & Protokolle", () => {
    const chapterIds = WBT_ADMIN_CHAPTERS.map(c => c.id);
    expect(chapterIds).toContain("plan");
    expect(chapterIds).toContain("finances");
    expect(chapterIds).toContain("locations");
    expect(chapterIds).toContain("security");

    const securityChapter = WBT_ADMIN_CHAPTERS.find(c => c.id === "security");
    expect(securityChapter).toBeDefined();
    expect(securityChapter?.steps.length).toBeGreaterThanOrEqual(5);

    const secTitles = securityChapter?.steps.map(s => s.title) ?? [];
    expect(secTitles.some(t => t.includes("MFA"))).toBe(true);
    expect(secTitles.some(t => t.includes("Rechte-Schalter"))).toBe(true);
    expect(secTitles.some(t => t.includes("Notfall"))).toBe(true);
    expect(secTitles.some(t => t.includes("Audit-Center"))).toBe(true);
  });

  it("nutzt ausschließlich datenfreie Simulationsdaten", () => {
    expect(INITIAL_SIMULATED_HELPERS.length).toBeGreaterThan(0);
    expect(INITIAL_SIMULATED_HELPERS[0].name).toContain("Muster");
    expect(INITIAL_SIMULATED_SHIFTS.length).toBeGreaterThan(0);
  });

  it("ist vorerst ausschließlich als isolierte Staging-Vorschau registriert", () => {
    const appTsx = readFileSync(path.resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(appTsx).toContain('path="/_staging/wbt"');
    expect(appTsx).toContain('path="/wbt"');
    expect(appTsx).not.toContain('path="/schulung"');
    expect(appTsx).not.toContain('path="/lernen"');
    expect(appTsx).toContain("WbtPortal");
  });
});
