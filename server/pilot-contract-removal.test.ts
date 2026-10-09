import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Schlanker Pilotablauf ohne Vertragsmodul", () => {
  it("entfernt nur die unverbindliche Pilotvertragsfunktion", () => {
    const schema = source("drizzle/schema.ts");
    const db = source("server/db.ts");
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/MasterAdminPortal.tsx");
    const pdf = source("server/pdf.ts");

    expect(schema).not.toContain('"pilot_contracts"');
    expect(db).not.toContain("listPilotContractsForPlatformAdmin");
    expect(router).not.toContain("pilotContracts: masterAdminProcedure");
    expect(router).not.toContain("createPilotContract: masterAdminProcedure");
    expect(portal).not.toContain("Pilotvereine & Pilotverträge");
    expect(portal).not.toContain("Pilotvertrag anlegen");
    expect(pdf).not.toContain("renderPilotContractDraftPdf");
  });

  it("behält öffentliche Pilotanfragen und die echten Vertragsunterlagen bei", () => {
    const db = source("server/db.ts");
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(router).toContain("pilotInquiries: masterAdminProcedure");
    expect(portal).toContain("Pilotanfragen");
    expect(db).toContain("tenantContractAcceptances");
    expect(portal).toContain("Zustimmungen für den Vereinszugang vollständig.");
  });
});
