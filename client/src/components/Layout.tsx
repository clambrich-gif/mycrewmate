import { useAuth } from "@/_core/hooks/useAuth";
import { NAV } from "@/lib/nav";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Bike } from "lucide-react";
import { startLogin } from "@/const";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Lade …</div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.97_0.02_250)] to-[oklch(0.92_0.04_240)]">
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary grid place-items-center">
            <Bike className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-1">MyEifelRide</h1>
          <p className="text-muted-foreground mb-6">Zentrale Helfer-Planung für Organisatoren</p>
          <Button className="w-full" size="lg" onClick={() => startLogin()}>Anmelden</Button>
          <p className="text-xs text-muted-foreground mt-4">Zugriff nur für eingeladene Organisatoren.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b">
          <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center"><Bike className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <div className="font-bold leading-tight">MyEifelRide</div>
            <div className="text-xs text-muted-foreground">Helfer-Planung</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
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
          })}
        </nav>
        <div className="border-t p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrator" : "Bearbeiter"}</div>
          </div>
          <Button variant="ghost" size="icon" title="Abmelden" onClick={() => logout()}><LogOut className="h-4 w-4" /></Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
