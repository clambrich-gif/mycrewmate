import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

describe("Event-Pass Vorbereitungsaufgaben", () => {
  it("legt den Hauptadministrator als zuständige Person vor, ohne das Ansprechpartner-Modul zu öffnen", () => {
    const preparation = source("client/src/pages/Preparation.tsx");

    expect(preparation).toContain('const currentPackageId = tenantProduct?.packageId ?? "event_pass"');
    expect(preparation).toContain('const allowsContacts = productAllowsCapability(currentPackageId, "contacts")');
    expect(preparation).toContain("trpc.prep.defaultResponsible.useQuery");
    expect(preparation).toContain('enabled: !allowsContacts');
    expect(preparation).toContain("const defaultResponsibleId = eventPassPrimaryContact");
    expect(preparation).toContain("setForm({ ...EMPTY_FORM, contactId: defaultResponsibleId })");
  });

  it("erlaubt einen neutralen Bindestrich und speichert ihn als null statt die Aufgabe zu blockieren", () => {
    const preparation = source("client/src/pages/Preparation.tsx");

    expect(preparation).toContain('<SelectItem value="unassigned">-</SelectItem>');
    expect(preparation).toContain('contactId: form.contactId === "unassigned" ? null : Number(form.contactId)');
    expect(preparation).not.toContain('toast.error("Bitte einen verantwortlichen Ansprechpartner wählen")');
  });

  it("liefert den Event-Pass-Hauptansprechpartner serverseitig und hält die API-Eingabe strikt", () => {
    const db = source("server/db.ts");
    const routers = source("server/routers.ts");

    expect(db).toContain("export async function getEventPassPrimaryAdminContact()");
    expect(db).toContain("await ensureEventPassPrimaryAdminContact(db)");
    expect(routers).toContain("defaultResponsible: moduleReadProcedure(\"preparation\")");
    expect(routers).toContain('contactId: z.number().int().positive().nullable().optional()');
    expect(routers).toContain("db.getEventPassPrimaryAdminContact().then");
  });
});
