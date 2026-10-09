import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  UNASSIGNED_TENANT_ID,
  currentTenantId,
  normalizeTenantId,
} from "./year-context";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Entkopplung historischer Standardvereine", () => {
  it("verwendet serverseitig einen neutralen Kontext statt eines echten Vereins", () => {
    expect(normalizeTenantId(undefined)).toBe(UNASSIGNED_TENANT_ID);
    expect(currentTenantId()).toBe(UNASSIGNED_TENANT_ID);

    const context = source("server/year-context.ts");
    expect(context).toContain("UNASSIGNED_TENANT_ID");
    expect(context).not.toContain("rsc-eifelland-mayen");
  });

  it("löst Vereinszugriffe ausschließlich über aktive Mitgliedschaften auf", () => {
    const db = source("server/db.ts");
    const router = source("server/routers.ts");
    const publicPdf = source("server/public-helper-pdf-routes.ts");

    expect(db).not.toContain("DEFAULT_TENANT_ID");
    expect(db).not.toContain("if (!memberships.length && input.allowPilotFallback !== false)");
    expect(db).toContain("Ohne aktive Mitgliedschaft wird kein Vereinskontext erzeugt");
    expect(router).not.toContain("ensurePilotMembershipForMasterAdmin");
    expect(router).not.toContain("DEFAULT_TENANT_ID");
    expect(publicPdf).not.toContain("DEFAULT_TENANT_ID");
    expect(publicPdf).toContain("PDF-Freigabe ohne Vereinskennung");
  });

  it("entfernt die statische Bindung an den Archivverein, bereinigt aber alte Browserwerte sicher", () => {
    const schema = source("drizzle/schema.ts");
    const sharedTenants = source("shared/tenant.ts");
    const clientContext = source("client/src/contexts/YearContext.tsx");
    const portal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(schema).not.toContain('.default("rsc-eifelland-mayen")');
    expect(sharedTenants).not.toContain("RSC Eifelland Mayen e. V.");
    expect(clientContext).toContain("LEGACY_ARCHIVED_TENANT_ID");
    expect(clientContext).toContain("window.localStorage.removeItem(TENANT_STORAGE_KEY)");
    expect(portal).not.toContain('tenant.id !== "rsc-eifelland-mayen"');
    expect(portal).not.toContain("Der geschützte RSC-Pilotverein");
  });
});
