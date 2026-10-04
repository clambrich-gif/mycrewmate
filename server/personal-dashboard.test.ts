import { describe, expect, it } from "vitest";
import { buildPersonalDashboard } from "./personal-dashboard";

describe("persönliche Dashboard-Auswertung", () => {
  const baseInput = {
    displayName: "Alex Beispiel",
    ownContactIds: new Set([7]),
    ownHelperIds: new Set([11]),
    activeDays: ["Freitag", "Samstag"] as const,
    prep: [
      {
        id: 1,
        contactId: 7,
        helperId: null,
        task: "Beschilderung abstimmen",
        category: "Strecke",
        dueText: "10.06.2027",
        locationId: 31,
        status: "offen" as const,
      },
      {
        id: 2,
        contactId: 99,
        helperId: 11,
        task: "Helferbrief prüfen",
        category: "Kommunikation",
        dueText: "12.06.2027",
        locationId: 31,
        status: "inArbeit" as const,
      },
      {
        id: 3,
        contactId: 99,
        helperId: null,
        task: "Aufgabe eines anderen Bereichs",
        category: "Extern",
        dueText: "",
        locationId: null,
        status: "offen" as const,
      },
    ],
    post: [
      {
        id: 4,
        contactId: 7,
        helperId: null,
        task: "Material zurückgeben",
        category: "Abbau",
        dueText: "",
        locationId: 42,
        status: "erledigt" as const,
      },
    ],
    materials: [
      {
        id: 5,
        contactId: 7,
        article: "Absperrband",
        category: "Sicherheit",
        quantity: "3",
        unit: "Rollen",
        locationId: 31,
        status: "geliefert" as const,
      },
      {
        id: 6,
        contactId: 99,
        article: "Fremdes Material",
        category: "",
        quantity: "",
        unit: "",
        locationId: null,
        status: "offen" as const,
      },
    ],
    marketing: [],
    approvals: [],
    assignments: [
      { shiftId: 20, helperId: 11 },
      { shiftId: 21, helperId: 45 },
    ],
    shifts: [
      {
        id: 20,
        day: "Samstag" as const,
        area: "Start/Ziel",
        task: "Startunterlagen ausgeben",
        startTime: "07:30",
        endTime: "10:30",
        locationId: 31,
        needed: 1,
      },
      {
        id: 21,
        day: "Freitag" as const,
        area: "Bühne",
        task: "Technik prüfen",
        startTime: "16:00",
        endTime: "18:00",
        locationId: null,
        needed: 2,
      },
    ],
    helpers: [
      {
        id: 11,
        name: "Alex Beispiel",
        contactId: 7,
        willHelp: "ja" as const,
        confirmed: "ja" as const,
        availFri: "ja" as const,
        availSat: "ja" as const,
      },
      {
        id: 12,
        name: "Berta Betreuung",
        contactId: 7,
        willHelp: "ja" as const,
        confirmed: "nein" as const,
        availFri: "vielleicht" as const,
        availSat: "vielleicht" as const,
      },
    ],
    shiftAreaContacts: [{ area: "Start/Ziel", contactId: 7 }],
    locations: [
      {
        id: 31,
        name: "Start/Ziel",
        latitude: 50.3,
        longitude: 7.2,
        logoUrl: null,
      },
      {
        id: 42,
        name: "Abbauplatz",
        latitude: 50.31,
        longitude: 7.21,
        logoUrl: null,
      },
    ],
  };

  it("wertet nur eigene Kontakt- oder Helferaufgaben aus", () => {
    const result = buildPersonalDashboard(baseInput);

    expect(result.identityLinked).toBe(true);
    expect(result.summary).toMatchObject({
      total: 4,
      completed: 2,
      open: 1,
      inProgress: 1,
      rejected: 0,
      progress: 50,
      allCompleted: false,
    });
    expect(result.nextTasks.map(task => task.title)).toEqual([
      "Beschilderung abstimmen",
      "Helferbrief prüfen",
    ]);
    expect(result.shifts).toEqual([
      expect.objectContaining({
        id: 20,
        helperId: 11,
        task: "Startunterlagen ausgeben",
      }),
    ]);
    expect(result.helpers).toMatchObject({
      total: 2,
      firstContactOpen: 1,
      feedbackOpen: 0,
      assignedShifts: 1,
    });
    expect(result.locations).toEqual([
      expect.objectContaining({
        id: 31,
        entries: expect.arrayContaining([
          expect.objectContaining({ label: "Vorbereitung: Beschilderung abstimmen" }),
          expect.objectContaining({ label: "Material: Absperrband" }),
        ]),
      }),
      expect.objectContaining({
        id: 42,
        entries: expect.arrayContaining([
          expect.objectContaining({ label: "Nachbereitung: Material zurückgeben" }),
        ]),
      }),
    ]);
  });

  it("setzt den persönlichen Bereich erst bei vollständig erledigten Aufgaben auf grün", () => {
    const result = buildPersonalDashboard({
      ...baseInput,
      prep: baseInput.prep.map(task =>
        task.id === 1 || task.id === 2 ? { ...task, status: "erledigt" as const } : task
      ),
    });

    expect(result.summary).toMatchObject({
      total: 4,
      completed: 4,
      progress: 100,
      allCompleted: true,
    });
    expect(result.nextTasks).toEqual([]);
  });

  it("behandelt eine abgelehnte Aufgabe nie als persönlichen Abschluss", () => {
    const result = buildPersonalDashboard({
      ...baseInput,
      prep: baseInput.prep.map(task =>
        task.id === 1 ? { ...task, status: "abgelehnt" as const } : task
      ),
    });

    expect(result.summary).toMatchObject({
      rejected: 1,
      allCompleted: false,
    });
    expect(result.nextTasks[0]).toMatchObject({
      title: "Beschilderung abstimmen",
      status: "rejected",
    });
  });
});
