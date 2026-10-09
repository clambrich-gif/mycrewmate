import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderPilotContractDraftPdf } from "./pdf";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Schlanke Pilotvertragsverwaltung", () => {
  it("erstellt einen ausdruckbaren PDF-Entwurf ohne digitale Unterschrift", async () => {
    const pdf = await renderPilotContractDraftPdf({
      contractNumber: "PIL-2026-TEST01",
      clubName: "Testverein e. V.",
      legalName: "Testverein e. V.",
      contactName: "Erika Beispiel",
      contactEmail: "erika@testverein.de",
      packageName: "Pro",
      startsOn: "2026-10-15",
      endsOn: "2026-12-31",
      status: "draft",
      createdAt: new Date("2026-10-09T12:00:00.000Z"),
      agreedAt: null,
      internalNote: "Abstimmung per Telefon vor Freischaltung.",
    });

    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it("hält Verträge getrennt von Pilotanfragen und auf das Master-Portal beschränkt", () => {
    const schema = source("drizzle/schema.ts");
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(schema).toContain('"pilot_contracts"');
    expect(schema).toContain('"draft", "agreed", "archived"');
    expect(router).toContain("pilotContracts: masterAdminProcedure");
    expect(router).toContain("createPilotContract: masterAdminProcedure");
    expect(router).toContain("pilotContractPdf: masterAdminProcedure");
    expect(portal).toContain("Pilotvereine &amp; Pilotverträge");
    expect(portal).toContain("Pilotvertrag endgültig löschen?");
  });

  it("verwendet die verbindliche Master-Portal-Domain", () => {
    const platformAdmin = source("shared/platform-admin.ts");
    expect(platformAdmin).toContain('"admin.mycrewmate.de"');
  });
});
