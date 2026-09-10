import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Helper, Shift } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listShifts: vi.fn(),
  listHelpers: vi.fn(),
  listAssignments: vi.fn(),
  assignHelper: vi.fn(),
  unassignHelper: vi.fn(),
  createShift: vi.fn(),
  deleteShift: vi.fn(),
  deleteHelper: vi.fn(),
  deleteCake: vi.fn(),
  createPrep: vi.fn(),
  listDeletionAuditLogs: vi.fn(),
  getContact: vi.fn(),
  listShiftAreaContacts: vi.fn(),
  setShiftAreaContact: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

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
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

const planningTeamCtx = {
  ...ctx,
  user: { ...ctx.user!, id: 2, openId: "planning-team", role: "user" as const },
} as TrpcContext;

describe("Planungs-API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listShifts.mockResolvedValue([shift]);
    dbMocks.listHelpers.mockResolvedValue([helper]);
    dbMocks.listAssignments.mockResolvedValue([]);
    dbMocks.assignHelper.mockResolvedValue({ insertId: 1 });
    dbMocks.getContact.mockResolvedValue({ id: 5, name: "Chris Leitung" });
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
});
