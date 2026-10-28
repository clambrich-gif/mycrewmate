import { describe, expect, it } from "vitest";
import {
  deriveOwnDirectHelperIds,
  matchesMyDirectTaskAssignment,
} from "../client/src/lib/personal-task-filter";

describe("Persönliche Vor- und Nachbereitungsaufgaben", () => {
  const helpers = [
    { id: 11, name: "Peter Darscheid", contactId: 7 },
    { id: 12, name: "Aaron de la Haye", contactId: 7 },
    { id: 13, name: "Christian Lambrich", contactId: 7 },
  ];

  it("zählt betreute Helfer nicht als eigene direkte Helferzuweisung", () => {
    expect(deriveOwnDirectHelperIds(helpers, "Christian Lambrich")).toEqual(
      new Set([13])
    );
  });

  it("zeigt nur eigene Verantwortung oder eine direkte persönliche Helferzuweisung", () => {
    const ownContactIds = new Set([7]);
    const ownHelperIds = deriveOwnDirectHelperIds(
      helpers,
      "Christian Lambrich"
    );

    expect(
      matchesMyDirectTaskAssignment({
        task: { contactId: 99, helperIds: [11, 12] },
        ownContactIds,
        ownHelperIds,
      })
    ).toBe(false);

    expect(
      matchesMyDirectTaskAssignment({
        task: { contactId: 7, helperIds: [11] },
        ownContactIds,
        ownHelperIds,
      })
    ).toBe(true);

    expect(
      matchesMyDirectTaskAssignment({
        task: { contactId: 99, helperIds: [13] },
        ownContactIds,
        ownHelperIds,
      })
    ).toBe(true);
  });
});
