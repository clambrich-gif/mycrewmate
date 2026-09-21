import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageTitle } from "@/components/PageTitle";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import {
  buildWhatsAppShareUrl,
  renderWhatsAppMessage,
} from "@/lib/whatsappShare";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Clock3, FileDown, FilterX, Info, MessageCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlanResetDialogButton } from "@/components/PlanResetDialogButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import {
  eventWeekdays,
  helperDayAvailability,
  helperAvailabilityWindowLabel,
  helperHasTimedAvailability,
  isHelperWithoutFirstContact,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_AVAILABILITY_TIME_FIELDS,
  WEEKDAY_SHORT_LABELS,
  type Weekday,
} from "@shared/weekdays";
import {
  HELPER_ASSIGNMENT_QUERY_KEY,
  HELPER_CONFIRMATION_QUERY_KEY,
  HELPER_FIRST_CONTACT_QUERY_KEY,
  parseHelperAssignmentFilter,
  parseHelperConfirmationFilter,
  parseHelperFirstContactFilter,
} from "@/lib/dashboard-target-filter";
import { useLocation, useSearchParams } from "wouter";

const YN = [
  { v: "ja", l: "Ja" },
  { v: "nein", l: "Nein" },
] as const;

const valueColor = (value: string) => {
  if (value === "ja")
    return "border-emerald-400 bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-50";
  if (value === "nein")
    return "border-red-400 bg-red-100 text-red-950 dark:bg-red-900/60 dark:text-red-50";
  return "border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50";
};

const personKey = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

const HELPER_ACTION_ICON_BUTTON_CLASS =
  "h-8 min-h-8 w-8 min-w-8 rounded-md bg-transparent p-1 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1";

function Sel({
  value,
  onChange,
  options,
  compactOnDesktop = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { v: string; l: string }[];
  compactOnDesktop?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full",
        compactOnDesktop && "flex items-center justify-center"
      )}
    >
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "h-11 w-full text-base md:h-8 md:text-sm",
            compactOnDesktop &&
              "md:w-[52px] md:min-w-[52px] md:gap-0.5 md:px-1.5 md:text-xs md:[&_svg]:size-3",
            valueColor(value)
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem
              key={option.v}
              value={option.v}
              className={valueColor(option.v)}
            >
              {option.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Direkter Ja/Nein-Schalter für die beiden binären Helferstatus. Der Status
 * ist als ruhige, einfarbige Pill erkennbar; ein separater Farb-Thumb würde
 * die schmalen Tabellenzellen unnötig visuell überladen.
 */
/** Tagesstatus und optionales Zeitfenster bleiben in einer Bedienung verbunden. */
function DayAvailabilityControl({
  helper,
  day,
  compactOnDesktop = false,
  disabled = false,
  onCommit,
}: {
  helper: any;
  day: Weekday;
  compactOnDesktop?: boolean;
  disabled?: boolean;
  onCommit: (values: Record<string, string | null>) => void;
}) {
  const [availabilityPickerOpen, setAvailabilityPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const fields = WEEKDAY_AVAILABILITY_TIME_FIELDS[day];
  const availabilityField = WEEKDAY_AVAILABILITY_FIELDS[day];
  const availability = helperDayAvailability(helper, day).value;
  const timed = helperHasTimedAvailability(helper, day);
  const label = helperAvailabilityWindowLabel(helper, day);
  const [customStart, setCustomStart] = useState(
    (helper[fields.start] as string | null | undefined) ?? ""
  );
  const [customEnd, setCustomEnd] = useState(
    (helper[fields.end] as string | null | undefined) ?? ""
  );

  useEffect(() => {
    if (!availabilityPickerOpen) return;
    setCustomStart((helper[fields.start] as string | null | undefined) ?? "");
    setCustomEnd((helper[fields.end] as string | null | undefined) ?? "");
  }, [availabilityPickerOpen, fields.end, fields.start, helper]);

  const commitWindow = (start: string | null, end: string | null) => {
    onCommit({
      [availabilityField]: "ja",
      [fields.start]: start,
      [fields.end]: end,
    });
    setAvailabilityPickerOpen(false);
    setCustomOpen(false);
  };

  const commitAvailability = (value: "nein" | "vielleicht") => {
    onCommit({
      [availabilityField]: value,
      [fields.start]: null,
      [fields.end]: null,
    });
    setAvailabilityPickerOpen(false);
    setCustomOpen(false);
  };

  return (
    <Popover
      open={availabilityPickerOpen}
      onOpenChange={open => {
        setAvailabilityPickerOpen(open);
        if (!open) setCustomOpen(false);
      }}
    >
      <div className={cn("w-full", compactOnDesktop && "flex items-center justify-center")}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            data-slot="day-availability-trigger"
            aria-label={`${day}: Verfügbarkeit bearbeiten${availability === "ja" ? ` (${label})` : ""}`}
            title={availability === "ja" ? label : `${day}: Verfügbarkeit wählen`}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-1 rounded-full border px-3 text-base font-medium shadow-xs transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-sm",
              compactOnDesktop && "md:w-[52px] md:min-w-[52px] md:gap-0.5 md:px-1.5 md:text-xs",
              valueColor(availability)
            )}
          >
            <span>
              {availability === "vielleicht"
                ? "?"
                : availability === "ja" && timed
                  ? "🕒"
                  : availability === "ja"
                    ? "✓"
                    : "✕"}
            </span>
            <ChevronDown className="size-3 shrink-0 opacity-40" aria-hidden="true" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="z-50 w-[min(20rem,calc(100vw-1.5rem))] space-y-3 border bg-white p-3 text-slate-950 shadow-lg"
        align="center"
        side="bottom"
        collisionPadding={12}
      >
        <p className="text-sm font-semibold">{day}: Verfügbarkeit wählen</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => commitWindow(null, null)}
          >
            Ja (Ganztägig)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setCustomOpen(open => !open)}
          >
            Ja (Zeit anpassen ...)
          </Button>
        </div>
        {customOpen && (
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium">
                Von
                <Input type="time" value={customStart} onChange={event => setCustomStart(event.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium">
                Bis
                <Input type="time" value={customEnd} onChange={event => setCustomEnd(event.target.value)} />
              </label>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={!customStart || !customEnd || customEnd <= customStart}
              onClick={() => commitWindow(customStart, customEnd)}
            >
              Zeitfenster speichern
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            onClick={() => commitAvailability("nein")}
          >
            Nein
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            onClick={() => commitAvailability("vielleicht")}
          >
            ? (Unklar)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function YesNoToggle({
  value,
  onChange,
  ariaLabel,
  compactOnDesktop = false,
  disabled = false,
}: {
  value: "ja" | "nein";
  onChange: (value: "ja" | "nein") => void;
  ariaLabel: string;
  compactOnDesktop?: boolean;
  disabled?: boolean;
}) {
  const isYes = value === "ja";

  return (
    <div
      className={cn(
        "flex min-h-11 w-full items-center",
        compactOnDesktop ? "justify-center lg:min-h-8" : "w-full"
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={isYes}
        disabled={disabled}
        data-slot="helper-status-toggle"
        data-state={isYes ? "checked" : "unchecked"}
        onClick={() => onChange(isYes ? "nein" : "ja")}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-11 min-h-11 w-[92px] items-center justify-center rounded-full border px-3 text-xs font-semibold shadow-xs transition-colors active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isYes
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
          compactOnDesktop &&
            "lg:h-8 lg:min-h-8 lg:w-14 lg:px-1.5 lg:text-[10px]"
        )}
      >
        <span aria-hidden="true" className="text-sm leading-none">
          {isYes ? "✓" : "✕"}
        </span>
      </button>
    </div>
  );
}

/**
 * Ausschließlich für die mobile Helferkarte: Die beiden binären Angaben
 * erhalten einen klaren Schalter statt einer zweiten Variante der Tagespills.
 * Die Desktop-Tabelle behält bewusst ihren kompakten Ja/Nein-Status bei.
 */
function MobileStatusSwitch({
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: "ja" | "nein";
  onChange: (value: "ja" | "nein") => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const isYes = value === "ja";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isYes}
      aria-label={ariaLabel}
      disabled={disabled}
      data-slot="mobile-helper-status-switch"
      data-state={isYes ? "checked" : "unchecked"}
      onClick={() => onChange(isYes ? "nein" : "ja")}
      className={cn(
        "relative inline-flex h-11 min-h-11 w-[72px] shrink-0 items-center rounded-full border p-1 shadow-xs transition-colors active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isYes
          ? "border-emerald-300 bg-emerald-500"
          : "border-rose-300 bg-rose-100"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none size-9 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out",
          isYes ? "translate-x-7" : "translate-x-0"
        )}
      />
      <span className="sr-only">{isYes ? "Ja" : "Nein"}</span>
    </button>
  );
}

function HelperPdfNoteField({
  helperId,
  helperName,
  note,
  compactOnDesktop = false,
  onCommit,
}: {
  helperId: number;
  helperName: string;
  note: string | null;
  compactOnDesktop?: boolean;
  onCommit: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [mobileNote, setMobileNote] = useState("");
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const editing = useRef(false);
  const fullNote = note?.trim() ?? "";

  const clearOpenTimer = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  const clearCloseTimer = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openAfterDelay = (pointerType: string) => {
    if (pointerType !== "mouse" || editing.current) return;
    clearCloseTimer();
    clearOpenTimer();
    openTimer.current = window.setTimeout(() => setOpen(true), 900);
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

  const openMobileEditor = () => {
    setMobileNote(note ?? "");
    setMobileEditorOpen(true);
  };

  const saveMobileNote = () => {
    onCommit(mobileNote.trim() || null);
    setMobileEditorOpen(false);
  };

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          className="flex h-11 w-full items-center rounded-md border bg-white px-3 text-left text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          aria-label={`Hinweis für PDF von ${helperName} mehrzeilig bearbeiten`}
          onClick={openMobileEditor}
        >
          <span className={cn("line-clamp-1 min-w-0 flex-1 break-words", !fullNote && "text-muted-foreground")}>
            {fullNote || "Verfügbarkeit / Bemerkung"}
          </span>
          <Pencil className="ml-2 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        </button>
      </div>

      <div className="hidden md:block">
        <Popover open={open} onOpenChange={setOpen}>
          <div
            className="relative"
            onPointerEnter={event => openAfterDelay(event.pointerType)}
            onPointerLeave={event => closeAfterLeave(event.pointerType)}
          >
            <Input
              key={`${helperId}-note-${note ?? ""}`}
              className={cn(
                "w-full pr-11 text-base xl:pr-9",
                compactOnDesktop && "xl:h-8 xl:min-w-0"
              )}
              defaultValue={note ?? ""}
              placeholder="Verfügbarkeit / Bemerkung"
              aria-label={`Hinweis für PDF von ${helperName} bearbeiten`}
              onFocus={() => {
                editing.current = true;
                clearOpenTimer();
                setOpen(false);
              }}
              onBlur={event => {
                editing.current = false;
                const value = event.target.value.trim();
                if (value !== (note ?? "")) onCommit(value || null);
              }}
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 md:w-8"
                aria-label={`Vollständigen PDF-Hinweis für ${helperName} anzeigen`}
                title="Vollständigen Hinweis anzeigen"
              >
                <Info className="size-4" />
              </button>
            </PopoverTrigger>
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
            className="z-50 w-[min(20rem,calc(100vw-1.5rem))] max-w-none space-y-1.5 border border-gray-200 bg-white text-left text-gray-900 opacity-100 shadow-lg duration-200 ease-out data-[state=open]:fade-in-0 motion-reduce:animate-none sm:w-80"
          >
            <p className="text-xs font-medium text-slate-500">Hinweis für PDF</p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {fullNote || "Kein Hinweis hinterlegt."}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={mobileEditorOpen} onOpenChange={setMobileEditorOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] !bg-white !text-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hinweis für PDF bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor={`mobile-helper-note-${helperId}`} className="text-sm font-medium">
              Hinweis für {helperName}
            </label>
            <Textarea
              id={`mobile-helper-note-${helperId}`}
              autoFocus
              rows={7}
              value={mobileNote}
              onChange={event => setMobileNote(event.target.value)}
              placeholder="Verfügbarkeit, Besonderheiten oder Bemerkungen"
              className="min-h-40 resize-y text-base"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMobileEditorOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" onClick={saveMobileNote}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CakeDonationAction({
  helperName,
  count,
  onClick,
  mobile = false,
}: {
  helperName: string;
  count: number;
  onClick: () => void;
  mobile?: boolean;
}) {
  const hasCakes = count > 0;
  const description = hasCakes
    ? `Bereits ${count} Spenden erfasst (Klick für weitere Spende)`
    : "Spende für diesen Helfer erfassen";

  return (
    <button
      type="button"
      title={description}
      aria-label={`${description}: ${helperName}`}
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-transparent p-0 leading-none transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95",
        mobile ? "h-11 w-11 text-xl" : "h-8 w-8 text-[20px]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("select-none", hasCakes && "grayscale opacity-45")}
      >
        🎁
      </span>
      {hasCakes && (
        <span className="absolute right-0 top-0 inline-flex min-w-4 -translate-y-0.5 translate-x-0.5 items-center justify-center rounded-full bg-slate-600 px-1 text-[10px] font-bold leading-4 text-white shadow-sm">
          {count}
        </span>
      )}
    </button>
  );
}

export default function Helpers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [, setLocation] = useLocation();
  const confirmationFilter = parseHelperConfirmationFilter(
    searchParams.get(HELPER_CONFIRMATION_QUERY_KEY)
  );
  const assignedOnly = parseHelperAssignmentFilter(
    searchParams.get(HELPER_ASSIGNMENT_QUERY_KEY)
  );
  const firstContactFilter = parseHelperFirstContactFilter(
    searchParams.get(HELPER_FIRST_CONTACT_QUERY_KEY)
  );
  const firstContactOnly = firstContactFilter === "offen";
  const helperScopeFilter = assignedOnly
    ? "eingeteilt"
    : firstContactOnly
      ? "erstkontakt-offen"
      : "alle";
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: helpers = [], isLoading } = trpc.helpers.list.useQuery();
  const { data: cakes = [] } = trpc.cakes.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: currentEvent } = trpc.events.current.useQuery();
  const { data: pdfSettings } = trpc.pdf.settings.useQuery();
  const { data: plan } = trpc.plan.evaluate.useQuery();
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const cakeCountByDonor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cake of cakes) {
      const donor = personKey(cake.donor);
      if (!donor) continue;
      counts.set(donor, (counts.get(donor) ?? 0) + 1);
    }
    return counts;
  }, [cakes]);
  const [name, setName] = useState("");
  const [newHelperCompanion, setNewHelperCompanion] = useState("");
  const [newHelperContactId, setNewHelperContactId] = useState("none");
  const [newHelperPhone, setNewHelperPhone] = useState("");
  const [newHelperNote, setNewHelperNote] = useState("");
  const [newHelperBringsCake, setNewHelperBringsCake] = useState(false);
  const [newHelperDialogOpen, setNewHelperDialogOpen] = useState(false);
  const cakeWorkflowDonorRef = useRef<string | null>(null);
  const [filter, setFilter] = useState("");
  const [apFilter, setApFilter] = useState("alle");
  const [companionFilter, setCompanionFilter] = useState<
    "alle" | "mit" | "ohne"
  >("alle");
  const [willHelpFilter, setWillHelpFilter] = useState<"alle" | "ja" | "nein">(
    "alle"
  );
  const [timedAvailabilityOnly, setTimedAvailabilityOnly] = useState(false);
  const [myHelperRecordOnly, setMyHelperRecordOnly] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const invalidate = () => {
    utils.helpers.list.invalidate();
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
  };
  const resetNewHelperForm = () => {
    setName("");
    setNewHelperCompanion("");
    setNewHelperContactId("none");
    setNewHelperPhone("");
    setNewHelperNote("");
    setNewHelperBringsCake(false);
  };
  const openNewHelperDialog = () => {
    resetNewHelperForm();
    setNewHelperDialogOpen(true);
  };
  const openCakeDonation = (helperName: string) =>
    setLocation(`/spenden?donor=${encodeURIComponent(helperName)}`);
  const create = trpc.helpers.create.useMutation({
    onSuccess: () => {
      const cakeWorkflowDonor = cakeWorkflowDonorRef.current;
      cakeWorkflowDonorRef.current = null;
      invalidate();
      resetNewHelperForm();
      setNewHelperDialogOpen(false);
      if (cakeWorkflowDonor) {
        toast.success("Helfer hinzugefügt – Spende ergänzen");
        setLocation(`/spenden?donor=${encodeURIComponent(cakeWorkflowDonor)}`);
      } else {
        toast.success("Helfer hinzugefügt");
      }
    },
    onError: error => {
      cakeWorkflowDonorRef.current = null;
      toast.error(error.message);
    },
  });
  const update = trpc.helpers.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });
  const createNewHelper = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    cakeWorkflowDonorRef.current = newHelperBringsCake ? trimmedName : null;
    create.mutate({
      name: trimmedName,
      contactId:
        newHelperContactId === "none" ? null : Number(newHelperContactId),
      phone: newHelperPhone.trim() || undefined,
      note: newHelperNote.trim() || undefined,
      companion: newHelperCompanion.trim() || undefined,
    });
  };
  const remove = trpc.helpers.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Entfernt");
    },
    onError: error => toast.error(error.message),
  });
  const exportPdf = trpc.pdf.helper.useMutation({
    onSuccess: (result, variables) => {
      const helper = helpers.find(item => item.id === variables.helperId);
      downloadBase64File(
        result.base64,
        result.mimeType,
        `Aufgaben_${safeDownloadName(helper?.name ?? String(variables.helperId))}.pdf`
      );
      setExportingId(null);
    },
    onError: error => {
      setExportingId(null);
      toast.error(error.message);
    },
  });
  const sharePdfViaWhatsApp = trpc.pdf.publicShare.useMutation({
    onSuccess: result => {
      const message = renderWhatsAppMessage(
        pdfSettings?.whatsAppMessageTemplate,
        currentEvent?.name ?? pdfSettings?.eventName,
        result.url
      );
      setSharingId(null);
      window.location.assign(buildWhatsAppShareUrl(message));
    },
    onError: error => {
      setSharingId(null);
      toast.error(error.message);
    },
  });
  const shareHelperPdf = (helperId: number) => {
    if (sharingId !== null) return;
    setSharingId(helperId);
    sharePdfViaWhatsApp.mutate({ helperId });
  };

  const assignedHelperIds = useMemo(
    () =>
      new Set((plan ?? []).flatMap(item => item.assigned.map(a => a.helperId))),
    [plan]
  );
  const ownContactIds = useMemo(
    () =>
      new Set(
        contacts
          .filter(contact => personKey(contact.name) === personKey(user?.name ?? ""))
          .map(contact => contact.id)
      ),
    [contacts, user?.name]
  );
  const filtered = useMemo(
    () =>
      helpers
        .filter(
          helper =>
            (!filter ||
              [helper.name, helper.phone, helper.note]
                .filter((value): value is string => Boolean(value))
                .some(value =>
                  value.toLocaleLowerCase("de-DE").includes(
                    filter.toLocaleLowerCase("de-DE")
                  )
                )) &&
            (confirmationFilter === "alle" ||
              helper.confirmed === confirmationFilter) &&
            (willHelpFilter === "alle" || helper.willHelp === willHelpFilter) &&
            (!myHelperRecordOnly ||
              personKey(helper.name) === personKey(user?.name ?? "") ||
              (typeof helper.contactId === "number" &&
                ownContactIds.has(helper.contactId))) &&
            (!assignedOnly || assignedHelperIds.has(helper.id)) &&
            (!firstContactOnly ||
              isHelperWithoutFirstContact(helper, activeDays)) &&
            (apFilter === "alle" ||
              (apFilter === "ohne"
                ? !helper.contactId
                : String(helper.contactId ?? "") === apFilter)) &&
            (companionFilter === "alle" ||
              (companionFilter === "mit"
                ? Boolean(helper.companion?.trim())
                : !helper.companion?.trim())) &&
            (!timedAvailabilityOnly ||
              activeDays.some(day => helperHasTimedAvailability(helper, day)))
        )
        .sort((a, b) =>
          sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        ),
    [
      helpers,
      filter,
      confirmationFilter,
      willHelpFilter,
      myHelperRecordOnly,
      ownContactIds,
      user?.name,
      assignedOnly,
      firstContactOnly,
      assignedHelperIds,
      apFilter,
      companionFilter,
      timedAvailabilityOnly,
      sortAsc,
      activeDays,
    ]
  );
  const selfHelperIds = useMemo(() => {
    const contactById = new Map(contacts.map(contact => [contact.id, contact]));
    return new Set(
      helpers
        .filter(helper => {
          const contact = helper.contactId
            ? contactById.get(helper.contactId)
            : undefined;
          return contact && personKey(contact.name) === personKey(helper.name);
        })
        .map(helper => helper.id)
    );
  }, [contacts, helpers]);

  const updateConfirmationFilter = (value: "alle" | "ja" | "nein") => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete(HELPER_CONFIRMATION_QUERY_KEY);
        else next.set(HELPER_CONFIRMATION_QUERY_KEY, value);
        return next;
      },
      { replace: true }
    );
  };

  const updateHelperScopeFilter = (
    value: "alle" | "eingeteilt" | "erstkontakt-offen"
  ) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete(HELPER_ASSIGNMENT_QUERY_KEY);
        next.delete(HELPER_FIRST_CONTACT_QUERY_KEY);
        if (value === "eingeteilt") next.set(HELPER_ASSIGNMENT_QUERY_KEY, "ja");
        if (value === "erstkontakt-offen")
          next.set(HELPER_FIRST_CONTACT_QUERY_KEY, "offen");
        return next;
      },
      { replace: true }
    );
  };

  const clearDashboardHelperFilter = () => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete(HELPER_CONFIRMATION_QUERY_KEY);
        next.delete(HELPER_ASSIGNMENT_QUERY_KEY);
        next.delete(HELPER_FIRST_CONTACT_QUERY_KEY);
        return next;
      },
      { replace: true }
    );
  };

  const hasActiveHelperFilters =
    Boolean(filter.trim()) ||
    apFilter !== "alle" ||
    companionFilter !== "alle" ||
    confirmationFilter !== "alle" ||
    helperScopeFilter !== "alle" ||
    willHelpFilter !== "alle" ||
    myHelperRecordOnly ||
    timedAvailabilityOnly;

  const resetHelperFilters = () => {
    setFilter("");
    setApFilter("alle");
    setCompanionFilter("alle");
    setWillHelpFilter("alle");
    setTimedAvailabilityOnly(false);
    setMyHelperRecordOnly(false);
    clearDashboardHelperFilter();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <PageTitle icon="helpers">Helfer</PageTitle>
          <p className="text-muted-foreground">
            Helferdaten, Tagesverfügbarkeit, Hinweise und persönliche
            Aufgaben-PDFs.
          </p>
        </div>
        <div className="w-full space-y-2 lg:ml-auto lg:w-[23rem]">
          <div className="grid grid-cols-2 gap-2 [&>[data-slot=button]]:h-10 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2">
            <ModuleExcelImportButton area="HELFER" label="Helfer" />
            <PlanResetDialogButton
              area="helpers"
              label="Helfer"
              onCompleted={invalidate}
            />
          </div>
          <Button
            type="button"
            className="w-full bg-blue-600 px-4 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500"
            onClick={openNewHelperDialog}
          >
            <Plus className="mr-2 h-4 w-4" />
            Neuer Helfer
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="order-2 relative w-full md:order-1 md:max-w-[551px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Suchen (Name, Telefon, Hinweise) …"
            value={filter}
            onChange={event => setFilter(event.target.value)}
            className="h-10 border-2 border-slate-300 bg-white pl-9 text-base shadow-sm focus:border-blue-500 focus-visible:border-blue-500 focus-visible:ring-blue-200 md:text-sm"
            aria-label="Helfer nach Name, Telefon oder Hinweis durchsuchen"
          />
        </div>
        <div className="order-1 flex flex-wrap gap-2 md:order-2" aria-label="Schnellfilter Helfer">
          <Button
            type="button"
            size="sm"
            variant={myHelperRecordOnly ? "default" : "outline"}
            className={
              myHelperRecordOnly
                ? "bg-blue-700 text-white hover:bg-blue-800"
                : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
            }
            disabled={!user?.name?.trim()}
            onClick={() => setMyHelperRecordOnly(active => !active)}
          >
            👤 Meine Helferakte
          </Button>
        </div>
        <div className="order-1 grid grid-cols-1 gap-2 md:order-2 md:flex md:flex-wrap">
          <Select value={apFilter} onValueChange={setApFilter}>
            <SelectTrigger className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[190px] md:text-sm">
              <SelectValue placeholder="Ansprechpartner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Ansprechpartner</SelectItem>
              <SelectItem
                value="ohne"
                className="bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50"
              >
                Ohne Ansprechpartner
              </SelectItem>
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={String(contact.id)}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={companionFilter}
            onValueChange={value =>
              setCompanionFilter(value as "alle" | "mit" | "ohne")
            }
          >
            <SelectTrigger className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[170px] md:text-sm" aria-label="Begleitung filtern">
              <SelectValue placeholder="Begleitung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Begleitungen</SelectItem>
              <SelectItem value="mit">Mit Begleitung</SelectItem>
              <SelectItem value="ohne">Ohne Begleitung</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={confirmationFilter}
            onValueChange={value =>
              updateConfirmationFilter(value as "alle" | "ja" | "nein")
            }
          >
            <SelectTrigger className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[175px] md:text-sm" aria-label="Bestätigung filtern">
              <SelectValue placeholder="Bestätigung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Rückmeldungen</SelectItem>
              <SelectItem value="ja">Bestätigt</SelectItem>
              <SelectItem value="nein">Noch nicht bestätigt</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={helperScopeFilter}
            onValueChange={value =>
              updateHelperScopeFilter(
                value as "alle" | "eingeteilt" | "erstkontakt-offen"
              )
            }
          >
            <SelectTrigger className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[170px] md:text-sm" aria-label="Helferumfang filtern">
              <SelectValue placeholder="Nur Helfer mit ..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Nur Helfer mit ...</SelectItem>
              <SelectItem value="eingeteilt">Nur eingeteilt</SelectItem>
              <SelectItem value="erstkontakt-offen">Ohne Erstkontakt</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={willHelpFilter}
            onValueChange={value =>
              setWillHelpFilter(value as "alle" | "ja" | "nein")
            }
          >
            <SelectTrigger className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[155px] md:text-sm" aria-label="Helfen filtern">
              <SelectValue placeholder="Helfen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Helfen (Ja/Nein)</SelectItem>
              <SelectItem value="ja">Helfen: Ja</SelectItem>
              <SelectItem value="nein">Helfen: Nein</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            aria-pressed={timedAvailabilityOnly}
            aria-label="Nur Helfer mit Zeitfenstern filtern"
            className={cn(
              "h-10 w-full justify-start gap-2 border-slate-200 text-base md:w-auto md:justify-center md:text-sm",
              timedAvailabilityOnly
                ? "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100"
                : "bg-white text-slate-700 hover:bg-slate-50"
            )}
            onClick={() => setTimedAvailabilityOnly(active => !active)}
          >
            <Clock3 className="size-4 shrink-0" aria-hidden="true" />
            Nur Helfer mit Zeitfenstern
          </Button>
          {hasActiveHelperFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-helper-filter-reset
              className="h-10 w-full px-2 text-base text-sky-700 hover:bg-sky-100/60 hover:text-sky-900 md:ml-1 md:w-auto md:text-sm"
              onClick={resetHelperFilters}
              aria-label="Alle Helferfilter zurücksetzen"
            >
              <FilterX className="mr-1 size-3.5" aria-hidden="true" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {assignedOnly && confirmationFilter === "nein" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span>Dashboardfilter: Nur eingeteilte Helfer ohne Rückmeldung.</span>
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 px-2 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
            onClick={clearDashboardHelperFilter}
          >
            Filter aufheben
          </Button>
        </div>
      )}
      {firstContactOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950">
          <span>Dashboardfilter: Nur Helfer ohne Erstkontakt.</span>
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 px-2 text-orange-900 hover:bg-orange-100 hover:text-orange-950"
            onClick={clearDashboardHelperFilter}
          >
            Filter aufheben
          </Button>
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {filtered.map(helper => (
          <Card key={helper.id} className="shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-[26px] leading-[1.05] font-black tracking-tight">
                    {helper.name}
                  </h2>
                  {selfHelperIds.has(helper.id) && (
                    <p className="text-xs text-muted-foreground">
                      eigener Ansprechpartner-Eintrag
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <CakeDonationAction
                    helperName={helper.name}
                    count={cakeCountByDonor.get(personKey(helper.name)) ?? 0}
                    mobile
                    onClick={() => openCakeDonation(helper.name)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Persönliche Aufgaben-PDF herunterladen"
                    aria-label={`Persönliche Aufgaben-PDF von ${helper.name} herunterladen`}
                    className={cn(
                      HELPER_ACTION_ICON_BUTTON_CLASS,
                      "h-11 min-h-11 w-11 min-w-11"
                    )}
                    disabled={exportingId === helper.id}
                    onClick={() => {
                      setExportingId(helper.id);
                      exportPdf.mutate({ helperId: helper.id });
                    }}
                  >
                    <FileDown className="size-5 text-blue-600" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Aufgabenplan per WhatsApp an Helfer senden"
                    aria-label={`Aufgabenplan von ${helper.name} per WhatsApp senden`}
                    className={cn(
                      HELPER_ACTION_ICON_BUTTON_CLASS,
                      "h-11 min-h-11 w-11 min-w-11"
                    )}
                    disabled={sharingId !== null}
                    onClick={() => shareHelperPdf(helper.id)}
                  >
                    <MessageCircle className="size-5 text-[#25D366]" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Helfer entfernen"
                    aria-label={`Helfer ${helper.name} entfernen`}
                    className={cn(
                      HELPER_ACTION_ICON_BUTTON_CLASS,
                      "h-11 min-h-11 w-11 min-w-11"
                    )}
                    disabled={
                      selfHelperIds.has(helper.id) ||
                      (user?.role !== "admin" &&
                        assignedHelperIds.has(helper.id))
                    }
                    onClick={() =>
                      setDeleteTarget({ id: helper.id, name: helper.name })
                    }
                  >
                    <Trash2 className="size-5 text-red-600" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Ansprechpartner</label>
                <Select
                  disabled={selfHelperIds.has(helper.id)}
                  value={helper.contactId ? String(helper.contactId) : "none"}
                  onValueChange={value =>
                    update.mutate({
                      id: helper.id,
                      contactId: value === "none" ? null : Number(value),
                    })
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "w-full",
                      !helper.contactId &&
                        "border-amber-400 bg-amber-100 text-amber-950"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Ansprechpartner</SelectItem>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={String(contact.id)}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Telefon Helfer</label>
                  <Input
                    key={`${helper.id}-mobile-phone-${helper.phone ?? ""}`}
                    type="tel"
                    defaultValue={helper.phone ?? ""}
                    placeholder="optional"
                    onBlur={event => {
                      const value = event.target.value.trim();
                      if (value !== (helper.phone ?? ""))
                        update.mutate({
                          id: helper.id,
                          phone: value || null,
                        });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Hinweis für PDF</label>
                  <HelperPdfNoteField
                    helperId={helper.id}
                    helperName={helper.name}
                    note={helper.note}
                    onCommit={note => update.mutate({ id: helper.id, note })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  zusätzliche Begleitung (für Einsatzplan)
                </label>
                <Input
                  key={`${helper.id}-mobile-companion-${helper.companion ?? ""}`}
                  defaultValue={helper.companion ?? ""}
                  placeholder="z. B. + Frau Muster, + Kind"
                  aria-label={`zusätzliche Begleitung von ${helper.name} bearbeiten`}
                  onBlur={event => {
                    const value = event.target.value.trim();
                    if (value !== (helper.companion ?? "")) {
                      update.mutate({
                        id: helper.id,
                        companion: value || null,
                      });
                    }
                  }}
                />
              </div>
              <section
                data-slot="mobile-helper-status-section"
                aria-label="Allgemeiner Status"
                className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  Allgemeiner Status
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-white px-3 shadow-xs">
                    <span className="text-sm font-medium text-slate-800">Helfen?</span>
                    <MobileStatusSwitch
                      value={helper.willHelp}
                      ariaLabel={`${helper.name}: Helfen auf ${helper.willHelp === "ja" ? "Nein" : "Ja"} setzen`}
                      disabled={update.isPending}
                      onChange={willHelp =>
                        update.mutate({
                          id: helper.id,
                          willHelp,
                        })
                      }
                    />
                  </div>
                  <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-white px-3 shadow-xs">
                    <span className="text-sm font-medium text-slate-800">Bestätigt?</span>
                    <MobileStatusSwitch
                      value={helper.confirmed}
                      ariaLabel={`${helper.name}: Bestätigung auf ${helper.confirmed === "ja" ? "Nein" : "Ja"} setzen`}
                      disabled={update.isPending}
                      onChange={confirmed =>
                        update.mutate({
                          id: helper.id,
                          confirmed,
                        })
                      }
                    />
                  </div>
                </div>
              </section>

              <section
                data-slot="mobile-helper-availability-section"
                aria-label="Tages-Verfügbarkeiten"
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  Tages-Verfügbarkeiten
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {activeDays.map(day => (
                    <div key={day} className="space-y-1.5">
                      <div className="text-center text-sm font-medium text-slate-800">
                        {WEEKDAY_SHORT_LABELS[day]}
                      </div>
                      <DayAvailabilityControl
                        helper={helper}
                        day={day}
                        disabled={update.isPending}
                        onCommit={values =>
                          update.mutate({ id: helper.id, ...values } as any)
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Keine Helfer gefunden.
          </div>
        )}
      </div>

      <Card className="hidden shadow-sm md:block">
        <CardContent className="helpers-table-scroll p-0">
          <table
            className="w-full table-fixed text-xs xl:text-sm"
            style={{ minWidth: 1044 + activeDays.length * 56 }}
          >
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[176px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[230px]" />
              <col className="w-[220px]" />
              <col className="w-[56px]" />
              {activeDays.map(day => (
                <col key={day} className="w-[56px]" />
              ))}
              <col className="w-[56px]" />
              <col className="w-[56px]" />
            </colgroup>
            <thead className="helpers-desktop-sticky-head bg-muted/60">
              <tr className="text-left">
                <th
                  className="cursor-pointer select-none p-2"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  Name {sortAsc ? "▲" : "▼"}
                </th>
                <th className="p-2 text-center">Aktionen</th>
                <th className="p-2">Ansprechpartner</th>
                <th className="whitespace-nowrap p-2">Telefon Helfer</th>
                <th className="p-2">Hinweis für PDF</th>
                <th className="p-2">zusätzliche Begleitung</th>
                <th className="p-1 text-center align-middle text-[11px] leading-tight">
                  <span className="flex min-h-8 items-center justify-center">
                    Helfen?
                  </span>
                </th>
                {activeDays.map(day => (
                  <th
                    key={day}
                    className="p-1 text-center align-middle text-[11px] leading-tight"
                    title={day}
                  >
                    <span className="flex min-h-8 items-center justify-center">
                      {WEEKDAY_SHORT_LABELS[day]}
                    </span>
                  </th>
                ))}
                <th className="p-1 text-center align-middle text-[11px] leading-tight">
                  <span className="flex min-h-8 items-center justify-center">
                    Bestätigt?
                  </span>
                </th>
                <th className="p-1 text-center align-middle text-[11px] leading-tight">
                  <span className="flex min-h-8 items-center justify-center">
                    Löschen
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={9 + activeDays.length}
                  >
                    Lade …
                  </td>
                </tr>
              )}
              {filtered.map(helper => {
                const helperDeleteDisabled =
                  selfHelperIds.has(helper.id) ||
                  (user?.role !== "admin" && assignedHelperIds.has(helper.id));
                return (
                  <tr
                  key={helper.id}
                  className="border-t hover:bg-muted/30 align-top"
                >
                  <td className="p-2 font-medium">
                    {helper.name}
                    {selfHelperIds.has(helper.id) && (
                      <div className="text-xs font-normal text-muted-foreground">
                        eigener Ansprechpartner-Eintrag
                      </div>
                    )}
                  </td>
                  <td className="p-1">
                    <div className="flex min-w-0 justify-center gap-3">
                      <CakeDonationAction
                        helperName={helper.name}
                        count={cakeCountByDonor.get(personKey(helper.name)) ?? 0}
                        onClick={() => openCakeDonation(helper.name)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Persönliche Aufgaben-PDF herunterladen"
                        aria-label={`Persönliche Aufgaben-PDF von ${helper.name} herunterladen`}
                        className={HELPER_ACTION_ICON_BUTTON_CLASS}
                        disabled={exportingId === helper.id}
                        onClick={() => {
                          setExportingId(helper.id);
                          exportPdf.mutate({ helperId: helper.id });
                        }}
                      >
                        <FileDown className="size-5 text-blue-600" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Aufgabenplan per WhatsApp an Helfer senden"
                        aria-label={`Aufgabenplan von ${helper.name} per WhatsApp senden`}
                        className={HELPER_ACTION_ICON_BUTTON_CLASS}
                        disabled={sharingId !== null}
                        onClick={() => shareHelperPdf(helper.id)}
                      >
                        <MessageCircle className="size-5 text-[#25D366]" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-2">
                    <Select
                      disabled={selfHelperIds.has(helper.id)}
                      value={
                        helper.contactId ? String(helper.contactId) : "none"
                      }
                      onValueChange={value =>
                        update.mutate({
                          id: helper.id,
                          contactId: value === "none" ? null : Number(value),
                        })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-full",
                          !helper.contactId &&
                            "border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="none"
                          className="bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50"
                        >
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
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <Input
                      key={`${helper.id}-phone-${helper.phone ?? ""}`}
                      type="tel"
                      className="h-8 w-full min-w-0 whitespace-nowrap"
                      defaultValue={helper.phone ?? ""}
                      placeholder="optional"
                      onBlur={event => {
                        const value = event.target.value.trim();
                        if (value !== (helper.phone ?? "")) {
                          update.mutate({
                            id: helper.id,
                            phone: value || null,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <HelperPdfNoteField
                      helperId={helper.id}
                      helperName={helper.name}
                      note={helper.note}
                      compactOnDesktop
                      onCommit={note => update.mutate({ id: helper.id, note })}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      key={`${helper.id}-companion-${helper.companion ?? ""}`}
                      className="h-8 w-full text-base xl:text-xs"
                      defaultValue={helper.companion ?? ""}
                      placeholder="optional"
                      aria-label={`zusätzliche Begleitung für ${helper.name}`}
                      onBlur={event => {
                        const value = event.target.value.trim();
                        if (value !== (helper.companion ?? "")) {
                          update.mutate({
                            id: helper.id,
                            companion: value || null,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="p-1 text-center align-middle">
                    <YesNoToggle
                      value={helper.willHelp}
                      compactOnDesktop
                      disabled={update.isPending}
                      ariaLabel={`${helper.name}: Helfen auf ${helper.willHelp === "ja" ? "Nein" : "Ja"} setzen`}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          willHelp: value,
                        })
                      }
                    />
                  </td>
                  {activeDays.map(day => {
                    return (
                      <td key={day} className="p-1 text-center align-middle">
                        <DayAvailabilityControl
                          helper={helper}
                          day={day}
                          compactOnDesktop
                          disabled={update.isPending}
                          onCommit={values =>
                            update.mutate({ id: helper.id, ...values } as any)
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="p-1 text-center align-middle">
                    <YesNoToggle
                      value={helper.confirmed}
                      compactOnDesktop
                      disabled={update.isPending}
                      ariaLabel={`${helper.name}: Bestätigung auf ${helper.confirmed === "ja" ? "Nein" : "Ja"} setzen`}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          confirmed: value,
                        })
                      }
                    />
                  </td>
                  <td className="p-1 text-center align-middle">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={
                        selfHelperIds.has(helper.id)
                          ? "Zum Löschen zuerst den Ansprechpartner entfernen"
                          : user?.role !== "admin" &&
                              assignedHelperIds.has(helper.id)
                            ? "Eingeteilte Helfer können nur Administratoren löschen"
                            : "Helfer entfernen"
                      }
                      aria-label={`Helfer ${helper.name} entfernen`}
                      className={cn(
                        HELPER_ACTION_ICON_BUTTON_CLASS,
                        helperDeleteDisabled && "cursor-not-allowed"
                      )}
                      disabled={helperDeleteDisabled}
                      onClick={() =>
                        setDeleteTarget({
                          id: helper.id,
                          name: helper.name,
                        })
                      }
                    >
                      <Trash2
                        className={cn(
                          "size-5",
                          helperDeleteDisabled
                            ? "text-gray-400 opacity-50"
                            : "text-red-600"
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </td>
                </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={9 + activeDays.length}
                  >
                    Keine Helfer gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Legende: <StatusBadge status="ja" /> verfügbar ·{" "}
        <StatusBadge status="vielleicht" /> unsicher ·{" "}
        <StatusBadge status="nein" />
        abgesagt/nicht verfügbar
      </p>
      <Dialog
        open={newHelperDialogOpen}
        onOpenChange={open => {
          setNewHelperDialogOpen(open);
          if (!open) resetNewHelperForm();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Neuer Helfer anlegen</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              createNewHelper();
            }}
          >
            <div className="space-y-1.5">
              <label
                htmlFor="new-helper-dialog-name"
                className="text-sm font-medium"
              >
                Name des Helfers <span className="text-destructive">*</span>
              </label>
              <Input
                id="new-helper-dialog-name"
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="z. B. Axel Muster"
                className="h-11 text-base"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="new-helper-dialog-contact"
                  className="text-sm font-medium"
                >
                  Ansprechpartner
                </label>
                <Select
                  value={newHelperContactId}
                  onValueChange={setNewHelperContactId}
                >
                  <SelectTrigger
                    id="new-helper-dialog-contact"
                    className="h-11 w-full text-base"
                  >
                    <SelectValue placeholder="Ansprechpartner auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Ansprechpartner</SelectItem>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={String(contact.id)}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="new-helper-dialog-phone"
                  className="text-sm font-medium"
                >
                  Telefon Helfer
                </label>
                <Input
                  id="new-helper-dialog-phone"
                  type="tel"
                  value={newHelperPhone}
                  onChange={event => setNewHelperPhone(event.target.value)}
                  placeholder="optional"
                  className="h-11 text-base"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-helper-dialog-note"
                className="text-sm font-medium"
              >
                Hinweis für PDF
              </label>
              <Input
                id="new-helper-dialog-note"
                value={newHelperNote}
                onChange={event => setNewHelperNote(event.target.value)}
                placeholder="Verfügbarkeit / Bemerkung (optional)"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-helper-dialog-companion"
                className="text-sm font-medium"
              >
                Zusätzliche Begleitung (für Einsatzplan)
              </label>
              <Input
                id="new-helper-dialog-companion"
                value={newHelperCompanion}
                onChange={event => setNewHelperCompanion(event.target.value)}
                placeholder="z. B. + Frau Muster, + Kind"
                className="h-11 text-base"
              />
            </div>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Neue Helfer starten aktiv. Die Tagesverfügbarkeiten stehen zunächst
              auf „?“ und werden anschließend direkt in der Helfertabelle gepflegt.
            </p>
            <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
              <Checkbox
                id="new-helper-dialog-brings-cake"
                checked={newHelperBringsCake}
                onCheckedChange={checked => setNewHelperBringsCake(checked === true)}
              />
              <label
                htmlFor="new-helper-dialog-brings-cake"
                className="cursor-pointer text-sm font-medium text-slate-800"
              >
                Ich unterstütze mit einer Spende
              </label>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setNewHelperDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="min-h-11 bg-indigo-700 text-base hover:bg-indigo-800"
                disabled={!name.trim() || create.isPending}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {create.isPending ? "Speichert …" : "Helfer anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Helfer löschen?"
        description={`„${deleteTarget?.name ?? ""}“ wird aus der Helferliste und allen Einsatzzuordnungen des aktuellen Jahres gelöscht.`}
        busy={remove.isPending}
        onConfirm={() =>
          deleteTarget &&
          remove.mutate({
            id: deleteTarget.id,
          })
        }
      />
    </div>
  );
}
