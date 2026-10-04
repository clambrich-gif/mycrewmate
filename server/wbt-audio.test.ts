import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WBT_AUDIO_CATALOG } from "../client/src/wbt/wbtAudioCatalog";
import { WBT_ADMIN_CHAPTERS, WBT_HELPER_CHAPTERS } from "../client/src/wbt/wbtData";

describe("WBT-Klemmi-Vertonung", () => {
  it("stellt für jeden Trainingsschritt, jede Kapitelzusammenfassung und den Abschluss einen festen Clip bereit", () => {
    const uniqueChapters = new Map(
      [...WBT_HELPER_CHAPTERS, ...WBT_ADMIN_CHAPTERS].map(chapter => [chapter.id, chapter])
    );
    const expectedClips =
      [...uniqueChapters.values()].reduce(
        (total, chapter) => total + chapter.steps.length + 1,
        1
      );

    expect(WBT_AUDIO_CATALOG).toHaveLength(expectedClips);
    expect(WBT_AUDIO_CATALOG.some(entry => entry.id === "wbt-training-complete")).toBe(true);
    expect(WBT_AUDIO_CATALOG.every(entry => entry.id.startsWith("wbt-"))).toBe(true);
    expect(WBT_AUDIO_CATALOG.every(entry => entry.text.length > 20)).toBe(true);
  });

  it("vermittelt die frühe, vom späteren Einsatzplan unabhängige Helferansprache", () => {
    const dashboard = WBT_HELPER_CHAPTERS.find(chapter => chapter.id === "dashboard");
    const helperStatus = dashboard?.steps.find(step => step.id === "dash-helper-readiness");

    expect(helperStatus?.explanation).toContain("frühe, breite Helferansprache läuft davon unabhängig");
    expect(helperStatus?.klemmiTip).toContain("frühzeitig und unabhängig vom späteren Einsatzplan");
    expect(dashboard?.klemmiSummary.text).toContain("kein Grund, mit Helferanfragen zu warten");
  });

  it("erklärt die GPX-Karte als Werkzeug für visuelle, örtliche und behördliche Abstimmung", () => {
    const locations = WBT_ADMIN_CHAPTERS.find(chapter => chapter.id === "locations");
    const gpxStep = locations?.steps.find(step => step.id === "loc-gpx");

    expect(gpxStep?.klemmiTip).toContain("visuelle Abstimmung und die örtliche Zuordnung");
    expect(gpxStep?.klemmiTip).toContain("Polizei und Rettungsdiensten");
  });

  it("verwendet ausschließlich vorproduzierte lokale Clips für das WBT", async () => {
    const [portal, voiceHook, audioHelper] = await Promise.all([
      readFile(path.resolve(process.cwd(), "client/src/pages/WbtPortal.tsx"), "utf8"),
      readFile(path.resolve(process.cwd(), "client/src/hooks/useKlemmiVoice.ts"), "utf8"),
      readFile(path.resolve(process.cwd(), "client/src/wbt/wbtAudio.ts"), "utf8"),
    ]);

    expect(portal).toContain("KlemmiVoiceControl");
    expect(portal).toContain("playStepNarration");
    expect(portal).toContain("playChapterSummaryNarration");
    expect(voiceHook).toContain("const playUrl");
    expect(audioHelper).toContain("/api/klemmi/audio/");
    expect(portal).not.toContain("speechSynthesis");
  });

  it("enthält nach der Audioerzeugung jede erwartete WBT-Datei", () => {
    for (const entry of WBT_AUDIO_CATALOG) {
      const clip = path.resolve(
        process.cwd(),
        "server/assets/klemmi-voice",
        `${entry.id}.mp3`
      );
      expect(existsSync(clip), `fehlender WBT-Clip: ${entry.id}`).toBe(true);
    }
  });
});
