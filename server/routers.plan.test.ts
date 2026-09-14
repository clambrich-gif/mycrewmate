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
  deleteHelper: vi.fn(),
  deleteCake: vi.fn(),
  createPrep: vi.fn(),
  resetArea: vi.fn(),
  listDeletionAuditLogs: vi.fn(),
  clearDeletionAuditLogs: vi.fn(),
  restoreDeletionAuditLog: vi.fn(),
  getSecuritySettings: vi.fn(),
  getAppSettings: vi.fn(),
  getEvent: vi.fn(),
  updateCurrentEventPdfImage: vi.fn(),
  createEvent: vi.fn(),
  updateEventName: vi.fn(),
  deleteEvent: vi.fn(),
  deleteContact: vi.fn(),
  getContact: vi.fn(),
  listShiftAreaContacts: vi.fn(),
  setShiftAreaContact: vi.fn(),
  withPlanningWriteLock: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
}));
const backupMocks = vi.hoisted(() => ({
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
    dbMocks.assignHelper.mockResolvedValue({ insertId: 1 });
    dbMocks.updateShift.mockResolvedValue({ affectedRows: 1 });
    dbMocks.getContact.mockResolvedValue({ id: 5, name: "Chris Leitung" });
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
        expect(result.filename).toBe("RSC-Helferplanung-Anleitung.pdf");
        expect(result.mimeType).toBe("application/pdf");
        expect(Buffer.from(result.base64, "base64")).toEqual(pdf);
      }
      expect(storageMocks.storageGetSignedUrl).toHaveBeenCalledWith(
        "RSC-Helferplanung-Anleitung_2a9c73bd.pdf"
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

  it("speichert eine frei formulierte Vorbereitungsfrist unverändert", async () => {
    const caller = appRouter.createCaller(ctx);
    dbMocks.createPrep.mockResolvedValue({ insertId: 30 });

    await caller.prep.create({
      task: "Absperrmaterial prüfen",
      dueText: "Spätestens zwei Wochen vor Streckenfreigabe",
    });

    expect(dbMocks.createPrep).toHaveBeenCalledWith({
      task: "Absperrmaterial prüfen",
      dueText: "Spätestens zwei Wochen vor Streckenfreigabe",
    });
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
});
