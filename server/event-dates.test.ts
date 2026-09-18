import { describe, expect, it } from "vitest";
import {
  eventCountdownState,
  eventDateRangeError,
  formatEventDate,
  isIsoCalendarDate,
} from "../shared/event-dates";

describe("event-dates & countdown", () => {
  it("validiert ISO-Datumsangaben präzise", () => {
    expect(isIsoCalendarDate("2027-06-18")).toBe(true);
    expect(isIsoCalendarDate("2027-02-29")).toBe(false);
    expect(isIsoCalendarDate("2027/06/18")).toBe(false);
    expect(isIsoCalendarDate("")).toBe(false);
  });

  it("prüft paarweise Start- und Enddaten und Chronologie", () => {
    expect(eventDateRangeError({ startDate: null, endDate: null })).toBeNull();
    expect(
      eventDateRangeError({ startDate: "2027-06-18", endDate: null })
    ).toContain("gemeinsam");
    expect(
      eventDateRangeError({ startDate: "2027-06-20", endDate: "2027-06-18" })
    ).toContain("Enddatum darf nicht vor dem Startdatum liegen");
    expect(
      eventDateRangeError({ startDate: "2027-06-18", endDate: "2027-06-20" })
    ).toBeNull();
  });

  it("formatiert Datumsangaben im deutschen Format", () => {
    expect(formatEventDate("2027-06-18")).toBe("18.06.2027");
    expect(formatEventDate(null)).toBe("");
  });

  it("ermittelt verbleibende Tage und Stunden vor dem Eventstart", () => {
    const fixedNow = new Date("2027-05-07T06:00:00");
    const state = eventCountdownState(
      { startDate: "2027-06-18", endDate: "2027-06-20" },
      fixedNow
    );
    expect(state).toMatchObject({
      kind: "upcoming",
      days: 41,
      hours: 18,
    });
  });

  it("liefert für die visuelle 14-Tage-Schwelle einen präzisen Tageswert", () => {
    const state = eventCountdownState(
      { startDate: "2027-06-18", endDate: "2027-06-20" },
      new Date("2027-06-05T00:00:00")
    );
    expect(state).toEqual({ kind: "upcoming", days: 13, hours: 0 });
  });

  it("erkennt den laufenden Eventstatus mit aktuellem Eventtag", () => {
    const fixedNow = new Date("2027-06-19T14:30:00");
    const state = eventCountdownState(
      { startDate: "2027-06-18", endDate: "2027-06-20" },
      fixedNow
    );
    expect(state).toEqual({
      kind: "live",
      day: 2,
      totalDays: 3,
    });
  });

  it("erkennt ein abgeschlossenes Event nach Ablauf des Enddatums", () => {
    const fixedNow = new Date("2027-06-21T00:00:01");
    const state = eventCountdownState(
      { startDate: "2027-06-18", endDate: "2027-06-20" },
      fixedNow
    );
    expect(state).toEqual({ kind: "completed" });
  });

  it("bleibt unkonfiguriert wenn keine Daten hinterlegt sind", () => {
    expect(eventCountdownState({ startDate: null, endDate: null })).toEqual({
      kind: "unconfigured",
    });
  });
});
