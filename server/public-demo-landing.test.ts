import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("öffentliche Vereinsdemo", () => {
  it("stellt die zentrale QR-Zielseite mit freiwilliger Herkunftsauswahl bereit", () => {
    const app = read("client/src/App.tsx");
    const landing = read("client/src/pages/ClubDemoLanding.tsx");

    expect(app).toContain('path="/vereinsdemo"');
    expect(landing).toContain("maximal 30 Tage");
    expect(landing).toContain("Ohne Angabe fortfahren");
    expect(landing).toContain("Vereinsdemo ansehen");
    expect(landing).toContain("Unverbindliche Demo anfragen");
  });

  it("speichert für die Auslageort-Auswertung keine Kontaktdaten", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers.ts");
    const database = read("server/db.ts");
    const landing = read("client/src/pages/ClubDemoLanding.tsx");
    const heartbeat = read("server/chat-cleanup-heartbeat.ts");

    expect(schema).toContain("public_demo_source_selections");
    expect(router).toContain("publicDemo: router");
    expect(router).toContain("recordSource: publicProcedure");
    expect(database).toContain("recordPublicDemoSourceSelection");
    expect(database).toContain("PUBLIC_DEMO_SOURCE_TTL_MS");
    expect(database).toContain("cleanupExpiredPublicDemoSourceSelections");
    expect(heartbeat).toContain(
      "cleanupExpiredPublicDemoSourceSelections(now)"
    );
    expect(landing).not.toContain("eventLabel");
    expect(landing).not.toContain("sessionStorage");
    expect(router).not.toContain("eventLabel: z.string");
    expect(schema).not.toMatch(
      /public_demo_source_selections[\s\S]{0,700}email:/
    );
    expect(schema).not.toMatch(
      /public_demo_source_selections[\s\S]{0,700}ipAddress:/
    );
  });
});
