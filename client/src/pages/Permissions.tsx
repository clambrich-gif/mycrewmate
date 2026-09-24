import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { GroupedChangeList } from "@/components/ChangePreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArchiveRestore,
  FileSpreadsheet,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const actionLabel = {
  single_delete: "Einzellöschung",
  area_reset: "Bereichsreset",
  year_reset: "Jahresreset",
} as const;

const entityLabel = {
  helper: "Helfer",
  cake: "Spende",
  prep: "Vorbereitung",
  post: "Nachbereitung",
  material: "Material",
} as const;

const dateTime = (value: Date | string | number) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function detailText(
  entityType: "helper" | "cake" | "prep" | "post" | "material",
  value: string | null
) {
  if (!value) return "–";
  try {
    const details = JSON.parse(value) as Record<string, unknown>;
    if (entityType === "helper") {
      return [
        `Helfen: ${details.willHelp === "ja" ? "Ja" : "Nein"}`,
        `Mo–So: ${details.availMon ?? "–"} / ${details.availTue ?? "–"} / ${details.availWed ?? "–"} / ${details.availThu ?? "–"} / ${details.availFri ?? "–"} / ${details.availSat ?? "–"} / ${details.availSun ?? "–"}`,
        `Bestätigt: ${details.confirmed === "ja" ? "Ja" : "Nein"}`,
        typeof details.assignmentCount === "number"
          ? `Einsätze: ${details.assignmentCount}`
          : null,
        details.email ? `E-Mail: ${details.email}` : null,
        details.phone ? `Telefon: ${details.phone}` : null,
        details.note ? `Hinweis: ${details.note}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (entityType === "prep" || entityType === "post") {
      return [
        details.category ? `Bereich: ${details.category}` : null,
        details.task ? `Aufgabe: ${details.task}` : null,
        details.dueText ? `Frist: ${details.dueText}` : null,
        details.status ? `Status: ${details.status}` : null,
        details.note ? `Logbuch: ${details.note}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (entityType === "material") {
      return [
        details.category ? `Kategorie: ${details.category}` : null,
        details.quantity ? `Menge: ${details.quantity}` : null,
        details.unit ? `Einheit: ${details.unit}` : null,
        details.status
          ? `Stand: ${
              details.status === "geliefert"
                ? "Geliefert"
                : details.status === "bestellt"
                  ? "Bestellt"
                  : "Offen"
            }`
          : details.ordered === "ja"
            ? "Stand: Geliefert"
            : "Stand: Offen",
        details.note ? `Hinweis: ${details.note}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return [
      details.cake ? `Spende: ${details.cake}` : "Spende nicht angegeben",
      details.donationCategory ? `Kategorie: ${details.donationCategory}` : null,
      details.dropoffTime ? `Abgabe: ${details.dropoffTime}` : null,
      details.meat ? "Fleischhaltig" : null,
      details.note ? `Hinweis: ${details.note}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    return "Details nicht lesbar";
  }
}

function activityActionBadge(action: string) {
  switch (action) {
    case "created":
      return <Badge className="bg-emerald-100 text-emerald-800">Erstellt</Badge>;
    case "updated":
      return <Badge className="bg-blue-100 text-blue-800">Aktualisiert</Badge>;
    case "deleted":
      return <Badge className="bg-rose-100 text-rose-800">Gelöscht</Badge>;
    case "reset":
      return <Badge className="bg-amber-100 text-amber-800">Zurückgesetzt</Badge>;
    case "imported":
      return <Badge className="bg-indigo-100 text-indigo-800">Importiert</Badge>;
    case "copied":
      return <Badge className="bg-purple-100 text-purple-800">Übernommen</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}

function importKind(filename: string) {
  const normalized = filename.toLocaleLowerCase("de-DE");
  return normalized.endsWith(".json") || normalized.endsWith(".rscplanung")
    ? "JSON-Projektstand"
    : "Excel-Import";
}

/**
 * Zentraler, ausschließlich für Administratoren sichtbarer Audit-Bereich.
 * Die drei Tabs bündeln Sicherheitsereignisse, operative Änderungen sowie
 * tatsächlich übernommene JSON- und Excel-Dateivorgänge ohne Datenmigration.
 */
export function AuditCenter() {
  const { isTenantAdmin: isAdmin } = useTenantAdministration();
  const [yearFilter, setYearFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activityView, setActivityView] = useState<"activities" | "deletions">(
    "activities"
  );
  const [resetDeletionOpen, setResetDeletionOpen] = useState(false);
  const [resetFileHistoryOpen, setResetFileHistoryOpen] = useState(false);
  const [selectedFileLogId, setSelectedFileLogId] = useState<number | null>(null);
  const { data: years = [] } = trpc.years.list.useQuery();
  const { data: events = [] } = trpc.events.all.useQuery();
  const utils = trpc.useUtils();

  const auditInput = useMemo(
    () => ({
      eventYear: yearFilter === "all" ? undefined : Number(yearFilter),
      eventId: eventFilter === "all" ? undefined : Number(eventFilter),
      entityType:
        typeFilter === "all"
          ? undefined
          : (typeFilter as "helper" | "cake" | "prep" | "post" | "material"),
      limit: 500,
    }),
    [eventFilter, typeFilter, yearFilter]
  );
  const deletionAudit = trpc.audit.deletions.useQuery(auditInput, {
    enabled: isAdmin,
  });
  const activityInput = useMemo(
    () => ({
      eventYear: yearFilter === "all" ? undefined : Number(yearFilter),
      eventId: eventFilter === "all" ? undefined : Number(eventFilter),
      limit: 500,
    }),
    [eventFilter, yearFilter]
  );
  const activities = trpc.audit.activities.useQuery(activityInput, {
    enabled: isAdmin,
  });
  const fileHistory = trpc.projectFile.restoreLogs.useQuery(undefined, {
    enabled: isAdmin,
  });
  const fileLogDetail = trpc.projectFile.restoreLog.useQuery(
    { id: selectedFileLogId ?? 0 },
    { enabled: isAdmin && selectedFileLogId !== null }
  );

  const clearDeletionAudit = trpc.audit.clear.useMutation({
    onSuccess: async () => {
      setResetDeletionOpen(false);
      await utils.audit.deletions.invalidate();
      toast.success("Löschprotokoll wurde zurückgesetzt");
    },
    onError: error => toast.error(error.message),
  });
  const restoreAudit = trpc.audit.restore.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.audit.deletions.invalidate(),
        utils.helpers.list.invalidate(),
        utils.cakes.list.invalidate(),
        utils.prep.list.invalidate(),
        utils.post.list.invalidate(),
        utils.materials.list.invalidate(),
        utils.plan.evaluate.invalidate(),
        utils.dashboard.stats.invalidate(),
      ]);
      const assignmentNote = result.skippedAssignments
        ? ` ${result.skippedAssignments} frühere Einsatzplätze waren inzwischen belegt oder nicht mehr vorhanden.`
        : "";
      toast.success(
        `„${result.entityLabel}“ wurde in ${result.eventName} wiederhergestellt.${assignmentNote}`
      );
    },
    onError: error => toast.error(error.message),
  });
  const clearFileHistory = trpc.projectFile.clearRestoreLogs.useMutation({
    onSuccess: async result => {
      setResetFileHistoryOpen(false);
      setSelectedFileLogId(null);
      await utils.projectFile.restoreLogs.invalidate();
      toast.success(
        result.deleted === 1
          ? "1 Import-Historieneintrag wurde endgültig gelöscht"
          : `${result.deleted} Import-Historieneinträge wurden endgültig gelöscht`
      );
    },
    onError: error => toast.error(error.message),
  });

  const securityEntries = (activities.data ?? []).filter(
    entry => entry.module === "Zugangsschutz"
  );
  const operationalActivities = (activities.data ?? []).filter(
    entry => entry.module !== "Zugangsschutz"
  );
  const selectedEventName =
    eventFilter === "all"
      ? null
      : events.find(event => event.id === Number(eventFilter))?.name;

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Die Protokolle sind ausschließlich für Administratoren sichtbar.
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="security" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl p-1 sm:grid-cols-3">
          <TabsTrigger
            value="security"
            className="h-10 whitespace-normal px-3 text-left leading-tight"
          >
            🛡️ Sicherheit &amp; Logins
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="h-10 whitespace-normal px-3 text-left leading-tight"
          >
            🗑️ Aktivitäts- &amp; Löschverlauf
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="h-10 whitespace-normal px-3 text-left leading-tight"
          >
            📁 Datei- &amp; Import-Historie
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <h3 className="font-semibold text-slate-900">Sicherheit &amp; Logins</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Erfolgreiche Administrator-Anmeldungen, Passwortwechsel,
                  Einmalcode-Resets und globale Notfall-Sperren.
                </p>
              </div>
            </div>
          </div>
          {activities.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Sicherheitsprotokoll wird geladen …
            </p>
          ) : activities.error ? (
            <p className="p-5 text-sm text-destructive">
              {activities.error.message}
            </p>
          ) : securityEntries.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-100">
                {securityEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="mb-1">{activityActionBadge(entry.action)}</div>
                      <p className="font-medium text-slate-900">{entry.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.actorName} · Administrator
                        {entry.eventName ? ` · ${entry.eventName}` : ""}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {dateTime(entry.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Es wurden noch keine Sicherheitsereignisse oder Administrator-Sitzungen
              protokolliert.
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <History className="h-5 w-5 text-slate-700" /> Aktivitäts- &amp;
                Löschverlauf
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Nachvollziehbarer Verlauf geänderter Planungsdaten und gezielte
                Wiederherstellung einzelner Löschungen.
              </p>
            </div>
            <div className="inline-flex rounded-lg border bg-white p-1 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  activityView === "activities"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-muted-foreground hover:text-slate-900"
                )}
                onClick={() => setActivityView("activities")}
              >
                Aktivitäten ({operationalActivities.length})
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  activityView === "deletions"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-muted-foreground hover:text-slate-900"
                )}
                onClick={() => setActivityView("deletions")}
              >
                Löschungen ({deletionAudit.data?.length ?? 0})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jahre</SelectItem>
                {years.map(item => (
                  <SelectItem key={item.year} value={String(item.year)}>
                    {item.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activityView === "deletions" && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Einträge</SelectItem>
                  <SelectItem value="helper">Nur Helfer</SelectItem>
                  <SelectItem value="cake">Nur Spenden</SelectItem>
                  <SelectItem value="prep">Nur Vorbereitungen</SelectItem>
                  <SelectItem value="post">Nur Nachbereitungen</SelectItem>
                  <SelectItem value="material">Nur Material</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-52 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Veranstaltungen</SelectItem>
                {events
                  .filter(
                    event =>
                      yearFilter === "all" || event.year === Number(yearFilter)
                  )
                  .map(event => (
                    <SelectItem key={event.id} value={String(event.id)}>
                      {event.year} · {event.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {activityView === "deletions" && (
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                onClick={() => setResetDeletionOpen(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Löschverlauf zurücksetzen
              </Button>
            )}
          </div>

          {activityView === "activities" ? (
            activities.isLoading ? (
              <p className="p-5 text-sm text-muted-foreground">
                Aktivitätsverlauf wird geladen …
              </p>
            ) : activities.error ? (
              <p className="p-5 text-sm text-destructive">
                {activities.error.message}
              </p>
            ) : operationalActivities.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-700">
                    <tr>
                      <th className="p-3 font-semibold">Zeitpunkt</th>
                      <th className="p-3 font-semibold">Veranstaltung</th>
                      <th className="p-3 font-semibold">Bereich</th>
                      <th className="p-3 font-semibold">Ausgeführt von</th>
                      <th className="p-3 font-semibold">Aktion &amp; Gegenstand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationalActivities.map(entry => (
                      <tr key={entry.id} className="border-t align-top">
                        <td className="p-3 text-xs text-slate-600">
                          {dateTime(entry.createdAt)}
                        </td>
                        <td className="p-3 text-xs font-medium text-slate-800">
                          {entry.eventName}
                        </td>
                        <td className="p-3 text-xs text-slate-700">{entry.module}</td>
                        <td className="p-3 text-xs">
                          <div className="font-semibold text-slate-900">
                            {entry.actorName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {entry.actorRole === "admin"
                              ? "Administrator"
                              : "Planungsteam"}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="mb-1">{activityActionBadge(entry.action)}</div>
                          <div className="text-slate-800">{entry.subject}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Für die gewählten Filter liegen noch keine operativen Aktivitäten vor.
              </div>
            )
          ) : deletionAudit.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Löschverlauf wird geladen …
            </p>
          ) : deletionAudit.error ? (
            <p className="p-5 text-sm text-destructive">
              {deletionAudit.error.message}
            </p>
          ) : deletionAudit.data?.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {deletionAudit.data.map(entry => (
                  <div key={entry.id} className="space-y-2 rounded-lg border bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{entry.entityLabel}</div>
                        <div className="text-xs text-muted-foreground">
                          {dateTime(entry.createdAt)}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {entityLabel[entry.entityType]} · {entry.year}
                      </Badge>
                    </div>
                    <div>Veranstaltung: {entry.eventName ?? "nicht zugeordnet"}</div>
                    <div>Vorgang: {actionLabel[entry.action]}</div>
                    <div>
                      Ausgeführt von: {entry.actorName} (
                      {entry.actorRole === "admin" ? "Administrator" : "Planungsteam"})
                    </div>
                    <div className="break-words text-muted-foreground">
                      {detailText(entry.entityType, entry.details)}
                    </div>
                    {entry.restoredAt ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        Wiederhergestellt durch {entry.restoredByName ?? "Administrator"}
                      </Badge>
                    ) : entry.action === "single_delete" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={restoreAudit.isPending}
                        onClick={() => restoreAudit.mutate({ id: entry.id })}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" /> Wiederherstellen
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                <table className="min-w-[960px] w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-700">
                    <tr>
                      <th className="p-3 font-semibold">Zeitpunkt</th>
                      <th className="p-3 font-semibold">Veranstaltung</th>
                      <th className="p-3 font-semibold">Gelöschter Eintrag</th>
                      <th className="p-3 font-semibold">Vorgang &amp; ausgeführt von</th>
                      <th className="p-3 font-semibold">Details</th>
                      <th className="p-3 font-semibold">Wiederherstellung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletionAudit.data.map(entry => (
                      <tr key={entry.id} className="border-t align-top">
                        <td className="p-3 text-xs">{dateTime(entry.createdAt)}</td>
                        <td className="p-3 text-xs">{entry.eventName ?? "nicht zugeordnet"}</td>
                        <td className="p-3 text-xs font-medium">
                          {entry.entityLabel}
                          <div className="mt-1 font-normal text-muted-foreground">
                            {entityLabel[entry.entityType]}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="font-medium">{actionLabel[entry.action]}</div>
                          <div>{entry.actorName}</div>
                          <div className="text-muted-foreground">
                            {entry.actorRole === "admin" ? "Administrator" : "Planungsteam"}
                          </div>
                        </td>
                        <td className="max-w-md p-3 text-xs text-muted-foreground">
                          {detailText(entry.entityType, entry.details)}
                        </td>
                        <td className="p-3 text-xs">
                          {entry.restoredAt ? (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Wiederhergestellt
                            </Badge>
                          ) : entry.action === "single_delete" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={restoreAudit.isPending}
                              onClick={() => restoreAudit.mutate({ id: entry.id })}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Wiederherstellen
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">
                              Nur Einzellöschungen
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Für die gewählten Filter liegen noch keine Löschungen vor.
            </div>
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <ArchiveRestore className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <h3 className="font-semibold text-slate-900">Datei- &amp; Import-Historie</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Erfolgreich übernommene JSON-Projektstände und Excel-Module.
                  Maximal 100 Einträge je Veranstaltung, höchstens 90 Tage Aufbewahrung.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              disabled={!fileHistory.data?.length || clearFileHistory.isPending}
              onClick={() => setResetFileHistoryOpen(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Historie leeren
            </Button>
          </div>
          {fileHistory.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Datei- und Import-Historie wird geladen …
            </p>
          ) : fileHistory.error ? (
            <p className="p-5 text-sm text-destructive">{fileHistory.error.message}</p>
          ) : !fileHistory.data?.length ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Noch keine Projektdatei oder Excel-Tabelle übernommen.
            </div>
          ) : (
            <div className="space-y-2">
              {fileHistory.data.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className="grid w-full gap-3 rounded-xl border bg-white p-4 text-left transition-colors hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:grid-cols-[1fr_auto]"
                  onClick={() => setSelectedFileLogId(entry.id)}
                >
                  <span className="min-w-0">
                    <span className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {importKind(entry.sourceFilename)}
                      </Badge>
                      <span className="truncate font-semibold text-slate-900">
                        {entry.sourceFilename}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {dateTime(entry.createdAt)} · {entry.actorName}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground sm:text-right">
                    {entry.createdCount} neu · {entry.updatedCount} geändert · {entry.deletedCount} gelöscht
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-white p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            Ein Klick auf einen Eintrag zeigt die tatsächlich übernommenen Einzeländerungen.
          </div>
        </TabsContent>
      </Tabs>

      <AdminPasswordDialog
        open={resetDeletionOpen}
        onOpenChange={setResetDeletionOpen}
        title="Löschverlauf zurücksetzen?"
        description={
          eventFilter !== "all"
            ? `Alle Löschprotokolle für ${selectedEventName ?? "die gewählte Veranstaltung"} werden dauerhaft entfernt.`
            : yearFilter === "all"
              ? "Alle Löschprotokolle über sämtliche Jahre werden dauerhaft entfernt."
              : `Alle Löschprotokolle für ${yearFilter} werden dauerhaft entfernt.`
        }
        confirmLabel="Löschverlauf endgültig löschen"
        busy={clearDeletionAudit.isPending}
        onConfirm={adminPassword =>
          clearDeletionAudit.mutate({
            adminPassword,
            eventYear: yearFilter === "all" ? undefined : Number(yearFilter),
            eventId: eventFilter === "all" ? undefined : Number(eventFilter),
          })
        }
      />

      <AdminPasswordDialog
        open={resetFileHistoryOpen}
        onOpenChange={setResetFileHistoryOpen}
        title="Datei- und Import-Historie leeren?"
        description="Alle Datei- und Importhistorien der aktuell gewählten Veranstaltung und des gewählten Jahres werden dauerhaft gelöscht. Die Planungsdaten selbst bleiben unverändert."
        confirmLabel="Historie endgültig leeren"
        busy={clearFileHistory.isPending}
        onConfirm={adminPassword => clearFileHistory.mutate({ adminPassword })}
      />

      <Dialog
        open={selectedFileLogId !== null}
        onOpenChange={open => !open && setSelectedFileLogId(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" /> Importdetails
            </DialogTitle>
            <DialogDescription>
              Jede tatsächlich übernommene Einzeländerung des ausgewählten
              Datei- oder Importvorgangs.
            </DialogDescription>
          </DialogHeader>
          {fileLogDetail.isLoading ? (
            <p className="text-sm text-muted-foreground">Details werden geladen …</p>
          ) : fileLogDetail.error ? (
            <p className="text-sm text-destructive">{fileLogDetail.error.message}</p>
          ) : (
            <GroupedChangeList changes={fileLogDetail.data?.changes ?? []} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** @deprecated Kompatibilitätsalias für bisherige Importe. */
export const ProtocolLog = AuditCenter;

export default AuditCenter;
