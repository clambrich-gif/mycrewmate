import type { Assignment, Helper, Shift } from "../drizzle/schema";

export const DAYS = ["Freitag", "Samstag", "Sonntag"] as const;
export type Day = (typeof DAYS)[number];

export function helperActiveOnDay(h: Helper, day: Day): boolean {
  if (h.willHelp !== "ja") return false;
  if (day === "Freitag") return h.availFri === "ja";
  if (day === "Samstag") return h.availSat === "ja";
  return h.availSun === "ja";
}

/** Minuten seit Mitternacht; ungültige oder leere Werte ergeben null. */
export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** Beide Zeitfelder leer bedeuten ganztägig. Ungültige Altdaten werden defensiv ganztägig behandelt. */
export function shiftRange(s: Shift): [number, number] {
  const start = toMinutes(s.startTime);
  const end = toMinutes(s.endTime);
  if (start == null || end == null || end <= start) return [0, 1440];
  return [start, end];
}

export function overlaps(a: Shift, b: Shift): boolean {
  if (a.day !== b.day) return false;
  const [startA, endA] = shiftRange(a);
  const [startB, endB] = shiftRange(b);
  return startA < endB && startB < endA;
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
      if (!helper || !helperActiveOnDay(helper, shift.day as Day)) continue;
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
      if (helperActiveOnDay(helper, shift.day as Day))
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
