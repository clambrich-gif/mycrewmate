import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import {
  CheckSquare,
  FileDown,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type FormState = {
  id: number | null;
  contactId: number | null;
  label: string;
  eventIds: number[];
  currentAdminPassword: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  contactId: null,
  label: "",
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
  eventIds: number[];
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
  const utils = trpc.useUtils();
  const accesses = trpc.planningTeamAccesses.list.useQuery();
  const availableContacts = trpc.planningTeamAccesses.availableContacts.useQuery();
  const availableEvents = trpc.planningTeamAccesses.availableEvents.useQuery();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterYear, setFilterYear] = useState(ALL_YEARS);
  const [filterEventId, setFilterEventId] = useState(ALL_EVENTS);
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
  const valid =
    form.label.trim().length >= 2 &&
    (form.id !== null || form.contactId !== null) &&
    form.eventIds.length > 0 &&
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
      eventIds: form.eventIds,
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
      eventIds: access.eventIds,
      currentAdminPassword: "",
    });
  };
  const formatEvents = (access: AccessSummary) =>
    access.eventIds
      .map(eventId => {
        const event = eventById.get(eventId);
        return event ? `${event.year} · ${event.name}` : `Event #${eventId}`;
      })
      .join(" · ");
  const busy =
    createAccess.isPending || updateAccess.isPending || resetAndPrint.isPending;

  return (
    <Card className="border-blue-200 shadow-sm" data-planning-team-access-manager>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base text-blue-950">
          <ShieldCheck className="h-5 w-5 text-blue-700" />
          Planungsteam-Zugänge verwalten
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Jeder Zugang erhält ein eigenes Passwort und darf nur die hier markierten
          Veranstaltungen sehen und bearbeiten. Die Freigabe wird zusätzlich auf
          dem Server geprüft.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
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
                <li key={access.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {access.contactName ?? access.label}
                      </p>
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Passwort aktiv
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Ansprechpartner-Zugang</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEvents(access) || "Keine Freigaben"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editAccess(access)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-amber-200 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
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
                      className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
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

        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
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
          </div>

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
                    <Checkbox checked={checked} disabled={busy} onCheckedChange={value => toggleEvent(event.id, value === true)} />
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
          <Button type="button" className="mt-4" disabled={!valid || busy} onClick={save}>
            {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {form.id === null ? "Zugang anlegen" : "Zugang speichern"}
          </Button>
        </div>
      </CardContent>

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
        <DialogContent className="w-[calc(100%-2rem)] max-w-md !overflow-visible">
          <form className="space-y-4" onSubmit={submitDelete}>
            <DialogHeader>
              <DialogTitle>Planungsteam-Zugang löschen</DialogTitle>
              <DialogDescription>
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
                disabled={deleteAccess.isPending}
                onChange={event => setDeletePassword(event.target.value)}
              />
            </div>
            <DialogFooter className="!mt-4 !flex !flex-row !flex-nowrap !items-center !justify-end !gap-3 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                className="shrink-0 whitespace-nowrap border-slate-300 bg-white text-slate-900 shadow-sm"
                disabled={deleteAccess.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                Abbrechen
              </Button>
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm opacity-100 visible transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                disabled={!deleteTarget || !deletePassword || deleteAccess.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {deleteAccess.isPending
                  ? "Wird gelöscht …"
                  : "Zugangsdaten dauerhaft löschen"}
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
    </Card>
  );
}
