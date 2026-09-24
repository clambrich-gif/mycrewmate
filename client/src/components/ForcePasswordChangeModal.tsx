import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, TriangleAlert } from "lucide-react";
import type { FormEvent } from "react";

type ForcePasswordChangeModalProps = {
  open: boolean;
  identityName?: string | null;
  password: string;
  passwordConfirmation: string;
  busy: boolean;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Dieses Sicherheitsdialogfenster ist absichtlich weder per Escape noch durch
 * Klick außerhalb schließbar. Ein Einmalcode darf ausschließlich zum Setzen
 * eines persönlichen Passworts verwendet werden.
 */
export function ForcePasswordChangeModal({
  open,
  identityName,
  password,
  passwordConfirmation,
  busy,
  error,
  onPasswordChange,
  onPasswordConfirmationChange,
  onSubmit,
}: ForcePasswordChangeModalProps) {
  const passwordsMatch =
    passwordConfirmation.length === 0 || password === passwordConfirmation;
  const canSubmit =
    password.length >= 10 &&
    passwordConfirmation.length >= 10 &&
    password === passwordConfirmation &&
    !busy;

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="bg-white text-slate-950 sm:max-w-md"
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Willkommen bei MyCrewMate – Passwort ändern</DialogTitle>
          <DialogDescription className="leading-relaxed text-slate-600">
            {identityName ? (
              <span className="block font-medium text-slate-800">
                Zugang für {identityName}
              </span>
            ) : null}
            Du hast dich mit einem temporären Zugangs-Code angemeldet. Bitte
            vergib jetzt dein persönliches, dauerhaftes Passwort.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="initial-password-new">Neues Passwort</Label>
            <Input
              id="initial-password-new"
              type="password"
              autoComplete="new-password"
              placeholder="Mindestens 10 Zeichen"
              value={password}
              onChange={event => onPasswordChange(event.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial-password-confirmation">
              Neues Passwort bestätigen
            </Label>
            <Input
              id="initial-password-confirmation"
              type="password"
              autoComplete="new-password"
              placeholder="Passwort wiederholen"
              value={passwordConfirmation}
              onChange={event => onPasswordConfirmationChange(event.target.value)}
              disabled={busy}
              aria-invalid={!passwordsMatch}
              aria-describedby={
                !passwordsMatch ? "initial-password-mismatch" : undefined
              }
            />
            {!passwordsMatch && (
              <p id="initial-password-mismatch" className="text-xs text-red-700">
                Die Passwörter stimmen nicht überein.
              </p>
            )}
          </div>
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
              role="alert"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <span>{error}</span>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button
              type="submit"
              className="min-h-11 w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
              disabled={!canSubmit}
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              {busy
                ? "Passwort wird gespeichert …"
                : "Neues Passwort speichern & Fortfahren"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
