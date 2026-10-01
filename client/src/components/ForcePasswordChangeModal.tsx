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
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, TriangleAlert } from "lucide-react";
import type { FormEvent } from "react";

type ForcePasswordChangeModalProps = {
  open: boolean;
  identityName?: string | null;
  invitationEmail?: string | null;
  password: string;
  passwordConfirmation: string;
  requiresContractAcceptance?: boolean;
  contractDocumentsAccepted?: boolean;
  busy: boolean;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onContractDocumentsAcceptedChange?: (accepted: boolean) => void;
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
  invitationEmail,
  password,
  passwordConfirmation,
  requiresContractAcceptance = false,
  contractDocumentsAccepted = false,
  busy,
  error,
  onPasswordChange,
  onPasswordConfirmationChange,
  onContractDocumentsAcceptedChange,
  onSubmit,
}: ForcePasswordChangeModalProps) {
  const passwordsMatch =
    passwordConfirmation.length === 0 || password === passwordConfirmation;
  const passwordCharactersMissing = Math.max(0, 10 - password.length);
  const canSubmit =
    password.length >= 10 &&
    passwordConfirmation.length >= 10 &&
    password === passwordConfirmation &&
    (!requiresContractAcceptance || contractDocumentsAccepted) &&
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
            {invitationEmail ? (
              <span className="mt-1 block text-xs text-slate-600">
                E-Mail-Adresse für die spätere Anmeldung: {invitationEmail}
              </span>
            ) : null}
            Du hast dich mit einem temporären Zugangs-Code angemeldet. Bitte
            vergib jetzt dein persönliches, dauerhaftes Passwort.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="initial-password-new">
              Neues Passwort <span className="font-normal text-slate-500">(mindestens 10 Zeichen)</span>
            </Label>
            <Input
              id="initial-password-new"
              type="password"
              autoComplete="new-password"
              placeholder="Mindestens 10 Zeichen"
              value={password}
              onChange={event => onPasswordChange(event.target.value)}
              disabled={busy}
              autoFocus
              aria-describedby="initial-password-requirements"
            />
            <p id="initial-password-requirements" className="text-xs leading-5 text-slate-600">
              {passwordCharactersMissing > 0
                ? `Noch ${passwordCharactersMissing} Zeichen bis zur Mindestlänge von 10 Zeichen.`
                : "Mindestlänge erreicht – bitte das Passwort unten bestätigen."}
            </p>
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
          {requiresContractAcceptance ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="initial-password-contract-acceptance"
                  checked={contractDocumentsAccepted}
                  onCheckedChange={checked =>
                    onContractDocumentsAcceptedChange?.(checked === true)
                  }
                  disabled={busy}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="initial-password-contract-acceptance"
                  className="cursor-pointer text-xs font-normal leading-5 text-slate-700"
                >
                  Ich handle vertretungsberechtigt für meinen Verein und bestätige die{" "}
                  <a href="https://mycrewmate.de/agb" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">AGB</a>
                  {", "}
                  <a href="https://mycrewmate.de/avv" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">Vereinbarung zur Auftragsverarbeitung (AVV)</a>
                  {" und die "}
                  <a href="https://app.mycrewmate.de/datenschutz" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">Datenschutzhinweise der App</a>
                  . Die Annahme wird elektronisch dokumentiert und an die hinterlegte E-Mail-Adresse bestätigt.
                </Label>
              </div>
            </div>
          ) : null}
          <p className="-mt-1 text-xs leading-5 text-slate-600">
            Der Button wird aktiv, sobald beide Passwörter mindestens 10 Zeichen lang und identisch sind{requiresContractAcceptance ? " und die Vertragsunterlagen bestätigt wurden" : ""}.
          </p>
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
