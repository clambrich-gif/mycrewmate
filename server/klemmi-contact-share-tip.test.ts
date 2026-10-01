import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Klemmi-Tipp für Ansprechpartner beim Helferplan-Versand", () => {
  it("erklärt Basisansicht, notwendige Teamansicht und den Umgang mit Änderungen", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("data-klemmi-contact-share-tip");
    expect(helpers).toContain("Klemmi-Tipp für Ansprechpartner");
    expect(helpers).toContain("Starte normalerweise mit der Basisansicht.");
    expect(helpers).toContain(
      "für die gemeinsame Abstimmung erforderlich sind"
    );
    expect(helpers).toContain("alten Link widerrufen");
    expect(helpers).toContain("KlemmiMascot");
  });
});
