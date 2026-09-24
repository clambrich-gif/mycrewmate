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
  clearModuleAssignments: vi.fn(),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
  upsertHelperByName: vi.fn(),
  updateHelper: vi.fn(),
  deleteHelper: vi.fn(),
  createCake: vi.fn(),
  updateCake: vi.fn(),
  deleteCake: vi.fn(),
  createPrep: vi.fn(),
  updatePrep: vi.fn(),
  deletePrep: vi.fn(),
  deletePost: vi.fn(),
  deleteMaterial: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  resetArea: vi.fn(),
  listPrep: vi.fn(),
  listPost: vi.fn(),
  listContacts: vi.fn(),
  listMaterials: vi.fn(),
  listCakes: vi.fn(),
  listMarketing: vi.fn(),
  listApprovals: vi.fn(),
  recordActivityLog: vi.fn(),
  listDeletionAuditLogs: vi.fn(),
  clearDeletionAuditLogs: vi.fn(),
  restoreDeletionAuditLog: vi.fn(),
  getSecuritySettings: vi.fn(),
  setPasswordHash: vi.fn(),
  setAdminPasswordHash: vi.fn(),
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  updateTenantLogo: vi.fn(),
  getEvent: vi.fn(),
  updateCurrentEventPdfImage: vi.fn(),
  ensureEventYear: vi.fn(),
  createEvent: vi.fn(),
  updateEventDetails: vi.fn(),
  deleteEvent: vi.fn(),
  deleteContact: vi.fn(),
  getContact: vi.fn(),
  getHelper: vi.fn(),
  ensureHelperPdfShareCode: vi.fn(),
  listShiftAreaContacts: vi.fn(),
  listLocations: vi.fn(),
  setShiftAreaContact: vi.fn(),
  withPlanningWriteLock: vi.fn(),
  getLocation: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  resolveTenantForUser: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
  storageRead: vi.fn(),
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
    "ORTE",
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
  previewFullExcelImport: vi.fn(),
  applyFullExcelImport: vi.fn(),
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
import { ADMIN_PASSWORD_OPEN_ID, hashPassword } from "./password-auth";
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
    openId: ADMIN_PASSWORD_OPEN_ID,
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
    dbMocks.resolveTenantForUser.mockResolvedValue({
      tenantId: "rsc-eifelland-mayen",
      role: "tenant_admin",
      isDefault: true,
      tenantName: "RSC Eifelland Mayen e. V.",
      tenantStatus: "pilot",
    });
    dbMocks.listShifts.mockResolvedValue([shift]);
    dbMocks.listHelpers.mockResolvedValue([helper]);
    dbMocks.listAssignments.mockResolvedValue([]);
    dbMocks.listPrep.mockResolvedValue([]);
    dbMocks.listPost.mockResolvedValue([]);
    dbMocks.listContacts.mockResolvedValue([]);
    dbMocks.listMaterials.mockResolvedValue([]);
    dbMocks.listCakes.mockResolvedValue([]);
    dbMocks.listLocations.mockResolvedValue([]);
    dbMocks.listMarketing.mockResolvedValue([]);
    dbMocks.listApprovals.mockResolvedValue([]);
    dbMocks.recordActivityLog.mockResolvedValue(undefined);
    dbMocks.assignHelper.mockResolvedValue({ insertId: 1 });
    dbMocks.updateShift.mockResolvedValue({ affectedRows: 1 });
    dbMocks.clearModuleAssignments.mockResolvedValue({
      area: "prep",
      cleared: 0,
    });
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
    storageMocks.storageRead.mockResolvedValue(
      Buffer.from("%PDF-1.7\nTestanleitung")
    );
    storageMocks.storagePut.mockResolvedValue({
      key: "pdf-logos/events/2026/1/pdf-logo_test.png",
      url: "/uploads/pdf-logos/events/2026/1/pdf-logo_test.png",
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
    moduleImportMocks.previewFullExcelImport.mockResolvedValue({
      currentDigest: "a".repeat(64),
      sourceDigest: "b".repeat(64),
      warnings: [],
      changes: [{ area: "ANSPRECHPARTNER", action: "create" }],
      totals: { created: 1, updated: 0, deleted: 0 },
      steps: [],
    });
    moduleImportMocks.applyFullExcelImport.mockResolvedValue({
      created: 4,
      updated: 5,
      deleted: 6,
      warnings: [],
      afterDigest: "c".repeat(64),
    });
    backupMocks.withExcelOperationLimit.mockImplementation(callback =>
      callback()
    );
  });

  it("berechnet Rückmeldequote und Tagesbesetzung aus gültigen Helferzuweisungen", async () => {
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

  it("liefert die Tagesbereitschaft ausschließlich für die aktiven Tage eines Eintagsevents", async () => {
    dbMocks.getEvent.mockResolvedValue({
      id: 77,
      year: 2027,
      name: "Rennen 2027",
      activeDays: ["Donnerstag"],
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
      sortOrder: 0,
      createdAt: new Date(),
    });
    dbMocks.listShifts.mockResolvedValue([
      { ...shift, day: "Donnerstag", task: "Startnummernausgabe" },
    ]);

    const stats = await appRouter.createCaller(ctx).dashboard.stats();

    expect(stats.taeglicheEinsatzbereitschaft).toHaveLength(1);
    expect(stats.taeglicheEinsatzbereitschaft[0]).toMatchObject({
      day: "Donnerstag",
      bedarf: 2,
      besetzt: 0,
    });
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
      logoFallback: "none",
    });
    expect(result.logoKey).not.toBe("global-alt.png");
  });

  it("verwaltet das globale Vereinslogo getrennt vom PDF-Event-Logo", async () => {
    dbMocks.getAppSettings.mockResolvedValue({
      id: 1,
      eventName: "MyEifelRide",
      eventYear: "2027",
      helperPdfTitle: "Aufgabenübersicht",
      blankPlanTitle: "Einsatzplan – Blanko",
      contactLabel: "Ansprechpartner",
      footerText: "",
      tenantLogoKey: "tenant-logos/ui/tenant-logo.png",
      tenantLogoUrl: "/manus-storage/tenant-logos/ui/tenant-logo.png",
      logoKey: null,
      logoUrl: null,
      extraColumns: "[]",
      blankRowsPerShift: 0,
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(ctx);
    const current = await caller.branding.current();
    expect(current).toEqual({
      tenantLogoKey: "tenant-logos/ui/tenant-logo.png",
      tenantLogoUrl: "/api/tenant-logo",
    });

    const samplePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1]).toString("base64");
    await caller.branding.uploadTenantLogo({
      base64: samplePng,
      mimeType: "image/png",
    });

    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      "tenant-logos/ui/tenant-logo.png",
      expect.any(Buffer),
      "image/png"
    );
    expect(dbMocks.updateTenantLogo).toHaveBeenCalledWith({
      tenantLogoKey: expect.any(String),
      tenantLogoUrl: expect.any(String),
    });

    await caller.branding.clearTenantLogo();
    expect(dbMocks.updateTenantLogo).toHaveBeenCalledWith({
      tenantLogoKey: null,
      tenantLogoUrl: null,
    });
  });

  it("erstellt die Material-Packliste ausschließlich aus der sichtbaren Auswahl", async () => {
    dbMocks.listMaterials.mockResolvedValue([
      {
        id: 701,
        article: "Flatterband",
        category: "Absperrung",
        quantity: "4",
        unit: "Rollen",
        locationId: null,
        contactId: null,
        status: "offen",
        note: null,
        sortOrder: 0,
      },
    ]);

    const result = await appRouter.createCaller(ctx).pdf.materialPacklist({
      materialIds: [701],
    });

    expect(result.filename).toBe("Material_Packliste_Gefiltert_MyEifelRide.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(Buffer.from(result.base64, "base64").subarray(0, 5).toString()).toBe(
      "%PDF-"
    );

    await expect(
      appRouter.createCaller(ctx).pdf.materialPacklist({ materialIds: [999_999] })
    ).rejects.toThrow("gehört nicht zur aktuellen Veranstaltung");
  });

  it("erstellt Spenden-PDFs ausschließlich aus der sichtbaren Auswahl", async () => {
    dbMocks.listCakes.mockResolvedValue([
      {
        id: 711,
        year: 2026,
        eventId: 1,
        donor: "Anna Ahrtal",
        cake: "Kartoffelsalat",
        donationCategory: "salat",
        locationId: null,
        dropoffDate: "2026-06-19",
        dropoffTime: "09:00",
        legacyDropoffText: "",
        vegan: true,
        glutenFree: false,
        lactoseFree: false,
        containsNuts: false,
        meat: false,
        note: "Bitte gekühlt lagern",
        sortOrder: 0,
      },
    ]);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.pdf.donationOverview({ donationIds: [711] });

    expect(result.filename).toBe(
      "Spendenuebersicht_Gefiltert_MyEifelRide.pdf"
    );
    expect(result.mimeType).toBe("application/pdf");
    expect(Buffer.from(result.base64, "base64").subarray(0, 5).toString()).toBe(
      "%PDF-"
    );
    await expect(
      caller.pdf.donationOverview({ donationIds: [999_999] })
    ).rejects.toThrow("gehört nicht zur aktuellen Veranstaltung");
  });

  it("erstellt Aufgaben-PDFs ausschließlich aus sichtbaren Vor- und Nachbereitungsaufgaben", async () => {
    const prepTask = {
      id: 801,
      year: 2026,
      eventId: 1,
      category: "Strecke",
      task: "Beschilderung abstimmen",
      dueText: "15.05.2026",
      locationId: null,
      contactId: null,
      status: "offen" as const,
      statusWording: "aufgabe" as const,
      note: null,
      deleted: false,
      sortOrder: 0,
    };
    const postTask = {
      id: 901,
      year: 2026,
      eventId: 1,
      category: "Abbau",
      task: "Material zurückführen",
      dueText: "22.06.2026",
      locationId: null,
      contactId: null,
      status: "inArbeit" as const,
      note: null,
      deleted: false,
      sortOrder: 0,
    };
    dbMocks.listPrep.mockResolvedValue([prepTask]);
    dbMocks.listPost.mockResolvedValue([postTask]);

    const caller = appRouter.createCaller(ctx);
    const prepResult = await caller.pdf.prepTaskOverview({ taskIds: [801] });
    const postResult = await caller.pdf.postTaskOverview({ taskIds: [901] });

    expect(prepResult.filename).toBe("Vorbereitung_Aufgabenuebersicht_MyEifelRide.pdf");
    expect(postResult.filename).toBe("Nachbereitung_Aufgabenuebersicht_MyEifelRide.pdf");
    expect(Buffer.from(prepResult.base64, "base64").subarray(0, 5).toString()).toBe(
      "%PDF-"
    );
    expect(Buffer.from(postResult.base64, "base64").subarray(0, 5).toString()).toBe(
      "%PDF-"
    );
    await expect(caller.pdf.prepTaskOverview({ taskIds: [999_999] })).rejects.toThrow(
      "gehört nicht zur aktuellen Veranstaltung"
    );
    await expect(caller.pdf.postTaskOverview({ taskIds: [999_999] })).rejects.toThrow(
      "gehört nicht zur aktuellen Veranstaltung"
    );
  });

  it("speichert PDF-Bilder im Pfad und Datensatz des aktuellen Events als Administrator", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );

    await expect(
      appRouter.createCaller(planningTeamCtx).pdf.uploadLogo({
        base64: png.toString("base64"),
        mimeType: "image/png",
      })
    ).rejects.toThrow();

    await appRouter.createCaller(ctx).pdf.uploadLogo({
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
        "/uploads/pdf-logos/events/2026/1/pdf-logo_test.png",
    });
  });

  it("entfernt das individuelle Bild ausschließlich im aktuellen Event als Administrator", async () => {
    await expect(
      appRouter.createCaller(planningTeamCtx).pdf.clearLogo()
    ).rejects.toThrow();

    await appRouter.createCaller(ctx).pdf.clearLogo();

    expect(dbMocks.updateCurrentEventPdfImage).toHaveBeenCalledWith({
      pdfLogoKey: null,
      pdfLogoUrl: null,
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
    expect(result.url).toBe(`https://app.mycrewmate.de${result.path}`);
    expect(result.url).toBe("https://app.mycrewmate.de/p/Ab3dE9F_");
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
    storageMocks.storageRead.mockResolvedValue(pdf);

    for (const callerContext of [ctx, planningTeamCtx]) {
      const result = await appRouter
        .createCaller(callerContext)
        .help.guidePdf();
      expect(result.filename).toBe("Handbuch_RSC_Helferplanung.pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(Buffer.from(result.base64, "base64")).toEqual(pdf);
    }
    expect(storageMocks.storageRead).toHaveBeenCalledWith(
      "Handbuch_RSC_Helferplanung_742fcb04.pdf"
    );
  });

  it("meldet einen verständlichen Fehler, wenn die Anleitung nicht geladen werden kann", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    storageMocks.storageRead.mockRejectedValue(new Error("Datei nicht gefunden"));

    try {
      await expect(
        appRouter.createCaller(planningTeamCtx).help.guidePdf()
      ).rejects.toThrow("PDF-Anleitung konnte nicht geladen werden");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("weist eine zu große lokale Anleitung vor der Ausgabe zurück", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    storageMocks.storageRead.mockResolvedValue(Buffer.alloc(5_000_001));

    try {
      await expect(appRouter.createCaller(ctx).help.guidePdf()).rejects.toThrow(
        "PDF-Anleitung konnte nicht geladen werden"
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("lässt Veranstaltungen nur administrativ umbenennen", async () => {
    dbMocks.updateEventDetails.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "RSC Sommerfest",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
    });

    await expect(
      appRouter.createCaller(ctx).events.update({
        id: 1,
        name: " RSC   Sommerfest ",
        startDate: "2026-07-10",
        endDate: "2026-07-12",
      })
    ).resolves.toMatchObject({
      name: "RSC Sommerfest",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
    });
    expect(dbMocks.updateEventDetails).toHaveBeenCalledWith(1, {
      name: "RSC   Sommerfest",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
    });
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

  it("legt ein neues Jahr nur mit der ausdrücklich erfassten ersten Veranstaltung an", async () => {
    dbMocks.createEvent.mockResolvedValue({
      id: 42,
      year: 2028,
      name: "Vereinsfest am See",
      activeDays: ["Freitag", "Samstag"],
      created: true,
    });

    await expect(
      appRouter.createCaller(ctx).years.create({
        year: 2028,
        initialEventName: "Vereinsfest am See",
        activeDays: ["Freitag", "Samstag"],
      })
    ).resolves.toMatchObject({
      success: true,
      event: { id: 42, name: "Vereinsfest am See" },
    });

    expect(dbMocks.ensureEventYear).toHaveBeenCalledWith(2028);
    expect(dbMocks.createEvent).toHaveBeenCalledWith(
      "Vereinsfest am See",
      2028,
      ["Freitag", "Samstag"]
    );

    await expect(
      appRouter.createCaller(ctx).years.create({
        year: 2029,
        initialEventName: "Nur ein Zeichen ist nicht ausreichend",
        activeDays: [],
      })
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

  it("löscht Spenden und Sollwerte nur nach Administratorbestätigung", async () => {
    dbMocks.resetArea.mockResolvedValue(undefined);
    const adminCaller = appRouter.createCaller(ctx);
    const planningCaller = appRouter.createCaller(planningTeamCtx);

    await expect(
      adminCaller.reset.area({ area: "cakes", adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.resetArea).not.toHaveBeenCalled();

    await expect(
      planningCaller.reset.area({
        area: "cakes",
        adminPassword: ADMIN_PASSWORD,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.resetArea).not.toHaveBeenCalled();

    await expect(
      adminCaller.reset.area({
        area: "cakes",
        adminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.resetArea).toHaveBeenCalledWith("cakes", {
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

  it("leert Modulbelegungen nur mit Administratorpasswort und ohne Datenlöschung", async () => {
    dbMocks.clearModuleAssignments.mockResolvedValue({
      area: "materials",
      cleared: 4,
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.moduleAssignments.clear({
        area: "materials",
        adminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.clearModuleAssignments).not.toHaveBeenCalled();

    await expect(
      appRouter.createCaller(planningTeamCtx).moduleAssignments.clear({
        area: "prep",
        adminPassword: ADMIN_PASSWORD,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller.moduleAssignments.clear({
        area: "materials",
        adminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ area: "materials", cleared: 4 });
    expect(dbMocks.clearModuleAssignments).toHaveBeenCalledWith("materials");
  });

  it("setzt Helferbelegungen nur mit Administratorpasswort zurück und löscht keine Helfer", async () => {
    dbMocks.clearModuleAssignments.mockResolvedValue({
      area: "helpers",
      cleared: 7,
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.moduleAssignments.clear({
        area: "helpers",
        adminPassword: "falsch",
      })
    ).rejects.toThrow("Administratorpasswort");
    expect(dbMocks.clearModuleAssignments).not.toHaveBeenCalled();

    await expect(
      caller.moduleAssignments.clear({
        area: "helpers",
        adminPassword: ADMIN_PASSWORD,
      })
    ).resolves.toEqual({ area: "helpers", cleared: 7 });
    expect(dbMocks.clearModuleAssignments).toHaveBeenCalledWith("helpers");
  });

  it("fordert das aktuelle Administratorpasswort vor jeder Passwortänderung", async () => {
    const caller = appRouter.createCaller(ctx);

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

  it("prüft und übernimmt den vollständigen Excelimport nur mit gebundener Freigabe", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.excel.previewFull({ base64: "eA==" })).resolves.toMatchObject({
      totals: { created: 1 },
    });

    const input = {
      base64: "eA==",
      filename: "Fremde-Veranstaltung.xlsx",
      currentDigest: "a".repeat(64),
      previewBinding: "preview-binding-test-token",
    };
    await expect(
      caller.excel.applyFull({ ...input, adminPassword: "falsch" })
    ).rejects.toThrow("Administratorpasswort");
    await expect(
      caller.excel.applyFull({ ...input, adminPassword: ADMIN_PASSWORD })
    ).resolves.toMatchObject({ created: 4, updated: 5, deleted: 6 });

    expect(moduleImportMocks.applyFullExcelImport).toHaveBeenCalledWith(
      "eA==",
      "Fremde-Veranstaltung.xlsx",
      "a".repeat(64),
      expect.objectContaining({ userId: 1, role: "admin" })
    );
    expect(previewBindingMocks.verifyPreviewBinding).toHaveBeenCalledWith(
      "preview-binding-test-token",
      expect.objectContaining({ operation: "full-excel", userId: 1 })
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
      activityEntry: "Vorbereitungsaufgabe angelegt",
      activityAuthor: "Organisation",
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
      activityEntry: "Vorbereitungsaufgabe aktualisiert",
      activityAuthor: "Organisation",
    });
  });

  it("erlaubt dem Planungsteam das Verschieben von Vorbereitungsaufgaben ins Löschprotokoll mit Ansprechpartnerauswahl", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);
    dbMocks.deletePrep.mockResolvedValue({ affectedRows: 1 });

    await expect(
      caller.prep.remove({
        id: 30,
      })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.deletePrep).toHaveBeenCalledWith(30, {
      actor: {
        userId: 2,
        name: "Organisation",
        role: "user",
        loginMethod: "manus",
      },
    });
  });

  it("erlaubt dem Planungsteam das Verschieben von Nachbereitungsaufgaben ins Löschprotokoll mit Ansprechpartnerauswahl", async () => {
    const caller = appRouter.createCaller(planningTeamCtx);
    dbMocks.deletePost.mockResolvedValue({ affectedRows: 1 });

    await expect(
      caller.post.remove({
        id: 40,
      })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.deletePost).toHaveBeenCalledWith(40, {
      actor: {
        userId: 2,
        name: "Organisation",
        role: "user",
        loginMethod: "manus",
      },
    });
  });

  it("verlangt bei Materiallöschungen die Auswahl eines Ansprechpartners", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.getContact.mockResolvedValue({ id: 5, name: "Christian Lambrich" });
    dbMocks.deleteMaterial.mockResolvedValue({ affectedRows: 1 });

    await expect(
      caller.materials.remove({
        id: 50,
      })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.deleteMaterial).toHaveBeenCalledWith(50, {
      actor: {
        userId: 1,
        name: "Organisation",
        role: "admin",
        loginMethod: "manus",
      },
    });
  });

  it("legt Material standardmäßig als Offen an und akzeptiert den dreistufigen Stand", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.createMaterial.mockResolvedValue({ insertId: 71 });
    dbMocks.updateMaterial.mockResolvedValue({ affectedRows: 1 });

    await expect(
      caller.materials.create({ article: "Kabelbinder" })
    ).resolves.toEqual({ insertId: 71 });
    expect(dbMocks.createMaterial).toHaveBeenCalledWith({
      article: "Kabelbinder",
      status: "offen",
    });

    await expect(
      caller.materials.update({ id: 71, status: "bestellt" })
    ).resolves.toEqual({ affectedRows: 1 });
    expect(dbMocks.updateMaterial).toHaveBeenCalledWith(71, {
      status: "bestellt",
    });
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
      caller.helpers.remove({ id: 20 })
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
      },
    });
    expect(dbMocks.deleteCake).toHaveBeenCalledWith(30, {
      userId: 2,
      name: "Organisation",
      role: "user",
      loginMethod: "manus",
    });
  });

  it("erfasst und aktualisiert Kuchenspenden mit optionalen Allergen-Badges und Freitext", async () => {
    dbMocks.createCake.mockResolvedValue({ id: 88, created: true });
    dbMocks.updateCake.mockResolvedValue({ affectedRows: 1 });
    const caller = appRouter.createCaller(planningTeamCtx);

    await expect(
      caller.cakes.create({
        donor: "Josi Volli",
        cake: "Rumkuchen",
        locationId: 5,
        dropoffDate: "2026-06-20",
        dropoffTime: "11:30",
        vegan: false,
        glutenFree: false,
        lactoseFree: true,
        containsNuts: true,
        note: "Enthält Alkohol / Rum",
      })
    ).resolves.toEqual({ id: 88, created: true });

    expect(dbMocks.createCake).toHaveBeenCalledWith({
      donor: "Josi Volli",
      cake: "Rumkuchen",
      donationCategory: "kuchen",
      locationId: 5,
      dropoffDate: "2026-06-20",
      dropoffTime: "11:30",
      vegan: false,
      glutenFree: false,
      lactoseFree: true,
      containsNuts: true,
      meat: false,
      note: "Enthält Alkohol / Rum",
    });

    await expect(
      caller.cakes.update({
        id: 88,
        vegan: true,
        dropoffTime: "12:00",
        note: "Rezept geändert: jetzt vegan",
      })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.updateCake).toHaveBeenCalledWith(88, {
      vegan: true,
      dropoffTime: "12:00",
      note: "Rezept geändert: jetzt vegan",
    });

    await expect(
      caller.cakes.update({ id: 88, donationCategory: "sonstiges" })
    ).resolves.toEqual({ affectedRows: 1 });

    expect(dbMocks.updateCake).toHaveBeenLastCalledWith(88, {
      donationCategory: "sonstiges",
    });
  });

  it("erlaubt Administratoren bei Helferlöschung auch die Planbereinigung", async () => {
    dbMocks.deleteHelper.mockResolvedValue({ affectedRows: 1 });
    const caller = appRouter.createCaller(ctx);

    await caller.helpers.remove({ id: 20 });

    expect(dbMocks.deleteHelper).toHaveBeenCalledWith(20, {
      allowAssigned: true,
      actor: {
        userId: 1,
        name: "Organisation",
        role: "admin",
        loginMethod: "manus",
      },
    });
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

    await expect(
      caller.years.create({
        year: 2028,
        initialEventName: "Planungs-Team-Test",
        activeDays: ["Samstag"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      url: "/uploads/location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
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
      url: "/uploads/location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
    });
    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      "location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
      png,
      "image/png"
    );
    expect(dbMocks.updateLocation).toHaveBeenCalledWith(55, {
      logoKey: "location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
      logoUrl: "/uploads/location-logos/events/2026/1/55-Mayen_Viehmarkt.png",
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

  it("erlaubt Administratoren das Speichern von Spenden-Sollwerten je Kategorie", async () => {
    const adminCaller = appRouter.createCaller(ctx);
    const planningCaller = appRouter.createCaller(planningTeamCtx);

    dbMocks.updateEventDetails.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      donationTargetKuchen: 20,
      donationTargetSalat: 10,
      donationTargetSnack: 15,
      donationTargetSonstiges: 5,
    });

    await expect(
      planningCaller.events.update({
        id: 1,
        donationTargetKuchen: 20,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const result = await adminCaller.events.update({
      id: 1,
      donationTargetKuchen: 20,
      donationTargetSalat: 10,
      donationTargetSnack: 15,
      donationTargetSonstiges: 5,
    });

    expect(result).toMatchObject({
      donationTargetKuchen: 20,
      donationTargetSalat: 10,
      donationTargetSnack: 15,
      donationTargetSonstiges: 5,
    });
    expect(dbMocks.updateEventDetails).toHaveBeenCalledWith(1, {
      donationTargetKuchen: 20,
      donationTargetSalat: 10,
      donationTargetSnack: 15,
      donationTargetSonstiges: 5,
    });
  });

  it("liefert im Dashboard-Stats-Endpunkt Spenden mit Ist/Soll und Eigenschaftszählern", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.getEvent.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      activeDays: ["Freitag", "Samstag", "Sonntag"],
      startDate: null,
      endDate: null,
      donationTargetKuchen: 15,
      donationTargetSalat: 8,
      donationTargetSnack: 12,
      donationTargetSonstiges: 6,
    });
    dbMocks.listCakes.mockResolvedValue([
      {
        id: 1,
        donationCategory: "kuchen",
        vegan: true,
        glutenFree: false,
        lactoseFree: true,
        containsNuts: false,
        meat: false,
      },
      {
        id: 2,
        donationCategory: "salat",
        vegan: false,
        glutenFree: true,
        lactoseFree: false,
        containsNuts: false,
        meat: true,
      },
      {
        id: 3,
        donationCategory: "snack",
        vegan: true,
        glutenFree: true,
        lactoseFree: true,
        containsNuts: true,
        meat: false,
      },
      {
        id: 4,
        donationCategory: "deftiges", // Legacy wird zu sonstiges aggregiert
        vegan: false,
        glutenFree: false,
        lactoseFree: false,
        containsNuts: false,
        meat: true,
      },
    ]);

    const stats = await caller.dashboard.stats();
    expect(stats.spenden).toEqual({
      gesamt: 4,
      kategorien: [
        { id: "kuchen", ist: 1, target: 15, label: "Kuchen / Gebäck" },
        { id: "salat", ist: 1, target: 8, label: "Salat" },
        { id: "snack", ist: 1, target: 12, label: "Dessert" },
        { id: "sonstiges", ist: 1, target: 6, label: "Sonstiges" },
      ],
      eigenschaften: {
        vegan: 2,
        glutenFree: 2,
        lactoseFree: 2,
        containsNuts: 1,
        meat: 2,
      },
    });
  });
});
