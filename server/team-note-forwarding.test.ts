import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./mail-service", async importOriginal => {
  const actual = await importOriginal<typeof import("./mail-service")>();
  return {
    ...actual,
    isMailDeliveryConfigured: vi.fn(() => true),
    sendTransactionalEmail: vi.fn(async () => ({
      success: true,
      simulated: false,
    })),
  };
});

import { appRouter } from "./routers";
import * as db from "./db";
import { sendTransactionalEmail } from "./mail-service";

const testMembership = {
  tenantId: "testverein-teamnotiz-weitergabe",
  tenantName: "Testverein Teamnotiz-Weitergabe",
  tenantStatus: "pilot",
  role: "tenant_admin",
  isDefault: true,
} as any;

const activeEvent = {
  id: 1,
  year: 2026,
  name: "MyEifelRide",
  activeDays: ["Freitag", "Samstag", "Sonntag"],
  pdfLogoKey: null,
  pdfLogoUrl: null,
  pdfLogoFallback: "none",
  sortOrder: 0,
  createdAt: new Date(),
} as any;

const liveNote = {
  id: 31,
  year: 2026,
  eventId: 1,
  senderUserId: 5,
  senderName: "Anne Veling",
  senderRole: "user",
  message: "Bitte die Lieferzeiten heute noch abstimmen.",
  important: false,
  createdAt: new Date(),
} as any;

function entitlement(packageId: "light" | "pro" | "enterprise" = "pro") {
  return {
    tenantId: testMembership.tenantId,
    packageId,
    status: "active",
    startsOn: null,
    endsOn: null,
    eventId: null,
    isUsable: true,
    entitlements: { includedCapabilities: [], includedPlanningModules: [] },
  } as any;
}

function adminCaller() {
  return appRouter.createCaller({
    req: {
      headers: { "x-event-year": "2026", "x-event-id": "1" },
    } as any,
    res: {} as any,
    user: {
      id: 1,
      openId: "admin-id",
      name: "Christian Lambrich",
      email: null,
      loginMethod: "admin-password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });
}

function plannerCaller() {
  return appRouter.createCaller({
    req: {
      headers: { "x-event-year": "2026", "x-event-id": "1" },
    } as any,
    res: {} as any,
    user: {
      id: 2,
      openId: "planner-id",
      name: "Planungsteam",
      email: null,
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });
}

describe("Teamnotiz-Weitergabe", () => {
  beforeEach(() => {
    vi.spyOn(db, "resolveTenantForUser").mockResolvedValue(testMembership);
    vi.spyOn(db, "getCurrentTenantProductEntitlement").mockResolvedValue(
      entitlement()
    );
    vi.spyOn(db, "getEvent").mockResolvedValue(activeEvent);
    vi.spyOn(db, "getTeamNoteForForwarding").mockResolvedValue(liveNote);
    vi.spyOn(db, "listContacts").mockResolvedValue([
      { id: 11, name: "Anna", email: "anna@verein.de", phone: "0171 1111111" },
      {
        id: 12,
        name: "Anne",
        email: "ANNA@verein.de",
        phone: "0049 171 1111111",
      },
      { id: 13, name: "Beate", email: null, phone: null },
    ] as any);
    vi.spyOn(db, "recordTeamNoteForwardingResult").mockResolvedValue(
      undefined as never
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it("liefert nur Ansprechpartner des aktuellen Events, erklärt Dubletten und lässt ungültige Wege gesperrt", async () => {
    const result = await adminCaller().notes.forwardingRecipients({
      noteId: 31,
    });

    expect(result.note).toMatchObject({ id: 31, eventName: "MyEifelRide" });
    expect(result.contacts).toEqual([
      expect.objectContaining({
        id: 11,
        email: "anna@verein.de",
        emailDuplicate: true,
        whatsAppDuplicate: true,
      }),
      expect.objectContaining({
        id: 12,
        email: "anna@verein.de",
        emailDuplicate: true,
        whatsAppDuplicate: true,
      }),
      expect.objectContaining({ id: 13, email: null, whatsApp: null }),
    ]);
  });

  it("verwehrt Light und normalen Planern die Weitergabe serverseitig", async () => {
    vi.spyOn(db, "getCurrentTenantProductEntitlement").mockResolvedValue(
      entitlement("light")
    );
    await expect(
      adminCaller().notes.forwardingRecipients({ noteId: 31 })
    ).rejects.toThrow();

    vi.spyOn(db, "getCurrentTenantProductEntitlement").mockResolvedValue(
      entitlement()
    );
    vi.spyOn(
      db,
      "getPlanningTeamAccessCredentialForCurrentTenant"
    ).mockResolvedValue(null as any);
    await expect(
      plannerCaller().notes.forwardingRecipients({ noteId: 31 })
    ).rejects.toThrow("Team-Notizen können nur von Administratoren");
  });

  it("sendet genau einen Mailauftrag an eindeutige sichtbare An-Adressen und protokolliert ohne Text", async () => {
    const claim = vi
      .spyOn(db, "claimTeamNoteEmailForwarding")
      .mockResolvedValue({
        status: "claimed",
        note: liveNote,
      } as any);
    const audit = vi
      .spyOn(db, "recordTeamNoteForwardingResult")
      .mockResolvedValue(undefined as never);

    const result = await adminCaller().notes.forwardEmail({
      noteId: 31,
      contactIds: [11, 12],
    });

    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ noteId: 31 }));
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["anna@verein.de"],
        subject: "[MyEifelRide] Aktuelle Team-Notiz",
      })
    );
    expect(result).toEqual({
      status: "accepted",
      recipientCount: 2,
      addressCount: 1,
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: 31,
        channel: "email",
        recipientCount: 2,
        destinationCount: 1,
        result: "accepted",
      })
    );
  });

  it("wiederholt keinen bereits beanspruchten Mailauftrag und bereitet WhatsApp nur als Einzelchat vor", async () => {
    vi.spyOn(db, "claimTeamNoteEmailForwarding").mockResolvedValue({
      status: "already_claimed",
    } as any);

    await expect(
      adminCaller().notes.forwardEmail({
        noteId: 31,
        contactIds: [11],
      })
    ).resolves.toEqual({
      status: "already_started",
      recipientCount: 1,
      addressCount: 1,
    });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();

    const prepared = await adminCaller().notes.prepareWhatsApp({
      noteId: 31,
      contactId: 11,
    });
    expect(prepared.recipient).toEqual({
      id: 11,
      name: "Anna",
      phone: "491711111111",
    });
    expect(prepared.message).toContain(
      "Bitte die Lieferzeiten heute noch abstimmen."
    );
    expect(db.recordTeamNoteForwardingResult).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "whatsapp", result: "prepared" })
    );
  });

  it("lehnt abgelaufene oder fremde Notizen vor jeder externen Aktion ab", async () => {
    vi.spyOn(db, "getTeamNoteForForwarding").mockResolvedValueOnce(null);
    await expect(
      adminCaller().notes.forwardingRecipients({ noteId: 999 })
    ).rejects.toThrow("nicht mehr verfügbar");

    vi.spyOn(db, "claimTeamNoteEmailForwarding").mockResolvedValueOnce({
      status: "unavailable",
    } as any);
    await expect(
      adminCaller().notes.forwardEmail({
        noteId: 999,
        contactIds: [11],
      })
    ).rejects.toThrow("nicht mehr verfügbar");
  });
});
