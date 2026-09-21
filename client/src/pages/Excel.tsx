import { useAuth } from "@/_core/hooks/useAuth";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventYear } from "@/contexts/YearContext";
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { FileDown, FileSpreadsheet, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function ExcelPage() {
  const { user } = useAuth();
  const { year } = useEventYear();
  const isAdmin = user?.role === "admin";

  const exportQuery = trpc.excel.exportFile.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

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
        <PageTitle icon="excel">Excel-Projektübersicht</PageTitle>
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
          {isAdmin && (
            <p className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-1 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>Import-Historie im</span>
              <Link
                href="/sicherheit"
                className="font-medium text-blue-700 underline-offset-2 hover:underline"
              >
                System- &amp; Sicherheitsprotokoll
              </Link>
              <span>einsehen.</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
