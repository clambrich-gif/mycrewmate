import { describe, expect, it } from "vitest";
import {
  renderClubPrivacyNoticeTemplatePdf,
  renderDataSubjectRequestTemplatePdf,
  renderPrivacyIncidentTemplatePdf,
  renderTenantAcceptedContractDocumentsPdf,
  renderTenantContractReceiptPdf,
} from "./pdf";

describe("Datenschutz- und Governance-PDF-Vorlagen", () => {
  it("erzeugt das ausfüllbare Vereinsmuster für Helfer und Ansprechpartner", async () => {
    const buffer = await renderClubPrivacyNoticeTemplatePdf();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("erzeugt die interne Vorlage für Datenschutz-Betroffenenanfragen", async () => {
    const buffer = await renderDataSubjectRequestTemplatePdf();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("erzeugt die interne Vorlage für das Erstprotokoll eines Datenschutzvorfalls", async () => {
    const buffer = await renderPrivacyIncidentTemplatePdf();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("erzeugt einen datensparsamen digitalen Vertragsnachweis", async () => {
    const buffer = await renderTenantContractReceiptPdf({
      tenantName: "Musterverein e. V.",
      recipientName: "Max Muster",
      packageName: "Pro",
      acceptedAt: new Date("2026-10-02T18:00:00.000Z"),
      documents: [
        {
          title: "Allgemeine Geschäftsbedingungen",
          version: "1.0-2026-10-01",
          hash: "a".repeat(64),
        },
      ],
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("erzeugt das vollständige Dokument der bestätigten Vertragsunterlagen mit Originalwortlauten", async () => {
    const buffer = await renderTenantAcceptedContractDocumentsPdf({
      tenantName: "Musterverein e. V.",
      recipientName: "Max Muster",
      packageName: "Pro",
      acceptedAt: new Date("2026-10-02T18:00:00.000Z"),
      documents: [
        {
          title: "Allgemeine Geschäftsbedingungen",
          version: "1.0-2026-10-01",
          hash: "a".repeat(64),
          content: "# Allgemeine Geschäftsbedingungen\n\n## 1. Geltung\nBeispieltext für Vertragsinhalte.",
        },
      ],
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
