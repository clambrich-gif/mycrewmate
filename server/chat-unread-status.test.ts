import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Team-Notizen ungelesene Nachrichten & Abwesenheits-Tracking", () => {
  it("liefert ungelesene Nachrichten basierend auf dem serverseitigen Lesestatus und setzt sie beim Öffnen zurück", async () => {
    const adminUser = {
      id: 1,
      openId: "auth-admin-password-session",
      name: "Christian Lambrich",
      email: null,
      role: "admin" as const,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const plannerUser = {
      id: 2,
      openId: "planning-team-access-42",
      name: "Anne Veling",
      email: null,
      role: "user" as const,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let fakeReadAt: Date | null = null;
    const fakeNotes = [
      {
        id: 1,
        year: 2027,
        eventId: 1,
        senderUserId: 1,
        senderName: "Christian Lambrich",
        senderRole: "admin" as const,
        message: "Ältere Durchsage",
        important: false,
        createdAt: new Date("2026-09-20T10:00:00Z"),
      },
      {
        id: 2,
        year: 2027,
        eventId: 1,
        senderUserId: 1,
        senderName: "Christian Lambrich",
        senderRole: "admin" as const,
        message: "Wichtige Nachricht während Abwesenheit",
        important: true,
        createdAt: new Date("2026-09-21T07:00:00Z"),
      },
      {
        id: 3,
        year: 2027,
        eventId: 1,
        senderUserId: 1,
        senderName: "Christian Lambrich",
        senderRole: "admin" as const,
        message: "Noch eine frische Schichtinfo",
        important: false,
        createdAt: new Date("2026-09-21T07:05:00Z"),
      },
    ];

    const listNotesSpy = vi.spyOn(db, "listTeamNotes").mockResolvedValue(fakeNotes as any);
    const listTypingSpy = vi.spyOn(db, "listActiveTypers").mockResolvedValue([]);
    const getEventSpy = vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 1,
      year: 2027,
      name: "MyEifelRide 2027",
    } as any);
    const accessAllowedSpy = vi
      .spyOn(db, "isPlanningTeamAccessAllowedForEvent")
      .mockResolvedValue(true);
    const passwordChangeReqSpy = vi
      .spyOn(db, "isPlanningTeamAccessPasswordChangeRequired")
      .mockResolvedValue(false);
    const getUnreadSpy = vi
      .spyOn(db, "getTeamNoteUnreadStatus")
      .mockImplementation(async (identity) => {
        expect(identity.identityKey).toBe("planning-access:42");
        expect(identity.sessionName).toBe("Anne Veling");
        const cutoff = fakeReadAt;
        const unreadNotes = cutoff
          ? fakeNotes.filter((n) => n.createdAt > cutoff)
          : fakeNotes;
        return {
          unreadCount: unreadNotes.length,
          hasImportantUnread: unreadNotes.some((n) => n.important),
        };
      });
    const markReadSpy = vi
      .spyOn(db, "markTeamNotesRead")
      .mockImplementation(async (identity, readAt = new Date("2026-09-21T07:10:00Z")) => {
        expect(identity.identityKey).toBe("planning-access:42");
        fakeReadAt = readAt;
        return { lastReadAt: readAt };
      });

    const plannerCaller = appRouter.createCaller({
      user: plannerUser,
      req: {
        cookies: {},
        headers: { "user-agent": "Vitest" },
        ip: "127.0.0.1",
      } as any,
      res: {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      } as any,
    });

    // 1. Neuer Login: Planerin Anne Veling sieht alle 3 Notizen als ungelesen inkl. wichtig-Flag
    const initialList = await plannerCaller.notes.list({ limit: 100 });
    expect(initialList.notes).toHaveLength(3);
    expect(initialList.unreadCount).toBe(3);
    expect(initialList.hasImportantUnread).toBe(true);

    // 2. Chat öffnen: markRead setzt serverseitig den Zeitstempel
    const markResult = await plannerCaller.notes.markRead();
    expect(markResult.lastReadAt).toBeInstanceOf(Date);

    // 3. Nach dem Öffnen: Ungelesene Nachrichten stehen sofort auf 0
    const refreshedList = await plannerCaller.notes.list({ limit: 100 });
    expect(refreshedList.unreadCount).toBe(0);
    expect(refreshedList.hasImportantUnread).toBe(false);

    listNotesSpy.mockRestore();
    listTypingSpy.mockRestore();
    getEventSpy.mockRestore();
    accessAllowedSpy.mockRestore();
    passwordChangeReqSpy.mockRestore();
    getUnreadSpy.mockRestore();
    markReadSpy.mockRestore();
  });
});
