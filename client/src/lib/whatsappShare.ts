export const DEFAULT_WHATSAPP_HELPER_REQUEST_TEMPLATE = `Hallo! 👋
Wir stecken mitten in den Vorbereitungen für unser Event {EVENT_NAME} 🚴💨
📅 Veranstaltungszeitraum: {EVENT_DAUER}

Damit unser Event ein voller Erfolg wird, brauchen wir wieder deine fantastische Unterstützung! 🥳🙌

Bist du dabei?
Falls ja, gib uns bitte kurze Rückmeldung zu folgenden Punkten:
1️⃣ Zeiten: Wann und an welchen Tagen passt es dir am besten zu helfen? ⏰
2️⃣ Spenden: Möchtest du uns zusätzlich mit einer Kuchen- oder Salatspende unterstützen? 🍰🥗

⚠️ Bitte gib uns kurz Rückmeldung, damit wir in die detaillierte Schichtplanung gehen können. ⏳👍

Vielen Dank schon vorab für deinen Einsatz! 🏆
Dein RSC-Orga-Team`;

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

export function resolveWhatsAppHelperRequestTemplate(
  template: string | null | undefined
) {
  return template?.trim() || DEFAULT_WHATSAPP_HELPER_REQUEST_TEMPLATE;
}

export function resolveWhatsAppMessageTemplate(
  template: string | null | undefined
) {
  const configuredTemplate = template?.trim();
  return configuredTemplate && !LEGACY_WHATSAPP_MESSAGE_TEMPLATES.has(configuredTemplate)
    ? configuredTemplate
    : DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
}

type WhatsAppMessageVariables = {
  eventName?: string | null;
  eventDuration?: string | null;
  pdfLink?: string | null;
};

/**
 * Ersetzt die freigegebenen dynamischen Platzhalter einer Nachrichtenvorlage.
 * Ein PDF-Link wird nur für die Einsatzplanvorlage ergänzt, nie bei der allgemeinen Anfrage.
 */
export function renderWhatsAppMessage(
  template: string | null | undefined,
  { eventName, eventDuration, pdfLink }: WhatsAppMessageVariables
) {
  const safeEventName = eventName?.trim() || "unser Event";
  const safeEventDuration = eventDuration?.trim() || "an den Veranstaltungstagen";
  const configuredTemplate = pdfLink
    ? resolveWhatsAppMessageTemplate(template)
    : resolveWhatsAppHelperRequestTemplate(template);
  const withLink = pdfLink
    ? configuredTemplate.includes("{PDF_LINK}")
      ? configuredTemplate
      : `${configuredTemplate}\n\n📄 Dein persönlicher Einsatzplan:\n{PDF_LINK}`
    : configuredTemplate;

  return withLink
    .replaceAll("{EVENT_NAME}", safeEventName)
    .replaceAll("{EVENT_DAUER}", safeEventDuration)
    .replaceAll("{PDF_LINK}", pdfLink?.trim() || "");
}

/**
 * Bereinigt deutsche und internationale Rufnummern für WhatsApps Click-to-Chat.
 * Die Nummer wird ausschließlich in den Client-Link übernommen und nicht
 * serverseitig an einen externen Dienst übertragen.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const compact = phone?.trim().replace(/[\s()./-]/g, "") ?? "";
  if (!compact) return null;
  if (compact.startsWith("00")) return compact.slice(2).replace(/\D/g, "") || null;
  if (compact.startsWith("+")) return compact.slice(1).replace(/\D/g, "") || null;
  if (compact.startsWith("0")) return `49${compact.slice(1).replace(/\D/g, "")}` || null;
  const digits = compact.replace(/\D/g, "");
  return digits || null;
}

/**
 * Öffnet einen WhatsApp-Chat mit einem vollständig vorbereiteten Text.
 * Mit Helfernummer wird der Zielchat direkt adressiert; ohne Nummer ist der
 * allgemeine WhatsApp-Teilen-Dialog ein bewusster, transparenter Fallback.
 */
export function buildWhatsAppShareUrl(
  message: string,
  helperPhone?: string | null
) {
  const text = encodeURIComponent(message);
  const phone = normalizeWhatsAppPhone(helperPhone);
  return phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
