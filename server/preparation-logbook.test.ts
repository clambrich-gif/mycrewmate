import { describe, expect, it } from "vitest";
import {
  describeTaskLogbookChanges,
  latestPreparationLogbookEntry,
  parsePreparationLogbookEntries,
  preparationLogbookEntryCount,
  preparationLogbookNeedsDetail,
  prependPreparationLogbookEntry,
} from "../shared/preparation-logbook";

describe("Vorbereitungslogbuch", () => {
  it("setzt neue Einträge mit Datum, Uhrzeit ohne Sekunden und Autor an den Anfang", () => {
    const logbook = prependPreparationLogbookEntry(
      "Mit Herrn Schneider gesprochen",
      "16.09.2026: Unterlagen angefordert",
      new Date("2026-09-17T06:30:45Z"),
      "Christian Lambrich"
    );

    expect(logbook).toBe(
      "17.09.2026 08:30 Uhr (Christian Lambrich): Mit Herrn Schneider gesprochen\n16.09.2026: Unterlagen angefordert"
    );
    expect(latestPreparationLogbookEntry(logbook)).toBe(
      "17.09.2026 08:30 Uhr (Christian Lambrich): Mit Herrn Schneider gesprochen"
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
      new Date("2026-09-17T06:30:00Z"),
      "Organisation"
    );

    expect(latestPreparationLogbookEntry(logbook)).toBe(
      "17.09.2026 08:30 Uhr (Organisation): Telefonat geführt\nRückmeldung bis Freitag erwartet"
    );
    expect(preparationLogbookEntryCount(logbook)).toBe(1);
    expect(preparationLogbookNeedsDetail(logbook, 20)).toBe(true);
  });

  it("gliedert den Verlauf für Liste und Kachelansicht mit Zeit und Autor", () => {
    const logbook =
      "17.09.2026 08:30 Uhr (Christian Lambrich): Rückmeldung erfolgt am Freitag\n16.09.2026 16:45 Uhr (Planungsteam): Unterlagen angefordert";

    expect(parsePreparationLogbookEntries(logbook)).toEqual([
      expect.objectContaining({
        timestampLabel: "17.09.2026 · 08:30 Uhr",
        author: "Christian Lambrich",
        text: "Rückmeldung erfolgt am Freitag",
      }),
      expect.objectContaining({
        timestampLabel: "16.09.2026 · 16:45 Uhr",
        author: "Planungsteam",
        text: "Unterlagen angefordert",
      }),
    ]);
  });

  it("beschreibt Status- und Verantwortungsänderungen nachvollziehbar", () => {
    const entry = describeTaskLogbookChanges(
      "preparation",
      {
        task: "Platz buchen",
        category: "Organisation",
        dueText: "20.09.2026",
        locationId: 4,
        contactId: 7,
        status: "inArbeit",
        statusWording: "genehmigung",
      },
      {
        status: "erledigt",
        statusWording: "genehmigung",
        contactId: 8,
      },
      { contacts: new Map([[7, "Paolo Ferrara"], [8, "Herr Müller"]]) }
    );

    expect(entry).toBe(
      "Verantwortlicher geändert: Paolo Ferrara → Herr Müller · Status geändert: Beantragt → Genehmigt"
    );
  });
});
