import { describe, expect, it } from "vitest";
import {
  PRODUCT_CAPABILITIES,
  PRODUCT_PACKAGE_ENTITLEMENTS,
  PRODUCT_PACKAGE_IDS,
  productAllowsCapability,
  productAllowsPlanningModule,
  requiredUpgradePackageForCapability,
} from "../shared/product-packages";

const expectedDocumentAccess = {
  event_pass: false,
  light: false,
  pro: true,
  enterprise: true,
} as const;

describe("Produktfähigkeit: Aufgabenanhänge und Finanzbelege", () => {
  it("registriert document_attachments genau einmal in der gemeinsamen Capability-Liste", () => {
    expect(
      PRODUCT_CAPABILITIES.filter(
        capability => capability === "document_attachments"
      )
    ).toEqual(["document_attachments"]);
  });

  it.each(PRODUCT_PACKAGE_IDS)(
    "hält die gemeinsame Capability-Map für %s vollständig und schaltet Anhänge nur ab Pro frei",
    packageId => {
      const capabilities = PRODUCT_PACKAGE_ENTITLEMENTS[packageId].capabilities;
      expect(Object.keys(capabilities).sort()).toEqual(
        [...PRODUCT_CAPABILITIES].sort()
      );
      expect(capabilities.document_attachments).toBe(
        expectedDocumentAccess[packageId]
      );
      expect(productAllowsCapability(packageId, "document_attachments")).toBe(
        expectedDocumentAccess[packageId]
      );
    }
  );

  it("trennt Anhänge von der weiter verfügbaren Vor- und Nachbereitung", () => {
    expect(productAllowsPlanningModule("event_pass", "preparation")).toBe(true);
    expect(productAllowsPlanningModule("light", "preparation")).toBe(true);
    expect(productAllowsPlanningModule("light", "postprocessing")).toBe(true);
    expect(productAllowsPlanningModule("light", "finances")).toBe(false);
    expect(productAllowsPlanningModule("pro", "finances")).toBe(true);
    expect(productAllowsPlanningModule("enterprise", "finances")).toBe(true);
  });

  it.each(PRODUCT_PACKAGE_IDS)(
    "ermittelt für %s Pro als nötiges Anhangsupgrade oder lässt ein berechtigtes Paket unverändert",
    packageId => {
      expect(
        requiredUpgradePackageForCapability(packageId, "document_attachments")
      ).toBe(expectedDocumentAccess[packageId] ? null : "pro");
    }
  );
});
