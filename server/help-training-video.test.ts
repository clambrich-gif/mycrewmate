import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Schulungsvideo im Hilfe-Center", () => {
  it("zeigt das Helferschulungsvideo als ersten Inhalt direkt nach dem Hilfe-Einstieg", () => {
    const help = source("client/src/pages/Help.tsx");
    const headerEnd = help.indexOf("</header>");
    const videoCard = help.indexOf("Helfer sicher anlegen und koordinieren");
    const knowledgeCard = help.indexOf("Das passende Wissen direkt finden");

    expect(videoCard).toBeGreaterThan(headerEnd);
    expect(videoCard).toBeLessThan(knowledgeCard);
    expect(help).toContain("<video");
    expect(help).toContain("controls");
    expect(help).toContain('preload="metadata"');
    expect(help).toContain("MyCrewMate-Schulung zum Anlegen und Koordinieren von Helfern");
  });

  it("verwendet die same-origin Streamingroute als MP4-Quelle", () => {
    const help = source("client/src/pages/Help.tsx");

    expect(help).toContain('"/api/help/training-video"');
    expect(help).toContain('type="video/mp4"');
  });
});
