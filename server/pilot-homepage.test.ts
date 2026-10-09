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
    expect(offer).toContain("Pilotanfragen bis 31.12.2026");
    expect(offer).toContain('href="/pilot#pilot-anfrage"');
    expect((offer.match(/href="\/pilot#pilot-anfrage"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(offer).toContain("Pilot kostenlos anfragen");
    expect(offer).toContain("ehrenamtlich getragenen Veranstaltungen");
    expect(offer).toContain("private Feiern, Firmenveranstaltungen oder gewerbliche Eventdienstleistungen");
    expect(offer).toContain("keinen Anspruch auf Annahme, Freischaltung oder ein bestimmtes Paket");
    expect(offer).toContain('href="/vereinsdemo"');
    expect(offer).toContain("Fiktive Vereinsdemo ausprobieren");
    expect(offer).toContain("Reguläre Preise ab 01.01.2027");
    expect(offer).toContain("Alle genannten Preise sind Endpreise");
    expect(offer).toContain("Buchung und Zahlung starten");
    expect(offer).toContain("Im Pilot testen");
    expect(offer).toContain('data-pilot-benefit');
    expect(offer).toContain("50 % für das erste kostenpflichtige Veranstaltungsjahr");
    expect(offer).toContain("Pilotvorteil: 74,50 €");
    expect(offer).toContain("Pilotvorteil: 149,50 €");
    expect(offer).toContain("Event Pass und Enterprise sind ausgeschlossen");
    expect(offer).toContain("Kombination mit anderen Rabatten ist nicht möglich");
    expect(offer).toContain("vor Pilotende in Textform");
    expect(offer).not.toContain("Simuliert in den Warenkorb");
    expect(offer).not.toContain("Simulierter Warenkorb");
    expect(offer).not.toContain("Muster-Checkout");

    expect(pilot).toContain('name: "Enterprise"');
    expect(pilot).not.toContain('name: "Ultimate"');
    expect(pilot).toContain("Fiktive Vereinsdemo ausprobieren");
    expect(pilot).toContain("Reguläre Preise ab 01.01.2027 ansehen");
    expect(pilot).toContain('name="phone"');
    expect(pilot).toContain('name="organizationType"');
    expect(pilot).toContain('name="eligibility"');
    expect(pilot).toContain("Verein oder Verband");
    expect(pilot).toContain("Ehrenamtliches Organisationsteam oder Initiative");
    expect(pilot).toContain("Gemeinde oder kommunaler Veranstalter");
    expect(pilot).toContain("private Feiern, Firmenveranstaltungen und gewerbliche Eventdienstleistungen");
    expect(pilot).toContain("keinen Anspruch auf Teilnahme, Freischaltung oder ein bestimmtes Paket");
    expect(pilot).toContain("Telefonnummer für eine persönliche Rückfrage");
    expect(pilot).toContain("Nur wenn ihr einen persönlichen Rückruf wünscht.");
    expect(pilot).toContain("Kurz zum Umgang mit euren Angaben");
    expect(pilot).toContain("Die Checkbox unten bestätigt nur");
    expect(pilot).toContain("trpc.pilotInquiry.submit.useMutation");
    expect(pilot).toContain("Wir bestätigen den Eingang zusätzlich per E-Mail.");
    expect(pilot).toContain("Pilotanfragen bis 31.12.2026");
    expect(pilot).toContain("Light 149 € → 74,50 € und Pro 299 € → 149,50 €");
    expect(pilot).toContain("Event Pass und Enterprise sind ausgeschlossen");
    expect(pilot).toContain("Kombination mit anderen Rabatten ist nicht möglich");
    expect(pilot).toContain("in Textform, zum Beispiel per E-Mail");
  });

  it("ordnet die Vergleichstabelle zeitlich ein, ohne die App-Ansicht zu verändern", () => {
    const comparison = read("client/src/components/PackageComparisonSection.tsx");
    const offer = read("client/src/pages/OfferDemo.tsx");

    expect(comparison).toContain("priceNote?: string");
    expect(comparison).toContain("{priceNote && (");
    expect(comparison).toContain('tabIndex={0}');
    expect(comparison).toContain('onKeyDown={handleComparisonKeyDown}');
    expect(comparison).toContain('event.key !== "ArrowLeft" && event.key !== "ArrowRight"');
    expect(comparison).toContain("Nicht enthalten</span>");
    expect(offer).toContain("Reguläre Endpreise ab 01.01.2027");
  });
});
