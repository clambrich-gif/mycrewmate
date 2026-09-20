import { describe, expect, it } from "vitest";
import { moduleAssignmentClearValues } from "./db";

describe("moduleAssignmentClearValues", () => {
  it("setzt Vorbereitung nur auf den neutralen Arbeitszustand zurück", () => {
    expect(moduleAssignmentClearValues("prep")).toEqual({
      contactId: null,
      dueText: "",
      status: "offen",
      statusWording: "aufgabe",
      note: null,
    });
  });

  it("setzt Nachbereitung ohne Aufgabenlöschung zurück", () => {
    expect(moduleAssignmentClearValues("post")).toEqual({
      contactId: null,
      dueText: "",
      status: "offen",
      note: null,
    });
  });

  it("setzt Materialverantwortung und Beschaffungsstand zurück, lässt aber Inhalte unverändert", () => {
    expect(moduleAssignmentClearValues("materials")).toEqual({
      contactId: null,
      status: "offen",
    });
  });
});
