import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Helper, Shift } from "../drizzle/schema";
import { WEEKDAYS } from "../shared/weekdays";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listShifts: vi.fn(),
  listHelpers: vi.fn(),
  listAssignments: vi.fn(),
  assignHelper: vi.fn(),
  unassignHelper: vi.fn(),
  clearAssignments: vi.fn(),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
  upsertHelperByName: vi.fn(),
  updateHelper: vi.fn(),
  deleteHelper: vi.fn(),
  deleteCake: vi.fn(),
  createPrep: vi.fn(),
  updatePrep: vi.fn(),
  deletePrep: vi.fn(),
  resetArea: vi.fn(),
  listPrep: vi.fn(),
  listPost: vi.fn(),
  listContacts: vi.fn(),
  listMaterials: vi.fn(),
  listMarketing: vi.fn(),
  listApprovals: vi.fn(),
  listDeletionAuditLogs: vi.fn(),
  clearDeletionAuditLogs: vi.fn(),
  restoreDeletionAuditLog: vi.fn(),
  getSecuritySettings: vi.fn(),
  setPasswordHash: vi.fn(),
  setAdminPasswordHash: vi.fn(),
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  getEvent: vi.fn(),
  updateCurrentEventPdfImage: vi.fn(),
  createEvent: vi.fn(),
  updateEventName: vi.fn(),
  deleteEvent: vi.fn(),
  deleteContact: vi.fn(),
  getContact: vi.fn(),
  getHelper: vi.fn(),
  ensureHelperPdfShareCode: vi.fn(),
  listShiftAreaContacts: vi.fn(),
  setShiftAreaContact: vi.fn(),
  withPlanningWriteLock: vi.fn(),
  getLocation: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
}));
const backupMocks = vi.hoisted(() => ({
  clearBackupRestoreLogs: vi.fn(),
  exportProjectExcel: vi.fn(),
  listBackupRestoreLogs: vi.fn(),
  getBackupRestoreLog: vi.fn(),
  withExcelOperationLimit: vi.fn(),
}));
const projectFileMocks = vi.hoisted(() => ({
  exportProjectFile: vi.fn(),
  previewProjectFile: vi.fn(),
  loadProjectFile: vi.fn(),
}));
const moduleImportMocks = vi.hoisted(() => ({
  MODULE_IMPORT_AREAS: [
    "ANSPRECHPARTNER",
    "HELFER",
    "EINSATZPLAN",
    "VORBEREITUNG",
    "NACHBEREITUNG",
    "MATERIAL",
    "MARKETING",
    "GENEHMIGUNGEN",
    "KUCHEN",
    "FINANZEN",
  ],
  previewModuleExcelImport: vi.fn(),
  applyModuleExcelImport: vi.fn(),
}));
const previewBindingMocks = vi.hoisted(() => ({
  createPreviewBinding: vi.fn(() => "preview-binding-test-token"),
  uploadedFileDigest: vi.fn(() => "b".repeat(64)),
  verifyPreviewBinding: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./storage", () => storageMocks);
vi.mock("./excel-backup", () => backupMocks);
vi.mock("./project-file", () => projectFileMocks);
vi.mock("./module-excel-import", () => moduleImportMocks);
vi.mock("./import-preview-binding", () => previewBindingMocks);

import { appRouter } from "./routers";
import { hashPassword } from "./password-auth";
import { ShiftUpdateValidationError } from "./shift-update-validation";

const ADMIN_PASSWORD = "Test-Administrator-2026!";
let adminPasswordHash = "";

const shift: Shift = {
  id: 10,
  day: "Freitag",
  area: "Start",
  task: "Anmeldung",
  startTime: "08:00",
  endTime: "10:00",
  needed: 2,
  note: null,
  sortOrder: 0,
  createdAt: new Date(),
};

const helper: Helper = {
  id: 20,
  contactId: null,
  name: "Alex",
  email: null,
  phone: null,
  willHelp: "ja",
  availFri: "ja",
  availSat: "nein",
  availSun: "nein",
  confirmed: "ja",
  createdAt: new Date(),
};

const ctx = {
  user: {
    id: 1,
    openId: "organizer",
    name: "Organisation",
    email: null,
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {
    protocol: "https",
    headers: { "x-forwarded-for": "127.0.0.99" },
    socket: { remoteAddress: "127.0.0.99" },
  },
  res: {},
} as TrpcContext;

const planningTeamCtx = {
  ...ctx,
  user: { ...ctx.user!, id: 2, openId: "planning-team", role: "user" as const },
} as TrpcContext;

describe("Planungs-API", () => {
  beforeAll(async () => {
    adminPasswordHash = await hashPassword(ADMIN_PASSWORD);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    previewBindingMocks.createPreviewBinding.mockReturnValue(
      "preview-binding-test-token"
    );
    previewBindingMocks.uploadedFileDigest.mockReturnValue("b".repeat(64));
    previewBindingMocks.verifyPreviewBinding.mockImplementation(() => undefined);
    dbMocks.listShifts.mockResolvedValue([shift]);
    dbMocks.listHelpers.mockResolvedValue([helper]);
    dbMocks.listAssignments.mockResolvedValue([]);
    dbMocks.listPrep.mockResolvedValue([]);
    dbMocks.listPost.mockResolvedValue([]);
    dbMocks.listContacts.mockResolvedValue([]);
    dbMocks.listMaterials.mockResolvedValue([]);
    dbMocks.listMarketing.mockResolvedValue([]);
    dbMocks.listApprovals.mockResolvedValue([]);
    dbMocks.assignHelper.mockResolvedValue({ insertId: 1 });
    dbMocks.updateShift.mockResolvedValue({ affectedRows: 1 });
    dbMocks.getContact.mockResolvedValue({ id: 5, name: "Chris Leitung" });
    dbMocks.getHelper.mockResolvedValue(helper);
    dbMocks.ensureHelperPdfShareCode.mockResolvedValue("Ab3dE9F_");
    dbMocks.getEvent.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: [...WEEKDAYS],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    dbMocks.getSecuritySettings.mockResolvedValue({ adminPasswordHash });
    dbMocks.setPasswordHash.mockResolvedValue({ affectedRows: 1 });
    dbMocks.setAdminPasswordHash.mockResolvedValue({ affectedRows: 1 });
    dbMocks.withPlanningWriteLock.mockImplementation(callback => callback());
    storageMocks.storageGetSignedUrl.mockResolvedValue(
      "https://storage.example.test/guide.pdf"
    );
    storageMocks.storagePut.mockResolvedValue({
      key: "pdf-logos/events/2026/1/pdf-logo_test.png",
      url: "/manus-storage/pdf-logos/events/2026/1/pdf-logo_test.png",
    });
    backupMocks.exportProjectExcel.mockResolvedValue({
      buffer: Buffer.from("xlsx"),
      exportedAt: "2026-09-11T10:00:00.000Z",
      eventName: "MyEifelRide",
    });
    projectFileMocks.exportProjectFile.mockResolvedValue({
      buffer: Buffer.from("json"),
      exportedAt: "2026-09-11T10:00:00.000Z",
      eventName: "MyEifelRide",
    });
    projectFileMocks.previewProjectFile.mockResolvedValue({
      metadata: {
        format: "RSC-HELFERPLANUNG-SICHERUNG",
        version: 1,
        eventId: 1,
        eventName: "MyEifelRide",
        year: 2026,
        exportedAt: "2026-09-11T10:00:00.000Z",
      },
      currentDigest: "a".repeat(64),
      workbookDigest: "b".repeat(64),
      previewBinding: "preview-binding-test-token",
      warnings: [],
      changes: [],
      totals: { created: 0, updated: 0, deleted: 0, unchanged: 0, byArea: {} },
    });
    projectFileMocks.loadProjectFile.mockResolvedValue({
      created: 1,
      updated: 2,
      deleted: 3,
      warnings: [],
      afterDigest: "c".repeat(64),
    });
    backupMocks.listBackupRestoreLogs.mockResolvedValue([]);
    backupMocks.clearBackupRestoreLogs.mockResolvedValue({ deleted: 3 });
    moduleImportMocks.previewModuleExcelImport.mockResolvedValue({
      area: "HELFER",
      areaName: "Helfer",
      currentDigest: "a".repeat(64),
      sourceDigest: "b".repeat(64),
      previewBinding: "preview-binding-test-token",
      warnings: [],
      changes: [],
      totals: { created: 0, updated: 0, deleted: 0 },
    });
    moduleImportMocks.applyModuleExcelImport.mockResolvedValue({
      created: 1,
      updated: 2,
      deleted: 3,
      warnings: [],
      afterDigest: "c".repeat(64),
    });
    backupMocks.withExcelOperationLimit.mockImplementation(callback =>
      callback()
    );
  });

  it("berechnet Rückmeldequote und Tagesbesetzung aus gültigen Helferzuweisungen", async () => {
    dbMocks.listShifts.mockResolvedValue([
      shift,
      { ...shift, id: 11, day: "Samstag", task: "Ausgabe" },
    ]);
    dbMocks.listHelpers.mockResolvedValue([
      {
        ...helper,
        id: 20,
        name: "Alex",
        confirmed: "ja",
        availSat: "ja",
      },
      { ...helper, id: 21, name: "Bea", confirmed: "nein" },
      { ...helper, id: 22, name: "Chris", confirmed: "ja" },
    ]);
    dbMocks.listAssignments.mockResolvedValue([
      { id: 1, shiftId: 10, helperId: 20, slot: 0, createdAt: new Date() },
      { id: 2, shiftId: 10, helperId: 21, slot: 1, createdAt: new Date() },
      { id: 3, shiftId: 11, helperId: 20, slot: 0, createdAt: new Date() },
      { id: 4, shiftId: 11, helperId: null, slot: 1, createdAt: new Date() },
    ]);

    const stats = await appRouter.createCaller(ctx).dashboard.stats();

    expect(stats.helferEingeteilt).toBe(2);
    expect(stats.helferEingeteiltBestaetigt).toBe(1);
    expect(stats.helferEingeteiltUnbestaetigt).toBe(1);
    expect(stats.rueckmeldequote).toBe(50);
    expect(stats.taeglicheEinsatzbereitschaft).toEqual([
      {
        day: "Freitag",
        bedarf: 2,
        besetzt: 2,
        fehlend: 0,
        quote: 100,
        ungenutzteHelfer: 1,
        teilzeitReserve: 0,
        ungenutzteHelferIds: [22],
        teilzeitReserveIds: [],
      },
      {
        day: "Samstag",
        bedarf: 2,
        besetzt: 1,
        fehlend: 1,
        quote: 50,
        ungenutzteHelfer: 0,
        teilzeitReserve: 0,
        ungenutzteHelferIds: [],
        teilzeitReserveIds: [],
      },
      {
        day: "Sonntag",
        bedarf: 0,
        besetzt: 0,
        fehlend: 0,
        quote: 0,
        ungenutzteHelfer: 0,
        teilzeitReserve: 0,
        ungenutzteHelferIds: [],
        teilzeitReserveIds: [],
      },
    ]);
  });

  it("berechnet die Erstkontaktquote aus den Fragezeichen aktiver Festivaltage", async () => {
    dbMocks.getEvent.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    dbMocks.listHelpers.mockResolvedValue([
      {
        ...helper,
        id: 20,
        name: "Neu",
        confirmed: "nein",
        willHelp: "ja",
        availFri: "vielleicht",
        availSat: "vielleicht",
        availSun: "vielleicht",
      },
      {
        ...helper,
        id: 21,
        name: "Kontaktiert",
        confirmed: "nein",
        willHelp: "ja",
        availFri: "ja",
        availSat: "vielleicht",
        availSun: "vielleicht",
      },
      {
        ...helper,
        id: 22,
        name: "Abgesagt",
        confirmed: "nein",
        willHelp: "nein",
        availFri: "vielleicht",
        availSat: "vielleicht",
        availSun: "vielleicht",
      },
    ]);

    const stats = await appRouter.createCaller(ctx).dashboard.stats();

    expect(stats.helferGesamt).toBe(3);
    expect(stats.helferOhneErstkontakt).toBe(1);
    expect(stats.helferKontaktiert).toBe(2);
    expect(stats.erstkontaktquote).toBe(67);
  });

  it("ermittelt ungenutzte Helfer und Teilzeit-Reserve tagesgenau aus aktiver Verfügbarkeit und gültigen Zuweisungen", async () => {
    dbMocks.getEvent.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    dbMocks.listShifts.mockResolvedValue([
      shift,
      { ...shift, id: 11, day: "Samstag", task: "Ausgabe" },
    ]);
    dbMocks.listHelpers.mockResolvedValue([
      {
        ...helper,
        id: 20,
        name: "Ungenutzt",
        availFri: "ja",
        availSat: "nein",
        availSun: "nein",
      },
      {
        ...helper,
        id: 21,
        name: "Teilzeit",
        availFri: "ja",
        availSat: "ja",
        availSun: "nein",
      },
      {
        ...helper,
        id: 22,
        name: "Voll eingeplant",
        availFri: "ja",
        availSat: "ja",
        availSun: "nein",
      },
      {
        ...helper,
        id: 23,
        name: "Abgesagt",
        willHelp: "nein",
        availFri: "ja",
        availSat: "ja",
        availSun: "ja",
      },
    ]);
    dbMocks.listAssignments.mockResolvedValue([
      { id: 1, shiftId: 10, helperId: 21, slot: 0, createdAt: new Date() },
      { id: 2, shiftId: 10, helperId: 22, slot: 1, createdAt: new Date() },
      { id: 3, shiftId: 11, helperId: 22, slot: 0, createdAt: new Date() },
    ]);

    const stats = await appRouter.createCaller(ctx).dashboard.stats();

    expect(stats.taeglicheEinsatzbereitschaft.map(day => ({
      day: day.day,
      ungenutzteHelfer: day.ungenutzteHelfer,
      teilzeitReserve: day.teilzeitReserve,
      ungenutzteHelferIds: day.ungenutzteHelferIds,
      teilzeitReserveIds: day.teilzeitReserveIds,
    }))).toEqual([
      {
        day: "Freitag",
        ungenutzteHelfer: 1,
        teilzeitReserve: 0,
        ungenutzteHelferIds: [20],
        teilzeitReserveIds: [],
      },
      {
        day: "Samstag",
        ungenutzteHelfer: 0,
        teilzeitReserve: 1,
        ungenutzteHelferIds: [],
        teilzeitReserveIds: [21],
      },
      {
        day: "Sonntag",
        ungenutzteHelfer: 0,
        teilzeitReserve: 0,
        ungenutzteHelferIds: [],
        teilzeitReserveIds: [],
      },
    ]);
  });

  it("fasst Marketing und Genehmigungen als Vorbereitung je Ansprechpartner zusammen", async () => {
    dbMocks.listContacts.mockResolvedValue([{ id: 7, name: "Alex Organisation" }]);
    dbMocks.listHelpers.mockResolvedValue([{ ...helper, contactId: 7 }]);
    dbMocks.listPrep.mockResolvedValue([
      {
        id: 30,
        task: "Strecke abstimmen",
        category: "Strecke",
        dueText: "",
        contactId: 7,
        status: "offen",
      },
    ]);
    dbMocks.listPost.mockResolvedValue([
      { id: 31, task: "Auswertung", contactId: 7, status: "offen" },
    ]);
    dbMocks.listMaterials.mockResolvedValue([
      { id: 32, article: "Funkgeräte", contactId: 7 },
    ]);
    dbMocks.listMarketing.mockResolvedValue([
      { id: 33, measure: "Pressemitteilung", contactId: 7 },
      { id: 34, measure: "Social Post", contactId: 7 },
      { id: 35, measure: "Ohne Zuordnung", contactId: null },
    ]);
    dbMocks.listApprovals.mockResolvedValue([
      { id: 36, request: "Streckensperrung", contactId: 7 },
      { id: 37, request: "Sondernutzung", contactId: 7 },
      { id: 38, request: "Sanitätsdienst", contactId: 7 },
    ]);

    const stats = await appRouter.createCaller(ctx).dashboard.stats();

    expect(stats.verantwortlichkeiten).toEqual([
      {
        name: "Alex Organisation",
        betreuteHelfer: 1,
        vorbereitung: 6,
        nachbereitung: 1,
        material: 1,
        gesamt: 9,
      },
    ]);
    expect(stats.verantwortlichkeiten[0]).not.toHaveProperty("marketing");
    expect(stats.verantwortlichkeiten[0]).not.toHaveProperty("genehmigungen");
  });

  it("liefert in den PDF-Einstellungen nur das Bild des aktuellen Events", async () => {
    dbMocks.getAppSettings.mockResolvedValue({
      id: 1,
      eventName: "Alt",
      eventYear: "2025",
      helperPdfTitle: "Aufgabenübersicht",
      blankPlanTitle: "Einsatzplan – Blanko",
      contactLabel: "Ansprechpartner",
      footerText: "",
      logoKey: "global-alt.png",
      logoUrl: "/manus-storage/global-alt.png",
      extraColumns: "[]",
      blankRowsPerShift: 0,
      updatedAt: new Date(),
    });
    dbMocks.getEvent.mockResolvedValue({
      id: 77,
      year: 2027,
      name: "Weihnachtsfeier",
      activeDays: ["Sonntag"],
      pdfLogoKey: "pdf-logos/events/2027/77/weihnachtsbaum.png",
      pdfLogoUrl:
        "/manus-storage/pdf-logos/events/2027/77/weihnachtsbaum.png",
      pdfLogoFallback: "brand",
      sortOrder: 0,
      createdAt: new Date(),
    });

    const result = await appRouter.createCaller(ctx).pdf.settings();

    expect(result).toMatchObject({
      eventName: "Weihnachtsfeier",
      logoKey: "pdf-logos/events/2027/77/weihnachtsbaum.png",
      logoUrl: "/api/pdf/event-image/2027/77",
      logoFallback: "brand",
    });
    expect(result.logoKey).not.toBe("global-alt.png");
  });

  it("speichert PDF-Bilder im Pfad und Datensatz des aktuellen Events", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );

    await appRouter.createCaller(planningTeamCtx).pdf.uploadLogo({
      base64: png.toString("base64"),
      mimeType: "image/png",
    });

    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      "pdf-logos/events/2026/1/pdf-logo.png",
      png,
      "image/png"
    );
    expect(dbMocks.updateCurrentEventPdfImage).toHaveBeenCalledWith({
      pdfLogoKey: "pdf-logos/events/2026/1/pdf-logo_test.png",
      pdfLogoUrl:
        "/manus-storage/pdf-logos/events/2026/1/pdf-logo_test.png",
    });
  });

  it("entfernt Bild und ändert Fallback ausschließlich im aktuellen Event", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);

    await caller.pdf.clearLogo();
    await caller.pdf.setLogoFallback({ fallback: "brand" });

    expect(dbMocks.updateCurrentEventPdfImage).toHaveBeenNthCalledWith(1, {
      pdfLogoKey: null,
      pdfLogoUrl: null,
    });
    expect(dbMocks.updateCurrentEventPdfImage).toHaveBeenNthCalledWith(2, {
      pdfLogoFallback: "brand",
    });
  });

  it("speichert und liefert die konfigurierbare WhatsApp-Nachrichtenvorlage in den PDF-Einstellungen", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.getAppSettings.mockResolvedValue({
      id: 1,
      eventName: "MyEifelRide",
      eventYear: "2026",
      helperPdfTitle: "Aufgabenübersicht",
      blankPlanTitle: "Einsatzplan – Blanko",
      contactLabel: "Ansprechpartner",
      footerText: "",
      whatsAppMessageTemplate: "Hallo! Dein Plan für {EVENT_NAME} ist da. 🚴💨",
      logoKey: null,
      logoUrl: null,
      extraColumns: "[]",
      blankRowsPerShift: 0,
      updatedAt: new Date(),
    });
    dbMocks.updateAppSettings.mockResolvedValue({ affectedRows: 1 });

    const settings = await caller.pdf.settings();
    expect(settings.whatsAppMessageTemplate).toBe(
      "Hallo! Dein Plan für {EVENT_NAME} ist da. 🚴💨"
    );

    await expect(
      caller.pdf.updateSettings({
        eventName: "MyEifelRide",
        eventYear: "2026",
        helperPdfTitle: "Aufgabenübersicht",
        blankPlanTitle: "Einsatzplan – Blanko",
        contactLabel: "Ansprechpartner",
        footerText: "Hinweis",
        whatsAppMessageTemplate:
          "Individueller Text für {EVENT_NAME}. Bitte zeitnah melden! ⏳",
        extraColumns: [],
        blankRowsPerShift: 0,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.updateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsAppMessageTemplate:
          "Individueller Text für {EVENT_NAME}. Bitte zeitnah melden! ⏳",
      })
    );
  });

  it("erstellt nur für Helfer im aktuellen Scope einen kurzen nicht erratbaren PDF-Link", async () => {
    const result = await appRouter.createCaller(ctx).pdf.publicShare({
      helperId: helper.id,
    });

    expect(dbMocks.getHelper).toHaveBeenCalledWith(helper.id);
    expect(dbMocks.ensureHelperPdfShareCode).toHaveBeenCalledWith(helper.id);
    expect(result.path).toBe("/p/Ab3dE9F_");
    expect(result.url).toBe(`https://eifelride-jq8ejdus.manus.space${result.path}`);
    expect(result.url).toBe("https://eifelride-jq8ejdus.manus.space/p/Ab3dE9F_");
    expect(result.expiresAt).toBeGreaterThan(
      Date.now() + 89 * 24 * 60 * 60 * 1000
    );

    dbMocks.getHelper.mockResolvedValueOnce(undefined);
    await expect(
      appRouter.createCaller(ctx).pdf.publicShare({ helperId: 999_999 })
    ).rejects.toThrow("gehört nicht zur aktuell ausgewählten Veranstaltung");
  });

  it("weist Bildinhalte mit unpassender Dateisignatur ab", async () => {
    await expect(
      appRouter.createCaller(ctx).pdf.uploadLogo({
        base64: Buffer.from("kein PNG").toString("base64"),
        mimeType: "image/png",
      })
    ).rejects.toThrow("passt nicht zum ausgewählten Dateiformat");
    expect(storageMocks.storagePut).not.toHaveBeenCalled();
    expect(dbMocks.updateCurrentEventPdfImage).not.toHaveBeenCalled();
  });

  it("liefert die PDF-Anleitung für Administratoren und Planungsteam als Download", async () => {
    const pdf = Buffer.from("%PDF-1.7\nTestanleitung");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(pdf, { status: 200 }));

    try {
      for (const callerContext of [ctx, planningTeamCtx]) {
        const result = await appRouter
          .createCaller(callerContext)
          .help.guidePdf();
        expect(result.filename).toBe("Handbuch_RSC_Helferplanung.pdf");
        expect(result.mimeType).toBe("application/pdf");
        expect(Buffer.from(result.base64, "base64")).toEqual(pdf);
      }
      expect(storageMocks.storageGetSignedUrl).toHaveBeenCalledWith(
        "Handbuch_RSC_Helferplanung_742fcb04.pdf"
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("meldet einen verständlichen Fehler, wenn die Anleitung nicht geladen werden kann", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("nicht gefunden", { status: 404 }));

    try {
      await expect(
        appRouter.createCaller(planningTeamCtx).help.guidePdf()
      ).rejects.toThrow("PDF-Anleitung konnte nicht geladen werden");
    } finally {
      fetchMock.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("weist eine laut Header zu große Anleitung vor dem Einlesen zurück", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("%PDF-", {
        status: 200,
        headers: { "content-length": "5000001" },
      })
    );

    try {
      await expect(appRouter.createCaller(ctx).help.guidePdf()).rejects.toThrow(
        "PDF-Anleitung konnte nicht geladen werden"
      );
    } finally {
      fetchMock.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("bricht eine unbekannt große Anleitung während des Streams oberhalb von fünf MB ab", async () => {
    let cancelled = false;
    let chunkIndex = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(
          chunkIndex++ === 0
            ? Buffer.alloc(3_000_000, 65)
            : Buffer.alloc(2_100_000, 66)
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(stream, { status: 200 }));

    try {
      await expect(
        appRouter.createCaller(planningTeamCtx).help.guidePdf()
      ).rejects.toThrow("PDF-Anleitung konnte nicht geladen werden");
      await vi.waitFor(() => expect(cancelled).toBe(true));
    } finally {
      fetchMock.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("lässt Veranstaltungen nur administrativ umbenennen", async () => {
    dbMocks.updateEventName.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "RSC Sommerfest",
    });

    await expect(
      appRouter.createCaller(ctx).events.update({
        id: 1,
        name: " RSC   Sommerfest ",
      })
    ).resolves.toMatchObject({ name: "RSC Sommerfest" });
    expect(dbMocks.updateEventName).toHaveBeenCalledWith(1, "RSC   Sommerfest");
    await expect(
      appRouter.createCaller(planningTeamCtx).events.update({
        id: 1,
        name: "Nicht erlaubt",
      })
    ).rejects.toThrow();
  });

  it("legt Veranstaltungen nur mit mindestens einem ausgewählten Wochentag an", async () => {
    dbMocks.createEvent.mockResolvedValue({
      id: 3,
      year: 2026,
      name: "Cross",
      activeDays: ["Samstag", "Sonntag"],
      created: true,
    });

    await expect(
      appRouter.createCaller(ctx).events.create({
        name: "Cross",
        activeDays: ["Samstag", "Sonntag"],
      })
    ).resolves.toMatchObject({ id: 3, activeDays: ["Samstag", "Sonntag"] });
    expect(dbMocks.createEvent).toHaveBeenCalledWith("Cross", undefined, [
      "Samstag",
      "Sonntag",
    ]);

    await expect(
      appRouter
        .createCaller(ctx)
        .events.create({ name: "Leer", activeDays: [] })
    ).rejects.toThrow("Mindestens ein Veranstaltungstag");
  });

  it("löscht Veranstaltungen nur mit korrektem Administratorpasswort", async () => {
    dbMocks.deleteEvent.mockResolvedValue({
      deletedId: 2,
      deletedName: "Cross",
      nextEventId: 1,
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.events.remove({ id: 2, adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.deleteEvent).not.toHaveBeenCalled();

    await expect(
      caller.events.remove({ id: 2, adminPassword: ADMIN_PASSWORD })
    ).resolves.toEqual({
      deletedId: 2,
      deletedName: "Cross",
      nextEventId: 1,
    });
    expect(dbMocks.deleteEvent).toHaveBeenCalledWith(2);
  });

  it("löscht Ansprechpartner und eigenen Helfer ohne zusätzliche Ansprechpartnerauswahl", async () => {
    dbMocks.deleteContact.mockResolvedValue({
      deletedContactId: 5,
      deletedHelperId: 20,
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contacts.remove({ id: 5, adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.deleteContact).not.toHaveBeenCalled();

    await expect(
      caller.contacts.remove({ id: 5, adminPassword: ADMIN_PASSWORD })
    ).resolves.toEqual({ deletedContactId: 5, deletedHelperId: 20 });
    expect(dbMocks.deleteContact).toHaveBeenCalledWith(5, {
      userId: 1,
      name: "Organisation",
      role: "admin",
      loginMethod: "manus",
    });
  });

  it("setzt alle Helfer als Administrator nur nach Passwortbestätigung zurück", async () => {
    dbMocks.resetArea.mockResolvedValue(undefined);

    await expect(
      appRouter.createCaller(ctx).reset.area({
        area: "helpers",
        adminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.resetArea).toHaveBeenCalledWith("helpers", {
      userId: 1,
      name: "Organisation",
      role: "admin",
      loginMethod: "manus",
    });
  });

  it("trägt Helfer aus Schichten nur mit Administratorpasswort aus", async () => {
    dbMocks.clearAssignments.mockResolvedValue({ cleared: 3 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.plan.clearAssignments({ adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.clearAssignments).not.toHaveBeenCalled();

    await expect(
      caller.plan.clearAssignments({ adminPassword: ADMIN_PASSWORD })
    ).resolves.toEqual({ cleared: 3 });
    expect(dbMocks.clearAssignments).toHaveBeenCalledTimes(1);
  });

  it("fordert das aktuelle Administratorpasswort vor jeder Passwortänderung", async () => {
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.setPassword({
        password: "NeuesPlanungsteamPasswort2026!",
        currentAdminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.setPasswordHash).not.toHaveBeenCalled();

    await expect(
      caller.auth.setPassword({
        password: "NeuesPlanungsteamPasswort2026!",
        currentAdminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.setPasswordHash).toHaveBeenCalledWith(
      expect.not.stringContaining("NeuesPlanungsteamPasswort2026!")
    );

    await expect(
      caller.auth.setAdminPassword({
        password: "NeuesAdministratorPasswort2026!",
        currentAdminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.setAdminPasswordHash).not.toHaveBeenCalled();

    await expect(
      caller.auth.setAdminPassword({
        password: "NeuesAdministratorPasswort2026!",
        currentAdminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.setAdminPasswordHash).toHaveBeenCalledWith(
      expect.not.stringContaining("NeuesAdministratorPasswort2026!")
    );
  });

  it("erlaubt beiden Rollen JSON-Speichern und den reinen Excel-Export", async () => {
    for (const callerContext of [ctx, planningTeamCtx]) {
      const caller = appRouter.createCaller(callerContext);
      const saved = await caller.projectFile.save();
      expect(Buffer.from(saved.base64, "base64").toString()).toBe("json");
      const exported = await caller.excel.exportFile();
      expect(Buffer.from(exported.base64, "base64").toString()).toBe("xlsx");
      expect(exported.eventName).toBe("MyEifelRide");
    }
    expect(projectFileMocks.exportProjectFile).toHaveBeenCalledTimes(2);
    expect(backupMocks.exportProjectExcel).toHaveBeenCalledTimes(2);
  });

  it("beschränkt Prüfung und Protokolle des Projektladens auf Administratoren", async () => {
    await expect(
      appRouter
        .createCaller(planningTeamCtx)
        .projectFile.preview({ base64: "eA==" })
    ).rejects.toThrow();
    await expect(
      appRouter.createCaller(planningTeamCtx).projectFile.restoreLogs()
    ).rejects.toThrow();

    await expect(
      appRouter.createCaller(ctx).projectFile.preview({ base64: "eA==" })
    ).resolves.toMatchObject({ currentDigest: "a".repeat(64) });
    expect(projectFileMocks.previewProjectFile).toHaveBeenCalledWith("eA==");
  });

  it("leert Importprotokolle nur nach erneuter Administratorbestätigung", async () => {
    await expect(
      appRouter
        .createCaller(planningTeamCtx)
        .projectFile.clearRestoreLogs({ adminPassword: ADMIN_PASSWORD })
    ).rejects.toThrow();

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.projectFile.clearRestoreLogs({ adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    expect(backupMocks.clearBackupRestoreLogs).not.toHaveBeenCalled();

    await expect(
      caller.projectFile.clearRestoreLogs({ adminPassword: ADMIN_PASSWORD })
    ).resolves.toEqual({ deleted: 3 });
    expect(dbMocks.withPlanningWriteLock).toHaveBeenCalledTimes(1);
    expect(backupMocks.clearBackupRestoreLogs).toHaveBeenCalledTimes(1);
  });

  it("lädt eine geprüfte JSON-Projektdatei nur mit Administratorpasswort", async () => {
    const caller = appRouter.createCaller(ctx);
    const input = {
      base64: "eA==",
      filename: "Projekt.rscplanung.json",
      currentDigest: "a".repeat(64),
      previewBinding: "preview-binding-test-token",
    };

    await expect(
      caller.projectFile.load({ ...input, adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    expect(projectFileMocks.loadProjectFile).not.toHaveBeenCalled();

    await expect(
      caller.projectFile.load({
        ...input,
        adminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toMatchObject({ created: 1, updated: 2, deleted: 3 });
    expect(projectFileMocks.loadProjectFile).toHaveBeenCalledWith(
      "eA==",
      "Projekt.rscplanung.json",
      "a".repeat(64),
      expect.objectContaining({ userId: 1, role: "admin" })
    );
    expect(previewBindingMocks.verifyPreviewBinding).toHaveBeenCalledWith(
      "preview-binding-test-token",
      expect.objectContaining({
        sourceDigest: "b".repeat(64),
        currentDigest: "a".repeat(64),
        operation: "project-file",
        userId: 1,
      })
    );
  });

  it("weist einen Restore mit ungültiger Vorschau-Freigabe vor jeder Übernahme ab", async () => {
    previewBindingMocks.verifyPreviewBinding.mockImplementation(() => {
      throw new Error("Die Vorschau-Freigabe ist ungültig oder abgelaufen");
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projectFile.load({
        base64: "eA==",
        filename: "Projekt.rscplanung.json",
        currentDigest: "a".repeat(64),
        previewBinding: "preview-binding-test-token",
        adminPassword: ADMIN_PASSWORD,
      })
    ).rejects.toThrow("Vorschau-Freigabe");
    expect(projectFileMocks.loadProjectFile).not.toHaveBeenCalled();
  });

  it("importiert ein Excel-Modul nur administrativ und passwortgeschützt", async () => {
    await expect(
      appRouter
        .createCaller(planningTeamCtx)
        .excel.previewModule({ area: "HELFER", base64: "eA==" })
    ).rejects.toThrow();
    await expect(
      appRouter.createCaller(ctx).excel.previewModule({
        area: "HELFER",
        base64: "eA==",
      })
    ).resolves.toMatchObject({ area: "HELFER" });

    const input = {
      area: "HELFER" as const,
      base64: "eA==",
      filename: "Helfer.xlsx",
      currentDigest: "a".repeat(64),
      previewBinding: "preview-binding-test-token",
    };
    await expect(
      appRouter
        .createCaller(ctx)
        .excel.applyModule({ ...input, adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    await expect(
      appRouter
        .createCaller(ctx)
        .excel.applyModule({ ...input, adminPassword: ADMIN_PASSWORD })
    ).resolves.toMatchObject({ created: 1, updated: 2, deleted: 3 });
    expect(moduleImportMocks.applyModuleExcelImport).toHaveBeenCalledWith(
      "eA==",
      "HELFER",
      "Helfer.xlsx",
      "a".repeat(64),
      expect.objectContaining({ userId: 1, role: "admin" })
    );
    expect(previewBindingMocks.verifyPreviewBinding).toHaveBeenCalledWith(
      "preview-binding-test-token",
      expect.objectContaining({
        sourceDigest: "b".repeat(64),
        currentDigest: "a".repeat(64),
        operation: "module:HELFER",
        userId: 1,
      })
    );
  });

  it("protokolliert und meldet die konkrete Transaktionsursache eines Modulimports", async () => {
    moduleImportMocks.applyModuleExcelImport.mockRejectedValue(
      new Error(
        "HELFER Zeile 7: Fehlende Ansprechpartnerreferenz ID 2190010"
      )
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const input = {
      area: "HELFER" as const,
      base64: "eA==",
      filename: "Helfer.xlsx",
      currentDigest: "a".repeat(64),
      previewBinding: "preview-binding-test-token",
      adminPassword: ADMIN_PASSWORD,
    };

    await expect(
      appRouter.createCaller(ctx).excel.applyModule(input)
    ).rejects.toThrow(
      "Excel-Import (HELFER) wurde nicht übernommen: HELFER Zeile 7: Fehlende Ansprechpartnerreferenz ID 2190010"
    );

    expect(dbMocks.withPlanningWriteLock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "[Excel-Modulimport] Atomare Übernahme abgebrochen",
      expect.objectContaining({
        area: "HELFER",
        filename: "Helfer.xlsx",
        detail: "HELFER Zeile 7: Fehlende Ansprechpartnerreferenz ID 2190010",
      })
    );
    consoleError.mockRestore();
  });

  it("weist ungültige oder unvollständige Schichtzeiten zurück", async () => {
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.shifts.create({
        day: "Freitag",
        area: "Start",
        task: "Anmeldung",
        startTime: "25:00",
        endTime: "26:00",
        needed: 1,
      })
    ).rejects.toThrow("Uhrzeit");

    await expect(
      caller.shifts.create({
        day: "Freitag",
        area: "Start",
        task: "Anmeldung",
        startTime: "10:00",
        endTime: "",
        needed: 1,
      })
    ).rejects.toThrow("Beginn und Ende");

    await expect(
      caller.shifts.create({
        day: "Freitag",
        area: "Start",
        task: "Anmeldung",
        startTime: "12:00",
        endTime: "11:00",
        needed: 1,
      })
    ).rejects.toThrow("Ende muss nach dem Beginn");
  });

  it.each(WEEKDAYS)("legt eine Schicht am %s an", async day => {
    dbMocks.createShift.mockResolvedValue({ insertId: 77 });
    await expect(
      appRouter.createCaller(ctx).shifts.create({
        day,
        area: "Aufbau",
        task: "Material vorbereiten",
        startTime: "09:00",
        endTime: "11:00",
        needed: 2,
      })
    ).resolves.toEqual({ insertId: 77 });
    expect(dbMocks.createShift).toHaveBeenCalledWith(
      expect.objectContaining({ day })
    );
  });

  it("weist Schichten an nicht aktivierten Veranstaltungstagen zurück", async () => {
    dbMocks.getEvent.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "Wochenende",
      activeDays: ["Samstag", "Sonntag"],
    });

    await expect(
      appRouter.createCaller(ctx).shifts.create({
        day: "Freitag",
        area: "Aufbau",
        task: "Material vorbereiten",
        startTime: "09:00",
        endTime: "11:00",
        needed: 2,
      })
    ).rejects.toThrow("Freitag ist für diese Veranstaltung nicht aktiviert");
    expect(dbMocks.createShift).not.toHaveBeenCalled();
  });

  it("verhindert doppelte Helfer und doppelt belegte Slots", async () => {
    const caller = appRouter.createCaller(ctx);

    dbMocks.listAssignments.mockResolvedValue([
      { id: 1, shiftId: 10, helperId: 20, slot: 0, createdAt: new Date() },
    ]);
    await expect(
      caller.plan.assign({ shiftId: 10, helperId: 20, slot: 1 })
    ).rejects.toThrow("bereits zugewiesen");

    dbMocks.listHelpers.mockResolvedValue([
      helper,
      { ...helper, id: 21, name: "Bea" },
    ]);
    await expect(
      caller.plan.assign({ shiftId: 10, helperId: 21, slot: 0 })
    ).rejects.toThrow("bereits belegt");
  });

  it("weist nicht verfügbare Helfer und Plätze außerhalb des Bedarfs zurück", async () => {
    const caller = appRouter.createCaller(ctx);

    dbMocks.listHelpers.mockResolvedValue([{ ...helper, availFri: "nein" }]);
    await expect(
      caller.plan.assign({ shiftId: 10, helperId: 20, slot: 0 })
    ).rejects.toThrow("nicht verfügbar");

    dbMocks.listHelpers.mockResolvedValue([helper]);
    await expect(
      caller.plan.assign({ shiftId: 10, helperId: 20, slot: 2 })
    ).rejects.toThrow("außerhalb des Schichtbedarfs");
  });

  it("weist teilverfügbare Helfer nur flexiblen Schichten zu", async () => {
    const partialHelper = {
      ...helper,
      availFriStart: "10:00",
      availFriEnd: "12:00",
    };
    dbMocks.listHelpers.mockResolvedValue([partialHelper]);
    dbMocks.listShifts.mockResolvedValue([
      { ...shift, startTime: "09:00", endTime: "12:00" },
    ]);

    await expect(
      appRouter.createCaller(ctx).plan.assign({ shiftId: 10, helperId: 20, slot: 0 })
    ).rejects.toThrow("nicht verfügbar");

    dbMocks.listShifts.mockResolvedValue([
      {
        ...shift,
        startTime: "09:00",
        endTime: "12:00",
        allowFlexibleAssignment: true,
      },
    ]);
    await expect(
      appRouter.createCaller(ctx).plan.assign({ shiftId: 10, helperId: 20, slot: 0 })
    ).resolves.toEqual({ insertId: 1 });
  });

  it("speichert eine gültige Zuweisung", async () => {
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.plan.assign({ shiftId: 10, helperId: 20, slot: 0 })
    ).resolves.toEqual({ insertId: 1 });
    expect(dbMocks.assignHelper).toHaveBeenCalledWith({
      shiftId: 10,
      helperId: 20,
      slot: 0,
    });
    expect(dbMocks.withPlanningWriteLock).toHaveBeenCalledTimes(1);
  });

  it("initialisiert neue Vorbereitungsaufgaben serverseitig immer mit Offen", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.createPrep.mockResolvedValue({ insertId: 30 });

    await (caller.prep.create as any)({
      task: "Absperrmaterial prüfen",
      category: "Strecke & Sicherheit",
      dueText: "Spätestens zwei Wochen vor Streckenfreigabe",
      logEntry: "Erste Prüfung eingeplant",
      status: "abgelehnt",
      statusWording: "genehmigung",
    });

    expect(dbMocks.createPrep).toHaveBeenCalledWith({
      task: "Absperrmaterial prüfen",
      category: "Strecke & Sicherheit",
      dueText: "Spätestens zwei Wochen vor Streckenfreigabe",
      logEntry: "Erste Prüfung eingeplant",
      status: "offen",
      statusWording: "aufgabe",
      logEntryAuthor: "Organisation",
    });
  });

  it("aktualisiert Kategorie, Ablehnung, Statuswortlaut und Logbucheintrag einer Vorbereitung", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.updatePrep.mockResolvedValue({ affectedRows: 1 });

    await caller.prep.update({
      id: 30,
      category: "Behörden",
      status: "abgelehnt",
      statusWording: "genehmigung",
      logEntry: "Rückfrage an Stadtverwaltung erforderlich",
    });

    expect(dbMocks.updatePrep).toHaveBeenCalledWith(30, {
      category: "Behörden",
      status: "abgelehnt",
      statusWording: "genehmigung",
      logEntry: "Rückfrage an Stadtverwaltung erforderlich",
      logEntryAuthor: "Organisation",
    });
  });

  it("erlaubt dem Planungsteam das Verschieben von Vorbereitungsaufgaben ins Löschprotokoll mit Name", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);
    dbMocks.deletePrep.mockResolvedValue({ affectedRows: 1 });

    await expect(
      caller.prep.remove({
        id: 30,
        deletedBy: "Christian",
      })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.deletePrep).toHaveBeenCalledWith(30, {
      actor: {
        userId: 2,
        name: "Christian",
        role: "user",
        loginMethod: "manus",
      },
    });
  });

  it("weist Vorbereitungslöschungen ohne Löschenden ab", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);
    await expect(
      caller.prep.remove({
        id: 30,
        deletedBy: "   ",
      })
    ).rejects.toThrow();
    expect(dbMocks.deletePrep).not.toHaveBeenCalled();
  });

  it("speichert eine optionale Begleitperson für Helfer ohne Beeinflussung der Schichtkapazität", async () => {
    dbMocks.updateHelper.mockResolvedValue({ affectedRows: 1 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.helpers.update({
        id: 42,
        companion: "+ Frau Muster, + Kind",
      })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.updateHelper).toHaveBeenCalledWith(42, {
      companion: "+ Frau Muster, + Kind",
    });
  });

  it("legt Helfer mit Stammdaten an und setzt Status sowie Tagesverfügbarkeiten auf die sicheren Standardwerte", async () => {
    dbMocks.upsertHelperByName.mockResolvedValue({ id: 44, created: true });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.helpers.create({
        name: "Axel Muster",
        contactId: 5,
        phone: "0174 1234567",
        note: "Samstag nur nachmittags",
        companion: "+ Frau Muster, + Kind",
      })
    ).resolves.toEqual({ id: 44, created: true });

    expect(dbMocks.upsertHelperByName).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Axel Muster",
        contactId: 5,
        phone: "0174 1234567",
        note: "Samstag nur nachmittags",
        companion: "+ Frau Muster, + Kind",
        willHelp: "ja",
        availFri: "vielleicht",
        availSat: "vielleicht",
        availSun: "vielleicht",
        confirmed: "nein",
      })
    );
  });

  it("erlaubt dem Planungsteam bestätigte Helfer- und Kuchenlöschungen", async () => {
    dbMocks.deleteHelper.mockResolvedValue({ affectedRows: 1 });
    dbMocks.deleteCake.mockResolvedValue({ affectedRows: 1 });
    const caller = appRouter.createCaller(planningTeamCtx);

    await expect(
      caller.helpers.remove({ id: 20, responsibleContactId: 5 })
    ).resolves.toEqual({ affectedRows: 1 });
    await expect(caller.cakes.remove({ id: 30 })).resolves.toEqual({
      affectedRows: 1,
    });
    expect(dbMocks.deleteHelper).toHaveBeenCalledWith(20, {
      allowAssigned: false,
      actor: {
        userId: 2,
        name: "Organisation",
        role: "user",
        loginMethod: "manus",
        responsibleContactId: 5,
        responsibleContactName: "Chris Leitung",
      },
    });
    expect(dbMocks.deleteCake).toHaveBeenCalledWith(30, {
      userId: 2,
      name: "Organisation",
      role: "user",
      loginMethod: "manus",
    });
  });

  it("erlaubt Administratoren bei Helferlöschung auch die Planbereinigung", async () => {
    dbMocks.deleteHelper.mockResolvedValue({ affectedRows: 1 });
    const caller = appRouter.createCaller(ctx);

    await caller.helpers.remove({ id: 20, responsibleContactId: 5 });

    expect(dbMocks.deleteHelper).toHaveBeenCalledWith(20, {
      allowAssigned: true,
      actor: {
        userId: 1,
        name: "Organisation",
        role: "admin",
        loginMethod: "manus",
        responsibleContactId: 5,
        responsibleContactName: "Chris Leitung",
      },
    });
  });

  it("verlangt bei jeder Helferlöschung einen gültigen Ansprechpartner", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.getContact.mockResolvedValueOnce(undefined);
    await expect(
      caller.helpers.remove({
        id: 20,
        responsibleContactId: 999,
      })
    ).rejects.toThrow("nicht gefunden");
    expect(dbMocks.deleteHelper).not.toHaveBeenCalled();
  });

  it("lässt Bereichsansprechpartner nur durch Administratoren ändern", async () => {
    dbMocks.setShiftAreaContact.mockResolvedValue({ affectedRows: 1 });
    await expect(
      appRouter.createCaller(ctx).plan.setAreaContact({
        area: "Start",
        contactId: 5,
      })
    ).resolves.toEqual({ affectedRows: 1 });
    expect(dbMocks.setShiftAreaContact).toHaveBeenCalledWith("Start", 5);

    await expect(
      appRouter.createCaller(planningTeamCtx).plan.setAreaContact({
        area: "Start",
        contactId: 5,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("zeigt das Löschprotokoll ausschließlich Administratoren", async () => {
    dbMocks.listDeletionAuditLogs.mockResolvedValue([
      { id: 1, entityType: "helper", entityLabel: "Alex" },
    ]);

    await expect(
      appRouter.createCaller(planningTeamCtx).audit.deletions({ limit: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appRouter.createCaller(ctx).audit.deletions({ limit: 10 })
    ).resolves.toEqual([{ id: 1, entityType: "helper", entityLabel: "Alex" }]);
    expect(dbMocks.listDeletionAuditLogs).toHaveBeenCalledWith({ limit: 10 });
  });

  it("stellt Einzellöschungen ausschließlich für Administratoren wieder her", async () => {
    dbMocks.restoreDeletionAuditLog.mockResolvedValue({
      entityType: "helper",
      entityLabel: "Alex",
      eventName: "MyEifelRide",
      restoredAssignments: 1,
      skippedAssignments: 0,
    });

    await expect(
      appRouter.createCaller(planningTeamCtx).audit.restore({ id: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appRouter.createCaller(ctx).audit.restore({ id: 7 })
    ).resolves.toMatchObject({ entityLabel: "Alex", restoredAssignments: 1 });
    expect(dbMocks.restoreDeletionAuditLog).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ userId: 1, name: "Organisation" })
    );
  });

  it("setzt Löschprotokolle nur administrativ und mit Passwort zurück", async () => {
    dbMocks.clearDeletionAuditLogs.mockResolvedValue({ affectedRows: 1 });

    await expect(
      appRouter.createCaller(planningTeamCtx).audit.clear({
        eventYear: 2026,
        eventId: 1,
        adminPassword: ADMIN_PASSWORD,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appRouter.createCaller(ctx).audit.clear({
        eventYear: 2026,
        eventId: 1,
        adminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.clearDeletionAuditLogs).not.toHaveBeenCalled();

    await expect(
      appRouter.createCaller(ctx).audit.clear({
        eventYear: 2026,
        eventId: 1,
        adminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.clearDeletionAuditLogs).toHaveBeenCalledWith({
      eventYear: 2026,
      eventId: 1,
    });
  });

  it("verweigert dem Planungsteam jede Einsatzplanänderung", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);

    await expect(caller.years.create({ year: 2028 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.shifts.create({
        day: "Freitag",
        area: "Start",
        task: "Anmeldung",
        startTime: "08:00",
        endTime: "10:00",
        needed: 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.plan.assign({ shiftId: 10, helperId: 20, slot: 0 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.shifts.update({ id: 10, task: "Geänderte Aufgabe" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.plan.unassign({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.shifts.remove({ id: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("gibt fachlich ungültige Schichtänderungen als verständlichen Eingabefehler zurück", async () => {
    dbMocks.updateShift.mockRejectedValueOnce(
      new ShiftUpdateValidationError(
        "Der neue Helferbedarf wäre kleiner als bereits belegte Helferplätze"
      )
    );

    await expect(
      appRouter.createCaller(ctx).shifts.update({ id: 10, needed: 0 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Der neue Helferbedarf wäre kleiner als bereits belegte Helferplätze",
    });
  });

  it("übermittelt manualOkConfirmed beim Aktualisieren einer Schicht an die Datenbank", async () => {
    dbMocks.updateShift.mockResolvedValueOnce({ affectedRows: 1 });

    const caller = appRouter.createCaller(ctx);
    await caller.shifts.update({
      id: 42,
      manualOkConfirmed: true,
    });

    expect(dbMocks.updateShift).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        manualOkConfirmed: true,
      })
    );
  });

  it("übermittelt manualDoubleConflictAccepted beim Aktualisieren einer Schicht an die Datenbank", async () => {
    dbMocks.updateShift.mockResolvedValueOnce({ affectedRows: 1 });

    const caller = appRouter.createCaller(ctx);
    await caller.shifts.update({
      id: 42,
      manualDoubleConflictAccepted: true,
    });

    expect(dbMocks.updateShift).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        manualDoubleConflictAccepted: true,
      })
    );
  });
  it("laedt gueltige Standort-Logos als Administrator hoch und speichert Key und URL", async () => {
    dbMocks.getLocation.mockResolvedValue({
      id: 55,
      year: 2026,
      eventId: 1,
      name: "Mayen / Viehmarkt",
      latitude: 50.3271,
      longitude: 7.2215,
      logoKey: null,
      logoUrl: null,
      sortOrder: 0,
    });
    dbMocks.updateLocation.mockResolvedValue({ affectedRows: 1 });
    storageMocks.storagePut.mockResolvedValue({
      key: "location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
      url: "/manus-storage/location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
    });

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );

    const caller = appRouter.createCaller(ctx);
    const result = await caller.locations.uploadLogo({
      id: 55,
      base64: png.toString("base64"),
      mimeType: "image/png",
    });

    expect(result).toMatchObject({
      key: "location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
      url: "/manus-storage/location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
    });
    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      "location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
      png,
      "image/png"
    );
    expect(dbMocks.updateLocation).toHaveBeenCalledWith(55, {
      logoKey: "location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
      logoUrl: "/manus-storage/location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
    });
  });

  it("weist fehlerhaftes Base64 und unpassende Standortlogo-Signaturen ab", async () => {
    dbMocks.getLocation.mockResolvedValue({
      id: 55,
      year: 2026,
      eventId: 1,
      name: "Mayen / Viehmarkt",
      latitude: 50.3271,
      longitude: 7.2215,
      logoKey: null,
      logoUrl: null,
      sortOrder: 0,
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.locations.uploadLogo({
        id: 55,
        base64: "nicht-gültiges-base64!",
        mimeType: "image/png",
      })
    ).rejects.toThrow("PNG-, SVG- oder JPEG-Logo");
    await expect(
      caller.locations.uploadLogo({
        id: 55,
        base64: Buffer.from("kein PNG").toString("base64"),
        mimeType: "image/png",
      })
    ).rejects.toThrow("passt nicht zum ausgewählten Dateiformat");
    expect(storageMocks.storagePut).not.toHaveBeenCalled();
    expect(dbMocks.updateLocation).not.toHaveBeenCalled();
  });

  it("setzt Standort-Logos auf null zurueck", async () => {
    dbMocks.getLocation.mockResolvedValue({
      id: 55,
      year: 2026,
      eventId: 1,
      name: "Mayen / Viehmarkt",
      latitude: 50.3271,
      longitude: 7.2215,
      logoKey: "key.png",
      logoUrl: "url.png",
      sortOrder: 0,
    });
    dbMocks.updateLocation.mockResolvedValue({ affectedRows: 1 });

    const caller = appRouter.createCaller(ctx);
    await expect(caller.locations.clearLogo({ id: 55 })).resolves.toEqual({ success: true });
    expect(dbMocks.updateLocation).toHaveBeenCalledWith(55, {
      logoKey: null,
      logoUrl: null,
    });
  });

  it("verwehrt dem Planungsteam das Hochladen oder Loeschen von Standort-Logos", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    await expect(
      caller.locations.uploadLogo({
        id: 55,
        base64: png.toString("base64"),
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.locations.clearLogo({ id: 55 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
