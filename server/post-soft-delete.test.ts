import { describe, expect, it } from "vitest";
import {
  getDb,
  createPost,
  listPost,
  deletePost,
  restoreDeletionAuditLog,
  listDeletionAuditLogs,
} from "./db";
import { postTasks, deletionAuditLogs } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { withPlanningScope } from "./year-context";

describe("Nachbereitungs-Softdelete und Löschprotokoll", () => {
  it("verschiebt gelöschte Nachbereitungsaufgaben ins Löschprotokoll und erlaubt die administrative Wiederherstellung", async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Keine Datenbankverbindung für Nachbereitungs-Softdelete-Test verfügbar");
      return;
    }

    const testEventYear = 2027;
    const testEventId = 1020001; // MyEifelRide 2027

    await withPlanningScope({
      tenantId: "rsc-eifelland-mayen",
      year: testEventYear,
      eventId: testEventId,
    }, async () => {
      // 1. Aufgabe anlegen mit Bereich, Frist und Notiz
      const created: any = await createPost({
        task: "Kühlwagen reinigen und zurückgeben (Test-Softdelete)",
        category: "Catering & Logistik",
        dueText: "22.09.2027",
        note: "Test-Logbucheintrag zur Nachbereitung",
        logEntryAuthor: "Christian",
      });

      const postId = Number(created?.id ?? created?.[0]?.id ?? created?.insertId ?? created?.[0]?.insertId);
      expect(postId).toBeGreaterThan(0);

      try {
        // 2. In listPost sichtbar
        const beforeDelete = await listPost();
        expect(beforeDelete.some(task => task.id === postId)).toBe(true);

        // 3. Soft-Delete durchführen mit Ansprechpartner "Christian Lambrich"
        await deletePost(postId, {
          actor: {
            userId: 2,
            name: "Christian",
            role: "user",
            loginMethod: "password",
            responsibleContactId: 101,
            responsibleContactName: "Christian Lambrich",
          },
        });

        // 4. In listPost nicht mehr sichtbar
        const afterDelete = await listPost();
        expect(afterDelete.some(task => task.id === postId)).toBe(false);

        // 5. In der Datenbank mit deleted = true vorhanden
        const [rawRow] = await (db as any)
          .select()
          .from(postTasks)
          .where(eq(postTasks.id, postId))
          .limit(1);
        expect(rawRow).toBeDefined();
        expect(rawRow.deleted).toBe(true);

        // 6. Im Löschprotokoll auffindbar
        const auditLogs = await listDeletionAuditLogs({
          eventYear: testEventYear,
          eventId: testEventId,
          entityType: "post",
          limit: 10,
        });
        const matchingLog = auditLogs.find(log => log.entityId === postId);
        expect(matchingLog).toBeDefined();
        expect(matchingLog?.responsibleContactName).toBe("Christian Lambrich");
        expect(matchingLog?.entityType).toBe("post");
        expect(matchingLog?.restoredAt).toBeNull();

        // 7. Administrative Wiederherstellung
        const restoreResult = await restoreDeletionAuditLog(matchingLog!.id, {
          userId: 1,
          name: "Administrator",
        });
        expect(restoreResult.entityType).toBe("post");

        // 8. Wieder in listPost aktiv sichtbar
        const afterRestore = await listPost();
        const restoredTask = afterRestore.find(task => task.id === postId);
        expect(restoredTask).toBeDefined();
        expect(restoredTask?.task).toBe("Kühlwagen reinigen und zurückgeben (Test-Softdelete)");

        // 9. Im Protokoll als wiederhergestellt vermerkt
        const auditLogsAfterRestore = await listDeletionAuditLogs({
          eventYear: testEventYear,
          eventId: testEventId,
          entityType: "post",
          limit: 10,
        });
        const updatedLog = auditLogsAfterRestore.find(log => log.id === matchingLog!.id);
        expect(updatedLog?.restoredAt).not.toBeNull();
        expect(updatedLog?.restoredByName).toBe("Administrator");
      } finally {
        await (db as any).delete(deletionAuditLogs).where(
          and(eq(deletionAuditLogs.entityType, "post"), eq(deletionAuditLogs.entityId, postId))
        );
        await (db as any).delete(postTasks).where(eq(postTasks.id, postId));
      }
    });
  });
});
