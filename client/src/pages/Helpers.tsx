import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ViewModeToggle } from "@/components/ViewModeToggle";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import {
  buildWhatsAppShareUrl,
  renderWhatsAppMessage,
} from "@/lib/whatsappShare";
import { formatEventDuration } from "@shared/event-dates";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, FileDown, FileText, FilterX, Info, LockKeyhole, MessageCircle, Pencil, Plus, Search, Send, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { KlemmiUpgradeDialog } from "@/components/KlemmiUpgradeDialog";
import { PlanResetDialogButton } from "@/components/PlanResetDialogButton";
import { KlemmiActionPanel } from "@/components/KlemmiActionPanel";
import { MyTasksDefaultPin } from "@/components/MyTasksDefaultPin";
import { KlemmiHelperGuide } from "@/components/KlemmiHelperGuide";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import { triggerKlemmiReaction } from "@/lib/klemmi-reactions";
import { useMyTasksDefault } from "@/hooks/useMyTasksDefault";
import { useMobileViewMode, useViewMode } from "@/hooks/useViewMode";
import {
  eventWeekdays,
  helperDayAvailability,
  helperAvailabilityWindowLabel,
  helperHasTimedAvailability,
  isHelperWithoutFirstContact,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_AVAILABILITY_TIME_FIELDS,
  WEEKDAY_SHORT_LABELS,
  WEEKDAYS,
  type AvailabilityField,
  type AvailabilityTimeField,
  type AvailabilityValue,
  type Weekday,
} from "@shared/weekdays";
import { productAllowsCapability } from "@shared/product-packages";
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

function toggleMultiSelection<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];
}

const HELPER_ACTION_ICON_BUTTON_CLASS =
  "h-8 min-h-8 w-8 min-w-8 rounded-md bg-transparent p-1 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1";

type NewHelperDonationCategory = "kuchen" | "salat" | "snack" | "sonstiges";

type NewHelperDonation = {
  cake: string;
  donationCategory: NewHelperDonationCategory;
  locationId: number | null;
  dropoffDate: string;
  dropoffTime: string;
  vegan: boolean;
  glutenFree: boolean;
  lactoseFree: boolean;
  containsNuts: boolean;
  meat: boolean;
  note: string;
};

type NewHelperDayAvailability = {
  value: AvailabilityValue;
  withTime: boolean;
  start: string;
  end: string;
};

type NewHelperAvailability = Record<Weekday, NewHelperDayAvailability>;
type NewHelperAvailabilityInput = Partial<Record<AvailabilityField, AvailabilityValue>> &
  Partial<Record<AvailabilityTimeField, string | null>>;

type MobileHelperEditForm = {
  name: string;
  contactId: string;
  phone: string;
  note: string;
  companion: string;
};

const EMPTY_NEW_HELPER_DONATION: NewHelperDonation = {
  cake: "",
  donationCategory: "kuchen",
  locationId: null,
  dropoffDate: "",
  dropoffTime: "",
  vegan: false,
  glutenFree: false,
  lactoseFree: false,
  containsNuts: false,
  meat: false,
  note: "",
};

const createEmptyNewHelperAvailability = (): NewHelperAvailability =>
  Object.fromEntries(
    WEEKDAYS.map(day => [
      day,
      { value: "vielleicht", withTime: false, start: "", end: "" },
    ])
  ) as NewHelperAvailability;

const newHelperDonationCategories: Array<{
  value: NewHelperDonationCategory;
  label: string;
}> = [
  { value: "kuchen", label: "Kuchen / Gebäck" },
  { value: "salat", label: "Salat" },
  { value: "snack", label: "Dessert / Snack" },
  { value: "sonstiges", label: "Sonstiges" },
];

const newHelperDonationTraits: Array<{
  key: keyof Pick<
    NewHelperDonation,
    "vegan" | "glutenFree" | "lactoseFree" | "containsNuts" | "meat"
  >;
  label: string;
  activeClass: string;
}> = [
  { key: "vegan", label: "Vegan", activeClass: "border-emerald-400 bg-emerald-100 text-emerald-950" },
  { key: "glutenFree", label: "Glutenfrei", activeClass: "border-amber-400 bg-amber-100 text-amber-950" },
  { key: "lactoseFree", label: "Laktosefrei", activeClass: "border-sky-400 bg-sky-100 text-sky-950" },
  { key: "containsNuts", label: "Enthält Nüsse", activeClass: "border-orange-400 bg-orange-100 text-orange-950" },
  { key: "meat", label: "Fleischhaltig", activeClass: "border-rose-400 bg-rose-100 text-rose-950" },
];

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
  onCommit: (values: Record<string, string | null>) => Promise<unknown>;
}) {
  const [availabilityPickerOpen, setAvailabilityPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const isTimedAvailability = availability === "ja" && timed;
  const availabilityButtonClass =
    availability === "ja"
      ? isTimedAvailability
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        : "border-emerald-400 bg-emerald-100 text-emerald-950 hover:bg-emerald-200"
      : availability === "nein"
        ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
        : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100";

  const loadDraftFromHelper = () => {
    setCustomStart((helper[fields.start] as string | null | undefined) ?? "");
    setCustomEnd((helper[fields.end] as string | null | undefined) ?? "");
  };

  const commitChanges = async (values: Record<string, string | null>) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Der Entwurf bleibt bis zur Serverbestätigung geöffnet. So kann weder
      // die Acht-Sekunden-Synchronisierung noch ein Fehler lokale Eingaben
      // aus einem offenen Zeitfenster überschreiben.
      await onCommit(values);
      setAvailabilityPickerOpen(false);
      setCustomOpen(false);
    } catch {
      // Die Mutation meldet den konkreten Fehler bereits per Toast. Der
      // Entwurf bleibt absichtlich geöffnet und unverändert editierbar.
    } finally {
      setIsSaving(false);
    }
  };

  const commitWindow = (start: string | null, end: string | null) =>
    void commitChanges({
      [availabilityField]: "ja",
      [fields.start]: start,
      [fields.end]: end,
    });

  const commitAvailability = (value: "nein" | "vielleicht") => {
    void commitChanges({
      [availabilityField]: value,
      [fields.start]: null,
      [fields.end]: null,
    });
  };

  const triggerButton = (
    <button
      type="button"
      disabled={disabled || isSaving}
      data-slot="day-availability-trigger"
      aria-label={`${day}: Verfügbarkeit bearbeiten${availability === "ja" ? ` (${label})` : ""}`}
      title={availability === "ja" ? label : `${day}: Verfügbarkeit wählen`}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-1 rounded-full border px-3 text-base font-semibold shadow-xs transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-sm",
        compactOnDesktop && "md:w-[52px] md:min-w-[52px] md:gap-0.5 md:px-1.5 md:text-xs",
        availabilityButtonClass
      )}
    >
      <span>{availability === "ja" ? "Ja" : availability === "nein" ? "Nein" : "?"}</span>
      {isTimedAvailability && <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />}
    </button>
  );

  return (
    <Popover
      open={availabilityPickerOpen}
      onOpenChange={open => {
        if (isSaving && !open) return;
        // Nur das bewusste Öffnen lädt den aktuellen Serverstand in den
        // lokalen Entwurf. Refetches liefern neue helper-Objekte, dürfen einen
        // bereits geöffneten, noch nicht gespeicherten Entwurf aber nie leeren.
        if (open) loadDraftFromHelper();
        setAvailabilityPickerOpen(open);
        if (!open) setCustomOpen(false);
      }}
    >
      <div className={cn("w-full", compactOnDesktop && "flex items-center justify-center")}>
        {isTimedAvailability ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent
              data-slot="day-availability-time-tooltip"
              side="top"
              sideOffset={8}
            >
              {label}
            </TooltipContent>
          </Tooltip>
        ) : (
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        )}
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
            className="min-h-11 border-emerald-400 bg-emerald-100 font-semibold text-emerald-950 hover:bg-emerald-200"
            disabled={isSaving}
            onClick={() => commitWindow(null, null)}
          >
            Ja
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100"
            disabled={isSaving}
            onClick={() => setCustomOpen(open => !open)}
          >
            <span>Ja</span>
            <Clock3 className="ml-1.5 size-4" aria-hidden="true" />
          </Button>
        </div>
        {customOpen && (
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium">
                Von
                <Input
                  type="time"
                  value={customStart}
                  disabled={isSaving}
                  onChange={event => setCustomStart(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs font-medium">
                Bis
                <Input
                  type="time"
                  value={customEnd}
                  disabled={isSaving}
                  onChange={event => setCustomEnd(event.target.value)}
                />
              </label>
            </div>
            <Button
              type="button"
              className="w-full border-2 border-[#f3794a] bg-white font-semibold text-slate-950 shadow-sm hover:bg-orange-50 hover:text-slate-950 focus-visible:ring-[#f3794a]"
              disabled={
                isSaving ||
                !customStart ||
                !customEnd ||
                customEnd <= customStart
              }
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
            disabled={isSaving}
            onClick={() => commitAvailability("nein")}
          >
            Nein
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            disabled={isSaving}
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
          aria-label={`Hinweise von ${helperName} mehrzeilig bearbeiten`}
          onClick={openMobileEditor}
        >
          <span className={cn("line-clamp-1 min-w-0 flex-1 break-words", !fullNote && "text-muted-foreground")}>
            {fullNote || "Hinweise"}
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
              placeholder="Hinweise"
              aria-label={`Hinweise von ${helperName} bearbeiten`}
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
                aria-label={`Vollständige Hinweise für ${helperName} anzeigen`}
                title="Vollständige Hinweise anzeigen"
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
            <p className="text-xs font-medium text-slate-500">Hinweise</p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {fullNote || "Keine Hinweise hinterlegt."}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={mobileEditorOpen} onOpenChange={setMobileEditorOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] !bg-white !text-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hinweise bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor={`mobile-helper-note-${helperId}`} className="text-sm font-medium">
              Hinweise für {helperName}
            </label>
            <Textarea
              id={`mobile-helper-note-${helperId}`}
              autoFocus
              rows={7}
              value={mobileNote}
              onChange={event => setMobileNote(event.target.value)}
              placeholder="z. B. Besonderheiten, Material oder Absprachen"
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
  compact = false,
  disabled = false,
  klemmiTarget,
  klemmiHelperId,
}: {
  helperName: string;
  count: number;
  onClick: () => void;
  mobile?: boolean;
  compact?: boolean;
  disabled?: boolean;
  klemmiTarget?: string;
  klemmiHelperId?: number;
}) {
  const hasCakes = count > 0;
  const description = disabled
    ? "Spendenverwaltung erst ab Paket Pro verfügbar (Klick für Info)"
    : hasCakes
    ? `Bereits ${count} Spenden erfasst (Klick für weitere Spende)`
    : "Spende für diesen Helfer erfassen";

  return (
    <button
      type="button"
      data-klemmi-target={klemmiTarget}
      data-klemmi-helper-id={klemmiHelperId}
      title={description}
      aria-label={`${description}: ${helperName}`}
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-transparent p-0 leading-none transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95",
        disabled && "opacity-55 hover:scale-100",
        mobile
          ? "h-11 w-11 text-xl"
          : compact
            ? "h-9 w-9 text-[18px]"
            : "h-8 w-8 text-[20px]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("select-none", (hasCakes || disabled) && "grayscale opacity-45")}
      >
        🎁
      </span>
      {disabled && (
        <span className="absolute -bottom-1 -right-1 inline-flex size-3.5 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm" aria-hidden="true">
          <LockKeyhole className="size-2.5" />
        </span>
      )}
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
  const feedbackFilter = firstContactOnly
    ? "erstkontakt-offen"
    : confirmationFilter;
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { isTenantAdmin } = useTenantAdministration();
  const isMobileView = useMobileViewMode();
  const [viewMode, setViewMode] = useViewMode("helpers", "liste");
  const {
    isDefaultMyTasks,
    setDefaultMyTasks,
    canRememberMyTasksDefault,
  } = useMyTasksDefault(user);
  const { data: helpers = [], isLoading } = trpc.helpers.list.useQuery();
  const { data: cakes = [] } = trpc.cakes.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const { data: currentEvent } = trpc.events.current.useQuery();
  const { data: tenantProduct } = trpc.tenantProduct.current.useQuery(undefined, {
    staleTime: 60_000,
  });
  const currentPackageId = tenantProduct?.packageId ?? "event_pass";
  // Rechte nie aus einer optionalen, verschachtelten API-Antwort lesen:
  // während Cache-/Sitzungswechseln könnte sie sonst die gesamte Ansicht
  // unterbrechen. Der Paketkatalog ist die zentrale, sichere Quelle.
  const allowsDonations = productAllowsCapability(currentPackageId, "donations");
  const allowsPersonalPdfShare = productAllowsCapability(
    currentPackageId,
    "personal_accesses"
  );
  const allowsWhatsAppTemplates = productAllowsCapability(
    currentPackageId,
    "whatsapp_templates"
  );
  const [upgradeCapability, setUpgradeCapability] = useState<
    "donations" | "personal_accesses" | null
  >(null);
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
  const [newHelperAvailabilityEnabled, setNewHelperAvailabilityEnabled] = useState(false);
  const [newHelperAvailability, setNewHelperAvailability] = useState<NewHelperAvailability>(
    createEmptyNewHelperAvailability
  );
  const [newHelperAvailabilityError, setNewHelperAvailabilityError] = useState<string | null>(null);
  const [newHelperDonation, setNewHelperDonation] = useState<NewHelperDonation>(
    EMPTY_NEW_HELPER_DONATION
  );
  const [newHelperNameError, setNewHelperNameError] = useState<string | null>(null);
  const [whatsAppTargetHelper, setWhatsAppTargetHelper] = useState<{
    id: number;
    name: string;
    phone?: string | null;
  } | null>(null);
  const [selectedWhatsAppTemplateKind, setSelectedWhatsAppTemplateKind] = useState<
    "general" | "schedule"
  >("general");
  const [selectedWhatsAppShareView, setSelectedWhatsAppShareView] = useState<
    "minimal" | "team"
  >("minimal");
  const [isPreparingWhatsApp, setIsPreparingWhatsApp] = useState(false);
  const eventDurationLabel = useMemo(
    () =>
      formatEventDuration({
        startDate: currentEvent?.startDate ?? null,
        endDate: currentEvent?.endDate ?? null,
      }),
    [currentEvent?.startDate, currentEvent?.endDate]
  );
  const [newHelperDialogOpen, setNewHelperDialogOpen] = useState(false);
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileContactFilters, setMobileContactFilters] = useState<string[]>([]);
  const [mobileCompanionFilters, setMobileCompanionFilters] = useState<Array<"mit" | "ohne">>([]);
  const [mobileFeedbackFilters, setMobileFeedbackFilters] = useState<Array<"ja" | "nein" | "erstkontakt-offen">>(
    () => (feedbackFilter === "alle" ? [] : [feedbackFilter])
  );
  const [mobileWillHelpFilters, setMobileWillHelpFilters] = useState<Array<"ja" | "nein">>([]);
  const [mobileTimedAvailabilityOnly, setMobileTimedAvailabilityOnly] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [mobileHelperEditTarget, setMobileHelperEditTarget] = useState<any | null>(null);
  const [mobileHelperEditForm, setMobileHelperEditForm] = useState<MobileHelperEditForm>({
    name: "",
    contactId: "none",
    phone: "",
    note: "",
    companion: "",
  });

  const invalidate = () => {
    utils.helpers.list.invalidate();
    utils.cakes.list.invalidate();
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
  };
  const resetNewHelperForm = () => {
    setName("");
    setNewHelperCompanion("");
    // Im Event Pass ist der Admin der einzige feste Ansprechpartner
    const defaultContactId =
      currentPackageId === "event_pass" && contacts.length > 0
        ? String(contacts[0].id)
        : "none";
    setNewHelperContactId(defaultContactId);
    setNewHelperPhone("");
    setNewHelperNote("");
    setNewHelperBringsCake(false);
    setNewHelperAvailabilityEnabled(false);
    setNewHelperAvailability(createEmptyNewHelperAvailability());
    setNewHelperAvailabilityError(null);
    setNewHelperDonation(EMPTY_NEW_HELPER_DONATION);
    setNewHelperNameError(null);
  };
  const openNewHelperDialog = () => {
    resetNewHelperForm();
    setNewHelperDialogOpen(true);
  };
  const finishNewHelperCreation = (message: string) => {
    invalidate();
    resetNewHelperForm();
    setNewHelperDialogOpen(false);
    toast.success(message);
  };
  const openCakeDonation = (helperName: string) => {
    if (!allowsDonations) {
      setUpgradeCapability("donations");
      return;
    }
    setLocation(`/spenden?donor=${encodeURIComponent(helperName)}`);
  };
  const openMobileHelperEdit = (helper: any) => {
    setMobileHelperEditTarget(helper);
    setMobileHelperEditForm({
      name: helper.name ?? "",
      contactId: helper.contactId ? String(helper.contactId) : "none",
      phone: helper.phone ?? "",
      note: helper.note ?? "",
      companion: helper.companion ?? "",
    });
  };
  const create = trpc.helpers.create.useMutation({
    onSuccess: () => {
      finishNewHelperCreation("Helfer hinzugefügt");
    },
    onError: error => toast.error(error.message),
  });
  const createWithDonation = trpc.helpers.createWithDonation.useMutation({
    onSuccess: () => {
      finishNewHelperCreation("Helfer und Spende hinzugefügt");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.helpers.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });
  const saveMobileHelperEdit = () => {
    if (!mobileHelperEditTarget || update.isPending) return;
    const name = mobileHelperEditForm.name.trim();
    if (!name) {
      triggerKlemmiReaction("error");
      toast.error("Bitte einen Namen für den Helfer eingeben");
      return;
    }
    update.mutate(
      {
        id: mobileHelperEditTarget.id,
        name,
        contactId:
          mobileHelperEditForm.contactId === "none"
            ? null
            : Number(mobileHelperEditForm.contactId),
        phone: mobileHelperEditForm.phone.trim() || null,
        note: mobileHelperEditForm.note.trim() || null,
        companion: mobileHelperEditForm.companion.trim() || null,
      },
      {
        onSuccess: () => {
          invalidate();
          setMobileHelperEditTarget(null);
          toast.success("Helfer aktualisiert");
        },
      }
    );
  };
  const createNewHelper = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      triggerKlemmiReaction("error");
      setNewHelperNameError("Bitte trage zuerst den Namen des Helfers ein. Danach kannst du ihn speichern.");
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLInputElement>('[data-klemmi-target="new-helper-name"]')
          ?.focus();
      });
      return;
    }
    setNewHelperNameError(null);
    const availabilityInput: NewHelperAvailabilityInput = {};
    if (newHelperAvailabilityEnabled) {
      for (const day of activeDays) {
        const choice = newHelperAvailability[day];
        const availabilityField = WEEKDAY_AVAILABILITY_FIELDS[day];
        const timeFields = WEEKDAY_AVAILABILITY_TIME_FIELDS[day];
        const hasValidTimeWindow =
          choice.withTime &&
          choice.start.length > 0 &&
          choice.end.length > 0 &&
          choice.end > choice.start;

        if (choice.withTime && !hasValidTimeWindow) {
          setNewHelperAvailabilityError(
            `${day}: Bitte trage für „Ja mit Uhr“ eine gültige Uhrzeit von und bis ein.`
          );
          return;
        }

        availabilityInput[availabilityField] = choice.value;
        availabilityInput[timeFields.start] = hasValidTimeWindow ? choice.start : null;
        availabilityInput[timeFields.end] = hasValidTimeWindow ? choice.end : null;
      }
    }
    setNewHelperAvailabilityError(null);
    const helper = {
      name: trimmedName,
      contactId:
        newHelperContactId === "none" ? null : Number(newHelperContactId),
      phone: newHelperPhone.trim() || undefined,
      note: newHelperNote.trim() || undefined,
      companion: newHelperCompanion.trim() || undefined,
      ...availabilityInput,
    };
    if (newHelperBringsCake) {
      createWithDonation.mutate({
        helper,
        donation: {
          ...newHelperDonation,
          cake: newHelperDonation.cake.trim(),
          note: newHelperDonation.note.trim() || undefined,
        },
      });
      return;
    }
    create.mutate(helper);
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
  const createWhatsAppPdfShare = trpc.pdf.createWhatsAppShare.useMutation();
  const activeWhatsAppShares = trpc.pdf.activeWhatsAppShares.useQuery(
    { helperId: whatsAppTargetHelper?.id ?? -1 },
    {
      enabled: Boolean(whatsAppTargetHelper && allowsPersonalPdfShare),
      staleTime: 10_000,
    }
  );
  const revokeWhatsAppPdfShare = trpc.pdf.revokeWhatsAppShare.useMutation();
  const resendWhatsAppPdfShare = trpc.pdf.resendWhatsAppShare.useMutation();
  const [isRevokingWhatsAppShare, setIsRevokingWhatsAppShare] = useState(false);

  const createScheduleWhatsAppMessage = async (share: {
    url: string;
    accessCode: string;
    expiresAt: number;
  }) => {
    if (!whatsAppTargetHelper) return;
    const settings = await utils.pdf.settings.fetch();
    const eventName = currentEvent?.name ?? settings.eventName;
    const baseMessage = renderWhatsAppMessage(settings.whatsAppMessageTemplate, {
      eventName,
      eventDuration: eventDurationLabel,
      pdfLink: share.url,
    });
    const expiresAt = new Date(share.expiresAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${baseMessage}\n\n🔐 Geschützter Abruf (gültig bis ${expiresAt})\nZugangscode: ${share.accessCode}\nBitte Link und Zugangscode nicht weiterleiten.`;
  };

  const createAndOpenScheduleWhatsApp = async (
    viewMode = selectedWhatsAppShareView
  ) => {
    if (!whatsAppTargetHelper || isPreparingWhatsApp) return;
    setIsPreparingWhatsApp(true);
    try {
      const share = await createWhatsAppPdfShare.mutateAsync({
        helperId: whatsAppTargetHelper.id,
        viewMode,
      });
      const message = await createScheduleWhatsAppMessage(share);
      if (!message) return;
      window.location.assign(
        buildWhatsAppShareUrl(message, whatsAppTargetHelper.phone)
      );
      await activeWhatsAppShares.refetch();
      setWhatsAppTargetHelper(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Die WhatsApp-Nachricht konnte nicht vorbereitet werden"
      );
    } finally {
      setIsPreparingWhatsApp(false);
    }
  };

  const resendActiveScheduleWhatsApp = async (shareId: number) => {
    if (!whatsAppTargetHelper || isPreparingWhatsApp) return;
    setIsPreparingWhatsApp(true);
    try {
      const share = await resendWhatsAppPdfShare.mutateAsync({
        helperId: whatsAppTargetHelper.id,
        shareId,
      });
      const message = await createScheduleWhatsAppMessage(share);
      if (!message) return;
      window.location.assign(
        buildWhatsAppShareUrl(message, whatsAppTargetHelper.phone)
      );
      setWhatsAppTargetHelper(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Der bestehende Einsatzplan-Link konnte nicht vorbereitet werden"
      );
    } finally {
      setIsPreparingWhatsApp(false);
    }
  };

  const revokeActiveScheduleWhatsApp = async (
    shareId: number,
    createNew = false,
    viewMode = selectedWhatsAppShareView
  ) => {
    if (!whatsAppTargetHelper || isRevokingWhatsAppShare) return;
    setIsRevokingWhatsAppShare(true);
    try {
      await revokeWhatsAppPdfShare.mutateAsync({
        helperId: whatsAppTargetHelper.id,
        shareId,
      });
      await activeWhatsAppShares.refetch();
      toast.success("Der geschützte Einsatzplan-Link wurde sofort widerrufen");
      if (createNew) await createAndOpenScheduleWhatsApp(viewMode);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Der Einsatzplan-Link konnte nicht widerrufen werden"
      );
    } finally {
      setIsRevokingWhatsAppShare(false);
    }
  };

  const sendWhatsAppMessage = async (templateKind: "general" | "schedule") => {
    if (!whatsAppTargetHelper || isPreparingWhatsApp) return;
    if (templateKind === "schedule") {
      await createAndOpenScheduleWhatsApp();
      return;
    }
    if (!allowsWhatsAppTemplates) {
      window.location.assign(buildWhatsAppShareUrl("", whatsAppTargetHelper.phone));
      setWhatsAppTargetHelper(null);
      return;
    }
    setIsPreparingWhatsApp(true);
    try {
      const settings = await utils.pdf.settings.fetch();
      const eventName = currentEvent?.name ?? settings.eventName;

      if (templateKind === "general") {
        const message = renderWhatsAppMessage(
          settings.whatsAppHelperRequestTemplate,
          {
            eventName,
            eventDuration: eventDurationLabel,
          }
        );
        window.location.assign(
          buildWhatsAppShareUrl(message, whatsAppTargetHelper.phone)
        );
        setWhatsAppTargetHelper(null);
        return;
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Die WhatsApp-Nachricht konnte nicht vorbereitet werden"
      );
    } finally {
      setIsPreparingWhatsApp(false);
    }
  };

  const openWhatsAppDialog = (helper: {
    id: number;
    name: string;
    phone?: string | null;
  }) => {
    setWhatsAppTargetHelper(helper);
    setSelectedWhatsAppTemplateKind("general");
    setSelectedWhatsAppShareView("minimal");
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
  useEffect(() => {
    if (isDefaultMyTasks && user?.name?.trim()) {
      setMyHelperRecordOnly(true);
    }
  }, [isDefaultMyTasks, user?.name]);
  useEffect(() => {
    setMobileFeedbackFilters(feedbackFilter === "alle" ? [] : [feedbackFilter]);
  }, [feedbackFilter]);
  const updateMyTasksDefault = (enabled: boolean) => {
    setDefaultMyTasks(enabled);
    if (!enabled) setMyHelperRecordOnly(false);
    else if (user?.name?.trim()) setMyHelperRecordOnly(true);
  };
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
            (isMobileView
              ? mobileFeedbackFilters.length === 0 ||
                mobileFeedbackFilters.some(
                  selected =>
                    (selected === "erstkontakt-offen" &&
                      isHelperWithoutFirstContact(helper, activeDays)) ||
                    (selected !== "erstkontakt-offen" &&
                      helper.confirmed === selected)
                )
              : confirmationFilter === "alle" ||
                helper.confirmed === confirmationFilter) &&
            (isMobileView
              ? mobileWillHelpFilters.length === 0 ||
                mobileWillHelpFilters.includes(helper.willHelp)
              : willHelpFilter === "alle" || helper.willHelp === willHelpFilter) &&
            (!myHelperRecordOnly ||
              personKey(helper.name) === personKey(user?.name ?? "") ||
              (typeof helper.contactId === "number" &&
                ownContactIds.has(helper.contactId))) &&
            (!assignedOnly || assignedHelperIds.has(helper.id)) &&
            (!firstContactOnly ||
              isHelperWithoutFirstContact(helper, activeDays)) &&
            (isMobileView
              ? mobileContactFilters.length === 0 ||
                mobileContactFilters.includes(
                  helper.contactId ? String(helper.contactId) : "ohne"
                )
              : apFilter === "alle" ||
                (apFilter === "ohne"
                  ? !helper.contactId
                  : String(helper.contactId ?? "") === apFilter)) &&
            (isMobileView
              ? mobileCompanionFilters.length === 0 ||
                mobileCompanionFilters.some(
                  selected =>
                    selected === "mit"
                      ? Boolean(helper.companion?.trim())
                      : !helper.companion?.trim()
                )
              : companionFilter === "alle" ||
                (companionFilter === "mit"
                  ? Boolean(helper.companion?.trim())
                  : !helper.companion?.trim())) &&
            (!(isMobileView ? mobileTimedAvailabilityOnly : timedAvailabilityOnly) ||
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
      isMobileView,
      mobileContactFilters,
      mobileCompanionFilters,
      mobileFeedbackFilters,
      mobileWillHelpFilters,
      mobileTimedAvailabilityOnly,
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
  // Ein gerade von Klemmi angelegter Helfer bleibt für den letzten
  // Führungsschritt sichtbar, auch wenn eine vorher gewählte Filteransicht ihn
  // normalerweise ausblenden würde. Beim Schließen der Führung bleibt die
  // persönliche Filterauswahl unverändert bestehen.
  const displayedHelpers = filtered;
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

  const updateFeedbackFilter = (
    value: "alle" | "ja" | "nein" | "erstkontakt-offen"
  ) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete(HELPER_CONFIRMATION_QUERY_KEY);
        next.delete(HELPER_FIRST_CONTACT_QUERY_KEY);
        if (value === "ja" || value === "nein") {
          next.set(HELPER_CONFIRMATION_QUERY_KEY, value);
        }
        if (value === "erstkontakt-offen") {
          next.set(HELPER_FIRST_CONTACT_QUERY_KEY, "offen");
        }
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
    (isMobileView
      ? mobileContactFilters.length > 0 ||
        mobileCompanionFilters.length > 0 ||
        mobileFeedbackFilters.length > 0 ||
        mobileWillHelpFilters.length > 0 ||
        mobileTimedAvailabilityOnly ||
        myHelperRecordOnly
      : apFilter !== "alle" ||
        companionFilter !== "alle" ||
        confirmationFilter !== "alle" ||
        assignedOnly ||
        firstContactOnly ||
        willHelpFilter !== "alle" ||
        myHelperRecordOnly ||
        timedAvailabilityOnly);
  const mobileFilterCount =
    mobileContactFilters.length +
    mobileCompanionFilters.length +
    mobileFeedbackFilters.length +
    mobileWillHelpFilters.length +
    Number(mobileTimedAvailabilityOnly);

  const resetHelperFilters = () => {
    setFilter("");
    setApFilter("alle");
    setCompanionFilter("alle");
    setWillHelpFilter("alle");
    setTimedAvailabilityOnly(false);
    setMyHelperRecordOnly(false);
    setMobileContactFilters([]);
    setMobileCompanionFilters([]);
    setMobileFeedbackFilters([]);
    setMobileWillHelpFilters([]);
    setMobileTimedAvailabilityOnly(false);
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
        <KlemmiActionPanel
          className="lg:ml-auto lg:w-auto"
          viewControl={<ViewModeToggle mode={viewMode} onChange={setViewMode} />}
          guide={
            <KlemmiHelperGuide
              helperDialogOpen={newHelperDialogOpen}
              guideHelperId={displayedHelpers[0]?.id ?? null}
              viewMode={viewMode}
              currentPackageId={currentPackageId}
              onOpenHelperDialog={openNewHelperDialog}
              onCloseHelperDialog={() => setNewHelperDialogOpen(false)}
              onGuideOpenChange={() => undefined}
              onViewModeChange={setViewMode}
            />
          }
          secondaryActions={
            <PlanResetDialogButton
              area="helpers"
              label="Helfer"
              onCompleted={invalidate}
              triggerClassName="h-10 px-3"
            />
          }
          primaryAction={
            <Button
              type="button"
              data-klemmi-target="new-helper"
              className="h-10 bg-blue-600 px-4 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500"
              onClick={openNewHelperDialog}
            >
              <Plus className="mr-2 h-4 w-4" />
              Neuer Helfer
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="order-1 flex flex-wrap gap-2" aria-label="Schnellfilter Helfer">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={myHelperRecordOnly ? "default" : "outline"}
              className={
                myHelperRecordOnly
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
              }
              disabled={!user?.name?.trim()}
              onClick={() => setMyHelperRecordOnly(active => !active)}
            >
              👤 Meine Helferakte
            </Button>
            <MyTasksDefaultPin
              label="Meine Helferakte"
              pressed={isDefaultMyTasks}
              disabled={!canRememberMyTasksDefault}
              onPressedChange={updateMyTasksDefault}
            />
          </div>
        </div>
        <div className="order-2 md:hidden">
          <button
            type="button"
            data-slot="mobile-helper-filter-toggle"
            aria-expanded={mobileFiltersOpen}
            aria-controls="mobile-helper-filter-panel"
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
              className={cn(
                "size-5 shrink-0 text-slate-600 transition-transform duration-200",
                mobileFiltersOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
          {mobileFiltersOpen && (
            <div
              id="mobile-helper-filter-panel"
              data-slot="mobile-helper-filter-panel"
              className="mt-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Ansprechpartner</legend>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                    <Checkbox
                      checked={mobileContactFilters.includes("ohne")}
                      onCheckedChange={() =>
                        setMobileContactFilters(values => toggleMultiSelection(values, "ohne"))
                      }
                    />
                    Ohne Ansprechpartner
                  </label>
                  {contacts.map(contact => (
                    <label key={contact.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileContactFilters.includes(String(contact.id))}
                        onCheckedChange={() =>
                          setMobileContactFilters(values =>
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
                <legend className="text-sm font-semibold text-slate-900">Begleitung</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["mit", "Mit Begleitung"],
                    ["ohne", "Ohne Begleitung"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileCompanionFilters.includes(value)}
                        onCheckedChange={() =>
                          setMobileCompanionFilters(values => toggleMultiSelection(values, value))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Rückmeldung</legend>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    ["ja", "Bestätigt"],
                    ["nein", "Noch nicht bestätigt"],
                    ["erstkontakt-offen", "Ohne Erstkontakt"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileFeedbackFilters.includes(value)}
                        onCheckedChange={() =>
                          setMobileFeedbackFilters(values => toggleMultiSelection(values, value))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Helfen</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["ja", "Helfen: Ja"],
                    ["nein", "Helfen: Nein"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                      <Checkbox
                        checked={mobileWillHelpFilters.includes(value)}
                        onCheckedChange={() =>
                          setMobileWillHelpFilters(values => toggleMultiSelection(values, value))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800">
                <Checkbox
                  checked={mobileTimedAvailabilityOnly}
                  onCheckedChange={checked => setMobileTimedAvailabilityOnly(checked === true)}
                />
                Nur Helfer mit Zeitfenstern
              </label>
              {hasActiveHelperFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 w-full border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
                  onClick={resetHelperFilters}
                >
                  <FilterX className="mr-2 size-4" aria-hidden="true" />
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="order-2 hidden gap-2 md:flex md:flex-wrap">
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
            value={feedbackFilter}
            onValueChange={value =>
              updateFeedbackFilter(
                value as "alle" | "ja" | "nein" | "erstkontakt-offen"
              )
            }
          >
            <SelectTrigger className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[220px] md:text-sm" aria-label="Bestätigung filtern">
              <SelectValue placeholder="Bestätigung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Rückmeldungen</SelectItem>
              <SelectItem value="ja">Bestätigt</SelectItem>
              <SelectItem value="nein">Noch nicht bestätigt</SelectItem>
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
        <div className="order-3 relative w-full md:max-w-[551px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Suchen (Name, Telefon, Hinweise) …"
            value={filter}
            onChange={event => setFilter(event.target.value)}
            className="h-10 border-2 border-slate-300 bg-white pl-9 text-base shadow-sm focus:border-blue-500 focus-visible:border-blue-500 focus-visible:ring-blue-200 md:text-sm"
            aria-label="Helfer nach Name, Telefon oder Hinweis durchsuchen"
          />
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

      {viewMode === "liste" ? (
        <>
      <div className="space-y-3 md:hidden">
        {displayedHelpers.map(helper => (
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
                    disabled={!allowsDonations}
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
                    disabled={isPreparingWhatsApp}
                    onClick={() => openWhatsAppDialog(helper)}
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
                      (!isTenantAdmin &&
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
                  disabled={selfHelperIds.has(helper.id) || currentPackageId === "event_pass"}
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
                  <label className="text-xs font-medium">Hinweise</label>
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
                data-klemmi-target="helper-availability"
                data-klemmi-helper-id={helper.id}
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
                          update.mutateAsync({ id: helper.id, ...values } as any)
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        ))}
        {!isLoading && displayedHelpers.length === 0 && (
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
                <th className="p-2">Hinweise</th>
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
              {displayedHelpers.map(helper => {
                const helperDeleteDisabled =
                  selfHelperIds.has(helper.id) ||
                  (!isTenantAdmin && assignedHelperIds.has(helper.id));
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
                        disabled={!allowsDonations}
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
                        disabled={isPreparingWhatsApp}
                        onClick={() => openWhatsAppDialog(helper)}
                      >
                        <MessageCircle className="size-5 text-[#25D366]" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-2">
                    <Select
                      disabled={selfHelperIds.has(helper.id) || currentPackageId === "event_pass"}
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
                      <td
                        key={day}
                        data-klemmi-target="helper-availability"
                        data-klemmi-helper-id={helper.id}
                        className="p-1 text-center align-middle"
                      >
                        <DayAvailabilityControl
                          helper={helper}
                          day={day}
                          compactOnDesktop
                          disabled={update.isPending}
                          onCommit={values =>
                            update.mutateAsync({ id: helper.id, ...values } as any)
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
                          : !isTenantAdmin &&
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
              {!isLoading && displayedHelpers.length === 0 && (
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
        </>
      ) : (
        <div className="space-y-4" data-slot="helpers-cards-view">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedHelpers.map(helper => {
              const helperDeleteDisabled =
                selfHelperIds.has(helper.id) ||
                (!isTenantAdmin && assignedHelperIds.has(helper.id));
              const cakeCount = cakeCountByDonor.get(personKey(helper.name)) ?? 0;
              const donorCakes = cakes.filter(
                cake => personKey(cake.donor) === personKey(helper.name)
              );
              const helperContacts = contacts.filter(
                contact => contact.id === helper.contactId
              );
              const contactName = helperContacts[0]?.name ?? null;

              return (
                <Card
                  key={helper.id}
                  data-klemmi-target="helper-plan-context"
                  data-klemmi-helper-id={helper.id}
                  className={cn(
                    "border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md",
                    helper.confirmed === "ja" && "border-l-4 border-l-emerald-600"
                  )}
                >
                  <CardContent className="space-y-4 px-4 pb-4 pt-3 md:px-5 md:pb-5 md:pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="break-words text-base font-bold leading-5 text-slate-950 md:truncate">
                            {helper.name}
                          </h3>
                          {selfHelperIds.has(helper.id) && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
                              Du
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span>(</span>
                          <span
                            className={cn(
                              "font-medium",
                              contactName ? "text-slate-700" : "text-amber-700"
                            )}
                          >
                            {contactName ?? "Kein Ansprechpartner"}
                          </span>
                          <span>)</span>
                        </p>
                        <div
                          data-slot="helper-card-actions"
                          className="mt-2 flex min-h-11 items-center gap-2 sm:gap-3"
                        >
                          <CakeDonationAction
                            helperName={helper.name}
                            count={cakeCount}
                            compact
                            disabled={!allowsDonations}
                            klemmiTarget="helper-action-donation"
                            klemmiHelperId={helper.id}
                            onClick={() => openCakeDonation(helper.name)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 hover:text-green-700"
                            data-klemmi-target="helper-action-whatsapp"
                            data-klemmi-helper-id={helper.id}
                            title="Aufgabenplan per WhatsApp an Helfer senden"
                            aria-label={`Aufgabenplan von ${helper.name} per WhatsApp senden`}
                            disabled={isPreparingWhatsApp}
                            onClick={() => openWhatsAppDialog(helper)}
                          >
                            <MessageCircle className="size-4 text-[#25D366]" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 hover:text-blue-700"
                            data-klemmi-target="helper-action-pdf"
                            data-klemmi-helper-id={helper.id}
                            title="Einsatz-PDF herunterladen"
                            aria-label={`Einsatz-PDF von ${helper.name} herunterladen`}
                            disabled={exportingId === helper.id}
                            onClick={() => {
                              setExportingId(helper.id);
                              exportPdf.mutate({ helperId: helper.id });
                            }}
                          >
                            <FileDown className="size-4 text-blue-600" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 hover:text-blue-700"
                            data-klemmi-target="helper-action-edit"
                            data-klemmi-helper-id={helper.id}
                            title="Helfer bearbeiten"
                            aria-label={`Helfer ${helper.name} bearbeiten`}
                            disabled={update.isPending}
                            onClick={() => openMobileHelperEdit(helper)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 hover:text-red-700"
                            data-klemmi-target="helper-action-delete"
                            data-klemmi-helper-id={helper.id}
                            title={
                              helperDeleteDisabled
                                ? "Helfer kann aktuell nicht gelöscht werden"
                                : "Helfer löschen"
                            }
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
                                "size-4",
                                helperDeleteDisabled
                                  ? "text-slate-400 opacity-50"
                                  : "text-red-600"
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end pt-0.5">
                        {helper.phone?.trim() ? (
                          <a
                            href={`tel:${helper.phone.replace(/[^\d+]/g, "")}`}
                            data-slot="mobile-helper-phone-call"
                            className="max-w-[9.5rem] truncate text-xs font-medium text-blue-700 underline decoration-blue-200 underline-offset-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            title={`${helper.phone.trim()} anrufen`}
                            aria-label={`${helper.phone.trim()} anrufen`}
                          >
                            {helper.phone.trim()}
                          </a>
                        ) : (
                          <button
                            type="button"
                            data-slot="mobile-helper-phone-edit"
                            className="max-w-[9.5rem] truncate text-xs font-medium text-blue-700 underline decoration-blue-200 underline-offset-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            title="Telefonnummer hinzufügen"
                            aria-label={`Telefonnummer von ${helper.name} hinzufügen`}
                            disabled={update.isPending}
                            onClick={() => openMobileHelperEdit(helper)}
                          >
                            Telefonnummer hinzufügen
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      data-klemmi-target="helper-feedback"
                      data-klemmi-helper-id={helper.id}
                      className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs"
                    >
                      <div>
                        <span className="text-slate-500">Helfen?</span>
                        <div className="mt-1">
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
                      </div>
                      <div>
                        <span className="text-slate-500">Bestätigt?</span>
                        <div className="mt-1">
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
                    </div>

                    {Boolean(helper.companion?.trim()) && (
                      <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">Begleitung:</span>{" "}
                        {helper.companion}
                      </div>
                    )}

                    {Boolean(helper.note?.trim()) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-950">
                        <span className="font-semibold">Hinweise:</span> {helper.note}
                      </div>
                    )}

                    {donorCakes.length > 0 && (
                      <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs text-emerald-950">
                        <div className="flex items-center justify-between font-semibold">
                          <span>🎁 {donorCakes.length} Spende(n) hinterlegt</span>
                        </div>
                        <div className="space-y-1">
                          {donorCakes.map(cake => {
                            const tags: string[] = [];
                            if (cake.vegan) tags.push("Vegan");
                            if (cake.glutenFree) tags.push("Glutenfrei");
                            if (cake.lactoseFree) tags.push("Laktosefrei");
                            if (cake.containsNuts) tags.push("Nüsse");
                            if (cake.meat) tags.push("Fleisch");
                            return (
                              <div key={cake.id} className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-slate-900">{cake.cake}</span>
                                {tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div
                      data-klemmi-target="helper-availability"
                      data-klemmi-helper-id={helper.id}
                      className="space-y-2 border-t border-slate-100 pt-3"
                    >
                      <div className="text-xs font-semibold text-slate-700">
                        Tages-Verfügbarkeiten & Zeitfenster
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {activeDays.map(day => (
                          <div key={day} className="space-y-1">
                            <div className="text-center text-[11px] font-medium text-slate-600">
                              {WEEKDAY_SHORT_LABELS[day]}
                            </div>
                            <DayAvailabilityControl
                              helper={helper}
                              day={day}
                              disabled={update.isPending}
                              onCommit={values =>
                                update.mutateAsync({ id: helper.id, ...values } as any)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!isLoading && displayedHelpers.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Keine Helfer gefunden.
            </div>
          )}
        </div>
      )}
      <Dialog
        open={newHelperDialogOpen}
        onOpenChange={open => {
          setNewHelperDialogOpen(open);
          if (!open) resetNewHelperForm();
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain bg-white sm:max-w-5xl"
          onInteractOutside={event => {
            // Klemmi lebt bewusst als nicht-modaler Begleiter in einem Portal
            // außerhalb des Dialog-DOMs. Seine Steuerelemente dürfen den
            // echten Helferdialog deshalb nicht versehentlich schließen.
            if (event.target instanceof Element && event.target.closest("[data-klemmi-guide]")) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Neuer Helfer anlegen</DialogTitle>
            <p className="pt-1 text-sm text-slate-500">
              Angaben zuerst zur Person erfassen – eine zugesagte Spende wird bei Bedarf direkt gemeinsam ergänzt.
            </p>
          </DialogHeader>
          <form
            className="space-y-5"
            noValidate
            onSubmit={event => {
              event.preventDefault();
              createNewHelper();
            }}
          >
            <div
              className={cn(
                "grid gap-5",
                newHelperBringsCake && "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
              )}
            >
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Person & Einsatz</h3>
                  <p className="mt-1 text-xs text-slate-500">Die wichtigsten Angaben für Helferliste und Einsatzplan.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-helper-dialog-name" className="text-sm font-medium">
                    Name des Helfers <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="new-helper-dialog-name"
                    data-klemmi-target="new-helper-name"
                    autoFocus
                    value={name}
                    onChange={event => {
                      setName(event.target.value);
                      if (newHelperNameError) setNewHelperNameError(null);
                    }}
                    placeholder="z. B. Axel Muster"
                    className="h-11 bg-white text-base"
                    aria-invalid={Boolean(newHelperNameError)}
                    aria-describedby={newHelperNameError ? "new-helper-name-error" : undefined}
                    required
                  />
                  {newHelperNameError && (
                    <p
                      id="new-helper-name-error"
                      role="alert"
                      className="text-sm font-medium text-amber-800"
                    >
                      {newHelperNameError}
                    </p>
                  )}
                </div>
                <div
                  data-klemmi-target="new-helper-contact"
                  className="grid gap-4 rounded-xl sm:grid-cols-2"
                >
                  <div className="space-y-1.5">
                    <label htmlFor="new-helper-dialog-contact" className="text-sm font-medium">Ansprechpartner</label>
                    <Select
                      disabled={currentPackageId === "event_pass" && contacts.length > 0}
                      value={newHelperContactId}
                      onValueChange={setNewHelperContactId}
                    >
                      <SelectTrigger id="new-helper-dialog-contact" className="h-11 w-full bg-white text-base">
                        <SelectValue placeholder="Ansprechpartner auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Ansprechpartner</SelectItem>
                        {contacts.map(contact => (
                          <SelectItem key={contact.id} value={String(contact.id)}>{contact.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentPackageId === "event_pass" && (
                      <p className="text-[11px] text-slate-500">
                        Im Event Pass fest dem Vereinsadministrator zugeordnet (weitere Ansprechpartner ab Light).
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="new-helper-dialog-phone" className="text-sm font-medium">Telefon Helfer</label>
                    <Input
                      id="new-helper-dialog-phone"
                      type="tel"
                      value={newHelperPhone}
                      onChange={event => setNewHelperPhone(event.target.value)}
                      placeholder="optional"
                      className="h-11 bg-white text-base"
                    />
                  </div>
                </div>
                <div
                  data-klemmi-target="new-helper-details"
                  className="space-y-1.5 rounded-xl"
                >
                  <label htmlFor="new-helper-dialog-note" className="text-sm font-medium">Hinweise</label>
                  <Input
                    id="new-helper-dialog-note"
                    value={newHelperNote}
                    onChange={event => setNewHelperNote(event.target.value)}
                    placeholder="z. B. Besonderheiten oder Absprachen (optional)"
                    className="h-11 bg-white text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-helper-dialog-companion" className="text-sm font-medium">Zusätzliche Begleitung (für Einsatzplan)</label>
                  <Input
                    id="new-helper-dialog-companion"
                    value={newHelperCompanion}
                    onChange={event => setNewHelperCompanion(event.target.value)}
                    placeholder="z. B. + Frau Muster, + Kind"
                    className="h-11 bg-white text-base"
                  />
                  <p className="text-xs text-slate-500">Wird nur für den Einsatzplan genutzt.</p>
                </div>
                <section
                  data-klemmi-target="new-helper-availability"
                  className={cn(
                    "rounded-xl border p-3.5 transition-colors",
                    newHelperAvailabilityEnabled
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-amber-100 bg-amber-50/70"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="new-helper-dialog-availability"
                      checked={newHelperAvailabilityEnabled}
                      onCheckedChange={checked => {
                        setNewHelperAvailabilityEnabled(checked === true);
                        setNewHelperAvailabilityError(null);
                      }}
                    />
                    <label
                      htmlFor="new-helper-dialog-availability"
                      className="cursor-pointer text-sm font-semibold text-slate-900"
                    >
                      Verfügbarkeit jetzt erfassen
                      <span className="mt-0.5 block text-xs font-normal text-slate-600">
                        Optional – die Angaben stehen dem Einsatzplan sofort zur Verfügung.
                      </span>
                    </label>
                  </div>

                  {newHelperAvailabilityEnabled ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs leading-relaxed text-emerald-950">
                        <strong>Ja</strong> bedeutet ganztägig planbar. <strong>Ja mit Uhr</strong> öffnet ein begrenztes Zeitfenster. <strong>Nein</strong> schließt eine Einteilung aus; <strong>Unklar</strong> wartet auf Rückmeldung.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeDays.map(day => {
                          const choice = newHelperAvailability[day];
                          const timed = choice.value === "ja" && choice.withTime;
                          return (
                            <fieldset
                              key={day}
                              className="rounded-lg border border-emerald-100 bg-white p-3"
                            >
                              <legend className="px-1 text-sm font-semibold text-slate-900">
                                {day}
                              </legend>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  aria-pressed={choice.value === "ja" && !choice.withTime}
                                  className={cn(
                                    "min-h-10 border text-xs font-semibold",
                                    choice.value === "ja" && !choice.withTime
                                      ? "border-emerald-400 bg-emerald-100 text-emerald-950 hover:bg-emerald-200"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
                                  )}
                                  onClick={() =>
                                    setNewHelperAvailability(current => ({
                                      ...current,
                                      [day]: { value: "ja", withTime: false, start: "", end: "" },
                                    }))
                                  }
                                >
                                  Ja
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  aria-pressed={timed}
                                  className={cn(
                                    "min-h-10 border text-xs font-semibold",
                                    timed
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
                                  )}
                                  onClick={() =>
                                    setNewHelperAvailability(current => ({
                                      ...current,
                                      [day]: {
                                        ...current[day],
                                        value: "ja",
                                        withTime: true,
                                      },
                                    }))
                                  }
                                >
                                  <Clock3 className="mr-1 size-3.5" aria-hidden="true" />
                                  Ja mit Uhr
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  aria-pressed={choice.value === "nein"}
                                  className={cn(
                                    "min-h-10 border text-xs font-semibold",
                                    choice.value === "nein"
                                      ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-rose-50"
                                  )}
                                  onClick={() =>
                                    setNewHelperAvailability(current => ({
                                      ...current,
                                      [day]: { value: "nein", withTime: false, start: "", end: "" },
                                    }))
                                  }
                                >
                                  Nein
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  aria-pressed={choice.value === "vielleicht"}
                                  className={cn(
                                    "min-h-10 border text-xs font-semibold",
                                    choice.value === "vielleicht"
                                      ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-amber-50"
                                  )}
                                  onClick={() =>
                                    setNewHelperAvailability(current => ({
                                      ...current,
                                      [day]: { value: "vielleicht", withTime: false, start: "", end: "" },
                                    }))
                                  }
                                >
                                  Unklar
                                </Button>
                              </div>
                              {timed && (
                                <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-emerald-100 bg-emerald-50/70 p-2">
                                  <label className="space-y-1 text-xs font-medium text-slate-800">
                                    Von
                                    <Input
                                      type="time"
                                      value={choice.start}
                                      className="h-10 bg-white"
                                      onChange={event =>
                                        setNewHelperAvailability(current => ({
                                          ...current,
                                          [day]: { ...current[day], start: event.target.value },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs font-medium text-slate-800">
                                    Bis
                                    <Input
                                      type="time"
                                      value={choice.end}
                                      className="h-10 bg-white"
                                      onChange={event =>
                                        setNewHelperAvailability(current => ({
                                          ...current,
                                          [day]: { ...current[day], end: event.target.value },
                                        }))
                                      }
                                    />
                                  </label>
                                </div>
                              )}
                            </fieldset>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-amber-900">
                      Ohne Auswahl bleibt jeder aktive Veranstaltungstag zunächst auf <strong>Unklar</strong>. Die Verfügbarkeit kann jederzeit später an der Helferkarte ergänzt werden.
                    </p>
                  )}
                  {newHelperAvailabilityError && (
                    <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
                      {newHelperAvailabilityError}
                    </p>
                  )}
                </section>
                {allowsDonations ? (
                  <div data-klemmi-target="new-helper-donation" className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-3.5 transition-colors", newHelperBringsCake ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white")}>
                  <Checkbox
                    id="new-helper-dialog-brings-cake"
                    checked={newHelperBringsCake}
                    onCheckedChange={checked => setNewHelperBringsCake(checked === true)}
                  />
                  <label htmlFor="new-helper-dialog-brings-cake" className="cursor-pointer text-sm font-semibold text-slate-900">
                    Ich unterstütze mit einer Spende
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">Kuchen, Salat, Snack oder eine andere Spende direkt mit erfassen</span>
                  </label>
                </div>
                ) : (
                  <div
                    data-klemmi-target="new-helper-donation"
                    className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2.5 transition-colors hover:bg-slate-100"
                    onClick={() => setUpgradeCapability("donations")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setUpgradeCapability("donations");
                      }
                    }}
                    title="Spendenverwaltung erst ab Paket Pro verfügbar (Klick für Info)"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-200 text-slate-500">
                        <LockKeyhole className="size-3" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Ich unterstütze mit einer Spende
                        </p>
                        <p className="text-xs text-slate-500">
                          Spendenverwaltung ist im aktuellen Paket nicht enthalten.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                      ab Pro
                    </span>
                  </div>
                )}
              </section>

              {allowsDonations && newHelperBringsCake && (
                <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm sm:p-5" data-slot="new-helper-donation-form">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-950">Spende hinzufügen</h3>
                      <p className="mt-1 text-xs text-indigo-800/80">Die Spende wird zusammen mit dem Helfer in einem Schritt gespeichert.</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm">Optional</span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="new-helper-donation-name" className="text-sm font-medium text-slate-900">Spende</label>
                      <Input
                        id="new-helper-donation-name"
                        value={newHelperDonation.cake}
                        placeholder="z. B. Apfelkuchen, Nudelsalat"
                        className="h-11 bg-white text-base"
                        onChange={event => setNewHelperDonation(current => ({ ...current, cake: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="new-helper-donation-category" className="text-sm font-medium text-slate-900">Kategorie</label>
                      <Select
                        value={newHelperDonation.donationCategory}
                        onValueChange={value => setNewHelperDonation(current => ({ ...current, donationCategory: value as NewHelperDonationCategory }))}
                      >
                        <SelectTrigger id="new-helper-donation-category" className="h-11 bg-white text-base"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {newHelperDonationCategories.map(category => (
                            <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-900">Eigenschaften & Allergene</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {newHelperDonationTraits.map(trait => {
                        const active = newHelperDonation[trait.key];
                        return (
                          <Button
                            key={trait.key}
                            type="button"
                            variant="outline"
                            aria-pressed={active}
                            onClick={() => setNewHelperDonation(current => ({ ...current, [trait.key]: !current[trait.key] }))}
                            className={cn("h-10 justify-start border bg-white text-sm shadow-none", active ? trait.activeClass : "border-slate-200 text-slate-700 hover:bg-slate-50")}
                          >
                            <span className="mr-2 inline-flex size-4 items-center justify-center rounded border border-current text-[10px]" aria-hidden="true">{active ? "✓" : ""}</span>
                            {trait.label}
                          </Button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <details className="rounded-xl border border-indigo-100 bg-white/80 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-indigo-900">Abgabeort, Zeitpunkt und Hinweis ergänzen</summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label htmlFor="new-helper-donation-location" className="text-sm font-medium text-slate-900">Abgabeort / Standort</label>
                        <Select
                          value={newHelperDonation.locationId === null ? "none" : String(newHelperDonation.locationId)}
                          onValueChange={value => setNewHelperDonation(current => ({ ...current, locationId: value === "none" ? null : Number(value) }))}
                        >
                          <SelectTrigger id="new-helper-donation-location" className="h-11 bg-white text-base"><SelectValue placeholder="Kein Ort" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein Ort</SelectItem>
                            {locations.map(location => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="new-helper-donation-date" className="text-sm font-medium text-slate-900">Abgabetag</label>
                          <Input id="new-helper-donation-date" type="date" min={currentEvent?.startDate ?? undefined} max={currentEvent?.endDate ?? undefined} value={newHelperDonation.dropoffDate} className="h-11 bg-white" onChange={event => setNewHelperDonation(current => ({ ...current, dropoffDate: event.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="new-helper-donation-time" className="text-sm font-medium text-slate-900">Uhrzeit</label>
                          <Input id="new-helper-donation-time" type="time" step="60" value={newHelperDonation.dropoffTime} className="h-11 bg-white" onChange={event => setNewHelperDonation(current => ({ ...current, dropoffTime: event.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <label htmlFor="new-helper-donation-note" className="text-sm font-medium text-slate-900">Hinweise zur Spende</label>
                      <Textarea id="new-helper-donation-note" rows={3} value={newHelperDonation.note} placeholder="z. B. Zutaten, Alkohol oder Absprachen" className="bg-white" onChange={event => setNewHelperDonation(current => ({ ...current, note: event.target.value }))} />
                    </div>
                  </details>

                  <p className="rounded-xl border border-indigo-100 bg-white/80 px-3 py-2 text-xs leading-relaxed text-indigo-900" aria-live="polite">
                    {newHelperDonation.cake.trim()
                      ? `Bereit zum Speichern: ${newHelperDonation.cake.trim()} als ${newHelperDonationCategories.find(category => category.value === newHelperDonation.donationCategory)?.label ?? "Spende"}${newHelperDonationTraits.some(trait => newHelperDonation[trait.key]) ? " mit ausgewählten Kennzeichnungen." : "."}`
                      : "Alle Eigenschaften bleiben verfügbar. Die genaue Spendenbezeichnung kann jetzt oder später ergänzt werden."}
                  </p>
                </section>
              )}
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
                data-klemmi-target="new-helper-submit"
                variant="outline"
                className="min-h-11 border-slate-300 bg-white text-base font-semibold text-slate-950 shadow-sm hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-slate-500"
                disabled={create.isPending || createWithDonation.isPending}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {create.isPending || createWithDonation.isPending
                  ? "Speichert …"
                  : newHelperBringsCake
                    ? "Helfer & Spende anlegen"
                    : "Helfer anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(mobileHelperEditTarget)}
        onOpenChange={open => {
          if (!open && !update.isPending) setMobileHelperEditTarget(null);
        }}
      >
        <DialogContent
          data-slot="mobile-helper-edit-dialog"
          className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Helfer bearbeiten</DialogTitle>
            <p className="text-sm text-slate-500">
              Angaben direkt in der Helferkarte aktualisieren. Leere Felder entfernen bestehende Angaben.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="mobile-helper-edit-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="mobile-helper-edit-name"
                value={mobileHelperEditForm.name}
                onChange={event =>
                  setMobileHelperEditForm(current => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-11 text-base"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mobile-helper-edit-contact" className="text-sm font-medium">
                Ansprechpartner
              </label>
              <Select
                value={mobileHelperEditForm.contactId}
                onValueChange={contactId =>
                  setMobileHelperEditForm(current => ({ ...current, contactId }))
                }
              >
                <SelectTrigger id="mobile-helper-edit-contact" className="h-11 text-base">
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
            <div className="space-y-1.5">
              <label htmlFor="mobile-helper-edit-phone" className="text-sm font-medium">
                Telefon Helfer
              </label>
              <Input
                id="mobile-helper-edit-phone"
                type="tel"
                value={mobileHelperEditForm.phone}
                onChange={event =>
                  setMobileHelperEditForm(current => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Leer lassen, um die Nummer zu entfernen"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mobile-helper-edit-note" className="text-sm font-medium">
                Hinweise
              </label>
              <Textarea
                id="mobile-helper-edit-note"
                rows={3}
                value={mobileHelperEditForm.note}
                onChange={event =>
                  setMobileHelperEditForm(current => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="z. B. Kabeltrommel kann mitbringen"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mobile-helper-edit-companion" className="text-sm font-medium">
                Zusätzliche Begleitung
              </label>
              <Input
                id="mobile-helper-edit-companion"
                value={mobileHelperEditForm.companion}
                onChange={event =>
                  setMobileHelperEditForm(current => ({
                    ...current,
                    companion: event.target.value,
                  }))
                }
                placeholder="z. B. + Frau Muster, + Kind"
                className="h-11 text-base"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => setMobileHelperEditTarget(null)}
            >
              Abbrechen
            </Button>
            <Button type="button" disabled={update.isPending} onClick={saveMobileHelperEdit}>
              {update.isPending ? "Speichert …" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(whatsAppTargetHelper)}
        onOpenChange={open => {
          if (!open && !isPreparingWhatsApp) {
            setWhatsAppTargetHelper(null);
          }
        }}
      >
        <DialogContent className="max-w-xl bg-white text-slate-950 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-950">
              WhatsApp-Nachricht vorbereiten
            </DialogTitle>
            <p className="pt-1 text-sm text-slate-500">
              Wählen Sie die passende Vorlage für {whatsAppTargetHelper?.name}. Der Link öffnet WhatsApp direkt mit dem vorbereiteten Text.
            </p>
          </DialogHeader>

          {!allowsWhatsAppTemplates ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                <strong>Leerer WhatsApp-Chat:</strong> Der direkte Kontakt bleibt nutzbar. WhatsApp wird ohne vorbereiteten Text geöffnet, damit Sie die Nachricht frei formulieren können. Automatische Vorlagen sind ab Pro verfügbar.
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <strong>Freie Nachricht:</strong> Automatisch eingefügte Vorlagen und persönliche PDF-Links stehen ab Pro bereit.
              </div>
            </>
          ) : (
            <>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedWhatsAppTemplateKind("general")}
              className={cn(
                "flex h-full flex-col justify-between rounded-xl border p-4 text-left transition-all",
                selectedWhatsAppTemplateKind === "general"
                  ? "border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20"
                  : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg bg-emerald-100 p-2 text-emerald-800">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  {selectedWhatsAppTemplateKind === "general" && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <h4 className="font-semibold text-slate-950">
                  Muster 1: Allgemeine Helferanfrage
                </h4>
                <p className="text-xs leading-relaxed text-slate-600">
                  Fragt die generelle Bereitschaft, verfügbare Tage/Zeiten und optionale Kuchen-/Salatspenden für {currentEvent?.name ?? "die Veranstaltung"} ab.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                <span>Zeitraum: {eventDurationLabel}</span>
              </div>
            </button>

            <button
              type="button"
              aria-disabled={!allowsPersonalPdfShare}
              onClick={() => {
                if (!allowsPersonalPdfShare) {
                  setUpgradeCapability("personal_accesses");
                  return;
                }
                setSelectedWhatsAppTemplateKind("schedule");
              }}
              className={cn(
                "flex h-full flex-col justify-between rounded-xl border p-4 text-left transition-all",
                selectedWhatsAppTemplateKind === "schedule"
                  ? "border-blue-500 bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20"
                  : allowsPersonalPdfShare
                    ? "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50"
                    : "cursor-pointer border-slate-200 bg-slate-100/80 text-slate-500"
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg bg-blue-100 p-2 text-blue-800">
                    <FileText className="h-5 w-5" />
                  </div>
                  {!allowsPersonalPdfShare ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                      <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                      Ab Light
                    </span>
                  ) : selectedWhatsAppTemplateKind === "schedule" ? (
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  ) : null}
                </div>
                <h4 className="font-semibold text-slate-950">
                  Muster 2: Schichtzuteilung / Einsatzplan
                </h4>
                <p className="text-xs leading-relaxed text-slate-600">
                  {allowsPersonalPdfShare
                    ? "Sendet eine persönliche Einsatzübersicht mit eigenen Einsätzen, Zeiten, Orten sowie eigenen Hinweisen und Spenden zur Prüfung und Rückmeldung."
                    : "Persönliche PDF-Links und die Einsatzplan-Zuweisung stehen ab Light bereit."}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                {allowsPersonalPdfShare ? (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Erzeugt datensparsamen persönlichen PDF-Link</span>
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-3.5 w-3.5" />
                    <span>Klemmi erklärt den Upgrade-Vorteil</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {selectedWhatsAppTemplateKind === "schedule" &&
            allowsPersonalPdfShare && (
              <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                <div>
                  <p className="text-sm font-semibold text-blue-950">
                    Inhalt der geschützten Einsatzübersicht
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-blue-900/80">
                    Beide Varianten werden nur sieben Tage lang mit einem separaten Zugangscode freigegeben.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWhatsAppShareView("minimal")}
                    className={cn(
                      "rounded-lg border p-3 text-left text-xs transition-colors",
                      selectedWhatsAppShareView === "minimal"
                        ? "border-blue-500 bg-white ring-2 ring-blue-500/15"
                        : "border-blue-100 bg-white/70 hover:border-blue-300"
                    )}
                  >
                    <strong className="block text-sm text-slate-950">Basisansicht</strong>
                    <span className="mt-1 block leading-relaxed text-slate-600">
                      Eigene Zeiten, Aufgaben, Ort, Hinweise und Spenden sowie der zugeordnete Ansprechpartner. Die Rufnummer erscheint nur bei dessen freiwilliger Freigabe.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWhatsAppShareView("team")}
                    className={cn(
                      "rounded-lg border p-3 text-left text-xs transition-colors",
                      selectedWhatsAppShareView === "team"
                        ? "border-blue-500 bg-white ring-2 ring-blue-500/15"
                        : "border-blue-100 bg-white/70 hover:border-blue-300"
                    )}
                  >
                    <strong className="block text-sm text-slate-950">Ansicht mit Mithelfenden</strong>
                    <span className="mt-1 block leading-relaxed text-slate-600">
                      Zusätzlich die Namen der Mithelfenden und aufgabenrelevante Hinweise der Schicht. Nur verwenden, wenn diese Ansicht für die Schicht benötigt wird.
                    </span>
                  </button>
                </div>

                <aside
                  data-klemmi-contact-share-tip
                  className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50/80 p-3 text-slate-800"
                >
                  <KlemmiMascot decorative className="size-16 shrink-0 self-end sm:size-20" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">
                      Klemmi-Tipp für Ansprechpartner
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      Starte normalerweise mit der Basisansicht.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      Sie enthält alles, was der Helfer für seinen eigenen Einsatz braucht. Die Ansicht mit Mithelfenden wählst du nur, wenn die Namen in genau dieser Schicht für die gemeinsame Abstimmung erforderlich sind. Bei Änderungen: alten Link widerrufen und danach einen neuen Einsatzplan senden.
                    </p>
                  </div>
                </aside>

                <div
                  data-whatsapp-share-status
                  className="rounded-lg border border-blue-200 bg-white/85 p-3 text-xs text-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">
                      Aktive 7-Tage-Freigaben für {whatsAppTargetHelper?.name}
                    </p>
                    <span className="inline-flex items-center gap-1 text-blue-800">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Link und Zugangscode sind getrennt geschützt
                    </span>
                  </div>
                  {activeWhatsAppShares.isLoading ? (
                    <p className="mt-2 text-slate-600">Freigabestatus wird geprüft …</p>
                  ) : activeWhatsAppShares.data?.length ? (
                    <div className="mt-3 space-y-2">
                      {activeWhatsAppShares.data.map(share => {
                        const expiresAt = new Date(share.expiresAt).toLocaleString(
                          "de-DE",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        );
                        const label =
                          share.viewMode === "team"
                            ? "Ansicht mit Mithelfenden"
                            : "Basisansicht";
                        return (
                          <div
                            key={share.id}
                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium text-slate-900">
                                Aktiv: {label}
                              </p>
                              <span className="text-slate-600">
                                gültig bis {expiresAt} Uhr
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {share.canResend && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-blue-300 bg-white text-blue-800 hover:bg-blue-50"
                                  disabled={
                                    isPreparingWhatsApp || isRevokingWhatsAppShare
                                  }
                                  onClick={() => resendActiveScheduleWhatsApp(share.id)}
                                >
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  Bestehenden Link senden
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 border-red-300 bg-white text-red-800 hover:bg-red-50"
                                disabled={
                                  isPreparingWhatsApp || isRevokingWhatsAppShare
                                }
                                onClick={() =>
                                  revokeActiveScheduleWhatsApp(share.id)
                                }
                              >
                                <LockKeyhole className="mr-1.5 h-3.5 w-3.5" />
                                Link sofort widerrufen
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 bg-blue-800 text-white hover:bg-blue-900"
                                disabled={
                                  isPreparingWhatsApp || isRevokingWhatsAppShare
                                }
                                onClick={() => {
                                  setSelectedWhatsAppShareView(share.viewMode);
                                  void revokeActiveScheduleWhatsApp(
                                    share.id,
                                    true,
                                    share.viewMode
                                  );
                                }}
                              >
                                Widerrufen und neu senden
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-600">
                      Noch kein aktiver Link vorhanden. Beim Versand wird eine
                      neue Freigabe für sieben Tage erstellt.
                    </p>
                  )}
                </div>
              </div>
            )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {selectedWhatsAppTemplateKind === "general" ? (
              <p>
                <strong>Muster 1 aktiv:</strong> Sendet eine freundliche Voranfrage ohne PDF-Link. Der Veranstaltungszeitraum ({eventDurationLabel}) wird automatisch eingesetzt.
              </p>
            ) : (
              <p>
                <strong>Muster 2 aktiv:</strong> Erzeugt erst bei Klick auf „In WhatsApp öffnen“ einen geschützten, sieben Tage gültigen Abruflink für {whatsAppTargetHelper?.name}. Der Zugangscode wird separat in die Nachricht eingefügt.
              </p>
            )}
          </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPreparingWhatsApp}
              onClick={() => setWhatsAppTargetHelper(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="bg-[#25D366] text-white hover:bg-[#20bd5a]"
              disabled={isPreparingWhatsApp}
              onClick={() => sendWhatsAppMessage(selectedWhatsAppTemplateKind)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {isPreparingWhatsApp
                ? "Bereite vor …"
                : allowsWhatsAppTemplates
                  ? "In WhatsApp öffnen"
                  : "WhatsApp-Chat öffnen"}
            </Button>
          </DialogFooter>
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
      <KlemmiUpgradeDialog
        open={Boolean(upgradeCapability)}
        onOpenChange={open => {
          if (!open) setUpgradeCapability(null);
        }}
        currentPackageId={currentPackageId}
        capability={upgradeCapability}
        contextId={
          upgradeCapability === "donations" ? "donations" :
          upgradeCapability === "personal_accesses" ? "personal_helper_pdf" : null
        }
      />
    </div>
  );
}
