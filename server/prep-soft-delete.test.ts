import { describe, expect, it } from "vitest";
import { getDb, createPrep, listPrep, deletePrep, restoreDeletionAuditLog, listDeletionAuditLogs } from "./db";
import { prepTasks, deletionAuditLogs } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { withPlanningScope } from "./year-context";

describe("Vorbereitungs-Softdelete und Löschprotokoll", () => {
  it("verschiebt gelöschte Vorbereitungen ins Löschprotokoll und erlaubt die administrative Wiederherstellung", async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Keine Datenbankverbindung für Vorbereitungs-Softdelete-Test verfügbar");
      return;
    }

    const testEventYear = 2027;
    const testEventId = 1020001; // MyEifelRide 2027

    await withPlanningScope({ year: testEventYear, eventId: testEventId }, async () => {
      // Aufgabe für den Test anlegen
      const created: any = await createPrep({
        task: "Test-Genehmigung VP8 Softdelete",
        category: "Strecke & Sicherheit",
        dueText: "20.09.2027",
        note: "Test-Logbuch für Softdelete",
        status: "offen",
        statusWording: "aufgabe",
        logEntryAuthor: "Christian",
      });

      const prepId = Number(created?.id ?? created?.[0]?.id ?? created?.insertId ?? created?.[0]?.insertId);
      expect(prepId).toBeGreaterThan(0);

      try {
        // 1. Aufgabe ist in listPrep sichtbar
        const beforeDelete = await listPrep();
        expect(beforeDelete.some(task => task.id === prepId)).toBe(true);

        // 2. Soft-Delete durchführen mit Name "Christian"
        await deletePrep(prepId, {
          actor: {
            userId: 2,
            name: "Christian",
            role: "user",
            loginMethod: "password",
          },
        });

        // 3. Aufgabe ist in listPrep NICHT mehr sichtbar
        const afterDelete = await listPrep();
        expect(afterDelete.some(task => task.id === prepId)).toBe(false);

        // 4. In der Datenbank existiert die Zeile mit deleted = true
        const [rawRow] = await (db as any)
          .select()
          .from(prepTasks)
          .where(eq(prepTasks.id, prepId))
          .limit(1);
        expect(rawRow).toBeDefined();
        expect(rawRow.deleted).toBe(true);

        // 5. Im Löschprotokoll existiert der passende Eintrag
        const auditLogs = await listDeletionAuditLogs({
          eventYear: testEventYear,
          eventId: testEventId,
          entityType: "prep",
          limit: 10,
        });
        const matchingLog = auditLogs.find(log => log.entityId === prepId);
        expect(matchingLog).toBeDefined();
        expect(matchingLog?.actorName).toBe("Christian");
        expect(matchingLog?.entityType).toBe("prep");
        expect(matchingLog?.restoredAt).toBeNull();

        // 6. Administrative Wiederherstellung
        const restoreResult = await restoreDeletionAuditLog(matchingLog!.id, {
          userId: 1,
          name: "Administrator",
        });
        expect(restoreResult.entityType).toBe("prep");

        // 7. Aufgabe ist wieder in listPrep aktiv sichtbar
        const afterRestore = await listPrep();
        const restoredTask = afterRestore.find(task => task.id === prepId);
        expect(restoredTask).toBeDefined();
        expect(restoredTask?.task).toBe("Test-Genehmigung VP8 Softdelete");

        // 8. Protokolleintrag ist als wiederhergestellt markiert
        const auditLogsAfterRestore = await listDeletionAuditLogs({
          eventYear: testEventYear,
          eventId: testEventId,
          entityType: "prep",
          limit: 10,
        });
        const updatedLog = auditLogsAfterRestore.find(log => log.id === matchingLog!.id);
        expect(updatedLog?.restoredAt).not.toBeNull();
        expect(updatedLog?.restoredByName).toBe("Administrator");
      } finally {
        // Test-Datensatz aufräumen
        await (db as any).delete(deletionAuditLogs).where(
          and(eq(deletionAuditLogs.entityType, "prep"), eq(deletionAuditLogs.entityId, prepId))
        );
        await (db as any).delete(prepTasks).where(eq(prepTasks.id, prepId));
      }
    });
  });
});
