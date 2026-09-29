import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_PACKAGE_ID,
  DEFAULT_PRODUCT_ASSIGNMENT_STATUS,
  PRODUCT_PACKAGE_IDS,
  PRODUCT_PACKAGE_META,
  isProductPackageId,
  isProductAssignmentStatus,
} from "../shared/product-packages";
import {
  assertPackageAssignmentDates,
  normalizedPackageDate,
} from "./db";

describe("Paket 1: Produktkatalog & Master-Admin-Grundlagen", () => {
  it("enthält exakt die vier definierten Produktpakete und Standardwerte", () => {
    expect(PRODUCT_PACKAGE_IDS).toEqual(["event_pass", "light", "pro", "enterprise"]);
    expect(DEFAULT_PRODUCT_PACKAGE_ID).toBe("pro");
    expect(DEFAULT_PRODUCT_ASSIGNMENT_STATUS).toBe("test");
  });

  it("prüft gültige Paket-IDs und Statuswerte zuverlässig", () => {
    expect(isProductPackageId("event_pass")).toBe(true);
    expect(isProductPackageId("light")).toBe(true);
    expect(isProductPackageId("pro")).toBe(true);
    expect(isProductPackageId("enterprise")).toBe(true);
    expect(isProductPackageId("ultimate")).toBe(false);

    expect(isProductAssignmentStatus("test")).toBe(true);
    expect(isProductAssignmentStatus("active")).toBe(true);
    expect(isProductAssignmentStatus("paused")).toBe(true);
    expect(isProductAssignmentStatus("expired")).toBe(true);
    expect(isProductAssignmentStatus("disabled")).toBe(false);
  });

  it("führt die freigegebenen Preise und Bezeichnungen aus dem Angebot", () => {
    expect(PRODUCT_PACKAGE_META.event_pass.priceLabel).toBe("69 € · einmalig");
    expect(PRODUCT_PACKAGE_META.light.priceLabel).toBe("149 € · Veranstaltungsjahr");
    expect(PRODUCT_PACKAGE_META.pro.priceLabel).toBe("299 € · Veranstaltungsjahr");
    expect(PRODUCT_PACKAGE_META.enterprise.priceLabel).toBe("ab 449 € · Veranstaltungsjahr");
  });

  it("formatiert und validiert optionale Datumsangaben für die Datenbank", () => {
    expect(normalizedPackageDate("2026-05-01")).toBe("2026-05-01");
    expect(normalizedPackageDate("")).toBeNull();
    expect(normalizedPackageDate(null)).toBeNull();
    expect(normalizedPackageDate(undefined)).toBeNull();

    expect(() => assertPackageAssignmentDates("2026-06-01", "2026-05-01")).toThrow(
      "Das Paketende darf nicht vor dem Paketbeginn liegen"
    );
    expect(() => assertPackageAssignmentDates("invalid-date", "2026-05-01")).toThrow(
      "Der Paketbeginn muss ein gültiges Datum sein"
    );
    expect(() => assertPackageAssignmentDates("2026-05-01", "2026-05-01")).not.toThrow();
    expect(() => assertPackageAssignmentDates("2026-05-01", "2026-06-01")).not.toThrow();
  });
});
