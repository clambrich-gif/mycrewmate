import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Archivierte Vereinszugänge geben E-Mail-Adressen frei", () => {
  const database = source("server/db.ts");
  const migration = source("drizzle/0062_release_archived_access_emails.sql");
  const journal = source("drizzle/meta/_journal.json");

  it("entwertet offene Links, Sitzungen und persönliche Adressen beim Archivieren", () => {
    expect(database).toContain("async function revokeArchivedTenantAccesses");
    expect(database).toContain("await revokeArchivedTenantAccesses(tx, input.tenantId)");
    expect(database).toContain("email: null");
    expect(database).toContain('status: "suspended"');
    expect(database).toContain("sessionVersion: sql`${planningTeamAccesses.sessionVersion} + 1`");
    expect(database).toContain("archivierter-zugang-${userId}@invalid.local");
    expect(database).toContain("eq(tenantAdminInvitations.tenantId, tenantId)");
    expect(database).toContain("eq(planningTeamInvitations.tenantId, tenantId)");
  });

  it("ignoriert archivierte oder pausierte Zugänge bei Login- und Konfliktprüfungen", () => {
    expect(database).toContain("notEq(tenants.status, \"archived\")");
    expect(database).toContain("notEq(tenants.status, \"suspended\")");
    expect(database).toContain("getPlanningTeamAccessCredentialByEmail");
    expect(database).toContain("getTenantAdminCredentialsByEmail");
    expect(database).toContain("assertNoPlanningTeamEmailConflict");
  });

  it("bereinigt bereits archivierte Altbestände bei der nächsten Migration", () => {
    expect(migration).toContain("WHERE `tenant`.`status` = 'archived'");
    expect(migration).toContain("SET `access`.`email` = NULL");
    expect(migration).toContain("SET `membership`.`status` = 'suspended'");
    expect(migration).toContain("archivierter-zugang-");
    expect(journal).toContain('"tag": "0062_release_archived_access_emails"');
  });
});
