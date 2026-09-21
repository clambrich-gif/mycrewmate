import { describe, expect, it } from "vitest";
import {
  deriveOwnAssignedHelperIds,
  matchesMyScheduleAssignment,
} from "../client/src/lib/plan-my-tasks";

describe("Meine Aufgaben im Einsatzplan", () => {
  it("zählt einen Helfer nicht wegen seiner Ansprechpartner-Verknüpfung als eigene Zuweisung", () => {
    const ownHelperIds = deriveOwnAssignedHelperIds(
      [
        { id: 11, name: "Max Mustermann" },
        { id: 12, name: "Anne Veling" },
      ],
      "Anne Veling"
    );

    expect(ownHelperIds).toEqual(new Set([12]));
    expect(
      matchesMyScheduleAssignment({
        area: "Start",
        areaContactMap: new Map([["Start", 99]]),
        ownContactIds: new Set([7]),
        assigned: [{ helperId: 11 }],
        ownHelperIds,
      })
    ).toBe(false);
  });

  it("matcht ausschließlich eine echte Bereichsverantwortung oder direkte Helferzuweisung", () => {
    const ownHelperIds = deriveOwnAssignedHelperIds(
      [{ id: 12, name: "Anne Veling" }],
      " Anne   Veling "
    );

    expect(
      matchesMyScheduleAssignment({
        area: "Anmeldung",
        areaContactMap: new Map([["Anmeldung", 7]]),
        ownContactIds: new Set([7]),
        assigned: [],
        ownHelperIds,
      })
    ).toBe(true);
    expect(
      matchesMyScheduleAssignment({
        area: "Strecke Nord",
        areaContactMap: new Map([["Strecke Nord", 99]]),
        ownContactIds: new Set([7]),
        assigned: [{ helperId: 12 }],
        ownHelperIds,
      })
    ).toBe(true);
  });

  it("bleibt bei fremden Kontakten und Helfern strikt ausgeschlossen", () => {
    expect(
      matchesMyScheduleAssignment({
        area: "Ziel",
        areaContactMap: new Map([["Ziel", 42]]),
        ownContactIds: new Set([7]),
        assigned: [{ helperId: 13 }],
        ownHelperIds: new Set([12]),
      })
    ).toBe(false);
  });
});
