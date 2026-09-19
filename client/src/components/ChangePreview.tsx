import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import type { BackupChange } from "../../../server/excel-backup";

export type ChangeFilter = "all" | "create" | "update" | "delete";

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

const fieldLabel: Record<string, string> = {
  name: "Name",
  phone: "Telefon",
  email: "E-Mail",
  note: "Bemerkung",
  contactSourceId: "Ansprechpartner",
  areaContactSourceId: "Bereichsansprechpartner",
  helperSourceId: "Helfer",
  day: "Tag",
  area: "Bereich",
  task: "Aufgabe",
  startTime: "Beginn",
  endTime: "Ende",
  needed: "Bedarf",
  dueText: "Zu erledigen bis",
  status: "Status",
  article: "Artikel",
  category: "Kategorie",
  quantity: "Menge",
  unit: "Einheit",
  ordered: "Bestellt",
  measure: "Maßnahme",
  channel: "Kanal",
  request: "Antrag",
  donor: "Spender",
  cake: "Spende",
  donationCategory: "Kategorie",
  meat: "Fleischhaltig",
  dropoffTime: "Abgabezeit",
  income: "Einnahmen",
  expense: "Ausgaben",
  activeDays: "Veranstaltungstage",
};

const areaLabel: Record<string, string> = {
  VERANSTALTUNG: "Veranstaltung",
  ANSPRECHPARTNER: "Ansprechpartner",
  HELFER: "Helfer",
  EINSATZPLAN: "Einsatzplan",
  ZUORDNUNGEN: "Helferzuordnungen",
  VORBEREITUNG: "Vorbereitung",
  NACHBEREITUNG: "Nachbereitung",
  MATERIAL: "Material",
  MARKETING: "Marketing",
  GENEHMIGUNGEN: "Genehmigungen",
  KUCHEN: "Spenden",
  FINANZEN: "Finanzen",
};

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "–";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return "geänderter Bezug";
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function changeValue(
  change: BackupChange,
  side: "before" | "after",
  field: string
) {
  const row = change[side];
  if (!row) return "–";
  if (field === "contactSourceId")
    return display(row.contactName ?? row[field]);
  if (field === "areaContactSourceId")
    return display(row.areaContactName ?? row[field]);
  if (field === "helperSourceId") return display(row.helperName ?? row[field]);
  return display(row[field]);
}

export function ChangeRow({ change }: { change: BackupChange }) {
  const meta = actionMeta[change.action];
  const Icon = meta.icon;
  return (
    <div className="grid gap-3 rounded-lg border bg-white p-3 text-sm sm:grid-cols-[145px_1fr] dark:bg-slate-950">
      <Badge variant="outline" className={`h-fit w-fit ${meta.badge}`}>
        <Icon className="mr-1.5 h-3.5 w-3.5" /> {meta.label}
      </Badge>
      <div className="min-w-0">
        <div className="font-semibold break-words">{change.label}</div>
        {change.action === "update" && change.fields.length > 0 && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {change.fields.slice(0, 10).map(field => (
              <div key={field} className="break-words">
                <span className="font-medium text-foreground">
                  {change.area === "MATERIAL" && field === "status"
                    ? "Stand"
                    : fieldLabel[field] ?? field}:
                </span>{" "}
                {changeValue(change, "before", field)} →{" "}
                {changeValue(change, "after", field)}
              </div>
            ))}
          </div>
        )}
        {change.action === "delete" && (
          <div className="mt-1 text-xs font-medium text-red-700">
            Dieser Eintrag fehlt in der Excel-Datei und wird im gewählten
            Bereich entfernt.
          </div>
        )}
      </div>
    </div>
  );
}

export function ChangeFilterBar({
  value,
  onChange,
  counts,
  createLabel = "Nur neue Daten",
}: {
  value: ChangeFilter;
  onChange: (value: ChangeFilter) => void;
  counts: { created: number; updated: number; deleted: number };
  createLabel?: string;
}) {
  const options: Array<{ value: ChangeFilter; label: string; count: number }> =
    [
      {
        value: "all",
        label: "Alle Änderungen",
        count: counts.created + counts.updated + counts.deleted,
      },
      { value: "create", label: createLabel, count: counts.created },
      { value: "update", label: "Nur Änderungen", count: counts.updated },
      { value: "delete", label: "Nur Löschungen", count: counts.deleted },
    ];
  return (
    <div
      className="flex flex-wrap gap-2"
      aria-label="Änderungsvorschau filtern"
    >
      {options.map(option => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          className="bg-white dark:bg-slate-950"
          onClick={() => onChange(option.value)}
        >
          {option.label} ({option.count})
        </Button>
      ))}
    </div>
  );
}

export function GroupedChangeList({
  changes,
  filter = "all",
}: {
  changes: BackupChange[];
  filter?: ChangeFilter;
}) {
  const visible = changes.filter(
    change => filter === "all" || change.action === filter
  );
  const groups = new Map<string, BackupChange[]>();
  for (const change of visible) {
    const rows = groups.get(change.area) ?? [];
    rows.push(change);
    groups.set(change.area, rows);
  }
  if (!visible.length)
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Für diesen Filter gibt es keine Einträge.
      </p>
    );
  return (
    <div className="space-y-3">
      {Array.from(groups.entries()).map(([area, rows]) => (
        <details key={area} open className="rounded-xl border bg-muted/20">
          <summary className="cursor-pointer select-none px-4 py-3 font-semibold">
            {areaLabel[area] ?? area} · {rows.length} Eintrag
            {rows.length === 1 ? "" : "e"}
          </summary>
          <div className="space-y-2 border-t p-3">
            {rows.map((change, index) => (
              <ChangeRow key={`${change.key}:${index}`} change={change} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
