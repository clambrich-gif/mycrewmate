import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

describe("Event-Pass Vorbereitungsaufgaben", () => {
  it("nutzt im Event Pass ausschließlich angelegte Helfer als Verantwortliche", () => {
    const preparation = source("client/src/pages/Preparation.tsx");

    expect(preparation).toContain('const currentPackageId = tenantProduct?.packageId ?? "event_pass"');
    expect(preparation).toContain('const allowsContacts = productAllowsCapability(currentPackageId, "contacts")');
    expect(preparation).toContain('const isEventPass = currentPackageId === "event_pass"');
    expect(preparation).toContain('<Label>Verantwortlicher Helfer</Label>');
    expect(preparation).toContain("Im Event Pass wird die Aufgabe direkt einem angelegten Helfer zugeordnet.");
    expect(preparation).not.toContain("trpc.prep.defaultResponsible.useQuery");
  });

  it("erlaubt einen neutralen Bindestrich und speichert ihn als null statt die Aufgabe zu blockieren", () => {
    const preparation = source("client/src/pages/Preparation.tsx");

    expect(preparation).toContain('<SelectItem value="unassigned">-</SelectItem>');
    expect(preparation).toContain('contactId: form.contactId === "unassigned" ? null : Number(form.contactId)');
    expect(preparation).not.toContain('toast.error("Bitte einen verantwortlichen Ansprechpartner wählen")');
  });

  it("hält die API-Eingabe weiterhin auf gültige Personen-IDs begrenzt", () => {
    const routers = source("server/routers.ts");

    expect(routers).toContain('contactId: z.number().int().positive().nullable().optional()');
    expect(routers).toContain('helperId: z.number().int().positive().nullable().optional()');
  });
});
