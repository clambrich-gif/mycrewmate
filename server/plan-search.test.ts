import { describe, expect, it } from "vitest";
import { planEvaluationMatchesSearch } from "../client/src/lib/plan-search";

const evaluation = {
  shift: { task: "Startnummernausgabe", area: "Anmeldung" },
  assigned: [{ helperId: 11 }, { helperId: 12 }],
};
const helperNameById = new Map([
  [11, "Anne Veling"],
  [12, "Peter Pickel"],
  [13, "Martin Reis"],
]);

describe("dynamische Einsatzplan-Suche", () => {
  it("findet Schichten weiterhin über Aufgabe und Bereich", () => {
    expect(
      planEvaluationMatchesSearch(evaluation, "startnummer", helperNameById)
    ).toBe(true);
    expect(
      planEvaluationMatchesSearch(evaluation, "ANMELDUNG", helperNameById)
    ).toBe(true);
  });

  it("findet alle Schichten eines eingeteilten Helfers über Vor- oder Nachnamen", () => {
    expect(
      planEvaluationMatchesSearch(evaluation, "anne", helperNameById)
    ).toBe(true);
    expect(
      planEvaluationMatchesSearch(evaluation, "PICKEL", helperNameById)
    ).toBe(true);
  });

  it("zeigt keine Schicht für einen dort nicht eingeteilten Helfer", () => {
    expect(
      planEvaluationMatchesSearch(evaluation, "Martin Reis", helperNameById)
    ).toBe(false);
  });

  it("behandelt eine leere Suche als ungefiltert", () => {
    expect(planEvaluationMatchesSearch(evaluation, "  ", helperNameById)).toBe(
      true
    );
  });
});
