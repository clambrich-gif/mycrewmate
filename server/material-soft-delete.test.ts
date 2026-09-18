import { describe, expect, it } from "vitest";
import {
  getDb,
  createMaterial,
  listMaterials,
  deleteMaterial,
  restoreDeletionAuditLog,
  listDeletionAuditLogs,
} from "./db";
import { materials, deletionAuditLogs } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { withPlanningScope } from "./year-context";

describe("Material-Softdelete und Löschprotokoll", () => {
  it("verschiebt gelöschte Materialartikel ins Löschprotokoll und erlaubt die administrative Wiederherstellung", async () => {
    const db = await getDb();
    if (!db) {
      console.warn("Keine Datenbankverbindung für Material-Softdelete-Test verfügbar");
      return;
    }

    const testEventYear = 2027;
    const testEventId = 1020001; // MyEifelRide 2027

    await withPlanningScope({ year: testEventYear, eventId: testEventId }, async () => {
      // 1. Artikel anlegen
      const created: any = await createMaterial({
        article: "Biertischgarnituren (Test-Softdelete)",
        category: "Möbel & Zelte",
        quantity: "15",
        unit: "Garnituren",
        ordered: "nein",
        note: "Für Festwiese bereithalten",
      });

      const materialId = Number(created?.id ?? created?.[0]?.id ?? created?.insertId ?? created?.[0]?.insertId);
      expect(materialId).toBeGreaterThan(0);

      try {
        // 2. In listMaterials sichtbar
        const beforeDelete = await listMaterials();
        expect(beforeDelete.some(item => item.id === materialId)).toBe(true);

        // 3. Soft-Delete durchführen mit verantwortlichem Ansprechpartner
        await deleteMaterial(materialId, {
          actor: {
            userId: 1,
            name: "Administrator",
            role: "admin",
            loginMethod: "admin-password",
            responsibleContactId: 101,
            responsibleContactName: "Christian Lambrich",
          },
        });

        // 4. In listMaterials nicht mehr sichtbar
        const afterDelete = await listMaterials();
        expect(afterDelete.some(item => item.id === materialId)).toBe(false);

        // 5. In der Datenbank mit deleted = true vorhanden
        const [rawRow] = await (db as any)
          .select()
          .from(materials)
          .where(eq(materials.id, materialId))
          .limit(1);
        expect(rawRow).toBeDefined();
        expect(rawRow.deleted).toBe(true);

        // 6. Im Löschprotokoll auffindbar
        const auditLogs = await listDeletionAuditLogs({
          eventYear: testEventYear,
          eventId: testEventId,
          entityType: "material",
          limit: 10,
        });
        const matchingLog = auditLogs.find(log => log.entityId === materialId);
        expect(matchingLog).toBeDefined();
        expect(matchingLog?.responsibleContactName).toBe("Christian Lambrich");
        expect(matchingLog?.entityType).toBe("material");
        expect(matchingLog?.restoredAt).toBeNull();

        // 7. Administrative Wiederherstellung
        const restoreResult = await restoreDeletionAuditLog(matchingLog!.id, {
          userId: 1,
          name: "Administrator",
        });
        expect(restoreResult.entityType).toBe("material");

        // 8. Wieder in listMaterials aktiv sichtbar
        const afterRestore = await listMaterials();
        const restoredItem = afterRestore.find(item => item.id === materialId);
        expect(restoredItem).toBeDefined();
        expect(restoredItem?.article).toBe("Biertischgarnituren (Test-Softdelete)");

        // 9. Im Protokoll als wiederhergestellt vermerkt
        const auditLogsAfterRestore = await listDeletionAuditLogs({
          eventYear: testEventYear,
          eventId: testEventId,
          entityType: "material",
          limit: 10,
        });
        const updatedLog = auditLogsAfterRestore.find(log => log.id === matchingLog!.id);
        expect(updatedLog?.restoredAt).not.toBeNull();
        expect(updatedLog?.restoredByName).toBe("Administrator");
      } finally {
        await (db as any).delete(deletionAuditLogs).where(
          and(eq(deletionAuditLogs.entityType, "material"), eq(deletionAuditLogs.entityId, materialId))
        );
        await (db as any).delete(materials).where(eq(materials.id, materialId));
      }
    });
  });
});
