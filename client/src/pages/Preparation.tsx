import { useMemo, useState } from "react";
import { useSearchParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FilterX,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import {
  parseTaskStatusFilter,
  TASK_STATUS_QUERY_KEY,
  type TaskStatusFilter,
} from "@/lib/dashboard-target-filter";
import {
  latestPreparationLogbookEntry,
  preparationLogbookNeedsDetail,
  prependPreparationLogbookEntry,
} from "@shared/preparation-logbook";

type PrepStatus = "offen" | "inArbeit" | "erledigt" | "abgelehnt";
type PrepWording = "aufgabe" | "genehmigung";
type DialogStatus =
  | "offen"
  | "inArbeit"
  | "beantragt"
  | "erledigt"
  | "genehmigt"
  | "abgelehnt";

type PrepTaskRow = {
  id: number;
  category: string;
  task: string;
  dueText: string;
  contactId: number | null;
  status: PrepStatus;
  statusWording: PrepWording | null;
  note: string | null;
};

type PrepForm = {
  category: string;
  task: string;
  contactId: string;
  dueText: string;
  legacyDueText: string;
  preserveLegacyDueText: boolean;
  logEntry: string;
};

type StatusUpdate = {
  status: PrepStatus;
  statusWording: PrepWording;
};

const EMPTY_FORM: PrepForm = {
  category: "",
  task: "",
  contactId: "none",
  dueText: "",
  legacyDueText: "",
  preserveLegacyDueText: false,
  logEntry: "",
};

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
      return "border-rose-200 bg-rose-50 font-semibold text-rose-900";
  }
}

type ParsedDueDate = { iso: string; display: string };

function parseDueDate(value: string | null | undefined): ParsedDueDate | null {
  const trimmed = value?.trim() ?? "";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const germanMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(trimmed);
  const match = isoMatch ?? germanMatch;
  if (!match) return null;

  const isIso = Boolean(isoMatch);
  const rawYear = Number(isIso ? match[1] : match[3]);
  const year = !isIso && rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = Number(match[2]);
  const day = Number(isIso ? match[3] : match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const iso = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return {
    iso,
    display: `${day.toString().padStart(2, "0")}.${month
      .toString()
      .padStart(2, "0")}.${year.toString().padStart(4, "0")}`,
  };
}

function formatDueDate(value: string | null | undefined) {
  return parseDueDate(value)?.display ?? value?.trim() ?? "";
}

function statusSelectValue(status: PrepStatus, wording: PrepWording): DialogStatus {
  if (status === "inArbeit") {
    return wording === "genehmigung" ? "beantragt" : "inArbeit";
  }
  if (status === "erledigt") {
    return wording === "genehmigung" ? "genehmigt" : "erledigt";
  }
  return status;
}

function applyDialogStatus(value: DialogStatus): StatusUpdate {
  switch (value) {
    case "beantragt":
      return { status: "inArbeit", statusWording: "genehmigung" };
    case "genehmigt":
      return { status: "erledigt", statusWording: "genehmigung" };
    case "inArbeit":
      return { status: "inArbeit", statusWording: "aufgabe" };
    case "erledigt":
      return { status: "erledigt", statusWording: "aufgabe" };
    case "abgelehnt":
      return { status: "abgelehnt", statusWording: "aufgabe" };
    default:
      return { status: "offen", statusWording: "aufgabe" };
  }
}

export default function Preparation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatusFilter = searchParams.get(TASK_STATUS_QUERY_KEY);
  const statusFilter: TaskStatusFilter = parseTaskStatusFilter(rawStatusFilter);

  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [contactFilter, setContactFilter] = useState<string>("alle");
  const [searchTerm, setSearchTerm] = useState("");
  const [dueSortDirection, setDueSortDirection] = useState<"asc" | "desc" | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PrepTaskRow | null>(null);
  const [form, setForm] = useState<PrepForm>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<PrepTaskRow | null>(null);

  const utils = trpc.useUtils();
  const { data: rawRows = [], isLoading } = trpc.prep.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const rows = rawRows as PrepTaskRow[];

  const { user } = useAuth();
  const logbookAuthor = user?.name?.trim() || (user?.role === "admin" ? "Administrator" : "Planungsteam");
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
          note: input.logEntry
            ? prependPreparationLogbookEntry(input.logEntry, null, new Date(), logbookAuthor)
            : input.note ?? null,
          sortOrder: 0,
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: (created: any, _input: any, context: any) => {
      utils.prep.list.setData(undefined, (current: any[] = []) =>
        current.map(row => (row.id === context?.optimisticId ? created : row))
      );
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Vorbereitungsaufgabe angelegt");
    },
    onError: (error: any, _input: any, context: any) => {
      utils.prep.list.setData(undefined, context?.previous);
      toast.error(error.message || "Anlegen der Vorbereitungsaufgabe fehlgeschlagen");
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
        current.map(row => {
          if (row.id !== input.id) return row;
          const { logEntry, ...changes } = input;
          return {
            ...row,
            ...changes,
            note: logEntry
              ? prependPreparationLogbookEntry(logEntry, row.note, new Date(), logbookAuthor)
              : row.note,
          };
        })
      );
      return { previous };
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);
      toast.success("Vorbereitungsaufgabe gespeichert");
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
    onSuccess: () => {
      setDeleteCandidate(null);
      toast.success("Vorbereitungsaufgabe gelöscht");
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

  const contactMap = useMemo(
    () => new Map(contacts.map(contact => [contact.id, contact.name])),
    [contacts]
  );

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const row of rows) {
      if (row.category?.trim()) categories.add(row.category.trim());
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLocaleLowerCase("de-DE");

    return rows
      .filter(row => {
        if (statusFilter !== "alle" && row.status !== statusFilter) return false;
        if (categoryFilter === "ohne" && row.category?.trim()) return false;
        if (categoryFilter !== "alle" && categoryFilter !== "ohne") {
          if (row.category?.trim() !== categoryFilter) return false;
        }
        if (contactFilter === "ohne" && row.contactId) return false;
        if (contactFilter !== "alle" && contactFilter !== "ohne") {
          if (String(row.contactId ?? "") !== contactFilter) return false;
        }
        if (!normalizedQuery) return true;

        const searchable = [
          row.category,
          row.task,
          row.dueText,
          row.note ?? "",
          row.contactId ? contactMap.get(row.contactId) ?? "" : "",
        ]
          .join(" ")
          .toLocaleLowerCase("de-DE");
        return searchable.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (dueSortDirection) {
          const leftDue = parseDueDate(left.dueText);
          const rightDue = parseDueDate(right.dueText);
          if (!leftDue || !rightDue) {
            if (leftDue !== rightDue) return leftDue ? -1 : 1;
          }
          const leftTime = leftDue ? Date.parse(`${leftDue.iso}T00:00:00Z`) : 0;
          const rightTime = rightDue ? Date.parse(`${rightDue.iso}T00:00:00Z`) : 0;
          if (leftTime !== rightTime) {
            return dueSortDirection === "asc" ? leftTime - rightTime : rightTime - leftTime;
          }
        }
        const leftCategory = left.category?.trim() || "\uffff";
        const rightCategory = right.category?.trim() || "\uffff";
        const categoryComparison = leftCategory.localeCompare(rightCategory, "de", {
          sensitivity: "base",
        });
        if (categoryComparison !== 0) return categoryComparison;
        return left.task.localeCompare(right.task, "de", { sensitivity: "base" });
      });
  }, [
    rows,
    statusFilter,
    categoryFilter,
    contactFilter,
    searchTerm,
    dueSortDirection,
    contactMap,
  ]);

  const hasActiveFilters =
    statusFilter !== "alle" ||
    categoryFilter !== "alle" ||
    contactFilter !== "alle" ||
    Boolean(searchTerm.trim());

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

  const resetAllFilters = () => {
    updateStatusFilter("alle");
    setCategoryFilter("alle");
    setContactFilter("alle");
    setSearchTerm("");
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (task: PrepTaskRow) => {
    const parsedDueDate = parseDueDate(task.dueText);
    setEditingTask(task);
    setForm({
      category: task.category ?? "",
      task: task.task,
      contactId: task.contactId ? String(task.contactId) : "none",
      dueText: parsedDueDate?.iso ?? "",
      legacyDueText: parsedDueDate ? "" : task.dueText ?? "",
      preserveLegacyDueText: !parsedDueDate && Boolean(task.dueText?.trim()),
      logEntry: "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (create.isPending || update.isPending) return;
    setDialogOpen(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
  };

  const saveTask = () => {
    const task = form.task.trim();
    if (!task) {
      toast.error("Bitte eine Aufgabenbezeichnung eingeben");
      return;
    }

    const logEntry = form.logEntry.trim();
    const selectedDueDate = parseDueDate(form.dueText);
    const dueText = selectedDueDate?.display ?? (
      form.preserveLegacyDueText ? form.legacyDueText.trim() : ""
    );
    const payload = {
      category: form.category.trim(),
      task,
      contactId: form.contactId === "none" ? null : Number(form.contactId),
      dueText,
    };

    if (editingTask) {
      update.mutate({
        id: editingTask.id,
        ...payload,
        ...(logEntry ? { logEntry } : {}),
      });
    } else {
      create.mutate({
        ...payload,
        ...(logEntry ? { logEntry } : {}),
      });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vorbereitung</h1>
          <p className="text-muted-foreground text-sm">
            Aufgabenverwaltung für die Festival-Vorbereitung mit flexiblen Feldern,
            Status-Wortlaut und Filterleiste.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:flex lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          <ModuleExcelImportButton area="VORBEREITUNG" label="Vorbereitung" />
          <ResetAreaButton area="prep" label="Vorbereitung" compact />
          <Button className="col-span-2 lg:col-auto" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Vorbereitungsaufgabe
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-slate-50/70 p-3 sm:p-4">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Suchen (Aufgabe/Bereich/Verantwortlicher/Frist) …"
            className="h-11 bg-white pl-9 pr-8 text-base sm:h-10 sm:text-sm"
            aria-label="Vorbereitungsaufgaben durchsuchen"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-700 sm:min-h-0 sm:min-w-0"
              aria-label="Suche leeren"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 md:flex md:flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 w-full bg-white text-base md:h-10 md:w-[190px] md:text-sm">
              <SelectValue placeholder="Bereich" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Bereiche</SelectItem>
              <SelectItem value="ohne">Ohne Bereich</SelectItem>
              {availableCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="h-11 w-full bg-white text-base md:h-10 md:w-[220px] md:text-sm">
              <SelectValue placeholder="Verantwortlicher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Verantwortlichen</SelectItem>
              <SelectItem value="ohne">Ohne Zuweisung</SelectItem>
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={String(contact.id)}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={value => updateStatusFilter(value as TaskStatusFilter)}
          >
            <SelectTrigger className="h-11 w-full bg-white text-base md:h-10 md:w-[175px] md:text-sm">
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
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-11 w-full px-2 text-base text-slate-600 hover:text-slate-900 md:ml-1 md:h-10 md:w-auto md:text-sm"
            >
              <FilterX className="mr-1 size-3.5" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

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
              <AlertTriangle className="size-5 shrink-0 text-rose-600" />
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
          <div className="hidden overflow-x-auto rounded-xl border bg-white shadow-sm lg:block">
            <table className="w-full min-w-[900px] table-auto text-left text-sm">
              <thead className="border-b bg-slate-50/80 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="w-[22%] min-w-[230px] whitespace-nowrap px-3 py-3">Bereich</th>
                  <th className="w-[19%] px-3 py-3">Aufgabe</th>
                  <th className="w-[16%] px-3 py-3">Verantwortlicher</th>
                  <th
                    className="w-[12%] px-3 py-3"
                    aria-sort={
                      dueSortDirection === "asc"
                        ? "ascending"
                        : dueSortDirection === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      onClick={() =>
                        setDueSortDirection(current =>
                          current === "asc" ? "desc" : "asc"
                        )
                      }
                      title="Frist chronologisch sortieren"
                    >
                      Frist
                      {dueSortDirection === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      ) : dueSortDirection === "desc" ? (
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowUpDown className="size-3.5 text-slate-400" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  <th className="w-[13%] px-3 py-3">Status</th>
                  <th className="w-[8%] px-3 py-3 text-center">Logbuch</th>
                  <th className="w-[10%] px-3 py-3 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {filteredRows.map(task => {
                  const wording =
                    task.statusWording === "genehmigung" ? "genehmigung" : "aufgabe";
                  const latestLogbookEntry = latestPreparationLogbookEntry(task.note);
                  const showLogbookDetail = preparationLogbookNeedsDetail(task.note);
                  return (
                    <tr
                      key={task.id}
                      className={`transition hover:bg-slate-50/60 ${
                        task.status === "abgelehnt" ? "bg-rose-50/30" : ""
                      }`}
                    >
                      <td className="min-w-[230px] whitespace-nowrap px-3 py-3 align-top">
                        {task.category || "—"}
                      </td>
                      <td className="break-words px-3 py-3 align-top font-medium">{task.task}</td>
                      <td className="break-words px-3 py-3 align-top">
                        {task.contactId ? contactMap.get(task.contactId) ?? "—" : "—"}
                      </td>
                      <td className="break-words px-3 py-3 align-top">
                        {formatDueDate(task.dueText) || "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Select
                          value={statusSelectValue(task.status, wording)}
                          onValueChange={value =>
                            update.mutate({
                              id: task.id,
                              ...applyDialogStatus(value as DialogStatus),
                            })
                          }
                          disabled={update.isPending}
                        >
                          <SelectTrigger
                            aria-label={`Status für ${task.task} ändern`}
                            className={`h-8 min-w-[128px] border text-xs font-medium ${getStatusBadgeClass(task.status)}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offen">Offen</SelectItem>
                            <SelectItem value="inArbeit">In Arbeit</SelectItem>
                            <SelectItem value="beantragt">Beantragt</SelectItem>
                            <SelectItem value="erledigt">Erledigt</SelectItem>
                            <SelectItem value="genehmigt">Genehmigt</SelectItem>
                            <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {latestLogbookEntry ? (
                          <div className="flex items-start justify-center gap-1">
                            <p className="line-clamp-2 min-w-0 flex-1 break-words whitespace-pre-wrap text-xs leading-5 text-slate-700">
                              {latestLogbookEntry}
                            </p>
                            {showLogbookDetail && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    title="Vollständiges Logbuch anzeigen"
                                    aria-label={`Logbuch zu ${task.task} anzeigen`}
                                  >
                                    <Info className="h-4 w-4 text-blue-700" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="center"
                                  side="left"
                                  className="z-50 w-80 max-w-[calc(100vw-2rem)] border-slate-200 bg-white p-3 text-slate-900 shadow-lg"
                                >
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Logbuch – Verlauf
                                  </p>
                                  <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5">
                                    {task.note}
                                  </p>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        ) : (
                          <span className="block text-center text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Vorbereitungsaufgabe bearbeiten"
                            aria-label={`Aufgabe ${task.task} bearbeiten`}
                            onClick={() => openEdit(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Vorbereitungsaufgabe löschen"
                            aria-label={`Aufgabe ${task.task} löschen`}
                            onClick={() => setDeleteCandidate(task)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredRows.map(task => {
              const wording =
                task.statusWording === "genehmigung" ? "genehmigung" : "aufgabe";
              const latestLogbookEntry = latestPreparationLogbookEntry(task.note);
              const showLogbookDetail = preparationLogbookNeedsDetail(task.note, 120);
              return (
                <Card
                  key={task.id}
                  className={
                    task.status === "abgelehnt"
                      ? "border-rose-300 bg-rose-50/20 shadow-sm"
                      : "border-slate-200 bg-white shadow-sm"
                  }
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-semibold text-slate-900">{task.task}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={getStatusBadgeClass(task.status)}>
                            {getStatusLabel(task.status, wording)}
                          </Badge>
                          {task.category && (
                            <Badge variant="secondary" className="font-normal">
                              {task.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          title="Vorbereitungsaufgabe bearbeiten"
                          aria-label={`Aufgabe ${task.task} bearbeiten`}
                          onClick={() => openEdit(task)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          title="Vorbereitungsaufgabe löschen"
                          aria-label={`Aufgabe ${task.task} löschen`}
                          onClick={() => setDeleteCandidate(task)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <dl className="grid grid-cols-1 gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Verantwortlicher</dt>
                        <dd className="mt-1 break-words">{task.contactId ? contactMap.get(task.contactId) ?? "—" : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Frist</dt>
                        <dd className="mt-1 break-words">{formatDueDate(task.dueText) || "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-slate-500">Logbuch</dt>
                        {showLogbookDetail ? (
                          <dd className="mt-1">
                            <p className="line-clamp-3 break-words whitespace-pre-wrap">
                              {latestLogbookEntry}
                            </p>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="mt-2 h-11 w-11"
                                  title="Vollständiges Logbuch anzeigen"
                                  aria-label={`Vollständiges Logbuch zu ${task.task} anzeigen`}
                                >
                                  <Info className="h-4 w-4 text-blue-700" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                side="top"
                                className="z-50 w-80 max-w-[calc(100vw-2rem)] border-slate-200 bg-white p-3 text-slate-900 shadow-lg"
                              >
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Logbuch – Verlauf
                                </p>
                                <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5">
                                  {task.note}
                                </p>
                              </PopoverContent>
                            </Popover>
                          </dd>
                        ) : (
                          <dd className="mt-1 break-words whitespace-pre-wrap">
                            {latestLogbookEntry || "—"}
                          </dd>
                        )}
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog
        open={Boolean(deleteCandidate)}
        onOpenChange={open => {
          if (!open && !remove.isPending) setDeleteCandidate(null);
        }}
      >
        <AlertDialogContent className="z-50 border border-gray-200 !bg-white !text-slate-950 shadow-xl dark:!bg-white dark:!text-slate-950">
          <AlertDialogHeader>
            <div className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600 sm:mx-0">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Vorbereitungsaufgabe löschen</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-gray-600">
              Möchtest du die Aufgabe &apos;{deleteCandidate?.task}&apos; wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteCandidate || remove.isPending}
              className="border border-red-700 !bg-red-600 !text-white shadow-sm hover:!bg-red-700 focus-visible:ring-red-500"
              onClick={event => {
                event.preventDefault();
                if (deleteCandidate && !remove.isPending) {
                  remove.mutate({ id: deleteCandidate.id });
                }
              }}
            >
              {remove.isPending ? "Wird gelöscht …" : "Aufgabe löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={open => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 opacity-100 shadow-2xl dark:!bg-slate-950 dark:!text-slate-50 [&_[data-slot=input]]:!bg-white [&_[data-slot=select-trigger]]:!bg-white [&_[data-slot=textarea]]:!bg-white dark:[&_[data-slot=input]]:!bg-slate-900 dark:[&_[data-slot=select-trigger]]:!bg-slate-900 dark:[&_[data-slot=textarea]]:!bg-slate-900">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Vorbereitungsaufgabe bearbeiten" : "Neue Vorbereitungsaufgabe"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="prep-category">Bereich</Label>
              <Input
                id="prep-category"
                list="preparation-category-options"
                value={form.category}
                onChange={event => setForm(current => ({ ...current, category: event.target.value }))}
                placeholder="Bestehenden Bereich wählen oder neu anlegen"
              />
              <datalist id="preparation-category-options">
                {availableCategories.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="prep-task">Aufgabe / Bezeichnung *</Label>
              <Input
                id="prep-task"
                value={form.task}
                onChange={event => setForm(current => ({ ...current, task: event.target.value }))}
                placeholder="z. B. Genehmigung Streckenverlauf einholen"
                onKeyDown={event => {
                  if (event.key === "Enter") saveTask();
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Verantwortlicher</Label>
                <Select
                  value={form.contactId}
                  onValueChange={value => setForm(current => ({ ...current, contactId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ansprechpartner wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Keine Zuordnung —</SelectItem>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={String(contact.id)}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prep-due">Frist / Abgabedatum</Label>
                <Input
                  id="prep-due"
                  type="date"
                  value={form.dueText}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      dueText: event.target.value,
                      preserveLegacyDueText: false,
                    }))
                  }
                />
                {form.preserveLegacyDueText && form.legacyDueText && (
                  <p className="mt-1 text-xs text-amber-700">
                    Bisherige Freitextfrist wird unverändert beibehalten: {form.legacyDueText}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Datum über den Kalender wählen; gespeichert und angezeigt als TT.MM.JJJJ.
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="prep-log-entry">Logbuch-Eintrag / Aktueller Stand</Label>
              <Textarea
                id="prep-log-entry"
                value={form.logEntry}
                onChange={event =>
                  setForm(current => ({ ...current, logEntry: event.target.value }))
                }
                placeholder={
                  editingTask
                    ? "Neuen Sachstand eintragen – wird oben mit Datum, Uhrzeit und Name ergänzt"
                    : "z. B. Ansprechpartner, Besonderheiten oder nächste Schritte"
                }
                rows={3}
              />
              <p className="mt-1 text-xs text-slate-500">
                {editingTask
                  ? "Der Eintrag wird beim Speichern oben im Verlauf mit Datum, Uhrzeit und deinem Namen ergänzt."
                  : "Der erste Eintrag wird beim Speichern mit Datum, Uhrzeit und deinem Namen versehen."}
              </p>
              {editingTask?.note && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bisheriges Logbuch
                  </p>
                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">
                    {editingTask.note}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={pending}>
              <X className="mr-1 h-4 w-4" />
              Abbrechen
            </Button>
            <Button type="button" onClick={saveTask} disabled={pending || !form.task.trim()}>
              {pending ? "Speichert …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
