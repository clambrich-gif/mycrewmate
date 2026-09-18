import { describe, expect, it } from "vitest";
import { helperDropdownAssignmentFeedback } from "../client/src/lib/helper-assignment-feedback";

const activeDays = ["Freitag", "Samstag", "Sonntag"] as const;

describe("helperDropdownAssignmentFeedback", () => {
  it("kennzeichnet komplett freie Helfer als Neu", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [],
        activeDays: [...activeDays],
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
        currentDay: "Samstag",
        hasTimeConflict: true,
      })
    ).toEqual({ kind: "already-assigned" });
  });

  it("zeigt für an anderen Tagen eingeteilte Helfer drei farbige Tagessegmente", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Freitag" }, { day: "Sonntag" }],
        activeDays: [...activeDays],
        currentDay: "Samstag",
        hasTimeConflict: false,
      })
    ).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Freitag", label: "Fr", state: "assigned" },
        { day: "Samstag", label: "Sa", state: "current" },
        { day: "Sonntag", label: "So", state: "assigned" },
      ],
    });
  });

  it("zeigt auch eine spätere Einteilung am aktuellen Tag gelb an", () => {
    expect(
      helperDropdownAssignmentFeedback({
        assignments: [{ day: "Freitag" }, { day: "Samstag" }],
        activeDays: [...activeDays],
        currentDay: "Samstag",
        hasTimeConflict: false,
      })
    ).toEqual({
      kind: "day-segments",
      segments: [
        { day: "Freitag", label: "Fr", state: "assigned" },
        { day: "Samstag", label: "Sa", state: "assigned" },
        { day: "Sonntag", label: "So", state: "neutral" },
      ],
    });
  });
});
