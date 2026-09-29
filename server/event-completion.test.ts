import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Veranstaltungsabschluss und Paket-Auslastung", () => {
  it("speichert einen reversiblen Abschlussstatus direkt an der Veranstaltung", () => {
    const schema = source("drizzle/schema.ts");

    expect(schema).toContain('mysqlEnum("status", ["active", "closed"])');
    expect(schema).toContain('closedAt: timestamp("closedAt")');
  });

  it("nimmt abgeschlossene Veranstaltungen aus aktiver Auswahl und Jahreslimits heraus", () => {
    const db = source("server/db.ts");

    expect(db).toContain('export async function listEventsForManagement');
    expect(db).toContain('eq(events.status, "active")');
    expect(db).toContain('async function assertCurrentProductEventCapacity');
    expect(db).toContain('export async function closeEvent');
    expect(db).toContain('export async function reopenEvent');
    expect(db).toContain('await assertCurrentProductEventCapacity(tx, selectedYear)');
  });

  it("stellt Abschluss und Wiederöffnung nur Vereinsadministratoren bereit", () => {
    const router = source("server/routers.ts");

    expect(router).toContain('manage: scopeAdminAuthProcedure.query(() => db.listEventsForManagement())');
    expect(router).toContain('close: scopeAdminAuthProcedure');
    expect(router).toContain('reopen: scopeAdminAuthProcedure');
    expect(router).toContain('db.closeEvent(input.id)');
    expect(router).toContain('db.reopenEvent(input.id)');
  });

  it("macht Historie und Gesamtansicht im Layout und Master-Admin verständlich", () => {
    const layout = source("client/src/components/Layout.tsx");
    const masterPortal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(layout).toContain('Veranstaltung abschließen?');
    expect(layout).toContain('Abgeschlossen · nur Historie');
    expect(layout).toContain('Wieder öffnen');
    expect(masterPortal).toContain('Nur aktive Events zählen');
    expect(masterPortal).toContain('Verein gesamt:');
    expect(masterPortal).toContain('Co-Admins zusätzlich');
  });
});
