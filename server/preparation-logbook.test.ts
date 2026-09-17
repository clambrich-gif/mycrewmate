import { describe, expect, it } from "vitest";
import {
  latestPreparationLogbookEntry,
  preparationLogbookEntryCount,
  preparationLogbookNeedsDetail,
  prependPreparationLogbookEntry,
} from "../shared/preparation-logbook";

describe("Vorbereitungslogbuch", () => {
  it("setzt neue Einträge mit Datum an den Anfang eines vorhandenen Verlaufs", () => {
    const logbook = prependPreparationLogbookEntry(
      "Mit Herrn Schneider gesprochen",
      "16.09.2026: Unterlagen angefordert",
      new Date("2026-09-17T09:30:00Z")
    );

    expect(logbook).toBe(
      "17.09.2026: Mit Herrn Schneider gesprochen\n16.09.2026: Unterlagen angefordert"
    );
    expect(latestPreparationLogbookEntry(logbook)).toBe(
      "17.09.2026: Mit Herrn Schneider gesprochen"
    );
    expect(preparationLogbookEntryCount(logbook)).toBe(2);
    expect(preparationLogbookNeedsDetail(logbook)).toBe(true);
  });

  it("behält den Verlauf unverändert, wenn beim Bearbeiten kein neuer Eintrag erfolgt", () => {
    const existing = "16.09.2026: Unterlagen angefordert";
    expect(prependPreparationLogbookEntry("   ", existing)).toBe(existing);
  });

  it("unterstützt mehrzeilige Einträge und blendet Details bei langen Vorschauen ein", () => {
    const logbook = prependPreparationLogbookEntry(
      "Telefonat geführt\nRückmeldung bis Freitag erwartet",
      null,
      new Date("2026-09-17T09:30:00Z")
    );

    expect(latestPreparationLogbookEntry(logbook)).toBe(
      "17.09.2026: Telefonat geführt\nRückmeldung bis Freitag erwartet"
    );
    expect(preparationLogbookEntryCount(logbook)).toBe(1);
    expect(preparationLogbookNeedsDetail(logbook, 20)).toBe(true);
  });
});
