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
import { trpc } from "@/lib/trpc";
import { storePreviewSessionToken } from "@/lib/preview-session";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { FormEvent, useState } from "react";

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
  const overview = trpc.platformAdmin.tenantOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (loading) return <PortalLoading />;
  if (!isAuthenticated) return <MasterLogin />;
  if (user?.role !== "admin" || overview.error?.data?.code === "FORBIDDEN") {
    return <AccessDenied onLogout={logout} />;
  }
  if (overview.isLoading) return <PortalLoading />;
  if (overview.error) {
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
  const pilotCount = tenants.filter(tenant => tenant.status === "pilot").length;
  const eventCount = tenants.reduce((sum, tenant) => sum + tenant.eventCount, 0);

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
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs text-slate-500 sm:block">
              Angemeldet als<br />
              <strong className="font-semibold text-slate-700">{user?.name ?? "Plattform-Inhaber"}</strong>
            </span>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" /> Abmelden
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Plattformkennzahlen">
          <Card className="border-blue-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Building2 className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{tenants.length}</p><p className="mt-1 text-sm text-slate-600">Vereine angelegt</p></div>
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
              <CardDescription>Lesende Übersicht – Änderungen folgen erst in den nächsten, separat abgesicherten Ausbauschritten.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 px-5 sm:px-6">
              {tenants.map(tenant => {
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
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left sm:min-w-48 sm:text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nächste Veranstaltung</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800">{tenant.nextEvent?.name ?? "Noch nicht angelegt"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{tenant.nextEvent ? formatDate(tenant.nextEvent.startDate) : "Termin offen"}</p>
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
                <p>Dieses Portal ist lesend; keine versehentliche Bearbeitung oder Freischaltung möglich.</p>
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
    </main>
  );
}
