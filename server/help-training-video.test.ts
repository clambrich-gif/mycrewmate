import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Schulungsvideo im Hilfe-Center", () => {
  it("ordnet das Helferschulungsvideo dem ersten Schnellstartthema zu", () => {
    const help = source("client/src/pages/Help.tsx");
    const guide = source("client/src/components/HelpGuide.tsx");
    const quickStart = guide.indexOf('id: "schnellstart"');
    const videoTopic = guide.indexOf('id: "helfer-schnellstart-video"');
    const dashboardTopic = guide.indexOf('id: "dashboard-uebersicht"');

    expect(videoTopic).toBeGreaterThan(quickStart);
    expect(videoTopic).toBeLessThan(dashboardTopic);
    expect(guide).toContain("1.1 Schnellstart: Helfer sicher anlegen und koordinieren");
    expect(guide).toContain("<video");
    expect(guide).toContain("controls");
    expect(guide).toContain('preload="metadata"');
    expect(guide).toContain("MyCrewMate-Schulung zum Anlegen und Koordinieren von Helfern");
    expect(help).not.toContain("HELPER_TRAINING_VIDEO_URL");
  });

  it("verwendet die same-origin Streamingroute als MP4-Quelle", () => {
    const guide = source("client/src/components/HelpGuide.tsx");

    expect(guide).toContain('"/api/help/training-video"');
    expect(guide).toContain('type="video/mp4"');
  });

  it("führt die Administratorenschulung als eigenen Hilfe-Menüpunkt mit Videostream", () => {
    const guide = source("client/src/components/HelpGuide.tsx");

    expect(guide).toContain('title: "Administrator-Schulung"');
    expect(guide).toContain("Schulungsvideo: Fachbereichsrechte sicher vergeben");
    expect(guide).toContain('src: "/api/help/administrator-training-video"');
    expect(guide).toContain('aria-label={topic.video.ariaLabel}');
    expect(guide).not.toContain("freigabestufen-schulungsvideo");
    expect(guide).not.toContain("Die Stufe ist eine praxistaugliche Vorlage");
  });
});
