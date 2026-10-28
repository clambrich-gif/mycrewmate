import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Teamnotiz-Weitergabe: lokale Sandbox-Vorschau", () => {
  it("registriert die Ansicht nur als nicht verlinkte DEV-Staging-Route", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('path="/_staging/teamnotizen-weiterleiten"');
    expect(app).toContain("isLocalStagingBuild &&");
    expect(app).toContain('import("@/pages/TeamNoteForwardingPreview")');
  });

  it("zeigt den vereinfachten Ein-Dialog-Ablauf mit allen sechs fiktiven Ansprechpartnern", () => {
    const page = source("client/src/pages/TeamNoteForwardingPreview.tsx");
    expect(page).toContain("Ansprechpartner informieren");
    expect(page).toContain("Alle Ansprechpartner mit");
    expect(page).toContain("Ich bestätige die sichtbare Empfängerliste.");
    expect(page).toContain("Versandweg geändert – bitte Empfänger neu wählen.");
    expect(page).toContain("Keine E-Mail-Adresse");
    expect(page).toContain("Keine WhatsApp-Nummer");
    expect(page).toContain("Kein Kontaktweg");
  });

  it("markiert jede Abschlussaktion als Dry-run und öffnet keine externen Kommunikationswege", () => {
    const page = source("client/src/pages/TeamNoteForwardingPreview.tsx");
    const serverPreview = source("server/team-note-forwarding-preview.ts");
    expect(page).toContain("lokale Sandbox-Simulation");
    expect(page).toContain("Öffnet keinen Chat");
    expect(page).not.toContain("trpc.");
    expect(page).not.toContain("window.open");
    expect(page).not.toContain("wa.me");
    expect(page).not.toContain("whatsappShare");
    expect(serverPreview).toContain("Es wurde keine E-Mail versendet.");
    expect(serverPreview).toContain(
      "weder ein Chat geöffnet noch eine Nachricht versendet."
    );
    expect(serverPreview).not.toContain("sendTransactionalEmail");
  });
});
