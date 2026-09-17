import { describe, expect, it } from "vitest";
import { isHelperWithoutFirstContact } from "../shared/weekdays";

describe("Erstkontaktstatus", () => {
  const freshHelper = {
    willHelp: "ja" as const,
    confirmed: "nein" as const,
    availMon: "vielleicht" as const,
    availTue: "vielleicht" as const,
    availWed: "vielleicht" as const,
    availThu: "vielleicht" as const,
    availFri: "vielleicht" as const,
    availSat: "vielleicht" as const,
    availSun: "vielleicht" as const,
  };

  it("erkennt neue Helfer an den unveränderten Fragezeichen der aktiven Festivaltage", () => {
    expect(
      isHelperWithoutFirstContact(freshHelper, ["Freitag", "Samstag", "Sonntag"])
    ).toBe(true);
  });

  it("wertet eine Änderung an einem aktiven Festivaltag als erfolgten Erstkontakt", () => {
    expect(
      isHelperWithoutFirstContact(
        { ...freshHelper, availSat: "ja" },
        ["Freitag", "Samstag", "Sonntag"]
      )
    ).toBe(false);
  });

  it("ignoriert nicht aktive Tage und erkennt auch Hilfs- oder Bestätigungsänderungen", () => {
    expect(
      isHelperWithoutFirstContact(
        { ...freshHelper, availMon: "ja" },
        ["Freitag", "Samstag", "Sonntag"]
      )
    ).toBe(true);
    expect(
      isHelperWithoutFirstContact(
        { ...freshHelper, willHelp: "nein" },
        ["Freitag", "Samstag", "Sonntag"]
      )
    ).toBe(false);
    expect(
      isHelperWithoutFirstContact(
        { ...freshHelper, confirmed: "ja" },
        ["Freitag", "Samstag", "Sonntag"]
      )
    ).toBe(false);
  });
});
