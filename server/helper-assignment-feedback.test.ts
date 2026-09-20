import { describe, expect, it } from "vitest";
import { helperDropdownAssignmentFeedback } from "../client/src/lib/helper-assignment-feedback";

const activeDays = ["Freitag", "Samstag", "Sonntag"] as const;
const availableEveryDay = activeDays.map(day => ({ day, available: true }));

function feedbackForGuido(currentDay: (typeof activeDays)[number]) {
  return helperDropdownAssignmentFeedback({
    // Guido hat bereits einen Freitagseinsatz, ist aber Fr/Sa/So verfügbar.
    assignments: [{ day: "Freitag" }],
    activeDays: [...activeDays],
    availabilityByDay: availableEveryDay,
    currentDay,
    hasTimeConflict: false,
  });
}

describe("helperDropdownAssignmentFeedback", () => {
  it("kennzeichnet komplett freie Helfer als Neu", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [],
        activeDays: [...activeDays],
        availabilityByDay: availableEveryDay,
        currentDay: "Samstag",
        hasTimeConflict: false,
      })
    ).toEqual({ kind: "new" });
  });

  it("behandelt nicht aktive historische Tage nicht als Eventbelegung", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Montag" }],
        activeDays: [...activeDays],
        availabilityByDay: availableEveryDay,
        currentDay: "Samstag",
        hasTimeConflict: false,
      })
    ).toEqual({ kind: "new" });
  });

  it("gibt einer zeitgleichen Belegung immer Vorrang", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Freitag" }],
        activeDays: [...activeDays],
        availabilityByDay: availableEveryDay,
        currentDay: "Samstag",
        hasTimeConflict: true,
      })
    ).toEqual({ kind: "already-assigned" });
  });

  it("ordnet Guidos Fr/Sa/So-Verfügbarkeit absolut zu – ohne relative Verschiebung", () => {
    expect(feedbackForGuido("Freitag")).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Freitag", label: "Fr", state: "assigned" },
        { day: "Samstag", label: "Sa", state: "neutral" },
        { day: "Sonntag", label: "So", state: "neutral" },
      ],
    });
    expect(feedbackForGuido("Samstag")).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Freitag", label: "Fr", state: "assigned" },
        { day: "Samstag", label: "Sa", state: "current" },
        { day: "Sonntag", label: "So", state: "neutral" },
      ],
    });
    expect(feedbackForGuido("Sonntag")).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Freitag", label: "Fr", state: "assigned" },
        { day: "Samstag", label: "Sa", state: "neutral" },
        { day: "Sonntag", label: "So", state: "current" },
      ],
    });
  });

  it("markiert nur den tatsächlich nicht verfügbaren Helfertag grau und durchgestrichen", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Freitag" }],
        activeDays: [...activeDays],
        availabilityByDay: [
          { day: "Freitag", available: true },
          { day: "Samstag", available: false },
          { day: "Sonntag", available: true },
        ],
        currentDay: "Sonntag",
        hasTimeConflict: false,
      })
    ).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Freitag", label: "Fr", state: "assigned" },
        { day: "Samstag", label: "Sa", state: "unavailable" },
        { day: "Sonntag", label: "So", state: "current" },
      ],
    });
  });

  it("richtet die Segmentzahl dynamisch nach einem zweitägigen Event aus", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Samstag" }],
        activeDays: ["Samstag", "Sonntag"],
        availabilityByDay: [
          { day: "Samstag", available: true },
          { day: "Sonntag", available: true },
        ],
        currentDay: "Sonntag",
        hasTimeConflict: false,
      })
    ).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Samstag", label: "Sa", state: "assigned" },
        { day: "Sonntag", label: "So", state: "current" },
      ],
    });
  });

  it("markiert einen verfügbaren Sonntag unabhängig von Kurzform, Englisch oder Eventindex nie als nicht verfügbar", () => {
    for (const currentDay of ["So", "Sunday", 2] as const) {
      expect(
        helperDropdownAssignmentFeedback({
          assignments: [{ day: "Fr" }],
          activeDays: ["Fr", "Sa", "So"] as any,
          availabilityByDay: [
            { day: "Freitag", available: true },
            { day: "Samstag", available: true },
            { day: "Sonntag", available: true },
          ],
          currentDay,
          hasTimeConflict: false,
        })
      ).toEqual({
        kind: "day-segments",
        segments: [
          { day: "Freitag", label: "Fr", state: "assigned" },
          { day: "Samstag", label: "Sa", state: "neutral" },
          { day: "Sonntag", label: "So", state: "current" },
        ],
      });
    }
  });
});
