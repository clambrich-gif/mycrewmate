import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("öffentliche MyCrewMate-Markennavigation", () => {
  it("führt sichtbare Logos immer zur kanonischen Hauptwebsite", () => {
    const offer = read("client/src/pages/OfferDemo.tsx");
    const pilot = read("client/src/pages/PilotHomepageDraft.tsx");
    const demo = read("client/src/pages/ClubDemoLanding.tsx");
    const legal = read("client/src/pages/PublicLegal.tsx");
    const legalDocument = read("client/src/pages/LegalDocument.tsx");
    const appPrivacy = read("client/src/pages/AppPrivacy.tsx");
    const appLayout = read("client/src/components/Layout.tsx");

    for (const source of [offer, pilot, demo, legal, legalDocument, appPrivacy, appLayout]) {
      expect(source).toContain('href="https://mycrewmate.de/"');
    }
    expect(demo).not.toContain('<a href="/" className="shrink-0" aria-label="MyCrewMate – zur Startseite">');
    expect(pilot).not.toContain('<a href="#start" className="shrink-0');
  });
});
