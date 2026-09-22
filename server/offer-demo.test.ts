import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("lokale MyCrewMate-Angebotsdemo", () => {
  it("stellt drei fiktive Pakete mit sicher markiertem Musterwarenkorb bereit", () => {
    const offerDemo = source("client/src/pages/OfferDemo.tsx");

    expect(offerDemo).toContain('id: "light"');
    expect(offerDemo).toContain('id: "pro"');
    expect(offerDemo).toContain('id: "enterprise"');
    expect(offerDemo).toContain("price: 149");
    expect(offerDemo).toContain("price: 299");
    expect(offerDemo).toContain("price: 449");
    expect(offerDemo).toContain("Musterdemo · Preise, Warenkorb und Checkout sind fiktiv");
    expect(offerDemo).toContain("Simuliert in den Warenkorb");
    expect(offerDemo).toContain("Fiktiver Muster-Checkout");
    expect(offerDemo).toContain("keine Bestellung gespeichert oder übertragen");
    expect(offerDemo).not.toContain("trpc.");
  });

  it("hängt die Demo isoliert außerhalb des geschützten Arbeitslayouts ein", () => {
    const app = source("client/src/App.tsx");

    expect(app).toContain('const OfferDemo = lazy(() => import("@/pages/OfferDemo"));');
    expect(app).toContain('<Route path="/angebot-demo">');
    expect(app.indexOf('<Route path="/angebot-demo">')).toBeLessThan(app.indexOf("<Layout>"));
  });
});
