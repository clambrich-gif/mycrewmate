import { useAuth } from "@/_core/hooks/useAuth";
import { PageTitle } from "@/components/PageTitle";
import { PlanningTeamAccessManager } from "@/components/PlanningTeamAccessManager";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ProtocolLog } from "@/pages/Permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  FileText,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

function SecurityAccordion({
  title,
  description,
  icon: Icon,
  tone = "slate",
  children,
}: {
  title: string;
  description: string;
  icon: typeof KeyRound;
  tone?: "slate" | "blue" | "red" | "amber";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toneClasses = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50/35",
    red: "border-red-200 bg-red-50/40",
    amber: "border-amber-200 bg-amber-50/35",
  }[tone];
  const iconClasses = {
    slate: "text-slate-600",
    blue: "text-blue-700",
    red: "text-red-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn("overflow-hidden shadow-sm", toneClasses)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <Icon className={cn("h-5 w-5 shrink-0", iconClasses)} />
                {title}
              </span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-100 data-[state=closed]:animate-none">
          <CardContent className="space-y-4 pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PasswordEditor({
  enabled,
  onSave,
  saving,
}: {
  enabled: boolean;
  onSave: (input: { password: string; currentAdminPassword: string }) => void;
  saving: boolean;
}) {
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const matches = password === confirmation;
  const valid = Boolean(currentAdminPassword) && password.length >= 10 && matches;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {enabled
          ? "Vergibt ein neues Administratorpasswort. Die aktuelle Eingabe ist als Sicherheitsbestätigung erforderlich."
          : "Richtet erstmals ein Administratorpasswort für diese Planung ein."}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="security-current-admin-password">
          Aktuelles Administratorpasswort
        </Label>
        <Input
          id="security-current-admin-password"
          type="password"
          autoComplete="current-password"
          value={currentAdminPassword}
          onChange={event => setCurrentAdminPassword(event.target.value)}
          placeholder="Zur Bestätigung eingeben"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="security-new-admin-password">Neues Passwort</Label>
          <Input
            id="security-new-admin-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 10 Zeichen"
            disabled={!currentAdminPassword || saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="security-confirm-admin-password">
            Neues Passwort bestätigen
          </Label>
          <Input
            id="security-confirm-admin-password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            placeholder="Passwort wiederholen"
            disabled={!currentAdminPassword || saving}
          />
          {confirmation && !matches && (
            <p className="text-xs text-destructive">Die Passwörter stimmen nicht überein.</p>
          )}
        </div>
      </div>
      <Button
        disabled={!valid || saving}
        onClick={() => {
          onSave({ password, currentAdminPassword });
          setCurrentAdminPassword("");
          setPassword("");
          setConfirmation("");
        }}
      >
        {saving ? "Wird gespeichert …" : "Administratorpasswort speichern"}
      </Button>
    </div>
  );
}

export default function Security() {
  const { user } = useAuth();
  const { year } = useEventYear();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const { data: status, isLoading: statusLoading } =
    trpc.auth.passwordStatus.useQuery(undefined, {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    });
  const securityActivities = trpc.audit.activities.useQuery(
    { limit: 100 },
    { enabled: isAdmin }
  );
  const setAdminPassword = trpc.auth.setAdminPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      toast.success("Administratorpasswort wurde geändert");
    },
    onError: error => toast.error(error.message),
  });
  const unlockPlanningTeam = trpc.auth.unlockPlanningTeamLock.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auth.passwordStatus.invalidate(),
        utils.audit.activities.invalidate(),
      ]);
      toast.success("Globaler Notfall-Stopp für das Planungsteam wurde aufgehoben");
    },
    onError: error => toast.error(error.message),
  });
  const lockPlanningTeam = trpc.auth.lockPlanningTeam.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auth.passwordStatus.invalidate(),
        utils.audit.activities.invalidate(),
      ]);
      toast.success("Globaler Notfall-Stopp für alle Planungsteam-Zugänge wurde aktiviert");
    },
    onError: error => toast.error(error.message),
  });
  const securityLogEntries = (securityActivities.data ?? []).filter(
    entry => entry.module === "Zugangsschutz"
  );

  if (!isAdmin) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-8 text-center text-muted-foreground">
          Diese Seite ist ausschließlich für Administratoren verfügbar.
        </CardContent>
      </Card>
    );
  }

  const lockBusy = lockPlanningTeam.isPending || unlockPlanningTeam.isPending;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <PageTitle icon="security">Schutz &amp; Protokoll</PageTitle>
        <p className="text-muted-foreground">
          Zugänge, Passwörter, Notfallmaßnahmen und alle Systemprotokolle sicher verwalten.
        </p>
      </div>

      <div className="space-y-4" data-security-accordions>
        <SecurityAccordion
          title="Administratorpasswort neu vergeben"
          description="Administratorpasswort einrichten oder sicher ändern."
          icon={KeyRound}
          tone="amber"
        >
          <PasswordEditor
            enabled={Boolean(status?.adminEnabled)}
            saving={setAdminPassword.isPending}
            onSave={input => setAdminPassword.mutate(input)}
          />
        </SecurityAccordion>

        <SecurityAccordion
          title="Planungsteam-Zugänge verwalten"
          description="Ansprechpartnerzugänge, Eventfreigaben, Initialcodes und Zugangsblätter verwalten."
          icon={UsersRound}
          tone="blue"
        >
          <PlanningTeamAccessManager />
        </SecurityAccordion>

        <SecurityAccordion
          title="Notfall-Sperrstatus Planungsteam (Global)"
          description="Sperrt bei einem Sicherheitsvorfall sofort alle Planungsteam-Logins und offenen Sitzungen."
          icon={ShieldAlert}
          tone="red"
        >
          <div className="space-y-4" aria-live="polite">
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                statusLoading
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : status?.planningTeamLocked
                    ? "border-red-300 bg-red-50 text-red-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
              )}
            >
              <p className="font-semibold">
                {statusLoading
                  ? "Sperrstatus wird geladen …"
                  : status?.planningTeamLocked
                    ? "Notfall-Stopp ist aktiv: Planungsteam-Zugänge sind global gesperrt."
                    : "Notfall-Stopp ist inaktiv: Planungsteam-Zugänge sind freigegeben."}
              </p>
              <p className="mt-1 text-xs opacity-80">
                Bei Aktivierung verlieren auch bereits angemeldete Planungsteam-Sitzungen den Zugriff und müssen nach der Freigabe erneut angemeldet werden.
              </p>
            </div>
            <Button
              type="button"
              variant={status?.planningTeamLocked ? "destructive" : "outline"}
              className={cn(
                "w-full sm:w-auto",
                status?.planningTeamLocked
                  ? "!bg-emerald-600 !text-white hover:!bg-emerald-700"
                  : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-900"
              )}
              disabled={statusLoading || lockBusy}
              onClick={() => {
                if (status?.planningTeamLocked) {
                  unlockPlanningTeam.mutate();
                } else {
                  lockPlanningTeam.mutate();
                }
              }}
            >
              {lockBusy ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : status?.planningTeamLocked ? (
                <Unlock className="mr-2 h-4 w-4" />
              ) : (
                <LockKeyhole className="mr-2 h-4 w-4" />
              )}
              {status?.planningTeamLocked
                ? "Globalen Notfall-Stopp aufheben"
                : "Globaler Notfall-Stopp: Alle Planungsteam-Zugänge sperren"}
            </Button>
          </div>
        </SecurityAccordion>

        <SecurityAccordion
          title="Sicherheitsprotokoll / Logbuch"
          description="Nachvollziehbarer Verlauf der aktivierten und aufgehobenen globalen Notfall-Sperren."
          icon={FileText}
          tone="slate"
        >
          {securityActivities.isLoading ? (
            <p className="text-sm text-muted-foreground">Sicherheitsprotokoll wird geladen …</p>
          ) : securityActivities.error ? (
            <p className="text-sm text-destructive">{securityActivities.error.message}</p>
          ) : securityLogEntries.length ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="divide-y">
                {securityLogEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{entry.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Ausgeführt von {entry.actorName} · {entry.actorRole === "admin" ? "Administrator" : "Planungsteam"}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("de-DE")}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Es wurden noch keine globalen Notfall-Sperren protokolliert.
            </p>
          )}
        </SecurityAccordion>

        <SecurityAccordion
          title="Protokoll"
          description="Aktivitätsverlauf, Löschungen und gezielte Wiederherstellungen aller Planungsbereiche."
          icon={FileText}
          tone="slate"
        >
          <ProtocolLog />
        </SecurityAccordion>

        <SecurityAccordion
          title={`Gefahrenbereich (Planung ${year})`}
          description="Unwiderrufliche Löschung aller Planungsdaten des aktuell gewählten Jahres."
          icon={ShieldAlert}
          tone="red"
        >
          <div className="space-y-4">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <ShieldAlert className="h-5 w-5" /> Gefahrenbereich – Planung {year}
          </div>
          <p className="text-sm text-muted-foreground">
            Löscht alle Ansprechpartner, Helfer, Schichten, Zuordnungen, Aufgaben,
            Materialien, Kuchen- und Finanzdaten des aktuell gewählten Jahres.
            Andere Veranstaltungsjahre und die Passwörter bleiben erhalten.
          </p>
            <ResetAreaButton area="all" label={`Alle Planungsdaten ${year}`} />
          </div>
        </SecurityAccordion>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
        Administrator- und Planungsteam-Passwörter werden ausschließlich als
        bcrypt-Hash gespeichert. Jeder Planungsteam-Zugang besitzt eigene
        Eventfreigaben; Änderungen oder Löschungen beenden dessen bestehende
        Sitzungen. Nach fünf Fehlversuchen greift für den anfragenden Anschluss
        eine progressive Abklingzeit gegen DoS-Angriffe. Die Manus-Anmeldung des
        Hauptadministrators bleibt erhalten.
      </div>
    </div>
  );
}
