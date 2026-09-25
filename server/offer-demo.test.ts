import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("lokale MyCrewMate-Angebotsdemo", () => {
  it("stellt den wieder wählbaren Event Pass und drei frei entscheidbare Jahresmodelle mit sicher markiertem Musterwarenkorb bereit", () => {
    const offerDemo = source("client/src/pages/OfferDemo.tsx");

    expect(offerDemo).toContain('id: "event-pass"');
    expect(offerDemo).toContain('id: "light"');
    expect(offerDemo).toContain('id: "pro"');
    expect(offerDemo).toContain('id: "enterprise"');
    expect(offerDemo).toContain("price: 69");
    expect(offerDemo).toContain("price: 149");
    expect(offerDemo).toContain("price: 299");
    expect(offerDemo).toContain("price: 449");
    expect(offerDemo).toContain("Ein Event. Ein Preis. Frei entscheiden.");
    expect(offerDemo).toContain("Jedes Jahr frei neu entscheiden");
    expect(offerDemo).toContain("nicht automatisch verlängert");
    expect(offerDemo).toContain("regelmäßigen Veranstaltungen");
    expect(offerDemo).toContain("1 gemeinsamer Orga- und Massenzugang");
    expect(offerDemo).toContain("Bis 50 Helfer, Vorbereitung und Schichten");
    expect(offerDemo).toContain("Keine persönlichen Zugänge");
    expect(offerDemo).toContain("Kein Live-Chat");
    expect(offerDemo).toContain('priceUnit: "einmalig pro Veranstaltung*"');
    expect(offerDemo).toContain("Musterdemo · Preise, Warenkorb und Checkout sind fiktiv");
    expect(offerDemo).toContain("Simuliert in den Warenkorb");
    expect(offerDemo).toContain("Fiktiver Muster-Checkout");
    expect(offerDemo).toContain("keine Bestellung gespeichert oder übertragen");
    expect(offerDemo).not.toContain("Abo");
    expect(offerDemo).not.toContain("Abo-Falle");
    expect(offerDemo).not.toContain("trpc.");
  });

  it("erklärt den Kundennutzen je Paket, vergleicht die Stufen und zeigt passende Vereinswelten", () => {
    const offerDemo = source("client/src/pages/OfferDemo.tsx");

    expect(offerDemo).toContain("detailBenefits");
    expect(offerDemo).toContain("Das ist enthalten");
    expect(offerDemo).toContain("Der nächste sinnvolle Schritt");
    expect(offerDemo).toContain("COMPARISON_ROWS");
    expect(offerDemo).toContain('data-offer-comparison');
    expect(offerDemo).toContain("Einfach starten, gemeinsam organisieren, vollständig steuern oder individuell wachsen");
    expect(offerDemo).toContain("Live-Unterstützung mit Zustimmung – geplant");
    expect(offerDemo).toContain("KI-Planungshilfe");
    expect(offerDemo).toContain("Für wen ist MyCrewMate?");
    expect(offerDemo).toContain('data-target-group={group.id}');
    expect(offerDemo).toContain("Radsport & Ausdauer");
    expect(offerDemo).toContain("Kirmes & Stadtfest");
    expect(offerDemo).toContain("Schützen & Tradition");
    expect(offerDemo).toContain("Feuerwehr & Einsatzfeste");
    expect(offerDemo).toContain("Sport, Musik & Jugend");
    expect(offerDemo).toContain("/landing/cycling.jpg");
    expect(offerDemo).toContain("eigens für MyCrewMate erzeugte, illustrative Website-Motive");
  });

  it("hängt die Demo isoliert außerhalb des geschützten Arbeitslayouts ein", () => {
    const app = source("client/src/App.tsx");

    expect(app).toContain('const OfferDemo = lazy(() => import("@/pages/OfferDemo"));');
    expect(app).toContain('<Route path="/angebot-demo">');
    expect(app.indexOf('<Route path="/angebot-demo">')).toBeLessThan(app.indexOf("<Layout>"));
  });

  it("öffnet den Werbefilm über das Feld So einfach funktioniert's in einem bedienbaren Videodialog", () => {
    const offerDemo = source("client/src/pages/OfferDemo.tsx");

    expect(offerDemo).toContain("const [promoVideoOpen, setPromoVideoOpen] = useState(false)");
    expect(offerDemo).toContain("onClick={() => setPromoVideoOpen(true)}");
    expect(offerDemo).toContain("<Dialog open={promoVideoOpen} onOpenChange={setPromoVideoOpen}>");
    expect(offerDemo).toContain("MyCrewMate im Überblick");
    expect(offerDemo).toContain("<video");
    expect(offerDemo).toContain("controls");
    expect(offerDemo).toContain("autoPlay");
    expect(offerDemo).toContain("playsInline");
    expect(offerDemo).toContain('src="/api/marketing/promo-video"');
  });
});
