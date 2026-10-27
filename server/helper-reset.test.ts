import { describe, expect, it } from "vitest";
import { partitionHelpersForCompleteReset } from "./db";

describe("vollständiger Helfer-Reset", () => {
  it("behält nur die eigenen, mit Ansprechpartnern verknüpften Helferdatensätze", () => {
    const result = partitionHelpersForCompleteReset(
      [
        { id: 10, name: "Maria Muster", contactId: 1 },
        { id: 11, name: "Max Mustermann", contactId: 2 },
        { id: 12, name: "Helferin ohne Ansprechpartner", contactId: null },
        { id: 13, name: "Anderer Max", contactId: 2 },
      ],
      [
        { id: 1, name: "Maria Muster" },
        { id: 2, name: "Max Mustermann" },
      ]
    );

    expect(result.retainedContactHelperIds).toEqual([10, 11]);
    expect(result.deletedHelperIds).toEqual([12, 13]);
  });

  it("erkennt den eigenen Helferdatensatz trotz Schreibvarianten im Namen", () => {
    const result = partitionHelpersForCompleteReset(
      [{ id: 21, name: "  LENA   Beispiel (Orga) ", contactId: 7 }],
      [{ id: 7, name: "Lena Beispiel" }]
    );

    expect(result.retainedContactHelperIds).toEqual([21]);
    expect(result.deletedHelperIds).toEqual([]);
  });
});
