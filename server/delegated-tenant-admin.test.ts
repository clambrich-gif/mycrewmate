import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("Vereinsadministrator-Stellvertretung", () => {
  it("speichert die Rolle additiv und mandantengebunden", () => {
    const schema = source("drizzle/schema.ts");
    const migration = source("drizzle/0060_powerful_mister_sinister.sql");
    const database = source("server/db.ts");

    expect(schema).toContain('isTenantAdmin: boolean("isTenantAdmin")');
    expect(migration).toContain("ALTER TABLE `planning_team_accesses` ADD `isTenantAdmin`");
    expect(database).toContain("requirePlanningTeamAccessForTenant");
    expect(database).toContain("Der Planungsteam-Zugang gehört nicht zum aktuellen Verein");
  });

  it("gibt Stellvertretungen volle Vereinsrechte, aber keine Master- oder Weitergaberechte", () => {
    const router = source("server/routers.ts");

    expect(router).toContain("Dieser Planungsteam-Zugang gehört nicht zum aktuell angemeldeten Verein.");
    expect(router).toContain("if (access.isTenantAdmin) return FULL_PLANNER_PERMISSIONS");
    expect(router).toContain("const scopeAdminAuthProcedure");
    expect(router).toContain("if (!(await isTenantAdministrator(ctx.user)))");
    expect(router).toContain("const masterAdminProcedure");
    expect(router).toContain("ctx.user.openId === ADMIN_PASSWORD_OPEN_ID");
    expect(router).toContain("Nur der Vereinsadministrator darf eine administrative Stellvertretung vergeben oder ändern.");
    expect(router).toContain("isDelegatedTenantAdministratorAccess(existing)");
    expect(router).toContain("requirePrimaryTenantAdministrator(ctx.user)");
    expect(router).toContain("function isPrimaryTenantAdministrator");
    expect(router).toContain("async function isDelegatedTenantAdministrator");
    expect(router).toContain("user.openId.startsWith(\"tenant-admin:\")");
    expect(router).toContain("isPrimaryTenantAdmin: isPrimaryTenantAdministrator(ctx.user)");
    expect(router).toContain("isDelegatedTenantAdmin: await isDelegatedTenantAdministrator(ctx.user)");
  });

  it("kennzeichnet die Rolle rot und sperrt ihre Verwaltung für andere Stellvertretungen", () => {
    const manager = source("client/src/components/PlanningTeamAccessManager.tsx");
    const security = source("client/src/pages/Security.tsx");
    const layout = source("client/src/components/Layout.tsx");

    expect(manager).toContain("Vereinsadministrator-Stellvertretung");
    expect(manager).toContain("border-2 border-red-500 bg-red-50");
    expect(manager).toContain("disabled={access.isTenantAdmin && !isPrimaryTenantAdmin}");
    expect(manager).toContain("Alle Veranstaltungen dieses Vereins");
    expect(manager).toContain('user?.openId.startsWith("planning-team-access-")');
    expect(security).toContain("administrativeContext.data?.isTenantAdmin === true");
    expect(security).toContain(
      "administrativeContext.data?.isPrimaryTenantAdmin === true"
    );
    expect(security).toContain("administrativeContext.data?.isDelegatedTenantAdmin === true");
    expect(security).toContain('user?.openId.startsWith("planning-team-access-")');
    expect(security).toContain("{isPrimaryTenantAdmin && (");
    expect(layout).toContain("Vereinsadministrator-Stellvertretung");
    expect(layout).toContain("Hauptvereinsadministrator");
    expect(layout).toContain("administrativeContext.data?.isDelegatedTenantAdmin === true");
    expect(layout).toContain("visibleNavigationSections(effectiveNavigationRole");
  });
});
