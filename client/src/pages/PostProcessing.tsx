import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { LocationMapLink } from "@/components/LocationMapLink";
import { PageTitle } from "@/components/PageTitle";
import { MyTasksDefaultPin } from "@/components/MyTasksDefaultPin";
import { PlanResetDialogButton } from "@/components/PlanResetDialogButton";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  STICKY_TABLE_CONTAINER_CLASS,
  STICKY_TABLE_HEADER_CLASS,
  STICKY_TABLE_HEADER_CELL_CLASS,
} from "@/lib/sticky-table";
import { downloadBase64File } from "@/lib/download";
import { useMyTasksDefault } from "@/hooks/useMyTasksDefault";
import {
  formatPreparationLogbookForMobileDisplay,
  latestPreparationLogbookEntry,
  preparationLogbookEntryCount,
  prependPreparationLogbookEntry,
} from "@shared/preparation-logbook";
import {
  ArrowUpDown,
  Calendar,
  FilterX,
  Info,
  MapPin,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "wouter";
import { toast } from "sonner";

type PostStatus = "offen" | "inArbeit" | "erledigt";
type PostStatusFilter = "alle" | PostStatus;

type PostTaskRow = {
  id: number;
  year: number;
  eventId: number;
  category: string;
  task: string;
  dueText: string;
  locationId: number | null;
  contactId: number | null;
  status: PostStatus;
  note: string | null;
  sortOrder: number;
};

type PostForm = {
  category: string;
  task: string;
  locationId: string;
  contactId: string;
  dueText: string;
  legacyDueText: string;
  preserveLegacyDueText: boolean;
  logEntry: string;
};

const POST_STATUS_QUERY_KEY = "status";
const CREATION_ACTION_BUTTON_CLASS =
  "bg-rose-600 text-white hover:bg-rose-700 hover:text-white border-rose-600 shadow-sm";

function parsePostStatusFilter(value: string | null): PostStatusFilter {
  if (value === "offen" || value === "inArbeit" || value === "erledigt") {
    return value;
  }
  return "alle";
}

const EMPTY_FORM: PostForm = {
  category: "",
  task: "",
  locationId: "none",
  contactId: "none",
  dueText: "",
  legacyDueText: "",
  preserveLegacyDueText: false,
  logEntry: "",
};

function temporaryId() {
  return -Math.floor(Math.random() * 1_000_000 + 1);
}

function normalizedPersonName(name: string | null | undefined) {
  return name?.trim().toLocaleLowerCase("de-DE") ?? "";
}

function getStatusLabel(status: PostStatus) {
  if (status === "offen") return "Offen";
  if (status === "inArbeit") return "In Arbeit";
  return "Erledigt";
}

function getStatusBadgeClass(status: PostStatus) {
  switch (status) {
    case "offen":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "inArbeit":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "erledigt":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
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

function MobilePostProcessingLogbookField({
  task,
  disabled,
  onCommit,
}: {
  task: PostTaskRow;
  disabled: boolean;
  onCommit: (entry: string) => void;
}) {
  const [entry, setEntry] = useState("");
  const compactHistory = formatPreparationLogbookForMobileDisplay(task.note);
  const entryCount = preparationLogbookEntryCount(task.note);

  useEffect(() => {
    setEntry("");
  }, [task.id, task.note]);

  const saveEntry = () => {
    const normalizedEntry = entry.trim();
    if (!normalizedEntry) return;
    onCommit(normalizedEntry);
    setEntry("");
  };

  return (
    <Popover>
      <div className="relative">
        <Input
          value={entry}
          disabled={disabled}
          className="w-full pr-11 text-base bg-white"
          placeholder="Neuen Logbuch-Eintrag verfassen..."
          aria-label={`Logbuch zu ${task.task} ergänzen`}
          onChange={event => setEntry(event.target.value)}
          onBlur={saveEntry}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveEntry();
            }
          }}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center gap-0.5 rounded-r-md text-slate-500 hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rose-600"
            aria-label={`Vollständiges Logbuch zu ${task.task} anzeigen${entryCount ? ` (${entryCount} Einträge)` : ""}`}
            title={entryCount ? `${entryCount} Logbucheinträge anzeigen` : "Vollständiges Logbuch anzeigen"}
          >
            <Info className="size-4" />
            {entryCount > 0 && (
              <span className="min-w-4 rounded-full bg-rose-100 px-1 text-[10px] font-bold leading-4 text-rose-800">
                {entryCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={8}
        className="z-50 w-[min(20rem,calc(100vw-1.5rem))] max-w-none border border-rose-200 bg-white p-3 text-left text-gray-900 shadow-lg"
      >
        <p className="mb-1 text-xs font-medium text-slate-500">Logbuch – Verlauf</p>
        <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5">
          {compactHistory || "Noch kein Logbucheintrag vorhanden."}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default function PostProcessing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatusFilter = searchParams.get(POST_STATUS_QUERY_KEY);
  const statusFilter: PostStatusFilter = parsePostStatusFilter(rawStatusFilter);
  const locationFilter = Number(searchParams.get("location")) || null;

  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [contactFilter, setContactFilter] = useState<string>("alle");
  const [searchTerm, setSearchTerm] = useState("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [openOrUnassignedOnly, setOpenOrUnassignedOnly] = useState(false);
  const [dueSortDirection, setDueSortDirection] = useState<"asc" | "desc" | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PostTaskRow | null>(null);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<PostTaskRow | null>(null);

  const utils = trpc.useUtils();
  const { data: rawRows = [], isLoading } = trpc.post.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const rows = rawRows as PostTaskRow[];

  const { user } = useAuth();
  const { isTenantAdmin } = useTenantAdministration();
  const {
    isDefaultMyTasks,
    setDefaultMyTasks,
    canRememberMyTasksDefault,
  } = useMyTasksDefault(user);
  const logbookAuthor =
    user?.name?.trim() || (isTenantAdmin ? "Administrator" : "Planungsteam");
  const refreshDashboard = () => void utils.dashboard.stats.invalidate();

  const create = trpc.post.create.useMutation({
    onMutate: async (input: any) => {
      await utils.post.list.cancel();
      const previous = utils.post.list.getData();
      const optimisticId = temporaryId();
      utils.post.list.setData(undefined, (current: any[] = []) => [
        ...current,
        {
          id: optimisticId,
          year: 0,
          eventId: 0,
          category: input.category ?? "",
          task: input.task,
          dueText: input.dueText ?? "",
          locationId: input.locationId ?? null,
          contactId: input.contactId ?? null,
          status: "offen",
          note: input.logEntry
            ? prependPreparationLogbookEntry(input.logEntry, null, new Date(), logbookAuthor)
            : input.note ?? null,
          sortOrder: 0,
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: (created: any, _input: any, context: any) => {
      utils.post.list.setData(undefined, (current: any[] = []) =>
        current.map(row => (row.id === context?.optimisticId ? created : row))
      );
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Nachbereitungsaufgabe angelegt");
    },
    onError: (error: any, _input: any, context: any) => {
      utils.post.list.setData(undefined, context?.previous);
      toast.error(error.message || "Anlegen der Nachbereitungsaufgabe fehlgeschlagen");
    },
    onSettled: () => {
      void utils.post.list.invalidate();
      refreshDashboard();
    },
  });

  const update = trpc.post.update.useMutation({
    onMutate: async (input: any) => {
      await utils.post.list.cancel();
      const previous = utils.post.list.getData();
      utils.post.list.setData(undefined, (current: any[] = []) =>
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
      toast.success("Nachbereitungsaufgabe gespeichert");
    },
    onError: (error: any, _input: any, context: any) => {
      utils.post.list.setData(undefined, context?.previous);
      toast.error(error.message || "Aktualisierung fehlgeschlagen");
    },
    onSettled: () => {
      void utils.post.list.invalidate();
      refreshDashboard();
    },
  });

  const remove = trpc.post.remove.useMutation({
    onMutate: async (input: any) => {
      await utils.post.list.cancel();
      const previous = utils.post.list.getData();
      utils.post.list.setData(undefined, (current: any[] = []) =>
        current.filter(row => row.id !== input.id)
      );
      return { previous };
    },
    onSuccess: () => {
      setDeleteCandidate(null);
      toast.success("Nachbereitungsaufgabe ins Löschprotokoll verschoben");
    },
    onError: (error: any, _input: any, context: any) => {
      utils.post.list.setData(undefined, context?.previous);
      toast.error(error.message || "Löschen fehlgeschlagen");
    },
    onSettled: () => {
      void utils.post.list.invalidate();
      refreshDashboard();
    },
  });

  const taskOverviewPdf = trpc.pdf.postTaskOverview.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("Nachbereitungs-PDF wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });

  const contactMap = useMemo(
    () => new Map(contacts.map(contact => [contact.id, contact.name])),
    [contacts]
  );
  const currentUserName = normalizedPersonName(user?.name);
  const ownContactIds = useMemo(
    () =>
      new Set(
        contacts
          .filter(contact => normalizedPersonName(contact.name) === currentUserName)
          .map(contact => contact.id)
      ),
    [contacts, currentUserName]
  );
  useEffect(() => {
    if (isDefaultMyTasks && ownContactIds.size > 0) {
      setMyTasksOnly(true);
    }
  }, [isDefaultMyTasks, ownContactIds]);
  const updateMyTasksDefault = (enabled: boolean) => {
    setDefaultMyTasks(enabled);
    if (!enabled) setMyTasksOnly(false);
    else if (ownContactIds.size > 0) setMyTasksOnly(true);
  };
  const locationMap = useMemo(
    () => new Map(locations.map(location => [location.id, location.name])),
    [locations]
  );

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map(row => row.category?.trim())
            .filter((category): category is string => Boolean(category))
        )
      ).sort((a, b) => a.localeCompare(b, "de")),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const result = rows.filter(task => {
      if (statusFilter !== "alle" && task.status !== statusFilter) return false;
      if (locationFilter && task.locationId !== locationFilter) return false;
      if (categoryFilter === "ohne" && task.category?.trim()) return false;
      if (
        categoryFilter !== "alle" &&
        categoryFilter !== "ohne" &&
        task.category !== categoryFilter
      ) {
        return false;
      }
      if (contactFilter === "ohne" && task.contactId !== null) return false;
      if (
        contactFilter !== "alle" &&
        contactFilter !== "ohne" &&
        task.contactId !== Number(contactFilter)
      ) {
        return false;
      }
      if (myTasksOnly && (!task.contactId || !ownContactIds.has(task.contactId))) {
        return false;
      }
      if (openOrUnassignedOnly && task.status !== "offen" && task.contactId) {
        return false;
      }
      if (!query) return true;
      const contactName = task.contactId ? contactMap.get(task.contactId) ?? "" : "";
      const locationName = task.locationId ? locationMap.get(task.locationId) ?? "" : "";
      return (
        task.task.toLowerCase().includes(query) ||
        (task.category ?? "").toLowerCase().includes(query) ||
        (task.dueText ?? "").toLowerCase().includes(query) ||
        contactName.toLowerCase().includes(query) ||
        locationName.toLowerCase().includes(query) ||
        (task.note ?? "").toLowerCase().includes(query)
      );
    });

    if (!dueSortDirection) return result;
    return [...result].sort((a, b) => {
      const aDue = parseDueDate(a.dueText);
      const bDue = parseDueDate(b.dueText);
      if (!aDue && !bDue) return (a.dueText || "").localeCompare(b.dueText || "");
      if (!aDue) return 1;
      if (!bDue) return -1;
      const diff = aDue.iso.localeCompare(bDue.iso);
      return dueSortDirection === "asc" ? diff : -diff;
    });
  }, [
    rows,
    statusFilter,
    locationFilter,
    categoryFilter,
    contactFilter,
    myTasksOnly,
    openOrUnassignedOnly,
    ownContactIds,
    searchTerm,
    contactMap,
    locationMap,
    dueSortDirection,
  ]);

  const hasActiveFilters =
    statusFilter !== "alle" ||
    locationFilter !== null ||
    categoryFilter !== "alle" ||
    contactFilter !== "alle" ||
    myTasksOnly ||
    openOrUnassignedOnly ||
    searchTerm.trim().length > 0;

  const updateStatusFilter = (value: PostStatusFilter) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete(POST_STATUS_QUERY_KEY);
        else next.set(POST_STATUS_QUERY_KEY, value);
        return next;
      },
      { replace: true }
    );
  };

  const updateLocationFilter = (value: string) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete("location");
        else next.set("location", value);
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
    setMyTasksOnly(false);
    setOpenOrUnassignedOnly(false);
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete("location");
        return next;
      },
      { replace: true }
    );
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (task: PostTaskRow) => {
    const parsedDueDate = parseDueDate(task.dueText);
    setEditingTask(task);
    setForm({
      category: task.category ?? "",
      task: task.task,
      locationId: task.locationId ? String(task.locationId) : "none",
      contactId: task.contactId ? String(task.contactId) : "none",
      dueText: parsedDueDate?.iso ?? "",
      legacyDueText: parsedDueDate ? "" : task.dueText ?? "",
      preserveLegacyDueText: !parsedDueDate && Boolean(task.dueText?.trim()),
      logEntry: "",
    });
    setDialogOpen(true);
  };

  const openDelete = (task: PostTaskRow) => {
    setDeleteCandidate(task);
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
      locationId: form.locationId === "none" ? null : Number(form.locationId),
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

  const downloadTaskOverviewPdf = () => {
    taskOverviewPdf.mutate({
      taskIds: filteredRows
        .map(task => task.id)
        .filter(id => Number.isSafeInteger(id) && id > 0),
    });
  };

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-5 rounded-2xl bg-rose-50/50 p-3 sm:p-5 border border-rose-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <PageTitle icon="postprocessing" className="text-slate-950">
            Nachbereitung
          </PageTitle>
          <p className="text-muted-foreground text-sm">
            Aufgabenverwaltung für den Abbau, Rücktransporte, Abrechnungen und Nachbereitung des Festivals.
          </p>
        </div>
        <div className="w-full space-y-2 lg:w-auto lg:min-w-[344px]">
          <div className="grid grid-cols-2 gap-2 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:whitespace-nowrap [&>[data-slot=button]]:px-2 lg:[&>[data-slot=button]]:h-10">
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 bg-white text-slate-800 hover:bg-rose-50 hover:text-rose-900"
              disabled={taskOverviewPdf.isPending}
              onClick={downloadTaskOverviewPdf}
            >
              <Printer className="mr-2 h-4 w-4 text-rose-700" />
              {taskOverviewPdf.isPending ? "PDF wird erstellt …" : "PDF drucken"}
            </Button>
            <PlanResetDialogButton area="post" label="Nachbereitung" />
          </div>
          <Button
            type="button"
            variant="outline"
            className={`w-full ${CREATION_ACTION_BUTTON_CLASS}`}
            onClick={openCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Neue Nachbereitungsaufgabe
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-rose-200/80 bg-white/90 p-3 shadow-sm sm:p-4">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Suchen (Aufgabe/Bereich/Verantwortlicher/Ort/Frist) …"
            className="h-11 bg-white pl-9 pr-8 text-base border-rose-200 sm:h-10 sm:text-sm"
            aria-label="Nachbereitungsaufgaben durchsuchen"
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

        <div className="flex flex-wrap gap-2" aria-label="Schnellfilter Nachbereitung">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={myTasksOnly ? "default" : "outline"}
              className={
                myTasksOnly
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
              }
              disabled={ownContactIds.size === 0}
              title={
                ownContactIds.size === 0
                  ? "Der aktuelle Sitzungsname ist keinem Ansprechpartner zugeordnet."
                  : undefined
              }
              onClick={() => setMyTasksOnly(active => !active)}
            >
              👤 Meine Aufgaben
            </Button>
            <MyTasksDefaultPin
              pressed={isDefaultMyTasks}
              disabled={!canRememberMyTasksDefault}
              onPressedChange={updateMyTasksDefault}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={openOrUnassignedOnly ? "default" : "outline"}
            className={
              openOrUnassignedOnly
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
            }
            onClick={() => setOpenOrUnassignedOnly(active => !active)}
          >
            ⚠ Offen / unzugewiesen
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 md:flex md:flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 w-full bg-white text-base border-rose-200 md:h-10 md:w-[190px] md:text-sm">
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

          <Select
            value={locationFilter ? String(locationFilter) : "alle"}
            onValueChange={updateLocationFilter}
          >
            <SelectTrigger className="h-11 w-full bg-white text-base border-rose-200 md:h-10 md:w-[190px] md:text-sm">
              <SelectValue placeholder="Standort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Standorte</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={String(loc.id)}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="h-11 w-full bg-white text-base border-rose-200 md:h-10 md:w-[220px] md:text-sm">
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
            onValueChange={value => updateStatusFilter(value as PostStatusFilter)}
          >
            <SelectTrigger className="h-11 w-full bg-white text-base border-rose-200 md:h-10 md:w-[175px] md:text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="inArbeit">In Arbeit</SelectItem>
              <SelectItem value="erledigt">Erledigt</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-11 w-full px-2 text-base text-rose-700 hover:text-rose-900 hover:bg-rose-100/60 md:ml-1 md:h-10 md:w-auto md:text-sm"
            >
              <FilterX className="mr-1 size-3.5" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Nachbereitungsaufgaben werden geladen …
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rose-200 bg-white/70 p-8 text-center text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Keine Aufgaben entsprechen den aktuellen Filterkriterien."
            : "Noch keine Nachbereitungsaufgaben angelegt."}
        </div>
      ) : (
        <>
          <div
            className={`hidden rounded-xl border border-rose-200 bg-white shadow-sm lg:block ${STICKY_TABLE_CONTAINER_CLASS}`}
          >
            <table className="w-full text-sm">
              <thead
                data-sticky-table-header="postprocessing"
                className={STICKY_TABLE_HEADER_CLASS}
              >
                <tr>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Bereich</th>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Aufgabe</th>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Ort</th>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Verantwortlicher</th>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      onClick={() =>
                        setDueSortDirection(current =>
                          current === "asc" ? "desc" : current === "desc" ? null : "asc"
                        )
                      }
                      title="Nach Frist sortieren"
                    >
                      <span>Frist</span>
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </th>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Status</th>
                  <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Logbuch</th>
                  <th className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}>Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {filteredRows.map(task => {
                  const latestLogbookEntry = latestPreparationLogbookEntry(task.note);
                  const logbookEntriesCount = preparationLogbookEntryCount(task.note);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-rose-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-700">
                        {task.category ? (
                          <Badge variant="secondary" className="font-normal border-rose-200 bg-rose-50 text-rose-900">
                            {task.category}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {task.task}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {task.locationId ? (
                          <LocationMapLink
                            locationId={task.locationId}
                            locations={locations}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {task.contactId ? (
                          contactMap.get(task.contactId) ?? (
                            <span className="text-amber-700">
                              Unbekannter Kontakt (ID: {task.contactId})
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDueDate(task.dueText) || (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={task.status}
                          disabled={update.isPending}
                          onValueChange={value =>
                            update.mutate({
                              id: task.id,
                              status: value as PostStatus,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Status für ${task.task} ändern`}
                            className={`h-8 w-[130px] border text-xs font-medium ${getStatusBadgeClass(task.status)}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offen">Offen</SelectItem>
                            <SelectItem value="inArbeit">In Arbeit</SelectItem>
                            <SelectItem value="erledigt">Erledigt</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="max-w-[220px] truncate text-xs text-slate-700"
                            title={latestLogbookEntry || undefined}
                          >
                            {latestLogbookEntry || (
                              <span className="text-slate-400">—</span>
                            )}
                          </span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 rounded px-1 text-slate-400 hover:bg-rose-100 hover:text-rose-800"
                                aria-label={`Vollständiges Logbuch zu ${task.task} anzeigen${logbookEntriesCount ? ` (${logbookEntriesCount} Einträge)` : ""}`}
                                title={logbookEntriesCount ? `${logbookEntriesCount} Logbucheinträge anzeigen` : "Vollständiges Logbuch anzeigen"}
                              >
                                <Info className="size-4" />
                                {logbookEntriesCount > 1 && (
                                  <span className="min-w-4 rounded-full bg-rose-100 px-1 text-[10px] font-bold leading-4 text-rose-800">
                                    {logbookEntriesCount}
                                  </span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              side="top"
                              sideOffset={8}
                              className="z-50 w-80 max-w-[calc(100vw-2rem)] border border-rose-200 bg-white p-3 text-gray-900 shadow-lg"
                            >
                              <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Logbuch – Chronologischer Verlauf
                              </p>
                              <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                                {task.note?.trim() || "Noch kein Eintrag vorhanden."}
                              </p>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-rose-100 text-slate-600 hover:text-slate-900"
                            title="Nachbereitungsaufgabe bearbeiten"
                            aria-label={`Aufgabe ${task.task} bearbeiten`}
                            onClick={() => openEdit(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-red-50 text-destructive"
                            title="Nachbereitungsaufgabe löschen"
                            aria-label={`Aufgabe ${task.task} löschen`}
                            onClick={() => openDelete(task)}
                          >
                            <Trash2 className="h-4 w-4" />
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
              const dueDate = parseDueDate(task.dueText);
              return (
                <Card
                  key={task.id}
                  className="border-rose-200 bg-white shadow-sm"
                >
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <h2 className="break-words text-[24px] leading-tight font-black tracking-tight text-slate-900">
                          {task.task}
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                          <Select
                            value={task.status}
                            disabled={update.isPending}
                            onValueChange={value =>
                              update.mutate({
                                id: task.id,
                                status: value as PostStatus,
                              })
                            }
                          >
                            <SelectTrigger
                              aria-label={`Status für ${task.task} ändern`}
                              className={`h-11 min-w-[130px] border text-base font-medium ${getStatusBadgeClass(task.status)}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offen">Offen</SelectItem>
                              <SelectItem value="inArbeit">In Arbeit</SelectItem>
                              <SelectItem value="erledigt">Erledigt</SelectItem>
                            </SelectContent>
                          </Select>
                          {task.category && (
                            <Badge variant="secondary" className="font-normal border-rose-200 bg-rose-50 text-rose-900">
                              {task.category}
                            </Badge>
                          )}
                          <LocationMapLink
                            locationId={task.locationId}
                            locations={locations}
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 border-rose-200 bg-white"
                          title="Nachbereitungsaufgabe bearbeiten"
                          aria-label={`Aufgabe ${task.task} bearbeiten`}
                          onClick={() => openEdit(task)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 border-rose-200 bg-white"
                          title="Nachbereitungsaufgabe löschen"
                          aria-label={`Aufgabe ${task.task} löschen`}
                          onClick={() => openDelete(task)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" htmlFor={`mobile-post-contact-${task.id}`}>
                          Verantwortlicher
                        </label>
                        <Select
                          value={task.contactId ? String(task.contactId) : "none"}
                          disabled={update.isPending}
                          onValueChange={value =>
                            update.mutate({
                              id: task.id,
                              contactId: value === "none" ? null : Number(value),
                            })
                          }
                        >
                          <SelectTrigger id={`mobile-post-contact-${task.id}`} className="w-full bg-white border-rose-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein Verantwortlicher</SelectItem>
                            {contacts.map(contact => (
                              <SelectItem key={contact.id} value={String(contact.id)}>
                                {contact.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" htmlFor={`mobile-post-due-${task.id}`}>
                          Frist
                        </label>
                        <div className="relative w-full max-w-full min-w-0 box-border">
                          <Input
                            id={`mobile-post-due-${task.id}`}
                            type="date"
                            lang="de-DE"
                            className="w-full max-w-full min-w-0 box-border appearance-none pr-11 bg-white border-rose-200 [-webkit-appearance:none]"
                            value={dueDate?.iso ?? ""}
                            disabled={update.isPending}
                            aria-label={`Frist für ${task.task} ändern`}
                            onChange={event =>
                              update.mutate({
                                id: task.id,
                                dueText: parseDueDate(event.target.value)?.display ?? "",
                              })
                            }
                          />
                          <Calendar
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 shrink-0 text-slate-500"
                          />
                        </div>
                        {!dueDate && task.dueText?.trim() && (
                          <p className="text-xs text-amber-700">
                            Bisherige Frist: {task.dueText}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Logbuch</label>
                      <MobilePostProcessingLogbookField
                        task={task}
                        disabled={update.isPending}
                        onCommit={logEntry => update.mutate({ id: task.id, logEntry })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Neue Einträge werden oben im Verlauf ergänzt.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteCandidate)}
        onOpenChange={open => {
          if (!open && !remove.isPending) {
            setDeleteCandidate(null);
          }
        }}
        title="Nachbereitungsaufgabe löschen?"
        description={`„${deleteCandidate?.task ?? ""}“ wird aus der aktiven Übersicht entfernt und ins Löschprotokoll verschoben.`}
        busy={remove.isPending}
        onConfirm={() =>
          deleteCandidate &&
          remove.mutate({
            id: deleteCandidate.id,
          })
        }
      />

      <Dialog open={dialogOpen} onOpenChange={open => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 opacity-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Nachbereitungsaufgabe bearbeiten" : "Neue Nachbereitungsaufgabe"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="post-category">Bereich</Label>
              <Input
                id="post-category"
                list="post-category-options"
                value={form.category}
                onChange={event => setForm(current => ({ ...current, category: event.target.value }))}
                placeholder="Bestehenden Bereich wählen oder neu anlegen"
              />
              <datalist id="post-category-options">
                {availableCategories.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Ort / Standort</Label>
              <Select
                value={form.locationId}
                onValueChange={value => setForm(current => ({ ...current, locationId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Kein Ort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Ort</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="post-task">Aufgabe / Bezeichnung *</Label>
              <Input
                id="post-task"
                value={form.task}
                onChange={event => setForm(current => ({ ...current, task: event.target.value }))}
                placeholder="z. B. Kühlwagen reinigen und zurückgeben"
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
                <Label htmlFor="post-due">Frist / Abgabedatum</Label>
                <Input
                  id="post-due"
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
              <Label htmlFor="post-log-entry">Logbuch-Eintrag / Aktueller Stand</Label>
              <Textarea
                id="post-log-entry"
                value={form.logEntry}
                onChange={event =>
                  setForm(current => ({ ...current, logEntry: event.target.value }))
                }
                placeholder={
                  editingTask
                    ? "Neuen Sachstand eintragen – wird oben mit Datum, Uhrzeit und Name ergänzt"
                    : "z. B. Zustand, Übergabetermin oder Besonderheiten"
                }
                rows={3}
              />
              <p className="mt-1 text-xs text-slate-500">
                {editingTask
                  ? "Der Eintrag wird beim Speichern oben im Verlauf mit Datum, Uhrzeit und deinem Namen ergänzt."
                  : "Der erste Eintrag wird beim Speichern mit Datum, Uhrzeit und deinem Namen versehen."}
              </p>
              {editingTask?.note && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
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
            <Button
              type="button"
              className={CREATION_ACTION_BUTTON_CLASS}
              onClick={saveTask}
              disabled={pending || !form.task.trim()}
            >
              {pending ? "Speichert …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
