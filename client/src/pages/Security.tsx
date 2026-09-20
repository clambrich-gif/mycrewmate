import { useAuth } from "@/_core/hooks/useAuth";
import { PageTitle } from "@/components/PageTitle";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Unlock,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function PasswordEditor({
  title,
  description,
  enabled,
  onSave,
  saving,
}: {
  title: string;
  description: string;
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
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-5 w-5 text-primary" />
          {title} {enabled ? "aktiv" : "nicht eingerichtet"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="space-y-1.5">
          <Label>Aktuelles Administratorpasswort</Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentAdminPassword}
            onChange={event => setCurrentAdminPassword(event.target.value)}
            placeholder="Zur Bestätigung eingeben"
          />
          <p className="text-xs text-muted-foreground">
            Die Eingabe ist vor jeder Passwortänderung zwingend erforderlich.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Neues Passwort</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 10 Zeichen"
            disabled={!currentAdminPassword || saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Passwort bestätigen</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            disabled={!currentAdminPassword || saving}
          />
          {confirmation && !matches && (
            <p className="text-xs text-destructive">
              Die Passwörter stimmen nicht überein.
            </p>
          )}
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
          {saving ? "Wird gespeichert …" : "Passwort ändern"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Security() {
  const { user } = useAuth();
  const { year } = useEventYear();
  const utils = trpc.useUtils();
  const { data: status, isLoading: statusLoading } =
    trpc.auth.passwordStatus.useQuery(undefined, {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    });
  const setPassword = trpc.auth.setPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      toast.success("Zugangspasswort wurde geändert");
    },
    onError: error => toast.error(error.message),
  });
  const setAdminPassword = trpc.auth.setAdminPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      toast.success("Administratorpasswort wurde geändert");
    },
    onError: error => toast.error(error.message),
  });
  const unlockPlanningTeam = trpc.auth.unlockPlanningTeamLock.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      toast.success("Sperre für das Planungsteam wurde aufgehoben");
    },
    onError: error => toast.error(error.message),
  });
  const lockPlanningTeam = trpc.auth.lockPlanningTeam.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      toast.success("Planungsteam-Zugang wurde manuell gesperrt");
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-8 text-center text-muted-foreground">
          Diese Seite ist ausschließlich für Administratoren verfügbar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <PageTitle icon="security">Zugangsschutz & Administration</PageTitle>
        <p className="text-muted-foreground">
          Getrennte Zugänge verwalten und Planungsdaten des gewählten Jahres
          absichern.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <PasswordEditor
          title="Passwort Planungsteam"
          description="Erlaubt die normale Bearbeitung der Planung ohne administrative Lösch- und Sicherheitsrechte."
          enabled={Boolean(status?.enabled)}
          saving={setPassword.isPending}
          onSave={input => setPassword.mutate(input)}
        />
        <PasswordEditor
          title="Administratorpasswort"
          description="Erteilt weiteren Personen Administratorrechte und bestätigt Zurücksetzungen sowie sensible Löschungen."
          enabled={Boolean(status?.adminEnabled)}
          saving={setAdminPassword.isPending}
          onSave={input => setAdminPassword.mutate(input)}
        />
      </div>

      <Card
        className={
          statusLoading
            ? "border-slate-200 bg-slate-50 shadow-sm"
            : status?.planningTeamLocked
            ? "border-red-300 bg-red-50/70 shadow-sm"
            : "border-emerald-200 bg-emerald-50/60 shadow-sm"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole
              className={
                statusLoading
                  ? "h-5 w-5 text-slate-500"
                  : status?.planningTeamLocked
                  ? "h-5 w-5 text-red-700"
                  : "h-5 w-5 text-emerald-700"
              }
            />
            Sperrstatus Planungsteam
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div aria-live="polite">
            {statusLoading ? (
              <p className="font-semibold text-slate-700">
                Sperrstatus wird geladen …
              </p>
            ) : status?.planningTeamLocked ? (
              <p className="font-semibold text-red-800">
                Der Passwortzugang für das Planungsteam ist derzeit gesperrt.
              </p>
            ) : (
              <p className="font-semibold text-emerald-800">
                Der Passwortzugang für das Planungsteam ist nicht gesperrt.
              </p>
            )}
            <p className="mt-1 text-sm text-slate-600">
              Fehlversuche unterliegen einer automatischen zeitbasierten Abklingzeit (DoS-Schutz).
              Zusätzlich können Administratoren den Zugang hier bei Bedarf gezielt manuell sperren oder freigeben.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {status?.planningTeamLocked ? (
              <Button
                type="button"
                variant="destructive"
                className="border border-red-700 !bg-red-600 !text-white shadow-sm hover:!bg-red-700 disabled:!border-red-300 disabled:!bg-red-100 disabled:!text-red-800 disabled:opacity-100"
                disabled={statusLoading || unlockPlanningTeam.isPending}
                onClick={() => unlockPlanningTeam.mutate()}
              >
                {unlockPlanningTeam.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlock className="mr-2 h-4 w-4" />
                )}
                {unlockPlanningTeam.isPending
                  ? "Sperre wird aufgehoben …"
                  : "Sperre für Planungsteam aufheben"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={statusLoading || lockPlanningTeam.isPending}
                onClick={() => lockPlanningTeam.mutate()}
              >
                {lockPlanningTeam.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LockKeyhole className="mr-2 h-4 w-4" />
                )}
                {lockPlanningTeam.isPending
                  ? "Wird gesperrt …"
                  : "Planungsteam manuell sperren"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <UserCog className="h-5 w-5" /> Gefahrenbereich – Planung {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Löscht alle Ansprechpartner, Helfer, Schichten, Zuordnungen,
            Aufgaben, Materialien, Kuchen- und Finanzdaten des aktuell gewählten
            Jahres. Andere
            Veranstaltungsjahre und die Passwörter bleiben erhalten.
          </p>
          <ResetAreaButton area="all" label={`Alle Planungsdaten ${year}`} />
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
        Beide Passwörter werden ausschließlich als bcrypt-Hash gespeichert. Nach
        fünf Fehlversuchen greift für den anfragenden Anschluss eine progressive
        Abklingzeit gegen DoS-Angriffe. Die Administrator-Sperre läuft weiterhin nach 15 Minuten ab;
        Sitzungen gelten zwölf Stunden. Die Manus-Anmeldung des
        Hauptadministrators bleibt erhalten.
      </div>
    </div>
  );
}
