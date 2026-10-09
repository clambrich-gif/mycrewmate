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
    expect(routers).toMatch(/createWithInvitationLink:\s*(tenantAccessAdminProcedure|personalAccessAdminProcedure)/);
    expect(routers).toMatch(/sendInvitationLink:\s*(tenantAccessAdminProcedure|personalAccessAdminProcedure)/);
    expect(routers).toContain("consumePlanningTeamInvitation: publicProcedure");
    expect(routers).toContain("renderPlanningTeamInvitationEmail");
    expect(routers).toContain("planningModuleSummary");
    expect(routers).toContain("PLANNING_MODULE_META[module].label");
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

  it("übernimmt bei Kontaktauswahl nur die E-Mail dieser Person und versendet nie automatisch", () => {
    const manager = readFileSync(
      path.resolve(__dirname, "../client/src/components/PlanningTeamAccessManager.tsx"),
      "utf8"
    );
    const router = readFileSync(path.resolve(__dirname, "routers.ts"), "utf8");
    const masterPortal = readFileSync(
      path.resolve(__dirname, "../client/src/pages/MasterAdminPortal.tsx"),
      "utf8"
    );

    expect(manager).toContain("const [sendEmailInvite, setSendEmailInvite] = useState(false)");
    expect(manager).toContain("const createEmptyForm = (): FormState =>");
    expect(manager).toContain("useState<FormState>(createEmptyForm)");
    expect(manager).toContain("setForm(createEmptyForm())");
    expect(manager).toContain('email: contact.email ?? ""');
    expect(manager).not.toContain("email: contact.email ? contact.email : current.email");
    expect(manager).toContain('autoComplete="off"');
    expect(manager).toContain("disabled={busy || form.contactId === null}");
    expect(manager).toContain("form.contactId !== null && form.email.trim()");
    expect(manager).toContain("setSendEmailInvite(false);");
    expect(router).toContain("sendEmail: z.boolean().default(false)");
    expect(router).not.toContain("sendEmail: z.boolean().default(true)");
    expect(masterPortal).toContain("const [sendInvitationEmail, setSendInvitationEmail] = useState(false)");
    expect(masterPortal).toContain('setAdminEmail("");');
    expect(masterPortal).toContain("Erst Name und E-Mail der Person eintragen");
    expect(manager).toContain("createWithInvitationLink");
    expect(manager).toContain("sendInvitationLink");
    expect(manager).toContain("Aktivierungslink senden");
  });
});
