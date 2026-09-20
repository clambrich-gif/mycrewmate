import { describe, expect, it } from "vitest";
import {
  helperDropdownAssignmentFeedback,
  helperDropdownPriority,
} from "../client/src/lib/helper-assignment-feedback";

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

  it("markiert bei zeitgleicher Belegung den aktiven Schichttag gelb", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Freitag" }],
        activeDays: [...activeDays],
        availabilityByDay: availableEveryDay,
        currentDay: "Samstag",
        hasTimeConflict: true,
      })
    ).toEqual({
      kind: "day-segments",
      hasTimeConflict: true,
      segments: [
        { day: "Freitag", label: "Fr", isCurrentDay: false, state: "assigned" },
        { day: "Samstag", label: "Sa", isCurrentDay: true, state: "conflict" },
        { day: "Sonntag", label: "So", isCurrentDay: false, state: "neutral" },
      ],
    });
  });

  it("ordnet Guidos Fr/Sa/So-Verfügbarkeit absolut zu – ohne relative Verschiebung", () => {
    expect(feedbackForGuido("Freitag")).toEqual({
      kind: "day-segments",
      hasTimeConflict: false,
      segments: [
        { day: "Freitag", label: "Fr", isCurrentDay: true, state: "current" },
        { day: "Samstag", label: "Sa", isCurrentDay: false, state: "neutral" },
        { day: "Sonntag", label: "So", isCurrentDay: false, state: "neutral" },
      ],
    });
    expect(feedbackForGuido("Samstag")).toEqual({
      kind: "day-segments",
      hasTimeConflict: false,
      segments: [
        { day: "Freitag", label: "Fr", isCurrentDay: false, state: "assigned" },
        { day: "Samstag", label: "Sa", isCurrentDay: true, state: "current" },
        { day: "Sonntag", label: "So", isCurrentDay: false, state: "neutral" },
      ],
    });
    expect(feedbackForGuido("Sonntag")).toEqual({
      kind: "day-segments",
      hasTimeConflict: false,
      segments: [
        { day: "Freitag", label: "Fr", isCurrentDay: false, state: "assigned" },
        { day: "Samstag", label: "Sa", isCurrentDay: false, state: "neutral" },
        { day: "Sonntag", label: "So", isCurrentDay: true, state: "current" },
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
      hasTimeConflict: false,
      segments: [
        { day: "Freitag", label: "Fr", isCurrentDay: false, state: "assigned" },
        { day: "Samstag", label: "Sa", isCurrentDay: false, state: "unavailable" },
        { day: "Sonntag", label: "So", isCurrentDay: true, state: "current" },
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
      hasTimeConflict: false,
      segments: [
        { day: "Samstag", label: "Sa", isCurrentDay: false, state: "assigned" },
        { day: "Sonntag", label: "So", isCurrentDay: true, state: "current" },
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
        hasTimeConflict: false,
        segments: [
          { day: "Freitag", label: "Fr", isCurrentDay: false, state: "assigned" },
          { day: "Samstag", label: "Sa", isCurrentDay: false, state: "neutral" },
          { day: "Sonntag", label: "So", isCurrentDay: true, state: "current" },
        ],
      });
    }
  });

  it("priorisiert Neue Helfer vor freien und zeitgleich belegten Helfern", () => {
    const fresh = helperDropdownAssignmentFeedback({
      assignments: [],
      activeDays: [...activeDays],
      availabilityByDay: availableEveryDay,
      currentDay: "Freitag",
      hasTimeConflict: false,
    });
    const available = feedbackForGuido("Samstag");
    const conflicting = helperDropdownAssignmentFeedback({
      assignments: [{ day: "Freitag" }],
      activeDays: [...activeDays],
      availabilityByDay: availableEveryDay,
      currentDay: "Samstag",
      hasTimeConflict: true,
    });

    expect(helperDropdownPriority(fresh)).toBe(0);
    expect(helperDropdownPriority(available)).toBe(1);
    expect(helperDropdownPriority(conflicting)).toBe(2);
  });
});
