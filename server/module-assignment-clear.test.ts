import { describe, expect, it } from "vitest";
import {
  helperAssignmentClearValues,
  moduleAssignmentClearValues,
} from "./db";

describe("moduleAssignmentClearValues", () => {
  it("setzt Helfer ohne Stammdaten- oder Schichtlöschung auf den Ausgangszustand zurück", () => {
    const expected = {
      contactId: null,
      note: null,
      companion: null,
      willHelp: "ja",
      availMon: "vielleicht",
      availTue: "vielleicht",
      availWed: "vielleicht",
      availThu: "vielleicht",
      availFri: "vielleicht",
      availSat: "vielleicht",
      availSun: "vielleicht",
      availMonStart: null,
      availMonEnd: null,
      availTueStart: null,
      availTueEnd: null,
      availWedStart: null,
      availWedEnd: null,
      availThuStart: null,
      availThuEnd: null,
      availFriStart: null,
      availFriEnd: null,
      availSatStart: null,
      availSatEnd: null,
      availSunStart: null,
      availSunEnd: null,
      confirmed: "nein",
    };

    expect(helperAssignmentClearValues()).toEqual(expected);
    expect(moduleAssignmentClearValues("helpers")).toEqual(expected);
  });

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
