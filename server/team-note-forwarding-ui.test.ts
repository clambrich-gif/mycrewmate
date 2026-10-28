import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Teamnotiz-Weitergabe – Produktoberfläche", () => {
  it("bindet die Weitergabe ausschließlich an das Notizmenü von Pro-/Enterprise-Administratoren", () => {
    const chat = source("client/src/components/LiveChatWidget.tsx");
    const dialog = source("client/src/components/TeamNoteForwardingDialog.tsx");
    const router = source("server/routers.ts");
    const packages = source("shared/product-packages.ts");

    expect(chat).toContain(
      'import { TeamNoteForwardingDialog } from "@/components/TeamNoteForwardingDialog"'
    );
    expect(chat).toContain("canForwardTeamNotes");
    expect(chat).toContain('tenantProductQuery.data?.packageId === "pro"');
    expect(chat).toContain(
      'tenantProductQuery.data?.packageId === "enterprise"'
    );
    expect(chat).toContain("Ansprechpartner informieren");
    expect(chat).toContain("setForwardingNote(note)");
    expect(chat).toContain("<TeamNoteForwardingDialog");

    expect(dialog).toContain("Sichtbare An:-Liste");
    expect(dialog).toContain("[{serverNote.eventName}]");
    expect(dialog).toContain("Aktuelle Team-Notiz");
    expect(dialog).not.toContain("Ich bestätige die sichtbare Empfängerliste");
    expect(dialog).not.toContain("recipientsConfirmed");
    expect(dialog).toContain('channel === "email" ? "Abbrechen" : "Fertig"');
    expect(dialog).toContain("const canSendEmail");
    expect(dialog).toContain("const emailSendLabel");
    expect(dialog).toContain("E-Mail an ${selectedEligibleContacts.length}");
    expect(dialog).toContain("mt-auto min-h-24 w-full");
    expect(dialog).toContain("border-slate-700 bg-slate-700");
    expect(dialog).toContain("border-slate-200 bg-slate-100");
    expect(dialog).toContain("disabled={!canSendEmail}");
    expect(dialog).not.toContain(
      "emailMutation.isPending ||\n                emailResult"
    );
    expect(dialog).toContain(
      "Versandweg geändert – bitte Empfänger neu wählen."
    );
    expect(dialog).toContain("Ausgewählte Ansprechpartner");
    expect(dialog).toContain("whatsAppContactStatuses");
    expect(dialog).toContain("whatsAppOpenedCount");
    expect(dialog).toContain("whatsAppSentCount");
    expect(dialog).toContain("Noch offen");
    expect(dialog).toContain("Chat geöffnet");
    expect(dialog).toContain("Versendet");
    expect(dialog).toContain("WhatsApp für {contact.name} öffnen");
    expect(dialog).not.toContain("nextWhatsAppContact");
    expect(dialog).not.toContain("whatsAppQueue");
    expect(dialog).not.toContain("Text kopieren");
    expect(dialog).toContain("about:blank");
    expect(dialog).not.toContain('"noopener,noreferrer"');
    expect(dialog).toContain("chatWindow.opener = null");
    expect(dialog).toContain("chatWindow.location.replace(url)");
    expect(dialog).toContain("WhatsApp selbst gesendet.");
    expect(dialog).not.toContain("window.open(url");

    expect(router).toContain(
      'productAllowsCapability(entitlement.packageId, "team_note_forwarding")'
    );
    expect(router).toContain(
      "forwardingRecipients: eventChatForwardingProcedure"
    );
    expect(router).toContain("forwardEmail: eventChatForwardingProcedure");
    expect(router).toContain("prepareWhatsApp: eventChatForwardingProcedure");
    expect(packages).toContain('"team_note_forwarding"');
    expect(packages).toContain("team_note_forwarding: false");
  });
});
