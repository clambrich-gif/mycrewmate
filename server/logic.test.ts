import { describe, expect, it } from "vitest";
import type { Assignment, Helper, Shift } from "../drizzle/schema";
import {
  evaluateShifts,
  helperActiveOnDay,
  helperActiveForShift,
  overlaps,
  toMinutes,
} from "./logic";

const H = (
  id: number,
  willHelp: Helper["willHelp"] = "ja",
  fri: Helper["availFri"] = "ja",
  sat: Helper["availSat"] = "ja",
  sun: Helper["availSun"] = "ja"
): Helper => ({
  id,
  name: `H${id}`,
  contactId: null,
  email: null,
  phone: null,
  willHelp,
  availFri: fri,
  availSat: sat,
  availSun: sun,
  confirmed: "nein",
  createdAt: new Date(),
});

const S = (
  id: number,
  day: Shift["day"],
  startTime = "10:00",
  endTime = "12:00",
  needed = 1
): Shift => ({
  id,
  day,
  area: "A",
  task: `T${id}`,
  startTime,
  endTime,
  needed,
  note: null,
  sortOrder: 0,
  createdAt: new Date(),
});

const A = (
  shiftId: number,
  helperId: number,
  slot = 0,
  id = shiftId * 100 + slot
): Assignment => ({
  id,
  shiftId,
  helperId,
  slot,
  createdAt: new Date(),
});

describe("helperActiveOnDay", () => {
  it("wertet nur ausdrücklich aktive und verfügbare Helfer als einsetzbar", () => {
    expect(helperActiveOnDay(H(1), "Freitag")).toBe(true);
    expect(helperActiveOnDay(H(2, "nein"), "Freitag")).toBe(false);
    expect(helperActiveOnDay(H(3, "ja", "nein"), "Freitag")).toBe(false);
    expect(helperActiveOnDay(H(4, "ja", "vielleicht"), "Freitag")).toBe(false);
  });

  it("stellt aktive Helfer an Montag bis Donnerstag ohne zusätzliches Wochenendfeld bereit", () => {
    expect(helperActiveOnDay(H(1), "Montag")).toBe(true);
    expect(helperActiveOnDay(H(2, "nein"), "Mittwoch")).toBe(false);
    expect(
      helperActiveOnDay(H(3, "ja", "nein", "nein", "nein"), "Donnerstag")
    ).toBe(true);
  });

  it("fordert bei Zeitfenstern die vollständige Abdeckung einer Schicht", () => {
    const afternoonHelper = {
      ...H(5),
      availFriStart: "13:00",
      availFriEnd: "18:00",
    };
    expect(
      helperActiveForShift(afternoonHelper, S(1, "Freitag", "08:00", "12:00"))
    ).toBe(false);
    expect(
      helperActiveForShift(afternoonHelper, S(2, "Freitag", "14:00", "17:00"))
    ).toBe(true);
    expect(
      helperActiveForShift(afternoonHelper, S(3, "Freitag", "17:00", "19:00"))
    ).toBe(false);
    expect(helperActiveForShift(afternoonHelper, S(4, "Freitag", "", ""))).toBe(true);
  });
});

describe("Zeitlogik", () => {
  it("akzeptiert nur vollständige, reale 24-Stunden-Uhrzeiten", () => {
    expect(toMinutes("0:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
    expect(toMinutes("12:30 Rest")).toBeNull();
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("12:60")).toBeNull();
    expect(toMinutes("")).toBeNull();
  });

  it("erkennt Überlappung am selben Tag, aber nicht an einer gemeinsamen Grenze", () => {
    expect(
      overlaps(
        S(1, "Freitag", "10:00", "12:00"),
        S(2, "Freitag", "11:00", "13:00")
      )
    ).toBe(true);
    expect(
      overlaps(
        S(1, "Freitag", "10:00", "12:00"),
        S(2, "Freitag", "12:00", "13:00")
      )
    ).toBe(false);
    expect(overlaps(S(1, "Freitag"), S(2, "Samstag"))).toBe(false);
    expect(
      overlaps(
        S(3, "Montag", "09:00", "11:00"),
        S(4, "Montag", "10:00", "12:00")
      )
    ).toBe(true);
  });

  it("behandelt ganztägige Schichten als den gesamten Tag", () => {
    expect(
      overlaps(S(1, "Freitag", "", ""), S(2, "Freitag", "10:00", "11:00"))
    ).toBe(true);
  });
});

describe("evaluateShifts", () => {
  it("zählt eine Absage als Ausfall und nicht als Besetzung", () => {
    const shifts = [S(1, "Freitag", "10:00", "12:00", 2)];
    const helpers = [H(1), H(2, "nein")];
    const evaluation = evaluateShifts(
      shifts,
      [A(1, 1, 0), A(1, 2, 1)],
      helpers
    );

    expect(evaluation[0].besetzt).toBe(1);
    expect(evaluation[0].ausfallCount).toBe(1);
    expect(evaluation[0].status).toBe("KNAPP");
  });

  it("zählt eine nicht passende Zeitverfügbarkeit als Ausfall", () => {
    const shifts = [S(1, "Freitag", "08:00", "12:00", 1)];
    const helpers = [{ ...H(1), availFriStart: "13:00", availFriEnd: "18:00" }];
    const evaluation = evaluateShifts(shifts, [A(1, 1)], helpers);

    expect(evaluation[0].besetzt).toBe(0);
    expect(evaluation[0].ausfallCount).toBe(1);
  });

  it("markiert Doppelbelegungen nur an den tatsächlich kollidierenden Schichten", () => {
    const shifts = [
      S(1, "Freitag", "10:00", "12:00"),
      S(2, "Freitag", "11:00", "13:00"),
      S(3, "Freitag", "14:00", "15:00"),
    ];
    const evaluation = evaluateShifts(
      shifts,
      [A(1, 1), A(2, 1), A(3, 1)],
      [H(1)]
    );

    expect(evaluation.map(item => item.doppelCount)).toEqual([1, 1, 0]);
    expect(evaluation[2].doppelIds.has(1)).toBe(false);
  });

  it("gibt Ausfällen Vorrang vor Doppelbelegungen", () => {
    const shifts = [
      S(1, "Freitag", "10:00", "12:00"),
      S(2, "Freitag", "11:00", "13:00"),
    ];
    const evaluation = evaluateShifts(
      shifts,
      [A(1, 1), A(2, 1)],
      [H(1, "nein")]
    );

    expect(evaluation[0].ausfallCount).toBe(1);
    expect(evaluation[0].doppelCount).toBe(0);
  });

  it("zählt veraltete Doppelzeilen pro Schicht und Slot nur einmal", () => {
    const shifts = [S(1, "Freitag", "10:00", "12:00", 2)];
    const assignments = [A(1, 1, 0, 1), A(1, 1, 1, 2), A(1, 2, 0, 3)];
    const evaluation = evaluateShifts(shifts, assignments, [H(1), H(2)]);

    expect(evaluation[0].besetzt).toBe(1);
    expect(evaluation[0].assigned).toHaveLength(1);
    expect(evaluation[0].doppelCount).toBe(0);
    expect(evaluation[0].status).toBe("KNAPP");
  });
});

describe("vollständige Planungssimulation", () => {
  it("findet alle Probleme im Entwurf und bestätigt anschließend den konfliktfreien Drei-Tage-Plan", () => {
    const helpers = [
      H(1),
      H(2),
      H(3),
      H(4),
      H(5, "ja", "ja", "nein", "ja"),
      H(6),
    ];
    const shifts = [
      S(1, "Freitag", "08:00", "10:00", 2),
      S(2, "Freitag", "10:00", "13:00", 2),
      S(3, "Freitag", "11:00", "14:00", 2),
      S(4, "Samstag", "08:00", "12:00", 3),
      S(5, "Samstag", "12:00", "16:00", 2),
      S(6, "Sonntag", "", "", 3),
    ];

    const draft = evaluateShifts(
      shifts,
      [
        A(1, 1, 0),
        A(1, 2, 1),
        A(2, 1, 0),
        A(2, 3, 1),
        A(3, 3, 0),
        A(3, 4, 1),
        A(4, 1, 0),
        A(4, 2, 1),
        A(4, 5, 2),
        A(5, 3, 0),
      ],
      helpers
    );

    expect(draft.map(item => item.status)).toEqual([
      "OK",
      "OK",
      "OK",
      "KNAPP",
      "KNAPP",
      "OFFEN",
    ]);
    expect(draft.reduce((sum, item) => sum + item.doppelCount, 0)).toBe(2);
    expect(draft.reduce((sum, item) => sum + item.ausfallCount, 0)).toBe(1);

    const completed = evaluateShifts(
      shifts,
      [
        A(1, 1, 0),
        A(1, 2, 1),
        A(2, 1, 0),
        A(2, 3, 1),
        A(3, 4, 0),
        A(3, 6, 1),
        A(4, 1, 0),
        A(4, 2, 1),
        A(4, 4, 2),
        A(5, 2, 0),
        A(5, 3, 1),
        A(6, 1, 0),
        A(6, 3, 1),
        A(6, 4, 2),
      ],
      helpers
    );

    expect(completed).toHaveLength(6);
    expect(completed.every(item => item.status === "OK")).toBe(true);
    expect(completed.reduce((sum, item) => sum + item.besetzt, 0)).toBe(14);
    expect(completed.reduce((sum, item) => sum + item.shift.needed, 0)).toBe(
      14
    );
    expect(completed.reduce((sum, item) => sum + item.doppelCount, 0)).toBe(0);
    expect(completed.reduce((sum, item) => sum + item.ausfallCount, 0)).toBe(0);
  });
});
