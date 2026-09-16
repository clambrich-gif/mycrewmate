import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLaunchUrl,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
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

  it("startet WhatsApp auf Mobilgeräten ohne Empfänger-, Text- oder Dateiparameter", () => {
    const link = buildWhatsAppLaunchUrl(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    );

    expect(link).toBe("whatsapp://");
    expect(link).not.toContain("?");
    expect(link).not.toContain("text=");
    expect(link).not.toContain("blob:");
  });

  it("startet WhatsApp Web am Desktop ohne Query-Parameter", () => {
    const link = buildWhatsAppLaunchUrl(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
    );

    expect(link).toBe("https://web.whatsapp.com/");
    expect(link).not.toContain("?");
    expect(link).not.toContain("text=");
    expect(link).not.toContain("blob:");
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
