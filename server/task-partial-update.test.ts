import { describe, expect, it } from "vitest";
import { normalizeOptionalReferenceValue } from "./db";

describe("Teilupdates von Aufgaben", () => {
  it("erhält Ansprechpartner und unterstützende Helfer bei reinen Statuswechseln", () => {
    const statusUpdate = { status: "erledigt" };

    expect(normalizeOptionalReferenceValue(statusUpdate, "contactId")).toEqual({
      status: "erledigt",
    });
    expect(normalizeOptionalReferenceValue(statusUpdate, "helperId")).toEqual({
      status: "erledigt",
    });
  });

  it("löscht Zuordnungen nur bei einer ausdrücklich übermittelten Leerwahl", () => {
    expect(
      normalizeOptionalReferenceValue(
        { status: "inArbeit", contactId: "" },
        "contactId"
      )
    ).toEqual({ status: "inArbeit", contactId: null });

    expect(
      normalizeOptionalReferenceValue(
        { status: "offen", helperId: null },
        "helperId"
      )
    ).toEqual({ status: "offen", helperId: null });
  });
});
