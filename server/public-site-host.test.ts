import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APP_LOGIN_URL,
  appUrl,
  isMarketingHost,
} from "../client/src/lib/site-host";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Trennung von Angebotsseite und geschützter MyCrewMate-Anwendung", () => {
  it("erkennt ausschließlich die beiden öffentlichen Hauptdomains als Marketingseite", () => {
    expect(isMarketingHost("mycrewmate.de")).toBe(true);
    expect(isMarketingHost("www.mycrewmate.de")).toBe(true);
    expect(isMarketingHost("MYCREWMATE.DE")).toBe(true);
    expect(isMarketingHost("app.mycrewmate.de")).toBe(false);
    expect(isMarketingHost("preview.manus.computer")).toBe(false);
  });

  it("baut ausschließlich HTTPS-Links zur geschützten App-Subdomain", () => {
    expect(APP_LOGIN_URL).toBe("https://app.mycrewmate.de/login");
    expect(appUrl("/p/Ab3dE9F_", "?source=whatsapp")).toBe(
      "https://app.mycrewmate.de/p/Ab3dE9F_?source=whatsapp"
    );
  });

  it("behandelt den direkten Loginpfad nach der Anmeldung als Dashboard-Einstieg", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('<Route path="/login">');
    expect(app).toContain('<Redirect to="/" />');
  });

  it("rendert die Landingpage ohne geschützte App-Kontexte und leitet alte App-Pfade sicher weiter", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain("appUrlForCurrentLocation");
    expect(app).toContain("isMarketingSite");
    expect(app).toContain("function PublicSiteRouter()");
    expect(app).toContain('window.location.replace(appUrlForCurrentLocation());');
    expect(app).toContain('<Route path="/impressum">');
    expect(app).toContain('<Route path="/datenschutz">');
    expect(app).toContain("marketingSite ? (");
  });

  it("kennzeichnet die öffentliche Musterdemo klar und verlinkt ihren Login auf die App", () => {
    const offerDemo = source("client/src/pages/OfferDemo.tsx");
    const legal = source("client/src/pages/PublicLegal.tsx");
    expect(offerDemo).toContain("Musterdemo · Preise, Warenkorb und Checkout sind fiktiv");
    expect(offerDemo).toContain("href={APP_LOGIN_URL}");
    expect(offerDemo).toContain('href="/impressum"');
    expect(offerDemo).toContain('href="/datenschutz"');
    expect(legal).toContain("Diese öffentliche Musterseite dient ausschließlich der Produktinformation.");
    expect(legal).toContain("keine Zahlungsabwicklung");
  });
});
