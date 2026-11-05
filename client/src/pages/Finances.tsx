import { useAuth } from "@/_core/hooks/useAuth";
import {
  FinanceCategoryDialog,
  type FinanceCategory,
} from "@/components/FinanceCategoryDialog";
import { FinanceNotebookDialog } from "@/components/FinanceNotebookDialog";
import {
  FinanceReceiptBackupButton,
  FinanceReceiptsDialog,
  FINANCE_RECEIPT_BACKUP_HINT,
} from "@/components/FinanceReceiptsDialog";
import {
  KlemmiSurfaceGuide,
  type KlemmiSurfaceStep,
} from "@/components/KlemmiSurfaceGuide";
import { PageTitle } from "@/components/PageTitle";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEventYear } from "@/contexts/YearContext";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import {
  STICKY_TABLE_CONTAINER_CLASS,
  STICKY_TABLE_HEADER_CLASS,
  STICKY_TABLE_HEADER_CELL_CLASS,
} from "@/lib/sticky-table";
import { trpc } from "@/lib/trpc";
import { BookOpen, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const eur = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const differenceClass = (cents: number) =>
  cents >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]";

export default function Finances() {
  const utils = trpc.useUtils();
  const { loading: authLoading } = useAuth();
  const { year, eventId } = useEventYear();
  const {
    isTenantAdmin,
    canReadModule,
    canWriteModule,
    moduleAccess,
    administrativeContext,
  } = useTenantAdministration();
  const canRead = canReadModule("finances");
  const canWrite = canWriteModule("finances");
  const canDelete = isTenantAdmin && canWrite;
  const rightsLoading =
    authLoading ||
    (!canRead && (moduleAccess.isLoading || administrativeContext.isLoading));
  const finances = trpc.finances.list.useQuery(undefined, {
    enabled: canRead,
    retry: false,
  });
  const rows = finances.data ?? [];
  const [categoryDialog, setCategoryDialog] = useState<{
    row: FinanceCategory | null;
  } | null>(null);
  const [notebookId, setNotebookId] = useState<number | null>(null);
  const [receiptsId, setReceiptsId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceCategory | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletionInFlight = useRef(false);
  const remove = trpc.finances.remove.useMutation();
  const notebookRow = rows.find(row => row.id === notebookId);
  const receiptsRow = rows.find(row => row.id === receiptsId);

  useEffect(() => {
    setCategoryDialog(null);
    setNotebookId(null);
    setReceiptsId(null);
    setDeleteTarget(null);
    setDeleteError(null);
  }, [year, eventId]);

  const deleteCategory = async () => {
    if (!canDelete || !deleteTarget || deletionInFlight.current) return;
    deletionInFlight.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove.mutateAsync({ id: deleteTarget.id });
      await utils.finances.list.invalidate();
      void utils.dashboard.invalidate();
      setDeleteTarget(null);
      toast.success("Kategorie gelöscht");
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : "Die Kategorie konnte nicht gelöscht werden."
      );
    } finally {
      deletionInFlight.current = false;
      setDeleting(false);
    }
  };

  const sumIn = rows.reduce((sum, row) => sum + row.income, 0);
  const sumOut = rows.reduce((sum, row) => sum + row.expense, 0);
  const guideSteps: KlemmiSurfaceStep[] = [
    {
      key: "intro",
      selector: '[data-klemmi-target="finances-values"]',
      eyebrow: "Klemmi zeigt’s",
      title: "Finanzen einfach im Blick behalten",
      text: "Die Übersicht zeigt Einnahmen und Ausgaben pro Kategorie. Der Saldo wird automatisch berechnet. Diese Textführung verändert keine Daten.",
      action: "Weiter",
    },
    ...(canWrite
      ? [
          {
            key: "dialog",
            selector: '[data-klemmi-target="finances-category"]',
            eyebrow: "Kategorie pflegen",
            title: "Neue Kategorie im Dialog",
            text: "„Neue Kategorie“ öffnet einen Dialog. Dort gibst du die Kategorie, Einnahmen, Ausgaben und optional eine erste Notiz ein. Erst „Speichern“ übernimmt die Angaben. Bestehende Kategorien änderst du über „Bearbeiten“.",
            action: "Weiter",
          },
        ]
      : []),
    {
      key: "notebook",
      selector: '[data-klemmi-target="finances-values"]',
      eyebrow: "Notizen zur Kategorie",
      title: "Das Notizbuch öffnen",
      text: canWrite
        ? "„Notizbuch“ öffnet den Verlauf der jeweiligen Kategorie. Neue Einträge werden mit Datum, Uhrzeit und deinem Namen ergänzt; bestehende Notizen bleiben erhalten. „Belege“ verwaltet PDFs separat und verändert keine Finanzwerte."
        : "„Notizbuch“ öffnet die bisherigen Notizen der jeweiligen Kategorie. Mit deinem Lesezugriff kannst du den Verlauf ansehen, aber keine Einträge ergänzen oder Finanzwerte ändern.",
      action: "Saldo zeigen",
    },
    {
      key: "balance",
      selector: '[data-klemmi-target="finances-balance"]',
      eyebrow: "Gesamtübersicht",
      title: "Saldo prüfen",
      text: "Der Saldo fasst die Einnahmen und Ausgaben aller Kategorien zusammen. Die Differenz zeigt den aktuellen finanziellen Stand.",
      action: "Fertig",
    },
  ];

  const actions = (row: FinanceCategory) => (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-md:min-h-11"
        onClick={() => setNotebookId(row.id)}
        aria-label={`Notizbuch für ${row.category} öffnen`}
      >
        <BookOpen className="mr-1.5 h-4 w-4" />
        Notizbuch
      </Button>
      {canWrite && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
            onClick={() => setCategoryDialog({ row })}
            aria-label={`Kategorie ${row.category} bearbeiten`}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Bearbeiten
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
            onClick={() => setReceiptsId(row.id)}
            aria-label={`Belege für ${row.category} öffnen`}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            Belege
          </Button>
        </>
      )}
      {canDelete && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-md:min-h-11"
          disabled={deleting}
          onClick={() => {
            setDeleteError(null);
            setDeleteTarget(row);
          }}
          aria-label={`Kategorie ${row.category} löschen`}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Löschen
        </Button>
      )}
    </div>
  );

  if (rightsLoading)
    return (
      <div role="status" className="p-4 text-sm text-muted-foreground">
        Finanzen werden geladen …
      </div>
    );
  if (!canRead)
    return (
      <div className="space-y-3">
        <PageTitle icon="finances">Finanzen</PageTitle>
        <p role="alert">Du hast keinen Zugriff auf den Bereich Finanzen.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <PageTitle icon="finances">Finanzen</PageTitle>
          <p className="text-muted-foreground">
            Einnahmen und Ausgaben pro Kategorie. Differenz und Saldo werden
            automatisch berechnet.
          </p>
          {!canWrite && (
            <p className="text-sm text-muted-foreground">
              Lesezugriff – Finanzwerte und Notizbücher ansehen.
            </p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          {/* The old audio describes inline edits. This updated tour is deliberately text-only. */}
          <KlemmiSurfaceGuide
            guideId="finances"
            audioGuideId="finances-dialog-text"
            voiceMuted
            title="Finanzen verstehen"
            introText="Kategorien, Dialoge, Notizbücher und Saldo einfach erklärt."
            steps={guideSteps}
            successSignal={null}
            completionText="Du kennst jetzt die Finanzübersicht und die passenden Dialoge. Es wurden keine Daten verändert."
          />
          {canWrite && (
            <Button
              type="button"
              variant="outline"
              className="col-span-2 shadow-xs lg:col-auto"
              data-klemmi-target="finances-category"
              onClick={() => setCategoryDialog({ row: null })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Neue Kategorie
            </Button>
          )}
          {canDelete && (
            <ResetAreaButton
              area="finances"
              label="Finanzen"
              compact
              onReset={() => {
                setNotebookId(null);
                setReceiptsId(null);
              }}
              description="Alle Finanzkategorien der gewählten Veranstaltung werden dauerhaft gelöscht. Sichere benötigte PDF-Belege vorher separat über „Belege sichern (ZIP)“. Diese Aktion kann nicht rückgängig gemacht werden."
            />
          )}
        </div>
      </div>

      {canWrite && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <FinanceReceiptBackupButton canWrite={canWrite} />
          <p className="text-xs leading-5 text-muted-foreground">
            {FINANCE_RECEIPT_BACKUP_HINT}
          </p>
        </div>
      )}

      <div data-klemmi-target="finances-values" className="space-y-3">
        {finances.isLoading && (
          <Card>
            <CardContent
              className="p-4 text-sm text-muted-foreground"
              role="status"
            >
              Kategorien werden geladen …
            </CardContent>
          </Card>
        )}
        {finances.error && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p role="alert" className="break-words text-sm text-destructive">
                Finanzen konnten nicht geladen werden: {finances.error.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={finances.isFetching}
                onClick={() => void finances.refetch()}
              >
                Erneut laden
              </Button>
            </CardContent>
          </Card>
        )}
        {!finances.isLoading && !finances.error && !rows.length && (
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-sm font-medium">
                Noch keine Finanzkategorien vorhanden.
              </p>
              <p className="text-sm text-muted-foreground">
                {canWrite
                  ? "Über „Neue Kategorie“ kannst du die erste Kategorie mit Einnahmen, Ausgaben und optional einer Notiz anlegen."
                  : "Sobald Kategorien angelegt sind, erscheinen ihre Werte und Notizbücher hier."}
              </p>
            </CardContent>
          </Card>
        )}
        {rows.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map(row => (
                <Card key={row.id} className="shadow-sm">
                  <CardContent className="space-y-3 p-4">
                    <h2 className="break-words font-semibold">
                      {row.category}
                    </h2>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Einnahmen</dt>
                        <dd className="mt-1 break-words font-medium tabular-nums">
                          {eur(row.income)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Ausgaben</dt>
                        <dd className="mt-1 break-words font-medium tabular-nums">
                          {eur(row.expense)}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-3 text-sm">
                      <span>Differenz</span>
                      <strong
                        className={`tabular-nums ${differenceClass(row.income - row.expense)}`}
                      >
                        {eur(row.income - row.expense)}
                      </strong>
                    </div>
                    {actions(row)}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="hidden shadow-sm md:block">
              <CardContent className={`${STICKY_TABLE_CONTAINER_CLASS} p-0`}>
                <table className="w-full text-sm">
                  <thead
                    data-sticky-table-header="finances"
                    className={STICKY_TABLE_HEADER_CLASS}
                  >
                    <tr className="text-left">
                      <th
                        scope="col"
                        className={STICKY_TABLE_HEADER_CELL_CLASS}
                      >
                        Kategorie
                      </th>
                      <th
                        scope="col"
                        className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}
                      >
                        Einnahmen
                      </th>
                      <th
                        scope="col"
                        className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}
                      >
                        Ausgaben
                      </th>
                      <th
                        scope="col"
                        className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}
                      >
                        Differenz
                      </th>
                      <th
                        scope="col"
                        className={STICKY_TABLE_HEADER_CELL_CLASS}
                      >
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} className="border-t hover:bg-muted/30">
                        <th
                          scope="row"
                          className="max-w-64 break-words p-3 text-left font-medium"
                        >
                          {row.category}
                        </th>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums">
                          {eur(row.income)}
                        </td>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums">
                          {eur(row.expense)}
                        </td>
                        <td
                          className={`whitespace-nowrap p-3 text-right font-semibold tabular-nums ${differenceClass(row.income - row.expense)}`}
                        >
                          {eur(row.income - row.expense)}
                        </td>
                        <td className="p-3">{actions(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {!finances.isLoading && !finances.error && (
        <Card data-klemmi-target="finances-balance" className="shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Saldo</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex flex-wrap justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Einnahmen</dt>
                <dd className="font-semibold tabular-nums sm:mt-1">
                  {eur(sumIn)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Ausgaben</dt>
                <dd className="font-semibold tabular-nums sm:mt-1">
                  {eur(sumOut)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t pt-3 sm:block sm:border-t-0 sm:pt-0">
                <dt className="text-muted-foreground">Differenz</dt>
                <dd
                  className={`font-bold tabular-nums sm:mt-1 ${differenceClass(sumIn - sumOut)}`}
                >
                  {eur(sumIn - sumOut)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {canWrite && categoryDialog && (
        <FinanceCategoryDialog
          key={`${eventId}-${year}-${categoryDialog.row?.id ?? "new"}`}
          row={categoryDialog.row}
          canWrite={canWrite}
          onClose={() => setCategoryDialog(null)}
        />
      )}
      {notebookRow && (
        <FinanceNotebookDialog
          key={`${eventId}-${year}-${notebookRow.id}`}
          row={notebookRow}
          canWrite={canWrite}
          onClose={() => setNotebookId(null)}
        />
      )}
      {canWrite && receiptsRow && (
        <FinanceReceiptsDialog
          key={`${eventId}-${year}-${receiptsRow.id}`}
          row={receiptsRow}
          canWrite={canWrite}
          onClose={() => setReceiptsId(null)}
        />
      )}
      {canDelete && deleteTarget && (
        <Dialog
          open
          onOpenChange={open => {
            if (!open && !deletionInFlight.current) setDeleteTarget(null);
          }}
        >
          <DialogContent showCloseButton={!deleting}>
            <DialogHeader>
              <DialogTitle>Kategorie löschen?</DialogTitle>
              <DialogDescription>
                „{deleteTarget.category}“ wird dauerhaft gelöscht. Sichere
                benötigte PDF-Belege vorher separat über „Belege sichern (ZIP)“.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <p role="alert" className="break-words text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Abbrechen
              </Button>
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => void deleteCategory()}
              >
                {deleting ? "Löscht …" : "Kategorie löschen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
