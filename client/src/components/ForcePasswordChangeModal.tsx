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
        data-slot="initial-password-change-dialog"
        className="!block !w-[calc(100%-1.5rem)] !max-w-xl !max-h-[calc(100dvh-1.5rem)] !overflow-x-hidden !bg-white !p-0 text-slate-950 sm:!max-w-xl"
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader className="gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-5 text-left sm:px-8 sm:py-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-sm">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="pr-0 text-xl leading-tight text-slate-950 sm:text-2xl">
            Willkommen bei MyCrewMate
          </DialogTitle>
          <DialogDescription className="space-y-1.5 text-left leading-6 text-slate-600 sm:text-sm">
            {identityName ? (
              <span className="block font-semibold text-slate-900">
                Passwort für {identityName} einrichten
              </span>
            ) : null}
            {invitationEmail ? (
              <span className="block break-words text-xs text-slate-600">
                E-Mail-Adresse für die spätere Anmeldung: {invitationEmail}
              </span>
            ) : null}
            <span className="block text-sm text-slate-700">
              Bitte vergeben Sie jetzt ein persönliches, dauerhaftes Passwort.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5 px-5 py-5 sm:px-8 sm:py-6" onSubmit={onSubmit}>
          <div className="space-y-2.5">
            <Label htmlFor="initial-password-new" className="text-sm font-semibold text-slate-900">
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
              className="h-12 bg-white text-base shadow-sm md:h-12 md:text-base"
            />
            <p id="initial-password-requirements" className="text-xs leading-5 text-slate-600">
              {passwordCharactersMissing > 0
                ? `Noch ${passwordCharactersMissing} Zeichen bis zur Mindestlänge von 10 Zeichen.`
                : "Mindestlänge erreicht – bitte das Passwort unten bestätigen."}
            </p>
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="initial-password-confirmation" className="text-sm font-semibold text-slate-900">
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
              className="h-12 bg-white text-base shadow-sm md:h-12 md:text-base"
            />
            {!passwordsMatch && (
              <p id="initial-password-mismatch" className="text-xs text-red-700">
                Die Passwörter stimmen nicht überein.
              </p>
            )}
          </div>
          {requiresContractAcceptance ? (
            <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/70 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="initial-password-contract-acceptance"
                  checked={contractDocumentsAccepted}
                  onCheckedChange={checked =>
                    onContractDocumentsAcceptedChange?.(checked === true)
                  }
                  disabled={busy}
                  className="mt-0.5 size-5 shrink-0"
                />
                <Label
                  htmlFor="initial-password-contract-acceptance"
                  className="min-w-0 flex-1 cursor-pointer text-sm font-semibold leading-5 text-slate-900"
                >
                  Ich handle vertretungsberechtigt für meinen Verein und bestätige die Vertragsunterlagen.
                </Label>
              </div>
              <p className="ml-8 mt-2 break-words text-xs leading-5 text-slate-700">
                <span className="font-semibold">Unterlagen:</span>{" "}
                <a href="https://mycrewmate.de/agb" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">AGB</a>,{" "}
                <a href="https://mycrewmate.de/avv" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">AVV</a> und{" "}
                <a href="https://app.mycrewmate.de/datenschutz" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">Datenschutzhinweise der App</a>. Die Annahme wird elektronisch dokumentiert und an die hinterlegte E-Mail-Adresse bestätigt.
              </p>
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
          <DialogFooter className="-mx-5 -mb-5 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:-mx-8 sm:-mb-6 sm:px-8">
            <Button
              type="submit"
              className="h-12 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 sm:min-w-72"
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
