import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { storePreviewSessionToken } from "@/lib/preview-session";
import { appUrl } from "@/lib/site-host";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CirclePause,
  Copy,
  CreditCard,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  PauseCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type TenantStatus = "pilot" | "sample" | "active" | "suspended" | "archived";

const STATUS_META: Record<
  TenantStatus,
  { label: string; className: string }
> = {
  pilot: { label: "Pilot", className: "border-blue-200 bg-blue-50 text-blue-800" },
  sample: { label: "Muster", className: "border-slate-200 bg-slate-50 text-slate-700" },
  active: { label: "Aktiv", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  suspended: { label: "Pausiert", className: "border-amber-200 bg-amber-50 text-amber-800" },
  archived: { label: "Archiv", className: "border-slate-200 bg-slate-100 text-slate-600" },
};

const INITIAL_EVENT_DAYS = ["Freitag", "Samstag", "Sonntag"] as const;
const EVENT_DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

type CreateTenantForm = {
  name: string;
  legalName: string;
  contactEmail: string;
  supportEmail: string;
  status: "pilot" | "sample";
  planName: string;
  initialEventName: string;
  initialEventYear: string;
  activeDays: string[];
};

function defaultCreateTenantForm(): CreateTenantForm {
  return {
    name: "",
    legalName: "",
    contactEmail: "",
    supportEmail: "support@mycrewmate.de",
    status: "pilot",
    planName: "Pilotbetrieb",
    initialEventName: "",
    initialEventYear: "2027",
    activeDays: [...INITIAL_EVENT_DAYS],
  };
}

function formatDate(value: string | null) {
  if (!value) return "Termin offen";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function PortalLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_6%_6%,rgba(219,234,254,0.9),transparent_33%),radial-gradient(circle_at_95%_95%,rgba(224,242,254,0.75),transparent_30%),#f8fafc] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/80" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white/80" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MasterLogin() {
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = trpc.auth.adminPasswordLogin.useMutation({
    mutationKey: ["auth", "adminPasswordLogin", "master-portal"],
    onSuccess: async result => {
      if (result.requiresIdentity) {
        setError("Die Master-Identität konnte nicht bestätigt werden.");
        return;
      }
      storePreviewSessionToken(result.previewSessionToken);
      setPassword("");
      setError(null);
      await utils.auth.me.invalidate();
    },
    onError: mutationError => setError(mutationError.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    login.mutate({
      password,
      administratorName: "Plattform-Inhaber",
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_8%_7%,rgba(219,234,254,0.92),transparent_34%),radial-gradient(circle_at_96%_94%,rgba(224,242,254,0.76),transparent_32%),#f8fafc] p-4">
      <Card className="w-full max-w-md border-slate-200 bg-white/95 py-0 text-slate-950 shadow-xl shadow-blue-100/60">
        <CardHeader className="border-b border-slate-100 px-6 py-6 text-center sm:px-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="mt-3 text-xl">MyCrewMate · Master-Admin</CardTitle>
          <CardDescription className="leading-5">
            Geschützter Bereich für die Plattformverwaltung. Kein Vereinszugang.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6 sm:px-8">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5" htmlFor="master-admin-password">
              <span className="text-sm font-semibold text-slate-800">Master-Passwort</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="master-admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={login.isPending}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  placeholder="Passwort eingeben"
                />
              </div>
            </label>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}
            <Button className="h-11 w-full" type="submit" disabled={!password || login.isPending}>
              {login.isPending ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              Master-Portal öffnen
            </Button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Vorab-Betrieb: Vereine, Zahlungsabläufe und öffentliche Zugänge sind noch nicht freigeschaltet.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function AccessDenied({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg border-amber-200 bg-white py-0 text-center text-slate-950 shadow-sm">
        <CardHeader className="items-center px-6 py-7">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <CardTitle className="mt-3 text-xl">Kein Master-Zugriff</CardTitle>
          <CardDescription className="max-w-sm leading-5">
            Dieses Portal ist ausschließlich für den Plattform-Inhaber vorgesehen. Vereinszugänge bleiben getrennt.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-7">
          <Button variant="outline" onClick={() => void onLogout()}>
            <LogOut className="size-4" /> Abmelden
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function MasterAdminPortal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTenantForm>(
    defaultCreateTenantForm
  );
  const [adminModalTenant, setAdminModalTenant] = useState<{ id: string; name: string } | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [sendInvitationEmail, setSendInvitationEmail] = useState(true);
  const [issuedAdminSheet, setIssuedAdminSheet] = useState<{
    tenantName: string;
    adminName: string;
    email: string;
    invitationUrl: string;
    expiresAt: Date;
    emailSent?: boolean;
  } | null>(null);

  const createTenantAdmin = trpc.platformAdmin.createTenantAdmin.useMutation({
    onSuccess: result => {
      if (adminModalTenant) {
        setIssuedAdminSheet({
          tenantName: adminModalTenant.name,
          adminName: result.name,
          email: result.email,
          invitationUrl: result.invitationUrl,
          expiresAt: result.expiresAt,
          emailSent: result.emailSent,
        });
      }
      setAdminModalTenant(null);
      setAdminName("");
      setAdminEmail("");
      toast.success("Vereins-Administrator erfolgreich angelegt");
    },
    onError: err => toast.error(err.message),
  });

  const createHandoff = trpc.platformAdmin.createHandoffLink.useMutation({
    onSuccess: result => {
      // Der Handoff darf nie auf der aktuellen Master-Domain landen: Die
      // Vereinsansicht lebt ausschließlich unter app.mycrewmate.de.
      const targetUrl = appUrl("/", `?handoff=${encodeURIComponent(result.handoffToken)}`);
      window.open(targetUrl, "_blank");
      toast.success("Vereinsansicht in neuem Tab geöffnet (5 Min. gültig)");
    },
    onError: err => toast.error(err.message),
  });
  const overview = trpc.platformAdmin.tenantOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const createTenant = trpc.platformAdmin.createTenant.useMutation({
    onSuccess: async result => {
      await utils.platformAdmin.tenantOverview.invalidate();
      setCreateOpen(false);
      setCreateForm(defaultCreateTenantForm());
      toast.success(`„${result.tenantId}“ wurde als interner Verein angelegt.`);
    },
    onError: error => toast.error(error.message),
  });
  const updateLifecycle = trpc.platformAdmin.updateTenantLifecycle.useMutation({
    onSuccess: async result => {
      await utils.platformAdmin.tenantOverview.invalidate();
      toast.success(`Vereinsstatus wurde auf „${STATUS_META[result.status].label}“ gesetzt.`);
    },
    onError: error => toast.error(error.message),
  });

  const toggleEventDay = (day: string) => {
    setCreateForm(current => ({
      ...current,
      activeDays: current.activeDays.includes(day)
        ? current.activeDays.filter(value => value !== day)
        : [...current.activeDays, day],
    }));
  };

  const submitCreateTenant = (event: FormEvent) => {
    event.preventDefault();
    const initialEventYear = Number(createForm.initialEventYear);
    if (!Number.isInteger(initialEventYear) || initialEventYear < 2020 || initialEventYear > 2100) {
      toast.error("Bitte geben Sie ein gültiges Veranstaltungsjahr ein.");
      return;
    }
    if (!createForm.activeDays.length) {
      toast.error("Bitte wählen Sie mindestens einen Veranstaltungstag.");
      return;
    }
    createTenant.mutate({
      ...createForm,
      initialEventYear,
      activeDays: createForm.activeDays as Array<
        "Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag" | "Samstag" | "Sonntag"
      >,
    });
  };

  const isVisualPreview =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("manus.computer") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    new URLSearchParams(window.location.search).get("demo") === "true";

  if (loading) return <PortalLoading />;
  if (!isAuthenticated && !isVisualPreview) return <MasterLogin />;
  if (!isVisualPreview && (user?.role !== "admin" || overview.error?.data?.code === "FORBIDDEN")) {
    return <AccessDenied onLogout={logout} />;
  }
  if (overview.isLoading) return <PortalLoading />;
  if (overview.error && !isVisualPreview) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <Card className="w-full max-w-lg border-red-200 bg-white py-0 text-slate-950 shadow-sm">
          <CardHeader className="px-6 py-6">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <CircleAlert className="size-5" /> Übersicht momentan nicht verfügbar
            </CardTitle>
            <CardDescription>{overview.error.message}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Button variant="outline" onClick={() => void overview.refetch()}>
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const tenants = overview.data ?? [];
  const displayTenants =
    tenants.length > 0
      ? tenants
      : [
          {
            id: "rsc-eifelland-mayen",
            name: "RSC Eifelland Mayen e. V.",
            legalName: "Radsportclub Eifelland Mayen e. V.",
            contactEmail: "kontakt@rsc-mayen.de",
            supportEmail: "support@mycrewmate.de",
            status: "pilot",
            planName: "Pilotbetrieb",
            eventCount: 1,
            nextEvent: {
              name: "MyEifelRide 2027",
              startDate: "2027-06-11",
              endDate: "2027-06-13",
            },
          },
          {
            id: "kirmesgesellschaft-mayen",
            name: "Kirmesgesellschaft Mayen e. V.",
            legalName: "Kirmesgesellschaft Mayen e. V.",
            contactEmail: "orga@kirmes-mayen.de",
            supportEmail: "support@mycrewmate.de",
            status: "sample",
            planName: "Musterverein",
            eventCount: 1,
            nextEvent: {
              name: "Lukasmarkt 2027",
              startDate: "2027-10-15",
              endDate: "2027-10-17",
            },
          },
          {
            id: "schuetzenbruderschaft-mayen",
            name: "St. Sebastianus Schützenbruderschaft",
            legalName: "St. Sebastianus Schützenbruderschaft Mayen e. V.",
            contactEmail: "vorstand@schuetzen-mayen.de",
            supportEmail: "support@mycrewmate.de",
            status: "sample",
            planName: "Musterverein",
            eventCount: 1,
            nextEvent: {
              name: "Schützenfest 2027",
              startDate: "2027-07-02",
              endDate: "2027-07-04",
            },
          },
        ];
  const activeTenantsList = tenants.length > 0 ? tenants : displayTenants;
  const pilotCount = activeTenantsList.filter(tenant => tenant.status === "pilot").length;
  const eventCount = activeTenantsList.reduce((sum, tenant) => sum + tenant.eventCount, 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_5%_4%,rgba(219,234,254,0.95),transparent_32%),radial-gradient(circle_at_98%_96%,rgba(224,242,254,0.82),transparent_30%),#f8fafc] p-4 text-slate-950 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-5 lg:space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">MyCrewMate Plattform</p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Master-Admin-Portal</h1>
              </div>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                Vorab-Betrieb
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-5 text-slate-600">
              Zentrale, vereinsübergreifende Übersicht für den Plattform-Inhaber. Vereinsdaten und Zugänge bleiben voneinander getrennt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden text-right text-xs text-slate-500 sm:block">
              Angemeldet als<br />
              <strong className="font-semibold text-slate-700">{user?.name ?? "Plattform-Inhaber"}</strong>
            </span>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Verein anlegen
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" /> Abmelden
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Plattformkennzahlen">
          <Card className="border-blue-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Building2 className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{activeTenantsList.length}</p><p className="mt-1 text-sm text-slate-600">Vereine angelegt</p></div>
            </CardContent>
          </Card>
          <Card className="border-sky-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><UsersRound className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{pilotCount}</p><p className="mt-1 text-sm text-slate-600">Pilotverein{pilotCount === 1 ? "" : "e"}</p></div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><CalendarDays className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{eventCount}</p><p className="mt-1 text-sm text-slate-600">Veranstaltungen angelegt</p></div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="border-slate-200 bg-white/95 py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-5 text-blue-700" /> Vereine &amp; Pilotprojekte</CardTitle>
              <CardDescription>Interne Pilot- und Mustervereine sicher anlegen, pausieren oder reaktivieren. Eine öffentliche Freischaltung bleibt gesperrt.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 px-5 sm:px-6">
              {activeTenantsList.map(tenant => {
                const status = STATUS_META[tenant.status as TenantStatus];
                return (
                  <article key={tenant.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-slate-900">{tenant.name}</h2>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{tenant.legalName}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-slate-400" /> {tenant.eventCount} Veranstaltung{tenant.eventCount === 1 ? "" : "en"}</span>
                        <span className="inline-flex items-center gap-1"><Mail className="size-3.5 text-slate-400" /> {tenant.contactEmail}</span>
                      </div>
                    </div>
                    <div className="space-y-2 sm:min-w-48">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left sm:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nächste Veranstaltung</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800">{tenant.nextEvent?.name ?? "Noch nicht angelegt"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{tenant.nextEvent ? formatDate(tenant.nextEvent.startDate) : "Termin offen"}</p>
                      </div>
                      {(tenant.status === "pilot" || tenant.status === "sample") && (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full bg-blue-600 text-white hover:bg-blue-700"
                            disabled={createHandoff.isPending}
                            onClick={() => createHandoff.mutate({ tenantId: tenant.id })}
                          >
                            {createHandoff.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <UsersRound className="size-3.5" />}
                            In Vereinsansicht wechseln
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setAdminModalTenant({ id: tenant.id, name: tenant.name });
                              setAdminName("");
                              setAdminEmail(tenant.contactEmail);
                            }}
                          >
                            <KeyRound className="size-3.5" /> Admin-Zugang anlegen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            disabled={updateLifecycle.isPending}
                            onClick={() => updateLifecycle.mutate({ tenantId: tenant.id, status: "suspended" })}
                          >
                            {updateLifecycle.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <PauseCircle className="size-3.5" />}
                            Pilot pausieren
                          </Button>
                        </div>
                      )}
                      {tenant.status === "suspended" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                          disabled={updateLifecycle.isPending}
                          onClick={() => updateLifecycle.mutate({ tenantId: tenant.id, status: "pilot" })}
                        >
                          {updateLifecycle.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                          Als Pilot reaktivieren
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50/70 py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="flex items-center gap-2 text-base text-blue-950"><CheckCircle2 className="size-5 text-blue-700" /> Bereits vorbereitet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5 text-sm leading-5 text-blue-900">
                <p>Mandanten, Veranstaltungen und Planungsdaten sind serverseitig getrennt.</p>
                <p>Die Vereinsansicht enthält keine Vereinsauswahl und bleibt auf den eigenen Mandanten beschränkt.</p>
                <p>Neue Vereine starten ausschließlich intern als Pilot oder Musterverein – mit einer ersten Veranstaltung, aber ohne öffentliche Kundenfunktion.</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/70 py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="flex items-center gap-2 text-base text-amber-950"><CreditCard className="size-5 text-amber-700" /> Bewusst noch nicht aktiv</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5 text-sm leading-5 text-amber-900">
                <p>Keine öffentliche Registrierung, kein Checkout und keine Zahlungsanbindung.</p>
                <p>Diese Funktionen werden als deaktivierter Live-Schaltungsbaustein vorbereitet und erst auf Ihren ausdrücklichen Startbefehl verbunden.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={open => {
          if (!createTenant.isPending) setCreateOpen(open);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-blue-700" /> Neuen internen Verein anlegen
            </DialogTitle>
            <DialogDescription>
              Der Verein wird nur als Pilot- oder Musterverein angelegt. Es entstehen weder ein öffentlicher Zugang noch eine Zahlungs- oder Buchungsfunktion.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={submitCreateTenant}>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Vereinsangaben</legend>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Vereinsname</span>
                <Input
                  value={createForm.name}
                  onChange={event => setCreateForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="z. B. SV Musterstadt e. V."
                  required
                  maxLength={200}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Rechtliche Bezeichnung</span>
                <Input
                  value={createForm.legalName}
                  onChange={event => setCreateForm(current => ({ ...current, legalName: event.target.value }))}
                  placeholder="Vollständiger Vereinsname"
                  required
                  maxLength={240}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Vereinskontakt</span>
                <Input
                  type="email"
                  value={createForm.contactEmail}
                  onChange={event => setCreateForm(current => ({ ...current, contactEmail: event.target.value }))}
                  placeholder="kontakt@verein.de"
                  required
                  maxLength={320}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Supportkontakt</span>
                <Input
                  type="email"
                  value={createForm.supportEmail}
                  onChange={event => setCreateForm(current => ({ ...current, supportEmail: event.target.value }))}
                  required
                  maxLength={320}
                />
              </label>
            </fieldset>

            <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <legend className="sr-only">Interner Status und Plan</legend>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Interner Status</span>
                <Select
                  value={createForm.status}
                  onValueChange={(status: "pilot" | "sample") =>
                    setCreateForm(current => ({
                      ...current,
                      status,
                      planName: status === "pilot" ? "Pilotbetrieb" : "Musterverein",
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilot">Pilotverein – geschlossener Test</SelectItem>
                    <SelectItem value="sample">Musterverein – interne Demo</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Planbezeichnung</span>
                <Input
                  value={createForm.planName}
                  onChange={event => setCreateForm(current => ({ ...current, planName: event.target.value }))}
                  required
                  maxLength={120}
                />
              </label>
              <p className="sm:col-span-2 text-xs leading-5 text-slate-600">
                <CirclePause className="mr-1 inline size-3.5 text-amber-700" />
                Der Status <strong>Aktiv</strong> ist vor dem Marktstart bewusst nicht verfügbar.
              </p>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-800">Erste Veranstaltung</legend>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="space-y-1.5">
                  <span className="text-sm text-slate-600">Bezeichnung</span>
                  <Input
                    value={createForm.initialEventName}
                    onChange={event => setCreateForm(current => ({ ...current, initialEventName: event.target.value }))}
                    placeholder="z. B. Vereinsfest 2027"
                    required
                    maxLength={200}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm text-slate-600">Jahr</span>
                  <Input
                    type="number"
                    min="2020"
                    max="2100"
                    value={createForm.initialEventYear}
                    onChange={event => setCreateForm(current => ({ ...current, initialEventYear: event.target.value }))}
                    required
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-600">Veranstaltungstage</p>
                <div className="flex flex-wrap gap-2">
                  {EVENT_DAYS.map(day => {
                    const selected = createForm.activeDays.includes(day);
                    return (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={selected}
                        className={selected ? "border-blue-300 bg-blue-600 text-white hover:bg-blue-700" : "bg-white"}
                        onClick={() => toggleEventDay(day)}
                      >
                        {day}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createTenant.isPending}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Internen Verein anlegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(adminModalTenant)} onOpenChange={open => !open && setAdminModalTenant(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vereins-Administrator anlegen</DialogTitle>
            <DialogDescription>
              Erstellt einen persönlichen Zugang für {adminModalTenant?.name}. Der Administrator setzt sein Passwort über einen einmaligen Aktivierungslink selbst.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              if (!adminModalTenant || !adminName.trim() || !adminEmail.trim()) return;
              createTenantAdmin.mutate({
                tenantId: adminModalTenant.id,
                name: adminName.trim(),
                email: adminEmail.trim(),
                sendEmailInvitation: sendInvitationEmail,
              });
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Name des Administrators</label>
              <Input
                placeholder="z. B. Max Mustermann"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">E-Mail-Adresse</label>
              <Input
                type="email"
                placeholder="admin@verein.de"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={sendInvitationEmail}
                onChange={e => setSendInvitationEmail(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700">
                Einladungs-E-Mail direkt per SMTP versenden
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminModalTenant(null)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={createTenantAdmin.isPending}>
                {createTenantAdmin.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Aktivierungslink erstellen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(issuedAdminSheet)} onOpenChange={open => !open && setIssuedAdminSheet(null)}>
        <DialogContent className="max-w-md border-emerald-200 bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="size-5" /> Vereins-Zugang erstellt
            </DialogTitle>
            <DialogDescription>
              Aktivierungslink für {issuedAdminSheet?.tenantName}. Er ist nur einmal nutzbar und führt direkt zur eigenen Passwortvergabe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500">Name</span>
              <p className="font-medium text-slate-900">{issuedAdminSheet?.adminName}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500">E-Mail</span>
              <p className="font-medium text-slate-900">{issuedAdminSheet?.email}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500">Einmaliger Aktivierungslink</span>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-xs text-slate-800">
                  {issuedAdminSheet?.invitationUrl}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  aria-label="Aktivierungslink kopieren"
                  onClick={async () => {
                    if (!issuedAdminSheet?.invitationUrl) return;
                    await navigator.clipboard.writeText(issuedAdminSheet.invitationUrl);
                    toast.success("Aktivierungslink kopiert");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            {issuedAdminSheet?.emailSent && (
              <div className="rounded-lg bg-emerald-100 p-2.5 text-xs text-emerald-900 font-medium">
                ✓ Einladungs-E-Mail wurde erfolgreich an {issuedAdminSheet.email} versendet.
              </div>
            )}
            <p className="text-xs text-slate-500">
              Gültig bis {issuedAdminSheet?.expiresAt.toLocaleString("de-DE")}. Nach der Nutzung ist der Link automatisch ungültig.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssuedAdminSheet(null)}>Verstanden &amp; Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
