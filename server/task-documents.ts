import { TRPCError } from "@trpc/server";
import { and, eq, asc } from "drizzle-orm";
import JSZip from "jszip";
import * as CFB from "cfb";
import jpeg from "jpeg-js";
import {
  taskDocuments,
  prepTasks,
  postTasks,
  events,
  contacts,
  helpers,
  planningTeamAccesses,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  currentEventId,
  currentEventYear,
  currentTenantId,
} from "./year-context";
import { storagePut, storageRead, storageDelete } from "./storage";
import { validateFinancePdf } from "./finance-documents";
import { planningTeamAccessOpenId } from "./password-auth";
import { PDF_UPLOAD_POLICY_VERSION } from "./pdf-upload-policy";

export type TaskDocumentArea = "prep" | "post";
export type TaskDocumentActor = {
  userId: number;
  personalAccount: boolean;
  ownContactIds: ReadonlySet<number>;
  financeWrite: boolean;
  taskWrite: boolean;
};
type Attachment = typeof taskDocuments.$inferSelect;
export const MAX_TASK_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EVENT_BYTES = 250 * 1024 * 1024;
function badFile(
  message = "Bitte eine gültige PDF-, JPEG- oder Word-Datei auswählen."
): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
export async function validateTaskFile(
  kind: "document" | "receipt",
  fileName: string,
  base64: string
) {
  const ext = fileName.toLowerCase().split(".").pop();
  if (kind === "receipt" && ext !== "pdf")
    badFile("Belege und Rechnungen dürfen nur als PDF hochgeladen werden.");
  if (!["pdf", "jpg", "jpeg", "doc", "docx"].includes(ext ?? "")) badFile();
  if (
    base64.length > Math.ceil(MAX_TASK_FILE_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
    base64.length % 4 !== 0
  )
    badFile("Die Datei ist ungültig oder größer als 5 MiB.");
  let bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_TASK_FILE_BYTES)
    badFile("Die Datei darf höchstens 5 MiB groß sein.");
  let mimeType: string;
  if (ext === "pdf") {
    const pdf = await validateFinancePdf(fileName, base64);
    bytes = pdf.bytes;
    mimeType = "application/pdf";
  } else if (ext === "jpg" || ext === "jpeg") {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8)
      badFile("Die Datei enthält kein gültiges JPEG-Foto.");
    try {
      jpeg.decode(bytes, {
        useTArray: true,
        maxResolutionInMP: 20,
        maxMemoryUsageInMB: 128,
        tolerantDecoding: false,
      });
    } catch {
      badFile("Das JPEG-Foto ist beschädigt oder hat mehr als 20 Megapixel.");
    }
    mimeType = "image/jpeg";
  } else if (ext === "docx") {
    try {
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.values(zip.files);
      const total = entries.reduce(
        (n, entry) => n + ((entry as any)._data?.uncompressedSize ?? 0),
        0
      );
      if (entries.length > 1000 || total > 20 * 1024 * 1024)
        badFile("Das entpackte Word-Dokument ist zu groß.");
      if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml"))
        badFile("Die Datei enthält kein Word-Dokument.");
      if (
        entries.some(entry =>
          /(?:vbaProject|embeddings\/|activeX\/)/i.test(entry.name)
        )
      )
        badFile(
          "Word-Dateien mit Makros oder eingebetteten Programmen sind nicht erlaubt."
        );
      const types = await zip.file("[Content_Types].xml")!.async("string");
      if (
        !types.includes(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
        ) ||
        /macroEnabled/i.test(types)
      )
        badFile("Bitte eine Word-Datei ohne Makros auswählen.");
      for (const entry of entries.filter(e => /\.rels$/i.test(e.name))) {
        const xml = await entry.async("string");
        if (/TargetMode\s*=\s*["']External["']/i.test(xml))
          badFile(
            "Word-Dateien mit extern verknüpften Inhalten sind nicht erlaubt."
          );
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      badFile("Die Word-Datei ist beschädigt oder ungültig.");
    }
    mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    if (!bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex")))
      badFile("Die Datei enthält kein gültiges Word-Dokument.");
    try {
      const doc = CFB.read(bytes, { type: "buffer" });
      if (
        !doc.FullPaths.some(p => /\/WordDocument$/i.test(p)) ||
        doc.FullPaths.some(p => /(?:VBA|Macros|ObjectPool)/i.test(p))
      )
        badFile(
          "Bitte eine Word-Datei ohne Makros oder eingebettete Objekte auswählen."
        );
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      badFile("Die Word-Datei ist beschädigt oder ungültig.");
    }
    mimeType = "application/msword";
  }
  const safeName = fileName.replace(/[/\\\x00-\x1f\x7f]/g, "_").trim();
  if (!safeName || safeName.length > 200)
    badFile("Bitte einen Dateinamen mit höchstens 200 Zeichen verwenden.");
  return { bytes, fileName: safeName, mimeType, ext: ext! };
}
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Dokumentspeicher momentan nicht erreichbar.",
    });
  return db;
}
function scope() {
  return and(
    eq(taskDocuments.tenantId, currentTenantId()),
    eq(taskDocuments.eventId, currentEventId()),
    eq(taskDocuments.year, currentEventYear())
  );
}
function taskColumn(area: TaskDocumentArea) {
  return area === "prep" ? taskDocuments.prepTaskId : taskDocuments.postTaskId;
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
export async function requireDocumentTask(
  area: TaskDocumentArea,
  taskId: number
) {
  const db = await requireEvent();
  const table = area === "prep" ? prepTasks : postTasks;
  const [task] = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.id, taskId),
        eq(table.eventId, currentEventId()),
        eq(table.year, currentEventYear()),
        eq(table.deleted, false)
      )
    )
    .limit(1);
  if (!task)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Aufgabe wurde nicht gefunden oder ist gelöscht.",
    });
  return task;
}
/** Nur explizite Kontakt-ID: Helfer.contactId bezeichnet dessen Betreuer, niemals den Helfer selbst. */
export function canReadTaskReceipt(
  actor: TaskDocumentActor,
  file: Pick<
    Attachment,
    "uploadedByUserId" | "paidByUserId" | "paidByContactId"
  >,
  task: { contactId: number | null }
) {
  return (
    actor.financeWrite ||
    (actor.personalAccount &&
      (file.uploadedByUserId === actor.userId ||
        file.paidByUserId === actor.userId)) ||
    (file.paidByContactId !== null &&
      actor.ownContactIds.has(file.paidByContactId)) ||
    (task.contactId !== null && actor.ownContactIds.has(task.contactId))
  );
}
function canDelete(actor: TaskDocumentActor, file: Attachment) {
  return file.kind === "document"
    ? actor.taskWrite
    : actor.financeWrite ||
        (actor.personalAccount &&
          actor.taskWrite &&
          file.uploadedByUserId === actor.userId);
}
export async function listTaskDocuments(
  area: TaskDocumentArea,
  taskId: number,
  actor: TaskDocumentActor
) {
  const task = await requireDocumentTask(area, taskId);
  const db = await database();
  const rows = await db
    .select()
    .from(taskDocuments)
    .where(and(scope(), eq(taskColumn(area), taskId)))
    .orderBy(asc(taskDocuments.id));
  return {
    files: rows
      .filter(
        row => row.kind === "document" || canReadTaskReceipt(actor, row, task)
      )
      .map(row => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        paidBy: row.paidBy,
        fileName: row.fileName,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        createdAt: row.createdAt,
        canDelete: canDelete(actor, row),
      })),
    canUploadDocuments: actor.taskWrite,
    canUploadReceipts: true as const,
    pdfUploadPolicyVersion: PDF_UPLOAD_POLICY_VERSION,
    receiptIdentityNotice:
      actor.personalAccount || actor.financeWrite
        ? null
        : "Dieser gemeinsame Teamzugang erlaubt keine persönliche Belegzuordnung. Hochgeladene Belege sehen die berechtigten Verantwortlichen und Finanz-Schreibenden.",
  };
}
export async function listTaskDocumentPayers() {
  const db = await requireEvent();
  const where = (table: typeof contacts | typeof helpers) =>
    and(
      eq(table.eventId, currentEventId()),
      eq(table.year, currentEventYear())
    );
  const [c, h] = await Promise.all([
    db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(where(contacts)),
    db
      .select({ id: helpers.id, name: helpers.name })
      .from(helpers)
      .where(where(helpers)),
  ]);
  return [
    ...c.map(p => ({ key: `contact:${p.id}`, name: p.name })),
    ...h.map(p => ({ key: `helper:${p.id}`, name: p.name })),
  ].sort(
    (a, b) => a.name.localeCompare(b.name, "de") || a.key.localeCompare(b.key)
  );
}
export async function uploadTaskDocument(
  input: {
    area: TaskDocumentArea;
    taskId: number;
    kind: "document" | "receipt";
    title: string;
    paidByKey?: string;
    fileName: string;
    base64: string;
  },
  actor: TaskDocumentActor
) {
  await requireDocumentTask(input.area, input.taskId);
  if (input.kind === "document" && !actor.taskWrite)
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Zum Hochladen allgemeiner Dokumente sind Aufgaben-Schreibrechte erforderlich.",
    });
  const payer =
    input.kind === "receipt"
      ? (await listTaskDocumentPayers()).find(p => p.key === input.paidByKey)
      : undefined;
  if (input.kind === "receipt" && !payer)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Bitte eine Person dieser Veranstaltung unter Bezahlt von auswählen.",
    });
  let paidByUserId: number | null = null;
  // Ohne echte User/Contact-FK bleibt ein Helfername reine Dokumentation, niemals ein Identitätsnachweis.
  if (payer?.key.startsWith("contact:")) {
    const db = await database();
    const [access] = await db
      .select({ id: planningTeamAccesses.id })
      .from(planningTeamAccesses)
      .where(
        eq(planningTeamAccesses.contactId, Number(payer.key.split(":")[1]))
      )
      .limit(1);
    if (access) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, planningTeamAccessOpenId(access.id)))
        .limit(1);
      paidByUserId = user?.id ?? null;
    }
  }
  const file = await validateTaskFile(input.kind, input.fileName, input.base64);
  const stored = await storagePut(
    `task-documents/${currentTenantId()}/${currentEventYear()}/${currentEventId()}/${crypto.randomUUID()}.${file.ext}`,
    file.bytes,
    file.mimeType
  );
  try {
    const db = await database();
    return await db.transaction(async tx => {
      // Eine Eventzeile serialisiert das Eventkontingent für beide Aufgabenarten.
      await tx
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.id, currentEventId()),
            eq(events.tenantId, currentTenantId()),
            eq(events.year, currentEventYear())
          )
        )
        .for("update");
      const table = input.area === "prep" ? prepTasks : postTasks;
      const [task] = await tx
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.id, input.taskId),
            eq(table.eventId, currentEventId()),
            eq(table.year, currentEventYear()),
            eq(table.deleted, false)
          )
        )
        .limit(1)
        .for("update");
      if (!task)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Die Aufgabe wurde inzwischen entfernt.",
        });
      const sizes = await tx
        .select({ byteSize: taskDocuments.byteSize })
        .from(taskDocuments)
        .where(scope());
      if (
        sizes.reduce((n, row) => n + row.byteSize, 0) + file.bytes.length >
        MAX_EVENT_BYTES
      )
        badFile(
          "Der Dokumentenspeicher dieser Veranstaltung ist voll (250 MiB)."
        );
      const [result] = await tx.insert(taskDocuments).values({
        tenantId: currentTenantId(),
        eventId: currentEventId(),
        year: currentEventYear(),
        prepTaskId: input.area === "prep" ? input.taskId : null,
        postTaskId: input.area === "post" ? input.taskId : null,
        kind: input.kind,
        title: input.title,
        uploadedByUserId: actor.personalAccount ? actor.userId : null,
        paidByUserId,
        paidBy: payer?.name ?? null,
        paidByContactId: payer?.key.startsWith("contact:")
          ? Number(payer.key.split(":")[1])
          : null,
        paidByHelperId: payer?.key.startsWith("helper:")
          ? Number(payer.key.split(":")[1])
          : null,
        fileName: file.fileName,
        mimeType: file.mimeType,
        byteSize: file.bytes.length,
        storageKey: stored.key,
      });
      return { id: result.insertId };
    });
  } catch (error) {
    await storageDelete(stored.key).catch(() => undefined);
    throw error;
  }
}
async function accessibleFile(
  area: TaskDocumentArea,
  id: number,
  actor: TaskDocumentActor
) {
  const db = await requireEvent();
  const [file] = await db
    .select()
    .from(taskDocuments)
    .where(and(scope(), eq(taskDocuments.id, id)))
    .limit(1);
  const taskId = file && (area === "prep" ? file.prepTaskId : file.postTaskId);
  if (!file || !taskId)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Datei wurde nicht gefunden.",
    });
  const task = await requireDocumentTask(area, taskId);
  if (file.kind === "receipt" && !canReadTaskReceipt(actor, file, task))
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Datei wurde nicht gefunden.",
    });
  return file;
}
export async function downloadTaskDocument(
  area: TaskDocumentArea,
  id: number,
  actor: TaskDocumentActor
) {
  const file = await accessibleFile(area, id, actor);
  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    base64: (await storageRead(file.storageKey)).toString("base64"),
  };
}
export async function removeTaskDocument(
  area: TaskDocumentArea,
  id: number,
  actor: TaskDocumentActor
) {
  const file = await accessibleFile(area, id, actor);
  if (!canDelete(actor, file))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Keine Berechtigung zum Entfernen dieser Datei.",
    });
  const db = await database();
  await db.delete(taskDocuments).where(and(scope(), eq(taskDocuments.id, id)));
  await storageDelete(file.storageKey).catch(() => undefined);
  return { success: true };
}
