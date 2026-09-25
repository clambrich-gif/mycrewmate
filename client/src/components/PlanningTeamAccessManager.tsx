import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CheckSquare,
  Copy,
  FileDown,
  Filter,
  Info,
  Link2,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  EDITABLE_PLANNING_MODULES,
  PLANNING_MODULE_META,
  type PlanningModule,
} from "@shared/tenant-permissions";

type FormState = {
  id: number | null;
  contactId: number | null;
  label: string;
  email: string;
  modulePermissions: PlanningModule[];
  isTenantAdmin: boolean;
  eventIds: number[];
  currentAdminPassword: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  contactId: null,
  label: "",
  email: "",
  modulePermissions: [],
  isTenantAdmin: false,
  eventIds: [],
  currentAdminPassword: "",
};
const ALL_YEARS = "all-years";
const ALL_EVENTS = "all-events";

type ContactChoice = {
  id: number;
  name: string;
};

type AccessSummary = {
  id: number;
  contactId: number | null;
  contactName: string | null;
  label: string;
  email?: string | null;
  modulePermissions?: PlanningModule[];
  isTenantAdmin: boolean;
  eventIds: number[];
  mustChangePassword: boolean;
};

function normalizedContactName(name: string) {
  return name.trim().toLocaleLowerCase("de-DE");
}

function uniqueContactChoices<T extends ContactChoice>(
  contacts: T[],
  preferredContactId: number | null
) {
  const choicesByName = new Map<string, T>();
  for (const contact of contacts) {
    const normalizedName = normalizedContactName(contact.name);
    if (!normalizedName) continue;
    const existing = choicesByName.get(normalizedName);
    if (!existing || contact.id === preferredContactId) {
      choicesByName.set(normalizedName, contact);
    }
  }
  return Array.from(choicesByName.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "de")
  );
}

export function PlanningTeamAccessManager() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const accesses = trpc.planningTeamAccesses.list.useQuery();
  const availableContacts = trpc.planningTeamAccesses.availableContacts.useQuery();
  const availableEvents = trpc.planningTeamAccesses.availableEvents.useQuery();
  const administrativeContext =
    trpc.planningTeamAccesses.administrativeContext.useQuery();
  const isPlanningTeamIdentity =
    user?.openId.startsWith("planning-team-access-") === true;
  const isDelegatedTenantAdmin =
    administrativeContext.data?.isDelegatedTenantAdmin === true ||
    isPlanningTeamIdentity;
  const isPrimaryTenantAdmin =
    administrativeContext.data?.isPrimaryTenantAdmin === true &&
    !isDelegatedTenantAdmin;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterYear, setFilterYear] = useState(ALL_YEARS);
  const [filterEventId, setFilterEventId] = useState(ALL_EVENTS);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedPrintAccessIds, setSelectedPrintAccessIds] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [resetTarget, setResetTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [sendEmailInvite, setSendEmailInvite] = useState(true);
  const [issuedInvitation, setIssuedInvitation] = useState<{
    label: string;
    email: string;
    activationUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [sendLinkTarget, setSendLinkTarget] = useState<AccessSummary | null>(null);
  const [sendLinkPassword, setSendLinkPassword] = useState("");

  const eventById = useMemo(
    () => new Map((availableEvents.data ?? []).map(event => [event.id, event])),
    [availableEvents.data]
  );
  const years = useMemo(
    () =>
      Array.from(new Set((availableEvents.data ?? []).map(event => event.year))).sort(
        (left, right) => right - left
      ),
    [availableEvents.data]
  );
  const filteredEventChoices = useMemo(
    () =>
      (availableEvents.data ?? []).filter(
        event => filterYear === ALL_YEARS || String(event.year) === filterYear
      ),
    [availableEvents.data, filterYear]
  );
  const filteredAccesses = useMemo(() => {
    return (accesses.data ?? []).filter(access => {
      if (!access.contactId || !access.contactName) return false;
      if (filterEventId !== ALL_EVENTS) {
        return access.eventIds.includes(Number(filterEventId));
      }
      if (filterYear !== ALL_YEARS) {
        return access.eventIds.some(
          eventId => String(eventById.get(eventId)?.year) === filterYear
        );
      }
      return true;
    });
  }, [accesses.data, eventById, filterEventId, filterYear]);
  const selectedEvents = form.eventIds
    .map(eventId => eventById.get(eventId))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const selectedContact = (availableContacts.data ?? []).find(
    contact => contact.id === form.contactId
  );
  const contactChoices = useMemo(
    () => uniqueContactChoices(availableContacts.data ?? [], form.contactId),
    [availableContacts.data, form.contactId]
  );
  const effectiveEventIds = form.isTenantAdmin
    ? (availableEvents.data ?? []).map(event => event.id)
    : form.eventIds;
  const valid =
    form.label.trim().length >= 2 &&
    (form.id !== null || form.contactId !== null) &&
    effectiveEventIds.length > 0 &&
    Boolean(form.currentAdminPassword);
  const allPrintTargetsSelected =
    filteredAccesses.length > 0 &&
    filteredAccesses.every(access => selectedPrintAccessIds.includes(access.id));

  useEffect(() => {
    if (
      filterEventId !== ALL_EVENTS &&
      !filteredEventChoices.some(event => event.id === Number(filterEventId))
    ) {
      setFilterEventId(ALL_EVENTS);
    }
  }, [filterEventId, filteredEventChoices]);

  const invalidate = async () => {
    await Promise.all([
      utils.planningTeamAccesses.list.invalidate(),
      utils.planningTeamAccesses.availableContacts.invalidate(),
      utils.auth.passwordStatus.invalidate(),
    ]);
  };
  const createWithInvitationLink = trpc.planningTeamAccesses.createWithInvitationLink.useMutation({
    onSuccess: async result => {
      await invalidate();
      setForm(EMPTY_FORM);
      setIssuedInvitation({
        label: result.label,
        email: result.email,
        activationUrl: result.activationUrl,
        emailSent: result.emailSent,
      });
      toast.success(
        result.emailSent
          ? "Planungsteam-Einladung erstellt und an den Mailserver übergeben"
          : "Planungsteam-Einladungslink erstellt; E-Mail-Übergabe fehlgeschlagen – Link bitte manuell weitergeben"
      );
    },
    onError: error => toast.error(error.message),
  });
  const sendInvitationLink = trpc.planningTeamAccesses.sendInvitationLink.useMutation({
    onSuccess: async result => {
      await invalidate();
      setSendLinkTarget(null);
      setSendLinkPassword("");
      setIssuedInvitation({
        label: result.label,
        email: result.email,
        activationUrl: result.activationUrl,
        emailSent: result.emailSent,
      });
      toast.success(
        result.emailSent
          ? `Aktivierungslink an den Mailserver für ${result.email} übergeben`
          : "Neuer Aktivierungslink erstellt; E-Mail-Übergabe fehlgeschlagen – Link bitte manuell weitergeben"
      );
    },
    onError: error => toast.error(error.message),
  });
  const createAccess = trpc.planningTeamAccesses.createWithAccessSheet.useMutation({
    onSuccess: async result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      await invalidate();
      setForm(EMPTY_FORM);
      toast.success("Planungsteam-Zugang angelegt; Einmal-Zugangsblatt wird heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const updateAccess = trpc.planningTeamAccesses.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setForm(EMPTY_FORM);
      toast.success("Planungsteam-Zugang aktualisiert; bestehende Sitzungen wurden abgemeldet");
    },
    onError: error => toast.error(error.message),
  });
  const deleteAccess = trpc.planningTeamAccesses.remove.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDeleteTarget(null);
      setDeletePassword("");
      if (form.id === deleteTarget?.id) setForm(EMPTY_FORM);
      toast.success("Planungsteam-Zugang gelöscht und zugehörige Sitzungen gesperrt");
    },
    onError: error => toast.error(error.message),
  });
  const resetAndPrint = trpc.planningTeamAccesses.resetAndPrint.useMutation({
    onSuccess: async result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      await invalidate();
      setResetTarget(null);
      setResetPassword("");
      toast.success("Passwort zurückgesetzt; Einmal-Zugangsblatt wird heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const accessSheets = trpc.planningTeamAccesses.accessSheets.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      setPrintDialogOpen(false);
      toast.success("Ausgewählte Zugangsblätter ohne Passwörter werden heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });

  const submitDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deleteTarget || !deletePassword || deleteAccess.isPending) return;
    deleteAccess.mutate({
      id: deleteTarget.id,
      currentAdminPassword: deletePassword,
    });
  };
  const submitReset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetTarget || !resetPassword || resetAndPrint.isPending) return;
    resetAndPrint.mutate({
      id: resetTarget.id,
      currentAdminPassword: resetPassword,
    });
  };
  const submitPrintSelection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPrintAccessIds.length || accessSheets.isPending) return;
    accessSheets.mutate({ accessIds: selectedPrintAccessIds });
  };

  const save = () => {
    if (!valid) return;
    const input = {
      label: form.label.trim(),
      contactId: form.contactId,
      email: form.email.trim() ? form.email.trim() : undefined,
      modulePermissions: form.modulePermissions,
      isTenantAdmin: form.isTenantAdmin,
      eventIds: effectiveEventIds,
      currentAdminPassword: form.currentAdminPassword,
    };
    if (form.id === null) {
      if (form.contactId === null) return;
      createAccess.mutate({ ...input, contactId: form.contactId });
    } else {
      updateAccess.mutate({ ...input, id: form.id });
    }
  };
  const toggleEvent = (eventId: number, checked: boolean) => {
    setForm(current => ({
      ...current,
      eventIds: checked
        ? Array.from(new Set([...current.eventIds, eventId]))
        : current.eventIds.filter(id => id !== eventId),
    }));
  };
  const togglePrintAccess = (accessId: number, checked: boolean) => {
    setSelectedPrintAccessIds(current =>
      checked
        ? Array.from(new Set([...current, accessId]))
        : current.filter(id => id !== accessId)
    );
  };
  const openPrintSelection = () => {
    setSelectedPrintAccessIds(filteredAccesses.map(access => access.id));
    setPrintDialogOpen(true);
  };
  const editAccess = (access: AccessSummary) => {
    setForm({
      id: access.id,
      contactId: access.contactId,
      label: access.label,
      email: access.email ?? "",
      modulePermissions: Array.isArray(access.modulePermissions)
        ? access.modulePermissions
        : [],
      isTenantAdmin: access.isTenantAdmin,
      eventIds: access.eventIds,
      currentAdminPassword: "",
    });
    setOpenSections(["create-access"]);
  };
  const formatEvents = (access: AccessSummary) =>
    access.isTenantAdmin
      ? "Alle Veranstaltungen dieses Vereins"
      : access.eventIds
      .map(eventId => {
        const event = eventById.get(eventId);
        return event ? `${event.year} · ${event.name}` : `Event #${eventId}`;
      })
      .join(" · ");
  const busy =
    createAccess.isPending || updateAccess.isPending || resetAndPrint.isPending;

  return (
    <div className="space-y-3" data-planning-team-access-manager>
      <p className="text-sm text-muted-foreground">
        Jeder Zugang erhält ein eigenes Passwort. Fachrechte und Veranstaltungsfreigaben
        werden zusätzlich auf dem Server geprüft. Ein rot markierter Co-Admin
        erhält volle Rechte ausschließlich im eigenen Verein.
      </p>
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        <AccordionItem
          value="existing-accesses"
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          <AccordionTrigger className="px-4 py-3 text-base font-semibold text-slate-900 hover:no-underline">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-700" />
              Vorhandene Zugänge &amp; Filter
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-slate-100 px-4 pb-4">
            <div className="space-y-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="max-w-2xl text-xs text-slate-600">
            Der reguläre Nachdruck enthält aus Sicherheitsgründen keine Zugangscodes.
            Für einen neuen Code bitte den Zugang gezielt zurücksetzen.
          </p>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
            disabled={filteredAccesses.length === 0}
            onClick={openPrintSelection}
          >
            <Printer className="mr-2 h-4 w-4" />
            Zugangsblätter drucken (PDF)
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter className="h-4 w-4 text-blue-700" />
            Sortieren &amp; Filtern
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="planning-access-filter-year">Jahr</Label>
              <Select
                value={filterYear}
                onValueChange={value => {
                  setFilterYear(value);
                  setFilterEventId(ALL_EVENTS);
                }}
              >
                <SelectTrigger id="planning-access-filter-year" className="bg-white">
                  <SelectValue placeholder="Alle Jahre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_YEARS}>Alle Jahre</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planning-access-filter-event">Veranstaltung</Label>
              <Select
                value={filterEventId}
                onValueChange={value => {
                  setFilterEventId(value);
                  if (value !== ALL_EVENTS) {
                    const selected = eventById.get(Number(value));
                    if (selected) setFilterYear(String(selected.year));
                  }
                }}
              >
                <SelectTrigger id="planning-access-filter-event" className="bg-white">
                  <SelectValue placeholder="Alle Veranstaltungen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_EVENTS}>Alle Veranstaltungen</SelectItem>
                  {filteredEventChoices.map(event => (
                    <SelectItem key={event.id} value={String(event.id)}>
                      {event.year} · {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            {filteredAccesses.length} Ansprechpartnerzugang
            {filteredAccesses.length === 1 ? "" : "e"} sichtbar
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Vorhandene Zugänge
          </div>
          {accesses.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Zugänge werden geladen …
            </div>
          ) : filteredAccesses.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Für die gewählte Filterkombination sind keine Ansprechpartnerzugänge vorhanden.
            </p>
          ) : (
            <ul className="divide-y">
              {filteredAccesses.map(access => (
                <li key={access.id} className="grid gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {access.contactName ?? access.label}
                      </p>
                      {access.email && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                          ✉ {access.email}
                        </span>
                      )}
                      {access.mustChangePassword ? (
                        <Badge className="border border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100">
                          ⏳ Initialcode offen
                        </Badge>
                      ) : (
                        <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          ✓ Passwort eingerichtet
                        </Badge>
                      )}
                      {access.isTenantAdmin && (
                        <Badge className="border-2 border-red-500 bg-red-50 font-semibold text-red-900 hover:bg-red-50">
                          <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                          Co-Admin
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {access.isTenantAdmin
                        ? "Volle Verwaltungsrechte im eigenen Verein · keine Masterrechte"
                        : "Ansprechpartner-Zugang"}
                    </p>
                    {!access.isTenantAdmin && (!access.modulePermissions || access.modulePermissions.length === 0) ? (
                      <div className="mt-1">
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                          Nur lesen (keine Bearbeitungsrechte)
                        </span>
                      </div>
                    ) : (
                      access.modulePermissions && access.modulePermissions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {access.modulePermissions.map(m => (
                            <span key={m} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              {PLANNING_MODULE_META[m]?.label ?? m}
                            </span>
                          ))}
                        </div>
                      )
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEvents(access) || "Keine Freigaben"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 w-full justify-start whitespace-normal px-3 py-2 text-left leading-4"
                      disabled={access.isTenantAdmin && !isPrimaryTenantAdmin}
                      onClick={() => editAccess(access)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Bearbeiten
                    </Button>
                    {access.email && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto min-h-9 w-full justify-start whitespace-normal border-blue-200 px-3 py-2 text-left leading-4 text-blue-800 hover:bg-blue-50 hover:text-blue-900"
                          disabled={access.isTenantAdmin && !isPrimaryTenantAdmin}
                          onClick={() => {
                            setSendLinkTarget(access);
                            setSendLinkPassword("");
                          }}
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Aktivierungslink senden
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                      className="h-auto min-h-9 w-full justify-start whitespace-normal border-amber-200 px-3 py-2 text-left leading-4 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
                      disabled={access.isTenantAdmin && !isPrimaryTenantAdmin}
                      onClick={() => {
                        setResetTarget({ id: access.id, label: access.contactName ?? access.label });
                        setResetPassword("");
                      }}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Passwort zurücksetzen &amp; Zugangsblatt drucken
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 w-full justify-start whitespace-normal border-red-200 px-3 py-2 text-left leading-4 text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={access.isTenantAdmin && !isPrimaryTenantAdmin}
                      onClick={() => setDeleteTarget({ id: access.id, label: access.label })}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Löschen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="create-access"
          className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/30 shadow-sm"
        >
          <AccordionTrigger className="px-4 py-3 text-base font-semibold text-blue-950 hover:no-underline">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-700" />
              Neuen Zugang anlegen
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-blue-100 px-4 pb-4">
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-blue-950">
                {form.id === null ? "Neuen Zugang anlegen" : "Zugang bearbeiten"}
              </h3>
              <p className="text-xs text-slate-600">
                {form.id === null
                  ? "Der Zugangscode wird sicher erzeugt und ausschließlich im sofort heruntergeladenen Einmal-Zugangsblatt ausgegeben."
                  : "Freigabeänderungen melden die bestehende Sitzung ab. Ein Passwortwechsel erfolgt getrennt mit einem neuen Einmal-Zugangsblatt."}
              </p>
            </div>
            {form.id !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(EMPTY_FORM)} disabled={busy}>
                Abbrechen
              </Button>
            )}
          </div>

          <div className="grid gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="planning-access-contact">Ansprechpartner</Label>
              <Select
                value={form.contactId?.toString() ?? "unlinked"}
                disabled={busy || availableContacts.isLoading}
                onValueChange={value => {
                  if (value === "unlinked") {
                    setForm(current => ({ ...current, contactId: null }));
                    return;
                  }
                  const contact = contactChoices.find(item => item.id === Number(value));
                  if (!contact) return;
                  setForm(current => ({
                    ...current,
                    contactId: contact.id,
                    label: contact.name,
                    email: contact.email ? contact.email : current.email,
                  }));
                }}
              >
                <SelectTrigger id="planning-access-contact" className="bg-white">
                  <SelectValue placeholder="Ansprechpartner auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {form.id !== null && (
                    <SelectItem value="unlinked">
                      Ohne Ansprechpartner-Verknüpfung (Altbestand)
                    </SelectItem>
                  )}
                  {contactChoices.map(contact => (
                    <SelectItem key={contact.id} value={String(contact.id)}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-600">
                {selectedContact
                  ? `Dieser Zugang wird als „${selectedContact.name}“ angemeldet.`
                  : form.id === null
                    ? "Für einen neuen Zugang bitte einen Ansprechpartner auswählen."
                    : "Altbestand ohne Ansprechpartner-Verknüpfung."}
              </p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="planning-access-email">
                Persönliche E-Mail-Adresse (für individuellen Login, optional)
              </Label>
              <Input
                id="planning-access-email"
                type="email"
                placeholder="z. B. vorname.nachname@verein.de"
                value={form.email}
                disabled={busy}
                onChange={e => setForm(curr => ({ ...curr, email: e.target.value }))}
                className="bg-white"
              />
              <p className="text-xs text-slate-600">
                Ermöglicht dem Ansprechpartner die persönliche Anmeldung mit E-Mail und individuellem Passwort.
              </p>
            </div>
          </div>

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-slate-900">
              Zulässige Fachbereiche (Berechtigungen)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {EDITABLE_PLANNING_MODULES.map(module => {
                const meta = PLANNING_MODULE_META[module];
                const isChecked = form.modulePermissions.includes(module);
                return (
                  <label
                    key={module}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-white bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-colors hover:border-blue-300"
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={busy || form.isTenantAdmin}
                      onCheckedChange={checked => {
                        setForm(curr => ({
                          ...curr,
                          modulePermissions: checked === true
                            ? Array.from(new Set([...curr.modulePermissions, module]))
                            : curr.modulePermissions.filter(m => m !== module),
                        }));
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900">{meta.label}</span>
                      <p className="text-xs text-slate-500">{meta.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {form.modulePermissions.length === 0 && !form.isTenantAdmin && (
              <aside
                data-slot="readonly-access-explanation"
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-900"
              >
                <p className="font-semibold">Ohne Auswahl: reiner Lesezugriff</p>
                <p className="mt-0.5">
                  Dieser Zugang kann die freigegebene Veranstaltung vollständig ansehen und im Team-Chat lesen sowie schreiben, darf aber keine Planungsdaten, Einstellungen oder Zugänge bearbeiten.
                </p>
              </aside>
            )}
          </fieldset>

          {isPrimaryTenantAdmin && (
            <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-50 p-3 text-sm text-red-950 shadow-sm">
              <div className="flex items-start gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 transition-colors hover:text-red-950">
                  <Checkbox
                    checked={form.isTenantAdmin}
                    disabled={busy}
                    onCheckedChange={checked => {
                      const isTenantAdmin = checked === true;
                      setForm(current => ({
                        ...current,
                        isTenantAdmin,
                        modulePermissions: isTenantAdmin
                          ? [...EDITABLE_PLANNING_MODULES]
                          : current.modulePermissions,
                        eventIds: isTenantAdmin
                          ? (availableEvents.data ?? []).map(event => event.id)
                          : current.eventIds,
                      }));
                    }}
                    className="mt-0.5 border-red-500 data-[state=checked]:bg-red-600"
                  />
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-red-900">
                      <ShieldAlert className="h-4 w-4" />
                      Co-Admin
                    </span>
                    <p className="mt-1 text-xs leading-5 text-red-800">
                      Volle Rechte innerhalb dieses Vereins – einschließlich Löschen,
                      Ansprechpartnern und Fachrechten. Keine Plattform- oder Masterrechte;
                      weitere Co-Admins dürfen nicht vergeben, geändert oder gelöscht werden.
                    </p>
                  </div>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Unterschiede zwischen Hauptadministrator und Co-Admin erklären"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-300 bg-white text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                    >
                      <Info className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className="max-w-sm bg-slate-950 px-3 py-3 text-left text-xs leading-5 text-white">
                    <p className="font-semibold text-white">Rollen im eigenen Verein</p>
                    <p className="mt-1 text-slate-200">
                      <strong>Hauptadministrator:</strong> volle Vereinsverwaltung sowie Co-Admins ernennen, ändern, zurücksetzen und entziehen. Globale Schutz- und Systemfunktionen bleiben ausschließlich hier.
                    </p>
                    <p className="mt-2 text-slate-200">
                      <strong>Co-Admin:</strong> volle Arbeit an Vereinsdaten, Fachbereichen und normalen Planungsteamzugängen. Keine Masterportal-, Plattform- oder globalen Schutzrechte und keine Verwaltung anderer Co-Admins.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-slate-900">Freigegebene Veranstaltungen</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableEvents.isLoading ? (
                <p className="text-sm text-muted-foreground">Veranstaltungen werden geladen …</p>
              ) : (availableEvents.data ?? []).map(event => {
                const checked = form.eventIds.includes(event.id);
                return (
                  <label
                    key={event.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-white bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-colors hover:border-blue-300"
                  >
                    <Checkbox checked={checked} disabled={busy || form.isTenantAdmin} onCheckedChange={value => toggleEvent(event.id, value === true)} />
                    <span className="min-w-0">
                      <span className="font-medium">{event.year}</span> · {event.name}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedEvents.length === 0 && (
              <p className="text-xs text-red-700">Bitte mindestens eine Veranstaltung freigeben.</p>
            )}
            {form.isTenantAdmin && (
              <p className="text-xs font-medium text-red-800">
                Als Co-Admin gelten alle vorhandenen und künftig angelegten Veranstaltungen dieses Vereins.
              </p>
            )}
          </fieldset>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="planning-access-admin-password">Administratorpasswort bestätigen</Label>
            <Input
              id="planning-access-admin-password"
              type="password"
              autoComplete="current-password"
              value={form.currentAdminPassword}
              placeholder="Zur sicheren Speicherung eingeben"
              disabled={busy}
              onChange={event => setForm(current => ({ ...current, currentAdminPassword: event.target.value }))}
            />
          </div>
          {form.id === null && form.email.trim() && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={sendEmailInvite}
                onCheckedChange={checked => setSendEmailInvite(checked === true)}
              />
              <span>Aktivierungs-E-Mail direkt automatisch an <strong>{form.email.trim()}</strong> senden</span>
            </label>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {form.id === null ? (
              <>
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!valid || !form.email.trim() || busy || createWithInvitationLink.isPending}
                  onClick={() => {
                    if (!valid || !form.contactId || !form.email.trim()) return;
                    createWithInvitationLink.mutate({
                      label: form.label.trim(),
                      contactId: form.contactId,
                      email: form.email.trim(),
                      modulePermissions: form.modulePermissions,
                      isTenantAdmin: form.isTenantAdmin,
                      eventIds: effectiveEventIds,
                      sendEmail: sendEmailInvite,
                      currentAdminPassword: form.currentAdminPassword,
                    });
                  }}
                >
                  {createWithInvitationLink.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Zugang anlegen &amp; Aktivierungslink {sendEmailInvite ? "senden" : "erzeugen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!valid || busy}
                  onClick={save}
                >
                  {createAccess.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Zugang anlegen &amp; Zugangsblatt drucken (Offline-Weg)
                </Button>
              </>
            ) : (
              <Button type="button" disabled={!valid || busy} onClick={save}>
                {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Zugang speichern
              </Button>
            )}
          </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white sm:max-w-lg">
          <form className="space-y-4" onSubmit={submitPrintSelection}>
            <DialogHeader>
              <DialogTitle>Zugangsblätter drucken – Personenauswahl</DialogTitle>
              <DialogDescription>
                Wählen Sie die Ansprechpartner aus, deren reguläres Zugangsblatt ohne Klartextpasswort gedruckt werden soll.
              </DialogDescription>
            </DialogHeader>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950">
              <Checkbox
                checked={allPrintTargetsSelected}
                onCheckedChange={checked =>
                  setSelectedPrintAccessIds(
                    checked === true ? filteredAccesses.map(access => access.id) : []
                  )
                }
              />
              <CheckSquare className="h-4 w-4 text-blue-700" />
              Alle auswählen ({filteredAccesses.length})
            </label>
            <div className="max-h-72 divide-y overflow-y-auto rounded-md border border-slate-200">
              {filteredAccesses.map(access => (
                <label
                  key={access.id}
                  className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm hover:bg-slate-50"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedPrintAccessIds.includes(access.id)}
                    onCheckedChange={checked => togglePrintAccess(access.id, checked === true)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">
                      {access.contactName ?? access.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {formatEvents(access)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter className="flex flex-row flex-wrap justify-end gap-3 sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => setPrintDialogOpen(false)} disabled={accessSheets.isPending}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={accessSheets.isPending || selectedPrintAccessIds.length === 0}>
                {accessSheets.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {selectedPrintAccessIds.length} Zugangsblatt
                {selectedPrintAccessIds.length === 1 ? "" : "blätter"} drucken
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open && !deleteAccess.isPending) {
            setDeleteTarget(null);
            setDeletePassword("");
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md !overflow-x-hidden overflow-y-auto bg-white">
          <form className="min-w-0 space-y-4" onSubmit={submitDelete}>
            <DialogHeader>
              <DialogTitle className="min-w-0 break-words pr-8">
                Planungsteam-Zugang löschen
              </DialogTitle>
              <DialogDescription className="break-words">
                Der Zugang „{deleteTarget?.label}“ wird dauerhaft entfernt. Alle dazugehörigen Sitzungen verlieren sofort ihren Zugriff.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="planning-access-delete-password">Administratorpasswort</Label>
              <Input
                id="planning-access-delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                className="w-full max-w-full"
                disabled={deleteAccess.isPending}
                onChange={event => setDeletePassword(event.target.value)}
              />
            </div>
            <DialogFooter className="!mt-4 !flex !flex-col-reverse !gap-3 sm:!flex-row sm:!items-center sm:!justify-end sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 whitespace-nowrap border-slate-300 bg-white text-slate-900 shadow-sm sm:w-auto"
                disabled={deleteAccess.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                Abbrechen
              </Button>
              <button
                type="submit"
                className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm opacity-100 transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                disabled={!deleteTarget || !deletePassword || deleteAccess.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {deleteAccess.isPending
                  ? "Wird gelöscht …"
                  : "Zugangsdaten löschen"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={open => {
          if (!open && !resetAndPrint.isPending) {
            setResetTarget(null);
            setResetPassword("");
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <form className="space-y-4" onSubmit={submitReset}>
            <DialogHeader>
              <DialogTitle>Passwort zurücksetzen &amp; Zugangsblatt drucken</DialogTitle>
              <DialogDescription>
                Für „{resetTarget?.label}“ wird ein neuer Zugangscode erzeugt. Bestehende Sitzungen verlieren sofort ihren Zugriff. Der Klartextcode erscheint nur im direkt heruntergeladenen PDF.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="planning-access-reset-password">Administratorpasswort</Label>
              <Input
                id="planning-access-reset-password"
                type="password"
                autoComplete="current-password"
                value={resetPassword}
                disabled={resetAndPrint.isPending}
                onChange={event => setResetPassword(event.target.value)}
              />
            </div>
            <DialogFooter className="flex flex-row flex-nowrap items-center justify-end gap-3 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                disabled={resetAndPrint.isPending}
                onClick={() => setResetTarget(null)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="shrink-0 whitespace-nowrap bg-amber-600 text-white hover:bg-amber-700"
                disabled={!resetTarget || !resetPassword || resetAndPrint.isPending}
              >
                {resetAndPrint.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Neues Passwort &amp; PDF erzeugen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(issuedInvitation)} onOpenChange={open => !open && setIssuedInvitation(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <Link2 className="h-5 w-5 text-blue-600" />
              Aktivierungslink für {issuedInvitation?.label}
            </DialogTitle>
            <DialogDescription>
              {issuedInvitation?.emailSent
                ? `Die Einladung wurde vom Mailserver für ${issuedInvitation?.email} angenommen. Bitte bei Bedarf auch den Spam-Ordner prüfen.`
                : `Der Einladungslink wurde erstellt, aber nicht an den Mailserver übergeben. Sie können ihn kopieren und direkt an ${issuedInvitation?.email} weiterleiten.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">Persönlicher Aktivierungslink (48 Stunden gültig):</p>
              <p className="mt-1 break-all font-mono text-xs text-blue-900 select-all">
                {issuedInvitation?.activationUrl}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (issuedInvitation?.activationUrl) {
                  navigator.clipboard.writeText(issuedInvitation.activationUrl);
                  toast.success("Aktivierungslink in die Zwischenablage kopiert");
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Link kopieren
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setIssuedInvitation(null)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sendLinkTarget)} onOpenChange={open => !open && setSendLinkTarget(null)}>
        <DialogContent className="max-w-md bg-white">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!sendLinkTarget || !sendLinkPassword || sendInvitationLink.isPending) return;
              sendInvitationLink.mutate({
                id: sendLinkTarget.id,
                currentAdminPassword: sendLinkPassword,
                sendEmail: true,
              });
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-900">
                <Send className="h-5 w-5 text-blue-600" />
                Aktivierungslink senden
              </DialogTitle>
              <DialogDescription>
                Einen neuen 48-Stunden-Aktivierungslink an <strong>{sendLinkTarget?.email}</strong> ausstellen. Bisherige Einladungslinks werden ungültig.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="send-link-admin-password">Administratorpasswort bestätigen</Label>
              <Input
                id="send-link-admin-password"
                type="password"
                autoComplete="current-password"
                value={sendLinkPassword}
                placeholder="Passwort eingeben"
                disabled={sendInvitationLink.isPending}
                onChange={e => setSendLinkPassword(e.target.value)}
              />
            </div>
            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSendLinkTarget(null)}
                disabled={sendInvitationLink.isPending}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!sendLinkPassword || sendInvitationLink.isPending}
              >
                {sendInvitationLink.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Link per E-Mail senden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
