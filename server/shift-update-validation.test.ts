import { describe, expect, it } from "vitest";
import type { Assignment, Helper, Shift } from "../drizzle/schema";
import {
  normalizedAssignedSlotUpdates,
  ShiftUpdateValidationError,
  unassignedAssignmentIds,
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

  it("akzeptiert das Reduzieren eines leeren letzten Slots und markiert ihn zur Bereinigung", () => {
    const realAssignment = assignment({ id: 101, slot: 9 });
    // Dieses Format kann aus einer älteren Importdatei stammen. Im aktuellen
    // Datenmodell entstehen leere Auswahlfelder gar nicht als Assignment.
    const emptyLegacySlot = assignment({
      id: 102,
      slot: 10,
      helperId: null as never,
    });

    expect(() =>
      validate({
        proposedShift: shift({ needed: 10 }),
        existingAssignments: [realAssignment, emptyLegacySlot],
        assignedHelpers: [helper()],
        relatedAssignments: [realAssignment],
        relatedShifts: [shift()],
      })
    ).not.toThrow();
    expect(unassignedAssignmentIds([realAssignment, emptyLegacySlot])).toEqual([
      102,
    ]);
  });

  it("verdichtet echte Helfer aus hohen Slots bei einer zulässigen Bedarfssenkung", () => {
    const firstHelper = assignment({ id: 101, slot: 0 });
    const tenthHelper = assignment({ id: 102, slot: 10, helperId: 12 });

    expect(() =>
      validate({
        proposedShift: shift({ needed: 10 }),
        existingAssignments: [firstHelper, tenthHelper],
        assignedHelpers: [helper(), helper({ id: 12, name: "Robin Test" })],
        relatedAssignments: [firstHelper, tenthHelper],
        relatedShifts: [shift()],
      })
    ).not.toThrow();
    expect(normalizedAssignedSlotUpdates([firstHelper, tenthHelper])).toEqual([
      { id: 101, previousSlot: 0, slot: 0 },
      { id: 102, previousSlot: 10, slot: 1 },
    ]);
  });

  it("lehnt eine Bedarfssenkung weiterhin ab, wenn mehr echte Helfer als Plätze bleiben", () => {
    expect(() =>
      validate({
        proposedShift: shift({ needed: 1 }),
        existingAssignments: [assignment({ id: 101 }), assignment({ id: 102, slot: 1, helperId: 12 })],
        assignedHelpers: [helper(), helper({ id: 12, name: "Robin Test" })],
        relatedAssignments: [assignment({ id: 101 }), assignment({ id: 102, slot: 1, helperId: 12 })],
        relatedShifts: [shift()],
      })
    ).toThrow("kleiner als bereits belegte Helferplätze");
  });

  it("lehnt einen neuen, für den zugewiesenen Helfer nicht verfügbaren Tag ab", () => {
    expect(() =>
      validate({
        proposedShift: shift({ day: "Samstag" }),
        assignedHelpers: [helper({ availSat: "nein" })],
      })
    ).toThrow("am Samstag nicht verfügbar");
  });

  it("lehnt eine Schichtzeit außerhalb eines gespeicherten Zeitfensters ab", () => {
    expect(() =>
      validate({
        proposedShift: shift({ startTime: "08:00", endTime: "12:00" }),
        assignedHelpers: [
          helper({ availFriStart: "13:00", availFriEnd: "18:00" }),
        ],
      })
    ).toThrow(
      "Die Schichtzeit 08:00–12:00 Uhr liegt für „Alex Test“ am Freitag außerhalb des Zeitfensters (Verfügbar: 13:00 – 18:00 Uhr)"
    );
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
