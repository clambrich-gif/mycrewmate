import { useAuth } from "@/_core/hooks/useAuth";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import { KeyRound, ShieldCheck, UserCog } from "lucide-react";
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
  onSave: (password: string) => void;
  saving: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const matches = password === confirmation;
  const valid = password.length >= 10 && matches;

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
          <Label>Neues Passwort</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 10 Zeichen"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Passwort bestätigen</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
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
            onSave(password);
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
  const { data: status } = trpc.auth.passwordStatus.useQuery();
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
        <h1 className="text-2xl font-bold">Zugangsschutz & Administration</h1>
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
          onSave={password => setPassword.mutate({ password })}
        />
        <PasswordEditor
          title="Administratorpasswort"
          description="Erteilt weiteren Personen Administratorrechte und bestätigt Zurücksetzungen sowie sensible Löschungen."
          enabled={Boolean(status?.adminEnabled)}
          saving={setAdminPassword.isPending}
          onSave={password => setAdminPassword.mutate({ password })}
        />
      </div>

      <Card className="border-destructive/30 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <UserCog className="h-5 w-5" /> Gefahrenbereich – Planung {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Löscht alle Ansprechpartner, Helfer, Schichten, Zuordnungen,
            Aufgaben, Materialien, Marketingmaßnahmen, Genehmigungen, Kuchen-
            und Finanzdaten des aktuell gewählten Jahres. Andere
            Veranstaltungsjahre und die Passwörter bleiben erhalten.
          </p>
          <ResetAreaButton area="all" label={`Alle Planungsdaten ${year}`} />
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
        Beide Passwörter werden ausschließlich als bcrypt-Hash gespeichert. Nach
        fünf Fehlversuchen wird der jeweilige Login 15 Minuten gesperrt;
        Sitzungen gelten zwölf Stunden. Die Manus-Anmeldung des
        Hauptadministrators bleibt erhalten.
      </div>
    </div>
  );
}
