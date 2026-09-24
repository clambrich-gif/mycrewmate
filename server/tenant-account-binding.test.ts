import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Konto-Mandanten-Bindung (Schritt 3)", () => {
  it("definiert die Tabelle user_tenant_memberships im Datenbankschema", () => {
    const schema = source("drizzle/schema.ts");
    expect(schema).toContain("export const userTenantMemberships = mysqlTable");
    expect(schema).toContain('"user_tenant_memberships"');
    expect(schema).toContain('tenant_admin');
    expect(schema).toContain('isDefault: boolean("isDefault")');
    expect(schema).toContain("user_tenant_memberships_user_tenant_unique");
  });

  it("enthält eine sichere, nicht-destruktive Migrationsdatei mit Pilotzuordnung", () => {
    const migration = source("drizzle/0055_outstanding_silver_fox.sql");
    expect(migration).toContain("CREATE TABLE `user_tenant_memberships`");
    expect(migration).toContain("shared-password-admin");
    expect(migration).toContain("'rsc-eifelland-mayen'");
    expect(migration).toContain("'tenant_admin'");
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it("löst den gültigen Verein serverseitig auf und weist fremde Browserangaben ab", () => {
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");
    expect(db).toContain("export async function listActiveTenantMembershipsForUser");
    expect(db).toContain("export async function resolveTenantForUser");
    expect(db).toContain("export async function synchronizePlanningTeamTenantMemberships");
    expect(db).toContain("memberships.find(\n      membership => membership.tenantId === input.preferredTenantId\n    ) ?? memberships.find(membership => membership.isDefault) ?? memberships[0]");
    expect(db).toContain("input.userOpenId === ADMIN_PASSWORD_OPEN_ID && preferredTenantId");
    expect(db).toContain('notEq(tenants.status, "archived")');
    expect(db).toContain("desc(userTenantMemberships.updatedAt)");
    expect(db).toContain("await makeTenantMembershipDefault(tx, existingUser.id, input.tenantId);");
    expect(routers).toContain("userOpenId: user.openId");
  });

  it("erzwingt vor jeder Planungsabfrage den serverseitig autorisierten Verein", () => {
    const routers = source("server/routers.ts");
    expect(routers).toContain("async function authorizedPlanningScope");
    expect(routers).toContain("db.resolveTenantForUser");
    expect(routers).toContain("user.openId === ADMIN_PASSWORD_OPEN_ID");
    expect(routers).toContain(": undefined,");
    expect(routers).toContain("Für dieses Konto ist kein aktiver Verein freigegeben.");
    expect(routers).toContain("const eventSelectionProcedure = activeSessionProcedure.use(async ({ ctx, next }) => {");
    expect(routers).toContain("const scopedReadProcedure = baseProtectedProcedure");
    expect(routers).toContain("const scopedProtectedProcedure = activeSessionProcedure.use");
  });

  it("synchronisiert den Browserkontext automatisch mit dem vom Server bestätigten Verein", () => {
    const context = source("client/src/contexts/YearContext.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const routers = source("server/routers.ts");
    expect(context).toContain("synchronizeTenant(nextTenantId)");
    expect(context).toContain("Die Serverantwort ist maßgeblich.");
    expect(layout).toContain("const authorizedTenantId = currentTenant.data?.id;");
    expect(layout).toContain("if (authorizedTenantId) synchronizeTenant(authorizedTenantId);");
    expect(layout).toContain("selectTenant(result.tenantId);");
    expect(routers).toContain("async function tenantIdForFreshPersonalLogin");
    expect(routers).toContain("allowPilotFallback: false");
  });
});
