export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Hallo! 👋
Hier ist dein persönlicher Einsatzplan für unser Event {EVENT_NAME} 🚴💨
📄 Deinen genauen Plan findest du im angehängten PDF-Dokument.
ℹ️ Deinen persönlichen Ansprechpartner findest du direkt unten auf deinem PDF-Formular.
⚠️ Bitte gib uns zeitnah eine kurze Rückmeldung, ob der Einsatzplan für dich so in Ordnung ist. Es ist besonders wichtig, dass du uns möglichst schnell zurückmeldest, damit wir den gesamten Einsatzplan in Absprache mit allen finalisieren können. Bitte gib uns daher schnellstmöglich Bescheid! ⏳👍
Vielen Dank für deine fantastische Unterstützung! 🥳
Dein RSC-Orga-Team 🏆`;

export function renderWhatsAppMessage(
  template: string | null | undefined,
  eventName: string | null | undefined
) {
  const configuredTemplate = template?.trim() || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
  const safeEventName = eventName?.trim() || "unser Event";
  return configuredTemplate.replaceAll("{EVENT_NAME}", safeEventName);
}

export function buildWhatsAppDeepLink(message: string) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
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
