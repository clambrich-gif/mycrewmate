import type { Assignment, Helper, Shift } from "../drizzle/schema";
import {
  shiftRange as sharedShiftRange,
  shiftsOverlap,
} from "../shared/shift-time";
import {
  helperAvailableForShift,
  helperAvailableOnDay,
  WEEKDAYS,
  type Weekday,
} from "../shared/weekdays";

export { toMinutes } from "../shared/shift-time";

export const DAYS = WEEKDAYS;
export type Day = Weekday;

export function helperActiveOnDay(h: Helper, day: Day): boolean {
  return helperAvailableOnDay(h, day);
}

export function helperActiveForShift(h: Helper, shift: Shift): boolean {
  return helperAvailableForShift(h, shift);
}

export function shiftRange(s: Shift): [number, number] {
  return sharedShiftRange(s);
}

export function overlaps(a: Shift, b: Shift): boolean {
  return shiftsOverlap(a, b);
}

export type ShiftStatus = "OFFEN" | "KNAPP" | "OK";

export interface ShiftEval {
  shift: Shift;
  assigned: Assignment[];
  validHelpers: Helper[];
  ausfallHelpers: Helper[];
  doppelIds: Set<number>;
  besetzt: number;
  status: ShiftStatus;
  doppelCount: number;
  ausfallCount: number;
}

/**
 * Wertet einen vollständigen Einsatzplan aus.
 * Veraltete doppelte Datensätze (gleicher Slot oder Helfer in derselben Schicht)
 * werden dabei nur einmal gezählt. Datenbankregeln verhindern neue Duplikate.
 */
export function evaluateShifts(
  shifts: Shift[],
  assignments: Assignment[],
  helpers: Helper[]
): ShiftEval[] {
  const helperById = new Map(helpers.map(helper => [helper.id, helper]));
  const rawByShift = new Map<number, Assignment[]>();

  for (const assignment of assignments) {
    if (!rawByShift.has(assignment.shiftId))
      rawByShift.set(assignment.shiftId, []);
    rawByShift.get(assignment.shiftId)!.push(assignment);
  }

  const byShift = new Map<number, Assignment[]>();
  for (const shift of shifts) {
    const seenSlots = new Set<number>();
    const seenHelpers = new Set<number>();
    const canonical: Assignment[] = [];

    for (const assignment of (rawByShift.get(shift.id) ?? []).sort(
      (a, b) => a.id - b.id
    )) {
      if (
        seenSlots.has(assignment.slot) ||
        seenHelpers.has(assignment.helperId)
      )
        continue;
      seenSlots.add(assignment.slot);
      seenHelpers.add(assignment.helperId);
      canonical.push(assignment);
    }
    byShift.set(shift.id, canonical);
  }

  const activeShiftsByHelper = new Map<number, Shift[]>();
  for (const shift of shifts) {
    for (const assignment of byShift.get(shift.id) ?? []) {
      const helper = helperById.get(assignment.helperId);
      if (!helper || !helperActiveForShift(helper, shift)) continue;
      if (!activeShiftsByHelper.has(helper.id))
        activeShiftsByHelper.set(helper.id, []);
      activeShiftsByHelper.get(helper.id)!.push(shift);
    }
  }

  const conflictsByShift = new Map<number, Set<number>>();
  const addConflict = (shiftId: number, helperId: number) => {
    if (!conflictsByShift.has(shiftId))
      conflictsByShift.set(shiftId, new Set());
    conflictsByShift.get(shiftId)!.add(helperId);
  };

  activeShiftsByHelper.forEach((helperShifts, helperId) => {
    for (let i = 0; i < helperShifts.length; i++) {
      for (let j = i + 1; j < helperShifts.length; j++) {
        if (!overlaps(helperShifts[i], helperShifts[j])) continue;
        addConflict(helperShifts[i].id, helperId);
        addConflict(helperShifts[j].id, helperId);
      }
    }
  });

  return shifts.map(shift => {
    const assigned = byShift.get(shift.id) ?? [];
    const validHelpers: Helper[] = [];
    const ausfallHelpers: Helper[] = [];

    for (const assignment of assigned) {
      const helper = helperById.get(assignment.helperId);
      if (!helper) continue;
      if (helperActiveForShift(helper, shift))
        validHelpers.push(helper);
      else ausfallHelpers.push(helper);
    }

    const besetzt = validHelpers.length;
    const status: ShiftStatus =
      besetzt === 0 ? "OFFEN" : besetzt < shift.needed ? "KNAPP" : "OK";
    const doppelIds = conflictsByShift.get(shift.id) ?? new Set<number>();

    return {
      shift,
      assigned,
      validHelpers,
      ausfallHelpers,
      doppelIds,
      besetzt,
      status,
      doppelCount: validHelpers.filter(helper => doppelIds.has(helper.id))
        .length,
      ausfallCount: ausfallHelpers.length,
    };
  });
}
