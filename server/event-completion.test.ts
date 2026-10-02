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
    expect(db).toContain('export async function listEventClosureRecommendations');
    expect(db).toContain('lt(events.endDate, today)');
    expect(db).toContain('isNotNull(events.endDate)');
    expect(db).toContain('eq(events.status, "active")');
    expect(db).toContain('async function assertCurrentProductEventCapacity');
    expect(db).toContain('export async function closeEvent');
    expect(db).toContain('export async function reopenEvent');
    expect(db).toContain('await assertCurrentProductEventCapacity(tx, selected.year)');
  });

  it("stellt Abschluss und Wiederöffnung nur Vereinsadministratoren bereit", () => {
    const router = source("server/routers.ts");

    expect(router).toContain('manage: scopeAdminAuthProcedure.query(() => db.listEventsForManagement())');
    expect(router).toContain('closureRecommendations: scopeAdminAuthProcedure.query(() =>');
    expect(router).toContain('db.listEventClosureRecommendations()');
    expect(router).toContain('close: scopeAdminAuthProcedure');
    expect(router).toContain('reopen: scopeAdminAuthProcedure');
    expect(router).toContain('db.closeEvent(input.id)');
    expect(router).toContain('db.reopenEvent(input.id)');
  });

  it("widerruft beim Abschluss ausschließlich eventbezogene Zugänge und PDF-Freigaben", () => {
    const db = source("server/db.ts");
    const layout = source("client/src/components/Layout.tsx").replace(/\s+/g, " ");

    expect(db).toContain('.delete(planningTeamAccessEvents)');
    expect(db).toContain('eq(planningTeamAccessEvents.eventId, id)');
    expect(db).toContain('.update(protectedHelperPdfShares)');
    expect(db).toContain('protectedHelperPdfShares.helperId');
    expect(db).toContain('eq(helpers.eventId, id)');
    expect(db).toContain('revokedPdfShares');
    expect(layout).toContain('Alle eventbezogenen Planungsteam-Freigaben');
    expect(layout).toContain('sieben-Tage-PDF-Links werden sofort widerrufen');
    expect(layout).toContain('andere aktive Veranstaltungen des Vereins');
  });

  it("macht Historie und Gesamtansicht im Layout und Master-Admin verständlich", () => {
    const layout = source("client/src/components/Layout.tsx");
    const masterPortal = source("client/src/pages/MasterAdminPortal.tsx");

    expect(layout).toContain('Veranstaltung abschließen?');
    expect(layout).toContain('Abgeschlossen · nur Historie');
    expect(layout).toContain('Wieder öffnen');
    expect(masterPortal).toContain('Nur aktive Events zählen');
    expect(masterPortal).toContain('Verein gesamt:');
    expect(masterPortal).toContain("Co-Admins zusätzlich");
  });

  it("weist vor der Wiedereröffnung auf weiterhin widerrufene Freigaben hin", () => {
    const layout = source("client/src/components/Layout.tsx").replace(/\s+/g, " ");

    expect(layout).toContain("reopenEventTarget");
    expect(layout).toContain("Veranstaltung wieder öffnen?");
    expect(layout).toContain("keine früheren Planungsteam-Freigaben");
    expect(layout).toContain("sieben-Tage-PDF-Links reaktiviert");
    expect(layout).toContain("Zugänge und PDF-Links bleiben aus Sicherheitsgründen widerrufen");
  });

  it("erlaubt eine dokumentierte Aufbewahrungsausnahme und bereinigt abgelaufene Events", () => {
    const schema = source("drizzle/schema.ts");
    const db = source("server/db.ts");
    const layout = source("client/src/components/Layout.tsx");

    expect(schema).toContain('retentionHoldReason: mysqlEnum("retentionHoldReason"');
    expect(schema).toContain('retentionHoldNote: varchar("retentionHoldNote"');
    expect(schema).toContain('retentionHoldSetAt: timestamp("retentionHoldSetAt")');
    expect(db).toContain("export const CLOSED_EVENT_RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;");
    expect(db).toContain("export async function cleanupExpiredClosedEvents");
    expect(db).toContain("isNull(events.retentionHoldReason)");
    expect(layout).toContain("Aufbewahrungsausnahme (nur bei dokumentierter Pflicht)");
  });
});
