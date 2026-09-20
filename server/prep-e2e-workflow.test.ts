import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  createPlanningTeamAccess,
  deletePlanningTeamAccess,
  getDb,
} from "./db";
import { prepTasks, deletionAuditLogs } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { hashPassword, planningTeamAccessOpenId } from "./password-auth";

const TEAM_USER = {
  id: 240001,
  openId: "shared-password-user",
  name: "Planungsteam",
  email: null,
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const ADMIN_USER = {
  id: 1110009,
  openId: "shared-password-admin",
  name: "Administrator",
  email: null,
  loginMethod: "admin-password",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(user: any) {
  return {
    user,
    req: {
      protocol: "https",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        "x-event-year": "2027",
        "x-event-id": "1020001",
      },
      socket: { remoteAddress: "127.0.0.1" },
    },
    res: {},
  } as any;
}

describe("E2E Planungsteam-Rechte & Löschprotokoll-Workflow", () => {
  it("erlaubt dem Planungsteam vollständige Bearbeitung und Löschung, und dem Administrator die Wiederherstellung", async () => {
    const db = await getDb();
    if (!db) throw new Error("Keine Datenbankverbindung");

    const testAccess = await createPlanningTeamAccess({
      label: `E2E-Planungsteam-${Date.now()}`,
      passwordHash: await hashPassword("E2E-Planungsteam-Passwort!"),
      eventIds: [1020001],
    });
    const teamCaller = appRouter.createCaller(
      createContext({
        ...TEAM_USER,
        openId: planningTeamAccessOpenId(testAccess.id),
      })
    );
    const adminCaller = appRouter.createCaller(createContext(ADMIN_USER));

    // 1. Planungsteam legt eine neue Vorbereitungsaufgabe an
    const created: any = await teamCaller.prep.create({
      task: "Sicherheitskonzept Rettungsdienst E2E",
      category: "Sicherheit",
      dueText: "25.09.2027",
      note: "Erster Entwurf liegt vor",
    });

    const prepId = Number(created?.id ?? created?.[0]?.id ?? created?.insertId ?? created?.[0]?.insertId);
    expect(prepId).toBeGreaterThan(0);

    try {
      // 2. Planungsteam bearbeitet alle Felder der Aufgabe
      await teamCaller.prep.update({
        id: prepId,
        task: "Sicherheitskonzept Rettungsdienst E2E (Final)",
        category: "Strecke & Sicherheit",
        dueText: "26.09.2027",
        status: "inArbeit",
        statusWording: "aufgabe",
        logEntry: "Mit Einsatzleitung DRK abgestimmt",
      });

      // Verifizieren, dass die Bearbeitung aktiv sichtbar ist
      const activeList = await teamCaller.prep.list();
      const updated = activeList.find((t: any) => t.id === prepId);
      expect(updated).toBeDefined();
      expect(updated?.task).toBe("Sicherheitskonzept Rettungsdienst E2E (Final)");
      expect(updated?.status).toBe("inArbeit");
      expect(updated?.note).toContain("Mit Einsatzleitung DRK abgestimmt");

      // 3. Planungsteam löscht die Aufgabe mit Auswahl des Ansprechpartners Christian Lambrich
      const contacts = await teamCaller.contacts.list();
      const contact = contacts[0] ?? { id: 101, name: "Christian Lambrich" };
      await teamCaller.prep.remove({
        id: prepId,
        responsibleContactId: contact.id,
      });

      // 4. Aufgabe ist für das Planungsteam aus der aktiven Liste verschwunden
      const afterDeleteList = await teamCaller.prep.list();
      expect(afterDeleteList.some((t: any) => t.id === prepId)).toBe(false);

      // 5. Planungsteam hat KEINEN Zugriff auf das Löschprotokoll (FORBIDDEN)
      await expect(
        teamCaller.audit.deletions({ limit: 10 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      // 6. Administrator öffnet das Löschprotokoll und findet den Eintrag
      const auditLogs = await adminCaller.audit.deletions({
        eventYear: 2027,
        eventId: 1020001,
        entityType: "prep",
        limit: 10,
      });

      const auditEntry = auditLogs.find((entry: any) => entry.entityId === prepId);
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.responsibleContactName).toBe(contact.name);
      expect(auditEntry?.entityType).toBe("prep");
      expect(auditEntry?.restoredAt).toBeNull();
      expect(auditEntry?.entityLabel).toContain("Sicherheitskonzept Rettungsdienst E2E (Final)");

      // 7. Administrator stellt den Eintrag wieder her
      const restoreResult = await adminCaller.audit.restore({ id: auditEntry!.id });
      expect(restoreResult.entityType).toBe("prep");

      // 8. Aufgabe ist für das Planungsteam sofort wieder in der aktiven Liste sichtbar
      const afterRestoreList = await teamCaller.prep.list();
      const restored = afterRestoreList.find((t: any) => t.id === prepId);
      expect(restored).toBeDefined();
      expect(restored?.task).toBe("Sicherheitskonzept Rettungsdienst E2E (Final)");

      // 9. Protokolleintrag ist als wiederhergestellt markiert
      const auditLogsAfterRestore = await adminCaller.audit.deletions({
        eventYear: 2027,
        eventId: 1020001,
        entityType: "prep",
        limit: 10,
      });
      const restoredAuditEntry = auditLogsAfterRestore.find((entry: any) => entry.id === auditEntry!.id);
      expect(restoredAuditEntry?.restoredAt).not.toBeNull();
      expect(restoredAuditEntry?.restoredByName).toBe("Administrator");
    } finally {
      // Testdaten rückstandslos bereinigen
      await (db as any).delete(deletionAuditLogs).where(
        and(eq(deletionAuditLogs.entityType, "prep"), eq(deletionAuditLogs.entityId, prepId))
      );
      await (db as any).delete(prepTasks).where(eq(prepTasks.id, prepId));
      await deletePlanningTeamAccess(testAccess.id);
    }
  });
});
