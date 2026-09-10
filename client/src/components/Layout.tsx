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
import { startLogin } from "@/const";
import { useEventYear } from "@/contexts/YearContext";
import { NAV } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import {
  Bike,
  CalendarRange,
  KeyRound,
  LogOut,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { year, selectYear } = useEventYear();
  const [location] = useLocation();
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"user" | "admin">("user");
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [newYear, setNewYear] = useState(year + 1);
  const utils = trpc.useUtils();

  const passwordStatus = trpc.auth.passwordStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const years = trpc.years.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
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
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary grid place-items-center">
            <Bike className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">MyEifelRide</h1>
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

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b">
          <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold leading-tight">MyEifelRide</div>
            <div className="text-xs text-muted-foreground">Helfer-Planung</div>
          </div>
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
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 max-w-[1400px]">
          <div className="mb-5 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            Planung {year}
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
    </div>
  );
}
