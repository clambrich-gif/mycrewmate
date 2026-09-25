import { describe, expect, it } from "vitest";
import {
  eventStartSelectionSessionKey,
  nearestUpcomingEvent,
} from "../shared/event-start-selection";

describe("Startauswahl der nächsten Veranstaltung", () => {
  const events = [
    {
      id: 11,
      year: 2026,
      name: "Sommerfest",
      startDate: "2026-06-13",
    },
    {
      id: 12,
      year: 2026,
      name: "Weihnachtsfeier",
      startDate: "2026-12-11",
    },
    {
      id: 13,
      year: 2027,
      name: "Radsportfestival",
      startDate: "2027-06-18",
    },
    {
      id: 15,
      year: 2027,
      name: "Altimport mit falschem Jahr",
      startDate: "2026-10-20",
    },
    {
      id: 14,
      year: 2028,
      name: "Ohne Termin",
      startDate: null,
    },
  ];

  it("wählt über alle Jahre die zeitlich nächste zukünftige Veranstaltung", () => {
    expect(
      nearestUpcomingEvent(events, new Date("2026-09-25T10:00:00"))
    ).toMatchObject({
      id: 12,
      year: 2026,
      name: "Weihnachtsfeier",
    });
  });

  it("berücksichtigt den heutigen Starttag, ignoriert vergangene und undatierte Einträge", () => {
    expect(
      nearestUpcomingEvent(events, new Date("2026-12-11T15:30:00"))
    ).toMatchObject({ id: 12 });
    expect(
      nearestUpcomingEvent(events, new Date("2027-07-01T10:00:00"))
    ).toBeNull();
  });

  it("ignoriert ein Startdatum, das nicht zum Veranstaltungsjahr gehört", () => {
    expect(
      nearestUpcomingEvent(events, new Date("2026-09-25T10:00:00"))
    ).toMatchObject({ id: 12, year: 2026 });
  });

  it("ordnet gleich datierte Einträge stabil nach Namen und ID", () => {
    expect(
      nearestUpcomingEvent(
        [
          { id: 21, year: 2027, name: "Zweiter Lauf", startDate: "2027-06-18" },
          { id: 20, year: 2027, name: "Erster Lauf", startDate: "2027-06-18" },
        ],
        new Date("2027-01-01T10:00:00")
      )
    ).toMatchObject({ id: 20 });
  });

  it("verwendet eine mandantenspezifische Sitzungsmarkierung", () => {
    expect(eventStartSelectionSessionKey("rsc-eifelland-mayen")).toBe(
      "mycrewmate:event-start-selection:rsc-eifelland-mayen"
    );
  });
});
