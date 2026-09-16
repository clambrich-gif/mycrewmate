import { describe, expect, it } from "vitest";
import {
  buildWhatsAppDeepLink,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  renderWhatsAppMessage,
} from "../client/src/lib/whatsappShare";

describe("whatsappShare", () => {
  it("verwendet die Standardvorlage mit allen geforderten Emojis und ersetzt den Eventnamen", () => {
    const text = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      "MyEifelRide 2027"
    );

    expect(text).toContain("Hallo! 👋");
    expect(text).toContain(
      "Hier ist dein persönlicher Einsatzplan für unser Event MyEifelRide 2027 🚴💨"
    );
    expect(text).toContain(
      "📄 Deinen genauen Plan findest du im angehängten PDF-Dokument."
    );
    expect(text).toContain(
      "ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular."
    );
    expect(text).toContain(
      "⚠️ Bitte gib uns zeitnah eine kurze Rückmeldung, ob der Einsatzplan für dich so in Ordnung ist. Es ist besonders wichtig, dass du uns möglichst schnell zurückmeldest, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. Bitte gib uns daher schnellstmöglich Bescheid! ⏳👍"
    );
    expect(text).toContain(
      "Vielen Dank für deine fantastische Unterstützung! 🥳"
    );
    expect(text).toContain("Dein RSC-Orga-Team 🏆");
  });

  it("erlaubt eine konfigurierte Vorlage und ersetzt den Platzhalter", () => {
    const customTemplate =
      "Moin! Einsatzplan für {EVENT_NAME} liegt anbei. Bitte schnell melden! ⏳";
    const text = renderWhatsAppMessage(customTemplate, "Frühjahrsfahrt");

    expect(text).toBe(
      "Moin! Einsatzplan für Frühjahrsfahrt liegt anbei. Bitte schnell melden! ⏳"
    );
  });

  it("erzeugt einen validen WhatsApp-Link mit Textparameter", () => {
    const message = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      "Test-Event"
    );
    const link = buildWhatsAppDeepLink(message);

    expect(link).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?text=/);
    expect(link).toContain(encodeURIComponent("Test-Event"));
    expect(link).toContain(encodeURIComponent("🚴💨"));
  });
});
