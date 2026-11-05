import { TRPCError } from "@trpc/server";
import { and, eq, inArray, asc } from "drizzle-orm";
import { ZipArchive } from "archiver";
import {
  financeReceipts,
  finances,
  events,
  contacts,
  helpers,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  currentEventId,
  currentEventYear,
  currentTenantId,
} from "./year-context";
import { storagePut, storageRead, storageDelete } from "./storage";

export const MAX_FINANCE_PDF_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EVENT_RECEIPT_BYTES = 250 * 1024 * 1024;

export function validateFinancePdf(fileName: string, base64: string) {
  if (
    !/\.pdf$/i.test(fileName.trim()) ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
    base64.length % 4 !== 0
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Bitte eine gültige PDF-Datei auswählen.",
    });
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_FINANCE_PDF_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Eine PDF darf höchstens 5 MB groß sein.",
    });
  }
  if (
    !/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(
      bytes.subarray(0, 12).toString("ascii")
    ) ||
    !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Die Datei ist keine vollständige PDF.",
    });
  }
  // Keine aktiven Aktionen/Dateianhänge in Belegen; keine Behauptung eines Virenscans.
  if (
    /\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|Encrypt)\b/.test(
      bytes.toString("latin1")
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Bitte eine PDF ohne aktive Inhalte, eingebettete Dateien oder Passwortschutz hochladen.",
    });
  }
  const safeName =
    fileName
      .replace(/[/\\\x00-\x1f\x7f]/g, "_")
      .trim()
      .slice(0, 196)
      .replace(/\.pdf$/i, "") + ".pdf";
  return { bytes, fileName: safeName };
}

async function database() {
  const result = await getDb();
  if (!result)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Belegspeicher momentan nicht erreichbar.",
    });
  return result;
}

function eventScope(table: { eventId: any; year: any }) {
  return and(
    eq(table.eventId, currentEventId()),
    eq(table.year, currentEventYear())
  );
}

async function requireEvent() {
  const db = await database();
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.id, currentEventId()),
        eq(events.year, currentEventYear()),
        eq(events.tenantId, currentTenantId())
      )
    )
    .limit(1);
  if (!event)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Veranstaltung wurde nicht gefunden.",
    });
  return db;
}

export async function requireFinance(financeId: number) {
  const db = await requireEvent();
  const [row] = await db
    .select()
    .from(finances)
    .where(and(eventScope(finances), eq(finances.id, financeId)))
    .limit(1);
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Finanzkategorie wurde nicht gefunden.",
    });
  return row;
}

export function receiptMetadata(row: typeof financeReceipts.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    paidBy: row.paidBy,
    fileName: row.fileName,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
  };
}

export async function listFinanceReceipts(financeId: number) {
  const finance = await requireFinance(financeId);
  const db = await database();
  return (
    await db
      .select()
      .from(financeReceipts)
      .where(
        and(
          eventScope(financeReceipts),
          eq(financeReceipts.category, finance.category)
        )
      )
      .orderBy(asc(financeReceipts.id))
  ).map(receiptMetadata);
}

export async function listFinancePayers() {
  const db = await requireEvent();
  const [contactNames, helperNames] = await Promise.all([
    db
      .select({ name: contacts.name })
      .from(contacts)
      .where(eventScope(contacts)),
    db.select({ name: helpers.name }).from(helpers).where(eventScope(helpers)),
  ]);
  return Array.from(
    new Set(
      [...contactNames, ...helperNames]
        .map(row => row.name.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "de"));
}

export async function uploadFinanceReceipt(input: {
  financeId: number;
  title: string;
  paidBy: string;
  fileName: string;
  pdfBase64: string;
}) {
  await requireFinance(input.financeId);
  const pdf = validateFinancePdf(input.fileName, input.pdfBase64);
  const db = await database();
  // Speicherung erfolgt nur privat. Die zurückgegebene öffentliche URL wird nie benutzt.
  const stored = await storagePut(
    `finance-receipts/${currentTenantId()}/${currentEventYear()}/${currentEventId()}/${crypto.randomUUID()}.pdf`,
    pdf.bytes,
    "application/pdf"
  );
  try {
    return await db.transaction(async tx => {
      const [finance] = await tx
        .select()
        .from(finances)
        .where(and(eventScope(finances), eq(finances.id, input.financeId)))
        .limit(1)
        .for("update");
      if (!finance)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finanzkategorie wurde inzwischen entfernt.",
        });
      const sizes = await tx
        .select({ byteSize: financeReceipts.byteSize })
        .from(financeReceipts)
        .where(eventScope(financeReceipts));
      if (
        sizes.reduce((sum, row) => sum + row.byteSize, 0) + pdf.bytes.length >
        MAX_EVENT_RECEIPT_BYTES
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Der Belegspeicher dieser Veranstaltung ist voll (250 MB). Bitte ältere Belege sichern und entfernen.",
        });
      }
      const [result] = await tx.insert(financeReceipts).values({
        year: currentEventYear(),
        eventId: currentEventId(),
        category: finance.category,
        title: input.title,
        paidBy: input.paidBy,
        fileName: pdf.fileName,
        storageKey: stored.key,
        byteSize: pdf.bytes.length,
      });
      return { id: result.insertId };
    });
  } catch (error) {
    await storageDelete(stored.key).catch(() => undefined);
    throw error;
  }
}

async function findReceipt(id: number) {
  const db = await requireEvent();
  const [row] = await db
    .select()
    .from(financeReceipts)
    .where(
      and(
        eventScope(financeReceipts),
        eq(financeReceipts.id, id),
        inArray(
          financeReceipts.category,
          db
            .select({ category: finances.category })
            .from(finances)
            .where(eventScope(finances))
        )
      )
    )
    .limit(1);
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Beleg wurde nicht gefunden.",
    });
  return row;
}

export async function downloadFinanceReceipt(id: number) {
  const row = await findReceipt(id);
  return {
    fileName: row.fileName,
    base64: (await storageRead(row.storageKey)).toString("base64"),
  };
}

export async function removeFinanceReceipt(id: number) {
  const row = await findReceipt(id);
  const db = await database();
  await db
    .delete(financeReceipts)
    .where(and(eventScope(financeReceipts), eq(financeReceipts.id, id)));
  await storageDelete(row.storageKey).catch(() => undefined);
  return { success: true };
}

export async function exportFinanceReceipts(financeId?: number) {
  const db = await requireEvent();
  const finance =
    financeId === undefined ? undefined : await requireFinance(financeId);
  const rows = await db
    .select()
    .from(financeReceipts)
    .where(
      and(
        eventScope(financeReceipts),
        finance ? eq(financeReceipts.category, finance.category) : undefined,
        inArray(
          financeReceipts.category,
          db
            .select({ category: finances.category })
            .from(finances)
            .where(eventScope(finances))
        )
      )
    )
    .orderBy(asc(financeReceipts.id));
  if (rows.reduce((sum, row) => sum + row.byteSize, 0) > MAX_ARCHIVE_BYTES)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Die Sicherung ist größer als 100 MB. Bitte die Belege je Kategorie sichern.",
    });
  const financeRows = await db
    .select()
    .from(finances)
    .where(
      and(
        eventScope(finances),
        finance ? eq(finances.id, finance.id) : undefined
      )
    );
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });
  const manifest = [];
  try {
    for (const row of rows) {
      const name = `PDF/${row.id}-${row.fileName}`;
      archive.append(await storageRead(row.storageKey), { name });
      manifest.push({
        ...receiptMetadata(row),
        category: row.category,
        pdf: name,
      });
    }
    archive.append(
      JSON.stringify(
        {
          format: "mycrewmate-finanzbelege-v1",
          year: currentEventYear(),
          exportedAt: new Date().toISOString(),
          categories: financeRows.map(row => ({
            category: row.category,
            incomeCents: row.income,
            expenseCents: row.expense,
            note: row.note,
          })),
          receipts: manifest,
        },
        null,
        2
      ),
      { name: "Finanzbelege.json" }
    );
    archive.append(
      "MyCrewMate – Belegsicherung\nDie PDF-Dateien und ihre Zuordnung stehen in Finanzbelege.json. Diese ZIP-Datei ist ein separates Belegarchiv und keine Excel-/JSON-Projektdatei für den Laden-Dialog. Für einen vollständigen Rückfallstand zusätzlich die Projektdatei sichern.\n",
      { name: "Hinweis.txt" }
    );
    await archive.finalize();
    return {
      fileName: `MyCrewMate-Finanzbelege-${currentEventYear()}.zip`,
      base64: (await completed).toString("base64"),
    };
  } catch (error) {
    archive.abort();
    // Konsumiert ein evtl. gleichzeitig ausgelöstes Archivfehlerereignis.
    completed.catch(() => undefined);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Die Belegsicherung konnte nicht vollständig erstellt werden. Bitte erneut versuchen.",
    });
  }
}
