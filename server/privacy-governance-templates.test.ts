import { describe, expect, it } from "vitest";
import {
  renderClubPrivacyNoticeTemplatePdf,
  renderDataSubjectRequestTemplatePdf,
  renderPrivacyIncidentTemplatePdf,
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
});
