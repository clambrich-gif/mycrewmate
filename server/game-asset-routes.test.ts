import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("CrewMate Tycoon Medienauslieferung", () => {
  it("liefert Festplatzgrafik und Musik über feste Same-Origin-Routen aus", () => {
    const route = fs.readFileSync(path.join(root, "server", "game-asset-routes.ts"), "utf8");
    expect(route).toContain('app.get("/api/game/festival-scene"');
    expect(route).toContain('app.get("/api/game/festival-music"');
    expect(route).toContain("FESTIVAL_SCENE_UPSTREAM");
    expect(route).toContain("FESTIVAL_MUSIC_UPSTREAM");
    expect(route).toContain('"image/jpeg"');
    expect(route).toContain('"audio/mpeg"');
  });
});
