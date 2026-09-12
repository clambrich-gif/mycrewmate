export type AssignmentShareContact = {
  name: string;
  phone: string | null;
  note?: string | null;
};

export type AssignmentSharePayload = {
  helperName: string;
  eventName: string;
  contact: AssignmentShareContact;
};

export function resolveAssignmentShareContact<T extends AssignmentShareContact>(
  contactId: number | null,
  contacts: readonly (T & { id: number })[]
): T | null {
  if (contactId) {
    const assignedContact = contacts.find(contact => contact.id === contactId);
    if (assignedContact) return assignedContact;
  }

  return (
    contacts.find(contact =>
      /haupt[-\s]*helferleitung|helferleitung/i.test(
        `${contact.name} ${contact.note ?? ""}`
      )
    ) ??
    contacts[0] ??
    null
  );
}

export function buildAssignmentShareText({
  helperName,
  eventName,
  contact,
}: AssignmentSharePayload) {
  const contactName = contact.name.trim();
  const contactPhone = contact.phone?.trim() || "keine Rufnummer hinterlegt";

  return `Hallo ${helperName}, hier ist deine Einteilung für ${eventName}. Dein Ansprechpartner ist ${contactName} (${contactPhone}).\n\nBitte gib mir kurz eine verbindliche Rückmeldung, ob du mit dem Einsatzplan so einverstanden bist.`;
}

export async function shareAssignmentText(
  payload: AssignmentSharePayload
): Promise<"shared" | "copied"> {
  const text = buildAssignmentShareText(payload);

  if (typeof navigator.share === "function") {
    await navigator.share({
      title: `Einteilung für ${payload.helperName}`,
      text,
    });
    return "shared";
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textArea.remove();
  }
  if (!copied) {
    throw new Error("Teilen und Zwischenablage werden nicht unterstützt.");
  }
  return "copied";
}
