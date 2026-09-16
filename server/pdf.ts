import type { Archiver } from "archiver";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import type {
  AppSettings,
  Assignment,
  Contact,
  Helper,
  Shift,
  ShiftAreaContact,
} from "../drizzle/schema";
import * as db from "./db";
import { DAYS, evaluateShifts, toMinutes, type Day } from "./logic";
import { currentEventYear } from "./year-context";
import { storageGetSignedUrl } from "./storage";
import { resolveEventPdfLogoKey } from "./event-pdf-image";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver") as {
  ZipArchive: new (options: { zlib: { level: number } }) => Archiver;
};

export const DEFAULT_PDF_SETTINGS = {
  id: 1,
  eventName: "MyEifelRide",
  eventYear: "2026",
  helperPdfTitle: "Aufgabenübersicht",
  blankPlanTitle: "Einsatzplan – Blanko",
  contactLabel: "Ansprechpartner",
  footerText: "",
  logoKey: null,
  logoUrl: null,
  extraColumns: "[]",
  blankRowsPerShift: 0,
  updatedAt: new Date(0),
} satisfies AppSettings;

type PlanningData = {
  helpers: Helper[];
  contacts: Contact[];
  shifts: Shift[];
  assignments: Assignment[];
  areaContacts?: ShiftAreaContact[];
  settings: AppSettings;
  logoBuffer?: Buffer;
};

type PdfColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 42;
const contentWidth = pageWidth - margin * 2;
const colors = {
  ink: "#172033",
  muted: "#5f6877",
  line: "#d9dee7",
  header: "#eef3f8",
  accent: "#155e75",
};

function collectPdf(
  build: (doc: PDFKit.PDFDocument) => void,
  layout: "portrait" | "landscape" = "portrait"
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout,
      margin,
      bufferPages: true,
      info: { Creator: "RSC Helferplanung" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      const current = index - range.start + 1;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(8).fillColor(colors.muted);
      doc.text(`Seite ${current} von ${range.count}`, 0, doc.page.height - 24, {
        align: "center",
        width: doc.page.width,
        lineBreak: false,
      });
    }
    doc.end();
  });
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Helfer"
  );
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(shift: Shift) {
  if (!shift.startTime || !shift.endTime) return "keine feste Uhrzeit";
  return `${shift.startTime}–${shift.endTime}`;
}

function sortShifts(a: Shift, b: Shift) {
  const dayOrder = DAYS.indexOf(a.day as Day) - DAYS.indexOf(b.day as Day);
  if (dayOrder !== 0) return dayOrder;
  const timeOrder =
    (toMinutes(a.startTime) ?? -1) - (toMinutes(b.startTime) ?? -1);
  if (timeOrder !== 0) return timeOrder;
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

function parseExtraColumns(settings: AppSettings) {
  try {
    const parsed = JSON.parse(settings.extraColumns);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  settings: AppSettings,
  title: string,
  subtitle?: string,
  logoBuffer?: Buffer
) {
  const headerTop = doc.y;
  if (logoBuffer) {
    try {
      doc.image(
        logoBuffer,
        doc.page.width - doc.page.margins.right - 64,
        headerTop,
        {
          fit: [64, 64],
          align: "right",
        }
      );
    } catch {
      // Ein beschädigtes Logo darf den operativen PDF-Export nicht blockieren.
    }
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(21)
    .fillColor(colors.ink)
    .text(title, { width: logoBuffer ? contentWidth - 84 : contentWidth });
  doc.moveDown(0.55);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(colors.accent)
    .text(`${settings.eventName} ${settings.eventYear}`.trim(), {
      width: logoBuffer ? contentWidth - 84 : contentWidth,
    });
  doc.moveDown(0.25);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(colors.muted)
    .text(subtitle ?? `Stand: ${formatDate()} (aus Helferplanung)`, {
      width: logoBuffer ? contentWidth - 84 : contentWidth,
    });
  if (logoBuffer) doc.y = Math.max(doc.y, headerTop + 68);
  doc.moveDown(0.7);
  doc
    .strokeColor(colors.line)
    .lineWidth(0.7)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(1.2);
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  required: number,
  repeat?: () => void
) {
  const bottom = doc.page.height - doc.page.margins.bottom - 22;
  if (doc.y + required <= bottom) return;
  doc.addPage();
  if (repeat) repeat();
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  x: number
) {
  const y = doc.y;
  const height = 24;
  doc
    .rect(
      x,
      y,
      columns.reduce((sum, column) => sum + column.width, 0),
      height
    )
    .fillAndStroke(colors.header, colors.line);
  let cursor = x;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colors.ink);
  for (const column of columns) {
    doc.text(column.label, cursor + 5, y + 7, {
      width: column.width - 10,
      align: column.align ?? "left",
      lineBreak: false,
    });
    cursor += column.width;
    doc
      .moveTo(cursor, y)
      .lineTo(cursor, y + height)
      .strokeColor(colors.line)
      .stroke();
  }
  doc.x = x;
  doc.y = y + height;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  values: Record<string, string>,
  x: number,
  options: { minimumHeight?: number } = {}
) {
  doc.font("Helvetica").fontSize(8.5);
  const heights = columns.map(column =>
    doc.heightOfString(values[column.key] ?? "", {
      width: column.width - 10,
      lineGap: 1,
    })
  );
  const height = Math.max(
    options.minimumHeight ?? 25,
    Math.max(...heights) + 12
  );
  ensureSpace(doc, height + 5, () => drawTableHeader(doc, columns, x));
  const y = doc.y;
  const width = columns.reduce((sum, column) => sum + column.width, 0);
  doc
    .rect(x, y, width, height)
    .strokeColor(colors.line)
    .lineWidth(0.6)
    .stroke();
  let cursor = x;
  for (const column of columns) {
    doc
      .fillColor(colors.ink)
      .text(values[column.key] ?? "", cursor + 5, y + 6, {
        width: column.width - 10,
        height: height - 10,
        align: column.align ?? "left",
        lineGap: 1,
      });
    cursor += column.width;
    doc
      .moveTo(cursor, y)
      .lineTo(cursor, y + height)
      .strokeColor(colors.line)
      .stroke();
  }
  doc.x = x;
  doc.y = y + height;
}

export function renderHelperTaskPdf(data: PlanningData, helperId: number) {
  const helper = data.helpers.find(item => item.id === helperId);
  if (!helper) throw new Error("Helfer wurde nicht gefunden");
  const contact = data.contacts.find(item => item.id === helper.contactId);
  const shiftById = new Map(data.shifts.map(shift => [shift.id, shift]));
  const helperById = new Map(data.helpers.map(item => [item.id, item]));
  const assignmentsByShift = new Map<number, Assignment[]>();
  for (const assignment of data.assignments) {
    if (!assignmentsByShift.has(assignment.shiftId))
      assignmentsByShift.set(assignment.shiftId, []);
    assignmentsByShift.get(assignment.shiftId)!.push(assignment);
  }
  const helperShifts = data.assignments
    .filter(assignment => assignment.helperId === helperId)
    .map(assignment => shiftById.get(assignment.shiftId))
    .filter((shift): shift is Shift => Boolean(shift))
    .sort(sortShifts);

  return collectPdf(doc => {
    drawDocumentHeader(
      doc,
      data.settings,
      `${data.settings.helperPdfTitle} – ${helper.name}`,
      undefined,
      data.logoBuffer
    );
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(colors.ink)
      .text("Chronologische Aufgabenübersicht");
    doc.moveDown(0.8);

    if (helperShifts.length === 0) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor(colors.muted)
        .text("Keine Aufgaben in der Helfereinteilung gefunden.");
      doc.moveDown(2);
    } else {
      const columns: PdfColumn[] = [
        { key: "number", label: "Nr.", width: 30, align: "center" },
        { key: "task", label: "Aufgabe", width: 175 },
        { key: "time", label: "Zeit", width: 88 },
        { key: "team", label: "Mithelfer", width: contentWidth - 293 },
      ];
      let number = 1;
      for (const day of DAYS) {
        const dayShifts = helperShifts.filter(shift => shift.day === day);
        if (dayShifts.length === 0) continue;
        ensureSpace(doc, 72);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(colors.ink).text(day);
        doc.moveDown(0.45);
        drawTableHeader(doc, columns, margin);
        for (const shift of dayShifts) {
          const team = (assignmentsByShift.get(shift.id) ?? [])
            .filter(assignment => assignment.helperId !== helperId)
            .map(assignment => helperById.get(assignment.helperId)?.name)
            .filter((name): name is string => Boolean(name))
            .join(", ");
          drawTableRow(
            doc,
            columns,
            {
              number: String(number++),
              task:
                shift.area && shift.area !== "Allgemein"
                  ? `${shift.task}\n${shift.area}${shift.note?.trim() ? `\nBemerkung: ${shift.note.trim()}` : ""}`
                  : `${shift.task}${shift.note?.trim() ? `\nBemerkung: ${shift.note.trim()}` : ""}`,
              time: formatTime(shift),
              team: team || "–",
            },
            margin
          );
        }
        doc.moveDown(1);
      }
    }

    ensureSpace(doc, 135);
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(colors.ink)
      .text("Zusammenfassung");
    doc.moveDown(0.45);
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(colors.ink)
      .text(
        `${helper.name} ist insgesamt an ${helperShifts.length} ${helperShifts.length === 1 ? "Aufgabe" : "Aufgaben"} über den Veranstaltungszeitraum eingeteilt.`
      );
    doc.moveDown(0.55);
    for (const day of DAYS) {
      const dayShifts = helperShifts.filter(shift => shift.day === day);
      if (dayShifts.length === 0) continue;
      doc.font("Helvetica-Bold").text(`${day}: `, { continued: true });
      doc
        .font("Helvetica")
        .text(
          `${dayShifts.length} ${dayShifts.length === 1 ? "Aufgabe" : "Aufgaben"} (${dayShifts.map(shift => shift.task).join(", ")})`
        );
      doc.moveDown(0.25);
    }
    if (helper.note) {
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Bold")
        .text("Verfügbarkeit / Bemerkungen: ", { continued: true });
      doc.font("Helvetica").text(helper.note);
    }
    doc.moveDown(0.4);
    doc
      .font("Helvetica-Bold")
      .text(`${data.settings.contactLabel}: `, { continued: true });
    doc.font("Helvetica").text(contact?.name ?? "nicht zugeordnet");
    doc.font("Helvetica-Bold").text("Rufnummer: ", { continued: true });
    doc.font("Helvetica").text(contact?.phone?.trim() || "nicht hinterlegt");
    if (data.settings.footerText) {
      doc.moveDown(0.8);
      doc
        .font("Helvetica-Oblique")
        .fontSize(8.5)
        .fillColor(colors.muted)
        .text(data.settings.footerText);
    }
  });
}

export type PlanPdfOptions = {
  mode: "blank" | "filled";
  days?: Day[];
  areas?: string[];
  statuses?: Array<"OFFEN" | "KNAPP" | "OK">;
  contactIds?: number[];
  includeUnassignedContact?: boolean;
};

export function selectPlanEvaluations(
  data: PlanningData,
  options: PlanPdfOptions
) {
  const selectedDays = new Set(options.days ?? []);
  const selectedAreas = new Set(options.areas ?? []);
  const selectedStatuses = new Set(options.statuses ?? []);
  const selectedContacts = new Set(options.contactIds ?? []);
  const hasContactFilter =
    options.contactIds !== undefined ||
    options.includeUnassignedContact !== undefined;
  const areaContactByArea = new Map(
    (data.areaContacts ?? []).map(item => [item.area, item.contactId])
  );
  return evaluateShifts(data.shifts, data.assignments, data.helpers)
    .filter(item => {
      const contactId = areaContactByArea.get(item.shift.area) ?? null;
      const contactMatches =
        contactId === null
          ? options.includeUnassignedContact === true
          : selectedContacts.has(contactId);
      return (
        (!selectedDays.size || selectedDays.has(item.shift.day as Day)) &&
        (!selectedAreas.size || selectedAreas.has(item.shift.area)) &&
        (!selectedStatuses.size || selectedStatuses.has(item.status)) &&
        (!hasContactFilter || contactMatches)
      );
    })
    .sort((left, right) => sortShifts(left.shift, right.shift));
}

export function renderPlanPdf(
  data: PlanningData,
  options: PlanPdfOptions = { mode: "blank" }
) {
  const extraColumns =
    options.mode === "blank" ? parseExtraColumns(data.settings) : [];
  const contactById = new Map(
    data.contacts.map(contact => [contact.id, contact])
  );
  const areaContactByArea = new Map(
    (data.areaContacts ?? []).map(item => [item.area, item.contactId])
  );
  const helperById = new Map(data.helpers.map(helper => [helper.id, helper]));
  const assignmentsByShift = new Map<number, Assignment[]>();
  for (const assignment of data.assignments) {
    if (!assignmentsByShift.has(assignment.shiftId))
      assignmentsByShift.set(assignment.shiftId, []);
    assignmentsByShift.get(assignment.shiftId)!.push(assignment);
  }
  const evaluations = selectPlanEvaluations(data, options);

  return collectPdf(doc => {
    const landscapeWidth = doc.page.width - margin * 2;
    drawDocumentHeader(
      doc,
      data.settings,
      options.mode === "blank"
        ? data.settings.blankPlanTitle
        : `${data.settings.eventName} – ausgefüllter Einsatzplan`,
      `Stand: ${formatDate()} · ${options.mode === "blank" ? "frei ausfüllbare Planung" : "aktuelle Helfereinteilung"}`,
      data.logoBuffer
    );
    const fixedColumns: PdfColumn[] = [
      { key: "day", label: "Tag", width: 48 },
      { key: "area", label: "Bereich", width: 76 },
      { key: "task", label: "Aufgabe", width: 104 },
      { key: "time", label: "Zeit", width: 62 },
      { key: "status", label: "Status", width: 48 },
      { key: "contact", label: data.settings.contactLabel, width: 82 },
      { key: "note", label: "Bemerkung", width: 102 },
      { key: "helper", label: "Helfer / Name", width: 104 },
    ];
    const fixedWidth = fixedColumns.reduce(
      (sum, column) => sum + column.width,
      0
    );
    const availableExtraWidth = Math.max(0, landscapeWidth - fixedWidth);
    const columns = [
      ...fixedColumns,
      ...extraColumns.map((label, index) => ({
        key: `extra-${index}`,
        label,
        width: availableExtraWidth / extraColumns.length,
      })),
    ];
    if (extraColumns.length === 0)
      columns[columns.length - 1].width += availableExtraWidth;

    drawTableHeader(doc, columns, margin);
    if (evaluations.length === 0) {
      for (
        let index = 0;
        index < Math.max(8, data.settings.blankRowsPerShift);
        index++
      ) {
        drawTableRow(doc, columns, {}, margin, { minimumHeight: 31 });
      }
    } else {
      for (const evaluation of evaluations) {
        const shift = evaluation.shift;
        const areaContactId = areaContactByArea.get(shift.area) ?? null;
        const areaContact = areaContactId
          ? contactById.get(areaContactId)
          : undefined;
        const shiftAssignments = (assignmentsByShift.get(shift.id) ?? []).sort(
          (left, right) => left.slot - right.slot
        );
        const assignmentBySlot = new Map(
          shiftAssignments.map(assignment => [assignment.slot, assignment])
        );
        const rowCount = Math.max(
          1,
          shift.needed,
          options.mode === "blank" ? data.settings.blankRowsPerShift : 0
        );
        for (let row = 0; row < rowCount; row++) {
          const assignment = assignmentBySlot.get(row);
          const helper = assignment
            ? helperById.get(assignment.helperId)
            : undefined;
          const extraValues = Object.fromEntries(
            extraColumns.map((_, index) => [`extra-${index}`, ""])
          );
          drawTableRow(
            doc,
            columns,
            {
              day: row === 0 ? shift.day : "",
              area: row === 0 ? shift.area : "",
              task: row === 0 ? shift.task : "",
              time: row === 0 ? formatTime(shift) : "",
              status: row === 0 ? evaluation.status : "",
              contact:
                row === 0 ? (areaContact?.name ?? "nicht zugeordnet") : "",
              note: row === 0 ? (shift.note?.trim() ?? "") : "",
              helper:
                options.mode === "filled"
                  ? (helper?.name ?? (row < shift.needed ? "offen" : ""))
                  : "",
              ...extraValues,
            },
            margin,
            { minimumHeight: 28 }
          );
        }
      }
    }
    if (data.settings.footerText) {
      doc.moveDown(0.6);
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(colors.muted)
        .text(data.settings.footerText);
    }
  }, "landscape");
}

export function renderBlankPlanPdf(data: PlanningData) {
  return renderPlanPdf(data, { mode: "blank" });
}

async function loadPlanningData(): Promise<PlanningData> {
  const [
    helpers,
    contacts,
    shifts,
    assignments,
    areaContacts,
    settings,
    selectedEvent,
  ] = await Promise.all([
    db.listHelpers(),
    db.listContacts(),
    db.listShifts(),
    db.listAssignments(),
    db.listShiftAreaContacts(),
    db.getAppSettings(),
    db.getEvent(),
  ]);
  const resolvedSettings = {
    ...(settings ?? DEFAULT_PDF_SETTINGS),
    eventName: selectedEvent?.name ?? settings?.eventName ?? "Veranstaltung",
    eventYear: String(currentEventYear()),
    logoKey: selectedEvent?.pdfLogoKey ?? null,
    logoUrl: selectedEvent?.pdfLogoUrl ?? null,
  };
  let logoBuffer: Buffer | undefined;
  const logoStorageKey = selectedEvent
    ? resolveEventPdfLogoKey(selectedEvent)
    : null;
  if (logoStorageKey) {
    try {
      const signedUrl = await storageGetSignedUrl(logoStorageKey);
      const response = await fetch(signedUrl);
      if (response.ok) logoBuffer = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.warn("[PDF] Logo konnte nicht geladen werden:", error);
    }
  }
  return {
    helpers,
    contacts,
    shifts,
    assignments,
    areaContacts,
    settings: resolvedSettings,
    logoBuffer,
  };
}

export async function createHelperTaskPdf(helperId: number) {
  return renderHelperTaskPdf(await loadPlanningData(), helperId);
}

export async function createBlankPlanPdf() {
  return renderBlankPlanPdf(await loadPlanningData());
}

export async function createPlanPdf(options: PlanPdfOptions) {
  return renderPlanPdf(await loadPlanningData(), options);
}

/** Beschränkt Helfer-PDFs bei Bedarf auf einen einzelnen Ansprechpartner. */
export function selectHelpersForContact(
  helpers: Helper[],
  contactId?: number
) {
  return contactId === undefined
    ? helpers
    : helpers.filter(helper => helper.contactId === contactId);
}

export function renderAllHelperTaskZip(
  data: PlanningData,
  contactId?: number
) {
  return new Promise<Buffer>((resolve, reject) => {
    const output: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("data", (chunk: Buffer | Uint8Array) =>
      output.push(Buffer.from(chunk))
    );
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(output)));

    void (async () => {
      const selectedHelpers = selectHelpersForContact(data.helpers, contactId);
      if (selectedHelpers.length === 0) {
        archive.append(
          contactId === undefined
            ? "Es sind noch keine Helfer angelegt. Nach dem Anlegen oder Excel-Import enthält dieses Archiv je Helfer eine PDF-Datei.\n"
            : "Für diesen Ansprechpartner sind noch keine Helfer zugeordnet.\n",
          { name: "HINWEIS.txt" }
        );
      }
      for (const helper of selectedHelpers) {
        const contact = data.contacts.find(
          item => item.id === helper.contactId
        );
        const folder = safeFilename(contact?.name ?? "Ohne_Ansprechpartner");
        const filename = `Aufgaben_${safeFilename(helper.name)}.pdf`;
        const pdf = await renderHelperTaskPdf(data, helper.id);
        archive.append(pdf, { name: `${folder}/${filename}` });
      }
      await archive.finalize();
    })().catch(reject);
  });
}

export async function createAllHelperTaskZip(contactId?: number) {
  return renderAllHelperTaskZip(await loadPlanningData(), contactId);
}
