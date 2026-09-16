export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns schnellstmöglich Bescheid, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`;

const LEGACY_DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns zeitnah eine kurze Rückmeldung, ob der Einsatzplan für dich so in Ordnung ist. Es ist besonders wichtig, dass du uns möglichst schnell zurückmeldest, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. Bitte gib uns daher schnellstmöglich Bescheid! ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`;

export function resolveWhatsAppMessageTemplate(
  template: string | null | undefined
) {
  const configuredTemplate = template?.trim();
  return configuredTemplate && configuredTemplate !== LEGACY_DEFAULT_WHATSAPP_MESSAGE_TEMPLATE
    ? configuredTemplate
    : DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
}

export function renderWhatsAppMessage(
  template: string | null | undefined,
  eventName: string | null | undefined
) {
  const configuredTemplate = resolveWhatsAppMessageTemplate(template);
  const safeEventName = eventName?.trim() || "unser Event";
  return configuredTemplate.replaceAll("{EVENT_NAME}", safeEventName);
}

/**
 * Startet WhatsApp bewusst ohne Empfänger-, Text- oder Dateiparameter.
 * Das verhindert insbesondere auf iOS, dass eine temporäre blob:-Adresse in
 * das WhatsApp-Textfeld übernommen wird. Die Nachricht bleibt ausschließlich
 * in der Zwischenablage und wird vom Nutzer in WhatsApp eingefügt.
 */
export function buildWhatsAppLaunchUrl(userAgent = navigator.userAgent) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  return isMobile ? "whatsapp://" : "https://web.whatsapp.com/";
}

export async function copyWhatsAppMessage(
  message: string,
  writeText: (text: string) => Promise<void> = text =>
    navigator.clipboard.writeText(text)
) {
  try {
    await writeText(message);
    return true;
  } catch {
    return false;
  }
}
