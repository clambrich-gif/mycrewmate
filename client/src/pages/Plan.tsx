import { trpc } from "@/lib/trpc";
import {
  STICKY_TABLE_CONTAINER_CLASS,
  STICKY_TABLE_HEADER_CLASS,
  STICKY_TABLE_HEADER_CELL_CLASS,
} from "@/lib/sticky-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  FilterX,
  Info,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
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
import { PlanResetDialogButton } from "@/components/PlanResetDialogButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { shiftsOverlap, type ShiftTimeLike } from "@shared/shift-time";
import {
  PLAN_DAY_QUERY_KEY,
  PLAN_HELPER_QUERY_KEY,
  PLAN_WARNING_QUERY_KEY,
  PLAN_STATUS_QUERY_KEY,
  planStatusMatchesFilter,
  parsePlanDayFilter,
  parsePlanHelperFilter,
  parsePlanWarningFilter,
  parsePlanStatusFilter,
  type PlanStatusFilter,
  type PlanWarningSelection,
} from "@/lib/dashboard-target-filter";
import {
  eventWeekdays,
  helperAvailabilityWindowLabel,
  helperDayAvailability,
  helperEligibleForShift,
  helperAvailableForShift,
  helperHasTimedAvailability,
  normalizeWeekday,
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
import {
  helperDropdownAssignmentFeedback,
  helperDropdownPriority,
} from "@/lib/helper-assignment-feedback";
import {
  deriveOwnAssignedHelperIds,
  matchesMyScheduleAssignment,
  normalizeSchedulePersonName,
} from "@/lib/plan-my-tasks";
import { LocationMapLink } from "@/components/LocationMapLink";
import { MyTasksDefaultPin } from "@/components/MyTasksDefaultPin";
import { useMyTasksDefault } from "@/hooks/useMyTasksDefault";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { useMobileViewMode, useViewMode } from "@/hooks/useViewMode";

const formatTimeLabel = (shift: { startTime: string; endTime: string }) =>
  shift.startTime && shift.endTime
    ? `${shift.startTime}–${shift.endTime}`
    : "ganztägig";

const FlexibleTimeNote = ({
  flexible,
}: {
  flexible: boolean;
}) =>
  flexible ? (
    <span
      data-slot="shift-flexible-time-note"
      className="block text-xs leading-tight text-muted-foreground"
    >
      (flexibel)
    </span>
  ) : null;

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
  locationId?: number | null;
  startTime: string;
  endTime: string;
  allowFlexibleAssignment: boolean;
  manualOkConfirmed: boolean;
  manualDoubleConflictAccepted: boolean;
};

type AvailabilityField = (typeof WEEKDAY_AVAILABILITY_FIELDS)[Weekday];
type HelperTooltipData = {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  companion?: string | null;
  willHelp: "ja" | "nein";
} &
  Record<AvailabilityField, AvailabilityValue> &
  Partial<Record<AvailabilityTimeField, string | null>>;

const AVAILABILITY_PILL_CLASS: Record<AvailabilityValue, string> = {
  ja: "border-emerald-200 bg-emerald-50 text-emerald-800",
  nein: "border-rose-200 bg-rose-50 text-rose-800",
  vielleicht: "border-amber-200 bg-amber-50 text-amber-900",
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

function HelperDropdownFeedbackBadge({
  feedback,
  assignments = [],
  compact = false,
  interactive = false,
}: {
  feedback: ReturnType<typeof helperDropdownAssignmentFeedback>;
  assignments?: Array<{ day: string; label?: string; time?: string }>;
  compact?: boolean;
  interactive?: boolean;
}) {
  if (!feedback) return null;
  if (feedback.kind === "already-assigned") {
    return (
      <span
        data-slot="helper-dropdown-feedback"
        data-feedback-kind="already-assigned"
        className={`shrink-0 rounded-full border border-amber-500 bg-amber-200 font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50 ${compact ? "px-1.5 py-0 text-[9px] leading-4" : "px-2 py-0.5 text-[11px]"}`}
      >
        bereits belegt
      </span>
    );
  }
  if (feedback.kind === "new") {
    return (
      <span
        data-slot="helper-dropdown-feedback"
        data-feedback-kind="new"
        className={`shrink-0 rounded-full border border-emerald-200 bg-emerald-100 font-semibold text-emerald-800 ${compact ? "px-1.5 py-0 text-[9px] leading-4" : "px-2 py-0.5 text-[11px]"}`}
      >
        Neu
      </span>
    );
  }
  const assignedDetails = feedback.segments.flatMap(segment =>
    assignments
      .filter(assignment => normalizeWeekday(assignment.day) === segment.day)
      .map(assignment => ({
        day: segment.day,
        label: assignment.label || "Schicht",
        time: assignment.time || "ganztägig",
      }))
  );
  const segmentStatus = feedback.segments.map(segment => {
    const stateLabel =
      segment.state === "assigned"
        ? "bereits eingeteilt"
        : segment.state === "current"
          ? "für diese Schicht verfügbar"
          : segment.state === "neutral"
            ? "verfügbar, noch nicht eingeteilt"
            : "nicht verfügbar";
    return `${segment.label}: ${stateLabel}`;
  });
  const assignedTooltip = [
    ...(assignedDetails.length
      ? [
          "Bereits eingeteilt:",
          ...assignedDetails.map(
            detail => `${detail.day}: ${detail.label} · ${detail.time}`
          ),
        ]
      : []),
    "Tagesstatus:",
    ...segmentStatus,
  ].join("\n");
  const badge = (
    <span
      data-slot="helper-dropdown-feedback"
      data-feedback-kind="day-segments"
      aria-label={assignedTooltip}
      title={assignedTooltip}
      className={`inline-flex shrink-0 cursor-help overflow-hidden rounded-full border border-slate-200 font-semibold shadow-xs ${compact ? "text-[8px] leading-4" : "text-[10px] leading-5"}`}
    >
      {feedback.segments.map((segment, index) => {
        const tone = segment.isCurrentDay
          ? segment.state === "current"
            ? "bg-emerald-500 text-white"
            : segment.state === "assigned"
              ? "bg-amber-200 text-amber-950"
              : segment.state === "unavailable"
                ? "bg-slate-100 text-slate-400 line-through"
                : "bg-sky-100 text-sky-800"
          : segment.state === "assigned"
            ? "bg-amber-100 text-amber-800"
            : segment.state === "unavailable"
              ? "bg-red-100 text-red-700 line-through"
              : "bg-emerald-100 text-emerald-800";

        return (
          <span
            key={segment.day}
            data-current-day={segment.isCurrentDay ? "true" : "false"}
            className={`text-center transition-colors ${
              segment.isCurrentDay
                ? compact
                  ? "min-w-5 px-1 text-[9px] font-extrabold leading-4 shadow-sm ring-1 ring-inset ring-white/80"
                  : "min-w-8 px-1.5 text-[11px] font-extrabold leading-6 shadow-sm ring-1 ring-inset ring-white/80"
                : compact
                  ? "min-w-4 px-0.5 text-[8px] font-medium leading-4 opacity-80"
                  : "min-w-6 px-1 text-[9px] font-medium leading-5 opacity-80"
            } ${tone} ${index ? "border-l border-white/70" : ""}`}
          >
            {segment.label}
          </span>
        );
      })}
    </span>
  );
  if (!interactive) return badge;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="mobile-helper-day-details-trigger"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          aria-label="Einsatz- und Tagesdetails anzeigen"
          title="Einsatz- und Tagesdetails anzeigen"
        >
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="z-50 w-[min(20rem,calc(100vw-1.5rem))] max-w-none space-y-2 border border-slate-200 bg-white p-3 text-slate-950 shadow-lg"
      >
        <p className="text-sm font-semibold">Einsatzübersicht</p>
        <div className="space-y-1.5 text-xs text-slate-700">
          {feedback.segments.map(segment => {
            const dayAssignments = assignments.filter(
              assignment => normalizeWeekday(assignment.day) === segment.day
            );
            const stateLabel =
              segment.state === "assigned"
                ? "bereits eingeteilt"
                : segment.state === "current"
                  ? "für diese Schicht verfügbar"
                  : segment.state === "unavailable"
                    ? "nicht verfügbar"
                    : "verfügbar, noch nicht eingeteilt";
            return (
              <div
                key={segment.day}
                className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
              >
                <span className="font-semibold text-slate-900">{segment.label}:</span>{" "}
                {stateLabel}
                {dayAssignments.map(assignment => (
                  <span key={`${assignment.label}-${assignment.time}`} className="mt-1 block text-slate-600">
                    {assignment.label} · {assignment.time}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toggleMultiSelection<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];
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
  compact = false,
}: {
  helper: HelperTooltipData;
  displayLabel: string;
  searchQuery: string;
  className: string;
  activeDays: Weekday[];
  shiftDay: Weekday;
  canRemove: boolean;
  onRemove: () => void;
  compact?: boolean;
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
        className={`slot ${className} inline-flex w-full min-w-0 max-w-none items-center gap-1 ${compact ? "min-h-8 px-2 py-1 text-[13px] leading-4" : "min-h-11 text-base md:min-h-0 md:text-sm xl:!px-2 xl:!py-0.5"}`}
        onPointerEnter={event => openAfterDelay(event.pointerType)}
        onPointerLeave={event => closeAfterLeave(event.pointerType)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${compact ? "min-h-8" : "min-h-11 md:min-h-0"}`}
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
              <span className="truncate" title={helper.name}>
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
          <div
            data-slot="assigned-helper-availability-pills"
            className="flex flex-wrap items-center gap-1.5"
          >
            {activeDays.length ? (
              activeDays.map(day => {
                const availability = helperDayAvailability(helper, day).value;
                const timed = helperHasTimedAvailability(helper, day);
                const timeWindow = timed
                  ? helperAvailabilityWindowLabel(helper, day)
                  : "";
                const dayShortLabel = WEEKDAY_SHORT_LABELS[day];
                return (
                  <span
                    key={day}
                    data-slot="assigned-helper-availability-pill"
                    data-availability={availability}
                    title={
                      timed
                        ? `${day}: ${availability} · ${timeWindow}`
                        : `${day}: ${availability}`
                    }
                    aria-label={
                      timed
                        ? `${day}: ${availability}; ${timeWindow}`
                        : `${day}: ${availability}`
                    }
                    className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${AVAILABILITY_PILL_CLASS[availability]}`}
                  >
                    <span>{dayShortLabel}</span>
                    {timed && <Clock3 className="size-3" aria-hidden="true" />}
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
  const { isTenantAdmin: canEditPlan } = useTenantAdministration();
  const {
    isDefaultMyTasks,
    setDefaultMyTasks,
    canRememberMyTasksDefault,
  } = useMyTasksDefault(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const warningFilter = parsePlanWarningFilter(
    searchParams.get(PLAN_WARNING_QUERY_KEY)
  );
  const status = parsePlanStatusFilter(searchParams.get(PLAN_STATUS_QUERY_KEY));
  const dashboardHelperId = parsePlanHelperFilter(
    searchParams.get(PLAN_HELPER_QUERY_KEY)
  );
  const dashboardDayFilter = parsePlanDayFilter(
    searchParams.get(PLAN_DAY_QUERY_KEY)
  );
  const locationFilter = Number(searchParams.get("location")) || null;
  const { data: evals = [], isLoading } = trpc.plan.evaluate.useQuery();
  const { data: helpers = [] } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const { data: currentEvent, isLoading: isEventLoading } =
    trpc.events.current.useQuery();
  const { data: areaContactRows = [] } = trpc.plan.areaContacts.useQuery();
  const isMobileView = useMobileViewMode();
  const activeDays = useMemo(
    () => (currentEvent ? eventWeekdays(currentEvent.activeDays) : []),
    [currentEvent?.activeDays]
  );
  const [day, setDay] = useState<string>(() => dashboardDayFilter ?? "alle");
  const [area, setArea] = useState<string>("alle");
  const [apFilter, setApFilter] = useState<string>("alle");
  const [flexibleAssignmentFilter, setFlexibleAssignmentFilter] = useState<
    "alle" | "flexibel"
  >("alle");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [openOrUnassignedOnly, setOpenOrUnassignedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useViewMode("einsatzplan");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileDays, setMobileDays] = useState<string[]>(() =>
    dashboardDayFilter ? [dashboardDayFilter] : []
  );
  const [mobileAreas, setMobileAreas] = useState<string[]>([]);
  const [mobileStatuses, setMobileStatuses] = useState<PlanStatusFilter[]>(() =>
    status === "alle" ? [] : [status]
  );
  const [mobileWarnings, setMobileWarnings] = useState<PlanWarningSelection[]>(() =>
    warningFilter === "alle" ? [] : [warningFilter]
  );
  const [mobileContactIds, setMobileContactIds] = useState<string[]>([]);
  const [mobileFlexibleOnly, setMobileFlexibleOnly] = useState(false);
  const [mobileOpenOrUnassignedOnly, setMobileOpenOrUnassignedOnly] = useState(false);
  const [selectedHelperIdsByShift, setSelectedHelperIdsByShift] = useState<
    Record<number, number[]>
  >({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [areaContactsExpanded, setAreaContactsExpanded] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DropdownShift | null>(
    null
  );
  const [mobileNoteShift, setMobileNoteShift] =
    useState<DropdownShift | null>(null);
  const [mobileNoteValue, setMobileNoteValue] = useState("");
  const [mobileHelperDetails, setMobileHelperDetails] = useState<{
    helper: HelperTooltipData;
    shift: DropdownShift;
  } | null>(null);
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
            : status === "OK_MANUELL"
              ? "Keine manuell bestätigten Schichten gefunden."
              : locationFilter
                ? "Keine Schichten an diesem Standort gefunden."
              : flexibleAssignmentFilter === "flexibel"
              ? "Keine Schichten mit flexibler Belegung gefunden."
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

  const resetPlanFilters = () => {
    setDay("alle");
    setArea("alle");
    setApFilter("alle");
    setFlexibleAssignmentFilter("alle");
    setMyTasksOnly(false);
    setOpenOrUnassignedOnly(false);
    setMobileDays([]);
    setMobileAreas([]);
    setMobileStatuses([]);
    setMobileWarnings([]);
    setMobileContactIds([]);
    setMobileFlexibleOnly(false);
    setMobileOpenOrUnassignedOnly(false);
    setQ("");
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete(PLAN_WARNING_QUERY_KEY);
        next.delete(PLAN_STATUS_QUERY_KEY);
        next.delete(PLAN_HELPER_QUERY_KEY);
        next.delete(PLAN_DAY_QUERY_KEY);
        next.delete("location");
        return next;
      },
      { replace: true }
    );
  };

  const hasActiveDropdownFilters =
    isMobileView
      ? mobileDays.length > 0 ||
        mobileAreas.length > 0 ||
        mobileStatuses.length > 0 ||
        mobileWarnings.length > 0 ||
        mobileContactIds.length > 0 ||
        mobileFlexibleOnly ||
        mobileOpenOrUnassignedOnly ||
        Boolean(locationFilter)
      : day !== "alle" ||
        area !== "alle" ||
        status !== "alle" ||
        warningFilter !== "alle" ||
        apFilter !== "alle" ||
        flexibleAssignmentFilter !== "alle" ||
        myTasksOnly ||
        openOrUnassignedOnly ||
        Boolean(locationFilter);
  const mobileFilterCount =
    mobileDays.length +
    mobileAreas.length +
    mobileStatuses.length +
    mobileWarnings.length +
    mobileContactIds.length +
    Number(mobileFlexibleOnly) +
    Number(mobileOpenOrUnassignedOnly);

  useEffect(() => {
    if (day !== "alle" && !activeDays.includes(day as Weekday)) setDay("alle");
  }, [activeDays, day]);

  useEffect(() => {
    if (dashboardDayFilter) setDay(dashboardDayFilter);
  }, [dashboardDayFilter]);
  useEffect(() => {
    if (dashboardDayFilter) setMobileDays([dashboardDayFilter]);
  }, [dashboardDayFilter]);

  const invalidate = () => {
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
  };
  const assign = trpc.plan.assign.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const assignMany = trpc.plan.assignMany.useMutation({
    onSuccess: result => {
      setSelectedHelperIdsByShift({});
      invalidate();
      toast.success(
        result.assignedCount === 1
          ? "Helfer zugeordnet"
          : `${result.assignedCount} Helfer zugeordnet`
      );
    },
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
    locationId: number | null;
    startTime: string;
    endTime: string;
    allowFlexibleAssignment: boolean;
    manualOkConfirmed: boolean;
    manualDoubleConflictAccepted: boolean;
    needed: number;
    note: string;
  }>({
    day: WEEKDAYS[0],
    area: "",
    task: "",
    locationId: null,
    startTime: "",
    endTime: "",
    allowFlexibleAssignment: false,
    manualOkConfirmed: false,
    manualDoubleConflictAccepted: false,
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
      locationId: null,
      startTime: "",
      endTime: "",
      allowFlexibleAssignment: false,
      manualOkConfirmed: false,
      manualDoubleConflictAccepted: false,
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
      locationId: s.locationId ?? null,
      startTime: s.startTime,
      endTime: s.endTime,
      allowFlexibleAssignment: Boolean(s.allowFlexibleAssignment),
      manualOkConfirmed: Boolean(s.manualOkConfirmed),
      manualDoubleConflictAccepted: Boolean(s.manualDoubleConflictAccepted),
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
  const contactNameById = useMemo(
    () => new Map(contacts.map(contact => [contact.id, contact.name])),
    [contacts]
  );
  const contactName = useCallback(
    (id: number | null) => (id === null ? "" : contactNameById.get(id) ?? ""),
    [contactNameById]
  );
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
  const currentUserName = normalizeSchedulePersonName(user?.name);
  const ownContactIds = useMemo(
    () =>
      new Set(
        contacts
          .filter(
            contact =>
              normalizeSchedulePersonName(contact.name) === currentUserName
          )
          .map(contact => contact.id)
      ),
    [contacts, currentUserName]
  );
  const ownHelperIds = useMemo(
    () => deriveOwnAssignedHelperIds(helpers, user?.name),
    [helpers, user?.name]
  );
  useEffect(() => {
    if (
      isDefaultMyTasks &&
      (ownContactIds.size > 0 || ownHelperIds.size > 0)
    ) {
      setMyTasksOnly(true);
    }
  }, [isDefaultMyTasks, ownContactIds, ownHelperIds]);
  const updateMyTasksDefault = (enabled: boolean) => {
    setDefaultMyTasks(enabled);
    if (!enabled) setMyTasksOnly(false);
    else if (ownContactIds.size > 0 || ownHelperIds.size > 0) {
      setMyTasksOnly(true);
    }
  };
  const dashboardHelper = dashboardHelperId
    ? helperById.get(dashboardHelperId)
    : null;
  const label = useCallback(
    (helper: { name: string; contactId?: number | null }) =>
      `${helper.name}${helper.contactId ? ` (${contactName(helper.contactId)})` : ""}`,
    [contactName]
  );

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
  // Von der kompletten Eventauswertung abgeleitet, nicht nur vom aktuell
  // sichtbaren Tabellenfilter: Das Dropdown muss auch Einteilungen an anderen
  // Festivaltagen zuverlässig als gelbes Tagessegment zeigen.
  const assignedDaysByHelper = useMemo(() => {
    const result = new Map<number, Array<{ day: Weekday }>>();
    for (const evaluation of evals) {
      const day = normalizeWeekday(evaluation.shift.day);
      if (!day || !activeDays.includes(day)) continue;
      for (const assignment of evaluation.assigned as AssignmentT[]) {
        const assignedDays = result.get(assignment.helperId) ?? [];
        assignedDays.push({ day });
        result.set(assignment.helperId, assignedDays);
      }
    }
    return result;
  }, [activeDays, evals]);
  const eligibleHelpersByShift = useMemo(
    () =>
      new Map(
        evals.map(evaluation => [
          evaluation.shift.id,
          helpers.filter(helper => helperEligibleForShift(helper, evaluation.shift)),
        ])
      ),
    [evals, helpers]
  );
  const assignmentDisplayByHelper = useMemo(
    () =>
      new Map(
        Array.from(assignedShiftsByHelper.entries()).map(([helperId, assignedShifts]) => [
          helperId,
          assignedShifts.map((assignedShift: DropdownShift) => ({
            day: assignedShift.day,
            label: `${assignedShift.area}: ${assignedShift.task}`,
            time: formatTimeLabel(assignedShift),
          })),
        ])
      ),
    [assignedShiftsByHelper]
  );

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

  const manualOkConfirmationAvailable = useMemo(() => {
    if (!editShift || form.needed <= 0) return false;
    const currentEvaluation = evals.find(
      evaluation => evaluation.shift.id === editShift.id
    );
    if (!currentEvaluation) return false;
    return (
      currentEvaluation.assigned.length >= form.needed &&
      currentEvaluation.timeUndercoverage
    );
  }, [editShift, evals, form.needed]);

  const manualDoubleConflictConfirmationAvailable = useMemo(() => {
    if (!editShift) return false;
    const currentEvaluation = evals.find(
      evaluation => evaluation.shift.id === editShift.id
    );
    return Boolean(currentEvaluation && currentEvaluation.doppelIds.size > 0);
  }, [editShift, evals]);

  const filtered = useMemo(
    () =>
      evals
        .filter(
          e =>
            (isMobileView
              ? mobileDays.length === 0 || mobileDays.includes(e.shift.day)
              : day === "alle" || e.shift.day === day) &&
            (isMobileView
              ? mobileAreas.length === 0 || mobileAreas.includes(e.shift.area)
              : area === "alle" || e.shift.area === area) &&
            (!locationFilter || e.shift.locationId === locationFilter) &&
            (isMobileView
              ? mobileStatuses.length === 0 ||
                mobileStatuses.some(selectedStatus =>
                  planStatusMatchesFilter(
                    selectedStatus,
                    e.status,
                    Boolean(
                      e.shift.manualOkConfirmed ||
                        e.shift.manualDoubleConflictAccepted
                    )
                  )
                )
              : planStatusMatchesFilter(
                  status,
                  e.status,
                  Boolean(
                    e.shift.manualOkConfirmed ||
                      e.shift.manualDoubleConflictAccepted
                  )
                )) &&
            (isMobileView
              ? mobileWarnings.length === 0 ||
                mobileWarnings.some(
                  warning =>
                    (warning === "konflikte" && e.doppelCount > 0) ||
                    (warning === "ausfaelle" && e.ausfallCount > 0)
                )
              : (warningFilter !== "konflikte" || e.doppelCount > 0) &&
                (warningFilter !== "ausfaelle" || e.ausfallCount > 0)) &&
            (!dashboardHelperId ||
              e.assigned.some(
                assignment => assignment.helperId === dashboardHelperId
              )) &&
            planEvaluationMatchesSearch(e, q, helperNameById) &&
            (isMobileView
              ? !mobileFlexibleOnly || e.shift.allowFlexibleAssignment
              : flexibleAssignmentFilter === "alle" ||
                e.shift.allowFlexibleAssignment) &&
            (isMobileView
              ? mobileContactIds.length === 0 ||
                mobileContactIds.includes(
                  String(areaContactMap.get(e.shift.area) ?? "")
                )
              : apFilter === "alle" ||
                String(areaContactMap.get(e.shift.area) ?? "") === apFilter) &&
            (!myTasksOnly ||
              matchesMyScheduleAssignment({
                area: e.shift.area,
                areaContactMap,
                ownContactIds,
                assigned: e.assigned,
                ownHelperIds,
              })) &&
            (!(isMobileView ? mobileOpenOrUnassignedOnly : openOrUnassignedOnly) ||
              e.status === "OFFEN" || e.assigned.length < e.shift.needed)
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
      isMobileView,
      day,
      area,
      mobileDays,
      mobileAreas,
      mobileStatuses,
      mobileWarnings,
      mobileContactIds,
      mobileFlexibleOnly,
      mobileOpenOrUnassignedOnly,
      locationFilter,
      status,
      warningFilter,
      dashboardHelperId,
      q,
      apFilter,
      flexibleAssignmentFilter,
      myTasksOnly,
      openOrUnassignedOnly,
      areaContactMap,
      helperNameById,
      ownContactIds,
      ownHelperIds,
    ]
  );

  const activeHelpers = (shift: DropdownShift) =>
    eligibleHelpersByShift.get(shift.id) ?? [];

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
    const sortedActives = actives
      .map(helper => {
        const conflicts = overlappingAssignments(helper.id, shift);
        const isAlreadyAssigned = conflicts.length > 0;
        const assignmentFeedback = helperDropdownAssignmentFeedback({
          assignments: assignedDaysByHelper.get(helper.id) ?? [],
          activeDays,
          availabilityByDay: activeDays.map(day => ({
            day,
            available: helperDayAvailability(helper, day).available,
          })),
          currentDay: shift.day,
          hasTimeConflict: isAlreadyAssigned,
        });
        return { helper, conflicts, isAlreadyAssigned, assignmentFeedback };
      })
      .sort(
        (left, right) =>
          helperDropdownPriority(left.assignmentFeedback) -
            helperDropdownPriority(right.assignmentFeedback) ||
          left.helper.name.localeCompare(right.helper.name, "de")
      );
    return (
      <div className="grid max-w-full grid-cols-2 items-start gap-1">
        {slotsFor(evalE).map(({ slot, a }) => {
          if (!a) {
            if (!canEditPlan) {
              return (
                <span
                  key={slot}
                  className="slot slot-offen inline-flex h-9 !min-w-0 !max-w-none items-center"
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
                <SelectTrigger className="slot slot-offen h-11 !w-full !min-w-0 !max-w-none md:h-9">
                  <SelectValue placeholder="Helfer wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {sortedActives.map(({ helper, conflicts, isAlreadyAssigned, assignmentFeedback }) => {
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
                          <HelperDropdownFeedbackBadge
                            feedback={assignmentFeedback}
                            assignments={assignmentDisplayByHelper.get(helper.id) ?? []}
                          />
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
            !isAusfall &&
            !evalE.shift.manualDoubleConflictAccepted &&
            (evalE.doppelIds as Set<number>).has(a.helperId);
          const className = isAusfall
            ? "slot-ausfall"
            : isDoppel
              ? "slot-doppel"
              : "slot-ok";
          if (!helper) {
            return (
              <span
                key={slot}
                className={`slot ${className} inline-flex !min-w-0 !max-w-none items-center`}
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

  const toggleSelectedHelper = (shiftId: number, helperId: number) => {
    setSelectedHelperIdsByShift(previous => {
      const selected = previous[shiftId] ?? [];
      return {
        ...previous,
        [shiftId]: selected.includes(helperId)
          ? selected.filter(id => id !== helperId)
          : [...selected, helperId],
      };
    });
  };

  const renderShiftCard = (evalE: any) => {
    const shift = evalE.shift as DropdownShift & { needed: number; note?: string | null };
    const assigned = evalE.assigned as AssignmentT[];
    const freeSlots = Math.max(shift.needed - assigned.length, 0);
    const selectedHelperIds = selectedHelperIdsByShift[shift.id] ?? [];
    const candidateHelpers = activeHelpers(shift)
      .filter(helper => !assigned.some(assignment => assignment.helperId === helper.id))
      .map(helper => {
        const conflicts = overlappingAssignments(helper.id, shift);
        const assignmentFeedback = helperDropdownAssignmentFeedback({
          assignments: assignedDaysByHelper.get(helper.id) ?? [],
          activeDays,
          availabilityByDay: activeDays.map(day => ({
            day,
            available: helperDayAvailability(helper, day).available,
          })),
          currentDay: shift.day as Weekday,
          hasTimeConflict: conflicts.length > 0,
        });
        return { helper, conflicts, assignmentFeedback };
      })
      .sort(
        (left, right) =>
          helperDropdownPriority(left.assignmentFeedback) -
            helperDropdownPriority(right.assignmentFeedback) ||
          left.helper.name.localeCompare(right.helper.name, "de")
      );
    const percent = shift.needed > 0 ? Math.min(100, Math.round((assigned.length / shift.needed) * 100)) : 100;
    const progressClass =
      evalE.status === "OK"
        ? "bg-emerald-500"
        : evalE.status === "KNAPP"
          ? "bg-amber-500"
          : "bg-blue-600";

    return (
      <Card
        key={shift.id}
        data-slot="shift-card"
        className="overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      >
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {shift.day}
                </span>
                <StatusBadge
                  status={evalE.status}
                  timeUndercoverage={evalE.timeUndercoverage}
                  manuallyConfirmed={shift.manualOkConfirmed}
                  doubleConflictAccepted={shift.manualDoubleConflictAccepted}
                />
              </div>
              <h2 className="break-words text-lg font-semibold tracking-tight text-slate-950">
                <HighlightedText text={shift.task} query={q} />
              </h2>
              <p className="text-sm text-slate-600">
                <HighlightedText text={shift.area} query={q} /> · {formatTimeLabel(shift)}
                <FlexibleTimeNote flexible={shift.allowFlexibleAssignment} />
              </p>
              <LocationMapLink
                locationId={shift.locationId}
                locations={locations}
                className="mt-1"
              />
            </div>
            {canEditPlan && (
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  title="Schicht bearbeiten"
                  aria-label={`Schicht ${shift.area}: ${shift.task} bearbeiten`}
                  onClick={() => openEdit(shift)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Schicht löschen"
                  aria-label={`Schicht ${shift.area}: ${shift.task} löschen`}
                  onClick={() => setDeleteCandidate(shift)}
                >
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">Besetzung</span>
              <span className="font-semibold text-slate-950">
                {assigned.length} von {shift.needed} Helfern
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-200"
              aria-label={`${assigned.length} von ${shift.needed} Helfern eingeteilt`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${progressClass}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Eingeteilt
              </p>
              <div className="flex min-h-10 flex-wrap content-start gap-1.5">
                {assigned.length ? (
                  assigned.map(assignment => {
                    const helper =
                      evalE.validHelpers.find((item: any) => item.id === assignment.helperId) ??
                      evalE.ausfallHelpers.find((item: any) => item.id === assignment.helperId);
                    const isAusfall = evalE.ausfallHelpers.some(
                      (item: any) => item.id === assignment.helperId
                    );
                    const isDoppel =
                      !isAusfall &&
                      !shift.manualDoubleConflictAccepted &&
                      (evalE.doppelIds as Set<number>).has(assignment.helperId);
                    if (!helper) return null;
                    return (
                      <AssignedHelperChip
                        key={assignment.id}
                        helper={helper}
                        displayLabel={helper.name}
                        searchQuery={q}
                        className={isAusfall ? "slot-ausfall" : isDoppel ? "slot-doppel" : "slot-ok"}
                        activeDays={activeDays}
                        shiftDay={shift.day as Weekday}
                        canRemove={canEditPlan}
                        onRemove={() => unassign.mutate({ id: assignment.id })}
                        compact
                      />
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">Noch niemand eingeteilt</span>
                )}
              </div>
            </section>

            <section
              data-slot="shift-card-batch-selection"
              className="rounded-xl border border-blue-100 bg-blue-50/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Helfer auswählen
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {freeSlots} {freeSlots === 1 ? "Platz frei" : "Plätze frei"}
                </span>
              </div>
              {canEditPlan ? (
                <>
                  <div className="max-h-52 space-y-1 overflow-y-auto pr-1" role="group" aria-label={`Helfer für ${shift.task} auswählen`}>
                    {candidateHelpers.map(({ helper, conflicts, assignmentFeedback }) => {
                      const selected = selectedHelperIds.includes(helper.id);
                      const selectionFull = !selected && selectedHelperIds.length >= freeSlots;
                      const timeRestricted = helperHasTimedAvailability(
                        helper,
                        shift.day as Weekday
                      );
                      const availabilityLabel = timeRestricted
                        ? helperAvailabilityWindowLabel(helper, shift.day as Weekday)
                        : "";
                      const conflictTitle = conflicts
                        .map(other => `${other.area}: ${other.task} (${formatTimeLabel(other)})`)
                        .join(", ");
                      return (
                        <div
                          key={helper.id}
                          data-slot="shift-card-helper-candidate"
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[13px] leading-4 transition-colors ${selected ? "border-blue-300 bg-white shadow-sm" : "border-transparent hover:border-blue-200 hover:bg-white/80"} ${selectionFull ? "cursor-not-allowed opacity-50" : "md:cursor-pointer"}`}
                          title={conflictTitle || availabilityLabel || undefined}
                          onClick={() => {
                            if (!isMobileView && !selectionFull && !assignMany.isPending) {
                              toggleSelectedHelper(shift.id, helper.id);
                            }
                          }}
                        >
                          <Checkbox
                            checked={selected}
                            disabled={assignMany.isPending || selectionFull}
                            onClick={event => event.stopPropagation()}
                            onCheckedChange={() => toggleSelectedHelper(shift.id, helper.id)}
                            aria-label={`${label(helper)} auswählen`}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={label(helper)}>
                            {helper.companion?.trim() && <span aria-hidden="true">👪 </span>}
                            <button
                              type="button"
                              data-slot="mobile-helper-details-trigger"
                              className="max-w-full truncate text-left font-medium text-slate-800 underline decoration-slate-200 underline-offset-2 md:pointer-events-none md:no-underline"
                              aria-label={`Hinweise und Einsatzdetails von ${helper.name} anzeigen`}
                              onClick={event => {
                                event.stopPropagation();
                                if (isMobileView) {
                                  setMobileHelperDetails({ helper, shift });
                                }
                              }}
                            >
                              {helper.name}
                            </button>
                          </span>
                          <HelperDropdownFeedbackBadge
                            feedback={assignmentFeedback}
                            assignments={assignmentDisplayByHelper.get(helper.id) ?? []}
                            compact
                            interactive={isMobileView}
                          />
                        </div>
                      );
                    })}
                    {!candidateHelpers.length && (
                      <p className="py-2 text-sm text-muted-foreground">
                        Keine weiteren verfügbaren Helfer.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 w-full bg-blue-600 text-white hover:bg-blue-700"
                    disabled={!selectedHelperIds.length || assignMany.isPending}
                    onClick={() => assignMany.mutate({ shiftId: shift.id, helperIds: selectedHelperIds })}
                  >
                    {assignMany.isPending
                      ? "Zuordnung wird gespeichert …"
                      : selectedHelperIds.length === 1
                        ? "1 Helfer zuordnen"
                        : `${selectedHelperIds.length} Helfer zuordnen`}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Helferzuweisungen sind nur für Administratoren möglich.
                </p>
              )}
            </section>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Ansprechpartner</dt>
              <dd className="font-medium">
                {contactName(areaContactMap.get(shift.area) ?? null) || "nicht zugeordnet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bemerkung</dt>
              <dd className="line-clamp-2 font-medium text-slate-700">
                {shift.note?.trim() || "Keine Bemerkung"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 lg:pr-4">
          <PageTitle icon="plan">Einsatzplan</PageTitle>
          <p className="text-sm text-muted-foreground">
          {canEditPlan
            ? "Nur verfügbare, aktive Helfer sind auswählbar. „Neu“ bedeutet noch keine Einteilung; die Tagessegmente richten sich nach den Eventtagen (Grün: aktuell frei, Gelb: dort eingeteilt, Rot: nicht verfügbar). Zeitgleich bereits eingeteilte Helfer bleiben gelb markiert und auswählbar. Absagen markieren Ausfälle (rot), Doppelbelegungen werden gewarnt (orange)."
            : "Das Planungsteam kann den Einsatzplan vollständig ansehen und filtern. Änderungen und Helferzuweisungen sind Administratoren vorbehalten."}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col items-start gap-2 lg:w-auto lg:min-w-[344px] lg:items-end">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          {canEditPlan && (
            <div
              data-plan-action-header
              className="w-full space-y-2"
            >
              <div
                data-plan-data-actions
                className="grid grid-cols-2 gap-2 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:whitespace-nowrap [&>[data-slot=button]]:px-2 lg:[&>[data-slot=button]]:h-10"
              >
                <CopyPreviousPlanButton />
                <PlanResetDialogButton
                  area="shifts"
                  label="Einsatzplan"
                  onCompleted={() => setQ("")}
                />
              </div>
              <Button
                type="button"
                onClick={openCreate}
                disabled={isEventLoading || !activeDays.length}
                className="w-full border-blue-600 bg-blue-600 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500"
              >
                <Plus className="mr-2 h-4 w-4" />
                Neue Schicht
              </Button>
            </div>
          )}
        </div>
      </div>

      {areas.length > 0 && (
        <Card className="gap-0 border-slate-200 py-0 shadow-sm">
          <CardContent className="px-2 py-1 sm:px-2.5 sm:py-1">
            <button
              type="button"
              className="flex h-9 w-full items-center justify-between gap-3 rounded-md px-1.5 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
              aria-expanded={areaContactsExpanded}
              aria-controls="area-contacts-grid"
              onClick={() => setAreaContactsExpanded(expanded => !expanded)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  Ansprechpartner je Bereich
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {areas.length} {areas.length === 1 ? "Bereich" : "Bereiche"}
                </span>
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-600 transition-transform duration-200 ${areaContactsExpanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div
              id="area-contacts-grid"
              className={`${areaContactsExpanded ? "grid" : "hidden"} mt-1.5 gap-1.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`}
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

      {dashboardHelperId && (
        <div
          data-dashboard-helper-filter
          className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3" role="status" aria-live="polite">
            <Info className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold">Dashboardfilter: {dashboardHelper?.name ?? "Helfer"}</p>
              <p className="text-sm text-blue-800">
                {dashboardDayFilter
                  ? `Nur eingeteilte Schichten am ${dashboardDayFilter}.`
                  : "Nur eingeteilte Schichten dieses Helfers."}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-blue-300 bg-white text-blue-900 hover:bg-blue-100"
            onClick={resetPlanFilters}
          >
            Filter aufheben
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="order-1 flex items-center gap-1 md:hidden" aria-label="Persönlicher Einsatzfilter">
          <Button
            type="button"
            size="sm"
            variant={myTasksOnly ? "default" : "outline"}
            className={
              myTasksOnly
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
            }
            disabled={ownContactIds.size === 0 && ownHelperIds.size === 0}
            title={
              ownContactIds.size === 0 && ownHelperIds.size === 0
                ? "Der aktuelle Sitzungsname ist weder Ansprechpartner noch Helfer zugeordnet."
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

        <div className="order-2 md:hidden">
          <button
            type="button"
            data-slot="mobile-plan-filter-toggle"
            aria-expanded={mobileFiltersOpen}
            aria-controls="mobile-plan-filter-panel"
            onClick={() => setMobileFiltersOpen(open => !open)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
              <span>Filter & Auswahl</span>
              {mobileFilterCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                  {mobileFilterCount} aktiv
                </span>
              )}
            </span>
            <ChevronDown
              className={`size-5 shrink-0 text-slate-600 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {mobileFiltersOpen && (
            <div
              id="mobile-plan-filter-panel"
              data-slot="mobile-plan-filter-panel"
              className="mt-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Tage</legend>
                <div className="grid grid-cols-2 gap-2">
                  {activeDays.map(option => (
                    <label key={option} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileDays.includes(option)}
                        onCheckedChange={() => setMobileDays(values => toggleMultiSelection(values, option))}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Bereiche</legend>
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {areas.map(option => (
                    <label key={option} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileAreas.includes(option)}
                        onCheckedChange={() => setMobileAreas(values => toggleMultiSelection(values, option))}
                      />
                      <span className="min-w-0 break-words">{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Status</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["OFFEN", "Offen"],
                    ["KNAPP", "Knapp"],
                    ["OK", "OK"],
                    ["OK_MANUELL", "OK (manuell)"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileStatuses.includes(value)}
                        onCheckedChange={() => setMobileStatuses(values => toggleMultiSelection(values, value))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Warnungen</legend>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    ["konflikte", "Doppelbelegungen"],
                    ["ausfaelle", "Ausfälle"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileWarnings.includes(value)}
                        onCheckedChange={() => setMobileWarnings(values => toggleMultiSelection(values, value))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Ansprechpartner</legend>
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {contacts.map(contact => (
                    <label key={contact.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileContactIds.includes(String(contact.id))}
                        onCheckedChange={() =>
                          setMobileContactIds(values =>
                            toggleMultiSelection(values, String(contact.id))
                          )
                        }
                      />
                      <span className="min-w-0 break-words">{contact.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Weitere Auswahl</legend>
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                  <Checkbox
                    checked={mobileOpenOrUnassignedOnly}
                    onCheckedChange={checked => setMobileOpenOrUnassignedOnly(checked === true)}
                  />
                  Nur offene / unbesetzte Schichten
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                  <Checkbox
                    checked={mobileFlexibleOnly}
                    onCheckedChange={checked => setMobileFlexibleOnly(checked === true)}
                  />
                  Nur flexible Belegung
                </label>
              </fieldset>
              {hasActiveDropdownFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 w-full border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
                  onClick={resetPlanFilters}
                >
                  <FilterX className="mr-2 size-4" aria-hidden="true" />
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          )}
        </div>
        <div
          className="order-1 hidden flex-wrap gap-2 md:flex"
          aria-label="Schnellfilter Einsatzplan"
        >
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
              disabled={ownContactIds.size === 0 && ownHelperIds.size === 0}
              title={
                ownContactIds.size === 0 && ownHelperIds.size === 0
                  ? "Der aktuelle Sitzungsname ist weder Ansprechpartner noch Helfer zugeordnet."
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
            ⚠ Nur offene / unbesetzte Schichten
          </Button>
        </div>
        <div className="order-2 hidden gap-2 sm:grid-cols-2 md:grid lg:flex lg:flex-wrap">
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
              <SelectItem value="OK_MANUELL">OK (Manuell)</SelectItem>
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
          <Select
            value={flexibleAssignmentFilter}
            onValueChange={value =>
              setFlexibleAssignmentFilter(value as "alle" | "flexibel")
            }
          >
            <SelectTrigger
              className="w-full lg:w-56"
              aria-label="Flexible Belegung filtern"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Belegungsarten</SelectItem>
              <SelectItem value="flexibel">
                Nur flexible Belegung
              </SelectItem>
            </SelectContent>
          </Select>
          {hasActiveDropdownFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-plan-filter-reset
              className="h-11 w-full px-2 text-base text-sky-700 hover:bg-sky-100/60 hover:text-sky-900 lg:ml-1 lg:h-10 lg:w-auto lg:text-sm"
              onClick={resetPlanFilters}
              aria-label="Alle Einsatzplanfilter zurücksetzen"
            >
              <FilterX className="mr-1 size-3.5" aria-hidden="true" />
              Filter zurücksetzen
            </Button>
          )}
        </div>

        <div className="order-3 relative w-full lg:max-w-xl">
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
      </div>

      {viewMode === "kacheln" && (
        <div
          data-slot="shift-card-grid"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
        >
          {filtered.map(renderShiftCard)}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      )}

      <div className={viewMode === "liste" ? "space-y-3 md:hidden" : "hidden"}>
        {filtered.map(e => {
          const shift = e.shift;
          return (
            <Card key={shift.id} className="shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{shift.day}</span>
                      <StatusBadge
                        status={e.status}
                        timeUndercoverage={e.timeUndercoverage}
                        manuallyConfirmed={shift.manualOkConfirmed}
                        doubleConflictAccepted={
                          shift.manualDoubleConflictAccepted
                        }
                      />
                    </div>
                    <h2 className="break-words text-lg font-semibold">
                      <HighlightedText text={shift.task} query={q} />
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      <HighlightedText text={shift.area} query={q} /> ·{" "}
                      {formatTimeLabel(shift)}
                      <FlexibleTimeNote
                        flexible={shift.allowFlexibleAssignment}
                      />
                    </p>
                    <LocationMapLink
                      locationId={shift.locationId}
                      locations={locations}
                      className="mt-1"
                    />
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
                    <dt className="text-xs text-muted-foreground">
                      Besetzt / Bedarf
                    </dt>
                    <dd className="font-semibold">
                      {e.besetzt} / {shift.needed}
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

      <Card className={viewMode === "liste" ? "hidden w-full shadow-sm md:block" : "hidden"}>
        <CardContent className={`w-full ${STICKY_TABLE_CONTAINER_CLASS} p-0`}>
          <table
            data-slot="roster-table"
            className="w-full min-w-[1600px] table-auto text-sm"
          >
            <thead
              data-sticky-table-header="plan"
              className={STICKY_TABLE_HEADER_CLASS}
            >
              <tr className="text-left">
                <th className={`min-w-20 whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Tag</th>
                <th className={`min-w-[130px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Bereich</th>
                <th className={`min-w-[75px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS} text-center`}><span className="sr-only">Aktionen</span></th>
                <th className={`min-w-[140px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Kontakt</th>
                <th className={`min-w-[160px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Aufgabe</th>
                <th className={`min-w-[180px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Bemerkung</th>
                <th className={`min-w-[120px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Zeit</th>
                <th className={`min-w-[110px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS} text-center`}>Besetzt / Bedarf</th>
                <th className={`min-w-[90px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS} text-center`}>Status</th>
                <th className={`min-w-[80px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS} text-center`}>Doppelt</th>
                <th className={`min-w-[80px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS} text-center`}>Ausfälle</th>
                <th className={`min-w-[320px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}`}>Eingeteilte Helfer</th>
                <th className="w-12 whitespace-nowrap px-2 py-2.5 text-center">
                  <span className="sr-only">Schicht löschen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={13}>
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
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{s.day}</td>
                    <td className="min-w-[130px] px-3 py-2.5">
                      <span className="block break-words [overflow-wrap:anywhere]">
                        <HighlightedText text={s.area} query={q} />
                      </span>
                      <LocationMapLink
                        locationId={s.locationId}
                        locations={locations}
                        className="mt-0.5"
                      />
                    </td>
                    <td data-slot="roster-actions" className="min-w-[40px] px-3 py-2.5">
                      <div className="flex items-center justify-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={
                            canEditPlan
                              ? "Schicht bearbeiten"
                              : "Schichtbearbeitung ist nur für Administratoren möglich"
                          }
                          disabled={!canEditPlan}
                          onClick={() => canEditPlan && openEdit(s)}
                        >
                          <Pencil
                            className={`h-3.5 w-3.5 ${canEditPlan ? "text-slate-700" : "text-gray-400 opacity-50"}`}
                          />
                        </Button>
                      </div>
                    </td>
                    <td className="min-w-[140px] px-3 py-2.5">
                      <span className="block max-w-[8rem] break-words [overflow-wrap:anywhere]">
                        {contactName(areaContactMap.get(s.area) ?? null) || (
                          <span className="text-amber-700">nicht zugeordnet</span>
                        )}
                      </span>
                    </td>
                    <td className="min-w-[160px] break-words px-3 py-2.5 [overflow-wrap:anywhere]">
                      <HighlightedText text={s.task} query={q} />
                    </td>
                    <td className="min-w-[180px] whitespace-pre-wrap break-words px-3 py-2.5 text-muted-foreground [overflow-wrap:anywhere]">
                      {s.note?.trim() || "–"}
                    </td>
                    <td className="min-w-[120px] whitespace-nowrap px-3 py-2.5">
                      <div>
                        <span>{formatTimeLabel(s)}</span>
                        <FlexibleTimeNote
                          flexible={s.allowFlexibleAssignment}
                        />
                      </div>
                    </td>
                    <td className="min-w-[110px] whitespace-nowrap px-3 py-2.5 text-center font-semibold">
                      {e.besetzt} / {s.needed}
                    </td>
                    <td className="min-w-[90px] whitespace-nowrap px-3 py-2.5 text-center">
                      <StatusBadge
                        status={e.status}
                        timeUndercoverage={e.timeUndercoverage}
                        manuallyConfirmed={s.manualOkConfirmed}
                        doubleConflictAccepted={
                          s.manualDoubleConflictAccepted
                        }
                      />
                    </td>
                    <td className="min-w-[80px] whitespace-nowrap px-3 py-2.5 text-center">
                      {e.doppelCount > 0 ? (
                        <span className="badge badge-warn">
                          {e.doppelCount}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="min-w-[80px] whitespace-nowrap px-3 py-2.5 text-center">
                      {e.ausfallCount > 0 ? (
                        <span className="badge badge-err">
                          {e.ausfallCount}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="min-w-[320px] px-3 py-2.5 align-top">
                      <div data-slot="roster-helper-grid">
                        {renderShiftSlots(evalE)}
                      </div>
                    </td>
                    <td
                      data-slot="roster-delete-action"
                      className="w-12 px-2 py-2.5 text-center align-top"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={
                          canEditPlan
                            ? "Schicht löschen"
                            : "Schichtlöschen ist nur für Administratoren möglich"
                        }
                        aria-label={`Schicht ${s.area}: ${s.task} löschen`}
                        disabled={!canEditPlan}
                        onClick={() => canEditPlan && setDeleteCandidate(s)}
                      >
                        <Trash2
                          className={`h-4 w-4 ${canEditPlan ? "text-red-600" : "text-gray-400 opacity-50"}`}
                          aria-hidden="true"
                        />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={13}>
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

      <Dialog
        open={Boolean(mobileHelperDetails)}
        onOpenChange={open => {
          if (!open) setMobileHelperDetails(null);
        }}
      >
        <DialogContent
          data-slot="mobile-helper-details-dialog"
          className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>{mobileHelperDetails?.helper.name ?? "Helfer"}</DialogTitle>
            <p className="text-sm text-slate-500">
              Hinweise, Verfügbarkeit und Einsätze im Überblick.
            </p>
          </DialogHeader>
          {mobileHelperDetails && (
            <div className="space-y-4 py-2 text-sm">
              <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p>
                  <span className="font-medium">Telefon:</span>{" "}
                  {mobileHelperDetails.helper.phone?.trim() ? (
                    <a
                      href={`tel:${mobileHelperDetails.helper.phone.replace(/[^\d+]/g, "")}`}
                      className="text-blue-700 underline decoration-blue-300 underline-offset-2"
                    >
                      {mobileHelperDetails.helper.phone.trim()}
                    </a>
                  ) : (
                    "nicht hinterlegt"
                  )}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  <span className="font-medium">Hinweis für PDF:</span>{" "}
                  {mobileHelperDetails.helper.note?.trim() || "–"}
                </p>
                {mobileHelperDetails.helper.companion?.trim() && (
                  <p>
                    <span className="font-medium">Zusätzliche Begleitung:</span>{" "}
                    {mobileHelperDetails.helper.companion.trim()}
                  </p>
                )}
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-950">Tage & Einsätze</h3>
                <div className="space-y-2">
                  {activeDays.map(day => {
                    const availability = helperDayAvailability(
                      mobileHelperDetails.helper,
                      day
                    ).value;
                    const timeWindow = helperHasTimedAvailability(
                      mobileHelperDetails.helper,
                      day
                    )
                      ? helperAvailabilityWindowLabel(mobileHelperDetails.helper, day)
                      : null;
                    const assignments = (
                      assignmentDisplayByHelper.get(mobileHelperDetails.helper.id) ?? []
                    ).filter(assignment => normalizeWeekday(assignment.day) === day);
                    return (
                      <div
                        key={day}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-900">{day}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${AVAILABILITY_PILL_CLASS[availability]}`}>
                            {availability}
                          </span>
                        </div>
                        {timeWindow && (
                          <p className="mt-1 text-xs text-slate-600">
                            Verfügbar: {timeWindow}
                          </p>
                        )}
                        {assignments.length ? (
                          <div className="mt-2 space-y-1 text-xs text-slate-700">
                            {assignments.map(assignment => (
                              <p key={`${assignment.label}-${assignment.time}`}>
                                <span className="font-medium">Eingeteilt:</span>{" "}
                                {assignment.label} · {assignment.time}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">Noch nicht eingeteilt</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setMobileHelperDetails(null)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 opacity-100 shadow-2xl sm:max-w-2xl dark:!bg-slate-950 dark:!text-slate-50 [&_[data-slot=input]]:!bg-white [&_[data-slot=input]]:dark:!bg-slate-900 [&_[data-slot=select-trigger]]:!bg-white [&_[data-slot=select-trigger]]:dark:!bg-slate-900">
          <DialogHeader>
            <DialogTitle>
              {editShift ? "Schicht bearbeiten" : "Neue Schicht"}
            </DialogTitle>
            <p className="text-sm font-normal text-muted-foreground">
              In klaren Schritten zu einer planbaren Schicht.
            </p>
          </DialogHeader>
          <div className="grid min-w-0 gap-4 py-2">
            <div data-slot="shift-dialog-basics" className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:grid-cols-2">
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
            <div data-slot="shift-dialog-area" className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
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
            <div data-slot="shift-dialog-location" className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <Label htmlFor="shift-location">Ort / Standort</Label>
              <Select
                value={form.locationId ? String(form.locationId) : "none"}
                onValueChange={value =>
                  setForm({
                    ...form,
                    locationId: value === "none" ? null : Number(value),
                  })
                }
              >
                <SelectTrigger id="shift-location"><SelectValue placeholder="Kein Ort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Ort</SelectItem>
                  {locations.map(location => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div data-slot="shift-dialog-task" className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <Label>Aufgabe / Schicht</Label>
              <Input
                value={form.task}
                onChange={e => setForm({ ...form, task: e.target.value })}
                placeholder="z. B. Grill & Pommes Tag"
              />
            </div>
            <div data-slot="shift-dialog-time" className="grid gap-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3.5 sm:grid-cols-2">
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
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Checkbox
                id="shift-allow-flexible-assignment"
                checked={form.allowFlexibleAssignment}
                onCheckedChange={checked =>
                  setForm({ ...form, allowFlexibleAssignment: checked === true })
                }
              />
              <Label
                htmlFor="shift-allow-flexible-assignment"
                className="cursor-pointer space-y-0.5 leading-tight"
              >
                <span className="block text-sm font-medium">
                  Flexible Belegung erlauben
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Erlaubt die Zuweisung von Helfern mit Teilzeit-Verfügbarkeit innerhalb dieses Zeitfensters.
                </span>
              </Label>
            </div>
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
                      {form.allowFlexibleAssignment
                        ? "Die flexible Belegung kann gespeichert werden. Teilzeit-Helfer bleiben eingeteilt; die Schicht wird als zeitlich knapp markiert."
                        : "Die Schichtzeit kann gespeichert werden. Der Helfer wird anschließend als zeitlich nicht verfügbar ausgewiesen, bis Zeitfenster oder Einteilung angepasst sind."}
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
          <DialogFooter className="w-full min-w-0 flex-col gap-3 border-t pt-3 sm:flex-col sm:items-stretch">
            <div className="w-full min-w-0 space-y-2">
              {manualOkConfirmationAvailable && (
                <div className="flex w-full min-w-0 items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-left">
                  <Checkbox
                    id="shift-manual-ok-confirmed"
                    checked={form.manualOkConfirmed}
                    onCheckedChange={checked =>
                      setForm({
                        ...form,
                        manualOkConfirmed: checked === true,
                      })
                    }
                  />
                  <Label
                    htmlFor="shift-manual-ok-confirmed"
                    className="min-w-0 cursor-pointer space-y-0.5 break-words leading-tight"
                  >
                    <span className="block text-sm font-medium text-emerald-950">
                      ✓ Manuell als OK bestätigen
                    </span>
                    <span className="block text-xs font-normal text-emerald-800">
                      Ignoriert zeitliche Abweichungen & markiert die Schicht als vollständig geprüft.
                    </span>
                  </Label>
                </div>
              )}
              {manualDoubleConflictConfirmationAvailable && (
                <div className="flex w-full min-w-0 items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-left">
                  <Checkbox
                    id="shift-manual-double-conflict-accepted"
                    checked={form.manualDoubleConflictAccepted}
                    onCheckedChange={checked =>
                      setForm({
                        ...form,
                        manualDoubleConflictAccepted: checked === true,
                      })
                    }
                  />
                  <Label
                    htmlFor="shift-manual-double-conflict-accepted"
                    className="min-w-0 cursor-pointer space-y-0.5 break-words leading-tight"
                  >
                    <span className="block text-sm font-medium text-emerald-950">
                      ✓ Doppelbelegung akzeptieren
                    </span>
                    <span className="block text-xs font-normal text-emerald-800">
                      Gilt nach Prüfung als genehmigt und entfernt die Warnung.
                    </span>
                  </Label>
                </div>
              )}
            </div>
            <div className="flex w-full flex-wrap justify-end gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
