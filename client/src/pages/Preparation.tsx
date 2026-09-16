import { useMemo, useState } from "react";
import { useSearchParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  ArrowUpDown,
  Search,
  FilterX,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import {
  parseTaskStatusFilter,
  TASK_STATUS_QUERY_KEY,
  type TaskStatusFilter,
} from "@/lib/dashboard-target-filter";

type PrepStatus = "offen" | "inArbeit" | "erledigt" | "abgelehnt";
type PrepWording = "aufgabe" | "genehmigung";

function temporaryId() {
  return -Math.floor(Math.random() * 1_000_000 + 1);
}

function getStatusLabel(status: PrepStatus, wording: PrepWording) {
  if (status === "offen") return "Offen";
  if (status === "inArbeit") {
    return wording === "genehmigung" ? "Beantragt" : "In Arbeit";
  }
  if (status === "erledigt") {
    return wording === "genehmigung" ? "Genehmigt" : "Erledigt";
  }
  return "Abgelehnt";
}

function getStatusBadgeClass(status: PrepStatus) {
  switch (status) {
    case "offen":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "inArbeit":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "erledigt":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "abgelehnt":
      return "border-rose-200 bg-rose-50 text-rose-900 font-semibold";
  }
}

export default function Preparation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatusFilter = searchParams.get(TASK_STATUS_QUERY_KEY);
  const statusFilter: TaskStatusFilter = parseTaskStatusFilter(rawStatusFilter);

  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [contactFilter, setContactFilter] = useState<string>("alle");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortAsc, setSortAsc] = useState(true);

  // Formular-Felder
  const [taskText, setTaskText] = useState("");
  const [categoryText, setCategoryText] = useState("");
  const [contactId, setContactId] = useState<string>("none");
  const [dueText, setDueText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [formStatus, setFormStatus] = useState<PrepStatus>("offen");
  const [formWording, setFormWording] = useState<PrepWording>("aufgabe");

  // Optionale Feld-Aktivierungsschalter (Checkboxen / Toggles)
  const [includeCategory, setIncludeCategory] = useState(false);
  const [includeContact, setIncludeContact] = useState(false);
  const [includeDue, setIncludeDue] = useState(false);
  const [includeNote, setIncludeNote] = useState(false);

  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.prep.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();

  const refreshDashboard = () => void utils.dashboard.stats.invalidate();

  const create = trpc.prep.create.useMutation({
    onMutate: async (input: any) => {
      await utils.prep.list.cancel();
      const previous = utils.prep.list.getData();
      const optimisticId = temporaryId();
      utils.prep.list.setData(undefined, (current: any[] = []) => [
        ...current,
        {
          id: optimisticId,
          year: 0,
          eventId: 0,
          category: input.category ?? "",
          task: input.task,
          dueText: input.dueText ?? "",
          contactId: input.contactId ?? null,
          status: input.status ?? "offen",
          statusWording: input.statusWording ?? "aufgabe",
          note: input.note ?? null,
          sortOrder: 0,
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: (created: any, _input: any, context: any) => {
      utils.prep.list.setData(undefined, (current: any[] = []) =>
        current.map(row => (row.id === context?.optimisticId ? created : row))
      );
      setTaskText("");
      setCategoryText("");
      setContactId("none");
      setDueText("");
      setNoteText("");
      setFormStatus("offen");
      toast.success("Vorbereitungsaufgabe hinzugefügt");
    },
    onError: (error: any, _input: any, context: any) => {
      utils.prep.list.setData(undefined, context?.previous);
      toast.error(error.message || "Fehler beim Anlegen der Vorbereitungsaufgabe");
    },
    onSettled: () => {
      void utils.prep.list.invalidate();
      refreshDashboard();
    },
  });

  const update = trpc.prep.update.useMutation({
    onMutate: async (input: any) => {
      await utils.prep.list.cancel();
      const previous = utils.prep.list.getData();
      utils.prep.list.setData(undefined, (current: any[] = []) =>
        current.map(row => (row.id === input.id ? { ...row, ...input } : row))
      );
      return { previous };
    },
    onError: (error: any, _input: any, context: any) => {
      utils.prep.list.setData(undefined, context?.previous);
      toast.error(error.message || "Aktualisierung fehlgeschlagen");
    },
    onSettled: () => {
      void utils.prep.list.invalidate();
      refreshDashboard();
    },
  });

  const remove = trpc.prep.remove.useMutation({
    onMutate: async (input: any) => {
      await utils.prep.list.cancel();
      const previous = utils.prep.list.getData();
      utils.prep.list.setData(undefined, (current: any[] = []) =>
        current.filter(row => row.id !== input.id)
      );
      return { previous };
    },
    onError: (error: any, _input: any, context: any) => {
      utils.prep.list.setData(undefined, context?.previous);
      toast.error(error.message || "Löschen fehlgeschlagen");
    },
    onSettled: () => {
      void utils.prep.list.invalidate();
      refreshDashboard();
    },
  });

  const submitCreate = () => {
    const trimmedTask = taskText.trim();
    if (!trimmedTask) {
      toast.error("Bitte eine Aufgabenbezeichnung eingeben");
      return;
    }
    create.mutate({
      task: trimmedTask,
      category: includeCategory && categoryText.trim() ? categoryText.trim() : "",
      contactId:
        includeContact && contactId !== "none" ? Number(contactId) : null,
      dueText: includeDue && dueText.trim() ? dueText.trim() : "",
      note: includeNote && noteText.trim() ? noteText.trim() : undefined,
      status: formStatus,
      statusWording: formWording,
    });
  };

  const updateStatusFilter = (value: TaskStatusFilter) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete(TASK_STATUS_QUERY_KEY);
        else next.set(TASK_STATUS_QUERY_KEY, value);
        return next;
      },
      { replace: true }
    );
  };

  // Liste aller verfügbaren Kategorien für Datalist und Filter
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.category && row.category.trim()) {
        set.add(row.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  // Gefilterte Zeilen in Echtzeit
  const filteredRows = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return rows
      .filter(row => {
        // Statusfilter
        if (statusFilter !== "alle" && row.status !== statusFilter) return false;

        // Kategoriefilter
        if (categoryFilter === "ohne") {
          if (row.category && row.category.trim()) return false;
        } else if (categoryFilter !== "alle") {
          if ((row.category || "").trim() !== categoryFilter) return false;
        }

        // Kontaktfilter
        if (contactFilter === "ohne") {
          if (row.contactId) return false;
        } else if (contactFilter !== "alle") {
          if (String(row.contactId ?? "") !== contactFilter) return false;
        }

        // Volltextsuche: Aufgabe, Bemerkung, Frist, Kategorie
        if (normalizedQuery) {
          const inTask = (row.task || "").toLowerCase().includes(normalizedQuery);
          const inNote = (row.note || "").toLowerCase().includes(normalizedQuery);
          const inDue = (row.dueText || "").toLowerCase().includes(normalizedQuery);
          const inCategory = (row.category || "")
            .toLowerCase()
            .includes(normalizedQuery);
          if (!inTask && !inNote && !inDue && !inCategory) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const comp = String(a.task).localeCompare(String(b.task), "de", {
          sensitivity: "base",
        });
        return sortAsc ? comp : -comp;
      });
  }, [rows, statusFilter, categoryFilter, contactFilter, searchTerm, sortAsc]);

  const contactMap = useMemo(
    () => new Map(contacts.map(c => [c.id, c.name])),
    [contacts]
  );

  const resetAllFilters = () => {
    updateStatusFilter("alle");
    setCategoryFilter("alle");
    setContactFilter("alle");
    setSearchTerm("");
  };

  const hasActiveFilters =
    statusFilter !== "alle" ||
    categoryFilter !== "alle" ||
    contactFilter !== "alle" ||
    Boolean(searchTerm.trim());

  return (
    <div className="space-y-6">
      {/* Header & Modul-Aktionen */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vorbereitung</h1>
          <p className="text-muted-foreground text-sm">
            Aufgabenverwaltung für die Festival-Vorbereitung mit flexiblen
            Feldern, Status-Wortlaut und Filterleiste.
          </p>
        </div>

        {/* Responsive Aktions-Buttons: Mobil 2-Spalten-Grid */}
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          <ModuleExcelImportButton area="VORBEREITUNG" label="Vorbereitung" />
          <ResetAreaButton area="prep" label="Vorbereitung" compact />
        </div>
      </div>

      {/* Neue Vorbereitungsaufgabe anlegen (Hervorgehobene Aktions-Karte mit optionalen Checkbox-Toggles) */}
      <Card className="border-indigo-100 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
            <span className="font-semibold text-sm text-slate-800">
              Neue Vorbereitungsaufgabe erfassen
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="font-medium text-slate-500">Optionale Felder:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={includeCategory}
                  onCheckedChange={c => setIncludeCategory(Boolean(c))}
                />
                <span>Bereich / Kategorie</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={includeContact}
                  onCheckedChange={c => setIncludeContact(Boolean(c))}
                />
                <span>Verantwortlicher</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={includeDue}
                  onCheckedChange={c => setIncludeDue(Boolean(c))}
                />
                <span>Frist (Freitext)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={includeNote}
                  onCheckedChange={c => setIncludeNote(Boolean(c))}
                />
                <span>Bemerkungen</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {/* Pflichtfeld Aufgabe */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Aufgabe / Bezeichnung *
              </label>
              <Input
                placeholder="z. B. Genehmigung Streckenverlauf einholen"
                value={taskText}
                onChange={e => setTaskText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitCreate()}
                className="w-full text-base sm:text-sm"
              />
            </div>

            {/* Dynamische optionale Felder */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {includeCategory && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Bereich / Kategorie
                  </label>
                  <Input
                    list="category-options"
                    placeholder="Bestehende wählen oder neu eingeben"
                    value={categoryText}
                    onChange={e => setCategoryText(e.target.value)}
                    className="w-full text-base sm:text-sm"
                  />
                  <datalist id="category-options">
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              )}

              {includeContact && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Verantwortlicher
                  </label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger className="w-full h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Ansprechpartner wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Keine Zuordnung —</SelectItem>
                      {contacts.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {includeDue && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Frist / Abgabedatum (Freitext)
                  </label>
                  <Input
                    placeholder="z. B. Ende März, 14 Tage vorher"
                    value={dueText}
                    onChange={e => setDueText(e.target.value)}
                    className="w-full text-base sm:text-sm"
                  />
                </div>
              )}
            </div>

            {includeNote && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Bemerkungen / Informationen
                </label>
                <Textarea
                  placeholder="Details, Links oder besondere Absprachen …"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={2}
                  className="w-full text-base sm:text-sm"
                />
              </div>
            )}

            {/* Status-Auswahl & Wording-Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  Status-Wortlaut:
                </span>
                <div className="inline-flex rounded-lg border bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFormWording("aufgabe")}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      formWording === "aufgabe"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Aufgabe (In Arbeit / Erledigt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormWording("genehmigung")}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      formWording === "genehmigung"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Genehmigung (Beantragt / Genehmigt)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Start-Status:
                </span>
                {(["offen", "inArbeit", "erledigt", "abgelehnt"] as const).map(
                  st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFormStatus(st)}
                      className={`text-xs px-2.5 py-1 rounded-md border font-medium transition ${
                        formStatus === st
                          ? getStatusBadgeClass(st) + " ring-1 ring-slate-400"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {getStatusLabel(st, formWording)}
                    </button>
                  )
                )}
              </div>

              <Button
                type="button"
                onClick={submitCreate}
                disabled={!taskText.trim() || create.isPending}
                className="w-full sm:w-auto ml-auto"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span>{create.isPending ? "Speichert …" : "Aufgabe anlegen"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard-Hinweisbanner bei aktivem Status-Filter */}
      {statusFilter !== "alle" && (
        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            statusFilter === "abgelehnt"
              ? "border-rose-300 bg-rose-50 text-rose-950"
              : "border-blue-200 bg-blue-50 text-blue-950"
          }`}
        >
          <div role="status" aria-live="polite" className="flex items-center gap-2">
            {statusFilter === "abgelehnt" && (
              <AlertTriangle className="size-5 text-rose-600 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {statusFilter === "abgelehnt"
                  ? "Abgelehnte Vorbereitungen"
                  : statusFilter === "offen"
                    ? "Nur offene Vorbereitungen"
                    : statusFilter === "inArbeit"
                      ? "Nur Vorbereitungen in Arbeit / beantragt"
                      : "Nur erledigte / genehmigte Vorbereitungen"}
              </p>
              <p className="text-sm opacity-90">
                Die Liste zeigt ausschließlich Einträge mit diesem Status.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 bg-white"
            onClick={() => updateStatusFilter("alle")}
          >
            Filter aufheben
          </Button>
        </div>
      )}

      {/* Filter- und Suchleiste (Echtzeit, analog zum Einsatzplan) */}
      <div className="space-y-3 rounded-xl border bg-slate-50/70 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {/* Volltext-Suche */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Aufgabe, Bemerkung, Frist, Bereich …"
              className="pl-9 pr-8 bg-white h-11 sm:h-10 text-base sm:text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Bereichs- / Kategorie-Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-white h-11 sm:h-10 text-base sm:text-sm">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Bereiche</SelectItem>
              <SelectItem value="ohne">Ohne Bereich</SelectItem>
              {availableCategories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Verantwortlicher-Filter */}
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="bg-white h-11 sm:h-10 text-base sm:text-sm">
              <SelectValue placeholder="Verantwortlich" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Verantwortlichen</SelectItem>
              <SelectItem value="ohne">Ohne Zuweisung</SelectItem>
              {contacts.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status-Filter */}
          <Select
            value={statusFilter}
            onValueChange={val => updateStatusFilter(val as TaskStatusFilter)}
          >
            <SelectTrigger className="bg-white h-11 sm:h-10 text-base sm:text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="inArbeit">In Arbeit / Beantragt</SelectItem>
              <SelectItem value="erledigt">Erledigt / Genehmigt</SelectItem>
              <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              {filteredRows.length} von {rows.length} Aufgaben angezeigt
            </span>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
              >
                <FilterX className="size-3.5 mr-1" />
                Alle Filter zurücksetzen
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSortAsc(v => !v)}
            className="h-8 text-xs bg-white"
          >
            <ArrowUpDown className="size-3.5 mr-1.5" />
            <span>Sortierung: {sortAsc ? "A → Z" : "Z → A"}</span>
          </Button>
        </div>
      </div>

      {/* Aufgabenliste */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Vorbereitungsaufgaben werden geladen …
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Keine Aufgaben entsprechen den aktuellen Filterkriterien."
            : "Noch keine Vorbereitungsaufgaben angelegt."}
        </div>
      ) : (
        <>
          {/* Desktop-Tabelle (ab lg) */}
          <div className="hidden lg:block overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50/80 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4 w-44">Bereich / Kategorie</th>
                  <th className="py-3 px-4 min-w-[220px]">Aufgabe</th>
                  <th className="py-3 px-4 w-44">Frist (Freitext)</th>
                  <th className="py-3 px-4 w-48">Verantwortlicher</th>
                  <th className="py-3 px-4 w-48">Status</th>
                  <th className="py-3 px-4 min-w-[200px]">Bemerkung</th>
                  <th className="py-3 px-4 w-16 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {filteredRows.map(row => {
                  const currentWording: PrepWording =
                    row.statusWording === "genehmigung"
                      ? "genehmigung"
                      : "aufgabe";

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/60 transition ${
                        row.status === "abgelehnt" ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* Bereich / Kategorie */}
                      <td className="py-2.5 px-4 align-top">
                        <Input
                          defaultValue={row.category ?? ""}
                          placeholder="— Bereich —"
                          list="category-options"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (row.category ?? "")) {
                              update.mutate({ id: row.id, category: val });
                            }
                          }}
                          className="h-9 text-xs"
                        />
                      </td>

                      {/* Aufgabe */}
                      <td className="py-2.5 px-4 align-top">
                        <Input
                          defaultValue={row.task}
                          placeholder="Aufgabe"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val && val !== row.task) {
                              update.mutate({ id: row.id, task: val });
                            }
                          }}
                          className="h-9 text-xs font-medium"
                        />
                      </td>

                      {/* Frist (Freitext) */}
                      <td className="py-2.5 px-4 align-top">
                        <Input
                          defaultValue={row.dueText ?? ""}
                          placeholder="z. B. Ende März"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (row.dueText ?? "")) {
                              update.mutate({ id: row.id, dueText: val });
                            }
                          }}
                          className="h-9 text-xs"
                        />
                      </td>

                      {/* Verantwortlicher */}
                      <td className="py-2.5 px-4 align-top">
                        <Select
                          value={row.contactId ? String(row.contactId) : "none"}
                          onValueChange={val =>
                            update.mutate({
                              id: row.id,
                              contactId: val === "none" ? null : Number(val),
                            })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="— Keine Zuordnung —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Keine Zuordnung —</SelectItem>
                            {contacts.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Status + Wording Umschalter */}
                      <td className="py-2.5 px-4 align-top">
                        <div className="space-y-1.5">
                          <Select
                            value={row.status}
                            onValueChange={val =>
                              update.mutate({
                                id: row.id,
                                status: val as PrepStatus,
                              })
                            }
                          >
                            <SelectTrigger
                              className={`h-9 text-xs font-medium ${getStatusBadgeClass(
                                row.status as PrepStatus
                              )}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offen">Offen</SelectItem>
                              <SelectItem value="inArbeit">
                                {currentWording === "genehmigung"
                                  ? "Beantragt"
                                  : "In Arbeit"}
                              </SelectItem>
                              <SelectItem value="erledigt">
                                {currentWording === "genehmigung"
                                  ? "Genehmigt"
                                  : "Erledigt"}
                              </SelectItem>
                              <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Wortlaut:</span>
                            <button
                              type="button"
                              onClick={() =>
                                update.mutate({
                                  id: row.id,
                                  statusWording:
                                    currentWording === "aufgabe"
                                      ? "genehmigung"
                                      : "aufgabe",
                                })
                              }
                              className="text-blue-700 hover:underline font-medium"
                            >
                              {currentWording === "aufgabe"
                                ? "Aufgabe ⇄ Genehmigung"
                                : "Genehmigung ⇄ Aufgabe"}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Bemerkung */}
                      <td className="py-2.5 px-4 align-top">
                        <Textarea
                          defaultValue={row.note ?? ""}
                          placeholder="Bemerkungen …"
                          rows={1}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (row.note ?? "")) {
                              update.mutate({ id: row.id, note: val || null });
                            }
                          }}
                          className="text-xs resize-y min-h-[36px]"
                        />
                      </td>

                      {/* Aktion: Löschen */}
                      <td className="py-2.5 px-4 align-top text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove.mutate({ id: row.id })}
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Aufgabe löschen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Karten-Ansicht (unter lg) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredRows.map(row => {
              const currentWording: PrepWording =
                row.statusWording === "genehmigung" ? "genehmigung" : "aufgabe";

              return (
                <Card
                  key={row.id}
                  className={`border shadow-xs ${
                    row.status === "abgelehnt"
                      ? "border-rose-300 bg-rose-50/20"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Kopfzeile Karte: Status-Badge & Löschen */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={getStatusBadgeClass(row.status as PrepStatus)}
                        >
                          {getStatusLabel(
                            row.status as PrepStatus,
                            currentWording
                          )}
                        </Badge>
                        {row.category && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {row.category}
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove.mutate({ id: row.id })}
                        className="h-9 w-9 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {/* Aufgabe */}
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Aufgabe
                      </span>
                      <Input
                        defaultValue={row.task}
                        placeholder="Aufgabe"
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (val && val !== row.task) {
                            update.mutate({ id: row.id, task: val });
                          }
                        }}
                        className="h-11 w-full text-base font-medium"
                      />
                    </div>

                    {/* 2-Spalten-Grid für Frist und Kategorie */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs font-medium text-slate-500 block mb-1">
                          Frist (Freitext)
                        </span>
                        <Input
                          defaultValue={row.dueText ?? ""}
                          placeholder="z. B. Ende März"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (row.dueText ?? "")) {
                              update.mutate({ id: row.id, dueText: val });
                            }
                          }}
                          className="h-11 w-full text-base"
                        />
                      </div>

                      <div>
                        <span className="text-xs font-medium text-slate-500 block mb-1">
                          Bereich / Kategorie
                        </span>
                        <Input
                          defaultValue={row.category ?? ""}
                          placeholder="Kategorie"
                          list="category-options"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (row.category ?? "")) {
                              update.mutate({ id: row.id, category: val });
                            }
                          }}
                          className="h-11 w-full text-base"
                        />
                      </div>
                    </div>

                    {/* Verantwortlicher */}
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Verantwortlicher
                      </span>
                      <Select
                        value={row.contactId ? String(row.contactId) : "none"}
                        onValueChange={val =>
                          update.mutate({
                            id: row.id,
                            contactId: val === "none" ? null : Number(val),
                          })
                        }
                      >
                        <SelectTrigger className="h-11 w-full text-base">
                          <SelectValue placeholder="— Keine Zuordnung —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Keine Zuordnung —</SelectItem>
                          {contacts.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status & Wording */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-slate-500 block">
                        Status ändern
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {(["offen", "inArbeit", "erledigt", "abgelehnt"] as const).map(
                          st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                update.mutate({
                                  id: row.id,
                                  status: st,
                                })
                              }
                              className={`h-11 rounded-lg border text-xs font-medium transition ${
                                row.status === st
                                  ? getStatusBadgeClass(st) + " font-bold ring-1 ring-slate-400"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {getStatusLabel(st, currentWording)}
                            </button>
                          )
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs text-slate-600">
                        <span>Wortlaut umschalten:</span>
                        <button
                          type="button"
                          onClick={() =>
                            update.mutate({
                              id: row.id,
                              statusWording:
                                currentWording === "aufgabe"
                                  ? "genehmigung"
                                  : "aufgabe",
                            })
                          }
                          className="font-medium text-blue-700 underline"
                        >
                          {currentWording === "aufgabe"
                            ? "Aufgabe ⇄ Genehmigung"
                            : "Genehmigung ⇄ Aufgabe"}
                        </button>
                      </div>
                    </div>

                    {/* Bemerkung */}
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Bemerkungen / Informationen
                      </span>
                      <Textarea
                        defaultValue={row.note ?? ""}
                        placeholder="Details …"
                        rows={2}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (val !== (row.note ?? "")) {
                            update.mutate({ id: row.id, note: val || null });
                          }
                        }}
                        className="w-full text-base"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
