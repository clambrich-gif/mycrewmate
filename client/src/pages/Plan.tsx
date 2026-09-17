import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { CopyPreviousPlanButton } from "@/components/CopyPreviousPlanButton";
import { ClearPlanAssignmentsButton } from "@/components/ClearPlanAssignmentsButton";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { shiftsOverlap, type ShiftTimeLike } from "@shared/shift-time";
import {
  PLAN_WARNING_FILTERS,
  PLAN_WARNING_QUERY_KEY,
  PLAN_STATUS_QUERY_KEY,
  parsePlanWarningFilter,
  parsePlanStatusFilter,
  type PlanStatusFilter,
  type PlanWarningSelection,
} from "@/lib/dashboard-target-filter";
import {
  eventWeekdays,
  helperAvailabilityWindowLabel,
  helperAvailableForShift,
  helperHasTimedAvailability,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_AVAILABILITY_TIME_FIELDS,
  WEEKDAY_SHORT_LABELS,
  WEEKDAYS,
  type AvailabilityValue,
  type AvailabilityTimeField,
  type Weekday,
} from "@shared/weekdays";
import { useSearchParams } from "wouter";
import { planEvaluationMatchesSearch } from "@/lib/plan-search";

const formatTimeLabel = (shift: { startTime: string; endTime: string }) =>
  shift.startTime && shift.endTime
    ? `${shift.startTime}–${shift.endTime}`
    : "ganztägig";

type AssignmentT = {
  id: number;
  shiftId: number;
  helperId: number;
  slot: number;
};

type DropdownShift = ShiftTimeLike & {
  id: number;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
};

type AvailabilityField = (typeof WEEKDAY_AVAILABILITY_FIELDS)[Weekday];
type HelperTooltipData = {
  name: string;
  phone: string | null;
  note: string | null;
  companion?: string | null;
  willHelp: "ja" | "nein";
} &
  Record<AvailabilityField, AvailabilityValue> &
  Partial<Record<AvailabilityTimeField, string | null>>;

type PlanStatusCounts = {
  total: number;
  open: number;
  knapp: number;
  ok: number;
};

const AVAILABILITY_CLASS: Record<AvailabilityValue, string> = {
  ja: "text-emerald-700",
  nein: "text-red-700",
  vielleicht: "text-amber-700",
};

function MobileShiftNote({
  note,
  shiftLabel,
  editable,
  onEdit,
}: {
  note: string | null | undefined;
  shiftLabel: string;
  editable: boolean;
  onEdit: () => void;
}) {
  const normalizedNote = note?.trim() ?? "";
  const needsDetail = normalizedNote.length > 110 || normalizedNote.split(/\r?\n/).length > 2;

  return (
    <Popover>
      <div className="relative rounded-md border bg-muted/30">
        <button
          type="button"
          disabled={!editable}
          onClick={onEdit}
          aria-label={`Bemerkung zu ${shiftLabel}${editable ? " bearbeiten" : " anzeigen"}`}
          className="min-h-11 w-full rounded-md px-3 py-2 pr-11 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default"
        >
          <span className="font-medium">Bemerkung:</span>{" "}
          <span className={needsDetail ? "line-clamp-2 break-words" : "break-words"}>
            {normalizedNote || "Keine Bemerkung hinterlegt"}
          </span>
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
            aria-label={`Vollständige Bemerkung zu ${shiftLabel} anzeigen`}
            title="Vollständige Bemerkung anzeigen"
          >
            <Info className="size-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={8}
        className="z-50 w-[min(20rem,calc(100vw-1.5rem))] max-w-none border border-gray-200 bg-white p-3 text-left text-gray-900 shadow-lg"
      >
        <p className="mb-1 text-xs font-medium text-slate-500">Bemerkung</p>
        <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5">
          {normalizedNote || "Keine Bemerkung hinterlegt."}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function PlanStatusBar({
  counts,
  isLoading,
}: {
  counts: PlanStatusCounts;
  isLoading: boolean;
}) {
  const chips = [
    {
      label: "Schichten",
      value: counts.total,
      className: "border-slate-200 bg-slate-50 text-slate-800",
      badge: null,
    },
    {
      label: "Offen",
      value: counts.open,
      className: "border-red-200 bg-red-50 text-red-800",
      badge: "OFFEN",
    },
    {
      label: "Knapp besetzt",
      value: counts.knapp,
      className: "border-amber-200 bg-amber-50 text-amber-900",
      badge: "KNAPP",
    },
    {
      label: "Voll besetzt",
      value: counts.ok,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      badge: "OK",
    },
  ] as const;

  return (
    <section
      aria-label="Status des Einsatzplans"
      data-plan-status-bar
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 xl:flex-none"
    >
      {chips.map(chip => (
        <span
          key={chip.label}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${chip.className}`}
        >
          <span>{chip.label}:</span>
          <strong className="text-sm leading-none tabular-nums">
            {isLoading ? "–" : chip.value}
          </strong>
          {chip.badge && <StatusBadge status={chip.badge} />}
        </span>
      ))}
    </section>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedText = text.normalize("NFKC");
  const normalizedQuery = query.normalize("NFKC").trim();
  if (!normalizedQuery) return <>{text}</>;

  const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(escapedQuery, "giu");
  const parts = [];
  let cursor = 0;
  let match = matcher.exec(normalizedText);

  while (match) {
    const matchIndex = match.index;
    if (matchIndex > cursor) {
      parts.push(normalizedText.slice(cursor, matchIndex));
    }
    const matchEnd = matchIndex + match[0].length;
    parts.push(
      <mark
        key={`${matchIndex}-${matchEnd}`}
        className="rounded-sm bg-amber-200 px-0.5 font-semibold text-slate-950"
      >
        {normalizedText.slice(matchIndex, matchEnd)}
      </mark>
    );
    cursor = matchEnd;
    match = matcher.exec(normalizedText);
  }

  if (cursor === 0) return <>{text}</>;
  if (cursor < normalizedText.length) parts.push(normalizedText.slice(cursor));
  return <>{parts}</>;
}

function AssignedHelperChip({
  helper,
  displayLabel,
  searchQuery,
  className,
  activeDays,
  shiftDay,
  canRemove,
  onRemove,
}: {
  helper: HelperTooltipData;
  displayLabel: string;
  searchQuery: string;
  className: string;
  activeDays: Weekday[];
  shiftDay: Weekday;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const note = helper.note?.trim() ?? "";
  const companion = helper.companion?.trim() ?? "";
  const timeRestricted = helperHasTimedAvailability(helper, shiftDay);
  const timeAvailabilityLabel = timeRestricted
    ? helperAvailabilityWindowLabel(helper, shiftDay)
    : "";

  const clearOpenTimer = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  const clearCloseTimer = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openAfterDelay = (pointerType: string) => {
    if (pointerType !== "mouse") return;
    clearCloseTimer();
    clearOpenTimer();
    openTimer.current = window.setTimeout(() => setOpen(true), 800);
  };
  const closeAfterLeave = (pointerType: string) => {
    if (pointerType !== "mouse") return;
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={`slot ${className} inline-flex min-h-11 items-center gap-1 text-base md:min-h-0 md:text-[.78rem] xl:!min-w-[132px] xl:!max-w-[216px] xl:!px-2 xl:!py-0.5 xl:!text-xs`}
        onPointerEnter={event => openAfterDelay(event.pointerType)}
        onPointerLeave={event => closeAfterLeave(event.pointerType)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:min-h-0"
            aria-label={`Details zu ${helper.name} anzeigen`}
          >
            <span className="inline-flex max-w-full items-center gap-1 truncate">
              {companion && (
                <span
                  className="shrink-0 text-xs leading-none select-none"
                  title={`zusätzliche Begleitung: ${companion}`}
                  aria-label={`zusätzliche Begleitung: ${companion}`}
                >
                  👪
                </span>
              )}
              {timeRestricted && (
                <span
                  className="shrink-0 text-xs leading-none text-slate-700 select-none"
                  title={timeAvailabilityLabel}
                  aria-label={timeAvailabilityLabel}
                >
                  <Clock3 className="size-3.5" aria-hidden="true" />
                </span>
              )}
              <span className="truncate">
                <HighlightedText text={displayLabel} query={searchQuery} />
              </span>
            </span>
          </button>
        </PopoverTrigger>
        {canRemove && (
          <button
            type="button"
            aria-label={`${helper.name} aus der Schicht entfernen`}
            className="-my-1 -mr-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-lg opacity-60 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:my-0 md:mr-0 md:min-h-0 md:min-w-0 md:text-base"
            title="Entfernen"
            onPointerDown={event => {
              event.stopPropagation();
              clearOpenTimer();
              clearCloseTimer();
              setOpen(false);
            }}
            onClick={event => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
      </div>
      <PopoverContent
        side="top"
        sideOffset={8}
        align="center"
        avoidCollisions
        collisionPadding={12}
        sticky="always"
        onPointerEnter={event => {
          if (event.pointerType === "mouse") clearCloseTimer();
        }}
        onPointerLeave={event => closeAfterLeave(event.pointerType)}
        className="z-50 w-[min(18rem,calc(100vw-1.5rem))] max-w-none space-y-2 border border-gray-200 bg-white text-left text-gray-900 opacity-100 shadow-lg duration-200 ease-out data-[state=open]:fade-in-0 motion-reduce:animate-none sm:w-72"
      >
        <p className="font-semibold">{helper.name}</p>
        <p>
          <span className="font-medium">Telefon Helfer:</span>{" "}
          {helper.phone?.trim() ? (
            <a
              href={`tel:${helper.phone.replace(/[^\d+]/g, "")}`}
              className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {helper.phone.trim()}
            </a>
          ) : (
            "nicht hinterlegt"
          )}
        </p>
        <p>
          <span className="font-medium">Hinweis für PDF:</span> {note || "-"}
        </p>
        {companion && (
          <p className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-950">
            <span className="font-semibold">zusätzliche Begleitung:</span>{" "}
            {companion}
          </p>
        )}
        {timeRestricted && (
          <p className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-950">
            <span className="font-semibold">Zeitliche Verfügbarkeit:</span>{" "}
            {timeAvailabilityLabel}
          </p>
        )}
        <div>
          <p className="mb-1 font-medium">Verfügbarkeiten:</p>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {activeDays.length ? (
              activeDays.map(day => {
                const availability =
                  helper[WEEKDAY_AVAILABILITY_FIELDS[day]] ?? "vielleicht";
                return (
                  <span key={day} className={AVAILABILITY_CLASS[availability]}>
                    {WEEKDAY_SHORT_LABELS[day]}: {availability}
                  </span>
                );
              })
            ) : (
              <span>-</span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Plan() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const warningFilter = parsePlanWarningFilter(
    searchParams.get(PLAN_WARNING_QUERY_KEY)
  );
  const status = parsePlanStatusFilter(searchParams.get(PLAN_STATUS_QUERY_KEY));
  const canEditPlan = user?.role === "admin";
  const { data: evals = [], isLoading } = trpc.plan.evaluate.useQuery();
  const { data: helpers = [] } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: currentEvent, isLoading: isEventLoading } =
    trpc.events.current.useQuery();
  const { data: areaContactRows = [] } = trpc.plan.areaContacts.useQuery();
  const activeDays = useMemo(
    () => (currentEvent ? eventWeekdays(currentEvent.activeDays) : []),
    [currentEvent?.activeDays]
  );
  const [day, setDay] = useState<string>("alle");
  const [area, setArea] = useState<string>("alle");
  const [apFilter, setApFilter] = useState<string>("alle");
  const [q, setQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [areaContactsExpanded, setAreaContactsExpanded] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DropdownShift | null>(
    null
  );
  const [mobileNoteShift, setMobileNoteShift] =
    useState<DropdownShift | null>(null);
  const [mobileNoteValue, setMobileNoteValue] = useState("");
  const pendingTimeOverlapNotice = useRef<string[]>([]);
  const emptyMessage =
    warningFilter === "konflikte"
      ? "Keine Schichten mit Doppelbelegungen gefunden."
      : warningFilter === "ausfaelle"
        ? "Keine Schichten mit Ausfällen gefunden."
        : status === "OFFEN"
          ? "Keine offenen Schichten gefunden."
          : status === "KNAPP"
            ? "Keine knapp besetzten Schichten gefunden."
        : "Keine Schichten gefunden.";

  const updateWarningFilter = (value: PlanWarningSelection) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete(PLAN_WARNING_QUERY_KEY);
        else next.set(PLAN_WARNING_QUERY_KEY, value);
        return next;
      },
      { replace: true }
    );
  };

  const updateStatusFilter = (value: PlanStatusFilter) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete(PLAN_STATUS_QUERY_KEY);
        else next.set(PLAN_STATUS_QUERY_KEY, value);
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (day !== "alle" && !activeDays.includes(day as Weekday)) setDay("alle");
  }, [activeDays, day]);

  const invalidate = () => {
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
  };
  const assign = trpc.plan.assign.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const unassign = trpc.plan.unassign.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const createShift = trpc.shifts.create.useMutation({
    onSuccess: () => {
      invalidate();
      setDlgOpen(false);
      toast.success("Schicht angelegt");
    },
    onError: e => toast.error(e.message),
  });
  const updateShift = trpc.shifts.update.useMutation({
    onSuccess: () => {
      invalidate();
      setDlgOpen(false);
      setMobileNoteShift(null);
      const overlappingHelpers = pendingTimeOverlapNotice.current;
      pendingTimeOverlapNotice.current = [];
      if (overlappingHelpers.length > 0) {
        toast.warning(
          `Doppelbelegung aktualisiert: ${overlappingHelpers.join(", ")}`
        );
      } else {
        toast.success("Schicht aktualisiert");
      }
    },
    onError: e => {
      pendingTimeOverlapNotice.current = [];
      toast.error(e.message);
    },
  });
  const deleteShift = trpc.shifts.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteCandidate(null);
      toast.success("Schicht gelöscht");
    },
    onError: e => toast.error(e.message),
  });
  const setAreaContact = trpc.plan.setAreaContact.useMutation({
    onSuccess: async () => {
      await utils.plan.areaContacts.invalidate();
      toast.success("Bereichsansprechpartner gespeichert");
    },
    onError: error => toast.error(error.message),
  });

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editShift, setEditShift] = useState<any | null>(null);
  const [form, setForm] = useState<{
    day: Weekday;
    area: string;
    task: string;
    startTime: string;
    endTime: string;
    needed: number;
    note: string;
  }>({
    day: WEEKDAYS[0],
    area: "",
    task: "",
    startTime: "",
    endTime: "",
    needed: 1,
    note: "",
  });
  const openCreate = () => {
    if (!activeDays.length) return;
    setEditShift(null);
    setForm({
      day: activeDays[0],
      area: "",
      task: "",
      startTime: "",
      endTime: "",
      needed: 1,
      note: "",
    });
    setDlgOpen(true);
  };
  const openEdit = (s: any) => {
    pendingTimeOverlapNotice.current = [];
    setEditShift(s);
    setForm({
      day: s.day,
      area: s.area,
      task: s.task,
      startTime: s.startTime,
      endTime: s.endTime,
      needed: s.needed,
      note: s.note ?? "",
    });
    setDlgOpen(true);
  };
  const openMobileNoteEditor = (shift: DropdownShift & { note?: string | null }) => {
    if (!canEditPlan) return;
    setMobileNoteShift(shift);
    setMobileNoteValue(shift.note ?? "");
  };
  const saveMobileNote = () => {
    if (!mobileNoteShift || updateShift.isPending) return;
    pendingTimeOverlapNotice.current = [];
    updateShift.mutate({
      id: mobileNoteShift.id,
      note: mobileNoteValue.trim() || null,
    });
  };
  const saveShift = () => {
    if (!canEditPlan) return;
    if (!form.task.trim() || !form.area.trim()) {
      toast.error("Bereich und Aufgabe sind Pflicht");
      return;
    }
    if (
      (!form.startTime && form.endTime) ||
      (form.startTime && !form.endTime)
    ) {
      toast.error("Beginn und Ende müssen gemeinsam angegeben werden");
      return;
    }
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      toast.error("Das Ende muss nach dem Beginn liegen");
      return;
    }
    if (editShift) {
      pendingTimeOverlapNotice.current = timeOverlapConflicts.map(
        conflict => conflict.name
      );
      updateShift.mutate({ id: editShift.id, ...form });
    }
    else createShift.mutate({ ...form });
  };

  const areas = useMemo(
    () => Array.from(new Set(evals.map(e => e.shift.area))),
    [evals]
  );
  const areaOptions = useMemo(
    () =>
      [...areas]
        .filter(areaName => areaName.trim().length > 0)
        .sort((left, right) => left.localeCompare(right, "de")),
    [areas]
  );
  const planStatusCounts = useMemo<PlanStatusCounts>(
    () => ({
      total: evals.length,
      open: evals.filter(entry => entry.status === "OFFEN").length,
      knapp: evals.filter(entry => entry.status === "KNAPP").length,
      ok: evals.filter(entry => entry.status === "OK").length,
    }),
    [evals]
  );
  const contactName = (id: number | null) =>
    contacts.find(c => c.id === id)?.name ?? "";
  const areaContactMap = useMemo(
    () => new Map(areaContactRows.map(item => [item.area, item.contactId])),
    [areaContactRows]
  );
  const helperNameById = useMemo(
    () => new Map(helpers.map(helper => [helper.id, helper.name])),
    [helpers]
  );
  const helperById = useMemo(
    () => new Map(helpers.map(helper => [helper.id, helper])),
    [helpers]
  );
  const label = (h: any) =>
    `${h.name}${h.contactId ? ` (${contactName(h.contactId)})` : ""}`;

  const assignedShiftsByHelper = useMemo(() => {
    const result = new Map<number, DropdownShift[]>();
    for (const evaluation of evals) {
      for (const assignment of evaluation.assigned as AssignmentT[]) {
        const assigned = result.get(assignment.helperId) ?? [];
        assigned.push(evaluation.shift);
        result.set(assignment.helperId, assigned);
      }
    }
    return result;
  }, [evals]);

  /**
   * Warnt bereits im Dialog, bevor eine bestehende Zuweisung durch eine
   * verlängerte Schichtzeit außerhalb eines hinterlegten Zeitfensters fällt.
   * Die Warnung ist bewusst nicht blockierend: Die Zuweisung bleibt sichtbar
   * und wird nach dem Speichern als Ausfall ausgewiesen.
   */
  const timeWindowConflicts = useMemo(() => {
    if (!editShift) return [];
    const currentEvaluation = evals.find(
      evaluation => evaluation.shift.id === editShift.id
    );
    if (!currentEvaluation) return [];
    const proposedShift = {
      ...editShift,
      day: form.day,
      startTime: form.startTime,
      endTime: form.endTime,
    } as DropdownShift;
    const seenHelperIds = new Set<number>();

    return currentEvaluation.assigned.flatMap(assignment => {
      if (seenHelperIds.has(assignment.helperId)) return [];
      seenHelperIds.add(assignment.helperId);
      const helper = helperById.get(assignment.helperId);
      if (
        !helper ||
        !helperHasTimedAvailability(helper, form.day) ||
        helperAvailableForShift(helper, proposedShift)
      )
        return [];
      return [
        {
          id: helper.id,
          name: helper.name,
          window: helperAvailabilityWindowLabel(helper, form.day),
        },
      ];
    });
  }, [editShift, evals, form.day, form.endTime, form.startTime, helperById]);

  /** Ermittelt neu entstehende zeitliche Doppelbelegungen vor dem Speichern. */
  const timeOverlapConflicts = useMemo(() => {
    if (!editShift) return [];
    const currentEvaluation = evals.find(
      evaluation => evaluation.shift.id === editShift.id
    );
    if (!currentEvaluation) return [];
    const proposedShift = {
      ...editShift,
      day: form.day,
      startTime: form.startTime,
      endTime: form.endTime,
    } as DropdownShift;
    const seenHelperIds = new Set<number>();

    return currentEvaluation.assigned.flatMap(assignment => {
      if (seenHelperIds.has(assignment.helperId)) return [];
      seenHelperIds.add(assignment.helperId);
      const helper = helperById.get(assignment.helperId);
      if (!helper) return [];
      return (assignedShiftsByHelper.get(helper.id) ?? [])
        .filter(
          other => other.id !== editShift.id && shiftsOverlap(other, proposedShift)
        )
        .map(other => ({
          id: `${helper.id}-${other.id}`,
          name: helper.name,
          otherShift: `${other.area} – ${other.task}`,
          otherTime: formatTimeLabel(other),
        }));
    });
  }, [assignedShiftsByHelper, editShift, evals, form.day, form.endTime, form.startTime, helperById]);

  const filtered = useMemo(
    () =>
      evals
        .filter(
          e =>
            (day === "alle" || e.shift.day === day) &&
            (area === "alle" || e.shift.area === area) &&
            (status === "alle" || e.status === status) &&
            (warningFilter !== "konflikte" || e.doppelCount > 0) &&
            (warningFilter !== "ausfaelle" || e.ausfallCount > 0) &&
            planEvaluationMatchesSearch(e, q, helperNameById) &&
            (apFilter === "alle" ||
              String(areaContactMap.get(e.shift.area) ?? "") === apFilter)
        )
        .sort(
          (left, right) =>
            WEEKDAYS.indexOf(left.shift.day as Weekday) -
              WEEKDAYS.indexOf(right.shift.day as Weekday) ||
            left.shift.sortOrder - right.shift.sortOrder ||
            left.shift.startTime.localeCompare(right.shift.startTime) ||
            left.shift.id - right.shift.id
        ),
    [
      evals,
      day,
      area,
      status,
      warningFilter,
      q,
      apFilter,
      areaContactMap,
      helperNameById,
    ]
  );

  const activeHelpers = (shift: DropdownShift) =>
    helpers.filter(helper => helperAvailableForShift(helper, shift));

  const overlappingAssignments = (
    helperId: number,
    currentShift: DropdownShift
  ) =>
    (assignedShiftsByHelper.get(helperId) ?? []).filter(
      other =>
        other.id !== currentShift.id && shiftsOverlap(other, currentShift)
    );

  // Slots: bis zu needed, max 20
  const slotsFor = (e: any): { slot: number; a: AssignmentT | undefined }[] => {
    const n = Math.min(Math.max(e.shift.needed, 0), 20);
    const bySlot = new Map<number, AssignmentT>(
      (e.assigned as AssignmentT[]).map(a => [a.slot, a])
    );
    return Array.from({ length: n }, (_, i) => ({ slot: i, a: bySlot.get(i) }));
  };

  const renderShiftSlots = (evalE: any) => {
    const shift = evalE.shift;
    const assignedHelperIds = new Set<number>(
      (evalE.assigned as AssignmentT[]).map(assignment => assignment.helperId)
    );
    const actives = activeHelpers(shift).filter(
      helper => !assignedHelperIds.has(helper.id)
    );
    return (
      <div className="flex max-w-full flex-wrap gap-1 xl:gap-1">
        {slotsFor(evalE).map(({ slot, a }) => {
          if (!a) {
            if (!canEditPlan) {
              return (
                <span
                  key={slot}
                  className="slot slot-offen inline-flex h-9 items-center"
                >
                  Platz offen
                </span>
              );
            }
            return (
              <Select
                key={slot}
                disabled={assign.isPending}
                onValueChange={value =>
                  assign.mutate({
                    shiftId: shift.id,
                    helperId: Number(value),
                    slot,
                  })
                }
              >
                <SelectTrigger className="slot slot-offen h-11 w-full min-w-[180px] sm:w-[220px] md:h-9 xl:min-w-0 xl:w-full">
                  <SelectValue placeholder="Helfer wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {actives.map(helper => {
                    const conflicts = overlappingAssignments(helper.id, shift);
                    const isAlreadyAssigned = conflicts.length > 0;
                    const timeRestricted = helperHasTimedAvailability(
                      helper,
                      shift.day
                    );
                    const timeAvailabilityLabel = timeRestricted
                      ? helperAvailabilityWindowLabel(helper, shift.day)
                      : "";
                    const conflictTitle = conflicts
                      .map(
                        other =>
                          `${other.area}: ${other.task} (${formatTimeLabel(other)})`
                      )
                      .join(", ");
                    const optionTitle = [
                      timeAvailabilityLabel,
                      isAlreadyAssigned
                        ? `Zeitgleich eingeteilt: ${conflictTitle}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n");
                    return (
                      <SelectItem
                        key={helper.id}
                        value={String(helper.id)}
                        className={
                          isAlreadyAssigned
                            ? "bg-amber-100 text-amber-950 focus:bg-amber-200 focus:text-amber-950 dark:bg-amber-900/60 dark:text-amber-50 dark:focus:bg-amber-800"
                            : undefined
                        }
                        title={optionTitle || undefined}
                      >
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-1 truncate">
                            {helper.companion?.trim() && (
                              <span
                                className="shrink-0 text-xs leading-none select-none"
                                title={`zusätzliche Begleitung: ${helper.companion.trim()}`}
                                aria-label={`zusätzliche Begleitung: ${helper.companion.trim()}`}
                              >
                                👪
                              </span>
                            )}
                            {timeRestricted && (
                              <span
                                className="shrink-0 text-xs leading-none text-slate-700 select-none"
                                title={timeAvailabilityLabel}
                                aria-label={timeAvailabilityLabel}
                              >
                                <Clock3 className="size-3.5" aria-hidden="true" />
                              </span>
                            )}
                            <span className="truncate">{label(helper)}</span>
                          </span>
                          {isAlreadyAssigned && (
                            <span className="shrink-0 rounded-full border border-amber-500 bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
                              bereits belegt
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                  {actives.length === 0 && (
                    <SelectItem value="x" disabled>
                      Keine verfügbaren Helfer
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            );
          }
          const helper =
            evalE.validHelpers.find((item: any) => item.id === a.helperId) ??
            evalE.ausfallHelpers.find((item: any) => item.id === a.helperId);
          const isAusfall = evalE.ausfallHelpers.some(
            (item: any) => item.id === a.helperId
          );
          const isDoppel =
            !isAusfall && (evalE.doppelIds as Set<number>).has(a.helperId);
          const className = isAusfall
            ? "slot-ausfall"
            : isDoppel
              ? "slot-doppel"
              : "slot-ok";
          if (!helper) {
            return (
              <span
                key={slot}
                className={`slot ${className} inline-flex items-center`}
              >
                ?
              </span>
            );
          }
          return (
            <AssignedHelperChip
              key={slot}
              helper={helper}
              displayLabel={label(helper)}
              searchQuery={q}
              className={className}
              activeDays={activeDays}
              shiftDay={shift.day}
              canRemove={canEditPlan}
              onRemove={() => unassign.mutate({ id: a.id })}
            />
          );
        })}
        {shift.needed === 0 && (
          <span className="slot slot-gesperrt">Kein Bedarf</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Einsatzplan</h1>
        <p className="text-muted-foreground">
          {canEditPlan
            ? "Nur verfügbare, aktive Helfer sind auswählbar. Zeitgleich bereits eingeteilte Helfer sind im Auswahlmenü gelb markiert, bleiben aber auswählbar. Absagen markieren Ausfälle (rot), Doppelbelegungen werden gewarnt (orange)."
            : "Das Planungsteam kann den Einsatzplan vollständig ansehen und filtern. Änderungen und Helferzuweisungen sind Administratoren vorbehalten."}
        </p>
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <PlanStatusBar counts={planStatusCounts} isLoading={isLoading} />
        {canEditPlan && (
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end xl:ml-auto [&>[data-slot=button]]:min-w-0 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:px-2 [&>[data-slot=button]]:text-xs sm:[&>[data-slot=button]]:w-auto sm:[&>[data-slot=button]]:px-4 sm:[&>[data-slot=button]]:text-sm">
            <ModuleExcelImportButton area="EINSATZPLAN" label="Einsatzplan" />
            <CopyPreviousPlanButton />
            <ClearPlanAssignmentsButton onCleared={() => setQ("")} />
            <ResetAreaButton
              area="shifts"
              label="Einsatzplan"
              mobileButtonLabel="Plan zurücksetzen"
            />
            <Button
              type="button"
              variant="outline"
              onClick={openCreate}
              disabled={isEventLoading || !activeDays.length}
              className={`col-span-2 !w-full !px-4 sm:col-auto sm:!w-auto sm:!text-sm ${CREATION_ACTION_BUTTON_CLASS}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Schicht
            </Button>
          </div>
        )}
      </div>

      {areas.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-2 sm:p-2.5">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-between gap-3 rounded-md px-1.5 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 xl:hidden"
              aria-expanded={areaContactsExpanded}
              aria-controls="area-contacts-grid"
              onClick={() => setAreaContactsExpanded(expanded => !expanded)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  Ansprechpartner je Bereich
                </span>
                <span className="block text-xs text-muted-foreground">
                  {areas.length} {areas.length === 1 ? "Bereich" : "Bereiche"}
                </span>
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-600 transition-transform duration-200 ${areaContactsExpanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div className="mb-1.5 hidden px-0.5 xl:block">
              <h2 className="text-sm font-semibold">
                Ansprechpartner je Bereich
              </h2>
              <p className="text-xs leading-tight text-muted-foreground">
                Die Zuordnung gilt für alle Schichten des Bereichs und steht
                außerdem als PDF-Filter zur Verfügung.
              </p>
            </div>
            <div
              id="area-contacts-grid"
              className={`${areaContactsExpanded ? "grid" : "hidden"} mt-1.5 gap-1.5 sm:grid-cols-2 md:grid-cols-3 xl:mt-0 xl:grid xl:grid-cols-4 2xl:grid-cols-5`}
            >
              {areas.map(areaName => {
                const selected = areaContactMap.get(areaName) ?? null;
                return (
                  <div
                    key={areaName}
                    className="min-w-0 rounded-md border bg-slate-50/80 p-1.5"
                  >
                    <Label
                      className="mb-1 block truncate text-xs font-semibold leading-tight"
                      title={areaName}
                    >
                      {areaName}
                    </Label>
                    {canEditPlan ? (
                      <Select
                        value={selected ? String(selected) : "none"}
                        onValueChange={value =>
                          setAreaContact.mutate({
                            area: areaName,
                            contactId: value === "none" ? null : Number(value),
                          })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className={
                            selected
                              ? "w-full bg-white px-2 text-xs dark:bg-slate-950"
                              : "w-full border-amber-400 bg-amber-100 px-2 text-xs text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Kein Ansprechpartner
                          </SelectItem>
                          {contacts.map(contact => (
                            <SelectItem
                              key={contact.id}
                              value={String(contact.id)}
                            >
                              {contact.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div
                        className={`flex min-h-11 items-center rounded-md border px-2 py-1.5 text-xs md:min-h-8 ${selected ? "bg-white" : "border-amber-400 bg-amber-100 text-amber-950"}`}
                      >
                        {selected
                          ? contactName(selected)
                          : "Kein Ansprechpartner"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {warningFilter !== "alle" && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div
            className="flex min-w-0 items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-semibold">
                {PLAN_WARNING_FILTERS[warningFilter].label}
              </p>
              <p className="text-sm text-amber-800">
                {PLAN_WARNING_FILTERS[warningFilter].summary}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
            onClick={() => updateWarningFilter("alle")}
          >
            Filter aufheben
          </Button>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="relative w-full lg:max-w-xl">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            name="plan-search-query"
            autoComplete="off"
            placeholder="Suchen (Aufgabe/Bereich/Helfer) …"
            aria-label="Einsatzplan nach Aufgabe, Bereich oder Helfer durchsuchen"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="h-12 w-full border-2 border-slate-400 bg-white pl-11 pr-12 text-base font-medium text-slate-950 shadow-sm placeholder:text-slate-600 focus-visible:border-blue-600 focus-visible:ring-blue-200 md:h-11 md:pr-10"
          />
          {q && (
            <button
              type="button"
              aria-label="Suche löschen"
              title="Suche löschen"
              className="absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:right-1 md:h-8 md:w-8"
              onClick={() => {
                setQ("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Tage</SelectItem>
              {activeDays.map(d => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-full lg:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Bereiche</SelectItem>
              {areas.map(a => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={value => updateStatusFilter(value as PlanStatusFilter)}
          >
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="OFFEN">OFFEN</SelectItem>
              <SelectItem value="KNAPP">KNAPP</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={warningFilter}
            onValueChange={value =>
              updateWarningFilter(value as PlanWarningSelection)
            }
          >
            <SelectTrigger
              className="w-full lg:w-56"
              aria-label="Warnungsfilter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Warnungen</SelectItem>
              <SelectItem value="konflikte">
                Nur Doppelbelegungen
              </SelectItem>
              <SelectItem value="ausfaelle">Nur Ausfälle</SelectItem>
            </SelectContent>
          </Select>
          <Select value={apFilter} onValueChange={setApFilter}>
            <SelectTrigger className="w-full lg:w-52">
              <SelectValue placeholder="Ansprechpartner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Ansprechpartner</SelectItem>
              {contacts.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map(e => {
          const shift = e.shift;
          return (
            <Card key={shift.id} className="shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{shift.day}</span>
                      <StatusBadge status={e.status} />
                    </div>
                    <h2 className="break-words text-lg font-semibold">
                      <HighlightedText text={shift.task} query={q} />
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      <HighlightedText text={shift.area} query={q} /> ·{" "}
                      {formatTimeLabel(shift)}
                    </p>
                  </div>
                  {canEditPlan && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        title="Schicht bearbeiten"
                        onClick={() => openEdit(shift)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Schicht löschen"
                        onClick={() => setDeleteCandidate(shift)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Bedarf</dt>
                    <dd className="font-semibold">
                      {e.besetzt} von {shift.needed} besetzt
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Ansprechpartner
                    </dt>
                    <dd className="font-medium">
                      {contactName(areaContactMap.get(shift.area) ?? null) ||
                        "nicht zugeordnet"}
                    </dd>
                  </div>
                </dl>
                <MobileShiftNote
                  note={shift.note}
                  shiftLabel={`${shift.area}: ${shift.task}`}
                  editable={canEditPlan}
                  onEdit={() => openMobileNoteEditor(shift)}
                />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Eingeteilte Helfer
                  </p>
                  {renderShiftSlots(e)}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>

      <Card className="hidden w-full shadow-sm md:block">
        <CardContent className="w-full overflow-x-auto p-0 xl:overflow-x-hidden">
          <table className="w-full table-auto text-sm md:min-w-[1080px] xl:min-w-0 xl:table-fixed xl:text-xs">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[5.5%]" />
              <col className="w-[6%]" />
              <col className="w-[5.5%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[29%]" />
            </colgroup>
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-left">
                <th className="p-2 xl:p-1.5">Tag</th>
                <th className="p-2 xl:p-1.5">Bereich</th>
                <th className="break-words p-2 leading-tight xl:p-1.5">Kontakt</th>
                <th className="p-2 xl:p-1.5">Aufgabe</th>
                <th className="p-2 xl:p-1.5">Bemerkung</th>
                <th className="p-2 whitespace-nowrap xl:p-1.5">Zeit</th>
                <th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Bedarf</th>
                <th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Besetzt</th>
                <th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Status</th>
                <th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Doppelt</th>
                <th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Ausfälle</th>
                <th className="break-words p-2 leading-tight xl:p-1.5">Eingeteilte Helfer</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={12}>
                    Lade …
                  </td>
                </tr>
              )}
              {filtered.map(e => {
                const s = e.shift;
                const evalE = e as typeof e & { assigned: AssignmentT[] };
                return (
                  <tr
                    key={s.id}
                    className="border-t align-top hover:bg-muted/20"
                  >
                    <td className="p-2 font-medium xl:p-1.5">{s.day}</td>
                    <td className="p-2 xl:p-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="max-w-[8rem] break-words [overflow-wrap:anywhere]">
                          <HighlightedText text={s.area} query={q} />
                        </span>
                        {canEditPlan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Schicht bearbeiten"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEditPlan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Löschen"
                            onClick={() => setDeleteCandidate(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="p-2 xl:p-1.5">
                      <span className="block max-w-[8rem] break-words [overflow-wrap:anywhere]">
                        {contactName(areaContactMap.get(s.area) ?? null) || (
                          <span className="text-amber-700">nicht zugeordnet</span>
                        )}
                      </span>
                    </td>
                    <td className="max-w-[9rem] break-words p-2 [overflow-wrap:anywhere] xl:p-1.5">
                      <HighlightedText text={s.task} query={q} />
                    </td>
                    <td className="max-w-[10rem] whitespace-pre-wrap break-words p-2 text-muted-foreground [overflow-wrap:anywhere] xl:p-1.5">
                      {s.note?.trim() || "–"}
                    </td>
                    <td className="p-2 whitespace-nowrap xl:p-1.5">
                      {s.startTime && s.endTime
                        ? `${s.startTime}–${s.endTime}`
                        : "ganztägig"}
                    </td>
                    <td className="p-2 text-center font-semibold xl:p-1.5">{s.needed}</td>
                    <td className="p-2 text-center xl:p-1.5">{e.besetzt}</td>
                    <td className="p-2 text-center xl:p-1.5">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="p-2 text-center xl:p-1.5">
                      {e.doppelCount > 0 ? (
                        <span className="badge badge-warn">
                          {e.doppelCount}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-2 text-center xl:p-1.5">
                      {e.ausfallCount > 0 ? (
                        <span className="badge badge-err">
                          {e.ausfallCount}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="min-w-0 p-2 align-top xl:p-1.5">
                      {renderShiftSlots(evalE)}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={12}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Legende: <span className="slot slot-offen inline-block">offen</span>{" "}
        <span className="inline-block rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-amber-950">
          im Dropdown bereits belegt
        </span>{" "}
        <span className="slot slot-doppel inline-block">Doppelbelegung</span>{" "}
        <span className="slot slot-ausfall inline-block">Ausfall</span>
      </p>

      <AlertDialog
        open={Boolean(deleteCandidate)}
        onOpenChange={open => {
          if (!open && !deleteShift.isPending) setDeleteCandidate(null);
        }}
      >
        <AlertDialogContent className="z-50 border border-gray-200 !bg-white !text-slate-950 shadow-xl dark:!bg-white dark:!text-slate-950">
          <AlertDialogHeader>
            <div className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600 sm:mx-0">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Schicht löschen</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left text-gray-600">
              <span className="block">
                Möchtest du die Schicht &apos;{deleteCandidate?.area} -{" "}
                {deleteCandidate?.task}&apos; wirklich löschen?
              </span>
              <span className="block rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                Dabei werden auch alle dieser Schicht zugeordneten Helferplätze
                mitgelöscht.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteShift.isPending}
              className="border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteCandidate || deleteShift.isPending}
              className="border border-red-700 !bg-red-600 !text-white shadow-sm hover:!bg-red-700 focus-visible:ring-red-500"
              onClick={event => {
                event.preventDefault();
                if (deleteCandidate && !deleteShift.isPending)
                  deleteShift.mutate({ id: deleteCandidate.id });
              }}
            >
              {deleteShift.isPending ? "Wird gelöscht …" : "Schicht löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(mobileNoteShift)}
        onOpenChange={open => {
          if (!open && !updateShift.isPending) setMobileNoteShift(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] !bg-white !text-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bemerkung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="mobile-shift-note" className="text-sm font-medium">
              {mobileNoteShift
                ? `${mobileNoteShift.area}: ${mobileNoteShift.task}`
                : "Bemerkung"}
            </label>
            <Textarea
              id="mobile-shift-note"
              autoFocus
              rows={7}
              value={mobileNoteValue}
              onChange={event => setMobileNoteValue(event.target.value)}
              placeholder="Treffpunkt, Material, Besonderheiten oder Hinweise"
              className="min-h-40 resize-y text-base"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateShift.isPending}
              onClick={() => setMobileNoteShift(null)}
            >
              Abbrechen
            </Button>
            <Button type="button" disabled={updateShift.isPending} onClick={saveMobileNote}>
              {updateShift.isPending ? "Speichert …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 opacity-100 shadow-2xl dark:!bg-slate-950 dark:!text-slate-50 [&_[data-slot=input]]:!bg-white [&_[data-slot=input]]:dark:!bg-slate-900 [&_[data-slot=select-trigger]]:!bg-white [&_[data-slot=select-trigger]]:dark:!bg-slate-900">
          <DialogHeader>
            <DialogTitle>
              {editShift ? "Schicht bearbeiten" : "Neue Schicht"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tag</Label>
                <Select
                  value={form.day}
                  onValueChange={v => setForm({ ...form, day: v as Weekday })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDays.map(d => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bedarf</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={form.needed}
                  onChange={e =>
                    setForm({
                      ...form,
                      needed: Math.max(
                        0,
                        Math.min(20, Number(e.target.value) || 0)
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="shift-area">Bereich</Label>
              <Input
                id="shift-area"
                list="shift-area-options"
                value={form.area}
                onChange={e => setForm({ ...form, area: e.target.value })}
                placeholder="Bestehenden Bereich wählen oder neu anlegen"
              />
              <datalist id="shift-area-options">
                {areaOptions.map(areaName => (
                  <option key={areaName} value={areaName} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Aufgabe / Schicht</Label>
              <Input
                value={form.task}
                onChange={e => setForm({ ...form, task: e.target.value })}
                placeholder="z. B. Grill & Pommes Tag"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Beginn</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={e =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Ende</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Für eine ganztägige Schicht beide Uhrzeitfelder leer lassen.
            </p>
            {timeWindowConflicts.length > 0 && (
              <div
                role="alert"
                data-slot="shift-time-window-conflict"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-amber-700"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      Die geänderte Schichtzeit passt nicht mehr zu folgenden
                      eingeteilten Helfern:
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {timeWindowConflicts.map(conflict => (
                        <li key={conflict.id}>
                          {conflict.name}: {conflict.window}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-900">
                      Die Schichtzeit kann gespeichert werden. Der Helfer wird
                      anschließend als zeitlich nicht verfügbar ausgewiesen,
                      bis Zeitfenster oder Einteilung angepasst sind.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {timeOverlapConflicts.length > 0 && (
              <div
                role="alert"
                data-slot="shift-time-overlap-conflict"
                className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-orange-700"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      Diese Schichtzeit erzeugt folgende Doppelbelegung:
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {timeOverlapConflicts.map(conflict => (
                        <li key={conflict.id}>
                          {conflict.name}: {conflict.otherShift} (
                          {conflict.otherTime})
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-orange-900">
                      Die Schichtzeit wird gespeichert. Nach der Aktualisierung
                      markieren beide betroffenen Schichten die Doppelbelegung.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label>Bemerkung</Label>
              <Input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="z. B. Treffpunkt, Kleidung oder Besonderheiten"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button
              onClick={saveShift}
              disabled={createShift.isPending || updateShift.isPending}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
