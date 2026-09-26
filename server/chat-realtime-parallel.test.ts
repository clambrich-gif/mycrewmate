import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { planningTeamAccessOpenId } from "./password-auth";
import { withPlanningScope } from "./year-context";
import type { TrpcContext } from "./_core/context";

const TEST_TENANT_ID = "rsc-eifelland-mayen";

function makeScopedContext(user: any, eventId: number, eventYear: number): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {
        host: "app.mycrewmate.de",
        "x-planning-tenant-id": TEST_TENANT_ID,
        "x-event-year": String(eventYear),
        "x-event-id": String(eventId),
      },
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Punkt 3: Zwei parallele Sitzungen im Teamchat mit Echtzeitabgleich", () => {
  it("synchronisiert Nachrichten verzögerungsfrei zwischen Planer und Administrator ohne Ladeblockade", async () => {
    const adminUser = {
      id: 0,
      openId: "test-admin-e2e-chat",
      name: "Vereinsadmin Chat",
      role: "admin" as const,
    };
    const bootstrapCtx = makeScopedContext(adminUser, 0, 2027);
    const bootstrapCaller = appRouter.createCaller(bootstrapCtx);
    const events = await bootstrapCaller.events.all();
    const targetEvent = events[0];
    expect(targetEvent).toBeDefined();

    const uniqueSuffix = Date.now();
    const testEmail = `chat.partner.${uniqueSuffix}@example.org`;

    const adminCtx = makeScopedContext(adminUser, targetEvent!.id, targetEvent!.year);
    const adminCaller = appRouter.createCaller(adminCtx);

    const contact = await adminCaller.contacts.create({
      name: "Tobi Knaus Chatpartner",
      role: "Streckenteam",
      email: testEmail,
      phone: "+49 2651 999999",
      notes: "Chat E2E Paralleltest",
    });

    const access = await db.createPlanningTeamAccess({
      label: "Tobi Knaus",
      contactId: contact.id,
      email: testEmail,
      passwordHash: "$2a$10$abcdefghijklmnopqrstuuNOPASSWORDMATCH",
      isTenantAdmin: false,
      moduleAccess: {
        helpers: "read",
        preparation: "read",
      },
      modulePermissions: ["helpers", "preparation"],
      eventIds: [targetEvent!.id],
    });

    const plannerUser = {
      id: 0,
      openId: planningTeamAccessOpenId(access.id),
      name: "Tobi Knaus",
      role: "user" as const,
    };
    const plannerCtx = makeScopedContext(plannerUser, targetEvent!.id, targetEvent!.year);
    const plannerCaller = appRouter.createCaller(plannerCtx);

    try {
      // Beide Sitzungen rufen list ab – muss sofort ohne Blockade gelingen
      const initialAdminSnapshot = await adminCaller.notes.list();
      const initialPlannerSnapshot = await plannerCaller.notes.list();

      expect(Array.isArray(initialAdminSnapshot.notes)).toBe(true);
      expect(Array.isArray(initialPlannerSnapshot.notes)).toBe(true);

      // Sitzung 1 (Planer Tobi Knaus) sendet eine Nachricht
      const plannerMessageText = `Hallo vom Streckenposten! Timestamp: ${uniqueSuffix}`;
      const sentFromPlanner = await plannerCaller.notes.send({
        message: plannerMessageText,
        important: false,
      });
      expect(sentFromPlanner.id).toBeGreaterThan(0);

      // Sitzung 2 (Admin) ruft list ab und sieht Tobis Nachricht sofort
      const adminSnapshotAfterPlanner = await adminCaller.notes.list();
      const foundInAdmin = adminSnapshotAfterPlanner.notes.find(
        n => n.id === sentFromPlanner.id
      );
      expect(foundInAdmin).toBeDefined();
      expect(foundInAdmin?.message).toBe(plannerMessageText);
      expect(foundInAdmin?.senderName).toBe("Tobi Knaus");

      // Sitzung 2 (Admin) antwortet
      const adminReplyText = `Empfangen, danke Tobi! Timestamp: ${uniqueSuffix}`;
      const sentFromAdmin = await adminCaller.notes.send({
        message: adminReplyText,
        important: true,
      });
      expect(sentFromAdmin.id).toBeGreaterThan(0);

      // Sitzung 1 (Planer Tobi Knaus) ruft list ab und sieht Admins Antwort
      const plannerSnapshotAfterAdmin = await plannerCaller.notes.list();
      const foundInPlanner = plannerSnapshotAfterAdmin.notes.find(
        n => n.id === sentFromAdmin.id
      );
      expect(foundInPlanner).toBeDefined();
      expect(foundInPlanner?.message).toBe(adminReplyText);
      expect(foundInPlanner?.important).toBe(true);
    } finally {
      // Rückstandslos bereinigen
      await db.deletePlanningTeamAccess(access.id);
      await withPlanningScope(
        {
          tenantId: TEST_TENANT_ID,
          year: targetEvent!.year,
          eventId: targetEvent!.id,
        },
        async () => {
          await db.deleteContact(contact.id, {
            userId: 9992,
            name: "Vereinsadmin Chat",
            role: "admin",
            loginMethod: "password",
          });
        }
      );
    }
  });
});
