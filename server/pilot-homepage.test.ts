import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("öffentliche Preis- und Pilotseiten", () => {
  it("trennt reguläre Produktpreise, Pilotanfrage und fiktive Vereinsdemo", () => {
    const app = read("client/src/App.tsx");
    const offer = read("client/src/pages/OfferDemo.tsx");
    const pilot = read("client/src/pages/PilotHomepageDraft.tsx");

    expect(app).toContain('path="/pilot"');
    expect(offer).toContain("Pilotprogramm bis 31.12.2026");
    expect(offer).toContain("Pilot kostenlos anfragen");
    expect(offer).toContain('href="/vereinsdemo"');
    expect(offer).toContain("Fiktive Vereinsdemo ausprobieren");
    expect(offer).toContain("Reguläre Preise ab 01.01.2027");
    expect(offer).toContain("Alle genannten Preise sind Endpreise");
    expect(offer).toContain("Buchung und Zahlung starten");
    expect(offer).toContain("Im Pilot testen");
    expect(offer).not.toContain("Simuliert in den Warenkorb");
    expect(offer).not.toContain("Simulierter Warenkorb");
    expect(offer).not.toContain("Muster-Checkout");

    expect(pilot).toContain('name: "Enterprise"');
    expect(pilot).not.toContain('name: "Ultimate"');
    expect(pilot).toContain("Fiktive Vereinsdemo ausprobieren");
    expect(pilot).toContain("Reguläre Preise ab 01.01.2027 ansehen");
  });

  it("ordnet die Vergleichstabelle zeitlich ein, ohne die App-Ansicht zu verändern", () => {
    const comparison = read("client/src/components/PackageComparisonSection.tsx");
    const offer = read("client/src/pages/OfferDemo.tsx");

    expect(comparison).toContain("priceNote?: string");
    expect(comparison).toContain("{priceNote && (");
    expect(offer).toContain("Reguläre Endpreise ab 01.01.2027");
  });
});
