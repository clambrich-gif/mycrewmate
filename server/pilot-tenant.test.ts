import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("RSC-Pilot-Grundlage", () => {
  it("definiert den Pilotmandanten RSC Eifelland Mayen e. V. mit Status pilot", () => {
    const tenantSource = fs.readFileSync(
      path.resolve(__dirname, "../shared/tenant.ts"),
      "utf-8"
    );
    expect(tenantSource).toContain("RSC Eifelland Mayen e. V.");
    expect(tenantSource).toContain('"pilot"');
    expect(tenantSource).toContain("MyEifelRide 2027");
  });

  it("zeigt das Pilot-Badge im Anwendungs-Layout an", () => {
    const layoutSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/Layout.tsx"),
      "utf-8"
    );
    expect(layoutSource).toContain("ACTIVE_PILOT_TENANT");
    expect(layoutSource).toContain("Pilot");
  });

  it("zeigt Enterprise auf der Angebotsseite mit ab 449 Euro pro Jahr an", () => {
    const offerSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/OfferDemo.tsx"),
      "utf-8"
    );
    expect(offerSource).toContain('pricePrefix: "ab"');
    expect(offerSource).toContain("ab");
    expect(offerSource).toContain("449");
  });
});
