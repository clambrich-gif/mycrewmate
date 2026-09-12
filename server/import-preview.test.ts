import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import {
  applyPlanImport,
  parsePlanWorkbook,
  personSimilarity,
  previewExcelImport,
} from "./import-preview";
import * as db from "./db";

vi.mock("./db", () => ({
  listShifts: vi.fn(),
  listAssignments: vi.fn(),
  listHelpers: vi.fn(),
  updateShift: vi.fn(),
  createShift: vi.fn(),
  replaceShiftAssignment: vi.fn(),
  removeShiftAssignment: vi.fn(),
  upsertHelperByName: vi.fn(),
}));

const mocked = vi.mocked(db);

function workbookBase64(
  helperCell = "Anna Meyer, Bob Neu",
  includeHelperSheet = false,
  day = "Freitag"
) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "Tag",
        "Bereich",
        "Aufgabe",
        "Beginn",
        "Ende",
        "Bedarf",
        "Bemerkung",
        "Helfer",
      ],
      [
        day,
        "Catering",
        "Getränkeausgabe",
        "08:00",
        "12:00",
        2,
        "Kasse mitbringen",
        helperCell,
      ],
    ]),
    "EINSATZPLAN"
  );
  if (includeHelperSheet) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Ansprechpartner", "Name", "Helfen?", "Fr", "Sa", "So"],
        ["", "Anna Meyer", "Ja", "Ja", "Vielleicht", "Vielleicht"],
      ]),
      "HELFER"
    );
  }
  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  ).toString("base64");
}

function positionalWorkbookBase64(values: {
  startTime?: string;
  endTime?: string;
  needed?: number;
  helper1?: string;
  helper2?: string;
  helper3?: string;
}) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "Tag",
        "Bereich",
        "Aufgabe",
        "Beginn",
        "Ende",
        "Bedarf",
        "Helfer 1",
        "Helfer 2",
        "Helfer 3",
      ],
      [
        "Freitag",
        "Catering",
        "Getränkeausgabe",
        values.startTime ?? "08:00",
        values.endTime ?? "12:00",
        values.needed ?? 2,
        values.helper1 ?? "",
        values.helper2 ?? "",
        values.helper3 ?? "",
      ],
    ]),
    "EINSATZPLAN"
  );
  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  ).toString("base64");
}

const existingShift = {
  id: 1,
  year: 2026,
  day: "Freitag" as const,
  area: "Catering",
  task: "Getränkeausgabe",
  startTime: "08:00",
  endTime: "12:00",
  needed: 1,
  note: "",
  sortOrder: 0,
  createdAt: new Date(),
};
const anna = {
  id: 10,
  year: 2026,
  contactId: null,
  name: "Anna Meier",
  email: null,
  phone: null,
  note: null,
  willHelp: "ja" as const,
  availFri: "ja" as const,
  availSat: "vielleicht" as const,
  availSun: "vielleicht" as const,
  confirmed: "ja" as const,
  createdAt: new Date(),
};
const annaAssignment = {
  id: 20,
  shiftId: 1,
  helperId: 10,
  slot: 0,
  createdAt: new Date(),
};

describe("Excel-Einsatzplan-Prüfung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingShift.startTime = "08:00";
    existingShift.endTime = "12:00";
    existingShift.needed = 1;
    existingShift.note = "";
    mocked.listShifts.mockResolvedValue([existingShift]);
    mocked.listHelpers.mockResolvedValue([anna]);
    mocked.listAssignments.mockResolvedValue([annaAssignment]);
  });

  it("erkennt den exportierten Einsatzplan und mehrere Helfer in einer Zelle", () => {
    const parsed = parsePlanWorkbook(workbookBase64());
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      values: {
        day: "Freitag",
        area: "Catering",
        task: "Getränkeausgabe",
        startTime: "08:00",
        endTime: "12:00",
        needed: 2,
      },
      helpers: [
        { slot: 0, name: "Anna Meyer" },
        { slot: 1, name: "Bob Neu" },
      ],
    });
  });

  it.each([
    ["Mo", "Montag"],
    ["Di", "Dienstag"],
    ["Mi", "Mittwoch"],
    ["Do", "Donnerstag"],
    ["Fr", "Freitag"],
    ["Sa", "Samstag"],
    ["So", "Sonntag"],
  ] as const)("erkennt %s als %s", (input, expected) => {
    const parsed = parsePlanWorkbook(
      workbookBase64("Anna Meyer", false, input)
    );
    expect(parsed.rows[0].values.day).toBe(expected);
  });

  it.each(["MontagX", "Dorf"])(
    "interpretiert einen ungültigen Tageswert %s nicht als Wochentag",
    day => {
      expect(
        parsePlanWorkbook(workbookBase64("Anna Meyer", false, day)).rows
      ).toHaveLength(0);
    }
  );

  it("bewahrt leere Helferplätze bei expliziten Slotspalten", () => {
    const parsed = parsePlanWorkbook(
      positionalWorkbookBase64({ helper2: "Bob Neu" })
    );
    expect(parsed.rows[0]).toMatchObject({
      values: { needed: 2 },
      helpers: [{ slot: 1, name: "Bob Neu" }],
      positionalSlots: [0, 1, 2],
    });
  });

  it("markiert eine geleerte explizite Slotspalte als bestätigbare Entfernung", async () => {
    const preview = await previewExcelImport(
      positionalWorkbookBase64({ needed: 1 })
    );
    expect(preview.shifts[0].assignments).toContainEqual(
      expect.objectContaining({
        slot: 0,
        kind: "remove",
        currentHelperName: "Anna Meier",
        helperKey: null,
      })
    );
  });

  it("entfernt einen Helferplatz erst nach expliziter Auswahl", async () => {
    const file = positionalWorkbookBase64({ needed: 1 });
    const preview = await previewExcelImport(file);
    const removal = preview.shifts[0].assignments[0];
    const result = await applyPlanImport(file, {
      selectedShiftKeys: [],
      selectedAssignmentKeys: [removal.key],
      helperDecisions: [],
    });
    expect(mocked.removeShiftAssignment).toHaveBeenCalledWith({
      shiftId: 1,
      slot: 0,
    });
    expect(result.assignmentsApplied).toBe(1);
  });

  it("erkennt ähnliche Namen, neue Helfer und geänderte Zuordnungen", async () => {
    const preview = await previewExcelImport(workbookBase64());
    expect(personSimilarity("Anna Meyer", "Anna Meier")).toBeGreaterThan(0.8);
    expect(preview.totals).toMatchObject({
      changedShifts: 1,
      assignmentChanges: 2,
      newHelpers: 1,
      similarHelpers: 1,
    });
    expect(preview.helperSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          importedName: "Anna Meyer",
          status: "similar",
          defaultTarget: "system:10",
        }),
        expect.objectContaining({ importedName: "Bob Neu", status: "new" }),
      ])
    );
    expect(preview.shifts[0].assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: 0,
          kind: "replace",
          currentHelperName: "Anna Meier",
        }),
        expect.objectContaining({ slot: 1, kind: "add" }),
      ])
    );
    expect(mocked.updateShift).not.toHaveBeenCalled();
    expect(mocked.createShift).not.toHaveBeenCalled();
    expect(mocked.replaceShiftAssignment).not.toHaveBeenCalled();
    expect(mocked.upsertHelperByName).not.toHaveBeenCalled();
  });

  it("empfiehlt bei Schreibvarianten den vorhandenen Helfer statt einer Dublette aus dem Helferblatt", async () => {
    const preview = await previewExcelImport(
      workbookBase64("Anna Meyer", true)
    );
    expect(preview.helperSuggestions[0]).toMatchObject({
      importedName: "Anna Meyer",
      status: "similar",
      defaultTarget: "system:10",
    });
  });

  it("überschreibt bei mehreren gleichnamigen Zeitfenstern keine zufällige Schicht", async () => {
    mocked.listShifts.mockResolvedValue([
      { ...existingShift, id: 1, startTime: "08:00", endTime: "10:00" },
      { ...existingShift, id: 2, startTime: "10:00", endTime: "12:00" },
    ]);
    mocked.listAssignments.mockResolvedValue([]);
    const file = positionalWorkbookBase64({
      startTime: "12:00",
      endTime: "14:00",
      needed: 1,
    });
    const preview = await previewExcelImport(file);
    expect(preview.shifts[0]).toMatchObject({
      status: "conflict",
      existingShiftId: null,
      assignments: [],
    });
    const result = await applyPlanImport(file, {
      selectedShiftKeys: [preview.shifts[0].key],
      selectedAssignmentKeys: [],
      helperDecisions: [],
    });
    expect(result.warnings[0]).toContain("Mehrdeutige Schicht");
    expect(mocked.updateShift).not.toHaveBeenCalled();
    expect(mocked.createShift).not.toHaveBeenCalled();
  });

  it("verwirft manipulierte oder veraltete Systemhelfer-IDs ohne Slotmutation", async () => {
    const preview = await previewExcelImport(workbookBase64());
    const bob = preview.helperSuggestions.find(
      item => item.importedName === "Bob Neu"
    )!;
    const bobAssignment = preview.shifts[0].assignments.find(
      item => item.importedName === "Bob Neu"
    )!;
    const result = await applyPlanImport(workbookBase64(), {
      selectedShiftKeys: [preview.shifts[0].key],
      selectedAssignmentKeys: [bobAssignment.key],
      helperDecisions: [{ key: bob.key, target: "system:999999" }],
    });
    expect(result.warnings.join(" ")).toContain("Ungültiger Helferabgleich");
    expect(mocked.replaceShiftAssignment).not.toHaveBeenCalled();
    expect(mocked.removeShiftAssignment).not.toHaveBeenCalled();
  });

  it("legt bei abgewählter Schichtänderung weder Helfer noch neue Slotbelegung an", async () => {
    const preview = await previewExcelImport(workbookBase64());
    const bob = preview.helperSuggestions.find(
      item => item.importedName === "Bob Neu"
    )!;
    const bobAssignment = preview.shifts[0].assignments.find(
      item => item.importedName === "Bob Neu"
    )!;
    await applyPlanImport(workbookBase64(), {
      selectedShiftKeys: [],
      selectedAssignmentKeys: [bobAssignment.key],
      helperDecisions: [{ key: bob.key, target: "new" }],
    });
    expect(mocked.upsertHelperByName).not.toHaveBeenCalled();
    expect(mocked.replaceShiftAssignment).not.toHaveBeenCalled();
  });

  it("wendet ausschließlich bestätigte Schicht-, Helfer- und Zuordnungsänderungen an", async () => {
    const helpers = [anna];
    const assignments = [annaAssignment];
    mocked.listHelpers.mockImplementation(async () => helpers as any);
    mocked.listAssignments.mockImplementation(async () => assignments as any);
    mocked.updateShift.mockImplementation(async (_id, values) => {
      Object.assign(existingShift, values);
      return {} as any;
    });
    mocked.upsertHelperByName.mockImplementation(async values => {
      const helper = {
        ...anna,
        id: 11,
        name: values.name,
        confirmed: "nein" as const,
      };
      helpers.push(helper as any);
      return { id: 11, created: true };
    });
    mocked.replaceShiftAssignment.mockImplementation(async values => {
      assignments.push({ ...annaAssignment, id: 21, ...values });
      return {} as any;
    });

    const preview = await previewExcelImport(workbookBase64());
    const annaSuggestion = preview.helperSuggestions.find(
      item => item.importedName === "Anna Meyer"
    )!;
    const bobSuggestion = preview.helperSuggestions.find(
      item => item.importedName === "Bob Neu"
    )!;
    const result = await applyPlanImport(workbookBase64(), {
      selectedShiftKeys: [preview.shifts[0].key],
      selectedAssignmentKeys: preview.shifts[0].assignments.map(
        item => item.key
      ),
      helperDecisions: [
        { key: annaSuggestion.key, target: "system:10" },
        { key: bobSuggestion.key, target: "new" },
      ],
    });

    expect(result).toMatchObject({
      shiftsUpdated: 1,
      helpersCreated: 1,
      assignmentsApplied: 1,
      warnings: [],
    });
    expect(mocked.updateShift).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ needed: 2, note: "Kasse mitbringen" })
    );
    expect(mocked.replaceShiftAssignment).toHaveBeenCalledWith({
      shiftId: 1,
      helperId: 11,
      slot: 1,
    });
  });
});
