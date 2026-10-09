import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertTenantAdministratorCanBeRevoked } from "./db";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Vereinsadmin-Entzug", () => {
  it("verhindert, dass der letzte aktive Vereinsadmin entfernt wird", () => {
    expect(() => assertTenantAdministratorCanBeRevoked(0)).toThrow(
      "Der letzte aktive Vereinsadmin kann nicht entfernt werden"
    );
    expect(() => assertTenantAdministratorCanBeRevoked(1)).toThrow(
      "Der letzte aktive Vereinsadmin kann nicht entfernt werden"
    );
    expect(() => assertTenantAdministratorCanBeRevoked(2)).not.toThrow();
  });

  it("entzieht nur die Mitgliedschaft im gewählten Verein", () => {
    const db = source("server/db.ts");
    const router = source("server/routers.ts");

    expect(db).toContain("export async function revokeTenantAdministratorForPlatformAdmin");
    expect(db).toContain("eq(userTenantMemberships.tenantId, input.tenantId)");
    expect(db).toContain("assertTenantAdministratorCanBeRevoked(activeAdministrators.length)");
    expect(db).toContain(".delete(userTenantMemberships)");
    expect(db).not.toContain("await tx.delete(users).where(eq(users.id, input.userId))");
    expect(router).toContain("revokeTenantAdmin: masterAdminProcedure");
  });

  it("zeigt Ablauf und sichere Verwaltungswege auch für aktive Vereine", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(page).toContain("function TenantProductTerm");
    expect(page).toContain("Tariflaufzeit");
    expect(page).toContain("Keine automatische Verlängerung");
    expect(page).toContain('tenant.status === "active"');
    expect(page).toContain("Admin-Zugang hinzufügen");
    expect(page).toContain("In Vereinsansicht wechseln");
    expect(page).toContain("Adminzugang für diesen Verein entziehen?");
    expect(page).toContain("Mindestens ein aktiver Vereinsadmin muss erhalten bleiben.");
  });
});
