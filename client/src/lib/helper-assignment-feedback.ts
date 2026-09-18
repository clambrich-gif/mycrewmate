import { WEEKDAY_SHORT_LABELS, type Weekday } from "@shared/weekdays";

export type HelperAssignmentDay = {
  day: string;
  label?: string;
  time?: string;
};

export type HelperDropdownFeedback =
  | { kind: "already-assigned" }
  | { kind: "new" }
  | {
      kind: "day-segments";
      segments: Array<{
        day: Weekday;
        label: string;
        state: "current" | "assigned" | "neutral";
      }>;
    }
  | null;

/**
 * Erstellt die kompakte Rückmeldung für eine auswählbare Helferperson.
 * Die Konfliktmarkierung hat bewusst Vorrang: Eine zeitgleiche Belegung
 * muss immer deutlicher erkennbar sein als ihre sonstige Eventauslastung.
 */
export function helperDropdownAssignmentFeedback({
  assignments,
  activeDays,
  currentDay,
  hasTimeConflict,
}: {
  assignments: HelperAssignmentDay[];
  activeDays: Weekday[];
  currentDay: Weekday;
  hasTimeConflict: boolean;
}): HelperDropdownFeedback {
  if (hasTimeConflict) return { kind: "already-assigned" };
  if (assignments.length === 0) return { kind: "new" };

  const assignedDays = new Set<Weekday>(
    assignments.flatMap(assignment => {
      const day = assignment.day as Weekday;
      return activeDays.includes(day) ? [day] : [];
    })
  );
  if (assignedDays.size === 0) return { kind: "new" };

  return {
    kind: "day-segments",
    segments: activeDays.map(day => ({
      day,
      label: WEEKDAY_SHORT_LABELS[day],
      // Jeder schon belegte Festivaltag bleibt sichtbar gelb – auch dann,
      // wenn seine Schicht zeitlich nicht mit dem gerade offenen Slot kollidiert.
      // Nur ein wirklich noch unbelegter aktueller Tag wird grün gezeigt.
      state: assignedDays.has(day)
        ? "assigned"
        : day === currentDay
          ? "current"
          : "neutral",
    })),
  };
}
