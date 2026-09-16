import type { Assignment, Helper, Shift } from "../drizzle/schema";
import { overlaps } from "./logic";
import { helperAvailableOnDay } from "../shared/weekdays";

export class ShiftUpdateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiftUpdateValidationError";
  }
}

type ShiftAssignmentValidationInput = {
  proposedShift: Shift;
  existingAssignments: Assignment[];
  assignedHelpers: Helper[];
  relatedAssignments: Assignment[];
  relatedShifts: Shift[];
};

/**
 * Leere Auswahlfelder im Einsatzplan haben normalerweise keine Datenbankzeile.
 * Ältere Importe können jedoch noch Slot-Zeilen ohne Helferreferenz enthalten.
 * Diese sind kein belegter Helferplatz und dürfen eine Bedarfssenkung nicht sperren.
 */
export function hasAssignedHelper(assignment: Assignment) {
  return (
    typeof (assignment as { helperId?: unknown }).helperId === "number" &&
    Number.isInteger(assignment.helperId) &&
    assignment.helperId > 0
  );
}

export function splitShiftAssignmentsByHelper(assignments: Assignment[]) {
  const assigned: Assignment[] = [];
  const unassigned: Assignment[] = [];
  for (const assignment of assignments) {
    if (hasAssignedHelper(assignment)) assigned.push(assignment);
    else unassigned.push(assignment);
  }
  return { assigned, unassigned };
}

export function unassignedAssignmentIdsOutsideNeeded(
  assignments: Assignment[],
  needed: number
) {
  return splitShiftAssignmentsByHelper(assignments).unassigned
    .filter(assignment => assignment.slot >= needed)
    .map(assignment => assignment.id);
}

/**
 * Prüft vor einer Schichtänderung alle bereits vorhandenen Helferzuweisungen
 * gegen den neuen Stand. Die aufrufende Datenbankfunktion sperrt sämtliche
 * übergebenen Zeilen transaktional, bevor diese rein fachliche Prüfung erfolgt.
 */
export function validateExistingAssignmentsForShiftUpdate({
  proposedShift,
  existingAssignments,
  assignedHelpers,
  relatedAssignments,
  relatedShifts,
}: ShiftAssignmentValidationInput) {
  const helperById = new Map(assignedHelpers.map(helper => [helper.id, helper]));
  const shiftById = new Map(relatedShifts.map(shift => [shift.id, shift]));
  const occupiedSlots = new Set<number>();
  const assignedHelperIds = new Set<number>();
  const { assigned: assignmentsWithHelpers } =
    splitShiftAssignmentsByHelper(existingAssignments);

  for (const assignment of assignmentsWithHelpers) {
    if (occupiedSlots.has(assignment.slot)) {
      throw new ShiftUpdateValidationError(
        "Die Schicht enthält doppelt belegte Helferplätze und kann nicht sicher geändert werden"
      );
    }
    if (assignedHelperIds.has(assignment.helperId)) {
      throw new ShiftUpdateValidationError(
        "Die Schicht enthält einen Helfer mehrfach und kann nicht sicher geändert werden"
      );
    }
    occupiedSlots.add(assignment.slot);
    assignedHelperIds.add(assignment.helperId);

    if (assignment.slot < 0 || assignment.slot >= proposedShift.needed) {
      throw new ShiftUpdateValidationError(
        "Der neue Helferbedarf wäre kleiner als bereits belegte Helferplätze"
      );
    }

    const helper = helperById.get(assignment.helperId);
    if (!helper) {
      throw new ShiftUpdateValidationError(
        "Eine bestehende Helferzuweisung gehört nicht zur aktuellen Veranstaltung"
      );
    }
    if (!helperAvailableOnDay(helper, proposedShift.day)) {
      throw new ShiftUpdateValidationError(
        `Der Helfer „${helper.name}“ ist am ${proposedShift.day} nicht verfügbar`
      );
    }

    for (const relatedAssignment of relatedAssignments) {
      if (
        !hasAssignedHelper(relatedAssignment) ||
        relatedAssignment.helperId !== assignment.helperId ||
        relatedAssignment.shiftId === proposedShift.id
      ) {
        continue;
      }
      const relatedShift = shiftById.get(relatedAssignment.shiftId);
      if (!relatedShift) {
        throw new ShiftUpdateValidationError(
          "Eine bestehende Helferzuweisung verweist nicht auf eine Schicht der aktuellen Veranstaltung"
        );
      }
      if (overlaps(proposedShift, relatedShift)) {
        throw new ShiftUpdateValidationError(
          `Die neue Schichtzeit überschneidet sich für „${helper.name}“ mit „${relatedShift.area} – ${relatedShift.task}“`
        );
      }
    }
  }
}
