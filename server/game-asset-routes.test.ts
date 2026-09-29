import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("CrewMate Tycoon Medienauslieferung", () => {
  it("liefert die optionale Hintergrundmusik über eine feste Same-Origin-Route aus", () => {
    const route = fs.readFileSync(path.join(root, "server", "game-asset-routes.ts"), "utf8");
    expect(route).toContain('registerProxy(app, "/api/game/festival-music"');
    expect(route).toContain("FESTIVAL_MUSIC_UPSTREAM");
    expect(route).toContain('"audio/mpeg"');
    expect(route).toContain('Cross-Origin-Resource-Policy');
  });
});
