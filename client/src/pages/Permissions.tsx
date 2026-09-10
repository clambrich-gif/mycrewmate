import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
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
import { History, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";

const permissionColor = (value: string) => {
  if (value === "Kein Zugriff")
    return "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-100";
  if (value.startsWith("Nur "))
    return "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-100";
  if (value === "Vollzugriff")
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
  return "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
};

const actionLabel = {
  single_delete: "Einzellöschung",
  area_reset: "Bereichsreset",
  year_reset: "Jahresreset",
} as const;

const entityLabel = {
  helper: "Helfer",
  cake: "Kuchen",
} as const;

function detailText(entityType: "helper" | "cake", value: string | null) {
  if (!value) return "–";
  try {
    const details = JSON.parse(value) as Record<string, unknown>;
    if (entityType === "helper") {
      return [
        `Helfen: ${details.willHelp === "ja" ? "Ja" : "Nein"}`,
        `Fr/Sa/So: ${details.availFri ?? "–"}/${details.availSat ?? "–"}/${details.availSun ?? "–"}`,
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
    return [
      details.cake ? `Kuchen: ${details.cake}` : "Kuchen nicht angegeben",
      details.dropoffTime ? `Abgabe: ${details.dropoffTime}` : null,
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
  const [typeFilter, setTypeFilter] = useState("all");
  const { data: years = [] } = trpc.years.list.useQuery();
  const auditInput = useMemo(
    () => ({
      eventYear: yearFilter === "all" ? undefined : Number(yearFilter),
      entityType:
        typeFilter === "all" ? undefined : (typeFilter as "helper" | "cake"),
      limit: 500,
    }),
    [typeFilter, yearFilter]
  );
  const audit = trpc.audit.deletions.useQuery(auditInput, {
    enabled: isAdmin,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rollen & Berechtigungen</h1>
        <p className="text-muted-foreground">
          Transparente Übersicht der Rechte für Planungsteam und
          Administratoren. Die Matrix entspricht den serverseitig erzwungenen
          Zugriffsregeln.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-amber-200 bg-amber-50/60 shadow-sm dark:bg-amber-950/20">
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
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-emerald-700" /> Administrator
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Verwaltet Einsatzplan, Importe, Zugänge und sensible Lösch- oder
            Resetvorgänge.
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Berechtigungsmatrix</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[850px] text-sm">
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

      <Card className="shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" /> Löschprotokoll
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Unveränderliche Nachweise über gelöschte Helfer und
              Kucheneinträge.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Helfer & Kuchen</SelectItem>
                  <SelectItem value="helper">Nur Helfer</SelectItem>
                  <SelectItem value="cake">Nur Kuchen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className={cn(isAdmin && "overflow-x-auto p-0")}>
          {!isAdmin ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Das Löschprotokoll ist ausschließlich für Administratoren
              sichtbar.
            </div>
          ) : audit.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Löschprotokoll wird geladen …
            </p>
          ) : audit.error ? (
            <p className="p-5 text-sm text-destructive">
              {audit.error.message}
            </p>
          ) : audit.data?.length ? (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="p-3">Zeitpunkt</th>
                  <th className="p-3">Jahr</th>
                  <th className="p-3">Art</th>
                  <th className="p-3">Gelöschter Eintrag</th>
                  <th className="p-3">Vorgang</th>
                  <th className="p-3">Ausgeführt von</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map(entry => (
                  <tr key={entry.id} className="border-t align-top">
                    <td className="whitespace-nowrap p-3">
                      {new Date(entry.createdAt).toLocaleString("de-DE")}
                    </td>
                    <td className="p-3">{entry.year}</td>
                    <td className="p-3">{entityLabel[entry.entityType]}</td>
                    <td className="p-3 font-medium">{entry.entityLabel}</td>
                    <td className="p-3">{actionLabel[entry.action]}</td>
                    <td className="p-3">
                      {entry.actorName}
                      <div className="text-xs text-muted-foreground">
                        {entry.actorRole === "admin"
                          ? "Administrator"
                          : "Planungsteam"}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {detailText(entry.entityType, entry.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Für die gewählten Filter liegen noch keine Löschungen vor.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
