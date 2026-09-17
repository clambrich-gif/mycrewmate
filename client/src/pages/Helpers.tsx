import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
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
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { trpc } from "@/lib/trpc";
import { FileDown, Info, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import {
  eventWeekdays,
  isHelperWithoutFirstContact,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_SHORT_LABELS,
} from "@shared/weekdays";
import {
  HELPER_ASSIGNMENT_QUERY_KEY,
  HELPER_CONFIRMATION_QUERY_KEY,
  HELPER_FIRST_CONTACT_QUERY_KEY,
  parseHelperAssignmentFilter,
  parseHelperConfirmationFilter,
  parseHelperFirstContactFilter,
} from "@/lib/dashboard-target-filter";
import { useSearchParams } from "wouter";

const YN = [
  { v: "ja", l: "Ja" },
  { v: "nein", l: "Nein" },
] as const;
const YNV = [
  { v: "ja", l: "Ja" },
  { v: "nein", l: "Nein" },
  { v: "vielleicht", l: "?" },
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
 * Direkter Ja/Nein-Schalter für die beiden binären Helferstatus. Der Thumb
 * liegt stets an einem festen Endanschlag: Nein links, Ja rechts. Die mobile
 * Schaltfläche bleibt als Touch-Ziel 44 px hoch, wirkt durch die kompakte
 * 92-px-Schalterbahn aber deutlich ruhiger als die bisherige Vollbreitenform.
 */
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
          "relative inline-flex h-11 min-h-11 w-[92px] items-center rounded-lg border px-1.5 text-xs font-semibold shadow-xs transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isYes
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
          compactOnDesktop &&
            "lg:h-8 lg:min-h-8 lg:w-14 lg:rounded-md lg:px-1 lg:text-[10px]"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-1.5 top-1.5 size-8 rounded-md shadow-sm transition-transform duration-150 ease-out",
            isYes ? "translate-x-12 bg-emerald-500" : "translate-x-0 bg-rose-400",
            compactOnDesktop &&
              "lg:left-1 lg:top-1 lg:size-5 lg:rounded-sm lg:translate-x-0",
            compactOnDesktop && isYes && "lg:translate-x-5"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none relative z-10 flex w-full items-center",
            isYes ? "justify-start pl-1" : "justify-end pr-1"
          )}
        >
          {isYes ? "Ja" : "Nein"}
        </span>
      </button>
    </div>
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

  return (
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
  );
}

export default function Helpers() {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: helpers = [], isLoading } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: currentEvent } = trpc.events.current.useQuery();
  const { data: pdfSettings } = trpc.pdf.settings.useQuery();
  const { data: plan } = trpc.plan.evaluate.useQuery();
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const [name, setName] = useState("");
  const [newHelperCompanion, setNewHelperCompanion] = useState("");
  const [newHelperContactId, setNewHelperContactId] = useState("none");
  const [newHelperPhone, setNewHelperPhone] = useState("");
  const [newHelperNote, setNewHelperNote] = useState("");
  const [newHelperDialogOpen, setNewHelperDialogOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [apFilter, setApFilter] = useState("alle");
  const [companionFilter, setCompanionFilter] = useState<
    "alle" | "mit" | "ohne"
  >("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [responsibleContactId, setResponsibleContactId] = useState<
    number | null
  >(null);

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
  };
  const openNewHelperDialog = () => {
    resetNewHelperForm();
    setNewHelperDialogOpen(true);
  };
  const create = trpc.helpers.create.useMutation({
    onSuccess: () => {
      invalidate();
      resetNewHelperForm();
      setNewHelperDialogOpen(false);
      toast.success("Helfer hinzugefügt");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.helpers.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });
  const createNewHelper = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
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
      setResponsibleContactId(null);
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
  const filtered = useMemo(
    () =>
      helpers
        .filter(
          helper =>
            (!filter ||
              helper.name.toLowerCase().includes(filter.toLowerCase())) &&
            (confirmationFilter === "alle" ||
              helper.confirmed === confirmationFilter) &&
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
                : !helper.companion?.trim()))
        )
        .sort((a, b) =>
          sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        ),
    [
      helpers,
      filter,
      confirmationFilter,
      assignedOnly,
      firstContactOnly,
      assignedHelperIds,
      apFilter,
      companionFilter,
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
        next.delete(HELPER_ASSIGNMENT_QUERY_KEY);
        next.delete(HELPER_FIRST_CONTACT_QUERY_KEY);
        if (value === "alle") next.delete(HELPER_CONFIRMATION_QUERY_KEY);
        else next.set(HELPER_CONFIRMATION_QUERY_KEY, value);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Helfer</h1>
          <p className="text-muted-foreground">
            Helferdaten, Tagesverfügbarkeit, Hinweise und persönliche
            Aufgaben-PDFs.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          <ModuleExcelImportButton area="HELFER" label="Helfer" />
          <ResetAreaButton area="helpers" label="Helfer" compact />
          <Button
            type="button"
            variant="outline"
            className={`col-span-2 lg:col-auto ${CREATION_ACTION_BUTTON_CLASS}`}
            onClick={openNewHelperDialog}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <span>Neuer Helfer</span>
          </Button>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
        <Input
          placeholder="Suchen …"
          value={filter}
          onChange={event => setFilter(event.target.value)}
          className="w-full lg:w-56"
        />
        <Select value={apFilter} onValueChange={setApFilter}>
          <SelectTrigger className="w-full lg:w-56">
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
          value={confirmationFilter}
          onValueChange={value =>
            updateConfirmationFilter(value as "alle" | "ja" | "nein")
          }
        >
          <SelectTrigger className="w-full lg:w-52" aria-label="Bestätigung filtern">
            <SelectValue placeholder="Bestätigung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Rückmeldungen</SelectItem>
            <SelectItem value="ja">Bestätigt</SelectItem>
            <SelectItem value="nein">Noch nicht bestätigt</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={companionFilter}
          onValueChange={value =>
            setCompanionFilter(value as "alle" | "mit" | "ohne")
          }
        >
          <SelectTrigger className="w-full lg:w-48" aria-label="Begleitung filtern">
            <SelectValue placeholder="Begleitung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Begleitungen</SelectItem>
            <SelectItem value="mit">Mit Begleitung</SelectItem>
            <SelectItem value="ohne">Ohne Begleitung</SelectItem>
          </SelectContent>
        </Select>
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
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    title="Persönliche Aufgabenübersicht als PDF"
                    disabled={exportingId === helper.id}
                    onClick={() => {
                      setExportingId(helper.id);
                      exportPdf.mutate({ helperId: helper.id });
                    }}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Persönlichen PDF-Link per WhatsApp teilen"
                    aria-label={`Einteilung von ${helper.name} per WhatsApp teilen`}
                    disabled={sharingId !== null}
                    onClick={() => shareHelperPdf(helper.id)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Löschen"
                    disabled={
                      selfHelperIds.has(helper.id) ||
                      (user?.role !== "admin" &&
                        assignedHelperIds.has(helper.id))
                    }
                    onClick={() =>
                      setDeleteTarget({ id: helper.id, name: helper.name })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Helfen?</label>
                  <YesNoToggle
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
                {activeDays.map(day => {
                  const field = WEEKDAY_AVAILABILITY_FIELDS[day];
                  return (
                    <div key={day} className="space-y-1.5">
                      <label className="text-xs font-medium">{day}</label>
                      <Sel
                        value={helper[field]}
                        options={YNV}
                        onChange={value =>
                          update.mutate({ id: helper.id, [field]: value })
                        }
                      />
                    </div>
                  );
                })}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Bestätigt?</label>
                  <YesNoToggle
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
            style={{ minWidth: 932 + activeDays.length * 56 }}
          >
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[230px]" />
              <col className="w-[220px]" />
              <col className="w-[56px]" />
              {activeDays.map(day => (
                <col key={day} className="w-[56px]" />
              ))}
              <col className="w-[56px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="helpers-desktop-sticky-head bg-muted/60">
              <tr className="text-left">
                <th
                  className="cursor-pointer select-none p-2"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  Name {sortAsc ? "▲" : "▼"}
                </th>
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
                <th className="p-2 text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={7 + activeDays.length}
                  >
                    Lade …
                  </td>
                </tr>
              )}
              {filtered.map(helper => (
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
                    const field = WEEKDAY_AVAILABILITY_FIELDS[day];
                    return (
                      <td key={day} className="p-1 text-center align-middle">
                        <Sel
                          value={helper[field]}
                          options={YNV}
                          compactOnDesktop
                          onChange={value =>
                            update.mutate({ id: helper.id, [field]: value })
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
                  <td className="p-1">
                    <div className="flex min-w-0 justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Persönliche Aufgabenübersicht als PDF"
                        disabled={exportingId === helper.id}
                        onClick={() => {
                          setExportingId(helper.id);
                          exportPdf.mutate({ helperId: helper.id });
                        }}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Persönlichen PDF-Link per WhatsApp teilen"
                        aria-label={`Einteilung von ${helper.name} per WhatsApp teilen`}
                        disabled={sharingId !== null}
                        onClick={() => shareHelperPdf(helper.id)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          selfHelperIds.has(helper.id)
                            ? "Zum Löschen zuerst den Ansprechpartner entfernen"
                            : user?.role !== "admin" &&
                                assignedHelperIds.has(helper.id)
                              ? "Eingeteilte Helfer können nur Administratoren löschen"
                              : "Löschen"
                        }
                        disabled={
                          selfHelperIds.has(helper.id) ||
                          (user?.role !== "admin" &&
                            assignedHelperIds.has(helper.id))
                        }
                        onClick={() =>
                          setDeleteTarget({
                            id: helper.id,
                            name: helper.name,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={7 + activeDays.length}
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
            setResponsibleContactId(null);
          }
        }}
        title="Helfer löschen?"
        description={`„${deleteTarget?.name ?? ""}“ wird aus der Helferliste und allen Einsatzzuordnungen des aktuellen Jahres gelöscht.`}
        busy={remove.isPending}
        contacts={contacts}
        responsibleContactId={responsibleContactId}
        onResponsibleContactChange={setResponsibleContactId}
        onConfirm={() =>
          deleteTarget &&
          responsibleContactId &&
          remove.mutate({
            id: deleteTarget.id,
            responsibleContactId,
          })
        }
      />
    </div>
  );
}
