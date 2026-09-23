import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Planungsteam-Einladungen und Ansprechpartner-E-Mails", () => {
  it("enthält die E-Mail-Spalte in der contacts-Tabelle und der planning_team_invitations-Tabelle", () => {
    const schema = readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    expect(schema).toContain('email: varchar("email", { length: 320 })');
    expect(schema).toContain("export const planningTeamInvitations = mysqlTable");
    expect(schema).toContain('tokenHash: varchar("tokenHash", { length: 64 }).primaryKey()');
    expect(schema).toContain('accessId: int("accessId").notNull()');
  });

  it("stellt im Server Routen für Einladungslinks und E-Mail-Versand an Planungsteams bereit", () => {
    const routers = readFileSync(
      path.resolve(__dirname, "routers.ts"),
      "utf8"
    );
    expect(routers).toContain("createWithInvitationLink: accountAdminProcedure");
    expect(routers).toContain("sendInvitationLink: accountAdminProcedure");
    expect(routers).toContain("consumePlanningTeamInvitation: publicProcedure");
    expect(routers).toContain("renderPlanningTeamInvitationEmail");
  });

  it("bietet in Contacts.tsx die Eingabe und Bearbeitung von E-Mail-Adressen an", () => {
    const contactsPage = readFileSync(
      path.resolve(__dirname, "../client/src/pages/Contacts.tsx"),
      "utf8"
    );
    expect(contactsPage).toContain('id="new-contact-email"');
    expect(contactsPage).toContain('id="edit-contact-email"');
    expect(contactsPage).toContain("contact.email");
  });

  it("übernimmt in PlanningTeamAccessManager.tsx bei Kontaktauswahl automatisch die hinterlegte E-Mail", () => {
    const manager = readFileSync(
      path.resolve(__dirname, "../client/src/components/PlanningTeamAccessManager.tsx"),
      "utf8"
    );
    expect(manager).toContain("email: contact.email ? contact.email : current.email");
    expect(manager).toContain("createWithInvitationLink");
    expect(manager).toContain("sendInvitationLink");
    expect(manager).toContain("Aktivierungslink senden");
  });
});
