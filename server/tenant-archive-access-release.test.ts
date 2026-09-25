import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Archivierte Vereinszugänge geben E-Mail-Adressen frei", () => {
  const database = source("server/db.ts");
  const migration = source("drizzle/0065_remove_archived_tenant_accesses.sql");
  const journal = source("drizzle/meta/_journal.json");

  it("entfernt offene Links, Sitzungen und persönliche Zugänge beim Archivieren", () => {
    expect(database).toContain("async function revokeArchivedTenantAccesses");
    expect(database).toContain("await revokeArchivedTenantAccesses(tx, input.tenantId)");
    expect(database).toContain(".delete(planningTeamAccesses)");
    expect(database).toContain(".delete(tenantAdminInvitations)");
    expect(database).toContain(".delete(userTenantMemberships)");
    expect(database).toContain(".delete(platformTenantHandoffs)");
    expect(database).toContain(".delete(users)");
    expect(database).toContain(".insert(revokedSessions)");
    expect(database).toContain(".delete(sessionPresences)");
    expect(database).toContain("archivierter-zugang-${userId}@invalid.local");
    expect(database).toContain("eq(tenantAdminInvitations.tenantId, tenantId)");
    expect(database).toContain("eq(planningTeamInvitations.tenantId, tenantId)");
  });

  it("schützt verbleibende Mitgliedschaften in anderen Vereinen und verlangt Neuanlage nach Reaktivierung", () => {
    expect(database).toContain("remainingMemberships.length === 0");
    expect(database).toContain('membership.role === "tenant_admin"');
    expect(database).toContain('membership.status === "active"');
    expect(database).toContain("async function updateTenantLifecycleForPlatformAdmin");
    expect(database).not.toContain("restoreArchivedTenantAccesses");
  });

  it("ignoriert archivierte oder pausierte Zugänge bei Login- und Konfliktprüfungen", () => {
    expect(database).toContain("notEq(tenants.status, \"archived\")");
    expect(database).toContain("notEq(tenants.status, \"suspended\")");
    expect(database).toContain("listPlanningTeamAccessCredentialsByEmail");
    expect(database).toContain("getTenantAdminCredentialsByEmail");
    expect(database).toContain("assertNoPlanningTeamEmailConflict");
  });

  it("bereinigt bereits archivierte Altbestände bei der nächsten Migration", () => {
    expect(migration).toContain("WHERE `tenant`.`status` = 'archived'");
    expect(migration).toContain("DELETE `access`");
    expect(migration).toContain("DELETE `membership`");
    expect(migration).toContain("DELETE `user`");
    expect(migration).toContain("tenant-admin:%");
    expect(migration).toContain("DELETE FROM `platform_tenant_handoffs`");
    expect(migration).toContain("INSERT INTO `revoked_sessions`");
    expect(migration).toContain("DELETE `presence`");
    expect(journal).toContain('"tag": "0065_remove_archived_tenant_accesses"');
  });
});
