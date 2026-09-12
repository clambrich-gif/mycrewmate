export type ShiftTimeLike = {
  day: string;
  startTime?: string | null;
  endTime?: string | null;
};

/** Minuten seit Mitternacht; ungültige oder leere Werte ergeben null. */
export function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** Beide Zeitfelder leer bedeuten ganztägig. Ungültige Altdaten werden defensiv ganztägig behandelt. */
export function shiftRange(shift: ShiftTimeLike): [number, number] {
  const start = toMinutes(shift.startTime);
  const end = toMinutes(shift.endTime);
  if (start == null || end == null || end <= start) return [0, 1440];
  return [start, end];
}

export function shiftsOverlap(a: ShiftTimeLike, b: ShiftTimeLike): boolean {
  if (a.day !== b.day) return false;
  const [startA, endA] = shiftRange(a);
  const [startB, endB] = shiftRange(b);
  return startA < endB && startB < endA;
}
