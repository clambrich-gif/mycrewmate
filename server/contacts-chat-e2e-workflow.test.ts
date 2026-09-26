import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { contacts, helpers, teamNotes } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";

const EVENT_YEAR = 2027;
const EVENT_ID = 1020001;
const TEST_ADMIN = {
  // Kennwort-Administratoren haben bewusst keine users-Zeile. Die Chatroute
  // übermittelt daher null als senderUserId und speichert ausschließlich die
  // serverseitig bestätigte Absenderbezeichnung.
  id: 0,
  openId: "contacts-chat-e2e-admin",
  name: "E2E Administrator",
  email: null,
  loginMethod: "admin-password",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext() {
  return {
    user: TEST_ADMIN,
    req: {
      protocol: "https",
      headers: {
        "x-event-year": String(EVENT_YEAR),
        "x-event-id": String(EVENT_ID),
      },
      socket: { remoteAddress: "127.0.0.1" },
    },
    res: {},
  } as any;
}

describe("E2E Ansprechpartner- und Teamchat-Workflow", () => {
  it("legt einen Ansprechpartner an, hält ihn im Eventscope sichtbar und übermittelt eine Chatnachricht ohne Restdaten", async () => {
    const database = await getDb();
    if (!database) throw new Error("Keine Datenbankverbindung");

    const token = `E2E-${Date.now()}`;
    const name = `E2E Ansprechpartner ${token}`;
    const email = `e2e-ansprechpartner-${Date.now()}@example.invalid`;
    const caller = appRouter.createCaller(createContext());
    let contactId: number | null = null;
    let helperId: number | null = null;
    let noteId: number | null = null;

    try {
      // 1. Neuanlage über den öffentlichen Routerweg: Ansprechpartner,
      //    zugehöriger Helfer und Eventscope müssen atomar entstehen.
      const created = await caller.contacts.create({
        name,
        email,
        phone: "0170 0000000",
        note: "E2E-Prüfung ohne Produktionsbezug",
      });
      contactId = Number(created.id);
      helperId = Number(created.helperId);
      expect(created.created).toBe(true);
      expect(contactId).toBeGreaterThan(0);
      expect(helperId).toBeGreaterThan(0);

      // 2. Der neue Ansprechpartner ist ohne Seitenwechsel im korrekten
      //    Veranstaltungsbereich sichtbar und behält seine Eingabedaten.
      const contactsAfterCreate = await caller.contacts.list();
      const createdContact = contactsAfterCreate.find(contact => contact.id === contactId);
      expect(createdContact).toMatchObject({
        id: contactId,
        name,
        email,
        phone: "0170 0000000",
        note: "E2E-Prüfung ohne Produktionsbezug",
      });

      // 3. Teamchat senden und erneut aus dem gleichen bestätigten
      //    Eventscope lesen. Dies prüft die Chatfunktion unabhängig von
      //    Fachbereichsrechten und ohne Browser-/Sitzungsreste.
      const message = `E2E Chatnachricht ${token}`;
      const sent = await caller.notes.send({ message, important: false });
      noteId = Number(sent.id);
      expect(noteId).toBeGreaterThan(0);
      expect(sent).toMatchObject({
        eventId: EVENT_ID,
        year: EVENT_YEAR,
        senderName: TEST_ADMIN.name,
        message,
      });

      const snapshot = await caller.notes.list({ limit: 150 });
      expect(snapshot.notes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: noteId,
            eventId: EVENT_ID,
            year: EVENT_YEAR,
            senderName: TEST_ADMIN.name,
            message,
          }),
        ])
      );
    } finally {
      // Die E2E-Prüfung hinterlässt keine Ansprechpartner-, Helfer- oder
      // Chatdaten. Die Bereinigung erfolgt absichtlich direkt und ohne
      // fachliche Löschprotokolle, damit der Pilotbestand unverändert bleibt.
      if (noteId) {
        await (database as any)
          .delete(teamNotes)
          .where(and(eq(teamNotes.id, noteId), eq(teamNotes.eventId, EVENT_ID)));
      }
      if (helperId) {
        await (database as any).delete(helpers).where(eq(helpers.id, helperId));
      }
      if (contactId) {
        await (database as any).delete(contacts).where(eq(contacts.id, contactId));
      }
    }
  });
});
