import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { startLogin } from "@/const";
import { useEventYear } from "@/contexts/YearContext";
import { NAV } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import {
  Bike,
  CalendarRange,
  KeyRound,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const RSC_LOGO = "/manus-storage/rsc-eifelland-logo_ee4e2325.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { year, eventId, selectYear, selectEvent } = useEventYear();
  const [location] = useLocation();
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"user" | "admin">("user");
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newYear, setNewYear] = useState(year + 1);
  const [newEventName, setNewEventName] = useState("");
  const utils = trpc.useUtils();

  const passwordStatus = trpc.auth.passwordStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const years = trpc.years.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const events = trpc.events.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const selectedEvent = events.data?.find(item => item.id === eventId);

  useEffect(() => {
    if (!events.data?.length || selectedEvent) return;
    selectEvent(events.data[0].id);
  }, [events.data, selectEvent, selectedEvent]);
  const finishLogin = async () => {
    setPassword("");
    await utils.auth.me.invalidate();
    toast.success("Anmeldung erfolgreich");
  };
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: finishLogin,
    onError: error => toast.error(error.message),
  });
  const adminPasswordLogin = trpc.auth.adminPasswordLogin.useMutation({
    onSuccess: finishLogin,
    onError: error => toast.error(error.message),
  });
  const createYear = trpc.years.create.useMutation({
    onSuccess: async () => {
      await utils.years.list.invalidate();
      setYearDialogOpen(false);
      selectYear(newYear);
    },
    onError: error => toast.error(error.message),
  });
  const createEvent = trpc.events.create.useMutation({
    onSuccess: async result => {
      await utils.events.list.invalidate();
      setEventDialogOpen(false);
      setNewEventName("");
      selectEvent(result.id);
    },
    onError: error => toast.error(error.message),
  });

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    if (loginMode === "admin") adminPasswordLogin.mutate({ password });
    else passwordLogin.mutate({ password });
  };
  const loginEnabled =
    loginMode === "admin"
      ? passwordStatus.data?.adminEnabled
      : passwordStatus.data?.enabled;
  const loginPending = passwordLogin.isPending || adminPasswordLogin.isPending;

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Lade …
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.97_0.02_250)] to-[oklch(0.92_0.04_240)] p-4">
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl p-8 w-full max-w-md">
          <img
            src={RSC_LOGO}
            alt="RSC Eifelland e. V."
            className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white object-contain shadow-sm"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">RSC Helferplanung</h1>
            <p className="text-muted-foreground mb-6">
              Geschützte Helfer-Planung für Organisatoren
            </p>
          </div>

          <div className="grid grid-cols-2 rounded-lg bg-muted p-1 mb-4">
            <Button
              type="button"
              size="sm"
              variant={loginMode === "user" ? "default" : "ghost"}
              onClick={() => {
                setLoginMode("user");
                setPassword("");
              }}
            >
              Planungsteam
            </Button>
            <Button
              type="button"
              size="sm"
              variant={loginMode === "admin" ? "default" : "ghost"}
              onClick={() => {
                setLoginMode("admin");
                setPassword("");
              }}
            >
              Administrator
            </Button>
          </div>

          <form className="space-y-3" onSubmit={submitPassword}>
            <Label htmlFor="planning-password">
              {loginMode === "admin"
                ? "Administratorpasswort"
                : "Zugangspasswort"}
            </Label>
            <Input
              id="planning-password"
              type="password"
              autoComplete="current-password"
              placeholder="Passwort eingeben"
              value={password}
              onChange={event => setPassword(event.target.value)}
              disabled={!loginEnabled || loginPending}
            />
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={!password || !loginEnabled || loginPending}
            >
              {loginMode === "admin" ? (
                <ShieldCheck className="mr-2 h-4 w-4" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {loginPending
                ? "Wird geprüft …"
                : loginMode === "admin"
                  ? "Als Administrator anmelden"
                  : "Mit Passwort anmelden"}
            </Button>
            {passwordStatus.data && !loginEnabled && (
              <p className="text-xs text-destructive">
                Dieser Passwortzugang ist noch nicht eingerichtet.
              </p>
            )}
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            Hauptadministrator
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => startLogin()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Mit Manus anmelden
          </Button>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Nach fünf Fehlversuchen wird der jeweilige Zugang für 15 Minuten
            gesperrt.
          </p>
        </div>
      </div>
    );
  }
  if (
    events.isLoading ||
    (events.data !== undefined && events.data.length > 0 && !selectedEvent)
  ) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Veranstaltung wird geladen …
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-white px-3 shadow-sm dark:bg-slate-950 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label="Navigation öffnen"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">RSC Helferplanung</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {selectedEvent?.name ?? `Veranstaltung ${year}`}
            </div>
          </div>
          <img
            src={RSC_LOGO}
            alt="RSC Eifelland"
            className="h-8 w-8 shrink-0 rounded-full bg-white object-contain"
          />
        </div>
        <Select
          value={String(year)}
          onValueChange={value => selectYear(Number(value))}
        >
          <SelectTrigger className="h-9 w-24 bg-white font-semibold dark:bg-slate-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(years.data?.length
              ? years.data
              : [{ year, label: `MyEifelRide ${year}` }]
            ).map(item => (
              <SelectItem key={item.year} value={String(item.year)}>
                {item.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-xs gap-0 p-0">
          <SheetHeader className="border-b text-left">
            <SheetTitle className="flex items-center gap-2">
              <span>RSC Helferplanung</span>
              <img
                src={RSC_LOGO}
                alt="RSC Eifelland"
                className="h-9 w-9 rounded-full bg-white object-contain"
              />
            </SheetTitle>
            <SheetDescription>
              Planung {year} ·{" "}
              {user?.role === "admin" ? "Administrator" : "Planungsteam"}
            </SheetDescription>
          </SheetHeader>
          <div className="border-b p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" /> Veranstaltungsjahr
              </Label>
              {user?.role === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Weiteres Jahr anlegen"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setYearDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={String(year)}
              onValueChange={value => {
                selectYear(Number(value));
                setMobileMenuOpen(false);
              }}
            >
              <SelectTrigger className="w-full bg-white font-semibold dark:bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(years.data?.length
                  ? years.data
                  : [{ year, label: `MyEifelRide ${year}` }]
                ).map(item => (
                  <SelectItem key={item.year} value={String(item.year)}>
                    {item.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mb-1.5 mt-3 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Veranstaltung
              </Label>
              {user?.role === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Veranstaltung anlegen"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setEventDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={
                events.data?.some(item => item.id === eventId)
                  ? String(eventId)
                  : undefined
              }
              onValueChange={value => {
                selectEvent(Number(value));
                setMobileMenuOpen(false);
              }}
            >
              <SelectTrigger className="w-full bg-white font-semibold dark:bg-slate-900">
                <SelectValue placeholder="Veranstaltung wählen" />
              </SelectTrigger>
              <SelectContent>
                {events.data?.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {NAV.filter(item => !item.adminOnly || user?.role === "admin").map(
              ({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${location === href ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  <Icon className="h-5 w-5" /> {label}
                </Link>
              )
            )}
          </nav>
          <div className="border-t p-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Abmelden
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="h-16 flex items-center gap-2 px-4 border-b">
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-tight">RSC Helferplanung</div>
            <div className="truncate text-xs text-muted-foreground">
              Vereinsorganisation
            </div>
          </div>
          <img
            src={RSC_LOGO}
            alt="RSC Eifelland e. V."
            className="h-10 w-10 rounded-full bg-white object-contain"
          />
        </div>

        <div className="border-b p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Veranstaltungsjahr
            </Label>
            {user?.role === "admin" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Weiteres Jahr anlegen"
                onClick={() => setYearDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={String(year)}
            onValueChange={value => selectYear(Number(value))}
          >
            <SelectTrigger className="w-full bg-background font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(years.data?.length
                ? years.data
                : [{ year, label: `MyEifelRide ${year}` }]
              ).map(item => (
                <SelectItem key={item.year} value={String(item.year)}>
                  {item.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mb-1.5 mt-3 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Veranstaltung
            </Label>
            {user?.role === "admin" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Veranstaltung anlegen"
                onClick={() => setEventDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={
              events.data?.some(item => item.id === eventId)
                ? String(eventId)
                : undefined
            }
            onValueChange={value => selectEvent(Number(value))}
          >
            <SelectTrigger className="w-full bg-background font-semibold">
              <SelectValue placeholder="Veranstaltung wählen" />
            </SelectTrigger>
            <SelectContent>
              {events.data?.map(item => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.filter(item => !item.adminOnly || user?.role === "admin").map(
            ({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            }
          )}
        </nav>
        <div className="border-t p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground">
              {user?.role === "admin" ? "Administrator" : "Bearbeiter"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Abmelden"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div
          className={
            location === "/helfer"
              ? "w-full p-3 sm:p-4 xl:p-6"
              : "w-full max-w-[1400px] p-3 sm:p-4 lg:p-6"
          }
        >
          <div className="mb-5 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {selectedEvent?.name ?? "Veranstaltung"} · Planung {year}
          </div>
          {children}
        </div>
      </main>

      <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Weiteres Veranstaltungsjahr anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-event-year">Jahr</Label>
            <Input
              id="new-event-year"
              type="number"
              min={2020}
              max={2100}
              value={newYear}
              onChange={event => setNewYear(Number(event.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Das neue Jahr startet leer. Den Einsatzplan können Sie
              anschließend aus einem Vorjahr übernehmen.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                !Number.isInteger(newYear) || newYear < 2020 || newYear > 2100
              }
              onClick={() => createYear.mutate({ year: newYear })}
            >
              Jahr anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle>Veranstaltung für {year} anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-event-name">Name der Veranstaltung</Label>
            <Input
              id="new-event-name"
              value={newEventName}
              placeholder="z. B. Cross-Veranstaltung"
              onChange={event => setNewEventName(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && newEventName.trim().length >= 2) {
                  createEvent.mutate({ name: newEventName });
                }
              }}
            />
            <p className="text-sm text-muted-foreground">
              Die neue Veranstaltung erhält im Jahr {year} einen vollständig
              eigenen Datenbestand.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={newEventName.trim().length < 2 || createEvent.isPending}
              onClick={() => createEvent.mutate({ name: newEventName })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Veranstaltung anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
