import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WBT_AUDIO_CATALOG } from "../client/src/wbt/wbtAudioCatalog";
import { WBT_ADMIN_CHAPTERS, WBT_HELPER_CHAPTERS } from "../client/src/wbt/wbtData";

describe("Zweistimmige WBT-Vertonung", () => {
  it("stellt Sprecher- und Klemmi-Clip für jeden Trainingsschritt sowie Klemmi-Abschlüsse bereit", () => {
    const uniqueChapters = new Map(
      [...WBT_HELPER_CHAPTERS, ...WBT_ADMIN_CHAPTERS].map(chapter => [chapter.id, chapter])
    );
    const totalSteps = [...uniqueChapters.values()].reduce(
      (total, chapter) => total + chapter.steps.length,
      0
    );
    // Drei Einführungsteile, zwei Audioanteile je Fachschritt,
    // eine Klemmi-Zusammenfassung je Kapitel sowie Klemmi am Ende.
    const expectedClips = 3 + totalSteps * 2 + uniqueChapters.size + 1;

    expect(WBT_AUDIO_CATALOG).toHaveLength(expectedClips);
    expect(WBT_AUDIO_CATALOG.some(entry => entry.id === "wbt-training-complete")).toBe(true);
    expect(WBT_AUDIO_CATALOG.every(entry => entry.id.startsWith("wbt-"))).toBe(true);
    expect(WBT_AUDIO_CATALOG.every(entry => entry.text.length > 20)).toBe(true);
    expect(WBT_AUDIO_CATALOG.filter(entry => entry.speaker === "narrator")).toHaveLength(
      totalSteps + 2
    );
    expect(WBT_AUDIO_CATALOG.filter(entry => entry.speaker === "klemmi")).toHaveLength(
      totalSteps + uniqueChapters.size + 2
    );
  });

  it("trennt neutrale Erklärungen von Klemmis Empfehlungen und stellt Klemmi vor", () => {
    const intro = WBT_AUDIO_CATALOG.filter(entry => entry.kind === "introduction");
    const narratorSteps = WBT_AUDIO_CATALOG.filter(entry => entry.kind === "step-narration");
    const klemmiTips = WBT_AUDIO_CATALOG.filter(entry => entry.kind === "step-tip");

    expect(intro).toHaveLength(3);
    expect(intro.map(entry => entry.speaker)).toEqual(["narrator", "klemmi", "narrator"]);
    expect(intro[0]?.text).toContain("digitaler Begleiter");
    expect(intro[2]?.text).toContain("echten MyCrewMate-Programm");
    expect(narratorSteps).toHaveLength(klemmiTips.length);
    expect(narratorSteps.every(entry => entry.text.endsWith("Klemmi empfiehlt hierzu:"))).toBe(true);
    expect(klemmiTips.every(entry => !entry.text.includes("Klemmi empfiehlt hierzu"))).toBe(true);
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
    const [portal, voiceHook, narratorHook, audioHelper] = await Promise.all([
      readFile(path.resolve(process.cwd(), "client/src/pages/WbtPortal.tsx"), "utf8"),
      readFile(path.resolve(process.cwd(), "client/src/hooks/useKlemmiVoice.ts"), "utf8"),
      readFile(path.resolve(process.cwd(), "client/src/wbt/useWbtNarratorVoice.ts"), "utf8"),
      readFile(path.resolve(process.cwd(), "client/src/wbt/wbtAudio.ts"), "utf8"),
    ]);

    expect(portal).toContain("KlemmiVoiceControl");
    expect(portal).toContain("playStepNarration");
    expect(portal).toContain("playChapterSummaryNarration");
    expect(portal).toContain("showingIntroduction");
    expect(portal).toContain("Klemmi empfiehlt hierzu:");
    expect(portal).toContain("isSpeaking={isSpeaking}");
    expect(voiceHook).toContain("const playUrl");
    expect(narratorHook).toContain("WBT-Sprecher");
    expect(audioHelper).toContain("/api/klemmi/audio/");
    expect(audioHelper).toContain("wbt-narrator-");
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
