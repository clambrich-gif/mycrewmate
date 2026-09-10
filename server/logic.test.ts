import { describe, expect, it } from "vitest";
import { evaluateShifts, helperActiveOnDay, overlaps } from "./logic";
import type { Helper, Shift, Assignment } from "../drizzle/schema";

const H = (id: number, willHelp: any = "ja", fri: any = "ja", sat: any = "ja", sun: any = "ja"): Helper =>
  ({ id, name: `H${id}`, contactId: null, email: null, phone: null, willHelp, availFri: fri, availSat: sat, availSun: sun, confirmed: "nein", createdAt: new Date() } as Helper);
const S = (id: number, day: any, st = "10:00", en = "12:00", needed = 1): Shift =>
  ({ id, day, area: "A", task: `T${id}`, startTime: st, endTime: en, needed, note: null, sortOrder: 0, createdAt: new Date() } as Shift);
const A = (shiftId: number, helperId: number, slot = 0): Assignment =>
  ({ id: shiftId * 100 + slot, shiftId, helperId, slot, createdAt: new Date() } as Assignment);

describe("helperActiveOnDay", () => {
  it("aktiv nur wenn willHelp=ja und Tag=ja", () => {
    expect(helperActiveOnDay(H(1), "Freitag")).toBe(true);
    expect(helperActiveOnDay(H(2, "nein"), "Freitag")).toBe(false);
    expect(helperActiveOnDay(H(3, "ja", "nein"), "Freitag")).toBe(false);
    expect(helperActiveOnDay(H(4, "ja", "vielleicht"), "Freitag")).toBe(false);
  });
});

describe("overlaps", () => {
  it("erkennt Überlappung am selben Tag", () => {
    expect(overlaps(S(1, "Freitag", "10:00", "12:00"), S(2, "Freitag", "11:00", "13:00"))).toBe(true);
    expect(overlaps(S(1, "Freitag", "10:00", "12:00"), S(2, "Freitag", "12:00", "13:00"))).toBe(false);
    expect(overlaps(S(1, "Freitag"), S(2, "Samstag"))).toBe(false);
  });
  it("ganztägig überlappt mit allem am selben Tag", () => {
    expect(overlaps(S(1, "Freitag", "", ""), S(2, "Freitag", "10:00", "11:00"))).toBe(true);
  });
});

describe("evaluateShifts", () => {
  it("Absage -> Ausfall, zählt nicht bei Besetzt", () => {
    const shifts = [S(1, "Freitag", "10:00", "12:00", 2)];
    const helpers = [H(1), H(2, "nein")];
    const ev = evaluateShifts(shifts, [A(1, 1, 0), A(1, 2, 1)], helpers);
    expect(ev[0].besetzt).toBe(1);
    expect(ev[0].ausfallCount).toBe(1);
    expect(ev[0].status).toBe("KNAPP");
  });
  it("Doppelbelegung wird erkannt", () => {
    const shifts = [S(1, "Freitag", "10:00", "12:00", 1), S(2, "Freitag", "11:00", "13:00", 1)];
    const helpers = [H(1)];
    const ev = evaluateShifts(shifts, [A(1, 1, 0), A(2, 1, 0)], helpers);
    expect(ev[0].doppelCount).toBe(1);
    expect(ev[1].doppelCount).toBe(1);
  });
  it("Ausfall hat Vorrang (zählt nicht als Doppel)", () => {
    const shifts = [S(1, "Freitag", "10:00", "12:00", 1), S(2, "Freitag", "11:00", "13:00", 1)];
    const helpers = [H(1, "nein")];
    const ev = evaluateShifts(shifts, [A(1, 1, 0), A(2, 1, 0)], helpers);
    expect(ev[0].ausfallCount).toBe(1);
    expect(ev[0].doppelCount).toBe(0);
  });
});

