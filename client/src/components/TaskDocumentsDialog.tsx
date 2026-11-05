import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Download, Eye, Lock, Paperclip, Trash2, Upload } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type TaskDocumentArea = "prep" | "post";
export type TaskDocumentKind = "document" | "receipt";
export type TaskDocumentPayer = { key: string; name: string };
export type TaskDocumentFile = {
  id: number;
  kind: TaskDocumentKind;
  title: string;
  paidBy: string | null;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date | string | number;
  canOpen: boolean;
  canDelete: boolean;
};
export type TaskDocumentList = {
  files: TaskDocumentFile[];
  canUploadDocuments: boolean;
  canUploadReceipts: true;
  receiptIdentityNotice?: string | null;
};
export type TaskDocumentDraft = {
  localId: string;
  kind: TaskDocumentKind;
  title: string;
  paidByKey?: string;
  paidByLabel?: string;
  file: File;
  status: "pending" | "uploading" | "failed";
  error?: string;
};
export function taskDocumentPayerLabel(
  person: TaskDocumentPayer,
  people: TaskDocumentPayer[]
) {
  const sameName = people.filter(row => row.name.trim() === person.name.trim());
  if (sameName.length < 2) return person.name;
  const role = person.key.startsWith("contact:") ? "Ansprechpartner" : "Helfer";
  const sameRole = sameName.filter(
    row => row.key.split(":")[0] === person.key.split(":")[0]
  );
  return `${person.name} (${role}${sameRole.length > 1 ? ` #${person.key.split(":")[1]}` : ""})`;
}
type UploadInput = {
  area: TaskDocumentArea;
  taskId: number;
  kind: TaskDocumentKind;
  title: string;
  paidByKey?: string;
  fileName: string;
  base64: string;
};

export const MAX_TASK_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const TASK_DOCUMENT_ACCEPT =
  ".pdf,.jpg,.jpeg,.doc,.docx,application/pdf,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function taskDocumentSelectionError(
  kind: TaskDocumentKind,
  file: Pick<File, "name" | "size" | "type">
): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  if (
    !extension ||
    !types[extension] ||
    (kind === "receipt" && extension !== "pdf")
  )
    return kind === "receipt"
      ? "Für einen Beleg / eine Rechnung bitte eine PDF-Datei auswählen."
      : "Bitte eine PDF-, JPEG- oder Word-Datei (.doc / .docx) auswählen.";
  if (
    file.type &&
    file.type !== types[extension] &&
    file.type !== "application/octet-stream"
  )
    return "Dateiendung und Dateityp passen nicht zusammen.";
  if (file.name.length > 200)
    return "Der Dateiname darf höchstens 200 Zeichen lang sein.";
  if (!file.size) return "Die ausgewählte Datei ist leer.";
  if (file.size > MAX_TASK_DOCUMENT_BYTES)
    return "Die Datei darf höchstens 5 MiB groß sein.";
  return null;
}

export function taskDocumentFormError(
  kind: TaskDocumentKind,
  title: string,
  file: File | null,
  paidByKey: string,
  payers: TaskDocumentPayer[]
): string | null {
  if (!title.trim()) return "Bitte eine Bezeichnung eingeben.";
  if (title.trim().length > 160)
    return "Die Bezeichnung darf höchstens 160 Zeichen lang sein.";
  if (kind === "receipt" && !payers.some(person => person.key === paidByKey))
    return "Bitte eine bekannte zahlende Person auswählen.";
  if (!file) return "Bitte eine Datei auswählen.";
  return taskDocumentSelectionError(kind, file);
}

export async function taskDocumentBase64(
  file: File,
  kind: TaskDocumentKind
): Promise<string> {
  const error = taskDocumentSelectionError(kind, file);
  if (error) throw new Error(error);
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  const hasHeader =
    extension === "pdf"
      ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
      : extension === "jpg" || extension === "jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : extension === "docx"
          ? bytes[0] === 0x50 &&
            bytes[1] === 0x4b &&
            bytes[2] === 0x03 &&
            bytes[3] === 0x04
          : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
              (byte, index) => bytes[index] === byte
            );
  if (!hasHeader)
    throw new Error("Die Datei enthält keinen passenden Dateikopf.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.onabort = () =>
      reject(new Error("Das Lesen der Datei wurde abgebrochen."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.includes(",")) {
        reject(new Error("Die Datei konnte nicht gelesen werden."));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

const errorMessage = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "Die Aktion konnte nicht ausgeführt werden.";

/** Local-only queue. No upload can happen until a positive, persisted task ID exists. */
export function createTaskDocumentDraftQueue(area: TaskDocumentArea) {
  let sequence = 0;
  let snapshot: { drafts: TaskDocumentDraft[]; busy: boolean } = {
    drafts: [],
    busy: false,
  };
  const listeners = new Set<() => void>();
  const publish = (drafts: TaskDocumentDraft[], busy = snapshot.busy) => {
    snapshot = { drafts, busy };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stage: (draft: Omit<TaskDocumentDraft, "localId" | "status" | "error">) => {
      if (snapshot.busy) return;
      publish([
        ...snapshot.drafts,
        { ...draft, localId: `local:${++sequence}`, status: "pending" },
      ]);
    },
    discard: (localId: string) => {
      if (!snapshot.busy)
        publish(snapshot.drafts.filter(draft => draft.localId !== localId));
    },
    clear: () => {
      if (!snapshot.busy) publish([]);
    },
    flush: async (
      taskId: number,
      upload: (input: UploadInput) => Promise<unknown>,
      encode: typeof taskDocumentBase64 = taskDocumentBase64
    ): Promise<boolean> => {
      if (!Number.isSafeInteger(taskId) || taskId <= 0)
        throw new Error(
          "Dateien können erst nach erfolgreicher Aufgabenanlage hochgeladen werden."
        );
      if (snapshot.busy) return false;
      const pending = [...snapshot.drafts];
      publish(snapshot.drafts, true);
      try {
        for (const draft of pending) {
          publish(
            snapshot.drafts.map(row =>
              row.localId === draft.localId
                ? { ...row, status: "uploading", error: undefined }
                : row
            )
          );
          try {
            const base64 = await encode(draft.file, draft.kind);
            await upload({
              area,
              taskId,
              kind: draft.kind,
              title: draft.title,
              ...(draft.kind === "receipt"
                ? { paidByKey: draft.paidByKey }
                : {}),
              fileName: draft.file.name,
              base64,
            });
            // Remove each success immediately: retry only the retained failures.
            publish(
              snapshot.drafts.filter(row => row.localId !== draft.localId)
            );
          } catch (cause) {
            publish(
              snapshot.drafts.map(row =>
                row.localId === draft.localId
                  ? { ...row, status: "failed", error: errorMessage(cause) }
                  : row
              )
            );
          }
        }
        return snapshot.drafts.length === 0;
      } finally {
        publish(snapshot.drafts, false);
      }
    },
  };
}

export function useTaskDocumentDrafts(area: TaskDocumentArea) {
  const [queue] = useState(() => createTaskDocumentDraftQueue(area));
  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    queue.getSnapshot
  );
  const upload = trpc.taskDocuments.upload.useMutation();
  const utils = trpc.useUtils();
  return {
    ...snapshot,
    stage: queue.stage,
    discard: queue.discard,
    clear: queue.clear,
    flush: async (taskId: number) => {
      let uploaded = false;
      const success = await queue.flush(taskId, async input => {
        await upload.mutateAsync(input);
        uploaded = true;
      });
      // A refresh failure must not turn a confirmed upload into a retry/duplicate.
      void utils.taskDocuments.list
        .invalidate({ area, taskId })
        .catch(() => undefined);
      // Confirmed partial successes count too; failed/local drafts never count.
      if (uploaded)
        void utils.taskDocuments.counts
          .invalidate({ area })
          .catch(() => undefined);
      return success;
    },
  };
}
export type TaskDocumentDraftController = ReturnType<
  typeof useTaskDocumentDrafts
>;

export function taskDocumentCanPreview(mimeType: string) {
  return mimeType === "application/pdf" || mimeType === "image/jpeg";
}

/** Each preview owns a fresh Blob URL, released on tab close or dialog unmount. */
export function createTaskDocumentFileViewer() {
  const resources = new Map<string, () => void>();
  return {
    show: (
      file: { fileName: string; mimeType: string; base64: string },
      mode: "preview" | "download",
      preview?: Window | null
    ) => {
      if (
        mode === "preview" &&
        (!taskDocumentCanPreview(file.mimeType) || !preview)
      )
        throw new Error(
          "Die Vorschau konnte nicht geöffnet werden. Bitte die Datei herunterladen."
        );
      const binary = atob(file.base64);
      const bytes = Uint8Array.from(binary, character =>
        character.charCodeAt(0)
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: file.mimeType })
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      let interval: ReturnType<typeof setInterval> | undefined;
      const release = () => {
        if (!resources.has(url)) return;
        if (timer) clearTimeout(timer);
        if (interval) clearInterval(interval);
        resources.delete(url);
        URL.revokeObjectURL(url);
      };
      resources.set(url, release);
      try {
        if (mode === "preview" && preview) {
          preview.opener = null;
          preview.location.replace(url);
          interval = setInterval(() => {
            if (preview.closed) release();
          }, 1_000);
        } else {
          const anchor = document.createElement("a");
          try {
            anchor.href = url;
            anchor.download = file.fileName.replace(/[\\/]/g, "-");
            document.body.appendChild(anchor);
            anchor.click();
          } finally {
            anchor.remove();
          }
          timer = setTimeout(release, 1_000);
        }
      } catch (cause) {
        release();
        throw cause;
      }
    },
    dispose: () => {
      Array.from(resources.values()).forEach(release => release());
    },
  };
}

export function TaskDocumentsButton({
  onClick,
  disabled = false,
  taskTitle,
  compact = false,
  count,
}: {
  onClick: () => void;
  disabled?: boolean;
  taskTitle?: string;
  compact?: boolean;
  count?: number;
}) {
  const hasCount = typeof count === "number" && count > 0;
  const label = taskTitle
    ? `Belege / Dokumente zu ${taskTitle}`
    : "Belege / Dokumente";
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "default"}
      className={
        compact
          ? "relative h-11 w-11 shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      }
      disabled={disabled}
      onClick={onClick}
      title="Belege / Dokumente"
      aria-label={`${label}${hasCount ? ` (${count} ${count === 1 ? "Datei" : "Dateien"})` : ""}`}
    >
      <Paperclip className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
      {!compact && "Belege / Dokumente"}
      {compact && hasCount && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-700 px-1 text-[10px] font-bold text-white ring-2 ring-white"
        >
          {count}
        </span>
      )}
    </Button>
  );
}

/** Only list.files contains remote metadata; never infer receipt access from a payer name. */
export function TaskDocumentsDialog({
  area,
  taskId,
  taskTitle,
  canWriteTask,
  drafts,
  onClose,
}: {
  area: TaskDocumentArea;
  taskId?: number;
  taskTitle: string;
  canWriteTask: boolean;
  drafts: TaskDocumentDraftController;
  onClose: () => void;
}) {
  const persisted = Number.isSafeInteger(taskId) && Number(taskId) > 0;
  const input = useMemo(() => ({ area, taskId: taskId ?? 0 }), [area, taskId]);
  const payerInput = useMemo(() => ({ area }), [area]);
  const list = trpc.taskDocuments.list.useQuery(input, {
    enabled: persisted,
    retry: false,
  });
  const payers = trpc.taskDocuments.payers.useQuery(payerInput, {
    retry: false,
  });
  const utils = trpc.useUtils();
  const remove = trpc.taskDocuments.remove.useMutation({
    onSuccess: () => {
      void utils.taskDocuments.counts
        .invalidate({ area })
        .catch(() => undefined);
    },
  });
  const [kind, setKind] = useState<TaskDocumentKind>("document");
  const [title, setTitle] = useState("");
  const [paidByKey, setPaidByKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const requestInFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const viewer = useMemo(() => createTaskDocumentFileViewer(), []);
  useEffect(() => () => viewer.dispose(), [viewer]);
  const response: TaskDocumentList | undefined = !list.error
    ? list.data
    : undefined;
  const canUploadDocuments = persisted
    ? response?.canUploadDocuments === true
    : canWriteTask;
  const canUploadReceipts = persisted
    ? response?.canUploadReceipts === true
    : canWriteTask;
  const effectiveKind =
    kind === "document" && !canUploadDocuments ? "receipt" : kind;
  const canUpload =
    effectiveKind === "document" ? canUploadDocuments : canUploadReceipts;
  const payerRows: TaskDocumentPayer[] =
    payers.error || !canUploadReceipts ? [] : (payers.data ?? []);
  const people = Array.from(
    new Map(payerRows.map(person => [person.key, person] as const)).values()
  );
  const busy = Boolean(action) || drafts.busy;

  const run = async (label: string, operation: () => Promise<void>) => {
    if (requestInFlight.current || drafts.busy) return;
    requestInFlight.current = true;
    setAction(label);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      requestInFlight.current = false;
      setAction(null);
    }
  };
  const submit = () => {
    if (!canUpload || requestInFlight.current || drafts.busy) return;
    const validation = taskDocumentFormError(
      effectiveKind,
      title,
      file,
      paidByKey,
      people
    );
    if (validation) {
      setError(validation);
      return;
    }
    void run("upload", async () => {
      const selected = file!;
      // Validate bytes while still local; malformed files never enter the queue.
      await taskDocumentBase64(selected, effectiveKind);
      drafts.stage({
        kind: effectiveKind,
        title: title.trim(),
        file: selected,
        ...(effectiveKind === "receipt"
          ? {
              paidByKey,
              paidByLabel: people.find(person => person.key === paidByKey)
                ?.name,
            }
          : {}),
      });
      setTitle("");
      setPaidByKey("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      if (persisted) await drafts.flush(taskId!);
    });
  };
  const openFile = (row: TaskDocumentFile, mode: "preview" | "download") => {
    if (row.canOpen !== true || requestInFlight.current || drafts.busy) return;
    // Reserve the tab within the user gesture, before awaiting the tRPC response.
    const preview =
      mode === "preview" ? window.open("about:blank", "_blank") : null;
    if (mode === "preview" && !preview) {
      setError(
        "Die Vorschau wurde vom Browser blockiert. Bitte Pop-ups erlauben oder herunterladen."
      );
      return;
    }
    if (preview) preview.opener = null;
    void run(`${mode}:${row.id}`, async () => {
      try {
        const result = await utils.taskDocuments.download.fetch({
          area,
          id: row.id,
        });
        viewer.show(result, mode, preview);
      } catch (cause) {
        preview?.close();
        throw cause;
      }
    });
  };
  const changeKind = (next: TaskDocumentKind) => {
    setKind(next);
    setFile(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !requestInFlight.current && !drafts.busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="break-words">
            Belege / Dokumente: {taskTitle || "Neue Aufgabe"}
          </DialogTitle>
          <DialogDescription>
            Mehrere Dateien je Aufgabe. Dokumente: PDF, JPEG oder Word. Beleg /
            Rechnung: PDF mit zahlender Person.
            {!persisted &&
              " Dateien bleiben bis zum erfolgreichen Speichern der Aufgabe nur in diesem Browser vorgemerkt. Abbrechen verwirft sie."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Vorhandene Dateien</h3>
          {persisted && list.isLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Dateien werden geladen …
            </p>
          )}
          {persisted && list.error && (
            <div className="space-y-2">
              <p role="alert" className="break-words text-sm text-destructive">
                {list.error.message}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || list.isFetching}
                onClick={() =>
                  void run("refresh", async () => {
                    await list.refetch();
                  })
                }
              >
                Erneut laden
              </Button>
            </div>
          )}
          {(!persisted || response) && !response?.files.length && (
            <p className="text-sm text-muted-foreground">
              Keine für dich sichtbaren Dateien vorhanden.
            </p>
          )}
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(response?.files ?? []).map(row => (
              <li key={row.id} className="space-y-2 rounded-md border p-3">
                <p className="break-words text-sm font-medium">{row.title}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {row.kind === "receipt" ? "Beleg / Rechnung" : "Dokument"}
                  {row.kind === "receipt" && row.paidBy
                    ? ` · Bezahlt von: ${row.paidBy}`
                    : ""}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  {row.fileName} ·{" "}
                  {(row.byteSize / 1024).toLocaleString("de-DE", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  KiB
                </p>
                <p className="text-xs text-muted-foreground">
                  Hinzugefügt: {new Date(row.createdAt).toLocaleString("de-DE")}
                </p>
                {row.canOpen !== true && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Nur für berechtigte Personen
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {row.canOpen === true &&
                    taskDocumentCanPreview(row.mimeType) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => openFile(row, "preview")}
                        aria-label={`${row.title} in neuer Vorschau anzeigen`}
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        Anzeigen
                      </Button>
                    )}
                  {row.canOpen === true && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => openFile(row, "download")}
                      aria-label={`${row.title} herunterladen`}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Herunterladen
                    </Button>
                  )}
                  {row.canDelete &&
                    (row.kind === "receipt" || canUploadDocuments) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setDeleteId(row.id)}
                        aria-label={`${row.title} löschen`}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Löschen
                      </Button>
                    )}
                </div>
                {deleteId === row.id && (
                  <div className="space-y-2 border-t pt-2">
                    <p className="text-sm">Diese Datei endgültig löschen?</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setDeleteId(null)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !row.canDelete ||
                            (row.kind === "document" && !canUploadDocuments)
                          )
                            return;
                          void run(`remove:${row.id}`, async () => {
                            await remove.mutateAsync({ area, id: row.id });
                            setDeleteId(null);
                            await list.refetch();
                          });
                        }}
                      >
                        Datei löschen
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        {drafts.drafts.length > 0 && (
          <section className="space-y-2 rounded-md border bg-slate-50 p-3">
            <h3 className="text-sm font-semibold">
              {persisted ? "Noch nicht hochgeladen" : "Vorgemerkte Dateien"}
            </h3>
            <ul className="space-y-3">
              {drafts.drafts.map(draft => (
                <li key={draft.localId} className="space-y-1">
                  <p className="break-words text-sm font-medium">
                    {draft.title}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {draft.file.name}
                    {draft.paidByLabel
                      ? ` · Bezahlt von: ${draft.paidByLabel}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draft.status === "uploading"
                      ? "Lädt hoch …"
                      : draft.status === "failed"
                        ? "Upload fehlgeschlagen – Datei bleibt für einen neuen Versuch vorgemerkt."
                        : "Lokal vorgemerkt"}
                  </p>
                  {draft.error && (
                    <p
                      role="alert"
                      className="break-words text-sm text-destructive"
                    >
                      {draft.error}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => drafts.discard(draft.localId)}
                  >
                    Vormerkung verwerfen
                  </Button>
                </li>
              ))}
            </ul>
            {persisted && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run("retry", async () => {
                    await drafts.flush(taskId!);
                  })
                }
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {busy ? "Lädt hoch …" : "Ausstehende Uploads erneut versuchen"}
              </Button>
            )}
          </section>
        )}
        <form
          className="space-y-3 border-t pt-4"
          onSubmit={event => {
            event.preventDefault();
            submit();
          }}
        >
          <h3 className="text-sm font-semibold">Datei hinzufügen</h3>
          <div className="space-y-1.5">
            <Label htmlFor={`task-document-kind-${area}`}>Art</Label>
            <select
              id={`task-document-kind-${area}`}
              value={effectiveKind}
              disabled={busy || !canUpload}
              onChange={event =>
                changeKind(event.target.value as TaskDocumentKind)
              }
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base"
            >
              <option value="document" disabled={!canUploadDocuments}>
                Dokument
              </option>
              <option value="receipt" disabled={!canUploadReceipts}>
                Beleg / Rechnung
              </option>
            </select>
            {persisted && response && !canUploadDocuments && (
              <p className="text-xs text-muted-foreground">
                Dokumente ansehen und Belege / Rechnungen hochladen ist möglich.
                Allgemeine Dokumente ändern dürfen nur Personen mit
                Aufgaben-Schreibrecht.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`task-document-title-${area}`}>Bezeichnung</Label>
            <Input
              id={`task-document-title-${area}`}
              value={title}
              maxLength={160}
              required
              disabled={busy || !canUpload}
              onChange={event => setTitle(event.target.value)}
              className="text-base"
            />
          </div>
          {effectiveKind === "receipt" && (
            <div className="space-y-1.5">
              <Label htmlFor={`task-document-payer-${area}`}>Bezahlt von</Label>
              {response?.receiptIdentityNotice && (
                <p className="text-xs leading-5 text-muted-foreground">
                  {response.receiptIdentityNotice}
                </p>
              )}
              <select
                id={`task-document-payer-${area}`}
                value={paidByKey}
                required
                disabled={
                  busy ||
                  !canUpload ||
                  payers.isLoading ||
                  Boolean(payers.error)
                }
                onChange={event => setPaidByKey(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base"
              >
                <option value="">Person auswählen …</option>
                {people.map(person => (
                  <option key={person.key} value={person.key}>
                    {taskDocumentPayerLabel(person, people)}
                  </option>
                ))}
              </select>
              {payers.isLoading && (
                <p role="status" className="text-xs text-muted-foreground">
                  Personen werden geladen …
                </p>
              )}
              {payers.error && (
                <div className="space-y-2">
                  <p
                    role="alert"
                    className="break-words text-sm text-destructive"
                  >
                    Personenauswahl konnte nicht geladen werden:{" "}
                    {payers.error.message}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || payers.isFetching}
                    onClick={() =>
                      void run("payers", async () => {
                        await payers.refetch();
                      })
                    }
                  >
                    Personen erneut laden
                  </Button>
                </div>
              )}
              {!payers.isLoading && !payers.error && !people.length && (
                <p className="text-xs text-muted-foreground">
                  Noch keine bekannte zahlende Person vorhanden. Bitte zuerst
                  einen Helfer oder Kontakt anlegen lassen.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`task-document-file-${area}`}>
              {effectiveKind === "receipt"
                ? "PDF-Datei"
                : "PDF-, JPEG- oder Word-Datei"}{" "}
              (max. 5 MiB)
            </Label>
            <Input
              ref={fileInput}
              id={`task-document-file-${area}`}
              type="file"
              required
              disabled={busy || !canUpload}
              accept={
                effectiveKind === "receipt"
                  ? ".pdf,application/pdf"
                  : TASK_DOCUMENT_ACCEPT
              }
              className="h-auto min-h-11 text-sm"
              onChange={event => {
                const files = event.target.files;
                const selected = files?.[0] ?? null;
                const validation =
                  files && files.length > 1
                    ? "Bitte genau eine Datei je Eintrag auswählen."
                    : selected
                      ? taskDocumentSelectionError(effectiveKind, selected)
                      : null;
                setError(validation);
                setFile(validation ? null : selected);
                if (validation) event.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              Weitere Dateien können anschließend mit eigener Bezeichnung
              hinzugefügt werden. Word-Dateien werden heruntergeladen.
            </p>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={
              busy ||
              !canUpload ||
              !title.trim() ||
              !file ||
              (effectiveKind === "receipt" &&
                !people.some(person => person.key === paidByKey))
            }
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {action === "upload"
              ? "Wird vorbereitet …"
              : persisted
                ? "Datei hochladen"
                : "Datei vormerken"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="break-words text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!requestInFlight.current && !drafts.busy) onClose();
            }}
          >
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
