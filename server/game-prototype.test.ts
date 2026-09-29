import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("CrewMate Tycoon Spielprototyp", () => {
  it("stellt drei Szenarien und fünf Ausbaustufen als Konzept bereit", () => {
    const concept = read("../MyCrewMate-Game-Konzept.md");
    expect(concept).toContain("Stufe 1");
    expect(concept).toContain("Stufe 5");
    expect(concept).toContain("Schützenfest");
    expect(concept).toContain("3-Tage-Kirmes");
    expect(concept).toContain("Eifel-Radsportfestival");
  });

  it("trennt die Spiel-Subdomain von der produktiven Vereinsplanung", () => {
    const hosts = read("client/src/lib/site-host.ts");
    const app = read("client/src/App.tsx");
    expect(hosts).toContain('GAME_HOST = "game.mycrewmate.de"');
    expect(hosts).toContain("isGameSite");
    expect(app).toContain("gameSite ?");
    expect(app).toContain("<GameRoot />");
  });

  it("enthält die vollständige Planungsschleife von Vorbereitung bis Abschlussbericht", () => {
    const game = read("client/src/pages/GameRoot.tsx");
    const quests = read("client/src/game/questData.ts");
    expect(game).toContain('"scenario_select"');
    expect(game).toContain('"preparation"');
    expect(game).toContain('"helper_outreach"');
    expect(game).toContain('"puzzle"');
    expect(game).toContain('"event_day"');
    expect(game).toContain('"report"');
    expect(game).toContain("Festival erfolgreich vorbereitet");
    expect(quests).toContain("110-km-Strecke genehmigen");
    expect(game).toContain("Achte auf die Zeitfenster direkt an jeder Station");
  });
});
