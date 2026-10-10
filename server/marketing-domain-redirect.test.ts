import { describe, expect, it } from "vitest";
import {
  CANONICAL_MARKETING_ORIGIN,
  canonicalMarketingRedirectUrl,
  shouldRedirectProtectiveMarketingDomain,
} from "./marketing-domain-redirect";

describe("Schutzdomains für MyCrewMate", () => {
  it("leitet die Variante ohne www und reservierte Landesdomains dauerhaft auf die deutsche Hauptseite", () => {
    for (const host of [
      "mycrewmate.de",
      "mycrewmate.at",
      "www.mycrewmate.at",
      "mycrewmate.eu",
      "www.mycrewmate.eu",
      "mycrewmate.ch",
      "www.mycrewmate.ch",
    ]) {
      expect(canonicalMarketingRedirectUrl(host, "/vereinsdemo?quelle=domain")).toBe(
        "https://www.mycrewmate.de/vereinsdemo?quelle=domain"
      );
      expect(shouldRedirectProtectiveMarketingDomain("GET", host)).toBe(true);
    }
  });

  it("lässt ausschließlich die Hauptadresse mit www und die geschützte App unverändert", () => {
    expect(canonicalMarketingRedirectUrl("www.mycrewmate.de", "/")).toBeNull();
    expect(canonicalMarketingRedirectUrl("app.mycrewmate.de", "/helfer")).toBeNull();
    expect(shouldRedirectProtectiveMarketingDomain("POST", "mycrewmate.at")).toBe(false);
  });

  it("verwendet immer die feste kanonische Zielorigin", () => {
    expect(CANONICAL_MARKETING_ORIGIN).toBe("https://www.mycrewmate.de");
    expect(canonicalMarketingRedirectUrl("MYCREWMATE.CH.", "/impressum")).toBe(
      "https://www.mycrewmate.de/impressum"
    );
  });
});
