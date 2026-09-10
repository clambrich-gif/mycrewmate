import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/const";
import { NAV } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import { Bike, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const passwordStatus = trpc.auth.passwordStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: async () => {
      setPassword("");
      await utils.auth.me.invalidate();
      toast.success("Anmeldung erfolgreich");
    },
    onError: error => toast.error(error.message),
  });

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    passwordLogin.mutate({ password });
  };

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

          <form className="space-y-3" onSubmit={submitPassword}>
            <label className="text-sm font-medium" htmlFor="planning-password">
              Zugangspasswort
            </label>
            <Input
              id="planning-password"
              type="password"
              autoComplete="current-password"
              placeholder="Passwort eingeben"
              value={password}
              onChange={event => setPassword(event.target.value)}
              disabled={
                !passwordStatus.data?.enabled || passwordLogin.isPending
              }
            />
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={
                !password ||
                !passwordStatus.data?.enabled ||
                passwordLogin.isPending
              }
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {passwordLogin.isPending
                ? "Wird geprüft …"
                : "Mit Passwort anmelden"}
            </Button>
            {passwordStatus.data && !passwordStatus.data.enabled && (
              <p className="text-xs text-destructive">
                Der Passwortzugang ist noch nicht eingerichtet.
              </p>
            )}
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            oder
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => startLogin()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Administrator-Anmeldung
          </Button>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Nach fünf Fehlversuchen wird der Zugang für 15 Minuten gesperrt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b">
          <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold leading-tight">MyEifelRide</div>
            <div className="text-xs text-muted-foreground">Helfer-Planung</div>
          </div>
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
        <div className="p-6 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
