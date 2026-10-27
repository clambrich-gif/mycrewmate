import { describe, expect, it } from "vitest";
import { ageInYears, isValidBirthDate } from "../shared/helper-age";

describe("optionale Altersanzeige für Helfer", () => {
  const reference = new Date("2026-10-27T12:00:00.000Z");

  it("berechnet nur vollendete Lebensjahre", () => {
    expect(ageInYears("2008-10-27", reference)).toBe(18);
    expect(ageInYears("2008-10-28", reference)).toBe(17);
    expect(ageInYears("1966-03-01", reference)).toBe(60);
  });

  it("akzeptiert nur echte, nicht zukünftige Kalendertage", () => {
    expect(isValidBirthDate("2012-02-29", reference)).toBe(true);
    expect(isValidBirthDate("2011-02-29", reference)).toBe(false);
    expect(isValidBirthDate("2026-10-28", reference)).toBe(false);
    expect(ageInYears("2026-10-28", reference)).toBeNull();
  });
});
