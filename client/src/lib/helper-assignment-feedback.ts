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
  | { kind: "new" }
  | {
      kind: "day-segments";
      hasTimeConflict: boolean;
      segments: Array<{
        day: Weekday;
        label: string;
        isCurrentDay: boolean;
        state: "current" | "conflict" | "assigned" | "neutral" | "unavailable";
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
  availabilityByDay: Array<{
    day: Weekday;
    available: boolean;
    availability?: "ja" | "nein" | "vielleicht";
  }>;
  currentDay: Weekday | string | number;
  hasTimeConflict: boolean;
}): HelperDropdownFeedback {
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
  const availability = new Map<
    Weekday,
    { available: boolean; availability?: "ja" | "nein" | "vielleicht" }
  >(
    availabilityByDay
      .filter(item => eventDays.includes(item.day))
      .map(item => [item.day, item])
  );
  const selectedDay = normalizeEventWeekday(currentDay, eventDays);

  const isExplicitlyUnavailable = (day: Weekday) => {
    const dayAvailability = availability.get(day);
    // Ältere Aufrufer ohne expliziten Status bleiben kompatibel: Ein
    // nicht-verfügbarer Tag gilt dort weiterhin als klare Abwesenheit.
    return (
      dayAvailability?.availability === "nein" ||
      (dayAvailability?.availability === undefined && !dayAvailability?.available)
    );
  };

  return {
    kind: "day-segments",
    hasTimeConflict,
    segments: eventDays.map(day => ({
      day,
      label: WEEKDAY_SHORT_LABELS[day],
      isCurrentDay: day === selectedDay,
      // Der aktive Schichttag richtet sich nach dem realen Zeitfenster:
      // ohne Überschneidung grün, bei echter Doppelbelegung gelb. Bereits
      // vorhandene Schichten an anderen Eventtagen bleiben nur Kontext.
      state:
        day === selectedDay
          ? hasTimeConflict
            ? "conflict"
            : isExplicitlyUnavailable(day)
              ? "unavailable"
              : "current"
          : assignedDays.has(day)
            ? "assigned"
            : isExplicitlyUnavailable(day)
              ? "unavailable"
              : "neutral",
    })),
  };
}

/** Sortierung: neue Helfer, verfügbare Helfer, zeitlich bereits Belegte. */
export function helperDropdownPriority(feedback: HelperDropdownFeedback) {
  if (!feedback || feedback.kind === "new") return 0;
  return feedback.hasTimeConflict ? 2 : 1;
}
