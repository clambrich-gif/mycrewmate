import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const MYCREWMATE_WORDMARK = "/brand/mycrewmate-wordmark.png";
const WELCOME_DURATION_MS = 8_000;

type FirstLoginOnboardingProps = {
  open: boolean;
  name: string;
  isCoAdmin: boolean;
  completing?: boolean;
  onComplete: () => void;
};

/**
 * Begrüßt neu über einen Aktivierungslink eingerichtete persönliche Zugänge.
 * Der Fortschritt wird ausschließlich für die Willkommensstufe genutzt; die
 * Co-Admin-Einführung schließt der Zugang immer bewusst selbst ab.
 */
export function FirstLoginOnboarding({
  open,
  name,
  isCoAdmin,
  completing = false,
  onComplete,
}: FirstLoginOnboardingProps) {
  const [step, setStep] = useState<"welcome" | "co_admin">("welcome");
  const [progress, setProgress] = useState(0);

  const finishWelcome = useCallback(() => {
    if (isCoAdmin) {
      setStep("co_admin");
      return;
    }
    onComplete();
  }, [isCoAdmin, onComplete]);

  useEffect(() => {
    if (!open) {
      setStep("welcome");
      setProgress(0);
      return;
    }
    if (step !== "welcome") return;

    const startedAt = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, (elapsed / WELCOME_DURATION_MS) * 100));
      if (elapsed >= WELCOME_DURATION_MS) finishWelcome();
    };
    updateProgress();
    const interval = window.setInterval(updateProgress, 100);
    return () => window.clearInterval(interval);
  }, [open, step, finishWelcome]);

  const isWelcomeStep = step === "welcome";

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && isWelcomeStep) finishWelcome();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-slate-200 bg-white p-0 text-slate-950 sm:max-w-lg"
        onEscapeKeyDown={event => {
          if (!isWelcomeStep) event.preventDefault();
        }}
        onPointerDownOutside={event => {
          if (!isWelcomeStep) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (!isWelcomeStep) event.preventDefault();
        }}
      >
        {isWelcomeStep ? (
          <div className="relative px-6 pb-6 pt-7 text-center sm:px-8 sm:pb-7">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={finishWelcome}
              aria-label="Willkommen überspringen"
              title="Überspringen"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            <img
              src={MYCREWMATE_WORDMARK}
              alt="MyCrewMate"
              className="mx-auto h-12 w-auto max-w-[78%] object-contain sm:h-14"
            />
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-orange-100 text-blue-700 shadow-sm">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogHeader className="mt-4 items-center pr-0 text-center">
              <DialogTitle className="text-xl tracking-tight text-slate-950 sm:text-2xl">
                Schön, dass du da bist, {name}!
              </DialogTitle>
              <DialogDescription className="max-w-md text-center text-[15px] leading-6 text-slate-600">
                Wenn Planung leicht wird, bleibt mehr Zeit fürs Miteinander.
                Willkommen im Planungsteam!
              </DialogDescription>
            </DialogHeader>
            <p className="mt-5 text-xs text-slate-500">
              {isCoAdmin
                ? "Deine Einführung als Co-Admin startet gleich."
                : "Deine Vereinsplanung ist jetzt für dich eingerichtet."}
            </p>
            <Progress
              value={progress}
              className="mt-5 h-1.5 bg-slate-100 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-blue-600 [&>[data-slot=progress-indicator]]:to-orange-500"
              aria-label="Willkommenshinweis wird abgeschlossen"
            />
          </div>
        ) : (
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <img
              src={MYCREWMATE_WORDMARK}
              alt="MyCrewMate"
              className="mx-auto h-10 w-auto max-w-[74%] object-contain"
            />
            <DialogHeader className="mt-6 items-center pr-0 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <DialogTitle className="pt-1 text-xl tracking-tight text-slate-950 sm:text-2xl">
                Deine ersten Schritte als Co-Admin
              </DialogTitle>
              <DialogDescription className="max-w-md text-center leading-6 text-slate-600">
                Du verwaltest die Vereinsplanung gemeinsam mit dem Hauptadministrator.
                Deine Rechte gelten ausschließlich für diesen Verein.
              </DialogDescription>
            </DialogHeader>

            <ol className="mt-6 space-y-3">
              <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ansprechpartner &amp; Helfer</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">Kontakte, Helferdaten und gewöhnliche Planungsteamzugänge verwalten.</p>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Einsatzplan &amp; Veranstaltungen</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">Schichten, Zeiten, Einsatzorte und die laufende Veranstaltungsplanung im Blick behalten.</p>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Teams koordinieren</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">Freie Helfer erkennen, Einsätze zuweisen und Rückmeldungen nachhalten.</p>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Schutz &amp; Protokoll</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">Vereinsinterne Zugänge, Vorlagen und Vorgänge sicher nachvollziehen.</p>
                </div>
              </li>
            </ol>

            <Button
              type="button"
              className="mt-6 min-h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={onComplete}
              disabled={completing}
            >
              {completing ? "Einführung wird abgeschlossen …" : "Verstanden, zur Übersicht!"}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
