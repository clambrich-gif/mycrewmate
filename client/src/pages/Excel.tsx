import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEventYear } from "@/contexts/YearContext";
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  Eye,
  FileClock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  BackupChange,
  BackupRestorePreview,
} from "../../../server/excel-backup";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const actionMeta = {
  create: {
    label: "Neu",
    icon: CheckCircle2,
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  update: {
    label: "Geändert",
    icon: RefreshCw,
    badge: "border-amber-300 bg-amber-50 text-amber-800",
  },
  delete: {
    label: "Wird gelöscht",
    icon: Trash2,
    badge: "border-red-300 bg-red-50 text-red-800",
  },
} as const;

const areaLabel: Record<string, string> = {
  ANSPRECHPARTNER: "Ansprechpartner",
  HELFER: "Helfer",
  EINSATZPLAN: "Einsatzplan",
  ZUORDNUNGEN: "Helferzuordnungen",
  VORBEREITUNG: "Vorbereitung",
  NACHBEREITUNG: "Nachbereitung",
  MATERIAL: "Material",
  MARKETING: "Marketing",
  GENEHMIGUNGEN: "Genehmigungen",
  KUCHEN: "Kuchen",
  FINANZEN: "Finanzen",
};
const fieldLabel: Record<string, string> = {
  name: "Name",
  phone: "Telefon",
  email: "E-Mail",
  note: "Bemerkung",
  contactSourceId: "Ansprechpartner",
  areaContactSourceId: "Bereichsansprechpartner",
  day: "Tag",
  area: "Bereich",
  task: "Aufgabe",
  startTime: "Beginn",
  endTime: "Ende",
  needed: "Bedarf",
  status: "Status",
  income: "Einnahmen",
  expense: "Ausgaben",
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "object") return "geänderter Bezug";
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function displayChangeValue(
  change: BackupChange,
  side: "before" | "after",
  field: string
) {
  const row = change[side];
  if (!row) return "–";
  if (field === "contactSourceId")
    return displayValue(row.contactName ?? row[field]);
  if (field === "areaContactSourceId")
    return displayValue(row.areaContactName ?? row[field]);
  if (field === "helperSourceId")
    return displayValue(row.helperName ?? row[field]);
  return displayValue(row[field]);
}

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("Datei konnte nicht gelesen werden"));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red";
}) {
  const colors = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function ChangeRow({
  change,
  selected,
  onSelectedChange,
}: {
  change: BackupChange;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}) {
  const meta = actionMeta[change.action];
  const Icon = meta.icon;
  const selectable = Boolean(onSelectedChange);
  return (
    <div
      className={`grid gap-3 rounded-lg border p-3 text-sm transition-colors ${selectable ? "sm:grid-cols-[36px_150px_1fr]" : "bg-white sm:grid-cols-[150px_1fr] dark:bg-slate-950"} ${selectable && selected ? "border-sky-300 bg-sky-50/70 dark:bg-sky-950/30" : ""} ${selectable && !selected ? "bg-white opacity-65 dark:bg-slate-950" : ""}`}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={checked => onSelectedChange?.(checked === true)}
          aria-label={`${change.label} übernehmen`}
          className="mt-0.5 size-5 border-2 border-slate-500 data-[state=checked]:border-sky-700 data-[state=checked]:!bg-sky-700 data-[state=checked]:!text-white"
        />
      )}
      <Badge variant="outline" className={`h-fit w-fit ${meta.badge}`}>
        <Icon className="mr-1.5 h-3.5 w-3.5" /> {meta.label}
      </Badge>
      <div className="min-w-0">
        <div className="font-semibold break-words">{change.label}</div>
        {change.action === "update" && change.fields.length > 0 && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {change.fields.slice(0, 8).map(field => (
              <div key={field} className="break-words">
                <span className="font-medium text-foreground">
                  {fieldLabel[field] ?? field}:
                </span>{" "}
                {displayChangeValue(change, "before", field)} →{" "}
                {displayChangeValue(change, "after", field)}
              </div>
            ))}
            {change.fields.length > 8 && (
              <div>Weitere {change.fields.length - 8} Felder geändert.</div>
            )}
          </div>
        )}
        {change.action === "delete" && (
          <div className="mt-1 text-xs font-medium text-red-700">
            Die Zeile fehlt in Excel und wird deshalb aus dem Programm entfernt.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Excel() {
  const { user } = useAuth();
  const { year, eventId } = useEventYear();
  const { data: events = [] } = trpc.events.list.useQuery();
  const eventName =
    events.find(item => item.id === eventId)?.name ?? "Veranstaltung";
  const isAdmin = user?.role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [base64, setBase64] = useState("");
  const [preview, setPreview] = useState<BackupRestorePreview | null>(null);
  const [selectedChangeKeys, setSelectedChangeKeys] = useState<Set<string>>(
    new Set()
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const exportQuery = trpc.excel.exportFile.useQuery(undefined, {
    enabled: false,
  });
  const logs = trpc.excel.restoreLogs.useQuery(undefined, { enabled: isAdmin });
  const logDetail = trpc.excel.restoreLog.useQuery(
    { id: selectedLogId ?? 0 },
    { enabled: isAdmin && selectedLogId !== null }
  );

  const previewMutation = trpc.excel.previewBackup.useMutation({
    onSuccess: result => {
      setPreview(result);
      setSelectedChangeKeys(new Set(result.changes.map(change => change.key)));
      toast.success(
        "Sicherung geprüft – alle Änderungen sind unten aufgeführt"
      );
    },
    onError: error => {
      setPreview(null);
      toast.error(error.message);
    },
  });
  const restoreMutation = trpc.excel.restoreBackup.useMutation({
    onSuccess: async result => {
      setConfirmOpen(false);
      toast.success(
        `Wiederherstellung abgeschlossen: ${result.created} neu, ${result.updated} geändert, ${result.deleted} gelöscht.`
      );
      clearPreview();
      await utils.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const groupedChanges = useMemo(() => {
    const groups = new Map<string, BackupChange[]>();
    for (const change of preview?.changes ?? []) {
      const group = groups.get(change.area) ?? [];
      group.push(change);
      groups.set(change.area, group);
    }
    return Array.from(groups.entries());
  }, [preview]);
  const selectedChanges = useMemo(
    () =>
      (preview?.changes ?? []).filter(change =>
        selectedChangeKeys.has(change.key)
      ),
    [preview, selectedChangeKeys]
  );
  const selectedTotals = useMemo(
    () => ({
      created: selectedChanges.filter(change => change.action === "create")
        .length,
      updated: selectedChanges.filter(change => change.action === "update")
        .length,
      deleted: selectedChanges.filter(change => change.action === "delete")
        .length,
    }),
    [selectedChanges]
  );
  const allSelected = Boolean(
    preview?.changes.length &&
      selectedChangeKeys.size === preview.changes.length
  );
  const toggleChange = (key: string, selected: boolean) => {
    setSelectedChangeKeys(previous => {
      const next = new Set(previous);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const clearPreview = () => {
    setFilename("");
    setBase64("");
    setPreview(null);
    setSelectedChangeKeys(new Set());
    setConfirmOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File) => {
    if (file.size > 15_000_000) {
      toast.error("Excel-Datei ist größer als 15 MB");
      return;
    }
    try {
      const encoded = await readAsBase64(file);
      setFilename(file.name);
      setBase64(encoded);
      previewMutation.mutate({ base64: encoded });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Datei konnte nicht gelesen werden"
      );
    }
  };

  const onExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return;
    const date = result.data.exportedAt.slice(0, 10);
    downloadBase64File(
      result.data.base64,
      EXCEL_MIME,
      `${safeDownloadName(result.data.eventName)}_Datensicherung_${year}_${date}.xlsx`
    );
    toast.success("Aktuelle Excel-Datensicherung wurde erstellt");
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Excel-Datensicherung</h1>
        <p className="text-muted-foreground">
          Der Export enthält den aktuellen vollständigen Stand von {eventName}{" "}
          im Jahr {year}. Beim Wiederherstellen gilt die Excel-Datei als
          Sollstand.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-5 w-5 text-primary" /> 1. Aktuellen
            Stand sichern
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Laden Sie zuerst eine aktuelle Sicherung herunter. Sie enthält alle
            Ansprechpartner, Helfer, Schichten, Zuordnungen sowie Vor- und
            Nachbereitung, Material, Marketing, Genehmigungen, Kuchen und
            Finanzen. Technische ID-Spalten sind ausgeblendet und dürfen nicht
            gelöscht werden; bei neuen Zeilen bleibt die ID leer.
          </p>
          <Button
            onClick={onExport}
            disabled={exportQuery.isFetching}
            size="lg"
          >
            <Download className="mr-2 h-4 w-4" />
            {exportQuery.isFetching
              ? "Sicherung wird erstellt …"
              : "Aktuelle Excel-Sicherung herunterladen"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-5 w-5" /> 2. Bearbeitete Sicherung prüfen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Wichtig: Gelöschte Excel-Zeilen werden auch im Programm gelöscht.
            </div>
            <p className="mt-1">
              Vor dem Speichern werden alle Anlagen, Änderungen und Löschungen
              angezeigt. Doppelbelegungen, ungültige Zeiten, doppelte Namen und
              Dateien einer anderen Veranstaltung werden blockiert.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!isAdmin || previewMutation.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {previewMutation.isPending
                ? "Datei wird geprüft …"
                : "Bearbeitete Sicherung auswählen"}
            </Button>
            {preview && (
              <Button variant="ghost" onClick={clearPreview}>
                <RefreshCw className="mr-2 h-4 w-4" /> Andere Datei
              </Button>
            )}
          </div>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              Das Planungsteam kann Datensicherungen exportieren. Prüfung und
              Wiederherstellung sind ausschließlich Administratoren erlaubt.
            </p>
          )}
          {filename && <p className="text-sm font-medium">Datei: {filename}</p>}
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Neue Einträge"
              value={preview.totals.created}
              tone="green"
            />
            <SummaryCard
              label="Geänderte Einträge"
              value={preview.totals.updated}
              tone="amber"
            />
            <SummaryCard
              label="Zu löschende Einträge"
              value={preview.totals.deleted}
              tone="red"
            />
          </div>

          {preview.warnings.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Hinweise der Prüfung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {preview.warnings.map(message => (
                  <p key={message}>• {message}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5" /> Vollständige Änderungsvorschau
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sicherung vom {formatDate(preview.metadata.exportedAt)} für{" "}
                {preview.metadata.eventName}.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedChanges.length === 0 ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-900">
                  Die Excel-Datei entspricht bereits exakt dem aktuellen Stand.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border-2 border-sky-300 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex cursor-pointer items-center gap-3 font-semibold text-sky-950">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={checked =>
                          setSelectedChangeKeys(
                            checked === true
                              ? new Set(
                                  preview.changes.map(change => change.key)
                                )
                              : new Set()
                          )
                        }
                        className="size-6 border-2 border-sky-700 data-[state=checked]:!bg-sky-700 data-[state=checked]:!text-white"
                      />
                      Alle Änderungen übernehmen
                    </label>
                    <div className="text-sm font-semibold text-sky-900">
                      {selectedChangeKeys.size} von {preview.changes.length}{" "}
                      ausgewählt
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Standardmäßig sind alle Änderungen ausgewählt – auch neu
                    angelegte oder in Excel gelöschte Helfer. Entfernen Sie nur
                    dann einen Haken, wenn diese einzelne Änderung nicht
                    übernommen werden soll.
                  </p>
                  {groupedChanges.map(([area, changes]) => (
                    <details
                      key={area}
                      open
                      className="rounded-xl border bg-muted/20"
                    >
                      <summary className="cursor-pointer select-none px-4 py-3 font-semibold">
                        {areaLabel[area] ?? area} · {changes.length} Änderung
                        {changes.length === 1 ? "" : "en"}
                      </summary>
                      <div className="space-y-2 border-t p-3">
                        {changes.map(change => (
                          <ChangeRow
                            key={change.key}
                            change={change}
                            selected={selectedChangeKeys.has(change.key)}
                            onSelectedChange={selected =>
                              toggleChange(change.key, selected)
                            }
                          />
                        ))}
                      </div>
                    </details>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-red-500 bg-red-50 shadow-md">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 font-semibold text-red-950">
                  <ShieldCheck className="h-5 w-5" /> 3. Geprüften Stand
                  wiederherstellen
                </div>
                <p className="mt-1 text-sm text-red-900">
                  {selectedChangeKeys.size} Änderung
                  {selectedChangeKeys.size === 1 ? "" : "en"} ausgewählt. Der
                  Vorgang läuft vollständig oder gar nicht und wird mit Datei,
                  Zeitpunkt, Administrator und jeder Einzeländerung
                  protokolliert.
                </p>
              </div>
              <Button
                size="lg"
                variant="destructive"
                className="min-h-12 min-w-[280px] border-2 border-red-900 !bg-red-700 px-6 font-bold !text-white shadow-lg hover:!bg-red-800 disabled:!border-slate-400 disabled:!bg-slate-300 disabled:!text-slate-700 disabled:opacity-100"
                disabled={
                  selectedChangeKeys.size === 0 || restoreMutation.isPending
                }
                onClick={() => setConfirmOpen(true)}
              >
                Excel-Stand endgültig übernehmen
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {isAdmin && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileClock className="h-5 w-5" /> Wiederherstellungsprotokoll
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Jede bestätigte Sicherung wird veranstaltungsbezogen und dauerhaft
              nachvollziehbar gespeichert.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Protokoll wird geladen …
              </p>
            ) : logs.data?.length ? (
              logs.data.map(entry => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold">{entry.sourceFilename}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)} · {entry.actorName}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {entry.createdCount} neu
                      </Badge>
                      <Badge className="bg-amber-100 text-amber-800">
                        {entry.updatedCount} geändert
                      </Badge>
                      <Badge className="bg-red-100 text-red-800">
                        {entry.deletedCount} gelöscht
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedLogId(entry.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" /> Details
                  </Button>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Für diese Veranstaltung gibt es noch keine
                Excel-Wiederherstellung.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <AdminPasswordDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excel-Stand endgültig wiederherstellen?"
        description={
          preview
            ? `${selectedTotals.created} ausgewählte Einträge werden angelegt, ${selectedTotals.updated} geändert und ${selectedTotals.deleted} gelöscht. Nicht ausgewählte Änderungen bleiben unverändert.`
            : "Die geprüfte Excel-Sicherung wird wiederhergestellt."
        }
        confirmLabel="Ja, Excel-Stand übernehmen"
        busy={restoreMutation.isPending}
        onConfirm={adminPassword => {
          if (!preview || !base64) return;
          restoreMutation.mutate({
            base64,
            filename,
            currentDigest: preview.currentDigest,
            selectedChangeKeys: Array.from(selectedChangeKeys),
            adminPassword,
          });
        }}
      />

      <Dialog
        open={selectedLogId !== null}
        onOpenChange={open => !open && setSelectedLogId(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Einzeländerungen der Wiederherstellung</DialogTitle>
            <DialogDescription>
              Vollständiger Nachweis des ausgewählten Excel-Vorgangs.
            </DialogDescription>
          </DialogHeader>
          {logDetail.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Details werden geladen …
            </p>
          ) : logDetail.error ? (
            <p className="text-sm text-destructive">
              {logDetail.error.message}
            </p>
          ) : logDetail.data ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="font-semibold">
                  {logDetail.data.sourceFilename}
                </div>
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="h-4 w-4" />{" "}
                  {formatDate(logDetail.data.createdAt)} ·{" "}
                  {logDetail.data.actorName}
                </div>
              </div>
              <div className="space-y-2">
                {(logDetail.data.changes ?? []).map(change => (
                  <ChangeRow key={change.key} change={change} />
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
