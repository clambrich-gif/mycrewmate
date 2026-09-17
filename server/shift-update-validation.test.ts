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
} = {}) {
  validateExistingAssignmentsForShiftUpdate({
    proposedShift: overrides.proposedShift ?? shift(),
    existingAssignments: overrides.existingAssignments ?? [assignment()],
    assignedHelpers: overrides.assignedHelpers ?? [helper()],
  });
}

describe("Schichtupdate-Validierung mit bestehenden Zuweisungen", () => {
  it("akzeptiert einen unveränderten, gültigen Zuweisungsstand", () => {
    expect(() => validate()).not.toThrow();
  });

  it("akzeptiert needed=0, wenn für die Schicht noch keine Zuweisungen existieren", () => {
    expect(() =>
      validate({
        existingAssignments: [],
        assignedHelpers: [],
      })
    ).not.toThrow();
  });

  it("lehnt einen Bedarf unterhalb bereits belegter Helferplätze ab", () => {
    expect(() => validate({ existingAssignments: [assignment(), assignment({ id: 102, slot: 1, helperId: 12 })], assignedHelpers: [helper(), helper({ id: 12, name: "Robin Test" })] })).toThrow(
      ShiftUpdateValidationError
    );
    expect(() => validate({ existingAssignments: [assignment(), assignment({ id: 102, slot: 1, helperId: 12 })], assignedHelpers: [helper(), helper({ id: 12, name: "Robin Test" })] })).toThrow(
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
        existingAssignments: [realAssignment, emptyLegacySlot],
        assignedHelpers: [helper()],
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
        existingAssignments: [assignment({ id: 101 }), assignment({ id: 102, slot: 1, helperId: 12 })],
        assignedHelpers: [helper(), helper({ id: 12, name: "Robin Test" })],
      })
    ).toThrow("kleiner als bereits belegte Helferplätze");
  });

  it("lässt geänderte Verfügbarkeit der bestehenden Einteilung als sichtbaren Planhinweis zu", () => {
    expect(() =>
      validate({
        assignedHelpers: [helper({ availSat: "nein" })],
      })
    ).not.toThrow();
  });

  it("lässt eine Schichtzeit außerhalb eines gespeicherten Zeitfensters als Planhinweis zu", () => {
    expect(() =>
      validate({
        assignedHelpers: [
          helper({ availFriStart: "13:00", availFriEnd: "18:00" }),
        ],
      })
    ).not.toThrow();
  });

  it("belässt zeitliche Doppelbelegungen für die nachgelagerte Planevaluierung", () => {
    expect(() => validate()).not.toThrow();
  });
});
