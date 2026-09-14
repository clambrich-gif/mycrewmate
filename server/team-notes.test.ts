import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Live-Teamnotizen Backend & Ephemeral Storage", () => {
  it("ruft Notizen der letzten 24 Stunden ab und unterstützt inkrementelles Polling mit sinceId", async () => {
    const listSpy = vi.spyOn(db, "listTeamNotes").mockResolvedValueOnce([
      {
        id: 11,
        year: 2026,
        eventId: 1,
        senderUserId: 1,
        senderName: "Christian Lambrich",
        senderRole: "admin",
        message: "Strecke Nord ist geprüft.",
        createdAt: new Date(),
      },
    ] as any);

    const caller = appRouter.createCaller({
      req: {
        headers: {
          "x-event-year": "2026",
          "x-event-id": "1",
        },
      } as any,
      res: {} as any,
      user: {
        id: 1,
        openId: "admin-id",
        name: "Christian Lambrich",
        email: "test@example.com",
        loginMethod: "admin-password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    vi.spyOn(db, "getEvent").mockResolvedValueOnce({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });

    const result = await caller.notes.list({ sinceId: 10 });
    expect(listSpy).toHaveBeenCalledWith({ sinceId: 10, limit: undefined });
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].senderName).toBe("Christian Lambrich");
  });

  it("liefert aktive Tippende synchron mit der Notizenliste", async () => {
    const caller = appRouter.createCaller({
      req: {
        headers: {
          "x-event-year": "2026",
          "x-event-id": "1",
        },
      } as any,
      res: {} as any,
      user: {
        id: 1,
        openId: "admin-id",
        name: "Christian Lambrich",
        email: "test@example.com",
        loginMethod: "admin-password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    vi.spyOn(db, "getEvent").mockResolvedValueOnce({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    vi.spyOn(db, "listTeamNotes").mockResolvedValueOnce([]);
    vi.spyOn(db, "listActiveTypers").mockResolvedValueOnce([
      {
        sessionKey: "other-session",
        senderName: "Lukas",
        senderRole: "user",
        updatedAt: new Date(),
      },
    ] as any);

    const listWithTypers = await caller.notes.list({});
    expect(listWithTypers.typing).toHaveLength(1);
    expect(listWithTypers.typing[0].senderName).toBe("Lukas");
  });

  it("erlaubt Planern das Senden und verknüpft die Anmelderolle", async () => {
    const createSpy = vi.spyOn(db, "createTeamNote").mockResolvedValueOnce({
      id: 12,
      year: 2026,
      eventId: 1,
      senderUserId: 2,
      senderName: "Anne Veling",
      senderRole: "user",
      message: "Kuchenspenden sind vollständig eingetragen.",
      createdAt: new Date(),
    } as any);

    vi.spyOn(db, "getEvent").mockResolvedValueOnce({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    vi.spyOn(db, "withPlanningWriteLock").mockImplementationOnce(async cb => cb());

    const caller = appRouter.createCaller({
      req: {
        headers: {
          "x-event-year": "2026",
          "x-event-id": "1",
        },
      } as any,
      res: {} as any,
      user: {
        id: 2,
        openId: "user-id",
        name: "Planungsteam",
        email: null,
        loginMethod: "password",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    const note = await caller.notes.send({
      senderName: "Anne Veling",
      message: "Kuchenspenden sind vollständig eingetragen.",
      important: true,
    });

    expect(createSpy).toHaveBeenCalledWith({
      senderUserId: 2,
      senderName: "Anne Veling",
      senderRole: "user",
      message: "Kuchenspenden sind vollständig eingetragen.",
      important: true,
      sessionKey: null,
    });
    expect(note.id).toBe(12);
  });

  it("verwehrt normalen Planern das Leeren des Verlaufs, verlangt vom Admin das Passwort und auditiert den Vorgang", async () => {
    const passwordAuth = await import("./password-auth");
    const adminHash = await passwordAuth.hashPassword("Super-Geheimes-Admin-Passwort!");
    vi.spyOn(db, "getSecuritySettings").mockResolvedValue({
      id: 1,
      adminPasswordHash: adminHash,
    } as any);
    vi.spyOn(db, "getAppSettings").mockResolvedValue({} as any);
    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async cb => cb());
    const clearSpy = vi.spyOn(db, "clearTeamNotes").mockResolvedValueOnce({ deletedCount: 3 });

    const userCaller = appRouter.createCaller({
      req: {
        headers: {
          "x-event-year": "2026",
          "x-event-id": "1",
        },
      } as any,
      res: {} as any,
      user: {
        id: 2,
        openId: "user-id",
        name: "Planungsteam",
        email: null,
        loginMethod: "password",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    await expect(
      userCaller.notes.clear({ adminPassword: "falsches-passwort" })
    ).rejects.toThrow();

    const adminCaller = appRouter.createCaller({
      req: {
        protocol: "https",
        headers: {
          "x-event-year": "2026",
          "x-event-id": "1",
        },
        socket: { remoteAddress: "127.0.0.10" },
        header(name: string) {
          if (name.toLowerCase() === "x-event-year") return "2026";
          if (name.toLowerCase() === "x-event-id") return "1";
          return undefined;
        },
      } as any,
      res: {} as any,
      user: {
        id: 1,
        openId: "admin-id",
        name: "Administrator",
        email: null,
        loginMethod: "admin-password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    await expect(
      adminCaller.notes.clear({ adminPassword: "falsches-admin-passwort" })
    ).rejects.toThrow("Administratorpasswort ist nicht korrekt");

    const clearResult = await adminCaller.notes.clear({
      adminPassword: "Super-Geheimes-Admin-Passwort!",
    });
    expect(clearSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        name: "Administrator",
        role: "admin",
      })
    );
    expect(clearResult.deletedCount).toBe(3);
  });
});
