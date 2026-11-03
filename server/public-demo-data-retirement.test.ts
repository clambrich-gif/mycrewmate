import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
// Keine Verbindung beim Import: die CLI startet nur bei direktem Aufruf.
// @ts-ignore Standalone-ESM-Skript ohne separate Typdatei.
import { mode, technicalUser, sqlValue, tenantPlan, userPlan, deletionOrder } from "../scripts/retire-public-demo-data.mjs";

const marker = "Automatisch angelegte, temporäre öffentliche Vereinsdemo";
const tenantId = "mycrewmate-demo-fixture";
const user = { id: 1, openId: "tenant-admin:demo-session-fixture@beispiel.invalid", email: "demo-session-fixture@beispiel.invalid" };
function fixture() {
  const data: Record<string, any[]> = {
    tenants: [{ id: tenantId, status: "sample" }],
    users: [{ ...user }],
    tenant_product_assignments: [{ tenantId, internalNote: marker, eventId: 10 }],
    user_tenant_memberships: [{ userId: 1, tenantId, role: "tenant_admin" }],
    tenant_admin_credentials: [{ userId: 1, email: user.email }],
    events: [{ id: 10, tenantId, year: 2027 }],
    contacts: [{ id: 20, eventId: 10 }],
    helpers: [], protected_helper_pdf_shares: [],
    planning_team_accesses: [], planning_team_access_events: [], planning_team_invitations: [],
    activity_logs: [{ id: 30, tenantId, eventId: 10, actorUserId: 1 }],
    backup_restore_logs: [{ id: 31, eventId: 10, actorUserId: 1 }],
    event_years: [{ year: 2027 }], mfa_login_challenges: [],
  };
  const required: Record<string, string[]> = {
    activity_logs: ["tenantId", "eventId", "actorUserId"],
    planning_team_accesses: ["id", "contactId"],
    planning_team_access_events: ["accessId", "eventId"],
    planning_team_invitations: ["accessId", "tenantId"],
  };
  const tables = new Map(Object.entries(data).map(([name, rows]) => [name, {
    rows, columns: [...new Set([...rows.flatMap(Object.keys), ...required[name] ?? []])].map(name => ({ name, extra: "" })),
  }]));
  const fk = (child: string, parent: string, column: string, parentColumn = "id", rule = "CASCADE") => ({ child, parent, rule, parts: [{ column, parentColumn }] });
  const fks = [fk("events", "tenants", "tenantId", "id", "RESTRICT"), fk("contacts", "events", "eventId"), fk("activity_logs", "events", "eventId", "id", "SET NULL"), fk("backup_restore_logs", "events", "eventId", "id", "SET NULL"), fk("planning_team_access_events", "events", "eventId"), fk("planning_team_access_events", "planning_team_accesses", "accessId")];
  return { tables, fks, data, fk };
}

describe("Einmalige öffentliche Demo-Datenbereinigung (ohne DB)", () => {
  it("ist standardmäßig dry-run und verlangt ein eindeutiges Apply-Flag", () => {
    expect(mode([])).toBe(false);
    expect(mode(["--dry-run"])).toBe(false);
    expect(mode(["--apply"])).toBe(true);
    for (const args of [["--force"], ["--apply", "--dry-run"], ["--apply", "--apply"]]) expect(() => mode(args)).toThrow();
  });
  it("akzeptiert ausschließlich exakte technische Identitäten und passende Credentials", () => {
    expect(technicalUser(user)).toBe(true);
    for (const openId of ["tenant-admin:demo-session-x@example.org", user.openId + ".real", user.openId.toUpperCase(), "tenant-admin:demo-session-@beispiel.invalid", "planning-team-access-1"]) expect(technicalUser({ ...user, openId })).toBe(false);
    expect(technicalUser({ ...user, email: "real@example.org" })).toBe(false);
    expect(technicalUser(user, [{ email: "real@example.org" }])).toBe(false);
  });
  it("sichert SQL-Sonderzeichen, Null, Zahlen und Binärdaten verlustfrei", () => {
    expect(sqlValue(null)).toBe("NULL");
    expect(sqlValue(Buffer.from([0, 39, 255]))).toBe("X'0027ff'");
    expect(sqlValue("a'b\\c\n\0")).toBe("'a\\'b\\\\c\\n\\0'");
    expect(sqlValue(42)).toBe("42");
    expect(sqlValue("9007199254740993")).toBe("'9007199254740993'");
    expect(() => sqlValue(NaN)).toThrow();
    expect(() => sqlValue(undefined)).toThrow();
  });
  it("plant ausschließlich markierte Demo-Tenants und lässt globale Jahre unangetastet", () => {
    const { tables, fks, data } = fixture();
    const result = tenantPlan(tenantId, tables, fks);
    expect(result.reason).toBeUndefined();
    expect(result.plan.has("event_years")).toBe(false);
    expect(result.plan.get("backup_restore_logs").size).toBe(1);
    data.tenants[0].status = "active";
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("identity_markers_missing");
    data.tenants[0].status = "sample"; data.tenant_product_assignments[0].internalNote = "";
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("identity_markers_missing");
  });
  it("überspringt reale Admins, geteilte Mitgliedschaften und echte Akteure", () => {
    const { tables, fks, data } = fixture();
    data.users[0].openId = "tenant-admin:real@example.org";
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("real_or_shared_membership");
    data.users[0].openId = user.openId;
    data.user_tenant_memberships.push({ userId: 1, tenantId: "real-club", role: "planner" });
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("real_or_shared_membership");
    data.user_tenant_memberships.pop();
    data.users.push({ id: 2, openId: "real-person" }); data.activity_logs[0].actorUserId = 2;
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("real_account_reference");
  });
  it("überspringt fremde Planungsteam-Freigaben und persönliche Planungskonten", () => {
    const { tables, fks, data } = fixture();
    data.planning_team_accesses.push({ id: 40, contactId: 20 });
    data.planning_team_access_events.push({ accessId: 40, eventId: 99 });
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("foreign_planning_access");
    data.planning_team_access_events[0].eventId = 10;
    data.users.push({ id: 2, openId: "planning-team-access-40" });
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("foreign_planning_access");
  });
  it("überspringt Fremdvereinsprotokolle, statt SET NULL oder Kaskaden dort auszulösen", () => {
    const { tables, fks, data } = fixture();
    data.activity_logs.push({ id: 32, tenantId: "real-club", eventId: 10 });
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("foreign_or_ambiguous_reference");
  });
  it("prüft auch indirekte Fremdverweise auf Demo-Kontakte", () => {
    const { tables, fks, data, fk } = fixture();
    data.planning_team_accesses.push({ id: 40, contactId: 99 });
    data.planning_team_access_events.push({ accessId: 40, eventId: 10 });
    fks.push(fk("planning_team_accesses", "contacts", "contactId"));
    expect(tenantPlan(tenantId, tables, fks).reason).toBe("foreign_planning_access");
  });
  it("löscht technische Orphans nur ohne restliche Mitgliedschaften oder fremde Bezüge", () => {
    const { tables, fks, data } = fixture();
    expect(userPlan(data.users[0], tables, fks, new Map())).toBeNull();
    const removed = tenantPlan(tenantId, tables, fks).plan;
    expect(userPlan(data.users[0], tables, fks, removed)).not.toBeNull();
    data.activity_logs.push({ id: 32, tenantId: "real-club", eventId: 99, actorUserId: 1 });
    expect(userPlan(data.users[0], tables, fks, removed)).toBeNull();
    data.activity_logs.pop(); data.tenant_admin_credentials[0].email = "real@example.org";
    expect(userPlan(data.users[0], tables, fks, removed)).toBeNull();
  });
  it("ordnet SET-NULL-Reste vor Events und Events vor Tenants und lehnt FK-Zyklen ab", () => {
    const { tables, fks, fk } = fixture();
    const order = deletionOrder(tenantPlan(tenantId, tables, fks).plan.keys(), fks);
    expect(order.indexOf("activity_logs")).toBeLessThan(order.indexOf("events"));
    expect(order.indexOf("backup_restore_logs")).toBeLessThan(order.indexOf("events"));
    expect(order.indexOf("events")).toBeLessThan(order.indexOf("tenants"));
    expect(() => deletionOrder(["a", "b"], [fk("a", "b", "id"), fk("b", "a", "id")])).toThrow();
  });
  it("behält Backup-, Durability-, Scoped-Delete- und Datenschutzschutz im CLI", () => {
    const code = readFileSync(path.resolve(process.cwd(), "scripts/retire-public-demo-data.mjs"), "utf8");
    expect(code).toContain("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    expect(code).toContain("SHOW CREATE TABLE"); expect(code).toContain("SELECT * FROM");
    expect(code).toContain("information_schema.COLUMNS"); expect(code).toContain("information_schema.KEY_COLUMN_USAGE");
    expect(code).toContain("0o600"); expect(code).toContain("output.sync()");
    expect(code.indexOf("await output.sync()")).toBeLessThan(code.indexOf("await db.beginTransaction()"));
    expect(code).toContain("SERIALIZABLE"); expect(code).toContain("database_changed_since_backup");
    expect(code).toContain("remainingMembership) !== 0"); expect(code).toContain("q(c.name) + ' <=> ?'");
    expect(code).toContain(".file-keys.json"); expect(code).toContain("uploadsDeleted: false");
    expect(code).not.toContain("storageDelete"); expect(code).not.toContain("console.error(error");
    expect(code).not.toMatch(/db\.query\([^\n]*(?:ALTER TABLE|DROP TABLE|TRUNCATE|SET FOREIGN_KEY_CHECKS)/);
  });
});
