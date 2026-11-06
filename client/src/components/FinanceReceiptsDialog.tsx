import type { FinanceCategory } from "@/components/FinanceCategoryDialog";
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
import { productAllowsCapability } from "@shared/product-packages";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const MAX_FINANCE_PDF_BYTES = 5 * 1024 * 1024;

export function financePdfSelectionError(
  file: Pick<File, "name" | "size" | "type">
): string | null {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type &&
      file.type !== "application/pdf" &&
      file.type !== "application/octet-stream")
  ) {
    return "Bitte genau eine PDF-Datei auswählen.";
  }
  if (file.name.length > 200)
    return "Bitte den PDF-Dateinamen auf höchstens 200 Zeichen kürzen.";
  if (!file.size) return "Die ausgewählte PDF-Datei ist leer.";
  if (file.size > MAX_FINANCE_PDF_BYTES)
    return "Die PDF-Datei darf höchstens 5 MiB groß sein.";
  return null;
}

async function financePdfBase64(file: File): Promise<string> {
  const error = financePdfSelectionError(file);
  if (error) throw new Error(error);
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (header !== "%PDF-")
    throw new Error("Die Datei enthält keinen gültigen PDF-Dateikopf.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Die PDF-Datei konnte nicht gelesen werden."));
    reader.onabort = () =>
      reject(new Error("Das Lesen der PDF-Datei wurde abgebrochen."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(",")) {
        reject(new Error("Die PDF-Datei konnte nicht gelesen werden."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** Files stay local to the browser download; no data URLs or permanent object URLs. */
export function downloadFinanceFile(
  file: { fileName: string; base64: string },
  mimeType: string
) {
  const binary = atob(file.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = file.fileName.replace(/[\\/]/g, "-");
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Let the browser begin consuming the Blob before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

export const FINANCE_RECEIPT_BACKUP_HINT =
  "Excel- und JSON-Exporte enthalten keine PDF-Dateien. Die ZIP-Sicherung enthält die Original-PDFs und eine Belegübersicht. Das ZIP ist ein separates Belegarchiv und keine Datei für den normalen JSON-Import.";

export function FinanceReceiptBackupButton({
  canWrite,
  financeId,
}: {
  canWrite: boolean;
  financeId?: number;
}) {
  const { data: tenantProduct } = trpc.tenantProduct.current.useQuery();
  const allowsDocuments = productAllowsCapability(
    tenantProduct?.packageId ?? "event_pass", "document_attachments"
  );
  const access = useRef(canWrite && allowsDocuments);
  access.current = canWrite && allowsDocuments;
  useEffect(() => {
    access.current = canWrite && allowsDocuments;
    return () => { access.current = false; };
  }, [canWrite, allowsDocuments]);
  const exportReceipts = trpc.finances.exportReceipts.useMutation();
  const requestInFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backup = async () => {
    if (!access.current || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const file = await exportReceipts.mutateAsync(
        financeId === undefined ? {} : { financeId }
      );
      if (!access.current) return;
      downloadFinanceFile(file, "application/zip");
      toast.success("ZIP-Sicherung heruntergeladen");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Belege konnten nicht gesichert werden."
      );
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };
  if (!canWrite || !allowsDocuments) return null;
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-auto min-h-9 whitespace-normal"
        disabled={busy}
        onClick={() => void backup()}
      >
        <Download className="mr-1.5 h-4 w-4 shrink-0" />
        {busy ? "Sichert …" : "Belege sichern (ZIP)"}
      </Button>
      {error && (
        <p
          role="alert"
          className="max-w-lg break-words text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Mounted only for finance WRITE users; read-only users never query metadata or payers. */
export function FinanceReceiptsDialog({
  row,
  canWrite,
  onClose,
}: {
  row: FinanceCategory;
  canWrite: boolean;
  onClose: () => void;
}) {
  const { data: tenantProduct } = trpc.tenantProduct.current.useQuery();
  const allowsDocuments = productAllowsCapability(
    tenantProduct?.packageId ?? "event_pass", "document_attachments"
  );
  const access = useRef(canWrite && allowsDocuments);
  access.current = canWrite && allowsDocuments;
  useEffect(() => {
    access.current = canWrite && allowsDocuments;
    return () => { access.current = false; };
  }, [canWrite, allowsDocuments]);
  const utils = trpc.useUtils();
  const input = useMemo(() => ({ financeId: row.id }), [row.id]);
  const receipts = trpc.finances.receipts.useQuery(input, {
    enabled: canWrite && allowsDocuments,
    retry: false,
  });
  const payers = trpc.finances.payers.useQuery(undefined, {
    enabled: canWrite && allowsDocuments,
    retry: false,
  });
  const upload = trpc.finances.uploadReceipt.useMutation();
  const download = trpc.finances.downloadReceipt.useMutation();
  const remove = trpc.finances.removeReceipt.useMutation();
  const [title, setTitle] = useState("");
  const [payerChoice, setPayerChoice] = useState("");
  const [externalPayer, setExternalPayer] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const paidBy =
    payerChoice === "external"
      ? externalPayer.trim()
      : payerChoice.startsWith("person:")
        ? payerChoice.slice(7)
        : "";
  const names = Array.from(
    new Set((payers.data ?? []).filter(name => name.trim()))
  );

  const run = async (label: string, operation: () => Promise<void>) => {
    if (!access.current || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(label);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Aktion konnte nicht ausgeführt werden."
      );
    } finally {
      requestInFlight.current = false;
      setBusy(null);
    }
  };

  const submitUpload = () => {
    if (!access.current) return;
    if (!title.trim() || !paidBy || !pdf) {
      setError(
        "Bitte Bezeichnung, den Namen der zahlenden Person und genau eine PDF-Datei angeben."
      );
      return;
    }
    void run("upload", async () => {
      const pdfBase64 = await financePdfBase64(pdf);
      if (!access.current) return;
      await upload.mutateAsync({
        financeId: row.id,
        title: title.trim(),
        paidBy,
        fileName: pdf.name,
        pdfBase64,
      });
      if (!access.current) return;
      setTitle("");
      setPayerChoice("");
      setExternalPayer("");
      setPdf(null);
      if (fileInput.current) fileInput.current.value = "";
      await utils.finances.receipts.invalidate(input);
      toast.success("PDF-Beleg hinzugefügt");
    });
  };

  if (!canWrite || !allowsDocuments) return null;
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !requestInFlight.current) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="break-words">
            Belege: {row.category}
          </DialogTitle>
          <DialogDescription>
            Pro Beleg genau eine PDF-Datei. Belege verändern Einnahmen und
            Ausgaben nicht.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Vorhandene Belege</h3>
          {receipts.isLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Belege werden geladen …
            </p>
          )}
          {receipts.error && (
            <div className="space-y-2">
              <p role="alert" className="break-words text-sm text-destructive">
                {receipts.error.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={receipts.isFetching || Boolean(busy)}
                onClick={() => void run("refresh", async () => { await receipts.refetch(); })}
              >
                Erneut laden
              </Button>
            </div>
          )}
          {!receipts.isLoading && !receipts.error && !receipts.data?.length && (
            <p className="text-sm text-muted-foreground">
              Noch keine PDF-Belege in dieser Kategorie.
            </p>
          )}
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {(receipts.data ?? []).map(receipt => (
              <li key={receipt.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-sm font-medium">
                      {receipt.title}
                    </p>
                    <p className="break-words text-sm text-muted-foreground">
                      Bezahlt von: {receipt.paidBy}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">
                      {receipt.fileName} ·{" "}
                      {(receipt.byteSize / 1024).toLocaleString("de-DE", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      KiB
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hinzugefügt:{" "}
                      {new Date(receipt.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(busy)}
                      aria-label={`PDF ${receipt.title} herunterladen`}
                      onClick={() =>
                        void run(`download:${receipt.id}`, async () => {
                          const file = await download.mutateAsync({
                            id: receipt.id,
                          });
                          if (!access.current) return;
                          downloadFinanceFile(file, "application/pdf");
                        })
                      }
                    >
                      <Download className="h-4 w-4" />
                      <span className="ml-1.5">
                        {busy === `download:${receipt.id}` ? "Lädt …" : "PDF"}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={Boolean(busy)}
                      aria-label={`Beleg ${receipt.title} löschen`}
                      onClick={() => setDeleteId(receipt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {deleteId === receipt.id && (
                  <div className="space-y-2 border-t pt-2">
                    <p className="text-sm">
                      Diesen PDF-Beleg endgültig löschen?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(busy)}
                        onClick={() => setDeleteId(null)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run(`remove:${receipt.id}`, async () => {
                            await remove.mutateAsync({ id: receipt.id });
                            if (!access.current) return;
                            setDeleteId(null);
                            await utils.finances.receipts.invalidate(input);
                            toast.success("Beleg gelöscht");
                          })
                        }
                      >
                        {busy === `remove:${receipt.id}`
                          ? "Löscht …"
                          : "Beleg löschen"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <form
          className="space-y-3 border-t pt-4"
          onSubmit={event => {
            event.preventDefault();
            submitUpload();
          }}
        >
          <h3 className="text-sm font-semibold">Neuen PDF-Beleg hinzufügen</h3>
          <div className="space-y-1.5">
            <Label htmlFor="finance-receipt-title">Bezeichnung</Label>
            <Input
              id="finance-receipt-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={160}
              disabled={Boolean(busy)}
              required
              className="text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finance-receipt-payer">Bezahlt von</Label>
            <select
              id="finance-receipt-payer"
              value={payerChoice}
              onChange={event => setPayerChoice(event.target.value)}
              disabled={Boolean(busy)}
              required
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Person auswählen …</option>
              {names.map(name => (
                <option key={name} value={`person:${name}`}>
                  {name}
                </option>
              ))}
              <option value="external">
                Andere / externe Person (Name eingeben)
              </option>
            </select>
            <p className="text-xs text-muted-foreground">
              Personennamen aus bestehenden Kontakten und Helfern, keine
              Unternehmen.
            </p>
            {payers.isLoading && (
              <p role="status" className="text-xs text-muted-foreground">
                Personennamen werden geladen …
              </p>
            )}
            {payers.error && (
              <p role="alert" className="break-words text-xs text-destructive">
                Personenauswahl konnte nicht geladen werden:{" "}
                {payers.error.message}. Du kannst einen Namen frei eingeben.
              </p>
            )}
          </div>
          {payerChoice === "external" && (
            <div className="space-y-1.5">
              <Label htmlFor="finance-external-payer">
                Name der zahlenden Person
              </Label>
              <Input
                id="finance-external-payer"
                value={externalPayer}
                onChange={event => setExternalPayer(event.target.value)}
                maxLength={160}
                disabled={Boolean(busy)}
                required
                className="text-base"
                placeholder="Vorname Nachname"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="finance-receipt-pdf">PDF-Datei (max. 5 MiB)</Label>
            <Input
              ref={fileInput}
              id="finance-receipt-pdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={Boolean(busy)}
              required
              className="h-auto min-h-11 text-sm"
              onChange={event => {
                const files = event.target.files;
                const file = files?.[0] ?? null;
                const validationError =
                  files && files.length > 1
                    ? "Bitte genau eine PDF-Datei auswählen."
                    : file
                      ? financePdfSelectionError(file)
                      : null;
                setError(validationError);
                setPdf(validationError ? null : file);
                if (validationError) event.target.value = "";
              }}
            />
            {pdf && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="break-all">{pdf.name}</span>
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={Boolean(busy) || !title.trim() || !paidBy || !pdf}
            className="w-full sm:w-auto"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {busy === "upload" ? "Lädt hoch …" : "PDF-Beleg hinzufügen"}
          </Button>
        </form>
        <div className="space-y-2 border-t pt-4">
          <FinanceReceiptBackupButton canWrite={canWrite} financeId={row.id} />
          <p className="text-xs leading-5 text-muted-foreground">
            Sicherung für diese Kategorie. {FINANCE_RECEIPT_BACKUP_HINT}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
