import { describe, expect, it } from "vitest";
import { normalizePersonName, selfHelperValues } from "./db";
import {
  currentEventYear,
  DEFAULT_EVENT_YEAR,
  normalizeEventYear,
  withEventYear,
} from "./year-context";

describe("Mehrjahresplanung", () => {
  it("akzeptiert gültige Veranstaltungsjahre und verwirft ungültige Werte", () => {
    expect(normalizeEventYear("2027")).toBe(2027);
    expect(normalizeEventYear(2031)).toBe(2031);
    expect(normalizeEventYear("abc")).toBe(DEFAULT_EVENT_YEAR);
    expect(normalizeEventYear(1900)).toBe(DEFAULT_EVENT_YEAR);
  });

  it("isoliert das aktive Jahr im asynchronen Kontext", async () => {
    const value = await withEventYear(2027, async () => {
      await Promise.resolve();
      return currentEventYear();
    });
    expect(value).toBe(2027);
    expect(currentEventYear()).toBe(DEFAULT_EVENT_YEAR);
  });

  it("normalisiert Personennamen für eine robuste Dublettenprüfung", () => {
    expect(normalizePersonName("  Jörg   Müller ")).toBe("jörg müller");
    expect(normalizePersonName("JÖRG MÜLLER")).toBe("jörg müller");
    expect(normalizePersonName("Jörg Müller (Team Nord)")).toBe("jörg müller");
  });

  it("übernimmt Ansprechpartner als selbst zugeordneten Helfer", () => {
    expect(
      selfHelperValues({
        id: 42,
        name: "  Petra   Beispiel ",
        phone: "02651 12345",
      })
    ).toEqual({
      name: "Petra Beispiel",
      contactId: 42,
      phone: "02651 12345",
    });
    expect(
      selfHelperValues({ id: 43, name: "Ohne Telefon", phone: null })
    ).toEqual({ name: "Ohne Telefon", contactId: 43, phone: null });
  });
});
