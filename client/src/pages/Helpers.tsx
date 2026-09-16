import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  buildWhatsAppDeepLink,
  copyWhatsAppMessage,
  renderWhatsAppMessage,
} from "@/lib/whatsappShare";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { FileDown, Info, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import {
  eventWeekdays,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_SHORT_LABELS,
} from "@shared/weekdays";

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
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: helpers = [], isLoading } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: currentEvent } = trpc.events.current.useQuery();
  const { data: pdfSettings } = trpc.pdf.settings.useQuery();
  const { data: plan } = trpc.plan.evaluate.useQuery();
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [apFilter, setApFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const shareWindowRef = useRef<Window | null>(null);
  const shareCopyPromiseRef = useRef<Promise<boolean> | null>(null);
  const shareMessageRef = useRef("");
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
  const create = trpc.helpers.create.useMutation({
    onSuccess: () => {
      invalidate();
      setName("");
      toast.success("Helfer hinzugefügt");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.helpers.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });
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
  const sharePdfViaWhatsApp = trpc.pdf.helper.useMutation({
    onSuccess: async (result, variables) => {
      const helper = helpers.find(item => item.id === variables.helperId);
      downloadBase64File(
        result.base64,
        result.mimeType,
        `Aufgaben_${safeDownloadName(helper?.name ?? String(variables.helperId))}.pdf`
      );

      const copied = await shareCopyPromiseRef.current;
      const whatsappUrl = buildWhatsAppDeepLink(shareMessageRef.current);
      if (shareWindowRef.current) {
        shareWindowRef.current.location.href = whatsappUrl;
        shareWindowRef.current = null;
      } else {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }
      shareCopyPromiseRef.current = null;
      setSharingId(null);
      toast[copied ? "success" : "message"](
        copied
          ? "Helfer-PDF heruntergeladen & WhatsApp-Text in Zwischenablage kopiert!"
          : "Helfer-PDF heruntergeladen. Der WhatsApp-Text ist im geöffneten Chat eingefügt."
      );
    },
    onError: error => {
      shareWindowRef.current?.close();
      shareWindowRef.current = null;
      shareCopyPromiseRef.current = null;
      setSharingId(null);
      toast.error(error.message);
    },
  });
  const shareHelperPdf = (helperId: number) => {
    if (sharingId !== null) return;
    const message = renderWhatsAppMessage(
      pdfSettings?.whatsAppMessageTemplate,
      currentEvent?.name ?? pdfSettings?.eventName
    );
    // Clipboard und leeres Zieltab müssen aus dem echten Nutzertipp starten;
    // Safari und mobile WebViews blockieren beides nach await-Aufrufen.
    shareMessageRef.current = message;
    shareCopyPromiseRef.current = copyWhatsAppMessage(message);
    shareWindowRef.current = window.open("", "_blank");
    if (shareWindowRef.current) shareWindowRef.current.opener = null;
    setSharingId(helperId);
    sharePdfViaWhatsApp.mutate({ helperId });
  };

  const filtered = useMemo(
    () =>
      helpers
        .filter(
          helper =>
            (!filter ||
              helper.name.toLowerCase().includes(filter.toLowerCase())) &&
            (apFilter === "alle" ||
              (apFilter === "ohne"
                ? !helper.contactId
                : String(helper.contactId ?? "") === apFilter))
        )
        .sort((a, b) =>
          sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        ),
    [helpers, filter, apFilter, sortAsc]
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
  const assignedHelperIds = useMemo(
    () =>
      new Set((plan ?? []).flatMap(item => item.assigned.map(a => a.helperId))),
    [plan]
  );

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
          <Input
            placeholder="Name"
            value={name}
            onChange={event => setName(event.target.value)}
            className="col-span-2 w-full lg:hidden"
            onKeyDown={event =>
              event.key === "Enter" &&
              name.trim() &&
              create.mutate({ name: name.trim() })
            }
          />
          <Button
            className="col-span-2 shadow-xs lg:hidden"
            onClick={() => name.trim() && create.mutate({ name: name.trim() })}
            disabled={!name.trim() || create.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <span>{create.isPending ? "Speichert …" : "Neuer Helfer"}</span>
          </Button>
        </div>
      </div>

      <Card className="hidden border-blue-200 bg-slate-50/80 shadow-sm lg:block">
        <CardContent className="flex items-end gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="new-helper-name" className="text-sm font-semibold text-slate-800">
              Neuanlage – Name des Helfers
            </label>
            <Input
              id="new-helper-name"
              placeholder="Name des neuen Helfers eingeben"
              value={name}
              onChange={event => setName(event.target.value)}
              className="h-11 border-slate-300 bg-white text-base shadow-sm placeholder:text-slate-600"
              onKeyDown={event =>
                event.key === "Enter" &&
                name.trim() &&
                create.mutate({ name: name.trim() })
              }
            />
          </div>
          <Button
            className="h-11 bg-indigo-700 px-5 text-base font-semibold shadow-sm hover:bg-indigo-800"
            onClick={() => name.trim() && create.mutate({ name: name.trim() })}
            disabled={!name.trim() || create.isPending}
          >
            <Plus className="h-5 w-5" />
            {create.isPending ? "Speichert …" : "Helfer hinzufügen"}
          </Button>
        </CardContent>
      </Card>

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
      </div>

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
                    size="icon"
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                    title="Helfer-PDF herunterladen und per WhatsApp teilen"
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
                        size="icon"
                        className="bg-emerald-500 text-white hover:bg-emerald-600"
                        title="Helfer-PDF herunterladen und per WhatsApp teilen"
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
