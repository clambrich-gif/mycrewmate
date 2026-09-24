import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";

const requestWithForeignBrowserScope = {
  headers: {
    "x-tenant-id": "rsc-eifelland-mayen",
    "x-event-year": "2026",
    "x-event-id": "1",
  },
  socket: { remoteAddress: "127.0.0.1" },
} as any;

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Mandantentrennung von Sicherheits- und Aktivitätsprotokollen", () => {
  it("protokolliert eine persönliche Vereinsadmin-Anmeldung im serverbestätigten Verein statt im alten Browserkontext", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      planningTeamLocked: false,
    } as any);
    vi.spyOn(db, "getTenantAdminCredentialsByEmail").mockResolvedValue({
      userId: 818,
      userOpenId: "tenant-admin:rsv-musterstadt.admin@example.invalid",
      userName: "Mara Musterstadt",
      passwordHash: "$2a$10$hashedMusterstadt",
      sessionVersion: 1,
      mustChangePassword: false,
      status: "active",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
      tenantId: "rsv-musterstadt",
      role: "tenant_admin",
      isDefault: true,
      tenantName: "RSV Musterstadt Pilot",
      tenantStatus: "pilot",
    });
    const activityLog = vi
      .spyOn(db, "recordActivityLog")
      .mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller({
      user: null,
      req: requestWithForeignBrowserScope,
      res: { cookie: vi.fn(), setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(
      caller.auth.passwordLogin({
        email: "rsv-musterstadt.admin@example.invalid",
        password: "Musterstadt-sicher-123",
      })
    ).resolves.toMatchObject({
      success: true,
      tenantId: "rsv-musterstadt",
    });

    expect(activityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Zugangsschutz",
        subject: "Vereinsadministrator-Anmeldung erfolgreich",
        tenantId: "rsv-musterstadt",
      })
    );
  });

  it("bindet alle Lese-, Leer- und Wiederherstellungswege serverseitig an die Vereins-ID", () => {
    const database = source("server/db.ts");

    expect(database).toContain("eq(activityLogs.tenantId, tenant())");
    expect(database).toContain("eq(deletionAuditLogs.tenantId, tenant())");
    expect(database).toContain("tenantId: validTenantId");
    expect(database).toContain("tenantId: tenant(),");
    expect(database).toContain("eq(events.tenantId, tenant())");
  });

  it("ordnet historische Einträge anhand ihrer Veranstaltung zu und blendet reine Plattformvorgänge aus Vereinslogbüchern aus", () => {
    const migration = source("drizzle/0061_tenant_scoped_audit_logs.sql");
    const schema = source("drizzle/schema.ts");

    expect(migration).toContain("UPDATE `activity_logs` AS `log`");
    expect(migration).toContain("UPDATE `deletion_audit_logs` AS `log`");
    expect(migration).toContain("SET `log`.`tenantId` = `event`.`tenantId`");
    expect(migration).toContain("SET `tenantId` = NULL");
    expect(schema).toContain("activity_logs_tenant_created_idx");
    expect(schema).toContain("deletion_audit_logs_tenant_created_idx");
  });
});
