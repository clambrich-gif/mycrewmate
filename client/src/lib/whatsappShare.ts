export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du direkt unter folgendem Link:
{PDF_LINK}
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns schnellstmöglich Bescheid, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`;

const LEGACY_WHATSAPP_MESSAGE_TEMPLATES = new Set([
  `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns schnellstmöglich Bescheid, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`,
  `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns zeitnah eine kurze Rückmeldung, ob der Einsatzplan für dich so in Ordnung ist. Es ist besonders wichtig, dass du uns möglichst schnell zurückmeldest, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. Bitte gib uns daher schnellstmöglich Bescheid! ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`,
]);

export function resolveWhatsAppMessageTemplate(
  template: string | null | undefined
) {
  const configuredTemplate = template?.trim();
  return configuredTemplate && !LEGACY_WHATSAPP_MESSAGE_TEMPLATES.has(configuredTemplate)
    ? configuredTemplate
    : DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
}

/**
 * Ersetzt Event und persönlichen Freigabelink. Individuelle ältere Vorlagen
 * ohne {PDF_LINK} bleiben nutzbar und erhalten den Link automatisch am Ende.
 */
export function renderWhatsAppMessage(
  template: string | null | undefined,
  eventName: string | null | undefined,
  pdfLink: string
) {
  const configuredTemplate = resolveWhatsAppMessageTemplate(template);
  const safeEventName = eventName?.trim() || "unser Event";
  const withLink = configuredTemplate.includes("{PDF_LINK}")
    ? configuredTemplate
    : `${configuredTemplate}\n\n📄 Dein persönlicher Einsatzplan:\n{PDF_LINK}`;
  return withLink
    .replaceAll("{EVENT_NAME}", safeEventName)
    .replaceAll("{PDF_LINK}", pdfLink);
}

/** WhatsApp-Universal-Link mit vollständig vorbereitetem Text und PDF-Freigabe. */
export function buildWhatsAppShareUrl(message: string) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
