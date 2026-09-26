import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { planningTeamAccessOpenId } from "./password-auth";
import { withPlanningScope } from "./year-context";
import type { TrpcContext } from "./_core/context";

const TEST_TENANT_ID = "rsc-eifelland-mayen";
const TEST_EVENT_YEAR = 2027;

function makeScopedContext(user: any, eventId: number, eventYear = TEST_EVENT_YEAR): TrpcContext {
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

describe("Punkt 2: Zweiter Testzugang mit differenzierten Rechten (Lesen, Schreiben, Aus)", () => {
  it("gewährt nur dem Schreibzugang Änderungen, erlaubt Lesezugriff schreibgeschützt und sperrt ausgeschaltete Module", async () => {
    const adminUser = {
      id: 9991,
      openId: "test-admin-e2e-matrix",
      name: "Vereinsadmin E2E",
      role: "admin" as const,
    };
    const bootstrapCtx = makeScopedContext(adminUser, 0);
    const bootstrapCaller = appRouter.createCaller(bootstrapCtx);
    const events = await bootstrapCaller.events.all();
    const targetEvent = events[0];
    expect(targetEvent).toBeDefined();

    const adminCtx = makeScopedContext(adminUser, targetEvent!.id, targetEvent!.year);
    const adminCaller = appRouter.createCaller(adminCtx);

    const uniqueSuffix = Date.now();
    const testEmail = `sabine.differenziert.${uniqueSuffix}@example.org`;
    const testHelperName = `E2E Helfer Testperson ${uniqueSuffix}`;
    let createdHelperId: number | null = null;
    let createdContactId: number | null = null;
    let createdAccessId: number | null = null;

    const contact = await adminCaller.contacts.create({
      name: "Sabine Differenziert Test",
      role: "Streckenorga",
      email: testEmail,
      phone: "+49 2651 888888",
      notes: "E2E Berechtigungstest",
    });
    createdContactId = contact.id;

    const securitySettings = await db.getSecuritySettings();
    const adminPasswordHash = securitySettings?.adminPasswordHash;

    // Anlegen des 2. Testzugangs:
    // Helfer: Schreiben
    // Vorbereitung: Lesen
    // Finanzen: Aus
    const access = await db.createPlanningTeamAccess({
      label: "Sabine Differenziert",
      contactId: contact.id,
      email: testEmail,
      passwordHash: "$2a$10$abcdefghijklmnopqrstuuNOPASSWORDMATCH",
      isTenantAdmin: false,
      moduleAccess: {
        helpers: "write",
        preparation: "read",
        finances: "off",
      },
      modulePermissions: ["helpers"],
      eventIds: [targetEvent!.id],
    });
    createdAccessId = access.id;

    expect(access).toBeDefined();
    expect(access.moduleAccess?.helpers).toBe("write");
    expect(access.moduleAccess?.preparation).toBe("read");
    expect(access.moduleAccess?.finances).toBe("off");

    const plannerUser = {
      id: 8881,
      openId: planningTeamAccessOpenId(access.id),
      name: "Sabine Differenziert",
      role: "user" as const,
    };
    const plannerCtx = makeScopedContext(plannerUser, targetEvent!.id, targetEvent!.year);
    const plannerCaller = appRouter.createCaller(plannerCtx);

    try {
      // 1. Helfer: Schreiben erlaubt
      const createdHelper = await plannerCaller.helpers.create({
        name: testHelperName,
        phone: "+49 151 777777",
        note: "Berechtigungstest Helfer",
      });
      expect(createdHelper).toBeDefined();
      expect(createdHelper.created).toBe(true);
      expect(createdHelper.id).toBeGreaterThan(0);
      createdHelperId = createdHelper.id;

      const helperList = await plannerCaller.helpers.list();
      const createdInList = helperList.find(h => h.id === createdHelper.id);
      expect(createdInList?.name).toBe(testHelperName);

      // 2. Vorbereitung: Lesen erlaubt
      const prepList = await plannerCaller.prep.list();
      expect(Array.isArray(prepList)).toBe(true);

      // Vorbereitung: Schreiben verboten mit freundlichem Lesehinweis
      await expect(
        plannerCaller.prep.create({
          task: "Sollte fehlschlagen",
          category: "Strecke",
        })
      ).rejects.toThrow("Lesezugriff aktiv");

      // 3. Finanzen: Ausgeschaltet -> Lesen und Schreiben verboten
      await expect(plannerCaller.finances.list()).rejects.toThrow(
        "Keine Leseberechtigung für diesen Bereich."
      );
      await expect(
        plannerCaller.finances.create({
          title: "Unberechtigte Ausgabe",
          amountEur: 50,
          category: "Material",
          flow: "expense",
        })
      ).rejects.toThrow(
        "Keine Berechtigung zur Bearbeitung dieses Bereichs."
      );
    } finally {
      // Rückstandslos bereinigen
      if (createdHelperId) {
        await withPlanningScope(
          {
            tenantId: TEST_TENANT_ID,
            year: targetEvent!.year,
            eventId: targetEvent!.id,
          },
          async () => {
            await db.deleteHelper(createdHelperId!, {
              allowAssigned: true,
              actor: {
                userId: 9991,
                name: "Vereinsadmin E2E",
                role: "admin",
                loginMethod: "password",
              },
            });
          }
        );
      }
      if (createdAccessId) {
        await db.deletePlanningTeamAccess(createdAccessId);
      }
      if (createdContactId) {
        await withPlanningScope(
          {
            tenantId: TEST_TENANT_ID,
            year: targetEvent!.year,
            eventId: targetEvent!.id,
          },
          async () => {
            await db.deleteContact(createdContactId!, {
              userId: 9991,
              name: "Vereinsadmin E2E",
              role: "admin",
              loginMethod: "password",
            });
          }
        );
      }
    }
  });
});
