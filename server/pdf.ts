import type { Archiver } from "archiver";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { materialStatusText } from "../shared/material-status";
import type {
  AppSettings,
  Assignment,
  Cake,
  Contact,
  Helper,
  Location,
  Material,
  PostTask,
  PrepTask,
  Shift,
  ShiftAreaContact,
} from "../drizzle/schema";
import * as db from "./db";
import { DAYS, evaluateShifts, toMinutes, type Day } from "./logic";
import { currentEventYear } from "./year-context";
import { storageGetSignedUrl } from "./storage";
import { resolveEventPdfLogoKey } from "./event-pdf-image";
import { helperAvailabilityWindow } from "../shared/weekdays";
import { latestPreparationLogbookEntry } from "../shared/preparation-logbook";

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
  whatsAppMessageTemplate: null,
  logoKey: null,
  logoUrl: null,
  extraColumns: "[]",
  blankRowsPerShift: 0,
  updatedAt: new Date(0),
} satisfies AppSettings;

type PlanningData = {
  helpers: Helper[];
  contacts: Contact[];
  cakes?: Cake[];
  shifts: Shift[];
  assignments: Assignment[];
  areaContacts?: ShiftAreaContact[];
  materials?: Material[];
  locations?: Location[];
  prepTasks?: PrepTask[];
  postTasks?: PostTask[];
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

/**
 * Das feste Breitenbudget hält die vollständige Materialtabelle innerhalb
 * der A4-Hochformatseite. Die Summe muss immer genau contentWidth ergeben.
 */
export const MATERIAL_PACKLIST_PORTRAIT_COLUMNS = [
  { key: "article", label: "Artikel", width: 120 },
  { key: "category", label: "Kategorie", width: 78 },
  { key: "quantity", label: "Menge", width: 55, align: "center" },
  { key: "location", label: "Ort", width: 65 },
  { key: "status", label: "Stand", width: 55, align: "center" },
  { key: "contact", label: "Ansprechpartner", width: 138.28 },
] as const satisfies readonly PdfColumn[];

export const MATERIAL_PACKLIST_PORTRAIT_WIDTH =
  MATERIAL_PACKLIST_PORTRAIT_COLUMNS.reduce(
    (sum, column) => sum + column.width,
    0
  );
const colors = {
  ink: "#172033",
  muted: "#5f6877",
  line: "#d9dee7",
  header: "#eef3f8",
  accent: "#155e75",
};

/** Einheitliche, neutrale Infoboxen ausschließlich für persönliche Helfer-PDFs. */
export const helperPdfPastels = {
  timeBackground: "#F9FAFB",
  timeBorder: "#E5E7EB",
  timeText: "#1F2937",
  shiftNoteBackground: "#F9FAFB",
  shiftNoteText: "#1F2937",
  helperNoteBackground: "#F9FAFB",
  helperNoteText: "#1F2937",
} as const;

const helperPdfDesign = {
  ink: "#1F2937",
  muted: "#4B5563",
  accent: "#1E3A8A",
  line: "#E5E7EB",
  box: "#F9FAFB",
} as const;

const helperPdfMargin = 36;
const helperPdfContentWidth = pageWidth - helperPdfMargin * 2;
const helperPdfBottom = pageHeight - 48;

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

/** Persönliche Helferübersichten bezeichnen zeitlose Schichten eindeutig als Ganztags-Einsatz. */
export function helperPdfTimeLabel(
  shift: Pick<Shift, "startTime" | "endTime">
) {
  return shift.startTime && shift.endTime
    ? `${shift.startTime}–${shift.endTime}`
    : "Ganztags";
}

/** Zweizeilige Zeitkennzeichnung für PDF-Einsatzpläne mit flexibler Belegung. */
export function planPdfTimeLabel(shift: Shift) {
  const time = formatTime(shift);
  return shift.allowFlexibleAssignment ? `${time}\n(flexibel)` : time;
}

/** Kompakte Kennzeichnung für persönliche Helfer-PDFs bei begrenzter Tagesverfügbarkeit. */
export function helperTimeBadgeLabel(helper: Helper, day: Day) {
  const window = helperAvailabilityWindow(helper, day);
  return window ? `Zeitfenster: ${window.start}–${window.end} Uhr` : null;
}

/** Erklärt ausschließlich bei hinterlegter Zeiteinschränkung den Ursprung des Tageszeitfensters. */
export function helperAvailabilityHeadingLabel(helper: Helper, day: Day) {
  const timeWindow = helperTimeBadgeLabel(helper, day);
  return timeWindow
    ? `${timeWindow.replace("Zeitfenster: ", "")} (Vom Helfer mitgeteilter Verfügbarkeitszeitraum)`
    : null;
}

/**
 * Die persönliche Aufgabenübersicht führt Aufgabe, optionalen Bereich und
 * Bemerkung in einer Tabellenzelle. Vor einer Bemerkung bleibt bewusst eine
 * freie Textzeile: Sie schafft einen klaren Abstand, ohne selbst als Inhalt
 * oder spätere Hervorhebung der Bemerkung gerendert zu werden.
 */
export function helperTaskCellText(
  shift: Pick<Shift, "task" | "area" | "note">
) {
  const { primaryText, noteText } = helperTaskCellParts(shift);
  return noteText ? `${primaryText}\n\n${noteText}` : primaryText;
}

/** Trennt den neutralen Aufgabeninhalt von einer bedingt markierten Bemerkung. */
export function helperTaskCellParts(
  shift: Pick<Shift, "task" | "area" | "note">
) {
  const lines = [shift.task];
  if (shift.area && shift.area !== "Allgemein") lines.push(shift.area);
  const note = shift.note?.trim();
  return {
    primaryText: lines.join("\n"),
    noteText: note ? `Bemerkung: ${note}` : null,
  };
}

function helperCakeDonorKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

/** Wählt die per Namen zugeordneten Verpflegungsspenden für die persönliche Helferübersicht. */
export function selectHelperCakes(
  cakes: Cake[] | undefined,
  helperName: string
) {
  const helperKey = helperCakeDonorKey(helperName);
  return (cakes ?? [])
    .filter(cake => helperCakeDonorKey(cake.donor) === helperKey)
    .sort(
      (left, right) =>
        (left.dropoffDate || "9999-12-31").localeCompare(
          right.dropoffDate || "9999-12-31"
        ) ||
        (left.dropoffTime || "99:99").localeCompare(
          right.dropoffTime || "99:99"
        ) ||
        left.sortOrder - right.sortOrder ||
        left.id - right.id
    );
}

function cakeWeekdayLabel(date: string) {
  const value = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
  }).format(new Date(`${date}T12:00:00`));
  return value.endsWith(".") ? value : `${value}.`;
}

/** Formatiert eine Spende samt optionaler Abgabezeit und Standort kompakt für die PDF-Zusammenfassung. */
export function helperCakeSummaryLine(
  cake: Cake,
  locationById: Map<number, Location>
) {
  const details: string[] = [];
  if (cake.dropoffDate) {
    const dateLabel = cakeWeekdayLabel(cake.dropoffDate);
    details.push(
      cake.dropoffTime ? `${dateLabel}, ${cake.dropoffTime} Uhr` : dateLabel
    );
  } else if (cake.dropoffTime) {
    details.push(`${cake.dropoffTime} Uhr`);
  } else if (cake.legacyDropoffText.trim()) {
    details.push(cake.legacyDropoffText.trim());
  }
  const location = cake.locationId
    ? locationById.get(cake.locationId)?.name.trim()
    : "";
  if (location) details.push(location);

  const donationName = cake.cake.trim() || "Spende";
  return details.length
    ? `${donationName} (${details.join(" – ")})`
    : donationName;
}

function ensureHelperPdfSpace(doc: PDFKit.PDFDocument, required: number) {
  if (doc.y + required <= helperPdfBottom) return;
  doc.addPage();
  doc.x = helperPdfMargin;
  doc.y = helperPdfMargin;
}

function drawCompactHelperHeader(
  doc: PDFKit.PDFDocument,
  settings: AppSettings,
  helperName: string,
  logoBuffer?: Buffer
) {
  const top = helperPdfMargin;
  const logoSize = 42;
  const textWidth = logoBuffer
    ? helperPdfContentWidth - logoSize - 14
    : helperPdfContentWidth;
  doc.x = helperPdfMargin;
  doc.y = top;
  if (logoBuffer) {
    try {
      doc.image(
        logoBuffer,
        doc.page.width - helperPdfMargin - logoSize,
        top,
        { fit: [logoSize, logoSize] }
      );
    } catch {
      // Ein beschädigtes Logo darf den operativen PDF-Export nicht blockieren.
    }
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor(helperPdfDesign.ink)
    .text(`${settings.helperPdfTitle} – ${helperName}`, {
      width: textWidth,
      lineBreak: false,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(helperPdfDesign.accent)
    .text(`${settings.eventName} ${settings.eventYear}`.trim(), {
      width: textWidth,
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(helperPdfDesign.muted)
    .text(`Stand: ${formatDate()} · Persönliche Helferübersicht`, {
      width: textWidth,
      lineBreak: false,
    });
  const lineY = Math.max(doc.y + 6, top + (logoBuffer ? logoSize + 7 : 50));
  doc
    .moveTo(helperPdfMargin, lineY)
    .lineTo(doc.page.width - helperPdfMargin, lineY)
    .strokeColor(helperPdfDesign.line)
    .lineWidth(0.7)
    .stroke();
  doc.x = helperPdfMargin;
  doc.y = lineY + 10;
}

function drawCompactHelperDayHeading(
  doc: PDFKit.PDFDocument,
  helper: Helper,
  day: Day
) {
  ensureHelperPdfSpace(doc, 24);
  const y = doc.y;
  const availabilityHeading = helperAvailabilityHeadingLabel(helper, day);
  doc
    .moveTo(helperPdfMargin, y + 14)
    .lineTo(doc.page.width - helperPdfMargin, y + 14)
    .strokeColor(helperPdfDesign.line)
    .lineWidth(0.6)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(helperPdfDesign.accent)
    .text(day, helperPdfMargin, y, { continued: Boolean(availabilityHeading) });
  if (availabilityHeading) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(helperPdfDesign.muted)
      .text(`  ${availabilityHeading}`);
  }
  doc.x = helperPdfMargin;
  doc.y = y + 21;
}

function compactShiftInfo(
  shift: Shift,
  team: string
) {
  const area = shift.area?.trim();
  const task = shift.task.trim() || "Aufgabe";
  const taskLine = area && area !== "Allgemein" ? `${task} · ${area}` : task;
  const infoLines = [`Mithelfer: ${team || "–"}`];
  if (shift.note?.trim())
    infoLines.push(`Schicht-Bemerkung: ${shift.note.trim()}`);
  return { taskLine, infoText: infoLines.join("\n") };
}

function compactShiftBlockHeight(
  doc: PDFKit.PDFDocument,
  shift: Shift,
  team: string
) {
  const { taskLine, infoText } = compactShiftInfo(shift, team);
  const timeWidth = 76;
  const bodyX = helperPdfMargin + timeWidth + 12;
  const bodyWidth = helperPdfContentWidth - timeWidth - 12;
  const taskHeight = doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .heightOfString(taskLine, { width: bodyWidth, lineGap: 0.5 });
  const timeHeight = doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .heightOfString(helperPdfTimeLabel(shift), {
      width: timeWidth,
      lineGap: 0.5,
    });
  const bodyHeight = Math.max(taskHeight, timeHeight, 11);
  const infoHeight = doc
    .font("Helvetica")
    .fontSize(8)
    .heightOfString(infoText, { width: bodyWidth - 16, lineGap: 1 });
  void bodyX;
  return 5 + bodyHeight + 6 + infoHeight + 12;
}

function drawCompactHelperShiftBlock(
  doc: PDFKit.PDFDocument,
  shift: Shift,
  team: string
) {
  const height = compactShiftBlockHeight(doc, shift, team);
  ensureHelperPdfSpace(doc, height + 4);
  const y = doc.y;
  const timeWidth = 76;
  const bodyX = helperPdfMargin + timeWidth + 12;
  const bodyWidth = helperPdfContentWidth - timeWidth - 12;
  const { taskLine, infoText } = compactShiftInfo(shift, team);
  const taskHeight = doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .heightOfString(taskLine, { width: bodyWidth, lineGap: 0.5 });
  const timeHeight = doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .heightOfString(helperPdfTimeLabel(shift), {
      width: timeWidth,
      lineGap: 0.5,
    });
  const bodyHeight = Math.max(taskHeight, timeHeight, 11);
  const infoY = y + 5 + bodyHeight + 5;
  const infoHeight = doc
    .font("Helvetica")
    .fontSize(8)
    .heightOfString(infoText, { width: bodyWidth - 16, lineGap: 1 });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(helperPdfDesign.ink)
    .text(helperPdfTimeLabel(shift), helperPdfMargin, y + 5, {
      width: timeWidth,
      lineGap: 0.5,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(helperPdfDesign.ink)
    .text(taskLine, bodyX, y + 5, { width: bodyWidth, lineGap: 0.5 });
  doc
    .roundedRect(bodyX, infoY, bodyWidth, infoHeight + 9, 3)
    .fillAndStroke(helperPdfDesign.box, helperPdfDesign.line);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(helperPdfDesign.muted)
    .text(infoText, bodyX + 8, infoY + 4, {
      width: bodyWidth - 16,
      lineGap: 1,
    });
  doc.x = helperPdfMargin;
  doc.y = y + height + 4;
}

type HelperSummaryEntry = { label: string; value: string };

/** Baut die feste Reihenfolge der kompakten persönlichen PDF-Zusammenfassung. */
export function buildHelperSummaryEntries(input: {
  taskCount: number;
  daySummary: string;
  helperNote?: string | null;
  cakeLines?: string[];
  contactLabel: string;
  contactName?: string | null;
  contactPhone?: string | null;
  footerText?: string | null;
}): HelperSummaryEntry[] {
  const entries: HelperSummaryEntry[] = [
    {
      label: "Einteilung",
      value: `${input.taskCount} ${input.taskCount === 1 ? "Aufgabe" : "Aufgaben"}${input.daySummary ? ` · ${input.daySummary}` : ""}`,
    },
  ];
  if (input.helperNote?.trim())
    entries.push({
      label: "Verfügbarkeit / Bemerkungen",
      value: input.helperNote.trim(),
    });
  const cakeLines = input.cakeLines ?? [];
  if (cakeLines.length > 0)
    entries.push({
      label: cakeLines.length === 1 ? "Spende" : "Spenden",
      value: cakeLines.join(" · "),
    });
  entries.push(
    {
      label: input.contactLabel,
      value: input.contactName?.trim() || "nicht zugeordnet",
    },
    {
      label: "Rufnummer",
      value: input.contactPhone?.trim() || "nicht hinterlegt",
    }
  );
  if (input.footerText?.trim())
    entries.push({ label: "Hinweis", value: input.footerText.trim() });
  return entries;
}

function compactSummaryHeight(
  doc: PDFKit.PDFDocument,
  entries: HelperSummaryEntry[]
) {
  const labelWidth = 132;
  const valueWidth = helperPdfContentWidth - labelWidth - 28;
  const rows = entries.map(entry => {
    const valueHeight = doc
      .font("Helvetica")
      .fontSize(8.2)
      .heightOfString(entry.value, { width: valueWidth, lineGap: 1 });
    return Math.max(12, valueHeight) + 5;
  });
  return 20 + 13 + rows.reduce((sum, height) => sum + height, 0) + 8;
}

function drawCompactHelperSummary(
  doc: PDFKit.PDFDocument,
  entries: HelperSummaryEntry[]
) {
  const height = compactSummaryHeight(doc, entries);
  ensureHelperPdfSpace(doc, height);
  const y = doc.y;
  const labelWidth = 132;
  const contentX = helperPdfMargin + 10;
  const valueX = contentX + labelWidth;
  const valueWidth = helperPdfContentWidth - labelWidth - 28;
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(helperPdfDesign.accent)
    .text("Zusammenfassung", helperPdfMargin, y);
  const boxY = y + 15;
  const boxHeight = height - 20;
  doc
    .roundedRect(helperPdfMargin, boxY, helperPdfContentWidth, boxHeight, 4)
    .fillAndStroke(helperPdfDesign.box, helperPdfDesign.line);
  let rowY = boxY + 7;
  for (const entry of entries) {
    const valueHeight = doc
      .font("Helvetica")
      .fontSize(8.2)
      .heightOfString(entry.value, { width: valueWidth, lineGap: 1 });
    const rowHeight = Math.max(12, valueHeight) + 5;
    doc
      .font("Helvetica-Bold")
      .fontSize(8.2)
      .fillColor(helperPdfDesign.ink)
      .text(`${entry.label}:`, contentX, rowY, {
        width: labelWidth - 8,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(8.2)
      .fillColor(helperPdfDesign.ink)
      .text(entry.value, valueX, rowY, { width: valueWidth, lineGap: 1 });
    rowY += rowHeight;
  }
  doc.x = helperPdfMargin;
  doc.y = y + height;
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
  options: {
    minimumHeight?: number;
    highlightedTaskNote?: string | null;
  } = {}
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
    const columnValue = values[column.key] ?? "";
    const isHighlightedTaskNote =
      column.key === "task" && Boolean(options.highlightedTaskNote);
    const highlightedTaskNote = isHighlightedTaskNote
      ? options.highlightedTaskNote!
      : null;
    const primaryTaskText = isHighlightedTaskNote
      ? columnValue
          .slice(0, Math.max(0, columnValue.lastIndexOf(highlightedTaskNote!)))
          .replace(/\n+$/, "")
      : columnValue;
    doc
      .fillColor(colors.ink)
      .text(primaryTaskText, cursor + 5, y + 6, {
        width: column.width - 10,
        height: height - 10,
        align: column.align ?? "left",
        lineGap: 1,
      });
    if (highlightedTaskNote) {
      const noteY = y + 6 + doc.heightOfString(primaryTaskText, {
        width: column.width - 10,
        lineGap: 1,
      }) + 4;
      const noteHeight = doc.heightOfString(highlightedTaskNote, {
        width: column.width - 14,
        lineGap: 1,
      });
      doc
        .roundedRect(cursor + 4, noteY - 1, column.width - 8, noteHeight + 4, 2)
        .fill(helperPdfPastels.shiftNoteBackground);
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(helperPdfPastels.shiftNoteText)
        .text(highlightedTaskNote, cursor + 5, noteY + 1, {
          width: column.width - 10,
          height: height - (noteY - y) - 5,
          lineGap: 1,
        });
    }
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
  const helperCakes = selectHelperCakes(data.cakes, helper.name);
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );
  const helperCakeLines = helperCakes.map(cake =>
    helperCakeSummaryLine(cake, locationById)
  );

  return collectPdf(doc => {
    drawCompactHelperHeader(doc, data.settings, helper.name, data.logoBuffer);

    if (helperShifts.length === 0) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor(helperPdfDesign.muted)
        .text("Keine Aufgaben in der Helfereinteilung gefunden.");
      doc.moveDown(1);
    } else {
      for (const day of DAYS) {
        const dayShifts = helperShifts.filter(shift => shift.day === day);
        if (dayShifts.length === 0) continue;
        drawCompactHelperDayHeading(doc, helper, day);
        for (const shift of dayShifts) {
          const team = (assignmentsByShift.get(shift.id) ?? [])
            .filter(assignment => assignment.helperId !== helperId)
            .map(assignment => helperById.get(assignment.helperId)?.name)
            .filter((name): name is string => Boolean(name))
            .join(", ");
          drawCompactHelperShiftBlock(doc, shift, team);
        }
      }
    }

    const daySummary = DAYS.map(day => {
      const dayShifts = helperShifts.filter(shift => shift.day === day);
      if (dayShifts.length === 0) return null;
      return `${day}: ${dayShifts.map(shift => shift.task).join(", ")}`;
    })
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    const summaryEntries = buildHelperSummaryEntries({
      taskCount: helperShifts.length,
      daySummary,
      helperNote: helper.note,
      cakeLines: helperCakeLines,
      contactLabel: data.settings.contactLabel,
      contactName: contact?.name,
      contactPhone: contact?.phone,
      footerText: data.settings.footerText,
    });
    const summaryHeight = compactSummaryHeight(doc, summaryEntries);
    const bottomAnchoredSummaryY = helperPdfBottom - summaryHeight - 10;
    doc.y = Math.max(doc.y + 6, bottomAnchoredSummaryY);
    drawCompactHelperSummary(doc, summaryEntries);
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
              time: row === 0 ? planPdfTimeLabel(shift) : "",
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

/** Wählt ausschließlich die in der aktuellen Tabellenansicht sichtbaren Artikel aus. */
export function selectMaterialPacklistMaterials(
  materials: Material[] | undefined,
  materialIds: number[]
) {
  const selectedIds = new Set(materialIds);
  return (materials ?? [])
    .filter(material => selectedIds.has(material.id))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category, "de") ||
        left.article.localeCompare(right.article, "de") ||
        left.sortOrder - right.sortOrder
    );
}

/** Erstellt eine operative Packliste für die aktuell sichtbare Materialauswahl. */
export function renderMaterialPacklistPdf(
  data: PlanningData,
  materialIds: number[]
) {
  const contactById = new Map(data.contacts.map(contact => [contact.id, contact]));
  const locationById = new Map((data.locations ?? []).map(location => [location.id, location]));
  const selectedMaterials = selectMaterialPacklistMaterials(
    data.materials,
    materialIds
  );

  return collectPdf(doc => {
    drawDocumentHeader(
      doc,
      data.settings,
      "Material-Packliste – Gefilterte Ansicht",
      `Aktuelle Tabellenansicht · Stand: ${formatDate()}`,
      data.logoBuffer
    );
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(colors.muted)
      .text(
        "Diese Liste enthält genau die aktuell gefilterten Materialartikel. Vor Ort bitte Menge, Zustand und Vollständigkeit prüfen."
      );
    doc.moveDown(1);

    const columns: PdfColumn[] = MATERIAL_PACKLIST_PORTRAIT_COLUMNS.map(
      column =>
        column.key === "contact"
          ? { ...column, label: data.settings.contactLabel }
          : { ...column }
    );
    drawTableHeader(doc, columns, margin);
    if (selectedMaterials.length === 0) {
      drawTableRow(
        doc,
        columns,
        { article: "Für die aktuelle Filterauswahl sind keine Artikel sichtbar." },
        margin,
        { minimumHeight: 34 }
      );
    } else {
      for (const material of selectedMaterials) {
        const quantity = [material.quantity, material.unit]
          .filter(Boolean)
          .join(" ");
        drawTableRow(
          doc,
          columns,
          {
            article: material.note?.trim()
              ? `${material.article}\nNotiz: ${material.note.trim()}`
              : material.article,
            category: material.category || "–",
            quantity: quantity || "–",
            location: material.locationId
              ? (locationById.get(material.locationId)?.name ?? "–")
              : "–",
            status: materialStatusText(material.status),
            contact: material.contactId
              ? (contactById.get(material.contactId)?.name ?? "–")
              : "–",
          },
          margin
        );
      }
    }
    doc.moveDown(1.2);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(colors.ink)
      .text("Abnahme vor Ort");
    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(colors.ink)
      .text("Geprüft von: ______________________________    Datum / Uhrzeit: ______________________________");
  });
}

type TaskOverviewRow = Pick<
  PostTask,
  | "id"
  | "category"
  | "task"
  | "dueText"
  | "locationId"
  | "contactId"
  | "note"
  | "sortOrder"
> & {
  status: PrepTask["status"];
  statusWording?: PrepTask["statusWording"];
};
type TaskOverviewKind = "prep" | "post";

/** Wählt ausschließlich die Aufgaben aus, die in der gefilterten Tabellenansicht sichtbar sind. */
export function selectTaskOverviewRows(
  tasks: TaskOverviewRow[] | undefined,
  taskIds: number[]
) {
  const selectedIds = new Set(taskIds);
  return (tasks ?? [])
    .filter(task => selectedIds.has(task.id))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category, "de") ||
        left.sortOrder - right.sortOrder ||
        left.id - right.id
    );
}

function taskOverviewStatusLabel(task: TaskOverviewRow, kind: TaskOverviewKind) {
  if (task.status === "offen") return "Offen";
  if (task.status === "inArbeit") {
    return kind === "prep" && task.statusWording === "genehmigung"
      ? "Beantragt"
      : "In Arbeit";
  }
  if (task.status === "erledigt") {
    return kind === "prep" && task.statusWording === "genehmigung"
      ? "Genehmigt"
      : "Erledigt";
  }
  return "Abgelehnt";
}

function renderTaskOverviewPdf(
  data: PlanningData,
  taskIds: number[],
  kind: TaskOverviewKind
) {
  const selectedTasks = selectTaskOverviewRows(
    kind === "prep" ? data.prepTasks : data.postTasks,
    taskIds
  );
  const contactById = new Map(data.contacts.map(contact => [contact.id, contact]));
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );
  const title =
    kind === "prep"
      ? "Vorbereitung – Aufgabenübersicht"
      : "Nachbereitung – Aufgabenübersicht";

  return collectPdf(doc => {
    const landscapeWidth = doc.page.width - margin * 2;
    drawDocumentHeader(
      doc,
      data.settings,
      title,
      `Gefilterte Ansicht · Stand: ${formatDate()}`,
      data.logoBuffer
    );
    const fixedColumns: PdfColumn[] = [
      { key: "category", label: "Bereich", width: 74 },
      { key: "task", label: "Aufgabe", width: 154 },
      { key: "location", label: "Ort", width: 72 },
      { key: "contact", label: data.settings.contactLabel, width: 118 },
      { key: "due", label: "Frist", width: 68 },
      { key: "status", label: "Status", width: 70 },
    ];
    const fixedWidth = fixedColumns.reduce(
      (sum, column) => sum + column.width,
      0
    );
    const columns: PdfColumn[] = [
      ...fixedColumns,
      {
        key: "logbook",
        label: "Aktueller Logbuchstand",
        width: landscapeWidth - fixedWidth,
      },
    ];
    drawTableHeader(doc, columns, margin);

    if (selectedTasks.length === 0) {
      drawTableRow(
        doc,
        columns,
        { task: "Für die aktuelle Filterauswahl sind keine Aufgaben sichtbar." },
        margin,
        { minimumHeight: 34 }
      );
      return;
    }

    for (const task of selectedTasks) {
      drawTableRow(
        doc,
        columns,
        {
          category: task.category || "–",
          task: task.task,
          location: task.locationId
            ? (locationById.get(task.locationId)?.name ?? "–")
            : "–",
          contact: task.contactId
            ? (contactById.get(task.contactId)?.name ?? "–")
            : "–",
          due: task.dueText.trim() || "–",
          status: taskOverviewStatusLabel(task, kind),
          logbook: latestPreparationLogbookEntry(task.note) || "–",
        },
        margin,
        { minimumHeight: 30 }
      );
    }
  }, "landscape");
}

/** Erzeugt die Download-PDF exakt aus der aktuellen Filterauswahl der Vorbereitung. */
export function renderPreparationTaskOverviewPdf(
  data: PlanningData,
  taskIds: number[]
) {
  return renderTaskOverviewPdf(data, taskIds, "prep");
}

/** Erzeugt die Download-PDF exakt aus der aktuellen Filterauswahl der Nachbereitung. */
export function renderPostTaskOverviewPdf(
  data: PlanningData,
  taskIds: number[]
) {
  return renderTaskOverviewPdf(data, taskIds, "post");
}

async function loadPlanningData(): Promise<PlanningData> {
  const [
    helpers,
    contacts,
    cakes,
    shifts,
    assignments,
    areaContacts,
    materials,
    locations,
    prepTasks,
    postTasks,
    settings,
    selectedEvent,
  ] = await Promise.all([
    db.listHelpers(),
    db.listContacts(),
    db.listCakes(),
    db.listShifts(),
    db.listAssignments(),
    db.listShiftAreaContacts(),
    db.listMaterials(),
    db.listLocations(),
    db.listPrep(),
    db.listPost(),
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
    cakes,
    shifts,
    assignments,
    areaContacts,
    materials,
    locations,
    prepTasks,
    postTasks,
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

export async function createMaterialPacklistPdf(materialIds: number[]) {
  return renderMaterialPacklistPdf(await loadPlanningData(), materialIds);
}

export async function createPrepTaskOverviewPdf(taskIds: number[]) {
  return renderPreparationTaskOverviewPdf(await loadPlanningData(), taskIds);
}

export async function createPostTaskOverviewPdf(taskIds: number[]) {
  return renderPostTaskOverviewPdf(await loadPlanningData(), taskIds);
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
