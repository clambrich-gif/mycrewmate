import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Security() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: status } = trpc.auth.passwordStatus.useQuery();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const setPasswordMutation = trpc.auth.setPassword.useMutation({
    onSuccess: async () => {
      setPassword("");
      setConfirmation("");
      await utils.auth.passwordStatus.invalidate();
      toast.success("Zugangspasswort wurde geändert");
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

  const matches = password === confirmation;
  const valid = password.length >= 10 && matches;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Zugangsschutz</h1>
        <p className="text-muted-foreground">
          Gemeinsamen Passwortzugang für das Planungsteam verwalten.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Passwortzugang {status?.enabled ? "aktiv" : "nicht eingerichtet"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Das Passwort wird ausschließlich als starker Hash gespeichert. Nach
            fünf Fehlversuchen wird ein Zugang für 15 Minuten gesperrt. Eine
            Anmeldung gilt zwölf Stunden. Der Administratorzugang über Manus
            bleibt als Rückfallebene erhalten.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Neues Passwort</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Mindestens 10 Zeichen"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Passwort bestätigen</Label>
            <Input
              id="confirm-password"
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
            disabled={!valid || setPasswordMutation.isPending}
            onClick={() => setPasswordMutation.mutate({ password })}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {setPasswordMutation.isPending
              ? "Wird gespeichert …"
              : "Passwort ändern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
