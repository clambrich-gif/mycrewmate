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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  FileJson2,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ACTIVE_EXCEL_IMPORT_AREAS } from "@shared/excel-import-areas";

const IMPORT_AREAS = ACTIVE_EXCEL_IMPORT_AREAS;

type ImportArea = (typeof IMPORT_AREAS)[number]["id"];
type ExcelImportSelection = ImportArea | "FULL";

const readBase64 = (file: File, errorMessage: string) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(errorMessage));
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

function ActionCard({
  icon: Icon,
  title,
  description,
  tone,
  disabled = false,
  pending = false,
  onClick,
}: {
  icon: typeof FileJson2;
  title: string;
  description: string;
  tone: "blue" | "emerald" | "amber";
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-950 hover:border-blue-300 hover:bg-blue-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300 hover:bg-amber-100",
  }[tone];
  const iconClass = {
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={onClick}
      className={`min-h-36 rounded-lg border p-4 text-left shadow-sm transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        {pending ? (
          <Loader2 className={`mt-0.5 h-5 w-5 shrink-0 animate-spin ${iconClass}`} />
        ) : (
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
        )}
        <div>
          <p className="font-semibold leading-5">{title}</p>
          <p className="mt-1 text-sm leading-5 opacity-80">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function SaveLoadControls({
  onAction,
}: {
  onAction?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [jsonFile, setJsonFile] = useState<{ name: string; base64: string } | null>(
    null
  );
  const [excelFile, setExcelFile] = useState<{
    name: string;
    base64: string;
    selection: ExcelImportSelection;
  } | null>(null);
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  const [excelPreviewOpen, setExcelPreviewOpen] = useState(false);
  const [jsonPasswordOpen, setJsonPasswordOpen] = useState(false);
  const [excelPasswordOpen, setExcelPasswordOpen] = useState(false);
  const [selectedImportArea, setSelectedImportArea] =
    useState<ExcelImportSelection | null>(null);
  const [filter, setFilter] = useState<ChangeFilter>("all");

  const jsonSave = trpc.projectFile.save.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const excelSave = trpc.excel.exportFile.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const jsonPreview = trpc.projectFile.preview.useMutation({
    onSuccess: () => {
      setFilter("all");
      setJsonPreviewOpen(true);
    },
    onError: error => toast.error(error.message),
  });
  const jsonLoad = trpc.projectFile.load.useMutation({
    onSuccess: result => {
      setJsonPasswordOpen(false);
      setJsonPreviewOpen(false);
      toast.success(
        `Projektstand geladen: ${result.created} neu, ${result.updated} geändert, ${result.deleted} gelöscht`
      );
      window.setTimeout(() => window.location.reload(), 500);
    },
    onError: error => toast.error(error.message),
  });
  const excelPreview = trpc.excel.previewModule.useMutation({
    onSuccess: result => {
      if (!result.changes.length) {
        toast.info("Für den ausgewählten Bereich wurden keine Änderungen erkannt");
        return;
      }
      setFilter("all");
      setExcelPreviewOpen(true);
    },
    onError: error => toast.error(error.message),
  });
  const fullExcelPreview = trpc.excel.previewFull.useMutation({
    onSuccess: result => {
      if (!result.changes.length) {
        toast.info("Die vollständige Excel-Datei enthält keine Änderungen");
        return;
      }
      setFilter("all");
      setExcelPreviewOpen(true);
    },
    onError: error => toast.error(error.message, { duration: 10_000 }),
  });
  const excelLoad = trpc.excel.applyModule.useMutation({
    onSuccess: result => {
      setExcelPasswordOpen(false);
      setExcelPreviewOpen(false);
      toast.success(
        `Excel-Daten importiert: ${result.created} neu, ${result.updated} geändert, ${result.deleted} gelöscht`
      );
      window.setTimeout(() => window.location.reload(), 500);
    },
    onError: error => {
      const detail = error.message || "Unbekannte Importursache";
      console.error(`[Isolierter Excel-Import] Übernahme abgebrochen: ${detail}`);
      toast.error(`Import wurde nicht übernommen: ${detail}`, { duration: 10_000 });
    },
  });
  const fullExcelLoad = trpc.excel.applyFull.useMutation({
    onSuccess: result => {
      setExcelPasswordOpen(false);
      setExcelPreviewOpen(false);
      toast.success(
        `Vollständiger Excel-Import abgeschlossen: ${result.created} neu, ${result.updated} geändert, ${result.deleted} gelöscht`
      );
      window.setTimeout(() => window.location.reload(), 500);
    },
    onError: error => {
      const detail = error.message || "Unbekannte Importursache";
      console.error(`[Vollständiger Excel-Import] Übernahme abgebrochen: ${detail}`);
      toast.error(`Vollständiger Import wurde nicht übernommen: ${detail}`, {
        duration: 10_000,
      });
    },
  });

  const totals = jsonPreview.data?.totals ?? {
    created: 0,
    updated: 0,
    deleted: 0,
  };
  const excelTotals = excelPreview.data?.totals ?? {
    created: 0,
    updated: 0,
    deleted: 0,
  };
  const fullExcelTotals = fullExcelPreview.data?.totals ?? {
    created: 0,
    updated: 0,
    deleted: 0,
  };
  const isFullExcelImport = excelFile?.selection === "FULL";
  const jsonHasChanges = Boolean(jsonPreview.data?.changes.length);

  const downloadJson = async () => {
    const result = await jsonSave.refetch();
    if (!result.data) {
      toast.error(result.error?.message ?? "Speicherdatei konnte nicht erstellt werden");
      return;
    }
    downloadBase64File(
      result.data.base64,
      "application/json",
      `RSC-Projekt_${safeDownloadName(result.data.eventName)}_${result.data.exportedAt.slice(0, 10)}.rscplanung.json`
    );
    setSaveDialogOpen(false);
    toast.success("JSON-Speicherstand wurde heruntergeladen");
  };

  const downloadExcel = async () => {
    const result = await excelSave.refetch();
    if (!result.data) {
      toast.error(result.error?.message ?? "Excel-Datei konnte nicht erstellt werden");
      return;
    }
    downloadBase64File(
      result.data.base64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `RSC-Projektuebersicht_${safeDownloadName(result.data.eventName)}_${result.data.exportedAt.slice(0, 10)}.xlsx`
    );
    setSaveDialogOpen(false);
    toast.success("Komplette Excel-Projektübersicht wurde heruntergeladen");
  };

  const chooseJsonFile = () => {
    onAction?.();
    if (!isAdmin) {
      toast.error("Nur Administratoren dürfen einen Projektstand laden");
      return;
    }
    jsonInputRef.current?.click();
  };

  const chooseExcelFile = () => {
    onAction?.();
    if (!isAdmin) {
      toast.error("Nur Administratoren dürfen Excel-Daten importieren");
      return;
    }
    if (!selectedImportArea) {
      toast.error("Bitte einen Einzelbereich oder „Vollständig“ auswählen");
      return;
    }
    excelInputRef.current?.click();
  };

  const jsonFileSelected = async (selected: File | undefined) => {
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
      const base64 = await readBase64(selected, "Datei konnte nicht gelesen werden");
      setJsonFile({ name: selected.name, base64 });
      setLoadDialogOpen(false);
      jsonPreview.mutate({ base64 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Datei konnte nicht gelesen werden");
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  };

  const excelFileSelected = async (selected: File | undefined) => {
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
      const base64 = await readBase64(selected, "Excel-Datei konnte nicht gelesen werden");
      if (!selectedImportArea) return;
      const selection = selectedImportArea;
      setExcelFile({ name: selected.name, base64, selection });
      setLoadDialogOpen(false);
      if (selection === "FULL") {
        fullExcelPreview.mutate({ base64 });
      } else {
        excelPreview.mutate({ base64, area: selection });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Excel-Datei konnte nicht gelesen werden"
      );
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={jsonInputRef}
        type="file"
        className="hidden"
        accept=".json,.rscplanung,application/json"
        onChange={event => void jsonFileSelected(event.target.files?.[0])}
      />
      <input
        ref={excelInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={event => void excelFileSelected(event.target.files?.[0])}
      />
      <div className="grid grid-cols-2 gap-2" aria-label="Projekt speichern und laden">
        <Button
          type="button"
          variant="outline"
          className="min-w-0 bg-white px-2 dark:bg-slate-950"
          onClick={() => {
            onAction?.();
            setSaveDialogOpen(true);
          }}
        >
          <Save className="mr-1.5 h-4 w-4" />
          Speichern
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-0 border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
          disabled={!isAdmin}
          title={isAdmin ? "Projektstand oder Excel-Daten laden" : "Nur für Administratoren"}
          onClick={() => {
            onAction?.();
            setLoadDialogOpen(true);
          }}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          Laden
        </Button>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-xl sm:max-w-[620px]">
          <DialogHeader className="px-6 pb-3 pt-6 text-left">
            <DialogTitle>Projektstand speichern</DialogTitle>
            <DialogDescription>
              Wähle das Format für die aktuelle Veranstaltung. Beide Dateien werden lokal heruntergeladen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 px-6 pb-5 sm:grid-cols-2">
            <ActionCard
              icon={FileJson2}
              title="JSON-Speicherstand herunterladen"
              description="Klassische Komplett-Sicherung zum späteren vollständigen Wiederherstellen."
              tone="blue"
              pending={jsonSave.isFetching}
              onClick={() => void downloadJson()}
            />
            <ActionCard
              icon={FileSpreadsheet}
              title="Komplette Excel-Projektübersicht exportieren"
              description="Alle Arbeitsblätter der Planung als Excel-Datei für Übersicht und Dokumentation."
              tone="emerald"
              pending={excelSave.isFetching}
              onClick={() => void downloadExcel()}
            />
          </div>
          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4 sm:justify-end">
            <Button variant="outline" className="bg-white" onClick={() => setSaveDialogOpen(false)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-xl sm:max-w-[680px]">
          <DialogHeader className="px-6 pb-3 pt-6 text-left">
            <DialogTitle>Projektstand laden</DialogTitle>
            <DialogDescription>
              Wähle aus, ob eine vollständige Sicherung oder gezielt Excel-Daten eingelesen werden sollen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 px-6 pb-4 sm:grid-cols-2">
            <ActionCard
              icon={FolderOpen}
              title="JSON-Speicherstand laden"
              description="Ersetzt nach Prüfung die gesamte Planung der ausgewählten Veranstaltung."
              tone="blue"
              pending={jsonPreview.isPending}
              onClick={chooseJsonFile}
            />
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold leading-5">Excel-Daten importieren</p>
                  <p className="mt-1 text-sm leading-5 text-amber-950/80">
                    Einzelne Bereiche gezielt oder die vollständige Excel-Datei kontrolliert übernehmen.
                  </p>
                </div>
              </div>
              <RadioGroup
                value={selectedImportArea ?? undefined}
                onValueChange={value =>
                  setSelectedImportArea(value as ExcelImportSelection)
                }
                aria-label="Excel-Importbereich auswählen"
                className="mt-4 grid gap-2 sm:grid-cols-2"
              >
                {IMPORT_AREAS.map(area => {
                  const selected = selectedImportArea === area.id;
                  return (
                    <label
                      key={area.id}
                      htmlFor={`central-import-${area.id}`}
                      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-medium transition-colors ${selected ? "border-amber-400 bg-amber-100 shadow-sm" : "border-amber-200 bg-white/80 hover:bg-white"}`}
                    >
                      <RadioGroupItem
                        id={`central-import-${area.id}`}
                        value={area.id}
                      />
                      <span>{area.label}</span>
                    </label>
                  );
                })}
                <label
                  htmlFor="central-import-full"
                  title="Alle Bereiche werden nach erfolgreicher Gesamtprüfung automatisch importiert."
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border-2 px-2.5 py-2 text-sm font-semibold transition-colors ${selectedImportArea === "FULL" ? "border-red-600 bg-red-50 text-red-950 shadow-sm" : "border-red-400 bg-white/90 text-red-950 hover:bg-red-50"}`}
                >
                  <RadioGroupItem id="central-import-full" value="FULL" />
                  <span>Vollständig</span>
                </label>
              </RadioGroup>
              <Button
                type="button"
                className="mt-4 w-full border border-amber-300 bg-amber-600 text-white shadow-sm hover:bg-amber-700 hover:text-white"
                disabled={
                  !selectedImportArea ||
                  excelPreview.isPending ||
                  fullExcelPreview.isPending
                }
                onClick={chooseExcelFile}
              >
                {excelPreview.isPending || fullExcelPreview.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Excel-Datei wählen &amp; prüfen
              </Button>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4 sm:justify-end">
            <Button variant="outline" className="bg-white" onClick={() => setLoadDialogOpen(false)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={jsonPreviewOpen} onOpenChange={setJsonPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson2 className="h-5 w-5" /> JSON-Speicherstand laden
            </DialogTitle>
            <DialogDescription>
              Datei: {jsonFile?.name}. Es werden alle geprüften Änderungen vollständig oder gar nicht übernommen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"><div className="text-2xl font-bold">{totals.created}</div><div className="text-xs font-medium">Neue Einträge</div></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><div className="text-2xl font-bold">{totals.updated}</div><div className="text-xs font-medium">Geänderte Einträge</div></div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900"><div className="text-2xl font-bold">{totals.deleted}</div><div className="text-xs font-medium">Gelöschte Einträge</div></div>
          </div>
          {jsonHasChanges ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950"><strong>Vollständiger Ersatz:</strong> Beim Laden werden alle aktuellen Planungsdaten dieser Veranstaltung zurückgesetzt und aus der JSON-Datei neu aufgebaut.</div> : <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><strong>Speicherdatei erfolgreich geprüft:</strong> Dieser Projektstand entspricht bereits vollständig dem aktuell geladenen Stand.</div>}
          {jsonHasChanges && <ChangeFilterBar value={filter} onChange={setFilter} counts={totals} />}
          {!!jsonPreview.data?.warnings.length && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Hinweise zur Speicherdatei:</strong><ul className="mt-1 list-disc space-y-1 pl-5">{jsonPreview.data.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
          {jsonHasChanges && <GroupedChangeList changes={jsonPreview.data?.changes ?? []} filter={filter} />}
          <DialogFooter className="sticky bottom-0 -mx-2 -mb-2 border-t bg-white px-2 pb-2 pt-4">
            <Button variant="outline" onClick={() => setJsonPreviewOpen(false)}>{jsonHasChanges ? "Abbrechen" : "Schließen"}</Button>
            {jsonHasChanges && <Button className="border border-emerald-300 !bg-emerald-700 !text-white shadow-md hover:!bg-emerald-800" onClick={() => setJsonPasswordOpen(true)}><Upload className="mr-2 h-4 w-4" />Alle Änderungen laden</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excelPreviewOpen} onOpenChange={setExcelPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Excel-Daten importieren</DialogTitle>
            <DialogDescription>
              Datei: {excelFile?.name}. {isFullExcelImport ? "Alle Bereiche wurden gemeinsam geprüft." : `Geprüft wird nur: ${excelPreview.data?.areaName ?? "der ausgewählte Bereich"}.`}
            </DialogDescription>
          </DialogHeader>
          {isFullExcelImport ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">
              <strong>Vollständiger Import:</strong> Alle Bereiche werden sequenziell und gemeinsam atomar übernommen. Bei einem Fehler bleibt der bisherige Projektstand vollständig erhalten.
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {fullExcelPreview.data?.steps.map(step => (
                  <div key={step.area} className="flex items-center justify-between gap-2 rounded-md border border-red-100 bg-white/80 px-2.5 py-1.5">
                    <span className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{step.label}</span>
                    <span className="text-xs text-slate-600">{step.changes} Änderung{step.changes === 1 ? "" : "en"} geprüft</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 rounded-md border border-red-100 bg-white/80 px-2.5 py-1.5 sm:col-span-2">
                  <span className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Abschließende Einsatzplanprüfung</span>
                  <span className="text-xs text-slate-600">Referenzen werden vor der Übernahme geprüft</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><strong>Isolierter Import:</strong> Nur der ausgewählte Bereich wird übernommen. Abhängige Einsatzzuweisungen werden weiterhin sicher geprüft.<div className="mt-1 font-semibold">Bereichsprüfung: {excelPreview.data?.rowsChecked ?? 0} Datenzeilen geprüft.</div></div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"><div className="text-2xl font-bold">{isFullExcelImport ? fullExcelTotals.created : excelTotals.created}</div><div className="text-xs font-medium">Neue Einträge</div></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><div className="text-2xl font-bold">{isFullExcelImport ? fullExcelTotals.updated : excelTotals.updated}</div><div className="text-xs font-medium">Geänderte Einträge</div></div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900"><div className="text-2xl font-bold">{isFullExcelImport ? fullExcelTotals.deleted : excelTotals.deleted}</div><div className="text-xs font-medium">Gelöschte Einträge</div></div>
          </div>
          <ChangeFilterBar value={filter} onChange={setFilter} counts={isFullExcelImport ? fullExcelTotals : excelTotals} createLabel="Nur neue Daten" />
          {!!(isFullExcelImport ? fullExcelPreview.data?.warnings : excelPreview.data?.warnings)?.length && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Hinweise vor dem Import:</strong><ul className="mt-1 list-disc space-y-1 pl-5">{(isFullExcelImport ? fullExcelPreview.data?.warnings : excelPreview.data?.warnings)?.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
          <GroupedChangeList changes={isFullExcelImport ? fullExcelPreview.data?.changes ?? [] : excelPreview.data?.changes ?? []} filter={filter} />
          <DialogFooter className="sticky bottom-0 -mx-2 -mb-2 border-t bg-white px-2 pb-2 pt-4">
            <Button variant="outline" onClick={() => setExcelPreviewOpen(false)}>Abbrechen</Button>
            <Button className="border border-emerald-300 !bg-emerald-700 !text-white shadow-md hover:!bg-emerald-800" onClick={() => setExcelPasswordOpen(true)}><Upload className="mr-2 h-4 w-4" />Alle {(isFullExcelImport ? fullExcelTotals : excelTotals).created + (isFullExcelImport ? fullExcelTotals : excelTotals).updated + (isFullExcelImport ? fullExcelTotals : excelTotals).deleted} Änderungen übernehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPasswordDialog
        open={jsonPasswordOpen}
        onOpenChange={setJsonPasswordOpen}
        title="Projektstand laden"
        description={`Speicherstand vom ${formatBackupTimestamp(jsonPreview.data?.metadata.exportedAt)}. Achtung: Durch das Laden werden alle Änderungen und Online-Eingaben überschrieben, die seit dieser Speicherung vorgenommen wurden.`}
        confirmLabel="Laden"
        destructive={false}
        busy={jsonLoad.isPending}
        onConfirm={adminPassword => {
          if (!jsonFile || !jsonPreview.data) return;
          jsonLoad.mutate({ base64: jsonFile.base64, filename: jsonFile.name, currentDigest: jsonPreview.data.currentDigest, previewBinding: jsonPreview.data.previewBinding, adminPassword });
        }}
      />
      <AdminPasswordDialog
        open={excelPasswordOpen}
        onOpenChange={setExcelPasswordOpen}
        title={isFullExcelImport ? "Vollständigen Excel-Import verbindlich übernehmen" : "Excel-Daten verbindlich importieren"}
        description={isFullExcelImport ? "Alle vollständig geprüften Bereiche werden automatisch in fester Reihenfolge und als eine atomare Übernahme importiert sowie protokolliert." : "Alle geprüften Änderungen des ausgewählten Bereichs werden atomar übernommen sowie protokolliert."}
        confirmLabel="Import übernehmen"
        destructive={false}
        busy={excelLoad.isPending || fullExcelLoad.isPending}
        onConfirm={adminPassword => {
          if (!excelFile) return;
          if (excelFile.selection === "FULL") {
            if (!fullExcelPreview.data) return;
            fullExcelLoad.mutate({ base64: excelFile.base64, filename: excelFile.name, currentDigest: fullExcelPreview.data.currentDigest, previewBinding: fullExcelPreview.data.previewBinding, adminPassword });
            return;
          }
          if (!excelPreview.data) return;
          excelLoad.mutate({ area: excelFile.selection, base64: excelFile.base64, filename: excelFile.name, currentDigest: excelPreview.data.currentDigest, previewBinding: excelPreview.data.previewBinding, adminPassword });
        }}
      />
    </>
  );
}
