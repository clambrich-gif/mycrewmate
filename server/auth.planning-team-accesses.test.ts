import { describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { appRouter } from "./routers";
import * as db from "./db";
import * as passwordAuth from "./password-auth";
import * as pdf from "./pdf";
import {
  ADMIN_PASSWORD_OPEN_ID,
  hashPassword,
  planningTeamAccessOpenId,
  SHARED_PASSWORD_OPEN_ID,
} from "./password-auth";

const mockReq = (headers: Record<string, string> = {}) =>
  ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  }) as any;

describe("Event-based Access Control für Planungsteam", () => {
  it("filtert Veranstaltungen für Administratoren uneingeschränkt und für Planungsteam strikt nach Freigaben", async () => {
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide 2027" } as any,
      { id: 11, year: 2027, name: "Sommerfest 2027" } as any,
    ]);
    vi.spyOn(db, "listEventsForPlanningTeamAccess").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide 2027" } as any,
    ]);

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const planerCaller = appRouter.createCaller({
      user: {
        id: 2,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "EifelRide Team 2027",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const adminEvents = await adminCaller.events.list({ year: 2027 });
    expect(adminEvents.map(e => e.id)).toEqual([10, 11]);

    const planerEvents = await planerCaller.events.list({ year: 2027 });
    expect(planerEvents.map(e => e.id)).toEqual([10]);
  });

  it("sperrt nicht freigegebene Veranstaltungen serverseitig für das Planungsteam", async () => {
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(false);
    vi.spyOn(db, "listContacts").mockResolvedValue([]);

    const planerCaller = appRouter.createCaller({
      user: {
        id: 2,
        openId: planningTeamAccessOpenId(42),
        role: "user",
        name: "EifelRide Team 2027",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq({
        "x-event-year": "2027",
        "x-event-id": "11",
      }),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(planerCaller.contacts.list()).rejects.toThrow(
      "Dieser Planungsteam-Zugang ist für die gewählte Veranstaltung nicht freigegeben."
    );
  });

  it("weist alte globale Planungsteam-Sitzungen zurück, damit sie keine Eventfreigaben umgehen", async () => {
    const legacyCaller = appRouter.createCaller({
      user: {
        id: 2,
        openId: SHARED_PASSWORD_OPEN_ID,
        role: "user",
        name: "Altes Planungsteam",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(legacyCaller.events.list({ year: 2027 })).rejects.toThrow(
      "Dieser Planungsteam-Zugang wurde ersetzt. Bitte erneut anmelden."
    );
  });

  it("verlangt für das Anlegen und Bearbeiten von Planungsteam-Zugängen das Administratorpasswort", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      adminPasswordHash: "$2a$10$hashedadminpassword",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(false);

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(
      adminCaller.planningTeamAccesses.create({
        label: "Neues Team",
        contactId: 1,
        password: "sicheres-passwort-123",
        eventIds: [10],
        currentAdminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort ist nicht korrekt");
  });

  it("erlaubt optionales Passwort beim Erstellen von Ansprechpartnern und hasht es serverseitig", async () => {
    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 10,
      year: 2027,
      name: "MyEifelRide 2027",
    } as any);
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async callback =>
      callback()
    );
    const upsertContactSpy = vi.spyOn(db, "upsertContactByName").mockResolvedValue({
      id: 55,
      created: true,
      helperId: 55,
      helperCreated: true,
    });
    const hashSpy = vi.spyOn(passwordAuth, "hashPassword").mockResolvedValue("$2a$10$hashedContactPass");

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq({
        "x-event-year": "2027",
        "x-event-id": "10",
      }),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await adminCaller.contacts.create({
      name: "Anne Veling",
      phone: "0170 123456",
      password: "sicheres-kontakt-passwort",
    });

    expect(result.id).toBe(55);
    expect(hashSpy).toHaveBeenCalledWith("sicheres-kontakt-passwort");
    expect(upsertContactSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Anne Veling",
        phone: "0170 123456",
        passwordHash: "$2a$10$hashedContactPass",
      })
    );
  });

  it("meldet Planungsteammitglieder fälschungssicher mit dem hinterlegten Ansprechpartnernamen an", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      planningTeamLocked: false,
    } as any);
    vi.spyOn(db, "listPlanningTeamAccessCredentials").mockResolvedValue([
      {
        id: 7,
        label: "Anne Veling",
        contactName: "Anne Veling",
        passwordHash: "$2a$10$hashedAnne",
        sessionVersion: 2,
      },
    ]);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    const upsertUserSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);
    const clearFailuresSpy = vi
      .spyOn(db, "clearPlanningTeamLoginFailuresIfUnlocked")
      .mockResolvedValue(true);

    const cookieMock = vi.fn();
    const publicCaller = appRouter.createCaller({
      user: null,
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: cookieMock } as any,
    });

    const result = await publicCaller.auth.passwordLogin({
      password: "korrektes-anne-passwort",
    });

    expect(result).toEqual({ success: true });
    expect(clearFailuresSpy).toHaveBeenCalled();
    expect(upsertUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: planningTeamAccessOpenId(7),
        name: "Anne Veling",
        role: "user",
      })
    );
    expect(cookieMock).toHaveBeenCalled();
  });

  it("fordert beim Admin-Login zunächst die Identitätsauswahl an und setzt erst mit Namen die Sitzung", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      adminPasswordHash: "$2a$10$hashedAdmin",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      {
        id: 1,
        name: "Christian Lambrich",
        year: 2027,
        eventId: 10,
        eventName: "MyEifelRide 2027",
      },
    ]);
    const upsertUserSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);

    const cookieMock = vi.fn();
    const publicCaller = appRouter.createCaller({
      user: null,
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: cookieMock } as any,
    });

    // Schritt 1: Nur Passwort übergeben -> Name wird angefordert
    const step1 = await publicCaller.auth.adminPasswordLogin({
      password: "admin-passwort-123",
    });
    expect(step1).toEqual({
      requiresIdentity: true,
      contacts: [
        {
          id: 1,
          name: "Christian Lambrich",
          year: 2027,
          eventId: 10,
          eventName: "MyEifelRide 2027",
        },
      ],
    });
    expect(cookieMock).not.toHaveBeenCalled();
    expect(upsertUserSpy).not.toHaveBeenCalled();

    // Schritt 2: Passwort + gewählter Name übergeben -> Admin-Sitzung mit Namen
    const step2 = await publicCaller.auth.adminPasswordLogin({
      password: "admin-passwort-123",
      administratorName: "Christian Lambrich",
    });
    expect(step2).toEqual({
      success: true,
      requiresIdentity: false,
    });
    expect(upsertUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: ADMIN_PASSWORD_OPEN_ID,
        name: "Christian Lambrich",
        role: "admin",
      })
    );
    expect(cookieMock).toHaveBeenCalled();
  });

  it("blockiert falschen Admin-Login auch bei vorab übergebenem Namen", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      adminPasswordHash: "$2a$10$hashedAdmin",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(false);

    const publicCaller = appRouter.createCaller({
      user: null,
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
    });

    await expect(
      publicCaller.auth.adminPasswordLogin({
        password: "falsches-admin-passwort",
        administratorName: "Christian Lambrich",
      })
    ).rejects.toThrow("Administratorpasswort ist nicht korrekt");
  });

  it("überträgt beim Helferlöschen die echte Sitzungsidentität automatisch an das Löschprotokoll", async () => {
    const deleteHelperSpy = vi
      .spyOn(db, "deleteHelper")
      .mockResolvedValue({ affectedRows: 1 } as any);

    const adminCaller = appRouter.createCaller({
      user: {
        id: 42,
        openId: ADMIN_PASSWORD_OPEN_ID,
        name: "Christian Lambrich",
        email: null,
        loginMethod: "password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
    });

    const result = await adminCaller.helpers.remove({ id: 99 });
    expect(result).toBeDefined();
    expect(deleteHelperSpy).toHaveBeenCalledWith(99, {
      allowAssigned: true,
      actor: {
        userId: 42,
        name: "Christian Lambrich",
        role: "admin",
        loginMethod: "password",
      },
    });
  });

  it("liefert das Aktivitätsprotokoll für Administratoren abfragebereit aus", async () => {
    const listActivitiesSpy = vi
      .spyOn(db, "listActivityLogs")
      .mockResolvedValue([
        {
          id: 1,
          year: 2027,
          eventId: 10,
          eventName: "MyEifelRide 2027",
          module: "Helfer",
          action: "created",
          subject: "Helfer „Max Mustermann“ angelegt",
          actorUserId: 42,
          actorName: "Christian Lambrich",
          actorRole: "admin",
          actorLoginMethod: "password",
          createdAt: new Date(),
        },
      ]);

    const adminCaller = appRouter.createCaller({
      user: {
        id: 42,
        openId: ADMIN_PASSWORD_OPEN_ID,
        name: "Christian Lambrich",
        email: null,
        loginMethod: "password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
    });

    const activities = await adminCaller.audit.activities({});
    expect(listActivitiesSpy).toHaveBeenCalled();
    expect(activities).toHaveLength(1);
    expect(activities[0].actorName).toBe("Christian Lambrich");
  });

  it("erzeugt einen neuen Zugangscode nur für das Einmal-Zugangsblatt und gibt ihn nicht über die API zurück", async () => {
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      adminPasswordHash: "$2a$10$hashedAdmin",
    } as any);
    vi.spyOn(passwordAuth, "verifyPassword").mockResolvedValue(true);
    const createAccessSpy = vi
      .spyOn(db, "createPlanningTeamAccess")
      .mockResolvedValue({
        id: 17,
        contactId: 4,
        label: "Anne Veling",
        passwordHash: "$2a$10$generated",
        sessionVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventIds: [10],
      } as any);
    vi.spyOn(db, "listAllContactsForPlanningTeamAccess").mockResolvedValue([
      {
        id: 4,
        name: "Anne Veling",
        year: 2027,
        eventId: 10,
        eventName: "MyEifelRide",
      },
    ] as any);
    vi.spyOn(db, "listEventYears").mockResolvedValue([
      { year: 2027, label: "2027" },
    ] as any);
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide" },
    ] as any);
    const accessSheetSpy = vi
      .spyOn(pdf, "createPlanningTeamAccessSheetsPdf")
      .mockResolvedValue(Buffer.from("%PDF-test"));

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await adminCaller.planningTeamAccesses.createWithAccessSheet({
      label: "Anne Veling",
      contactId: 4,
      eventIds: [10],
      currentAdminPassword: "admin-passwort-123",
    });

    expect(createAccessSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 4,
        eventIds: [10],
        mustChangePassword: true,
        passwordHash: expect.stringMatching(/^\$2/),
      })
    );
    expect(accessSheetSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          contactName: "Anne Veling",
          initialPassword: expect.stringMatching(/^MCM-/),
        }),
      ]
    );
    expect(result).toEqual(
      expect.objectContaining({
        accessId: 17,
        filename: "Zugangsblatt_Anne_Veling.pdf",
        mimeType: "application/pdf",
      })
    );
    expect(result).not.toHaveProperty("initialPassword");
  });

  it("druckt bestehende Zugangsblätter ohne gespeicherte Klartextpasswörter nach", async () => {
    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([
      {
        id: 8,
        contactId: 2,
        contactName: "Christian Lambrich",
        label: "Christian Lambrich",
        eventIds: [10],
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 9,
        contactId: 3,
        contactName: "Anne Veling",
        label: "Anne Veling",
        eventIds: [10],
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.spyOn(db, "listEventYears").mockResolvedValue([
      { year: 2027, label: "2027" },
    ] as any);
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide" },
    ] as any);
    const accessSheetSpy = vi
      .spyOn(pdf, "createPlanningTeamAccessSheetsPdf")
      .mockResolvedValue(Buffer.from("%PDF-test"));

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await adminCaller.planningTeamAccesses.accessSheets({
      accessIds: [8],
    });
    expect(accessSheetSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        contactName: "Christian Lambrich",
      }),
    ]);
    const renderedSheet = accessSheetSpy.mock.calls[0][0][0];
    expect(renderedSheet.initialPassword).toBeUndefined();
    expect(accessSheetSpy.mock.calls[0][0]).toHaveLength(1);
    expect(renderedSheet.contactName).toBe("Christian Lambrich");
    expect(result.base64).toBe(Buffer.from("%PDF-test").toString("base64"));
  });

  it("legt Ansprechpartner mit einem sicheren Einmal-Zugangsblatt an", async () => {
    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 10,
      year: 2027,
      name: "MyEifelRide",
    } as any);
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async callback =>
      callback()
    );
    vi.spyOn(db, "upsertContactByName").mockResolvedValue({
      id: 55,
      created: true,
      helperId: 55,
      helperCreated: true,
    });
    vi.spyOn(db, "listContacts").mockResolvedValue([
      { id: 55, name: "Anne Veling", phone: "0170 123456" },
    ] as any);
    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([]);
    vi.spyOn(db, "listEventYears").mockResolvedValue([
      { year: 2027, label: "2027" },
    ] as any);
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide" },
    ] as any);
    const createAccessSpy = vi.spyOn(db, "createPlanningTeamAccess").mockResolvedValue({
      id: 19,
      label: "Anne Veling",
      eventIds: [10],
    } as any);
    const accessSheetSpy = vi
      .spyOn(pdf, "createPlanningTeamAccessSheetsPdf")
      .mockResolvedValue(Buffer.from("%PDF-contact"));

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq({ "x-event-year": "2027", "x-event-id": "10" }),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await adminCaller.contacts.createWithAccessSheet({
      name: "Anne Veling",
      phone: "0170 123456",
    });

    expect(createAccessSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 55,
        eventIds: [10],
        mustChangePassword: true,
        passwordHash: expect.stringMatching(/^\$2/),
      })
    );
    expect(accessSheetSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        contactName: "Anne Veling",
        initialPassword: expect.stringMatching(/^MCM-/),
      }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        id: 55,
        accessId: 19,
        filename: "Zugangsblatt_Anne_Veling.pdf",
      })
    );
  });

  it("erneuert für importierte Ansprechpartner den Zugang und erhält ihre bisherigen Eventfreigaben", async () => {
    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 10,
      year: 2027,
      name: "MyEifelRide",
    } as any);
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async callback =>
      callback()
    );
    vi.spyOn(db, "listContacts").mockResolvedValue([
      { id: 55, name: "Anne Veling", phone: "0170 123456" },
    ] as any);
    vi.spyOn(db, "listPlanningTeamAccesses").mockResolvedValue([
      {
        id: 19,
        contactId: 55,
        contactName: "Anne Veling",
        label: "Anne Veling",
        eventIds: [10, 11],
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.spyOn(db, "listEventYears").mockResolvedValue([
      { year: 2027, label: "2027" },
    ] as any);
    vi.spyOn(db, "listEvents").mockResolvedValue([
      { id: 10, year: 2027, name: "MyEifelRide" },
      { id: 11, year: 2027, name: "Sommerfest" },
    ] as any);
    const updateAccessSpy = vi.spyOn(db, "updatePlanningTeamAccess").mockResolvedValue({
      id: 19,
      label: "Anne Veling",
      eventIds: [10, 11],
    } as any);
    vi.spyOn(pdf, "createPlanningTeamAccessSheetsPdf").mockResolvedValue(
      Buffer.from("%PDF-reset")
    );

    const adminCaller = appRouter.createCaller({
      user: {
        id: 1,
        openId: ADMIN_PASSWORD_OPEN_ID,
        role: "admin",
        name: "Admin",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq({ "x-event-year": "2027", "x-event-id": "10" }),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await adminCaller.contacts.generateAccessSheet({ id: 55 });

    expect(updateAccessSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 19,
        eventIds: [10, 11],
        mustChangePassword: true,
        passwordHash: expect.stringMatching(/^\$2/),
      })
    );
  });

  it("erkennt Einmalpasswörter beim Login und erzwingt das Setzen eines neuen Passworts", async () => {
    const initialHash = await hashPassword("MCM-initial-code-123");
    vi.spyOn(db, "listPlanningTeamAccessCredentials").mockResolvedValue([
      {
        id: 19,
        contactName: "Toni Test",
        label: "Toni Test",
        passwordHash: initialHash,
        mustChangePassword: true,
        sessionVersion: 1,
      },
    ]);
    const cookieSpy = vi.fn();
    const caller = appRouter.createCaller({
      user: null,
      req: mockReq(),
      res: { cookie: cookieSpy, setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const loginResult = await caller.auth.passwordLogin({
      password: "MCM-initial-code-123",
    });

    expect(loginResult).toEqual({
      success: true,
      mustChangePassword: true,
    });
    expect(cookieSpy).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ maxAge: expect.any(Number) })
    );

    const changeSpy = vi
      .spyOn(db, "completePlanningTeamInitialPasswordChange")
      .mockResolvedValue({ id: 19, sessionVersion: 2 });
    vi.spyOn(db, "isPlanningTeamAccessPasswordChangeRequired").mockResolvedValue(true);
    const upsertUserSpy = vi.spyOn(db, "upsertUser").mockResolvedValue({} as any);

    const authCaller = appRouter.createCaller({
      user: {
        id: 99,
        openId: "planning-team-access-19",
        role: "user",
        name: "Toni Test",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq(),
      res: { cookie: cookieSpy, setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const statusResult = await authCaller.auth.initialPasswordChangeStatus();
    expect(statusResult).toEqual({ mustChangePassword: true });

    const changeResult = await authCaller.auth.completeInitialPasswordChange({
      password: "mein-neues-sicheres-passwort-123",
      passwordConfirmation: "mein-neues-sicheres-passwort-123",
    });

    expect(changeResult).toEqual({
      success: true,
      mustChangePassword: false,
    });
    expect(changeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accessId: 19,
        passwordHash: expect.stringMatching(/^\$2/),
      })
    );
    expect(upsertUserSpy).toHaveBeenCalled();
  });

  it("blockiert operative Planungsabfragen bei noch offenem Einmalpasswortwechsel", async () => {
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(true);
    vi.spyOn(db, "isPlanningTeamAccessPasswordChangeRequired").mockResolvedValue(true);

    const blockedCaller = appRouter.createCaller({
      user: {
        id: 99,
        openId: "planning-team-access-19",
        role: "user",
        name: "Toni Test",
        email: null,
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: mockReq({ "x-planning-year": "2027", "x-planning-event-id": "10" }),
      res: { setHeader: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(blockedCaller.notes.list({ offset: 0, limit: 10 })).rejects.toThrow(
      "Bitte vergeben Sie zuerst Ihr persönliches Passwort"
    );
  });
});
