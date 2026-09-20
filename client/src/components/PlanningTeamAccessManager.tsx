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
import { trpc } from "@/lib/trpc";
import { KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type FormState = {
  id: number | null;
  label: string;
  password: string;
  confirmation: string;
  eventIds: number[];
  currentAdminPassword: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  label: "",
  password: "",
  confirmation: "",
  eventIds: [],
  currentAdminPassword: "",
};

export function PlanningTeamAccessManager() {
  const utils = trpc.useUtils();
  const accesses = trpc.planningTeamAccesses.list.useQuery();
  const availableEvents = trpc.planningTeamAccesses.availableEvents.useQuery();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");

  const eventById = useMemo(
    () => new Map((availableEvents.data ?? []).map(event => [event.id, event])),
    [availableEvents.data]
  );
  const selectedEvents = form.eventIds
    .map(eventId => eventById.get(eventId))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const passwordIsRequired = form.id === null;
  const passwordMatches = form.password === form.confirmation;
  const valid =
    form.label.trim().length >= 2 &&
    form.eventIds.length > 0 &&
    Boolean(form.currentAdminPassword) &&
    (!passwordIsRequired || form.password.length >= 10) &&
    (!form.password || form.password.length >= 10) &&
    passwordMatches;

  const invalidate = async () => {
    await Promise.all([
      utils.planningTeamAccesses.list.invalidate(),
      utils.auth.passwordStatus.invalidate(),
    ]);
  };
  const createAccess = trpc.planningTeamAccesses.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setForm(EMPTY_FORM);
      toast.success("Planungsteam-Zugang angelegt");
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

  const save = () => {
    if (!valid) return;
    const input = {
      label: form.label.trim(),
      eventIds: form.eventIds,
      currentAdminPassword: form.currentAdminPassword,
      ...(form.password ? { password: form.password } : {}),
    };
    if (form.id === null) {
      createAccess.mutate({ ...input, password: form.password });
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

  const editAccess = (access: NonNullable<typeof accesses.data>[number]) => {
    setForm({
      id: access.id,
      label: access.label,
      password: "",
      confirmation: "",
      eventIds: access.eventIds,
      currentAdminPassword: "",
    });
  };

  const busy = createAccess.isPending || updateAccess.isPending;

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
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Vorhandene Zugänge
          </div>
          {accesses.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Zugänge werden geladen …
            </div>
          ) : (accesses.data?.length ?? 0) === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Noch kein Planungsteam-Zugang angelegt.
            </p>
          ) : (
            <ul className="divide-y">
              {accesses.data?.map(access => (
                <li key={access.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{access.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {access.eventIds.length === 0
                        ? "Keine Freigaben"
                        : access.eventIds
                            .map(eventId => {
                              const event = eventById.get(eventId);
                              return event ? `${event.year} · ${event.name}` : `Event #${eventId}`;
                            })
                            .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editAccess(access)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Bearbeiten
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
                  ? "Passwort und mindestens eine Veranstaltung sind erforderlich."
                  : "Ein neues Passwort ist optional; Freigabeänderungen melden die bestehende Sitzung ab."}
              </p>
            </div>
            {form.id !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(EMPTY_FORM)} disabled={busy}>
                Abbrechen
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="planning-access-label">Bezeichnung</Label>
              <Input
                id="planning-access-label"
                value={form.label}
                maxLength={120}
                placeholder="z. B. EifelRide Team 2027"
                disabled={busy}
                onChange={event => setForm(current => ({ ...current, label: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planning-access-password">
                {form.id === null ? "Passwort" : "Neues Passwort (optional)"}
              </Label>
              <Input
                id="planning-access-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                placeholder="Mindestens 10 Zeichen"
                disabled={busy}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planning-access-password-confirmation">Passwort bestätigen</Label>
              <Input
                id="planning-access-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={form.confirmation}
                disabled={busy}
                onChange={event => setForm(current => ({ ...current, confirmation: event.target.value }))}
              />
              {form.confirmation && !passwordMatches && (
                <p className="text-xs font-medium text-red-700">Die Passwörter stimmen nicht überein.</p>
              )}
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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open && !deleteAccess.isPending) {
            setDeleteTarget(null);
            setDeletePassword("");
          }
        }}
      >
        <DialogContent>
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
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleteAccess.isPending} onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteTarget || !deletePassword || deleteAccess.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteAccess.mutate({ id: deleteTarget.id, currentAdminPassword: deletePassword });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteAccess.isPending ? "Wird gelöscht …" : "Zugang löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
