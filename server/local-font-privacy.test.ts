import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("lokale Inter-Auslieferung", () => {
  it("verzichtet im Dokumentkopf auf Google Fonts und liefert Inter mit der App aus", () => {
    const html = read("client/index.html");
    const css = read("client/src/index.css");
    const fontPath = path.join(
      root,
      "client/src/fonts/inter-latin-variable.woff2"
    );

    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(css).toContain("@font-face");
    expect(css).toContain('font-family: "Inter"');
    expect(css).toContain("inter-latin-variable.woff2");
    expect(fs.statSync(fontPath).size).toBeGreaterThan(40_000);
  });
});
