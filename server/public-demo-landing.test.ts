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
    expect(landing).toContain("Datensparsame Musterdemo");
    expect(landing).toContain("ausschließlich fiktive Beispiele");
    expect(landing).toContain("Unverbindliche Demo anfragen");
  });

  it("erhebt auf der Musterdemo keine Nutzungs- oder Herkunftsdaten mehr", () => {
    const router = read("server/routers.ts");
    const landing = read("client/src/pages/ClubDemoLanding.tsx");

    expect(landing).not.toContain("recordSource");
    expect(landing).not.toContain("sessionStorage");
    expect(landing).not.toContain("eventLabel");
    expect(router).not.toContain("publicDemo: router");
  });
});
