import { describe, expect, it } from "vitest";
import type { Assignment, Helper, Shift } from "../drizzle/schema";
import {
  ShiftUpdateValidationError,
  validateExistingAssignmentsForShiftUpdate,
} from "./shift-update-validation";

function helper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 11,
    year: 2026,
    eventId: 1,
    contactId: null,
    name: "Alex Test",
    email: null,
    phone: null,
    note: null,
    willHelp: "ja",
    availMon: "ja",
    availTue: "ja",
    availWed: "ja",
    availThu: "ja",
    availFri: "ja",
    availSat: "ja",
    availSun: "ja",
    confirmed: "ja",
    createdAt: new Date(),
    ...overrides,
  };
}

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 1,
    year: 2026,
    eventId: 1,
    day: "Freitag",
    area: "Start",
    task: "Anmeldung",
    startTime: "08:00",
    endTime: "10:00",
    needed: 1,
    note: null,
    sortOrder: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 101,
    shiftId: 1,
    helperId: 11,
    slot: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function validate(overrides: {
  proposedShift?: Shift;
  existingAssignments?: Assignment[];
  assignedHelpers?: Helper[];
  relatedAssignments?: Assignment[];
  relatedShifts?: Shift[];
} = {}) {
  validateExistingAssignmentsForShiftUpdate({
    proposedShift: overrides.proposedShift ?? shift(),
    existingAssignments: overrides.existingAssignments ?? [assignment()],
    assignedHelpers: overrides.assignedHelpers ?? [helper()],
    relatedAssignments: overrides.relatedAssignments ?? [assignment()],
    relatedShifts: overrides.relatedShifts ?? [shift()],
  });
}

describe("Schichtupdate-Validierung mit bestehenden Zuweisungen", () => {
  it("akzeptiert einen unveränderten, gültigen Zuweisungsstand", () => {
    expect(() => validate()).not.toThrow();
  });

  it("akzeptiert needed=0, wenn für die Schicht noch keine Zuweisungen existieren", () => {
    expect(() =>
      validate({
        proposedShift: shift({ needed: 0 }),
        existingAssignments: [],
        assignedHelpers: [],
        relatedAssignments: [],
        relatedShifts: [],
      })
    ).not.toThrow();
  });

  it("lehnt einen Bedarf unterhalb bereits belegter Helferplätze ab", () => {
    expect(() => validate({ proposedShift: shift({ needed: 0 }) })).toThrow(
      ShiftUpdateValidationError
    );
    expect(() => validate({ proposedShift: shift({ needed: 0 }) })).toThrow(
      "kleiner als bereits belegte Helferplätze"
    );
  });

  it("lehnt einen neuen, für den zugewiesenen Helfer nicht verfügbaren Tag ab", () => {
    expect(() =>
      validate({
        proposedShift: shift({ day: "Samstag" }),
        assignedHelpers: [helper({ availSat: "nein" })],
      })
    ).toThrow("am Samstag nicht verfügbar");
  });

  it("lehnt eine neue Zeitüberschneidung mit einer anderen Schicht desselben Helfers ab", () => {
    const otherShift = shift({
      id: 2,
      area: "Strecke",
      task: "Posten 1",
      startTime: "09:00",
      endTime: "11:00",
    });
    expect(() =>
      validate({
        proposedShift: shift({ startTime: "08:30", endTime: "10:30" }),
        relatedAssignments: [assignment(), assignment({ id: 102, shiftId: 2 })],
        relatedShifts: [shift(), otherShift],
      })
    ).toThrow("überschneidet sich");
  });
});
