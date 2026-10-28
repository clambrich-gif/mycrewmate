export type TeamNotePreviewChannel = "email" | "whatsapp";
export type TeamNotePreviewPackage =
  | "event_pass"
  | "light"
  | "pro"
  | "enterprise";
export type TeamNotePreviewRole = "admin" | "co_admin" | "planner";
export type TeamNotePreviewNoteStatus = "available" | "expired";

export type TeamNotePreviewContact = {
  id: string;
  name: string;
  email: string | null;
  whatsappNumber: string | null;
};

/**
 * Ausschließlich fiktive Kontaktdaten für die lokale Manus-/Entwicklungsvorschau.
 * Diese Datei importiert bewusst weder Datenbank- noch Mail- oder WhatsApp-Code.
 */
export const TEAM_NOTE_FORWARDING_PREVIEW_CONTACTS: readonly TeamNotePreviewContact[] =
  [
    {
      id: "anna-becker",
      name: "Anna Becker",
      email: "anna.becker@example.org",
      whatsappNumber: "+491701112233",
    },
    {
      id: "markus-weber",
      name: "Markus Weber",
      email: "markus.weber@example.org",
      whatsappNumber: "+491701112244",
    },
    {
      id: "sabine-roth",
      name: "Sabine Roth",
      email: "sabine.roth@example.org",
      whatsappNumber: "+491701112255",
    },
    {
      id: "leon-fischer",
      name: "Leon Fischer",
      email: "leon.fischer@example.org",
      whatsappNumber: null,
    },
    {
      id: "petra-schmitz",
      name: "Petra Schmitz",
      email: null,
      whatsappNumber: "+491701112266",
    },
    {
      id: "thomas-klein",
      name: "Thomas Klein",
      email: null,
      whatsappNumber: null,
    },
  ] as const;

export const TEAM_NOTE_FORWARDING_PREVIEW_NOTE = {
  eventName: "Radsportfestival 2027",
  senderName: "Julia Neumann",
  senderRole: "Co-Administration",
  message:
    "Die Streckenfreigabe am Samstag verschiebt sich auf 07:30 Uhr. Bitte informiert eure Teams und seid bis 07:15 Uhr am Startbereich.",
} as const;

export function isTeamNoteForwardingPreviewAllowed(input: {
  environment?: string;
  hostname?: string | null;
}) {
  if (input.environment === "test") return true;
  if (input.environment === "production") return false;

  const hostname = (input.hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".manus.computer")
  );
}

export function mayUseTeamNoteForwardingPreview(input: {
  packageId: TeamNotePreviewPackage;
  role: TeamNotePreviewRole;
  noteStatus: TeamNotePreviewNoteStatus;
}) {
  const packageAllowsFeature =
    input.packageId === "pro" || input.packageId === "enterprise";
  const roleAllowsFeature = input.role === "admin" || input.role === "co_admin";
  return (
    packageAllowsFeature &&
    roleAllowsFeature &&
    input.noteStatus === "available"
  );
}

function contactValue(
  contact: TeamNotePreviewContact,
  channel: TeamNotePreviewChannel
) {
  return channel === "email" ? contact.email : contact.whatsappNumber;
}

/** Ermittelt fiktive, gültige Empfänger und reduziert gleiche Kontaktwerte auf einen Versandweg. */
export function previewRecipientsForChannel(input: {
  channel: TeamNotePreviewChannel;
  recipientIds: readonly string[];
}) {
  const requestedIds = new Set(input.recipientIds);
  const selectedContacts = TEAM_NOTE_FORWARDING_PREVIEW_CONTACTS.filter(
    contact => requestedIds.has(contact.id)
  ).filter(contact => Boolean(contactValue(contact, input.channel)));

  const uniqueValues = new Set<string>();
  const uniqueContacts = selectedContacts.filter(contact => {
    const value = contactValue(contact, input.channel);
    if (!value || uniqueValues.has(value)) return false;
    uniqueValues.add(value);
    return true;
  });

  return {
    selectedContacts,
    uniqueContacts,
    uniqueValueCount: uniqueValues.size,
  };
}

export function teamNotePreviewEmailResult(input: {
  packageId: TeamNotePreviewPackage;
  role: TeamNotePreviewRole;
  noteStatus: TeamNotePreviewNoteStatus;
  recipientIds: readonly string[];
  recipientsConfirmed: boolean;
}) {
  if (!mayUseTeamNoteForwardingPreview(input)) {
    throw new Error(
      "Die Vorschau darf für diesen Paket-, Rollen- oder Notizstatus nicht weitergeben."
    );
  }
  if (!input.recipientsConfirmed) {
    throw new Error(
      "Die sichtbare Empfängerliste muss vor der Simulation bestätigt werden."
    );
  }

  const recipients = previewRecipientsForChannel({
    channel: "email",
    recipientIds: input.recipientIds,
  });
  if (recipients.selectedContacts.length === 0) {
    throw new Error(
      "Bitte mindestens einen Ansprechpartner mit E-Mail-Adresse auswählen."
    );
  }

  return {
    simulated: true as const,
    channel: "email" as const,
    recipientCount: recipients.selectedContacts.length,
    uniqueAddressCount: recipients.uniqueValueCount,
    message: `Simulation: Versandauftrag für ${recipients.selectedContacts.length} Ansprechpartner angenommen. Es wurde keine E-Mail versendet.`,
  };
}

export function teamNotePreviewWhatsAppResult(input: {
  packageId: TeamNotePreviewPackage;
  role: TeamNotePreviewRole;
  noteStatus: TeamNotePreviewNoteStatus;
  recipientIds: readonly string[];
  recipientId: string;
}) {
  if (!mayUseTeamNoteForwardingPreview(input)) {
    throw new Error(
      "Die Vorschau darf für diesen Paket-, Rollen- oder Notizstatus keinen Chat vorbereiten."
    );
  }

  const recipients = previewRecipientsForChannel({
    channel: "whatsapp",
    recipientIds: input.recipientIds,
  });
  const recipient = recipients.uniqueContacts.find(
    contact => contact.id === input.recipientId
  );
  if (!recipient) {
    throw new Error(
      "Dieser fiktive WhatsApp-Kontakt gehört nicht zur aktuellen Auswahl."
    );
  }

  return {
    simulated: true as const,
    channel: "whatsapp" as const,
    recipientId: recipient.id,
    recipientName: recipient.name,
    message: `Simulation: WhatsApp für ${recipient.name} wurde vorbereitet. Es wurde weder ein Chat geöffnet noch eine Nachricht versendet.`,
  };
}
