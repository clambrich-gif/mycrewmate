import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAssignmentShareText,
  resolveAssignmentShareContact,
  shareAssignmentText,
} from "../client/src/lib/helper-assignment-share";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setNavigator(value: object) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

describe("Einteilung teilen", () => {
  const contacts = [
    { id: 1, name: "Erika Etappe", phone: "02651 111", note: null },
    {
      id: 2,
      name: "Christian Leitung",
      phone: "0170 222",
      note: "Haupt-Helferleitung",
    },
  ];

  it("verwendet den explizit zugewiesenen Ansprechpartner", () => {
    const contact = resolveAssignmentShareContact(1, contacts);
    expect(contact?.name).toBe("Erika Etappe");
    expect(
      buildAssignmentShareText({
        helperName: "Max Muster",
        eventName: "Radsportfestival",
        contact,
      })
    ).toBe(
      "Hallo Max Muster, hier ist deine Einteilung für Radsportfestival. Dein Ansprechpartner ist Erika Etappe (02651 111).\n\nBitte gib mir kurz eine verbindliche Rückmeldung, ob du mit dem Einsatzplan so einverstanden bist."
    );
  });

  it("verwendet ohne Zuordnung die Haupt-Helferleitung aus den Stammdaten", () => {
    expect(resolveAssignmentShareContact(null, contacts)?.name).toBe(
      "Christian Leitung"
    );
    expect(resolveAssignmentShareContact(null, [])).toBeNull();
  });

  it("öffnet bevorzugt das native Teilen-Menü", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, clipboard: { writeText } });

    await expect(
      shareAssignmentText({
        helperName: "Max Muster",
        eventName: "Radsportfestival",
        contact: contacts[0],
      })
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "Einteilung für Max Muster",
      text: expect.stringContaining("Erika Etappe (02651 111)"),
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("kopiert den Text ohne Web Share API in die Zwischenablage", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });

    await expect(
      shareAssignmentText({
        helperName: "Max Muster",
        eventName: "Radsportfestival",
        contact: contacts[0],
      })
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain(
      "Bitte gib mir kurz eine verbindliche Rückmeldung"
    );
  });
});
