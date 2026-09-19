import { describe, expect, it } from "vitest";
import type {
  AppSettings,
  Assignment,
  Cake,
  Contact,
  Helper,
  Location,
  Shift,
  ShiftAreaContact,
} from "../drizzle/schema";
import { WEEKDAYS } from "../shared/weekdays";
import {
  renderAllHelperTaskZip,
  renderBlankPlanPdf,
  renderHelperTaskPdf,
  renderPlanPdf,
  selectHelpersForContact,
  selectPlanEvaluations,
  helperTimeBadgeLabel,
  helperPdfTimeLabel,
  buildHelperSummaryEntries,
  helperPdfPastels,
  helperTaskCellParts,
  helperTaskCellText,
  helperCakeSummaryLine,
  planPdfTimeLabel,
  MATERIAL_PACKLIST_PORTRAIT_COLUMNS,
  MATERIAL_PACKLIST_PORTRAIT_WIDTH,
  renderMaterialPacklistPdf,
  renderPostTaskOverviewPdf,
  renderPreparationTaskOverviewPdf,
  selectHelperCakes,
  selectMaterialPacklistMaterials,
  selectTaskOverviewRows,
} from "./pdf";
import { resolveEventPdfLogoKey } from "./event-pdf-image";

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

const cakeLocations: Location[] = [
  {
    id: 15,
    year: 2026,
    eventId: 1,
    name: "Laubach",
    latitude: 50.2,
    longitude: 7.1,
    logoKey: null,
    logoUrl: null,
    sortOrder: 0,
    createdAt: new Date(),
  },
];

const helperCakes: Cake[] = [
  {
    id: 31,
    year: 2026,
    eventId: 1,
    donor: "  Elena   Adams ",
    cake: "Käsekuchen",
    locationId: 15,
    dropoffDate: "2026-06-19",
    dropoffTime: "09:00",
    legacyDropoffText: "",
    vegan: false,
    glutenFree: false,
    lactoseFree: false,
    containsNuts: false,
    note: null,
    sortOrder: 0,
  },
  {
    id: 32,
    year: 2026,
    eventId: 1,
    donor: "Christian Lambrich",
    cake: "Muffins",
    locationId: null,
    dropoffDate: "",
    dropoffTime: "",
    legacyDropoffText: "Sa.: 12 Uhr",
    vegan: false,
    glutenFree: false,
    lactoseFree: false,
    containsNuts: false,
    note: null,
    sortOrder: 1,
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
  it("löst PDF-Bilder streng nach Eventkonfiguration auf", () => {
    expect(
      resolveEventPdfLogoKey({
        pdfLogoKey: "pdf-logos/events/2027/77/weihnachtsbaum.png",
        pdfLogoFallback: "brand",
      })
    ).toBe("pdf-logos/events/2027/77/weihnachtsbaum.png");
    expect(
      resolveEventPdfLogoKey({
        pdfLogoKey: null,
        pdfLogoFallback: "none",
      })
    ).toBeNull();
    expect(
      resolveEventPdfLogoKey({
        pdfLogoKey: null,
        pdfLogoFallback: "brand",
      })
    ).toBe("rsc-eifelland-logo-chrome_25463ad8.png");
  });

  it("erzeugt eine gültige persönliche Aufgabenübersicht", async () => {
    const pdf = await renderHelperTaskPdf(data, 1);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("kennzeichnet zeitlose persönliche Schichten als Ganztags und hält die Zusammenfassung sortiert", () => {
    expect(helperPdfTimeLabel(shifts[0])).toBe("17:00–21:00");
    expect(
      helperPdfTimeLabel({ ...shifts[1], startTime: "", endTime: "" })
    ).toBe("Ganztags");
    expect(
      buildHelperSummaryEntries({
        taskCount: 4,
        daySummary: "Freitag: Zeltplatz, Kühlwagen · Samstag: DJ",
        helperNote: "Kabeltrommel mitbringen",
        cakeLines: ["Käsekuchen (Fr., 09:00 Uhr in Laubach)"],
        contactLabel: "Ansprechpartner",
        contactName: "Martin Reis",
        contactPhone: "0173515544",
      }).map(entry => entry.label)
    ).toEqual([
      "Einteilung",
      "Verfügbarkeit / Bemerkungen",
      "Kuchenspende",
      "Ansprechpartner",
      "Rufnummer",
    ]);
  });

  it("listet Kuchenspenden eines Helfers bedingt und mit Abgabeinformationen", async () => {
    const selected = selectHelperCakes(helperCakes, "Elena Adams");
    expect(selected).toHaveLength(1);
    expect(
      helperCakeSummaryLine(selected[0], new Map([[15, cakeLocations[0]]]))
    ).toBe("Käsekuchen (Fr., 09:00 Uhr in Laubach)");
    expect(selectHelperCakes(helperCakes, "Unbekannt")).toEqual([]);
    expect(selectHelperCakes(undefined, "Elena Adams")).toEqual([]);
    expect(helperCakeSummaryLine(helperCakes[1], new Map())).toBe(
      "Muffins (Sa.: 12 Uhr)"
    );
    const ordered = selectHelperCakes(
      [
        ...helperCakes,
        { ...helperCakes[1], id: 33, donor: "Elena Adams" },
      ],
      "Elena Adams"
    );
    expect(ordered.map(cake => cake.id)).toEqual([31, 33]);

    const pdf = await renderHelperTaskPdf(
      { ...data, cakes: helperCakes, locations: cakeLocations },
      helpers[0].id
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("hält eine typische persönliche Übersicht mit fünf Schichten und Kuchenspende auf einer A4-Seite", async () => {
    const fiveShifts: Shift[] = [
      { ...shifts[0], id: 101, day: "Freitag", task: "Fotobox", area: "Party", startTime: "06:00", endTime: "18:00", note: "Nur von 08:00 bis 12:00 Uhr an der Fotobox." },
      { ...shifts[0], id: 102, day: "Freitag", task: "Pumptrack", area: "Aufbau", startTime: "08:00", endTime: "14:00", note: "Mindestens drei Anhänger benötigt. Einsatz von 13:00 bis 14:00 Uhr." },
      { ...shifts[1], id: 103, day: "Samstag", task: "Zeltplatz", area: "Planung", startTime: "09:00", endTime: "10:00", note: "Material am Infostand abholen." },
      { ...shifts[1], id: 104, day: "Samstag", task: "Bänke", area: "Abbau", startTime: "12:00", endTime: "14:00", note: null },
      { ...shifts[1], id: 105, day: "Sonntag", task: "VP6", area: "Putzen", startTime: "16:00", endTime: "18:00", note: null },
    ];
    const fiveAssignments = fiveShifts.flatMap((shift, index) => [
      { id: 400 + index * 2, shiftId: shift.id, helperId: 1, slot: 0, createdAt: new Date() },
      { id: 401 + index * 2, shiftId: shift.id, helperId: 2, slot: 1, createdAt: new Date() },
    ]);

    const pdf = await renderHelperTaskPdf(
      {
        ...data,
        shifts: fiveShifts,
        assignments: fiveAssignments,
        cakes: helperCakes,
        locations: cakeLocations,
      },
      helpers[0].id
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });

  it("setzt vor Bemerkungen in der persönlichen Aufgabenübersicht eine freie Textzeile", () => {
    expect(helperTaskCellText(shifts[0])).toBe(
      "Aufbau Zelte, Verkabelung, Absperrgitter und Banner\nAufbau\n\nBemerkung: Treffpunkt am Materialcontainer"
    );
    expect(helperTaskCellText(shifts[1])).toBe("Anmeldung Brevets\nStart");
  });

  it("verwendet ausschließlich neutrale Infoboxen im kompakten Helfer-PDF", async () => {
    expect(helperPdfPastels).toEqual({
      timeBackground: "#F9FAFB",
      timeBorder: "#E5E7EB",
      timeText: "#1F2937",
      shiftNoteBackground: "#F9FAFB",
      shiftNoteText: "#1F2937",
      helperNoteBackground: "#F9FAFB",
      helperNoteText: "#1F2937",
    });
    expect(helperTaskCellParts(shifts[0])).toEqual({
      primaryText: "Aufbau Zelte, Verkabelung, Absperrgitter und Banner\nAufbau",
      noteText: "Bemerkung: Treffpunkt am Materialcontainer",
    });
    expect(helperTaskCellParts({ ...shifts[1], note: "   " })).toEqual({
      primaryText: "Anmeldung Brevets\nStart",
      noteText: null,
    });

    const noNotesPdf = await renderHelperTaskPdf(
      {
        ...data,
        helpers: [{ ...helpers[0], note: "   " }, helpers[1]],
        shifts: shifts.map(shift => ({ ...shift, note: null })),
      },
      helpers[0].id
    );
    expect(noNotesPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(noNotesPdf.length).toBeGreaterThan(2_000);
    expect(noNotesPdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });

  it("kennzeichnet ein individuelles Zeitfenster kompakt im Helfer-PDF", async () => {
    const timedHelper = {
      ...helpers[0],
      availFriStart: "08:00",
      availFriEnd: "13:00",
    };

    expect(helperTimeBadgeLabel(timedHelper, "Freitag")).toBe(
      "Zeitfenster: 08:00–13:00 Uhr"
    );
    expect(helperTimeBadgeLabel(timedHelper, "Samstag")).toBeNull();
    const pdf = await renderHelperTaskPdf(
      { ...data, helpers: [timedHelper, helpers[1]] },
      timedHelper.id
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("kennzeichnet flexible Schichtbelegung in der Zeitspalte des Einsatzplan-PDFs", async () => {
    const flexibleShift = {
      ...shifts[0],
      allowFlexibleAssignment: true,
    };

    expect(planPdfTimeLabel(flexibleShift)).toBe("17:00–21:00\n(flexibel)");
    expect(planPdfTimeLabel(shifts[1])).toBe("06:30–10:00");
    const pdf = await renderPlanPdf(
      { ...data, shifts: [flexibleShift, shifts[1]] },
      { mode: "filled" }
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
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

  it("erzeugt eine aus der Tabellenansicht gefilterte Material-Packliste als PDF", async () => {
    expect(MATERIAL_PACKLIST_PORTRAIT_WIDTH).toBe(511.28);
    expect(MATERIAL_PACKLIST_PORTRAIT_COLUMNS).toHaveLength(6);
    expect(
      MATERIAL_PACKLIST_PORTRAIT_COLUMNS.find(column => column.key === "contact")
        ?.width
    ).toBeGreaterThanOrEqual(130);
    const sampleLocation = {
      id: 99,
      year: 2026,
      eventId: 1,
      name: "VP8 – Pumptrack",
      latitude: 50.3569,
      longitude: 6.9458,
      sortOrder: 0,
      createdAt: new Date(),
    };
    const sampleMaterials = [
      {
        id: 1,
        year: 2026,
        eventId: 1,
        article: "Flatterband",
        category: "Absperrung",
        quantity: "4",
        unit: "Rollen",
        locationId: 99,
        contactId: 1,
        status: "geliefert" as const,
        note: "Für Kurve 2",
        sortOrder: 1,
      },
      {
        id: 2,
        year: 2026,
        eventId: 1,
        article: "Kabeltrommel",
        category: "Technik",
        quantity: "1",
        unit: "Stück",
        locationId: 99,
        contactId: null,
        status: "offen" as const,
        note: null,
        sortOrder: 2,
      },
      {
        id: 3,
        year: 2026,
        eventId: 1,
        article: "Müllsäcke",
        category: "Entsorgung",
        quantity: "2",
        unit: "Rollen",
        locationId: null,
        contactId: null,
        status: "bestellt" as const,
        note: null,
        sortOrder: 3,
      },
    ];

    expect(selectMaterialPacklistMaterials(sampleMaterials, [2, 3])).toEqual([
      sampleMaterials[2],
      sampleMaterials[1],
    ]);

    const pdf = await renderMaterialPacklistPdf(
      {
        ...data,
        locations: [sampleLocation],
        materials: sampleMaterials,
      },
      [1, 2]
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_500);
  });

  it("erzeugt Vor- und Nachbereitungs-PDFs ausschließlich aus der sichtbaren Aufgabenwahl", async () => {
    const prepTasks = [
      {
        id: 41,
        year: 2026,
        eventId: 1,
        category: "Genehmigung",
        task: "Sperrung abstimmen",
        dueText: "15.05.2026",
        locationId: null,
        contactId: 1,
        status: "inArbeit" as const,
        statusWording: "genehmigung" as const,
        note: "18.04.2026 09:00 Uhr (Organisation): Unterlagen eingereicht",
        deleted: false,
        sortOrder: 1,
      },
      {
        id: 42,
        year: 2026,
        eventId: 1,
        category: "Strecke",
        task: "Beschilderung planen",
        dueText: "",
        locationId: null,
        contactId: null,
        status: "offen" as const,
        statusWording: "aufgabe" as const,
        note: null,
        deleted: false,
        sortOrder: 2,
      },
    ];
    const postTasks = [
      {
        id: 61,
        year: 2026,
        eventId: 1,
        category: "Abbau",
        task: "Material zurückführen",
        dueText: "22.06.2026",
        locationId: null,
        contactId: 1,
        status: "erledigt" as const,
        note: "20.06.2026 15:00 Uhr (Organisation): Abgeschlossen",
        deleted: false,
        sortOrder: 1,
      },
    ];

    expect(selectTaskOverviewRows(prepTasks, [42])).toEqual([prepTasks[1]]);
    const preparationPdf = await renderPreparationTaskOverviewPdf(
      { ...data, prepTasks, postTasks },
      [41]
    );
    const postPdf = await renderPostTaskOverviewPdf(
      { ...data, prepTasks, postTasks },
      [61]
    );

    expect(preparationPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(postPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(preparationPdf.length).toBeGreaterThan(1_500);
    expect(postPdf.length).toBeGreaterThan(1_500);
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

  it("beschränkt Helferübersichten auf den ausgewählten Ansprechpartner", async () => {
    const secondContact: Contact = {
      ...contacts[0],
      id: 2,
      name: "Lukas Geisbüsch",
    };
    const secondHelper: Helper = {
      ...helpers[1],
      id: 3,
      name: "Mara Zweig",
      contactId: 2,
    };
    const filteredData = {
      ...data,
      contacts: [...contacts, secondContact],
      helpers: [...helpers, secondHelper],
    };

    expect(selectHelpersForContact(filteredData.helpers, 2)).toEqual([
      secondHelper,
    ]);
    const zip = await renderAllHelperTaskZip(filteredData, 2);
    expect(zip.toString("latin1")).toContain(
      "Lukas_Geisbusch/Aufgaben_Mara_Zweig.pdf"
    );
    expect(zip.toString("latin1")).not.toContain(
      "Aufgaben_Elena_Adams.pdf"
    );
  });
});
