import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

describe("Event-Pass: Ortshinweise und Upgrade-Überleitung", () => {
  it("blendet Standortverwaltung im Event Pass aus und markiert Standorte klar als Pro-Funktion", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const preparation = source("client/src/pages/Preparation.tsx");

    // Einsatzplan-Schichtdialog
    expect(plan).toContain('data-slot="shift-dialog-location"');
    expect(plan).toContain('isEventPass && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Ab Pro verfügbar</Badge>');
    expect(plan).toContain("Im Event Pass werden Standorte nicht verwaltet. Die Schicht kann ohne Ortsangabe angelegt werden.");

    // Vorbereitung: Filter und Dialog
    expect(preparation).toContain("{!isEventPass && <Select");
    expect(preparation).toContain('value={locationFilter ? String(locationFilter) : "alle"}');
    expect(preparation).toContain('isEventPass && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Ab Pro verfügbar</Badge>');
    expect(preparation).toContain("Im Event Pass werden Standorte nicht verwaltet. Die Aufgabe wird ohne Ortsangabe angelegt.");
  });

  it("sichert beim Upgrade vom Event Pass auf Light oder Pro die Helferverantwortung in der Datenbank", () => {
    const db = source("server/db.ts");
    const schema = source("drizzle/schema.ts");

    expect(schema).toContain("eventPassResponsibleHelperId: int(");
    expect(db).toContain("upgradesFromEventPass =");
    expect(db).toContain('previousAssignment?.packageId === "event_pass"');
    expect(db).toContain('input.packageId !== "event_pass"');
    expect(db).toContain("set({ eventPassResponsibleHelperId: sql`${prepTasks.helperId}` })");
    expect(db).toContain("isNull(prepTasks.contactId)");
    expect(db).toContain("isNotNull(prepTasks.helperId)");
    expect(db).toContain("upgradedFromEventPass: Boolean(upgradesFromEventPass)");
  });

  it("zeigt übernommene Event-Pass-Helfer in der Vorbereitung verständlich an und beendet die Überleitung erst bei bewusster Kontaktwahl", () => {
    const preparation = source("client/src/pages/Preparation.tsx");
    const db = source("server/db.ts");

    expect(preparation).toContain("Aus Event Pass übernommen:");
    expect(preparation).toContain("Ansprechpartner noch wählen");
    expect(preparation).toContain("Der ursprünglich gewählte Helfer");
    expect(db).toContain('typeof values.contactId === "number" && values.contactId > 0');
    expect(db).toContain("{ ...values, eventPassResponsibleHelperId: null }");
  });

  it("erklärt die sichere Überleitung transparent im Master-Admin-Produktwechseldialog", () => {
    const masterAdmin = source("client/src/pages/MasterAdminPortal.tsx");

    expect(masterAdmin).toContain('productModalTenant.productAssignment.packageId === "event_pass"');
    expect(masterAdmin).toContain('productAssignmentForm.packageId !== "event_pass"');
    expect(masterAdmin).toContain("Sichere Überleitung aus dem Event Pass:");
    expect(masterAdmin).toContain("Die bisher als verantwortlich gewählten Helfer bleiben bei ihren Vorbereitungsaufgaben sichtbar.");
    expect(masterAdmin).toContain("es wird nichts gelöscht oder automatisch umgedeutet.");
  });
});
