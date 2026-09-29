import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Vereinsadmin bei Vereinsanlage", () => {
  it("akzeptiert ein optionales Initialpasswort nur serverseitig validiert und gehasht", () => {
    const routers = source("server/routers.ts");

    expect(routers).toContain("initialAdmin: z");
    expect(routers).toContain("passwordConfirmation: passwordInput");
    expect(routers).toContain("Die beiden Initialpasswörter stimmen nicht überein");
    expect(routers).toContain("passwordHash: await hashPassword(initialAdmin.password)");
    expect(routers).not.toContain("password: initialAdmin.password,");
  });

  it("legt Verein, Startveranstaltung, Produktzuordnung und persönlichen Admin atomar an", () => {
    const db = source("server/db.ts");

    expect(db).toContain("return database.transaction(async tx => {");
    expect(db).toContain("await tx.insert(tenantProductAssignments).values");
    expect(db).toContain("await upsertTenantAdminForPlatformAdmin(tx, {");
    expect(db).toContain("mustChangePassword: true");
    expect(db).toContain("initialAdminCreated: Boolean(input.initialAdmin)");
  });

  it("zeigt ausschließlich einen nicht sensiblen Aktivierungsstatus pro Verein", () => {
    const db = source("server/db.ts");
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(db).toContain("export type TenantAdminActivationSummary");
    expect(db).toContain("adminActivationByTenant");
    expect(page).toContain("function TenantAdminActivationStatus");
    expect(page).toContain("Vereinsadministrator hat sein Passwort eingerichtet.");
    expect(page).toContain("Ersteinrichtung offen.");
    expect(page).toContain("refetchInterval: 30_000");
  });

  it("bietet das Initialpasswort als bewusst optionale Master-Admin-Eingabe an", () => {
    const page = source("client/src/pages/MasterAdminPortal.tsx");

    expect(page).toContain("Admin direkt mit Initialpasswort einrichten");
    expect(page).toContain('type="password"');
    expect(page).toContain("Das Initialpasswort wird nur verschlüsselt gespeichert");
    expect(page).toContain("initialAdminPasswordConfirmation");
  });
});
