import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHATSAPP_HELPER_REQUEST_TEMPLATE,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  buildWhatsAppShareUrl,
  normalizeWhatsAppPhone,
  renderWhatsAppMessage,
  resolveWhatsAppHelperRequestTemplate,
  resolveWhatsAppMessageTemplate,
} from "../client/src/lib/whatsappShare";

describe("WhatsApp-Freigabe und Vorlagen", () => {
  it("bereitet einen direkten WhatsApp-Chat für deutsche und internationale Helfernummern vor", () => {
    expect(normalizeWhatsAppPhone("0171 123 45 67")).toBe("491711234567");
    expect(normalizeWhatsAppPhone("+49 (171) 123-45-67")).toBe(
      "491711234567"
    );
    expect(normalizeWhatsAppPhone("0049 171 1234567")).toBe(
      "491711234567"
    );

    const url = new URL(
      buildWhatsAppShareUrl("Hallo Anna", "0171 123 45 67")
    );
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/491711234567");
    expect(url.searchParams.get("text")).toBe("Hallo Anna");
  });

  it("fällt ohne gespeicherte Helfernummer transparent auf den WhatsApp-Teilen-Dialog zurück", () => {
    const url = new URL(buildWhatsAppShareUrl("Hallo zusammen", null));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("text")).toBe("Hallo zusammen");
  });

  it("füllt Muster 1 (allgemeine Helferanfrage) mit Eventname und Zeitraum, aber ohne PDF-Link", () => {
    const message = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_HELPER_REQUEST_TEMPLATE,
      {
        eventName: "Radsportfestival 2026",
        eventDuration: "19.–21.06.2026",
      }
    );

    expect(message).toContain("Radsportfestival 2026");
    expect(message).toContain("Veranstaltungszeitraum: 19.–21.06.2026");
    expect(message).toContain("1️⃣ Zeiten:");
    expect(message).toContain("2️⃣ Spenden:");
    expect(message).not.toContain("{EVENT_NAME}");
    expect(message).not.toContain("{EVENT_DAUER}");
    expect(message).not.toContain("{PDF_LINK}");
  });

  it("füllt Muster 2 (Einsatzplan) mit Eventname und PDF-Link aus", () => {
    const message = renderWhatsAppMessage(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE, {
      eventName: "Radsportfestival 2026",
      pdfLink: "https://app.mycrewmate.de/p/Ab3dE9F_",
    });

    expect(message).toContain("Radsportfestival 2026");
    expect(message).toContain("https://app.mycrewmate.de/p/Ab3dE9F_");
    expect(message).toContain("Dein RSC-Orga-Team 🏆");
    expect(message).not.toContain("{EVENT_NAME}");
    expect(message).not.toContain("{PDF_LINK}");
  });

  it("fällt bei leeren Vorlagen stabil auf die Standardmuster zurück", () => {
    expect(resolveWhatsAppHelperRequestTemplate("   ")).toBe(
      DEFAULT_WHATSAPP_HELPER_REQUEST_TEMPLATE
    );
    expect(resolveWhatsAppMessageTemplate("   ")).toBe(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE
    );
  });
});
