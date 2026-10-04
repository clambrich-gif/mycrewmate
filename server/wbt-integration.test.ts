import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { readFile } from "node:fs/promises";
import path from "node:path";

describe("WBT-Systemintegration (Erstanmeldung, Hilfe, Masterportal, PDF-Zertifikat)", () => {
  it("WBT-Kapitel ist fest in der Hilfe-Datenbank verankert", async () => {
    const filePath = path.resolve(
      process.cwd(),
      "client/src/components/HelpGuide.tsx"
    );
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("web-based-training");
    expect(content).toContain("Web-Based-Training (WBT-Lernwerkstatt)");
    expect(content).toContain("href: \"/wbt\"");
  });

  it("Erstanmeldung bietet die Wahl zwischen Helfer- und Admin-WBT", async () => {
    const filePath = path.resolve(
      process.cwd(),
      "client/src/components/FirstLoginOnboarding.tsx"
    );
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("Möchtest du ein Web-Based-Training (WBT) starten?");
    expect(content).toContain("1. WBT: Helferkoordination");
    expect(content).toContain("2. WBT: Planungsteam &amp; Admin");
    expect(content).toContain("window.open(\"/wbt\", \"_blank\")");
    expect(content).toContain("Jetzt überspringen");
  });

  it("Hilfe-Seite besitzt den sichtbaren WBT-Schnellzugriffsbanner", async () => {
    const filePath = path.resolve(process.cwd(), "client/src/pages/Help.tsx");
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("Interaktive Lernwerkstatt");
    expect(content).toContain("Web-Based-Training (WBT): Helfer &amp; Planung interaktiv lernen");
    expect(content).toContain("window.open(\"/wbt\", \"_blank\")");
  });

  it("Masterportal bietet die Generierung und Widerrufung von Schulungslinks", async () => {
    const filePath = path.resolve(
      process.cwd(),
      "client/src/pages/MasterAdminPortal.tsx"
    );
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("WBT-Schulungslinks erstellen");
    expect(content).toContain("createWbtTrainingLink");
    expect(content).toContain("revokeWbtTrainingLink");
    expect(content).toContain("Aktive Schulungslinks");
  });

  it("WbtPortal enthält die vergrößerte, realitätsnahe Helfertabelle und den PDF-Zertifikat-Download", async () => {
    const filePath = path.resolve(process.cwd(), "client/src/pages/WbtPortal.tsx");
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("Helferkartei &amp; Koordination");
    expect(content).toContain("Reale Tabellenansicht mit direkten Aktionen");
    expect(content).toContain("Persönliche Teilnahmebestätigung herunterladen");
    expect(content).toContain("createCertificate.mutateAsync");
  });

  it("Öffentliche Route /wbt generiert ein echtes PDF-Teilnahmezertifikat ohne Datenspeicherung", async () => {
    const caller = appRouter.createCaller({
      user: null,
      tenantId: null,
      sessionToken: null,
    } as any);

    const result = await caller.wbt.completionCertificate({
      participantName: "Erika Mustermann",
      trackId: "helper",
    });

    expect(result.mimeType).toBe("application/pdf");
    expect(result.filename).toContain("Teilnahmebestaetigung_Erika_Mustermann.pdf");
    expect(result.base64).toBeDefined();
    expect(result.base64.length).toBeGreaterThan(500);

    const buffer = Buffer.from(result.base64, "base64");
    const pdfText = buffer.toString("latin1");
    expect(pdfText).toContain("PDF");
  });
});
