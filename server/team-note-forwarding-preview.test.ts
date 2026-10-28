import { describe, expect, it } from "vitest";
import {
  isTeamNoteForwardingPreviewAllowed,
  mayUseTeamNoteForwardingPreview,
  previewRecipientsForChannel,
  teamNotePreviewEmailResult,
  teamNotePreviewWhatsAppResult,
} from "./team-note-forwarding-preview";
import { appRouter } from "./routers";

describe("isolierte Teamnotiz-Weiterleitungs-Vorschau", () => {
  it("liefert über den echten tRPC-Namensraum nur statische Fakes", async () => {
    const previewCaller = appRouter.createCaller({
      req: { hostname: "3000-example.manus.computer", headers: {} } as any,
      res: {} as any,
      user: null,
    });
    await expect(
      previewCaller.teamNoteForwardingPreview.fixture()
    ).resolves.toMatchObject({
      contacts: expect.arrayContaining([
        expect.objectContaining({
          name: "Anna Becker",
          email: "anna.becker@example.org",
        }),
      ]),
      note: expect.objectContaining({ eventName: "Radsportfestival 2027" }),
    });
  });

  it("ist nur in Tests sowie auf lokalen oder Manus-Vorschauhosts erreichbar", () => {
    expect(
      isTeamNoteForwardingPreviewAllowed({
        environment: "development",
        hostname: "3000-example.manus.computer",
      })
    ).toBe(true);
    expect(
      isTeamNoteForwardingPreviewAllowed({
        environment: "development",
        hostname: "localhost",
      })
    ).toBe(true);
    expect(
      isTeamNoteForwardingPreviewAllowed({
        environment: "development",
        hostname: "app.mycrewmate.de",
      })
    ).toBe(false);
    expect(
      isTeamNoteForwardingPreviewAllowed({
        environment: "production",
        hostname: "3000-example.manus.computer",
      })
    ).toBe(false);
  });

  it("erlaubt den fiktiven Versand nur ab Pro für Administratoren und Co-Administratoren", () => {
    expect(
      mayUseTeamNoteForwardingPreview({
        packageId: "pro",
        role: "admin",
        noteStatus: "available",
      })
    ).toBe(true);
    expect(
      mayUseTeamNoteForwardingPreview({
        packageId: "enterprise",
        role: "co_admin",
        noteStatus: "available",
      })
    ).toBe(true);
    expect(
      mayUseTeamNoteForwardingPreview({
        packageId: "light",
        role: "admin",
        noteStatus: "available",
      })
    ).toBe(false);
    expect(
      mayUseTeamNoteForwardingPreview({
        packageId: "pro",
        role: "planner",
        noteStatus: "available",
      })
    ).toBe(false);
    expect(
      mayUseTeamNoteForwardingPreview({
        packageId: "pro",
        role: "admin",
        noteStatus: "expired",
      })
    ).toBe(false);
  });

  it("berücksichtigt nur fiktive Ansprechpartner mit passendem Kanal", () => {
    const email = previewRecipientsForChannel({
      channel: "email",
      recipientIds: ["anna-becker", "petra-schmitz", "thomas-klein"],
    });
    expect(email.selectedContacts.map(contact => contact.name)).toEqual([
      "Anna Becker",
    ]);
    expect(email.uniqueValueCount).toBe(1);

    const whatsapp = previewRecipientsForChannel({
      channel: "whatsapp",
      recipientIds: ["anna-becker", "leon-fischer", "thomas-klein"],
    });
    expect(whatsapp.selectedContacts.map(contact => contact.name)).toEqual([
      "Anna Becker",
    ]);
    expect(whatsapp.uniqueValueCount).toBe(1);
  });

  it("liefert für E-Mail ausschließlich einen Dry-run und verlangt die Sichtbarkeitsbestätigung", () => {
    expect(() =>
      teamNotePreviewEmailResult({
        packageId: "pro",
        role: "admin",
        noteStatus: "available",
        recipientIds: ["anna-becker"],
        recipientsConfirmed: false,
      })
    ).toThrow("sichtbare Empfängerliste");

    const result = teamNotePreviewEmailResult({
      packageId: "pro",
      role: "admin",
      noteStatus: "available",
      recipientIds: ["anna-becker", "markus-weber"],
      recipientsConfirmed: true,
    });
    expect(result).toMatchObject({
      simulated: true,
      channel: "email",
      recipientCount: 2,
      uniqueAddressCount: 2,
    });
    expect(result.message).toContain("keine E-Mail versendet");
  });

  it("simuliert WhatsApp einzeln statt einen Chat oder eine Nachricht zu öffnen", () => {
    const result = teamNotePreviewWhatsAppResult({
      packageId: "enterprise",
      role: "co_admin",
      noteStatus: "available",
      recipientIds: ["anna-becker", "markus-weber"],
      recipientId: "anna-becker",
    });
    expect(result).toMatchObject({
      simulated: true,
      channel: "whatsapp",
      recipientName: "Anna Becker",
    });
    expect(result.message).toContain(
      "weder ein Chat geöffnet noch eine Nachricht versendet"
    );
  });
});
