import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type { AuditActor } from "./db";
import {
  buildSelectedDocument,
  createCurrentProjectDocument,
  diffDocuments,
  parseBackupWorkbook,
  previewProjectDocument,
  PROJECT_EXCEL_HEADERS,
  readUploadedExcelWorkbook,
  normalizeImportedTime,
  restoreProjectDocument,
  type BackupArea,
  type BackupChange,
  type BackupDocument,
} from "./excel-backup";

export const MODULE_IMPORT_AREAS = [
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
] as const;
export type ModuleImportArea = (typeof MODULE_IMPORT_AREAS)[number];

const MODULE_COLLECTION: Record<
  ModuleImportArea,
  keyof Pick<
    BackupDocument,
    | "contacts"
    | "helpers"
    | "shifts"
    | "prep"
    | "post"
    | "materials"
    | "marketing"
    | "approvals"
    | "cakes"
    | "finances"
  >
> = {
  ANSPRECHPARTNER: "contacts",
  HELFER: "helpers",
  EINSATZPLAN: "shifts",
  VORBEREITUNG: "prep",
  NACHBEREITUNG: "post",
  MATERIAL: "materials",
  MARKETING: "marketing",
  GENEHMIGUNGEN: "approvals",
  KUCHEN: "cakes",
  FINANZEN: "finances",
};

const areaName: Record<ModuleImportArea, string> = {
  ANSPRECHPARTNER: "Ansprechpartner",
  HELFER: "Helfer",
  EINSATZPLAN: "Einsatzplan",
  VORBEREITUNG: "Vorbereitung",
  NACHBEREITUNG: "Nachbereitung",
  MATERIAL: "Material",
  MARKETING: "Marketing",
  GENEHMIGUNGEN: "Genehmigungen",
  KUCHEN: "Kuchen",
  FINANZEN: "Finanzen",
};

const digest = (base64: string) =>
  createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");

function importedSheet(workbook: XLSX.WorkBook, area: ModuleImportArea) {
  if (workbook.Sheets[area]) return workbook.Sheets[area];
  const visibleNames = workbook.SheetNames.filter(
    name => name !== "SICHERUNG_INFO"
  );
  if (visibleNames.length === 1) return workbook.Sheets[visibleNames[0]];
  throw new Error(
    `Die Excel-Datei enthält kein Blatt „${area}“. Verwenden Sie den Projekt-Export oder eine Datei mit genau einem Datenblatt.`
  );
}

/**
 * Excel übernimmt Überschriften exakt als Objektschlüssel. Ohne diese
 * Kanonisierung würde beispielsweise "Name " zwar die Pflichtspaltenprüfung
 * bestehen, aber später nicht über row.Name gelesen werden können.
 */
export function normalizeModuleImportHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

export function readNormalizedModuleImportRows(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headerRow = (rows[0] ?? []).map(normalizeModuleImportHeader);
  const nonEmptyHeaders = headerRow.filter(Boolean);
  const duplicateHeaders = Array.from(
    new Set(
      nonEmptyHeaders.filter(
        (header, index) => nonEmptyHeaders.indexOf(header) !== index
      )
    )
  );
  if (duplicateHeaders.length)
    throw new Error(
      `Die Excel-Datei enthält mehrdeutige Spaltenüberschriften: ${duplicateHeaders.join(", ")}`
    );

  const importedRows = rows.slice(1).reduce<Record<string, unknown>[]>(
    (result, values) => {
      const row: Record<string, unknown> = {};
      headerRow.forEach((header, index) => {
        if (header) row[header] = values[index] ?? "";
      });
      if (
        Object.values(row).some(value => String(value ?? "").trim() !== "")
      )
        result.push(row);
      return result;
    },
    []
  );
  return { headers: new Set(nonEmptyHeaders), importedRows };
}

function assertHeaders(headers: Set<string>, area: ModuleImportArea) {
  const required: Record<ModuleImportArea, string[]> = {
    ANSPRECHPARTNER: ["Name"],
    HELFER: ["Name"],
    EINSATZPLAN: ["Tag", "Bereich", "Aufgabe", "Bedarf"],
    VORBEREITUNG: ["Aufgabe"],
    NACHBEREITUNG: ["Aufgabe"],
    MATERIAL: ["Artikel"],
    MARKETING: ["Maßnahme"],
    GENEHMIGUNGEN: ["Antrag"],
    KUCHEN: ["Spender"],
    FINANZEN: ["Kategorie"],
  };
  const missing = required[area].filter(header => !headers.has(header));
  if (missing.length)
    throw new Error(
      `${areaName[area]}: Pflichtspalten fehlen: ${missing.join(", ")}`
    );
}

const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");

const MAX_MODULE_ROWS = 10_000;
const MAX_MODULE_COLUMNS = 256;

export function normalizeModuleSheetRange(
  sheet: XLSX.WorkSheet,
  area: ModuleImportArea
) {
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = -1;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = -1;
  for (const reference of Object.keys(sheet)) {
    if (reference.startsWith("!")) continue;
    try {
      const cell = XLSX.utils.decode_cell(reference);
      minRow = Math.min(minRow, cell.r);
      maxRow = Math.max(maxRow, cell.r);
      minColumn = Math.min(minColumn, cell.c);
      maxColumn = Math.max(maxColumn, cell.c);
    } catch {
      continue;
    }
  }
  if (maxRow < 0 || maxColumn < 0) return;
  if (maxRow - minRow > MAX_MODULE_ROWS)
    throw new Error(
      `${areaName[area]} enthält mehr als ${MAX_MODULE_ROWS} Datenzeilen`
    );
  if (maxColumn - minColumn + 1 > MAX_MODULE_COLUMNS)
    throw new Error(
      `${areaName[area]} enthält mehr als ${MAX_MODULE_COLUMNS} Spalten`
    );
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: minRow, c: minColumn },
    e: { r: maxRow, c: maxColumn },
  });
}

function rowIdentity(area: ModuleImportArea, row: Record<string, unknown>) {
  if (area === "ANSPRECHPARTNER" || area === "HELFER")
    return normalized(row.Name);
  if (area === "EINSATZPLAN")
    return normalized(
      `${row.Tag}|${row.Bereich}|${row.Aufgabe}|${row.Beginn}|${row.Ende}`
    );
  if (area === "VORBEREITUNG" || area === "NACHBEREITUNG")
    return normalized(row.Aufgabe);
  if (area === "MATERIAL") return normalized(row.Artikel);
  if (area === "MARKETING") return normalized(row.Maßnahme);
  if (area === "GENEHMIGUNGEN") return normalized(row.Antrag);
  if (area === "KUCHEN")
    return normalized(`${row.Spender}|${row.Kuchen || row.Bemerkung}`);
  return normalized(`${row.Kategorie}|${row.Bemerkung || row.Reihenfolge}`);
}

function hydrateExistingIds(
  area: ModuleImportArea,
  importedRows: Record<string, unknown>[],
  currentRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const currentByIdentity = new Map(
    currentRows.map(row => [rowIdentity(area, row), row.ID])
  );
  return importedRows.map(
    row =>
      ({
        ...row,
        ID: row.ID || currentByIdentity.get(rowIdentity(area, row)) || "",
      }) as Record<string, unknown>
  );
}

const OPTIONAL_MODULE_COLUMNS: Record<ModuleImportArea, string[]> = {
  ANSPRECHPARTNER: ["Rufnummer", "Bemerkung", "Reihenfolge"],
  HELFER: [
    "Ansprechpartner-ID",
    "Ansprechpartner",
    "E-Mail",
    "Telefon",
    "Bemerkung",
    "Zusätzliche Begleitung",
    "Helfen?",
    "Mo",
    "Di",
    "Mi",
    "Do",
    "Fr",
    "Sa",
    "So",
    "Mo von",
    "Mo bis",
    "Di von",
    "Di bis",
    "Mi von",
    "Mi bis",
    "Do von",
    "Do bis",
    "Fr von",
    "Fr bis",
    "Sa von",
    "Sa bis",
    "So von",
    "So bis",
    "Bestätigt?",
  ],
  EINSATZPLAN: [
    "Beginn",
    "Ende",
    "Flexible Belegung",
    "Manuell als OK bestätigt",
    "Bemerkung",
    "Reihenfolge",
    "Bereichsansprechpartner-ID",
    "Bereichsansprechpartner",
    ...Array.from({ length: 20 }, (_, slot) => [
      `Helfer ${slot + 1} ID`,
      `Helfer ${slot + 1}`,
    ]).flat(),
  ],
  VORBEREITUNG: [
    "Kategorie",
    "Zu erledigen bis",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Status-Wortlaut",
    "Bemerkung",
    "Reihenfolge",
  ],
  NACHBEREITUNG: [
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  MATERIAL: [
    "Kategorie",
    "Menge",
    "Einheit",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Bestellt",
    "Bemerkung",
    "Reihenfolge",
  ],
  MARKETING: [
    "Kanal",
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  GENEHMIGUNGEN: [
    "Verantwortlich-ID",
    "Verantwortlich",
    "Status",
    "Bemerkung",
    "Reihenfolge",
  ],
  KUCHEN: ["Kuchen", "Abgabezeit", "Bemerkung", "Reihenfolge"],
  FINANZEN: ["Einnahmen", "Ausgaben", "Bemerkung", "Reihenfolge"],
};

/**
 * Fehlende optionale Spalten bedeuten "nicht ändern". Eine vorhandene, aber
 * leere Zelle bedeutet hingegen bewusstes Leeren. Damit können einfache
 * Einzelblätter genutzt werden, ohne Bestandsdaten unabsichtlich zu löschen.
 */
export function preserveMissingOptionalModuleColumns(
  area: ModuleImportArea,
  importedRows: Record<string, unknown>[],
  currentRows: Record<string, unknown>[],
  sourceHeaders: Set<string>
) {
  const missingColumns = OPTIONAL_MODULE_COLUMNS[area].filter(
    column => !sourceHeaders.has(column)
  );
  if (!missingColumns.length) return 0;

  const currentById = new Map(
    currentRows.map(row => [String(row.ID ?? "").trim(), row])
  );
  const currentByIdentity = new Map(
    currentRows.map(row => [rowIdentity(area, row), row])
  );
  let preserved = 0;
  for (const row of importedRows) {
    const id = String(row.ID ?? "").trim();
    const current =
      (id ? currentById.get(id) : undefined) ??
      currentByIdentity.get(rowIdentity(area, row));
    if (!current) continue;
    for (const column of missingColumns) {
      row[column] = current[column] ?? "";
      preserved++;
    }
  }
  return preserved;
}

export function removeCopiedModuleIds(
  area: ModuleImportArea,
  importedRows: Record<string, unknown>[],
  currentRows: Record<string, unknown>[]
) {
  const rowsById = new Map<string, Record<string, unknown>[]>();
  for (const row of importedRows) {
    const id = String(row.ID ?? "").trim();
    if (!id) continue;
    const rows = rowsById.get(id) ?? [];
    rows.push(row);
    rowsById.set(id, rows);
  }
  const currentById = new Map(
    currentRows.map(row => [String(row.ID ?? "").trim(), row])
  );
  const currentByIdentity = new Map(
    currentRows.map(row => [rowIdentity(area, row), row])
  );
  let corrected = 0;

  // Eine ID darf nur aus dem aktuell gewählten Event/Jahr stammen. Kommt sie
  // nicht im aktuellen Modulbestand vor, ist sie aus einem anderen Scope oder
  // einer alten Datei übernommen und wird vor dem Diff sicher entfernt.
  for (const row of importedRows) {
    const id = String(row.ID ?? "").trim();
    if (!id) continue;
    const current = currentById.get(id);
    if (!current) {
      row.ID = "";
      corrected++;
      continue;
    }

    // Verweist die importierte fachliche Identität eindeutig auf einen anderen
    // Bestandsdatensatz, wurde die technische ID in eine falsche Zeile kopiert.
    // Echte Umbenennungen bleiben möglich: Gibt es keine andere passende
    // Bestandszeile, darf die eindeutige ID der Zeile erhalten bleiben.
    const sameIdentity = currentByIdentity.get(rowIdentity(area, row));
    if (sameIdentity && String(sameIdentity.ID ?? "").trim() !== id) {
      row.ID = "";
      corrected++;
    }
  }

  for (const [id, rows] of Array.from(rowsById.entries())) {
    const current = currentById.get(id);
    if (!current) {
      for (const row of rows) {
        if (!String(row.ID ?? "").trim()) continue;
        row.ID = "";
        corrected++;
      }
      continue;
    }
    if (rows.length < 2) continue;
    let keptExisting = false;
    for (const row of rows) {
      if (String(row.ID ?? "").trim() !== id) continue;
      const isExisting =
        !keptExisting &&
        current !== undefined &&
        rowIdentity(area, row) === rowIdentity(area, current);
      if (isExisting) {
        keptExisting = true;
        continue;
      }
      row.ID = "";
      corrected++;
    }
  }
  return corrected;
}

export function findContactSelfHelperRow(
  contactRow: Record<string, unknown>,
  helperRows: Record<string, unknown>[],
  currentContactRows: Record<string, unknown>[]
) {
  const contactId = String(contactRow.ID ?? "").trim();
  const contactName = String(contactRow.Name ?? "").trim();
  const normalizedContactName = normalized(contactName);

  if (contactId) {
    const linkedById = helperRows.find(
      row =>
        normalized(row.Name) === normalizedContactName &&
        String(row["Ansprechpartner-ID"] ?? "").trim() === contactId
    );
    if (linkedById) return linkedById;
  }

  const linkedByName = helperRows.find(
    row =>
      normalized(row.Name) === normalizedContactName &&
      normalized(row.Ansprechpartner) === normalizedContactName
  );
  if (linkedByName) return linkedByName;

  const exactName = helperRows.find(
    row => normalized(row.Name) === normalizedContactName
  );
  if (exactName || !contactId) return exactName;

  const currentContact = currentContactRows.find(
    row => String(row.ID ?? "").trim() === contactId
  );
  if (!currentContact) return undefined;
  const previousName = normalized(currentContact.Name);
  return helperRows.find(
    row => normalized(row.Name) === previousName
  );
}

/**
 * Ein Ansprechpartner ist immer zugleich als eigener Helfer verzeichnet. Bei
 * einem reinen Helferimport darf dieser Systemeintrag nicht versehentlich als
 * Löschung ausgelegt werden: Er wird aus dem aktuellen Scope ergänzt und
 * behält dabei seine technische ID für einen eindeutigen Update-Diff.
 */
export function preserveRequiredContactSelfHelpers(
  importedHelperRows: Record<string, unknown>[],
  currentContactRows: Record<string, unknown>[],
  currentHelperRows: Record<string, unknown>[]
) {
  let preserved = 0;
  for (const contact of currentContactRows) {
    const contactName = String(contact.Name ?? "").trim();
    if (!contactName) continue;
    const existingSelfHelper = findContactSelfHelperRow(
      contact,
      currentHelperRows,
      currentContactRows
    );
    if (!existingSelfHelper) continue;

    const alreadyImported = importedHelperRows.some(row => {
      const rowId = String(row.ID ?? "").trim();
      const existingId = String(existingSelfHelper.ID ?? "").trim();
      if (existingId && rowId && rowId === existingId) return true;
      return normalized(row.Name) === normalized(contactName);
    });
    if (alreadyImported) continue;

    importedHelperRows.push({ ...existingSelfHelper });
    preserved++;
  }
  return preserved;
}

export function normalizeModuleImportedShiftTimes(
  area: ModuleImportArea,
  importedRows: Record<string, unknown>[]
) {
  if (area !== "EINSATZPLAN") return;
  for (const row of importedRows) {
    row.Beginn = normalizeImportedTime(row.Beginn);
    row.Ende = normalizeImportedTime(row.Ende);
  }
}

function baseWorkbook(document: BackupDocument) {
  const workbook = XLSX.utils.book_new();
  const append = (
    name: string,
    headers: string[],
    rows: Record<string, unknown>[] = []
  ) => {
    const sheet = rows.length
      ? XLSX.utils.json_to_sheet(rows, { header: headers })
      : XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };
  append(
    "SICHERUNG_INFO",
    ["Schlüssel", "Wert"],
    [
      { Schlüssel: "Format", Wert: "RSC-HELFERPLANUNG-SICHERUNG" },
      { Schlüssel: "Version", Wert: 1 },
      { Schlüssel: "Veranstaltungs-ID", Wert: document.metadata.eventId },
      { Schlüssel: "Veranstaltung", Wert: document.metadata.eventName },
      { Schlüssel: "Jahr", Wert: document.metadata.year },
      {
        Schlüssel: "Veranstaltungstage",
        Wert: document.metadata.activeDays.join(", "),
      },
      {
        Schlüssel: "PDF-Bild-Schlüssel",
        Wert: document.metadata.pdfLogoKey ?? "",
      },
      {
        Schlüssel: "PDF-Bild-URL",
        Wert: document.metadata.pdfLogoUrl ?? "",
      },
      {
        Schlüssel: "PDF-Bild-Fallback",
        Wert: document.metadata.pdfLogoFallback,
      },
      { Schlüssel: "Exportiert am (UTC)", Wert: document.metadata.exportedAt },
    ]
  );
  for (const area of MODULE_IMPORT_AREAS)
    append(area, PROJECT_EXCEL_HEADERS[area] ?? []);
  return workbook;
}

function rowsFromDocument(document: BackupDocument, area: ModuleImportArea) {
  if (area === "ANSPRECHPARTNER")
    return document.contacts.map(row => ({
      ID: row.sourceId,
      Name: row.name,
      Rufnummer: row.phone,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  if (area === "HELFER")
    return document.helpers.map(row => ({
      ID: row.sourceId,
      "Ansprechpartner-ID": row.contactSourceId ?? "",
      Ansprechpartner: row.contactName,
      Name: row.name,
      "E-Mail": row.email,
      Telefon: row.phone,
      Bemerkung: row.note,
      "Zusätzliche Begleitung": row.companion ?? "",
      "Helfen?": row.willHelp,
      Mo: row.availMon,
      Di: row.availTue,
      Mi: row.availWed,
      Do: row.availThu,
      Fr: row.availFri,
      Sa: row.availSat,
      So: row.availSun,
      "Mo von": row.availMonStart,
      "Mo bis": row.availMonEnd,
      "Di von": row.availTueStart,
      "Di bis": row.availTueEnd,
      "Mi von": row.availWedStart,
      "Mi bis": row.availWedEnd,
      "Do von": row.availThuStart,
      "Do bis": row.availThuEnd,
      "Fr von": row.availFriStart,
      "Fr bis": row.availFriEnd,
      "Sa von": row.availSatStart,
      "Sa bis": row.availSatEnd,
      "So von": row.availSunStart,
      "So bis": row.availSunEnd,
      "Bestätigt?": row.confirmed,
    }));
  if (area === "EINSATZPLAN")
    return document.shifts.map(row => ({
      ID: row.sourceId,
      Tag: row.day,
      Bereich: row.area,
      Aufgabe: row.task,
      Beginn: row.startTime,
      Ende: row.endTime,
      "Flexible Belegung": row.allowFlexibleAssignment ? "Ja" : "Nein",
      "Manuell als OK bestätigt": row.manualOkConfirmed ? "Ja" : "Nein",
      Bedarf: row.needed,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
      "Bereichsansprechpartner-ID": row.areaContactSourceId ?? "",
      Bereichsansprechpartner: row.areaContactName,
      ...Object.fromEntries(
        Array.from({ length: 20 }, (_, slot) => {
          const assignment = row.slots.find(item => item.slot === slot);
          return [
            [`Helfer ${slot + 1} ID`, assignment?.helperSourceId ?? ""],
            [`Helfer ${slot + 1}`, assignment?.helperName ?? ""],
          ];
        }).flat()
      ),
    }));
  const taskRows = (rows: BackupDocument["prep"] | BackupDocument["post"], isPrep = false) =>
    rows.map(row => ({
      ID: row.sourceId,
      ...(isPrep ? { Kategorie: (row as BackupDocument["prep"][number]).category ?? "" } : {}),
      Aufgabe: row.task,
      ...(isPrep
        ? {
            "Zu erledigen bis": (row as BackupDocument["prep"][number]).dueText,
          }
        : {}),
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      ...(isPrep
        ? {
            "Status-Wortlaut": (row as BackupDocument["prep"][number]).statusWording ?? "aufgabe",
          }
        : {}),
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  if (area === "VORBEREITUNG") return taskRows(document.prep, true);
  if (area === "NACHBEREITUNG") return taskRows(document.post);
  if (area === "MATERIAL")
    return document.materials.map(row => ({
      ID: row.sourceId,
      Artikel: row.article,
      Kategorie: row.category,
      Menge: row.quantity,
      Einheit: row.unit,
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Bestellt: row.ordered,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  if (area === "MARKETING")
    return document.marketing.map(row => ({
      ID: row.sourceId,
      Maßnahme: row.measure,
      Kanal: row.channel,
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  if (area === "GENEHMIGUNGEN")
    return document.approvals.map(row => ({
      ID: row.sourceId,
      Antrag: row.request,
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  if (area === "KUCHEN")
    return document.cakes.map(row => ({
      ID: row.sourceId,
      Spender: row.donor,
      Kuchen: row.cake,
      Abgabezeit: row.dropoffTime,
      Bemerkung: row.note,
      Reihenfolge: row.sortOrder,
    }));
  return document.finances.map(row => ({
    ID: row.sourceId,
    Kategorie: row.category,
    Einnahmen: row.income / 100,
    Ausgaben: row.expense / 100,
    Bemerkung: row.note,
    Reihenfolge: row.sortOrder,
  }));
}

async function buildModuleTarget(base64: string, area: ModuleImportArea) {
  const current = await createCurrentProjectDocument();
  const uploaded = readUploadedExcelWorkbook(base64);
  const source = importedSheet(uploaded, area);
  normalizeModuleSheetRange(source, area);
  const { headers: sourceHeaders, importedRows: rawImportedRows } =
    readNormalizedModuleImportRows(source);
  assertHeaders(sourceHeaders, area);
  const currentRows = rowsFromDocument(current, area);
  normalizeModuleImportedShiftTimes(area, rawImportedRows);
  let preservedRequiredSelfHelpers = 0;
  if (area === "HELFER") {
    const legacyWeekdays = ["Mo", "Di", "Mi", "Do"];
    for (const row of rawImportedRows)
      for (const day of legacyWeekdays)
        if (!sourceHeaders.has(day)) row[day] = "ja";
    preservedRequiredSelfHelpers = preserveRequiredContactSelfHelpers(
      rawImportedRows,
      rowsFromDocument(current, "ANSPRECHPARTNER"),
      currentRows
    );
  }
  const correctedCopiedIds = removeCopiedModuleIds(
    area,
    rawImportedRows,
    currentRows
  );
  const preservedMissingColumns = preserveMissingOptionalModuleColumns(
    area,
    rawImportedRows,
    currentRows,
    sourceHeaders
  );
  const importedRows = hydrateExistingIds(area, rawImportedRows, currentRows);
  const workbook = baseWorkbook(current);
  for (const currentArea of MODULE_IMPORT_AREAS) {
    const rows = rowsFromDocument(current, currentArea);
    workbook.Sheets[currentArea] = rows.length
      ? XLSX.utils.json_to_sheet(rows, {
          header: PROJECT_EXCEL_HEADERS[currentArea],
        })
      : XLSX.utils.aoa_to_sheet([PROJECT_EXCEL_HEADERS[currentArea]]);
  }
  workbook.Sheets[area] = importedRows.length
    ? XLSX.utils.json_to_sheet(importedRows, {
        header: PROJECT_EXCEL_HEADERS[area],
      })
    : XLSX.utils.aoa_to_sheet([PROJECT_EXCEL_HEADERS[area]]);
  if (area === "ANSPRECHPARTNER") {
    const currentContactRows = rowsFromDocument(current, "ANSPRECHPARTNER");
    const importedIds = new Set(
      importedRows.map(row => String(row.ID ?? "")).filter(Boolean)
    );
    const importedNames = new Set(
      importedRows.map(row => normalized(row.Name)).filter(Boolean)
    );
    const removedContacts = current.contacts.filter(
      row =>
        !importedIds.has(String(row.sourceId ?? "")) &&
        !importedNames.has(normalized(row.name))
    );
    const removedContactIds = new Set(
      removedContacts.map(row => String(row.sourceId ?? ""))
    );
    const removedContactNames = new Set(
      removedContacts.map(row => normalized(row.name))
    );
    const helperRows = rowsFromDocument(current, "HELFER").filter(
      row =>
        !(
          removedContactIds.has(String(row["Ansprechpartner-ID"] ?? "")) &&
          removedContactNames.has(normalized(row.Name))
        )
    );
    for (const contactRow of importedRows) {
      const contactName = String(contactRow.Name ?? "").trim();
      if (!contactName) continue;
      const existing = findContactSelfHelperRow(
        contactRow,
        helperRows,
        currentContactRows
      );
      if (existing) {
        existing["Ansprechpartner-ID"] = contactRow.ID ?? "";
        existing.Ansprechpartner = contactName;
        existing.Name = contactName;
        existing.Telefon = contactRow.Rufnummer ?? existing.Telefon;
      } else {
        helperRows.push({
          ID: "",
          "Ansprechpartner-ID": contactRow.ID ?? "",
          Ansprechpartner: contactName,
          Name: contactName,
          "E-Mail": "",
          Telefon: contactRow.Rufnummer ?? "",
          Bemerkung: "",
          "Helfen?": "ja",
          Mo: "vielleicht",
          Di: "vielleicht",
          Mi: "vielleicht",
          Do: "vielleicht",
          Fr: "vielleicht",
          Sa: "vielleicht",
          So: "vielleicht",
          "Bestätigt?": "nein",
        });
      }
    }
    workbook.Sheets.HELFER = XLSX.utils.json_to_sheet(helperRows, {
      header: PROJECT_EXCEL_HEADERS.HELFER,
    });
  }
  const mergedBase64 = (
    XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    }) as Buffer
  ).toString("base64");
  const imported = parseBackupWorkbook(mergedBase64);
  const allChanges = diffDocuments(current, imported);
  const allowedAreas = new Set<BackupArea>(
    area === "ANSPRECHPARTNER"
      ? [...MODULE_IMPORT_AREAS, "ZUORDNUNGEN"]
      : area === "HELFER"
        ? ["HELFER", "EINSATZPLAN", "ZUORDNUNGEN"]
        : area === "EINSATZPLAN"
          ? ["EINSATZPLAN", "ZUORDNUNGEN"]
          : [area]
  );
  const selectedKeys = allChanges
    .filter(change => allowedAreas.has(change.area))
    .map(change => change.key);
  const target = selectedKeys.length
    ? buildSelectedDocument(current, imported, allChanges, selectedKeys)
    : current;
  const changes = diffDocuments(current, target);
  const possibleRenameWithoutId =
    (area === "ANSPRECHPARTNER" || area === "HELFER") &&
    changes.some(
      change =>
        change.area === area &&
        change.action === "create" &&
        change.after?.sourceId == null
    ) &&
    changes.some(change => change.area === area && change.action === "delete");
  if (possibleRenameWithoutId)
    target.warnings = [
      ...target.warnings,
      `Mögliche Umbenennung ohne ID erkannt: Neue und gelöschte ${area === "HELFER" ? "Helfer" : "Ansprechpartner"} werden als getrennte Datensätze behandelt. Prüfen Sie besonders Einsatzzuordnungen und behalten Sie für reine Umbenennungen die ausgeblendete ID-Spalte aus dem Projekt-Export bei.`,
    ];
  if (correctedCopiedIds)
    target.warnings = [
      ...target.warnings,
      `${correctedCopiedIds} ungültige oder mitkopierte technische ID${correctedCopiedIds === 1 ? " wurde" : "s wurden"} bei ${areaName[area]}-Zeilen automatisch entfernt. Alle Zeilen werden einzeln geprüft.`,
    ];
  if (preservedMissingColumns)
    target.warnings = [
      ...target.warnings,
      `${preservedMissingColumns} Werte aus fehlenden optionalen Spalten wurden aus dem bestehenden Stand beibehalten. Vorhandene leere Zellen werden dagegen bewusst als Leerung übernommen.`,
    ];
  if (preservedRequiredSelfHelpers)
    target.warnings = [
      ...target.warnings,
      `${preservedRequiredSelfHelpers} eigene Ansprechpartner-Helfereinträge wurden automatisch beibehalten und korrekt verknüpft.`,
    ];
  return {
    current,
    target,
    changes,
    rowsChecked: importedRows.filter(row => rowIdentity(area, row)).length,
  };
}

const summarize = (changes: BackupChange[]) => ({
  created: changes.filter(change => change.action === "create").length,
  updated: changes.filter(change => change.action === "update").length,
  deleted: changes.filter(change => change.action === "delete").length,
});

export async function previewModuleExcelImport(
  base64: string,
  area: ModuleImportArea
) {
  const { target, changes, rowsChecked } = await buildModuleTarget(base64, area);
  const preview = await previewProjectDocument(target, digest(base64));
  return {
    area,
    areaName: areaName[area],
    currentDigest: preview.currentDigest,
    sourceDigest: preview.workbookDigest,
    warnings: preview.warnings,
    changes,
    totals: summarize(changes),
    rowsChecked,
  };
}

export type ModuleImportPreview = Awaited<
  ReturnType<typeof previewModuleExcelImport>
>;

export async function applyModuleExcelImport(
  base64: string,
  area: ModuleImportArea,
  filename: string,
  expectedCurrentDigest: string,
  actor: AuditActor
) {
  const { target, changes } = await buildModuleTarget(base64, area);
  if (!changes.length)
    throw new Error("Die Excel-Datei enthält keine Änderungen");
  return restoreProjectDocument(
    target,
    digest(base64),
    `${areaName[area]} · ${filename}`,
    expectedCurrentDigest,
    actor
  );
}
