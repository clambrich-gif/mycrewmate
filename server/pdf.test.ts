import { describe, expect, it } from "vitest";
import type {
  AppSettings,
  Assignment,
  Contact,
  Helper,
  Shift,
  ShiftAreaContact,
} from "../drizzle/schema";
import { WEEKDAYS } from "../shared/weekdays";
import {
  renderAllHelperTaskZip,
  renderBlankPlanPdf,
  renderHelperTaskPdf,
  renderPlanPdf,
  selectPlanEvaluations,
} from "./pdf";

const settings: AppSettings = {
  id: 1,
  eventName: "MyEifelRide",
  eventYear: "2026",
  helperPdfTitle: "Aufgabenübersicht",
  blankPlanTitle: "Einsatzplan – Blanko",
  contactLabel: "Ansprechpartner Vorstand",
  footerText: "Bitte bei Rückfragen anrufen.",
  logoKey: null,
  logoUrl: null,
  extraColumns: JSON.stringify(["Bestätigt", "Notiz"]),
  blankRowsPerShift: 3,
  updatedAt: new Date(),
};

const contacts: Contact[] = [
  {
    id: 1,
    name: "Martin Reis",
    phone: "+49 170 1234567",
    note: null,
    sortOrder: 0,
    createdAt: new Date(),
  },
];

const helpers: Helper[] = [
  {
    id: 1,
    contactId: 1,
    name: "Elena Adams",
    email: null,
    phone: null,
    note: "Bitte am Freitag pünktlich erscheinen.",
    willHelp: "ja",
    availFri: "ja",
    availSat: "ja",
    availSun: "nein",
    confirmed: "ja",
    createdAt: new Date(),
  },
  {
    id: 2,
    contactId: 1,
    name: "Christian Lambrich",
    email: null,
    phone: null,
    note: null,
    willHelp: "ja",
    availFri: "ja",
    availSat: "ja",
    availSun: "ja",
    confirmed: "ja",
    createdAt: new Date(),
  },
];

const shifts: Shift[] = [
  {
    id: 1,
    day: "Freitag",
    area: "Aufbau",
    task: "Aufbau Zelte, Verkabelung, Absperrgitter und Banner",
    startTime: "17:00",
    endTime: "21:00",
    needed: 2,
    note: "Treffpunkt am Materialcontainer",
    sortOrder: 1,
    createdAt: new Date(),
  },
  {
    id: 2,
    day: "Samstag",
    area: "Start",
    task: "Anmeldung Brevets",
    startTime: "06:30",
    endTime: "10:00",
    needed: 1,
    note: null,
    sortOrder: 2,
    createdAt: new Date(),
  },
];

const assignments: Assignment[] = [
  { id: 1, shiftId: 1, helperId: 1, slot: 0, createdAt: new Date() },
  { id: 2, shiftId: 1, helperId: 2, slot: 1, createdAt: new Date() },
  { id: 3, shiftId: 2, helperId: 1, slot: 0, createdAt: new Date() },
];

const areaContacts: ShiftAreaContact[] = [
  {
    id: 1,
    area: "Aufbau",
    contactId: 1,
    updatedAt: new Date(),
  },
];

const data = {
  helpers,
  contacts,
  shifts,
  assignments,
  areaContacts,
  settings,
};

describe("PDF-Erzeugung", () => {
  it("erzeugt eine gültige persönliche Aufgabenübersicht", async () => {
    const pdf = await renderHelperTaskPdf(data, 1);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("bettet ein konfiguriertes Logo in die Helferübersicht ein", async () => {
    const logoBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    const pdf = await renderHelperTaskPdf({ ...data, logoBuffer }, 1);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
  });

  it("erzeugt einen gültigen konfigurierbaren Blanko-Plan", async () => {
    const pdf = await renderBlankPlanPdf(data);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });

  it("erzeugt gefilterte Blanko- und ausgefüllte Einsatzpläne", async () => {
    const blank = await renderPlanPdf(data, {
      mode: "blank",
      days: ["Freitag"],
      areas: ["Aufbau"],
      statuses: ["OK"],
      contactIds: [1],
    });
    const filled = await renderPlanPdf(data, {
      mode: "filled",
      days: ["Freitag"],
      areas: ["Aufbau"],
      statuses: ["OK"],
      contactIds: [1],
    });
    expect(blank.subarray(0, 5).toString()).toBe("%PDF-");
    expect(filled.subarray(0, 5).toString()).toBe("%PDF-");
    expect(blank.length).toBeGreaterThan(2_000);
    expect(filled.length).toBeGreaterThan(2_000);
  });

  it("filtert zugeordnete und unzugeordnete Bereiche ausdrücklich", () => {
    const assignedOnly = selectPlanEvaluations(data, {
      mode: "filled",
      contactIds: [1],
      includeUnassignedContact: false,
    });
    const unassignedOnly = selectPlanEvaluations(data, {
      mode: "filled",
      contactIds: [],
      includeUnassignedContact: true,
    });
    const all = selectPlanEvaluations(data, {
      mode: "filled",
      contactIds: [1],
      includeUnassignedContact: true,
    });

    expect(assignedOnly.map(item => item.shift.area)).toEqual(["Aufbau"]);
    expect(unassignedOnly.map(item => item.shift.area)).toEqual(["Start"]);
    expect(all.map(item => item.shift.area)).toEqual(["Aufbau", "Start"]);
  });

  it.each(WEEKDAYS)("filtert den PDF-Plan auf %s", day => {
    const weeklyShifts = WEEKDAYS.map((weekday, index) => ({
      ...shifts[0],
      id: 100 + index,
      day: weekday,
      task: `Aufgabe ${weekday}`,
    }));
    const result = selectPlanEvaluations(
      { ...data, shifts: weeklyShifts, assignments: [] },
      { mode: "filled", days: [day] }
    );
    expect(result.map(item => item.shift.day)).toEqual([day]);
  });

  it("liefert für unbekannte Helfer einen klaren Fehler", () => {
    expect(() => renderHelperTaskPdf(data, 999)).toThrow("nicht gefunden");
  });

  it("bündelt alle Helfer-PDFs in Ansprechpartnerordnern", async () => {
    const zip = await renderAllHelperTaskZip(data);
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    expect(zip.toString("latin1")).toContain(
      "Martin_Reis/Aufgaben_Elena_Adams.pdf"
    );
    expect(zip.toString("latin1")).toContain(
      "Martin_Reis/Aufgaben_Christian_Lambrich.pdf"
    );
  });
});
