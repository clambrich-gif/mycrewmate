import {
  normalizeEventWeekday,
  orderedWeekdays,
  WEEKDAY_SHORT_LABELS,
  type Weekday,
} from "@shared/weekdays";

export type HelperAssignmentDay = {
  day: string | number;
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
        state: "current" | "assigned" | "neutral" | "unavailable";
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
  availabilityByDay,
  currentDay,
  hasTimeConflict,
}: {
  assignments: HelperAssignmentDay[];
  activeDays: Weekday[];
  availabilityByDay: Array<{ day: Weekday; available: boolean }>;
  currentDay: Weekday | string | number;
  hasTimeConflict: boolean;
}): HelperDropdownFeedback {
  if (hasTimeConflict) return { kind: "already-assigned" };
  if (assignments.length === 0) return { kind: "new" };

  // Die Position des Segments ergibt sich ausschließlich aus dem jeweiligen
  // Eventtag. Weder der Tag der geöffneten Schicht noch die Reihenfolge einer
  // Zuweisung darf die Zuordnung Fr/Sa/So verschieben.
  const eventDays = orderedWeekdays(activeDays);
  const assignedDays = new Set<Weekday>(
    assignments.flatMap(assignment => {
      const day = normalizeEventWeekday(assignment.day, eventDays);
      return day && eventDays.includes(day) ? [day] : [];
    })
  );
  if (assignedDays.size === 0) return { kind: "new" };
  const availableDays = new Map<Weekday, boolean>(
    availabilityByDay
      .filter(item => eventDays.includes(item.day))
      .map(item => [item.day, item.available])
  );
  const selectedDay = normalizeEventWeekday(currentDay, eventDays);

  return {
    kind: "day-segments",
    segments: eventDays.map(day => ({
      day,
      label: WEEKDAY_SHORT_LABELS[day],
      // Eine bestehende Schicht bleibt immer gelb sichtbar. Für alle anderen
      // Tage stammt die Farbe absolut aus dem passenden Helfer-Stammfeld.
      state: assignedDays.has(day)
        ? "assigned"
        : !availableDays.get(day)
          ? "unavailable"
          : day === selectedDay
            ? "current"
            : "neutral",
    })),
  };
}
