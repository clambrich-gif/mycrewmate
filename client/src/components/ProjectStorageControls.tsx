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
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { Download, Loader2, Save, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () =>
      reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });

const formatBackupTimestamp = (value: string | undefined) => {
  if (!value) return "unbekanntem Zeitpunkt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unbekanntem Zeitpunkt";
  const day = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${day} um ${time} Uhr`;
};

export function ProjectStorageControls({
  onAction,
}: {
  onAction?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(
    null
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [filter, setFilter] = useState<ChangeFilter>("all");

  const save = trpc.projectFile.save.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const preview = trpc.projectFile.preview.useMutation({
    onSuccess: result => {
      setFilter("all");
      setPreviewOpen(true);
    },
    onError: error => toast.error(error.message),
  });
  const load = trpc.projectFile.load.useMutation({
    onSuccess: result => {
      setPasswordOpen(false);
      setPreviewOpen(false);
      toast.success(
        `Projektstand geladen: ${result.created} neu, ${result.updated} geändert, ${result.deleted} gelöscht`
      );
      window.setTimeout(() => window.location.reload(), 500);
    },
    onError: error => toast.error(error.message),
  });

  const saveProject = async () => {
    onAction?.();
    const result = await save.refetch();
    if (!result.data) {
      toast.error(
        result.error?.message ?? "Speicherdatei konnte nicht erstellt werden"
      );
      return;
    }
    downloadBase64File(
      result.data.base64,
      "application/json",
      `RSC-Projekt_${safeDownloadName(result.data.eventName)}_${result.data.exportedAt.slice(0, 10)}.rscplanung.json`
    );
    toast.success("Projektstand gespeichert");
  };

  const chooseFile = () => {
    onAction?.();
    if (!isAdmin) {
      toast.error("Nur Administratoren dürfen einen Projektstand laden");
      return;
    }
    inputRef.current?.click();
  };

  const fileSelected = async (selected: File | undefined) => {
    if (!selected) return;
    if (
      !selected.name.toLowerCase().endsWith(".json") &&
      !selected.name.toLowerCase().endsWith(".rscplanung")
    ) {
      toast.error("Bitte eine RSC-Projektdatei im JSON-Format auswählen");
      return;
    }
    if (selected.size === 0 || selected.size > 10_000_000) {
      toast.error("Die Projektdatei ist leer oder größer als 10 MB");
      return;
    }
    try {
      const base64 = await readBase64(selected);
      setFile({ name: selected.name, base64 });
      preview.mutate({ base64 });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Datei konnte nicht gelesen werden"
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
  const hasChanges = Boolean(preview.data?.changes.length);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".json,.rscplanung,application/json"
        onChange={event => void fileSelected(event.target.files?.[0])}
      />
      <div
        className="grid grid-cols-2 gap-2"
        aria-label="Projekt speichern und laden"
      >
        <Button
          type="button"
          variant="outline"
          className="min-w-0 bg-white px-2 dark:bg-slate-950"
          disabled={save.isFetching}
          onClick={() => void saveProject()}
        >
          {save.isFetching ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Speichern
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-0 bg-white px-2 dark:bg-slate-950"
          disabled={!isAdmin || preview.isPending}
          title={
            isAdmin
              ? "Projektstand aus JSON-Datei laden"
              : "Nur für Administratoren"
          }
          onClick={chooseFile}
        >
          {preview.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-4 w-4" />
          )}
          Laden
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
        Kompakte Projektdatei der aktuell gewählten Veranstaltung.
      </p>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Projektstand laden
            </DialogTitle>
            <DialogDescription>
              Datei: {file?.name}. Es werden alle geprüften Änderungen
              vollständig oder gar nicht übernommen.
            </DialogDescription>
          </DialogHeader>
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
          {hasChanges ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950">
              <strong>Vollständiger Ersatz:</strong> Beim Laden werden alle
              aktuellen Planungsdaten dieser Veranstaltung zurückgesetzt und
              aus der JSON-Datei neu aufgebaut. Der Vorgang erfolgt vollständig
              oder gar nicht.
            </div>
          ) : (
            <div
              className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"
              role="status"
            >
              <strong>Speicherdatei erfolgreich geprüft:</strong> Dieser
              Projektstand entspricht bereits vollständig dem aktuell geladenen
              Stand. Es sind keine Änderungen zu übernehmen.
            </div>
          )}
          {hasChanges && (
            <ChangeFilterBar
              value={filter}
              onChange={setFilter}
              counts={totals}
            />
          )}
          {!!preview.data?.warnings.length && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Hinweise zur Speicherdatei:</strong>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {preview.data.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {hasChanges && (
            <GroupedChangeList
              changes={preview.data?.changes ?? []}
              filter={filter}
            />
          )}
          <DialogFooter className="sticky bottom-0 -mx-2 -mb-2 border-t bg-white px-2 pb-2 pt-4 dark:bg-slate-950">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {hasChanges ? "Abbrechen" : "Schließen"}
            </Button>
            {hasChanges && (
              <Button
                className="border border-blue-800 !bg-blue-700 !text-white shadow-md hover:!bg-blue-800"
                onClick={() => setPasswordOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" /> Alle Änderungen laden
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title="Projektstand laden"
        description={`Speicherstand vom ${formatBackupTimestamp(preview.data?.metadata.exportedAt)}. Achtung: Durch das Laden werden alle Änderungen und Online-Eingaben überschrieben, die seit dieser Speicherung vorgenommen wurden.`}
        confirmLabel="Laden"
        destructive={false}
        busy={load.isPending}
        onConfirm={adminPassword => {
          if (!file || !preview.data) return;
          load.mutate({
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
