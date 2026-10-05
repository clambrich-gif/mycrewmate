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
    expect(legal).toContain("eigenständige Plattform für Vereins- und Eventplanung");
    expect(legal).toContain("keiner Verbindung zu gleichnamigen Angeboten anderer Betreiber");
  });

  it("stellt für die geschützte App einen eigenen, vollständigen Datenschutzhinweis bereit", () => {
    const app = source("client/src/App.tsx");
    const privacy = source("client/src/pages/AppPrivacy.tsx");
    const legalFooter = source("client/src/components/ImpressumDialog.tsx");

    expect(app).toContain('const AppPrivacy = lazy(() => import("@/pages/AppPrivacy"));');
    expect(app).toContain("<AppPrivacy />");
    expect(privacy).toContain("Datenschutz für die MyCrewMate-App");
    expect(privacy).toContain("info@mycrewmate.de");
    expect(privacy).toContain("OpenStreetMap");
    expect(privacy).toContain("OpenTopoMap");
    expect(privacy).toContain("Der WhatsApp-Button öffnet ausschließlich nach einem bewussten");
    expect(privacy).toContain("Persönliche PDF-Übersichten");
    expect(privacy).toContain("Jahren ab Veranstaltungsabschluss");
    expect(legalFooter).toContain(
      'export const PRIVACY_POLICY_URL = "https://app.mycrewmate.de/datenschutz"'
    );
  });

  it("bietet die öffentlichen Rechtstexte als saubere Druckansicht an", () => {
    const legal = source("client/src/pages/PublicLegal.tsx");
    const documents = source("client/src/pages/LegalDocument.tsx");
    const appPrivacy = source("client/src/pages/AppPrivacy.tsx");

    expect(legal).toContain('data-slot="public-legal-print"');
    expect(documents).toContain('data-slot="legal-document-print"');
    expect(appPrivacy).toContain('data-slot="app-privacy-print"');
    expect(legal).toContain("window.print()");
    expect(documents).toContain("window.print()");
    expect(appPrivacy).toContain("window.print()");
  });
});
