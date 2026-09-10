import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Helper, Shift } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listShifts: vi.fn(),
  listHelpers: vi.fn(),
  listAssignments: vi.fn(),
  assignHelper: vi.fn(),
  createShift: vi.fn(),
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

describe("Planungs-API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listShifts.mockResolvedValue([shift]);
    dbMocks.listHelpers.mockResolvedValue([helper]);
    dbMocks.listAssignments.mockResolvedValue([]);
    dbMocks.assignHelper.mockResolvedValue({ insertId: 1 });
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
});
