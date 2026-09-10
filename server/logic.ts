import type { Helper, Shift, Assignment } from "../drizzle/schema";

export const DAYS = ["Freitag", "Samstag", "Sonntag"] as const;
export type Day = typeof DAYS[number];

export function helperActiveOnDay(h: Helper, day: Day): boolean {
  if (h.willHelp !== "ja") return false;
  if (day === "Freitag") return h.availFri === "ja";
  if (day === "Samstag") return h.availSat === "ja";
  return h.availSun === "ja";
}

/** Minuten seit Mitternacht; "ganztägig"/leer -> [0, 1439] */
export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function shiftRange(s: Shift): [number, number] {
  const st = toMinutes(s.startTime);
  const en = toMinutes(s.endTime);
  if (st == null || en == null) return [0, 1439]; // ganztägig
  return [st, en];
}

export function overlaps(a: Shift, b: Shift): boolean {
  if (a.day !== b.day) return false;
  const [s1, e1] = shiftRange(a);
  const [s2, e2] = shiftRange(b);
  return s1 < e2 && s2 < e1;
}

export type ShiftStatus = "OFFEN" | "KNAPP" | "OK";

export interface ShiftEval {
  shift: Shift;
  assigned: Assignment[];
  validHelpers: Helper[];      // eingeteilt & aktiv am Tag
  ausfallHelpers: Helper[];    // eingeteilt, aber abgesagt/nicht verfügbar
  doppelIds: Set<number>;      // helperIds mit Doppelbelegung
  besetzt: number;
  status: ShiftStatus;
  doppelCount: number;
  ausfallCount: number;
}

export function evaluateShifts(
  shifts: Shift[],
  assignments: Assignment[],
  helpers: Helper[],
): ShiftEval[] {
  const helperById = new Map(helpers.map(h => [h.id, h]));
  const byShift = new Map<number, Assignment[]>();
  for (const a of assignments) {
    if (!byShift.has(a.shiftId)) byShift.set(a.shiftId, []);
    byShift.get(a.shiftId)!.push(a);
  }

  // Doppelbelegung: helperId -> Liste seiner Schichten (nur aktive)
  const activeShiftsByHelper = new Map<number, Shift[]>();
  for (const s of shifts) {
    for (const a of byShift.get(s.id) ?? []) {
      const h = helperById.get(a.helperId);
      if (h && helperActiveOnDay(h, s.day as Day)) {
        if (!activeShiftsByHelper.has(h.id)) activeShiftsByHelper.set(h.id, []);
        activeShiftsByHelper.get(h.id)!.push(s);
      }
    }
  }
  const doppelIds = new Set<number>();
  activeShiftsByHelper.forEach((list, hid) => {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        if (overlaps(list[i], list[j])) { doppelIds.add(hid); break; }
  });

  return shifts.map(s => {
    const ass = byShift.get(s.id) ?? [];
    const valid: Helper[] = [];
    const ausfall: Helper[] = [];
    for (const a of ass) {
      const h = helperById.get(a.helperId);
      if (!h) continue;
      if (helperActiveOnDay(h, s.day as Day)) valid.push(h);
      else ausfall.push(h);
    }
    const besetzt = valid.length;
    const status: ShiftStatus = besetzt === 0 ? "OFFEN" : besetzt < s.needed ? "KNAPP" : "OK";
    return {
      shift: s, assigned: ass, validHelpers: valid, ausfallHelpers: ausfall,
      doppelIds, besetzt, status,
      doppelCount: valid.filter(h => doppelIds.has(h.id)).length,
      ausfallCount: ausfall.length,
    };
  });
}
