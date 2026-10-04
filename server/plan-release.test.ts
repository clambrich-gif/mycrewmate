import { describe, expect, it } from "vitest";
import {
  isPlanInformationOutstanding,
  selectAffectedPlanContactIds,
  selectPlanReleaseContacts,
} from "./plan-release";

describe("selectPlanReleaseContacts", () => {
  it("wählt ausschließlich Ansprechpartner aus, deren zugeordnete Helfer im Einsatzplan eingeteilt sind", () => {
    const contacts = [
      { id: 1, name: "Anna Admin", email: "anna@example.com" },
      { id: 2, name: "Bernd Bereich", email: "bernd@example.com" },
      { id: 3, name: "Carla Chance", email: null },
    ];
    const helpers = [
      { id: 101, contactId: 1 },
      { id: 102, contactId: 2 },
      { id: 103, contactId: 3 },
    ];
    const assignments = [{ helperId: 101 }, { helperId: 103 }];

    const result = selectPlanReleaseContacts({ contacts, helpers, assignments });

    expect(result.map(contact => contact.name)).toEqual(["Anna Admin", "Carla Chance"]);
  });

  it("gibt eine leere Liste zurück, wenn noch keine Helfer eingeteilt sind", () => {
    const contacts = [{ id: 1, name: "Anna Admin", email: "anna@example.com" }];
    const helpers = [{ id: 101, contactId: 1 }];
    const assignments: Array<{ helperId: number }> = [];

    const result = selectPlanReleaseContacts({ contacts, helpers, assignments });

    expect(result).toEqual([]);
  });
});

describe("selectAffectedPlanContactIds", () => {
  it("filtert nur eindeutige Ansprechpartner-IDs der geänderten Helfer heraus", () => {
    const helpers = [
      { id: 10, contactId: 5 },
      { id: 11, contactId: 5 },
      { id: 12, contactId: 8 },
      { id: 13, contactId: null },
    ];

    const affected = selectAffectedPlanContactIds({
      helpers,
      affectedHelperIds: [10, 11, 13],
    });

    expect(affected).toEqual([5]);
  });
});

describe("isPlanInformationOutstanding", () => {
  it("meldet Information als offen, wenn die Helfer noch nie informiert wurden", () => {
    expect(
      isPlanInformationOutstanding({
        helpersInformedAt: null,
        changePendingAt: null,
      })
    ).toBe(true);
  });

  it("meldet Information als erledigt, wenn keine Änderung nach der Information vorliegt", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(
      isPlanInformationOutstanding({
        helpersInformedAt: now,
        changePendingAt: null,
      })
    ).toBe(false);
  });

  it("meldet Information als erneut offen, wenn nach der Information eine Planänderung erfolgte", () => {
    const informed = new Date("2026-10-04T10:00:00Z");
    const changed = new Date("2026-10-04T11:00:00Z");
    expect(
      isPlanInformationOutstanding({
        helpersInformedAt: informed,
        changePendingAt: changed,
      })
    ).toBe(true);
  });
});
