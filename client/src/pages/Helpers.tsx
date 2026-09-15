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
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { FileDown, Info, Trash2 } from "lucide-react";
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
            "w-full pr-11 text-base xl:pr-9 xl:text-sm",
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
  const { data: plan } = trpc.plan.evaluate.useQuery();
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [apFilter, setApFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
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
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Helfer</h1>
          <p className="text-muted-foreground">
            Helferdaten, Tagesverfügbarkeit, Hinweise und persönliche
            Aufgaben-PDFs.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <ModuleExcelImportButton area="HELFER" label="Helfer" />
          <ResetAreaButton area="helpers" label="Helfer" compact />
          <Input
            placeholder="Name"
            value={name}
            onChange={event => setName(event.target.value)}
            className="w-52"
            onKeyDown={event =>
              event.key === "Enter" &&
              name.trim() &&
              create.mutate({ name: name.trim() })
            }
          />
          <Button
            onClick={() => name.trim() && create.mutate({ name: name.trim() })}
          >
            Hinzufügen
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Suchen …"
          value={filter}
          onChange={event => setFilter(event.target.value)}
          className="w-56"
        />
        <Select value={apFilter} onValueChange={setApFilter}>
          <SelectTrigger className="w-56">
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
                  <Sel
                    value={helper.willHelp}
                    options={YN}
                    onChange={willHelp =>
                      update.mutate({
                        id: helper.id,
                        willHelp: willHelp as "ja" | "nein",
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
                  <Sel
                    value={helper.confirmed}
                    options={YN}
                    onChange={confirmed =>
                      update.mutate({
                        id: helper.id,
                        confirmed: confirmed as "ja" | "nein",
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
            style={{ minWidth: 892 + activeDays.length * 56 }}
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
              <col className="w-[80px]" />
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
                <th className="p-1 text-center text-[11px] leading-tight">
                  Helfen?
                </th>
                {activeDays.map(day => (
                  <th
                    key={day}
                    className="p-1 text-center text-[11px] leading-tight"
                    title={day}
                  >
                    {WEEKDAY_SHORT_LABELS[day]}
                  </th>
                ))}
                <th className="p-1 text-center text-[11px] leading-tight">
                  Bestätigt?
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
                  <td className="p-1 text-center">
                    <Sel
                      value={helper.willHelp}
                      options={YN}
                      compactOnDesktop
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          willHelp: value as "ja" | "nein",
                        })
                      }
                    />
                  </td>
                  {activeDays.map(day => {
                    const field = WEEKDAY_AVAILABILITY_FIELDS[day];
                    return (
                      <td key={day} className="p-1 text-center">
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
                  <td className="p-1 text-center">
                    <Sel
                      value={helper.confirmed}
                      options={YN}
                      compactOnDesktop
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          confirmed: value as "ja" | "nein",
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
