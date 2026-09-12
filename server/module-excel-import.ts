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

function assertHeaders(sheet: XLSX.WorkSheet, area: ModuleImportArea) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headers = new Set(
    (rows[0] ?? []).map(value => String(value ?? "").trim()).filter(Boolean)
  );
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
  return headers;
}

const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");

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
  if (area === "KUCHEN") return normalized(`${row.Spender}|${row.Kuchen}`);
  return normalized(row.Kategorie);
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
      "Helfen?": row.willHelp,
      Mo: row.availMon,
      Di: row.availTue,
      Mi: row.availWed,
      Do: row.availThu,
      Fr: row.availFri,
      Sa: row.availSat,
      So: row.availSun,
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
  const taskRows = (rows: BackupDocument["post"], due = false) =>
    rows.map(row => ({
      ID: row.sourceId,
      Aufgabe: row.task,
      ...(due
        ? {
            "Zu erledigen bis": (row as BackupDocument["prep"][number]).dueText,
          }
        : {}),
      "Verantwortlich-ID": row.contactSourceId ?? "",
      Verantwortlich: row.contactName,
      Status: row.status,
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
  const sourceHeaders = assertHeaders(source, area);
  const rawImportedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    source,
    { defval: "", raw: true }
  );
  if (area === "HELFER") {
    const legacyWeekdays = ["Mo", "Di", "Mi", "Do"];
    for (const row of rawImportedRows)
      for (const day of legacyWeekdays)
        if (!sourceHeaders.has(day)) row[day] = "ja";
  }
  const importedRows = hydrateExistingIds(
    area,
    rawImportedRows,
    rowsFromDocument(current, area)
  );
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
      const contactId = String(contactRow.ID ?? "");
      const contactName = String(contactRow.Name ?? "").trim();
      if (!contactName) continue;
      const existing = helperRows.find(
        row =>
          (contactId &&
            String(row["Ansprechpartner-ID"] ?? "") === contactId) ||
          normalized(row.Name) === normalized(contactName)
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
        ? ["HELFER", "ZUORDNUNGEN"]
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
  const unexpected = changes.find(change => !allowedAreas.has(change.area));
  if (unexpected)
    throw new Error(
      `${areaName[area]} kann nicht unabhängig importiert werden: Die Datei erfordert zusätzlich eine Änderung in „${unexpected.area}“.`
    );
  return { current, target, changes };
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
  const { target, changes } = await buildModuleTarget(base64, area);
  const preview = await previewProjectDocument(target, digest(base64));
  return {
    area,
    areaName: areaName[area],
    currentDigest: preview.currentDigest,
    sourceDigest: preview.workbookDigest,
    warnings: preview.warnings,
    changes,
    totals: summarize(changes),
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
