import { describe, expect, it } from "vitest";
import {
  deadlineTimingLabel,
  deadlineTone,
  parsePreparationDeadline,
  upcomingPreparationDeadlines,
} from "./dashboard-deadlines";

describe("Dashboard-Fristen aus der Vorbereitung", () => {
  it("akzeptiert nur vollständige ISO- und deutsche Kalenderdaten", () => {
    expect(parsePreparationDeadline("2027-04-18")).toMatchObject({
      iso: "2027-04-18",
      display: "18.04.2027",
    });
    expect(parsePreparationDeadline("3.5.27")).toMatchObject({
      iso: "2027-05-03",
      display: "03.05.2027",
    });
    expect(parsePreparationDeadline("31.02.2027")).toBeNull();
    expect(parsePreparationDeadline("Ende März")).toBeNull();
    expect(parsePreparationDeadline("")).toBeNull();
  });

  it("zeigt nur offene, datierte Aufgaben in chronologischer Reihenfolge", () => {
    const deadlines = upcomingPreparationDeadlines(
      [
        {
          id: 1,
          task: "Erledigte Aufgabe",
          category: "Strecke",
          dueText: "18.04.2027",
          contactId: 1,
          status: "erledigt",
        },
        {
          id: 2,
          task: "Freitextfrist",
          category: "Marketing",
          dueText: "Ende März",
          contactId: null,
          status: "offen",
        },
        {
          id: 3,
          task: "Überfällige Genehmigung",
          category: "Genehmigung",
          dueText: "14.04.2027",
          contactId: 1,
          status: "abgelehnt",
        },
        {
          id: 4,
          task: "Sanitätsdienst bestätigen",
          category: "Sicherheit",
          dueText: "16.04.2027",
          contactId: 2,
          status: "inArbeit",
        },
        {
          id: 5,
          task: "Startnummern bestellen",
          category: "Material",
          dueText: "20.04.2027",
          contactId: null,
          status: "offen",
        },
      ],
      [
        { id: 1, name: "Paolo Ferrara" },
        { id: 2, name: "Christian Lambrich" },
      ],
      { now: new Date("2027-04-15T09:00:00.000Z"), limit: 3 }
    );

    expect(deadlines).toEqual([
      expect.objectContaining({
        taskId: 3,
        task: "Überfällige Genehmigung",
        dueText: "14.04.2027",
        daysUntil: -1,
        contactName: "Paolo Ferrara",
        status: "abgelehnt",
      }),
      expect.objectContaining({
        taskId: 4,
        task: "Sanitätsdienst bestätigen",
        dueText: "16.04.2027",
        daysUntil: 1,
        contactName: "Christian Lambrich",
      }),
      expect.objectContaining({
        taskId: 5,
        task: "Startnummern bestellen",
        dueText: "20.04.2027",
        daysUntil: 5,
        contactName: null,
      }),
    ]);
  });

  it("kennzeichnet überfällige, zeitnahe und spätere Fristen nachvollziehbar", () => {
    expect(deadlineTimingLabel(-2)).toBe("2 Tage überfällig");
    expect(deadlineTimingLabel(0)).toBe("Heute fällig");
    expect(deadlineTimingLabel(1)).toBe("Morgen fällig");
    expect(deadlineTimingLabel(15)).toBe("In 15 Tagen");
    expect(deadlineTone({ daysUntil: -1, status: "offen" })).toBe("red");
    expect(deadlineTone({ daysUntil: 8, status: "inArbeit" })).toBe("orange");
    expect(deadlineTone({ daysUntil: 15, status: "offen" })).toBe("blue");
    expect(deadlineTone({ daysUntil: 30, status: "abgelehnt" })).toBe("red");
  });
});
