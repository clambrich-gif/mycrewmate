import { describe, expect, it } from "vitest";
import {
  buildWhatsAppDeepLink,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  normalizeWhatsAppPhoneNumber,
  renderWhatsAppMessage,
  resolveWhatsAppMessageTemplate,
} from "../client/src/lib/whatsappShare";

describe("whatsappShare", () => {
  it("verwendet die Standardvorlage mit allen geforderten Emojis und ersetzt den Eventnamen", () => {
    const text = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      "MyEifelRide 2027"
    );

    expect(text).toBe(`Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event MyEifelRide 2027 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns schnellstmöglich Bescheid, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`);
  });

  it("erlaubt eine konfigurierte Vorlage und ersetzt den Platzhalter", () => {
    const customTemplate =
      "Moin! Einsatzplan für {EVENT_NAME} liegt anbei. Bitte schnell melden! ⏳";
    const text = renderWhatsAppMessage(customTemplate, "Frühjahrsfahrt");

    expect(text).toBe(
      "Moin! Einsatzplan für Frühjahrsfahrt liegt anbei. Bitte schnell melden! ⏳"
    );
  });

  it("erzeugt einen direkten WhatsApp-Link mit normalisierter deutscher Mobilnummer", () => {
    const message = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      "Test-Event"
    );
    const link = buildWhatsAppDeepLink(message, "0174 455 558");

    expect(link).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=49174455558&text=/);
    expect(link).toContain(encodeURIComponent("Test-Event"));
    expect(link).toContain(encodeURIComponent("🚴💨"));
  });

  it("normalisiert internationale Nummern und behält bei fehlender Nummer den allgemeinen WhatsApp-Start", () => {
    expect(normalizeWhatsAppPhoneNumber("+49 (174) 455-558")).toBe(
      "49174455558"
    );
    expect(normalizeWhatsAppPhoneNumber("0049 174 455 558")).toBe(
      "49174455558"
    );
    expect(normalizeWhatsAppPhoneNumber("02651 123456")).toBeNull();
    expect(buildWhatsAppDeepLink("Hallo", null)).toBe(
      "https://api.whatsapp.com/send?text=Hallo"
    );
  });

  it("ersetzt ausschließlich die frühere Standardvorlage durch den neuen Standardwert", () => {
    const legacyTemplate = `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns zeitnah eine kurze Rückmeldung, ob der Einsatzplan für dich so in Ordnung ist. Es ist besonders wichtig, dass du uns möglichst schnell zurückmeldest, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. Bitte gib uns daher schnellstmöglich Bescheid! ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`;
    expect(resolveWhatsAppMessageTemplate(legacyTemplate)).toBe(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE
    );
    expect(resolveWhatsAppMessageTemplate("Eigener Text {EVENT_NAME}")).toBe(
      "Eigener Text {EVENT_NAME}"
    );
  });
});
