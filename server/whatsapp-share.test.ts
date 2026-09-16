import { describe, expect, it } from "vitest";
import {
  buildWhatsAppShareUrl,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  renderWhatsAppMessage,
  resolveWhatsAppMessageTemplate,
} from "../client/src/lib/whatsappShare";

const PDF_LINK = "https://helferplanung.example.test/api/public/pdf/signierter-token";

describe("whatsappShare", () => {
  it("verwendet die Standardvorlage mit Event und persönlichem PDF-Link", () => {
    const text = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      "MyEifelRide 2027",
      PDF_LINK
    );

    expect(text).toBe(`Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event MyEifelRide 2027 🚴💨
📄 Deinen genauen Plan findest du direkt unter folgendem Link:
${PDF_LINK}
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns schnellstmöglich Bescheid, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`);
  });

  it("behält individuelle Vorlagen und ergänzt den persönlichen Link bei älteren Texten", () => {
    const text = renderWhatsAppMessage(
      "Moin! Einsatzplan für {EVENT_NAME} liegt bereit. ⏳",
      "Frühjahrsfahrt",
      PDF_LINK
    );

    expect(text).toBe(
      `Moin! Einsatzplan für Frühjahrsfahrt liegt bereit. ⏳\n\n📄 Dein persönlicher Einsatzplan:\n${PDF_LINK}`
    );
  });

  it("erzeugt einen direkten WhatsApp-Universal-Link mit komplett kodiertem Nachrichtentext", () => {
    const message = renderWhatsAppMessage(
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      "MyEifelRide",
      PDF_LINK
    );
    const url = buildWhatsAppShareUrl(message);

    expect(url).toBe(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(message);
    expect(url).toContain(encodeURIComponent(PDF_LINK));
    expect(url).not.toContain("blob:");
  });

  it("ersetzt die bisherigen Standardtexte automatisch durch die Linkvorlage", () => {
    const legacyTemplate = `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns schnellstmöglich Bescheid, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. ⏳👍
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
