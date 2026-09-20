import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { PageTitle } from "@/components/PageTitle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PERMISSION_MATRIX } from "@shared/permissions";
import { History, RotateCcw, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const permissionColor = (value: string) => {
  if (value === "Kein Zugriff")
    return "border-red-300 bg-red-50 text-red-800";
  if (value.startsWith("Nur "))
    return "border-sky-300 bg-sky-50 text-sky-800";
  if (value === "Vollzugriff")
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  return "border-amber-300 bg-amber-50 text-amber-900";
};

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

export default function Permissions() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [yearFilter, setYearFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [resetOpen, setResetOpen] = useState(false);
  const [protocolView, setProtocolView] = useState<"deletions" | "activities">(
    "deletions"
  );
  const { data: years = [] } = trpc.years.list.useQuery();
  const { data: events = [] } = trpc.events.all.useQuery();
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
  const audit = trpc.audit.deletions.useQuery(auditInput, {
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
  const utils = trpc.useUtils();
  const clearAudit = trpc.audit.clear.useMutation({
    onSuccess: async () => {
      setResetOpen(false);
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

  const activityActionBadge = (action: string) => {
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
        return <Badge className="bg-purple-100 text-purple-800">Kopiert</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <PageTitle icon="permissions">Rollen & Berechtigungen</PageTitle>
        <p className="text-muted-foreground">
          Transparente Übersicht der Rechte für Planungsteam und
          Administratoren. Die Matrix entspricht den serverseitig erzwungenen
          Zugriffsregeln.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-amber-700" /> Planungsteam
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Bearbeitet operative Listen. Der Einsatzplan bleibt sichtbar und
            filterbar, aber vor Änderungen geschützt.
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-emerald-700" /> Administrator
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Verwaltet Einsatzplan, Datensicherungen, Zugänge und sensible Lösch-
            oder Resetvorgänge.
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Berechtigungsmatrix</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-0">
          <div className="space-y-3 md:hidden">
            {PERMISSION_MATRIX.map(row => (
              <div key={row.area} className="space-y-3 rounded-lg border p-3">
                <div className="font-semibold">{row.area}</div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Planungsteam
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "whitespace-normal",
                      permissionColor(row.planningTeam)
                    )}
                  >
                    {row.planningTeam}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Administrator
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "whitespace-normal",
                      permissionColor(row.administrator)
                    )}
                  >
                    {row.administrator}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{row.note}</p>
              </div>
            ))}
          </div>
          <table className="hidden w-full min-w-[850px] text-sm md:table">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-3">Bereich</th>
                <th className="p-3">Planungsteam</th>
                <th className="p-3">Administrator</th>
                <th className="p-3">Erläuterung</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map(row => (
                <tr key={row.area} className="border-t align-top">
                  <td className="p-3 font-medium">{row.area}</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-normal",
                        permissionColor(row.planningTeam)
                      )}
                    >
                      {row.planningTeam}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-normal",
                        permissionColor(row.administrator)
                      )}
                    >
                      {row.administrator}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="min-w-0 max-w-full overflow-hidden shadow-sm lg:mr-24">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              {protocolView === "deletions"
                ? "Löschprotokoll & Wiederherstellung"
                : "Aktivitätsprotokoll (Echtzeit-Verlauf)"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {protocolView === "deletions"
                ? "Nachvollziehbare Nachweise über gelöschte Helfer, Spenden, Material sowie Vor- und Nachbereitungsaufgaben mit gezielter Wiederherstellung."
                : "Alle operativen Aktionen werden serverseitig fälschungssicher mit der angemeldeten Sitzungsidentität protokolliert."}
            </p>
          </div>
          {isAdmin && (
            <div className="inline-flex rounded-lg border bg-muted/50 p-1 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  protocolView === "deletions"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-slate-900"
                )}
                onClick={() => setProtocolView("deletions")}
              >
                Löschungen ({audit.data?.length ?? 0})
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  protocolView === "activities"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-slate-900"
                )}
                onClick={() => setProtocolView("activities")}
              >
                Aktivitäten ({activities.data?.length ?? 0})
              </button>
            </div>
          )}
        </div>
          {isAdmin && (
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
              {protocolView === "deletions" && (
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
                      item =>
                        yearFilter === "all" || item.year === Number(yearFilter)
                    )
                    .map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.year} · {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {protocolView === "deletions" && (
                <Button
                variant="outline"
                className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Protokoll zurücksetzen
              </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent
          className={cn(
            "min-w-0 max-w-full overflow-hidden",
            isAdmin && "p-3 md:px-0 md:pt-0 md:pb-28"
          )}
        >
          {!isAdmin ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Die Protokolle sind ausschließlich für Administratoren
              sichtbar.
            </div>
          ) : protocolView === "activities" ? (
            activities.isLoading ? (
              <p className="p-5 text-sm text-muted-foreground">
                Aktivitätsprotokoll wird geladen …
              </p>
            ) : activities.error ? (
              <p className="p-5 text-sm text-destructive">
                {activities.error.message}
              </p>
            ) : activities.data?.length ? (
              <div className="w-full max-w-full overflow-hidden">
                <table className="w-full max-w-full table-fixed text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="w-[14%] p-3 text-left">Zeitpunkt</th>
                      <th className="w-[16%] p-3 text-left">Veranstaltung</th>
                      <th className="w-[14%] p-3 text-left">Bereich</th>
                      <th className="w-[16%] p-3 text-left">Ausgeführt von</th>
                      <th className="w-[40%] p-3 text-left">Aktion &amp; Gegenstand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.data.map(entry => (
                      <tr key={entry.id} className="border-t align-top">
                        <td className="p-3 text-xs leading-relaxed text-slate-600">
                          {new Date(entry.createdAt).toLocaleString("de-DE")}
                        </td>
                        <td className="p-3 text-xs font-medium text-slate-800">
                          {entry.eventName}
                        </td>
                        <td className="p-3 text-xs text-slate-700">
                          {entry.module}
                        </td>
                        <td className="p-3 text-xs leading-relaxed">
                          <div className="font-semibold text-slate-900">
                            {entry.actorName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {entry.actorRole === "admin"
                              ? "Administrator"
                              : "Planungsteam"}
                          </div>
                        </td>
                        <td className="p-3 text-xs leading-relaxed">
                          <div className="mb-1">{activityActionBadge(entry.action)}</div>
                          <div className="text-slate-800">{entry.subject}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Für die gewählten Filter liegen noch keine Aktivitäten vor.
              </div>
            )
          ) : audit.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Löschprotokoll wird geladen …
            </p>
          ) : audit.error ? (
            <p className="p-5 text-sm text-destructive">
              {audit.error.message}
            </p>
          ) : audit.data?.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {audit.data.map(entry => (
                  <div
                    key={entry.id}
                    className="space-y-2 rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{entry.entityLabel}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString("de-DE")}
                        </div>
                      </div>
                      <Badge
                        className="max-w-[45%] break-words whitespace-normal text-left"
                        variant="outline"
                      >
                        {entityLabel[entry.entityType]} · {entry.year}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Veranstaltung:
                      </span>{" "}
                      {entry.eventName ?? "nicht zugeordnet"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vorgang:</span>{" "}
                      {actionLabel[entry.action]}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {entry.action === "single_delete"
                          ? "Gelöscht von:"
                          : "Ausgeführt von:"}
                      </span>{" "}
                      {entry.actorName} (
                      {entry.actorRole === "admin"
                        ? "Administrator"
                        : "Planungsteam"}
                      )
                    </div>
                    {entry.responsibleContactName && (
                      <div className="text-xs text-muted-foreground">
                        Historische Zusatzangabe: {entry.responsibleContactName}
                      </div>
                    )}
                    <div className="break-words whitespace-normal [overflow-wrap:anywhere] text-muted-foreground">
                      {detailText(entry.entityType, entry.details)}
                    </div>
                    {entry.restoredAt ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        Wiederhergestellt durch{" "}
                        {entry.restoredByName ?? "Administrator"}
                      </Badge>
                    ) : entry.action === "single_delete" ? (
                      <Button
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
              <div className="hidden w-full max-w-full overflow-hidden md:block">
                <table className="w-full max-w-full table-fixed text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="w-[12%] break-words p-3 text-left">Zeitpunkt</th>
                      <th className="w-[13%] break-words p-3 text-left">Veranstaltung</th>
                      <th className="w-[15%] break-words p-3 text-left">Gelöschter Eintrag</th>
                      <th className="w-[15%] break-words p-3 text-left">Vorgang &amp; ausgeführt von</th>
                      <th className="w-[30%] break-words p-3 text-left">Details</th>
                      <th className="w-[15%] break-words p-3 text-left">Wiederherstellung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.map(entry => (
                      <tr key={entry.id} className="border-t align-top">
                        <td className="break-words whitespace-normal p-3 align-top leading-relaxed [overflow-wrap:anywhere]">
                          {new Date(entry.createdAt).toLocaleString("de-DE")}
                        </td>
                        <td className="break-words whitespace-normal p-3 align-top leading-relaxed [overflow-wrap:anywhere]">
                          {entry.eventName ?? "nicht zugeordnet"}
                        </td>
                        <td className="break-words p-3 align-top font-medium leading-relaxed [overflow-wrap:anywhere]">
                          {entry.entityLabel}
                          <div className="mt-1 text-xs font-normal text-muted-foreground">
                            {entityLabel[entry.entityType]}
                          </div>
                        </td>
                        <td className="break-words whitespace-normal p-3 align-top leading-relaxed [overflow-wrap:anywhere]">
                          <div className="font-medium">{actionLabel[entry.action]}</div>
                          {entry.action === "single_delete" ? "Gelöscht von: " : ""}
                          {entry.actorName}
                          <div className="text-xs text-muted-foreground">
                            {entry.actorRole === "admin"
                              ? "Administrator"
                              : "Planungsteam"}
                          </div>
                          {entry.responsibleContactName && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Historische Zusatzangabe: {entry.responsibleContactName}
                            </div>
                          )}
                        </td>
                        <td className="break-words whitespace-normal p-3 align-top leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                          {detailText(entry.entityType, entry.details)}
                        </td>
                        <td className="break-words whitespace-normal px-2 py-3 align-top leading-relaxed [overflow-wrap:anywhere]">
                          {entry.restoredAt ? (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Wiederhergestellt
                            </Badge>
                          ) : entry.action === "single_delete" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full min-w-0 justify-center whitespace-nowrap px-2"
                              disabled={restoreAudit.isPending}
                              onClick={() =>
                                restoreAudit.mutate({ id: entry.id })
                              }
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Wiederherstellen
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
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
            <div className="p-8 text-center text-sm text-muted-foreground">
              Für die gewählten Filter liegen noch keine Löschungen vor.
            </div>
          )}
        </CardContent>
      </Card>
      <AdminPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Löschprotokoll zurücksetzen?"
        description={
          eventFilter !== "all"
            ? `Alle Einträge des Löschprotokolls für ${events.find(item => item.id === Number(eventFilter))?.name ?? "die gewählte Veranstaltung"} werden dauerhaft entfernt.`
            : yearFilter === "all"
              ? "Alle Einträge des Löschprotokolls über sämtliche Jahre werden dauerhaft entfernt."
              : `Alle Einträge des Löschprotokolls für ${yearFilter} werden dauerhaft entfernt.`
        }
        confirmLabel="Protokoll endgültig löschen"
        busy={clearAudit.isPending}
        onConfirm={adminPassword =>
          clearAudit.mutate({
            adminPassword,
            eventYear: yearFilter === "all" ? undefined : Number(yearFilter),
            eventId: eventFilter === "all" ? undefined : Number(eventFilter),
          })
        }
      />
    </div>
  );
}
