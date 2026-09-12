import * as XLSX from "xlsx";
import * as db from "./db";
import { WEEKDAYS, type Weekday } from "../shared/weekdays";

export type ImportDay = Weekday;

export type ImportedShiftValues = {
  day: ImportDay;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
  needed: number;
  note: string;
};

export type ParsedPlanRow = {
  key: string;
  rowNumber: number;
  values: ImportedShiftValues;
  helpers: Array<{ slot: number; name: string }>;
  positionalSlots: number[];
};

export type HelperCandidate = {
  key: string;
  label: string;
  source: "system" | "helperSheet";
  helperId: number | null;
  score: number;
};

export type HelperSuggestion = {
  key: string;
  importedName: string;
  status: "similar" | "fromHelperSheet" | "new";
  candidates: HelperCandidate[];
  defaultTarget: string;
};

export type AssignmentSuggestion = {
  key: string;
  rowKey: string;
  slot: number;
  importedName: string;
  helperKey: string | null;
  currentHelperId: number | null;
  currentHelperName: string | null;
  kind: "add" | "replace" | "remove";
};

export type ShiftPreview = {
  key: string;
  rowNumber: number;
  values: ImportedShiftValues;
  status: "new" | "changed" | "unchanged" | "conflict";
  existingShiftId: number | null;
  current: ImportedShiftValues | null;
  conflictReason?: string;
  assignments: AssignmentSuggestion[];
};

export type ExcelImportPreview = {
  shifts: ShiftPreview[];
  helperSuggestions: HelperSuggestion[];
  totals: {
    planRows: number;
    newShifts: number;
    changedShifts: number;
    unchangedShifts: number;
    conflicts: number;
    assignmentChanges: number;
    newHelpers: number;
    similarHelpers: number;
  };
};

export type ImportApplyDecisions = {
  selectedShiftKeys: string[];
  selectedAssignmentKeys: string[];
  helperDecisions: Array<{
    key: string;
    target: string;
  }>;
};

const DAYS: readonly ImportDay[] = WEEKDAYS;

export const normalizeImportText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");

const canonicalName = (value: unknown) =>
  String(value ?? "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .replace(/\s+/g, " ");

const personKey = (value: unknown) => normalizeImportText(canonicalName(value));

const normalizeDay = (value: unknown): ImportDay | null => {
  const normalized = normalizeImportText(value).replace(/\.$/, "");
  const aliases: Record<string, ImportDay> = {
    mo: "Montag",
    montag: "Montag",
    di: "Dienstag",
    dienstag: "Dienstag",
    mi: "Mittwoch",
    mittwoch: "Mittwoch",
    do: "Donnerstag",
    donnerstag: "Donnerstag",
    fr: "Freitag",
    freitag: "Freitag",
    sa: "Samstag",
    samstag: "Samstag",
    so: "Sonntag",
    sonntag: "Sonntag",
  };
  return aliases[normalized] ?? null;
};

const normalizeTime = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  const match = text.match(/(?:^|\s)(\d{1,2})[:.]([0-5]\d)(?:\s|$)/);
  if (!match) return "";
  const hours = Number(match[1]);
  if (hours > 23) return "";
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
};

const splitTimeRange = (value: unknown) => {
  const matches = String(value ?? "").match(/\d{1,2}[:.]\d{2}/g) ?? [];
  return {
    startTime: normalizeTime(matches[0] ?? ""),
    endTime: normalizeTime(matches[1] ?? ""),
  };
};

const splitHelperCell = (value: unknown) =>
  String(value ?? "")
    .split(/[,;\n]+/)
    .map(item => canonicalName(item))
    .filter(
      item =>
        item &&
        !/^(offen|knapp|ok)$/i.test(item) &&
        !/doppelbelegung/i.test(item)
    );

const fieldIndex = (headers: unknown[], aliases: RegExp[]) =>
  headers.findIndex(value => {
    const normalized = normalizeImportText(value);
    return aliases.some(alias => alias.test(normalized));
  });

function detectPlanHeader(rows: unknown[][]) {
  for (let index = 0; index < Math.min(rows.length, 20); index++) {
    const row = rows[index] ?? [];
    const day = fieldIndex(row, [/^tag$/, /^wochentag$/]);
    const task = fieldIndex(row, [
      /^aufgabe$/,
      /^schicht$/,
      /^aufgabe \/ schicht$/,
    ]);
    if (day >= 0 && task >= 0) return { index, row };
  }
  return null;
}

function helperSheetNames(workbook: XLSX.WorkBook) {
  const worksheet = workbook.Sheets.HELFER;
  if (!worksheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
  });
  let headerIndex = rows.findIndex(
    row => fieldIndex(row, [/^name$/, /^name helfer$/]) >= 0
  );
  if (headerIndex < 0) headerIndex = 8;
  const nameColumn =
    fieldIndex(rows[headerIndex] ?? [], [/^name$/, /^name helfer$/]) >= 0
      ? fieldIndex(rows[headerIndex] ?? [], [/^name$/, /^name helfer$/])
      : 1;
  const names = new Map<string, string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const name = canonicalName(row?.[nameColumn]);
    if (name && !/^name helfer$/i.test(name)) names.set(personKey(name), name);
  }
  return Array.from(names.values());
}

export function parsePlanWorkbook(base64: string) {
  const workbook = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find(
      name => normalizeImportText(name) === "einsatzplan"
    ) ??
    workbook.SheetNames.find(name =>
      normalizeImportText(name).includes("einsatzplan")
    );
  if (!sheetName)
    return {
      rows: [] as ParsedPlanRow[],
      helperSheetNames: helperSheetNames(workbook),
    };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const detected = detectPlanHeader(rows);
  const headerIndex = detected?.index ?? 7;
  const headers = detected?.row ?? [];
  const columns = detected
    ? {
        day: fieldIndex(headers, [/^tag$/, /^wochentag$/]),
        area: fieldIndex(headers, [/^bereich$/, /^team$/]),
        task: fieldIndex(headers, [
          /^aufgabe$/,
          /^schicht$/,
          /^aufgabe \/ schicht$/,
        ]),
        start: fieldIndex(headers, [/^beginn$/, /^start$/, /^von$/]),
        end: fieldIndex(headers, [/^ende$/, /^bis$/]),
        time: fieldIndex(headers, [/^zeit$/, /^uhrzeit$/]),
        needed: fieldIndex(headers, [/^bedarf$/, /^anzahl$/, /^soll$/]),
        note: fieldIndex(headers, [/^bemerkung$/, /^notiz$/, /^hinweis$/]),
        helpers: headers
          .map((value, index) => ({ value: normalizeImportText(value), index }))
          .filter(
            item =>
              /^helfer(?:\s*\d+)?$/.test(item.value) ||
              /^person(?:\s*\d+)?$/.test(item.value) ||
              /^eingeteilte helfer/.test(item.value)
          )
          .map(item => item.index),
      }
    : {
        day: 0,
        area: 1,
        task: 2,
        start: 3,
        end: 4,
        time: -1,
        needed: 5,
        note: 10,
        helpers: Array.from({ length: 20 }, (_, index) => 11 + index),
      };

  const parsed: ParsedPlanRow[] = [];
  let lastDay: ImportDay | null = null;
  for (let offset = headerIndex + 1; offset < rows.length; offset++) {
    const row = rows[offset] ?? [];
    const rowDay = normalizeDay(row[columns.day]);
    if (rowDay) lastDay = rowDay;
    const task = String(row[columns.task] ?? "").trim();
    if (!lastDay || !task || /^aufgabe$/i.test(task)) continue;
    const area = String(row[columns.area] ?? "").trim() || "Allgemein";
    const range = columns.time >= 0 ? splitTimeRange(row[columns.time]) : null;
    let startTime = range?.startTime ?? normalizeTime(row[columns.start]);
    let endTime = range?.endTime ?? normalizeTime(row[columns.end]);
    if (Boolean(startTime) !== Boolean(endTime)) {
      startTime = "";
      endTime = "";
    }
    const compactHelpers =
      columns.helpers.length === 1
        ? splitHelperCell(row[columns.helpers[0]]).map((name, slot) => ({
            slot,
            name,
          }))
        : [];
    const positionalHelpers =
      columns.helpers.length > 1
        ? columns.helpers.flatMap((column, slot) => {
            const name = splitHelperCell(row[column])[0];
            return name ? [{ slot, name }] : [];
          })
        : [];
    const helpers = compactHelpers.length ? compactHelpers : positionalHelpers;
    const positionalSlots =
      columns.helpers.length > 1 ? columns.helpers.map((_, slot) => slot) : [];
    const rawNeeded = String(row[columns.needed] ?? "").trim();
    const neededValue = Number(rawNeeded);
    const declaredNeed =
      rawNeeded && Number.isFinite(neededValue)
        ? Math.trunc(neededValue)
        : helpers.length || 1;
    const requiredSlots = helpers.reduce(
      (maximum, helper) => Math.max(maximum, helper.slot + 1),
      0
    );
    const needed = Math.min(20, Math.max(0, declaredNeed, requiredSlots));
    parsed.push({
      key: `row-${offset + 1}`,
      rowNumber: offset + 1,
      values: {
        day: lastDay,
        area,
        task,
        startTime,
        endTime,
        needed,
        note: columns.note >= 0 ? String(row[columns.note] ?? "").trim() : "",
      },
      helpers: helpers.filter(helper => helper.slot < 20),
      positionalSlots: positionalSlots.slice(0, 20),
    });
  }
  return { rows: parsed, helperSheetNames: helperSheetNames(workbook) };
}

function levenshtein(left: string, right: string) {
  if (!left) return right.length;
  if (!right) return left.length;
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );
  for (let row = 1; row <= left.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column++) {
      const old = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      diagonal = old;
    }
  }
  return previous[right.length];
}

export function personSimilarity(left: string, right: string) {
  const normalizedLeft = personKey(left);
  const normalizedRight = personKey(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const direct =
    1 -
    levenshtein(normalizedLeft, normalizedRight) /
      Math.max(normalizedLeft.length, normalizedRight.length);
  const sortedLeft = normalizedLeft.split(" ").sort().join(" ");
  const sortedRight = normalizedRight.split(" ").sort().join(" ");
  const sorted =
    1 -
    levenshtein(sortedLeft, sortedRight) /
      Math.max(sortedLeft.length, sortedRight.length);
  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const overlap = Array.from(leftTokens).filter(token =>
    rightTokens.has(token)
  ).length;
  const tokenScore = overlap / Math.max(leftTokens.size, rightTokens.size);
  return Math.max(direct, sorted, tokenScore);
}

const exactShiftKey = (value: ImportedShiftValues) =>
  [value.day, value.area, value.task, value.startTime, value.endTime]
    .map(normalizeImportText)
    .join("|");

const identityShiftKey = (
  value: Pick<ImportedShiftValues, "day" | "area" | "task">
) => [value.day, value.area, value.task].map(normalizeImportText).join("|");

const shiftValues = (value: any): ImportedShiftValues => ({
  day: value.day,
  area: value.area,
  task: value.task,
  startTime: value.startTime ?? "",
  endTime: value.endTime ?? "",
  needed: value.needed ?? 0,
  note: value.note ?? "",
});

const sameShiftValues = (
  left: ImportedShiftValues,
  right: ImportedShiftValues
) =>
  exactShiftKey(left) === exactShiftKey(right) &&
  left.needed === right.needed &&
  normalizeImportText(left.note) === normalizeImportText(right.note);

export async function previewExcelImport(
  base64: string
): Promise<ExcelImportPreview> {
  const parsed = parsePlanWorkbook(base64);
  const [existingShifts, assignments, helpers] = await Promise.all([
    db.listShifts(),
    db.listAssignments(),
    db.listHelpers(),
  ]);
  const helperById = new Map(helpers.map(helper => [helper.id, helper]));
  const systemByKey = new Map(
    helpers.map(helper => [personKey(helper.name), helper])
  );
  const helperSheetByKey = new Map(
    parsed.helperSheetNames.map(name => [personKey(name), name])
  );
  const groupShifts = (makeKey: (value: ImportedShiftValues) => string) => {
    const grouped = new Map<string, typeof existingShifts>();
    for (const shift of existingShifts) {
      const itemKey = makeKey(shiftValues(shift));
      const list = grouped.get(itemKey) ?? [];
      list.push(shift);
      grouped.set(itemKey, list);
    }
    return grouped;
  };
  const exactShifts = groupShifts(exactShiftKey);
  const identityShifts = groupShifts(identityShiftKey);
  const assignmentsByShift = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    const list = assignmentsByShift.get(assignment.shiftId) ?? [];
    list.push(assignment);
    assignmentsByShift.set(assignment.shiftId, list);
  }

  const helperSuggestions = new Map<string, HelperSuggestion>();
  const helperRef = (importedName: string) => {
    const importedKey = personKey(importedName);
    const exactSystem = systemByKey.get(importedKey);
    if (exactSystem)
      return {
        reference: `system:${exactSystem.id}`,
        helperId: exactSystem.id,
      };
    if (!helperSuggestions.has(importedKey)) {
      const candidates: HelperCandidate[] = [];
      for (const helper of helpers) {
        const score = personSimilarity(importedName, helper.name);
        if (score >= 0.68)
          candidates.push({
            key: `system:${helper.id}`,
            label: helper.name,
            source: "system",
            helperId: helper.id,
            score,
          });
      }
      for (const name of parsed.helperSheetNames) {
        const score = personSimilarity(importedName, name);
        if (score >= 0.68)
          candidates.push({
            key: `helperSheet:${personKey(name)}`,
            label: name,
            source: "helperSheet",
            helperId: null,
            score,
          });
      }
      candidates.sort(
        (left, right) =>
          right.score - left.score ||
          left.label.localeCompare(right.label, "de")
      );
      const exactSheet = helperSheetByKey.get(importedKey);
      const bestSystemCandidate = candidates.find(
        candidate => candidate.source === "system"
      );
      const status = bestSystemCandidate
        ? "similar"
        : exactSheet
          ? "fromHelperSheet"
          : "new";
      const defaultTarget =
        bestSystemCandidate?.key ??
        (exactSheet ? `helperSheet:${importedKey}` : "new");
      helperSuggestions.set(importedKey, {
        key: importedKey,
        importedName: canonicalName(importedName),
        status,
        candidates: candidates.slice(0, 5),
        defaultTarget,
      });
    }
    return { reference: `proposal:${importedKey}`, helperId: null };
  };

  const shifts: ShiftPreview[] = parsed.rows.map(row => {
    const exactMatches = exactShifts.get(exactShiftKey(row.values)) ?? [];
    const identityMatches =
      identityShifts.get(identityShiftKey(row.values)) ?? [];
    const candidates = exactMatches.length ? exactMatches : identityMatches;
    const conflict = candidates.length > 1;
    const existing = candidates.length === 1 ? candidates[0] : undefined;
    const current = existing ? shiftValues(existing) : null;
    const status = conflict
      ? "conflict"
      : !existing
        ? "new"
        : sameShiftValues(current!, row.values)
          ? "unchanged"
          : "changed";
    const currentAssignments = new Map(
      (existing ? (assignmentsByShift.get(existing.id) ?? []) : []).map(
        item => [item.slot, item]
      )
    );
    const suggestions: AssignmentSuggestion[] = [];
    if (!conflict) {
      for (const imported of row.helpers) {
        const matched = helperRef(imported.name);
        const currentAssignment = currentAssignments.get(imported.slot);
        if (
          matched.helperId &&
          currentAssignment?.helperId === matched.helperId
        )
          continue;
        suggestions.push({
          key: `${row.key}:slot-${imported.slot}`,
          rowKey: row.key,
          slot: imported.slot,
          importedName: canonicalName(imported.name),
          helperKey: personKey(imported.name),
          currentHelperId: currentAssignment?.helperId ?? null,
          currentHelperName: currentAssignment
            ? (helperById.get(currentAssignment.helperId)?.name ?? null)
            : null,
          kind: currentAssignment ? "replace" : "add",
        });
      }
      if (existing && row.positionalSlots.length) {
        const importedSlots = new Set(row.helpers.map(helper => helper.slot));
        for (const [slot, currentAssignment] of Array.from(
          currentAssignments.entries()
        )) {
          if (!row.positionalSlots.includes(slot) || importedSlots.has(slot))
            continue;
          suggestions.push({
            key: `${row.key}:slot-${slot}`,
            rowKey: row.key,
            slot,
            importedName: "Nicht besetzt",
            helperKey: null,
            currentHelperId: currentAssignment.helperId,
            currentHelperName:
              helperById.get(currentAssignment.helperId)?.name ?? null,
            kind: "remove",
          });
        }
      }
      if (existing) {
        const suggestedSlots = new Set(
          suggestions.map(suggestion => suggestion.slot)
        );
        for (const [slot, currentAssignment] of Array.from(
          currentAssignments.entries()
        )) {
          if (slot < row.values.needed || suggestedSlots.has(slot)) continue;
          suggestions.push({
            key: `${row.key}:slot-${slot}`,
            rowKey: row.key,
            slot,
            importedName: "Nicht besetzt",
            helperKey: null,
            currentHelperId: currentAssignment.helperId,
            currentHelperName:
              helperById.get(currentAssignment.helperId)?.name ?? null,
            kind: "remove",
          });
        }
      }
    }
    return {
      key: row.key,
      rowNumber: row.rowNumber,
      values: row.values,
      status,
      existingShiftId: existing?.id ?? null,
      current,
      ...(conflict
        ? {
            conflictReason: `${candidates.length} vorhandene Schichten haben denselben Tag, Bereich und dieselbe Aufgabe. Bitte Zeiten oder Aufgabenbezeichnung vor dem Import eindeutig machen.`,
          }
        : {}),
      assignments: suggestions,
    };
  });

  const suggestions = Array.from(helperSuggestions.values());
  return {
    shifts,
    helperSuggestions: suggestions,
    totals: {
      planRows: shifts.length,
      newShifts: shifts.filter(item => item.status === "new").length,
      changedShifts: shifts.filter(item => item.status === "changed").length,
      unchangedShifts: shifts.filter(item => item.status === "unchanged")
        .length,
      conflicts: shifts.filter(item => item.status === "conflict").length,
      assignmentChanges: shifts.reduce(
        (sum, item) => sum + item.assignments.length,
        0
      ),
      newHelpers: suggestions.filter(item => item.status === "new").length,
      similarHelpers: suggestions.filter(item => item.status === "similar")
        .length,
    },
  };
}

export async function applyPlanImport(
  base64: string,
  decisions: ImportApplyDecisions
) {
  const preview = await previewExcelImport(base64);
  const selectedShifts = new Set(decisions.selectedShiftKeys);
  const selectedAssignments = new Set(decisions.selectedAssignmentKeys);
  const helperDecision = new Map(
    decisions.helperDecisions.map(item => [item.key, item.target])
  );
  const helperIds = new Map<string, number>();
  const warnings: string[] = [];

  const currentHelpers = await db.listHelpers();
  const currentHelperIds = new Set(currentHelpers.map(helper => helper.id));
  for (const helper of currentHelpers)
    helperIds.set(personKey(helper.name), helper.id);

  const selectedDays = new Map<string, Set<ImportDay>>();
  for (const shift of preview.shifts) {
    if (
      shift.status === "conflict" ||
      ((shift.status === "new" || shift.status === "changed") &&
        !selectedShifts.has(shift.key))
    )
      continue;
    for (const assignment of shift.assignments) {
      if (!selectedAssignments.has(assignment.key)) continue;
      if (!assignment.helperKey) continue;
      const days =
        selectedDays.get(assignment.helperKey) ?? new Set<ImportDay>();
      days.add(shift.values.day);
      selectedDays.set(assignment.helperKey, days);
    }
  }

  let helpersCreated = 0;
  let helpersMatched = 0;
  for (const suggestion of preview.helperSuggestions) {
    const target = helperDecision.get(suggestion.key);
    if (!selectedDays.has(suggestion.key) || !target || target === "skip")
      continue;
    const allowedTargets = new Set([
      "new",
      suggestion.defaultTarget,
      ...suggestion.candidates.map(candidate => candidate.key),
    ]);
    if (!allowedTargets.has(target)) {
      warnings.push(
        `${suggestion.importedName}: Ungültiger Helferabgleich wurde verworfen.`
      );
      continue;
    }
    if (target.startsWith("system:")) {
      const helperId = Number(target.split(":")[1]);
      if (!currentHelperIds.has(helperId)) {
        warnings.push(
          `${suggestion.importedName}: Ausgewählter Helfer ist nicht mehr vorhanden.`
        );
        continue;
      }
      helperIds.set(suggestion.key, helperId);
      helpersMatched++;
      continue;
    }
    let targetName = suggestion.importedName;
    if (target.startsWith("helperSheet:")) {
      const key = target.slice("helperSheet:".length);
      targetName =
        suggestion.candidates.find(candidate => candidate.key === target)
          ?.label ??
        (key === suggestion.key ? suggestion.importedName : targetName);
    }
    const existing = (await db.listHelpers()).find(
      helper => personKey(helper.name) === personKey(targetName)
    );
    if (existing) {
      helperIds.set(suggestion.key, existing.id);
      helpersMatched++;
      continue;
    }
    const days = selectedDays.get(suggestion.key) ?? new Set<ImportDay>();
    const created = await db.upsertHelperByName({
      name: targetName,
      willHelp: "ja",
      availFri: days.has("Freitag") ? "ja" : "vielleicht",
      availSat: days.has("Samstag") ? "ja" : "vielleicht",
      availSun: days.has("Sonntag") ? "ja" : "vielleicht",
      confirmed: "nein",
    });
    helperIds.set(suggestion.key, created.id);
    if (created.created) helpersCreated++;
    else helpersMatched++;
  }

  const shiftIds = new Map<string, number>();
  let shiftsCreated = 0;
  let shiftsUpdated = 0;
  for (const shift of preview.shifts) {
    if (shift.existingShiftId) shiftIds.set(shift.key, shift.existingShiftId);
    if (shift.status === "conflict") {
      if (selectedShifts.has(shift.key))
        warnings.push(
          `${shift.values.day} / ${shift.values.task}: Mehrdeutige Schicht wurde nicht importiert.`
        );
      continue;
    }
    if (!selectedShifts.has(shift.key) || shift.status === "unchanged")
      continue;
    if (shift.existingShiftId) {
      await db.updateShift(shift.existingShiftId, shift.values);
      shiftsUpdated++;
    } else {
      const result: any = await db.createShift(shift.values);
      const id = Number(result?.[0]?.insertId ?? result?.insertId);
      shiftIds.set(shift.key, id);
      shiftsCreated++;
    }
  }

  let assignmentsApplied = 0;
  for (const shift of preview.shifts) {
    const shiftId = shiftIds.get(shift.key);
    if (!shiftId) continue;
    if (
      (shift.status === "new" || shift.status === "changed") &&
      !selectedShifts.has(shift.key)
    )
      continue;
    for (const assignment of shift.assignments) {
      if (!selectedAssignments.has(assignment.key)) continue;
      if (assignment.kind === "remove") {
        if (assignment.currentHelperId)
          await db.removeShiftAssignment({
            shiftId,
            slot: assignment.slot,
          });
        assignmentsApplied++;
        continue;
      }
      if (assignment.slot < 0 || assignment.slot >= shift.values.needed) {
        warnings.push(
          `${shift.values.day} / ${shift.values.task}: Platz ${assignment.slot + 1} liegt außerhalb des Bedarfs.`
        );
        continue;
      }
      const helperId = assignment.helperKey
        ? helperIds.get(assignment.helperKey)
        : undefined;
      if (!helperId) {
        warnings.push(
          `${assignment.importedName}: Helferabgleich wurde nicht bestätigt.`
        );
        continue;
      }
      if (assignment.currentHelperId === helperId) continue;
      try {
        await db.replaceShiftAssignment({
          shiftId,
          helperId,
          slot: assignment.slot,
        });
        assignmentsApplied++;
      } catch {
        warnings.push(
          `${shift.values.day} / ${shift.values.task}: Zuordnung von ${assignment.importedName} konnte nicht übernommen werden.`
        );
      }
    }
  }

  return {
    shiftsCreated,
    shiftsUpdated,
    assignmentsApplied,
    helpersCreated,
    helpersMatched,
    warnings,
  };
}
