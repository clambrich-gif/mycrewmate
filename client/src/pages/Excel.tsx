import { useAuth } from "@/_core/hooks/useAuth";
import { GroupedChangeList } from "@/components/ChangePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArchiveRestore,
  FileDown,
  FileSpreadsheet,
  Info,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const dateTime = (value: Date | string | number) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function ExcelPage() {
  const { user } = useAuth();
  const { year } = useEventYear();
  const isAdmin = user?.role === "admin";
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  const exportQuery = trpc.excel.exportFile.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const logs = trpc.projectFile.restoreLogs.useQuery(undefined, {
    enabled: isAdmin,
  });
  const logDetail = trpc.projectFile.restoreLog.useQuery(
    { id: selectedLogId ?? 0 },
    { enabled: isAdmin && selectedLogId !== null }
  );

  const exportExcel = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) {
      toast.error(
        result.error?.message ?? "Excel-Datei konnte nicht erstellt werden"
      );
      return;
    }
    downloadBase64File(
      result.data.base64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `RSC-Projektuebersicht_${safeDownloadName(result.data.eventName)}_${year}.xlsx`
    );
    toast.success("Excel-Projektübersicht erstellt");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Excel-Projektübersicht</h1>
        <p className="text-muted-foreground">
          Der Excel-Export dient ausschließlich der Übersicht und Dokumentation.
          Für eine vollständige Datensicherung verwenden Sie links „Speichern“
          und „Laden“.
        </p>
      </div>

      <Card className="border-blue-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-blue-700" /> Gesamtes
            Projekt als Excel ausgeben
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <div className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Die Datei enthält Ansprechpartner, Helfer, Einsatzplan,
                Vorbereitung, Nachbereitung, Material, Marketing, Genehmigungen,
                Kuchen und Finanzen in getrennten Tabellenblättern. Sie ersetzt
                keine Projekt-Speicherdatei.
              </p>
            </div>
          </div>
          <Button
            className="w-full border border-blue-800 !bg-blue-700 !text-white shadow-md hover:!bg-blue-800 sm:w-auto"
            disabled={exportQuery.isFetching}
            onClick={() => void exportExcel()}
          >
            {exportQuery.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Excel-Projektübersicht herunterladen
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Excel-Import je Bereich</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Der Import erfolgt direkt im jeweiligen Bereich über „Excel
            importieren“. Dadurch ist klar erkennbar, welche Tabelle geändert
            wird.
          </p>
          <p>
            Die Vorschau kann nach <strong>neuen Daten</strong>,{" "}
            <strong>Änderungen</strong> und <strong>Löschungen</strong>{" "}
            gefiltert werden. Der Import übernimmt nach Bestätigung immer alle
            erkannten Änderungen des gewählten Bereichs.
          </p>
          {!isAdmin && (
            <p className="font-medium text-amber-800">
              Modulimporte und das Laden einer Projektdatei sind aus
              Sicherheitsgründen Administratoren vorbehalten.
            </p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArchiveRestore className="h-5 w-5" /> Lade- und Importprotokoll
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Protokoll wird geladen …
              </p>
            ) : !logs.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Projektdatei oder Modultabelle geladen.
              </p>
            ) : (
              <div className="space-y-2">
                {logs.data.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    className="grid w-full gap-2 rounded-lg border bg-white p-3 text-left transition-colors hover:bg-accent sm:grid-cols-[1fr_auto] dark:bg-slate-950"
                    onClick={() => setSelectedLogId(entry.id)}
                  >
                    <span>
                      <span className="block font-semibold">
                        {entry.sourceFilename}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {dateTime(entry.createdAt)} · {entry.actorName}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-muted-foreground sm:text-right">
                      {entry.createdCount} neu · {entry.updatedCount} geändert ·{" "}
                      {entry.deletedCount} gelöscht
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={selectedLogId !== null}
        onOpenChange={open => !open && setSelectedLogId(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle>Protokolldetails</DialogTitle>
            <DialogDescription>
              Jede tatsächlich übernommene Einzeländerung des ausgewählten
              Vorgangs.
            </DialogDescription>
          </DialogHeader>
          {logDetail.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Details werden geladen …
            </p>
          ) : (
            <GroupedChangeList changes={logDetail.data?.changes ?? []} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
