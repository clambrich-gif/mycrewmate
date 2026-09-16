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
 * Formatiert deutsche Mobilnummern für die WhatsApp-URL. Bereits international
 * gespeicherte Nummern bleiben erhalten; bei leerem oder unbrauchbarem Wert
 * wird bewusst kein Empfänger erzwungen.
 */
export function normalizeWhatsAppPhoneNumber(phone: string | null | undefined) {
  let digits = (phone ?? "").trim().replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `49${digits.slice(1)}`;
  return /^491[5-7]\d{6,10}$/.test(digits) ? digits : null;
}

export function buildWhatsAppDeepLink(
  message: string,
  phone: string | null | undefined = null
) {
  const normalizedPhone = normalizeWhatsAppPhoneNumber(phone);
  const recipient = normalizedPhone ? `phone=${normalizedPhone}&` : "";
  return `https://api.whatsapp.com/send?${recipient}text=${encodeURIComponent(message)}`;
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
