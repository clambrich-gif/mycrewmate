import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import {
  ChangeFilterBar,
  GroupedChangeList,
  type ChangeFilter,
} from "@/components/ChangePreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ModuleImportArea } from "../../../server/module-excel-import";

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () =>
      reject(new Error("Excel-Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });

export function ModuleExcelImportButton({
  area,
  label,
  compact = true,
}: {
  area: ModuleImportArea;
  label: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(
    null
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [filter, setFilter] = useState<ChangeFilter>("all");

  const preview = trpc.excel.previewModule.useMutation({
    onSuccess: result => {
      if (!result.changes.length) {
        toast.info(`Keine Änderungen für ${label} erkannt`);
        return;
      }
      setFilter("all");
      setPreviewOpen(true);
    },
    onError: error => toast.error(error.message),
  });
  const apply = trpc.excel.applyModule.useMutation({
    onSuccess: result => {
      setPasswordOpen(false);
      setPreviewOpen(false);
      toast.success(
        `${label} importiert: ${result.created} neu, ${result.updated} geändert, ${result.deleted} gelöscht`
      );
      window.setTimeout(() => window.location.reload(), 500);
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return null;

  const fileSelected = async (selected: File | undefined) => {
    if (!selected) return;
    if (!/\.xlsx$/i.test(selected.name)) {
      toast.error("Bitte eine Excel-Datei im aktuellen .xlsx-Format auswählen");
      return;
    }
    if (selected.size === 0 || selected.size > 15_000_000) {
      toast.error("Die Excel-Datei ist leer oder größer als 15 MB");
      return;
    }
    try {
      const base64 = await readBase64(selected);
      setFile({ name: selected.name, base64 });
      preview.mutate({ area, base64 });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Excel-Datei konnte nicht gelesen werden"
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const totals = preview.data?.totals ?? {
    created: 0,
    updated: 0,
    deleted: 0,
  };
  const createLabel = area === "HELFER" ? "Nur neue Helfer" : "Nur neue Daten";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={event => void fileSelected(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        className="border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
        disabled={preview.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {preview.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Excel importieren
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle>{label} aus Excel importieren</DialogTitle>
            <DialogDescription>
              Datei: {file?.name}. Es werden ausschließlich Daten des Bereichs „
              {label}“ geprüft. Notwendige direkte Bezüge werden automatisch
              mitgeführt.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            <strong>Wichtig:</strong> Die Filter ändern nur die Anzeige. Beim
            Bestätigen werden alle unten erkannten Änderungen dieses Bereichs
            übernommen – einschließlich in Excel gelöschter Zeilen.
            <div className="mt-1 font-semibold">
              Vollständige Excel-Prüfung: {preview.data?.rowsChecked ?? 0}{" "}
              Datenzeilen geprüft.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              <div className="text-2xl font-bold">{totals.created}</div>
              <div className="text-xs font-medium">Neue Einträge</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <div className="text-2xl font-bold">{totals.updated}</div>
              <div className="text-xs font-medium">Geänderte Einträge</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
              <div className="text-2xl font-bold">{totals.deleted}</div>
              <div className="text-xs font-medium">Gelöschte Einträge</div>
            </div>
          </div>
          <ChangeFilterBar
            value={filter}
            onChange={setFilter}
            counts={totals}
            createLabel={createLabel}
          />
          {!!preview.data?.warnings.length && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Hinweise vor dem Import:</strong>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {preview.data.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <GroupedChangeList
            changes={preview.data?.changes ?? []}
            filter={filter}
          />
          <DialogFooter className="sticky bottom-0 -mx-2 -mb-2 border-t bg-white px-2 pb-2 pt-4 dark:bg-slate-950">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Abbrechen
            </Button>
            <Button
              className="border border-emerald-300 !bg-emerald-700 !text-white shadow-md hover:!bg-emerald-800"
              onClick={() => setPasswordOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" /> Alle{" "}
              {totals.created + totals.updated + totals.deleted} Änderungen
              übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title={`${label} verbindlich importieren`}
        description="Alle geprüften Änderungen dieses Bereichs werden atomar übernommen und protokolliert."
        confirmLabel="Import übernehmen"
        destructive={false}
        busy={apply.isPending}
        onConfirm={adminPassword => {
          if (!file || !preview.data) return;
          apply.mutate({
            area,
            base64: file.base64,
            filename: file.name,
            currentDigest: preview.data.currentDigest,
            previewBinding: preview.data.previewBinding,
            adminPassword,
          });
        }}
      />
    </>
  );
}
