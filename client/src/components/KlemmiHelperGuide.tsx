import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Gift,
  PartyPopper,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const KLEMMI_IMAGE_URL = "/api/klemmi/mascot";

type GuideStepKey = "intro" | "person" | "donation" | "save" | "availability";

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

type KlemmiHelperGuideProps = {
  helperDialogOpen: boolean;
  donationOpen: boolean;
  createdHelperId: number | null;
  availabilityTargetReady: boolean;
  nameError: string | null;
  onOpenHelperDialog: () => void;
  onGuideOpenChange: (open: boolean) => void;
};

const guideSteps: Array<{
  key: GuideStepKey;
  selector: string;
  workflowStep?: number;
  eyebrow: string;
  title: string;
  text: string;
  action?: string;
  waitsForSave?: boolean;
}> = [
  {
    key: "intro",
    selector: '[data-klemmi-target="new-helper"]',
    eyebrow: "Klemmi zeigt's",
    title: "Neue Helfer sicher anlegen",
    text: "Ich führe dich direkt auf der echten Oberfläche durch die Anlage – vom Namen bis zum passenden Zeitfenster.",
    action: "Helferformular öffnen",
  },
  {
    key: "person",
    selector: '[data-klemmi-target="new-helper-name"]',
    workflowStep: 1,
    eyebrow: "Schritt 1 von 4",
    title: "Person erfassen",
    text: "Der Name ist die einzige Pflichtangabe. Ansprechpartner, Telefonnummer und Hinweis kannst du ergänzen, wenn du sie schon kennst.",
    action: "Spende zeigen",
  },
  {
    key: "donation",
    selector: '[data-klemmi-target="new-helper-donation"]',
    workflowStep: 2,
    eyebrow: "Schritt 2 von 4",
    title: "Spende bei Bedarf ergänzen",
    text: "Die Spende ist optional: Setze nur dann das Häkchen, wenn Kuchen, Salat, Snack oder eine andere Spende direkt mit erfasst werden soll.",
    action: "Speichern zeigen",
  },
  {
    key: "save",
    selector: '[data-klemmi-target="new-helper-submit"]',
    workflowStep: 3,
    eyebrow: "Schritt 3 von 4",
    title: "Helfer jetzt speichern",
    text: "Klicke jetzt unten rechts auf den markierten Speichern-Button. Klemmi wartet auf die erfolgreiche Anlage und zeigt danach genau diesen neuen Helfer.",
    waitsForSave: true,
  },
  {
    key: "availability",
    selector: '[data-klemmi-target="helper-availability"]',
    workflowStep: 4,
    eyebrow: "Schritt 4 von 4",
    title: "Zeitfenster des neuen Helfers festlegen",
    text: "Hier legst du für den gerade angelegten Helfer direkt fest, ob und wann er verfügbar ist. Tippe auf einen Tag und wähle „Ja“, „Nein“ oder ein Zeitfenster von–bis.",
    action: "Fertig",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Nicht-modale, direkt an der Oberfläche verankerte Mini-Führung.
 * Die Auswahl- und Eingabefelder bleiben dabei vollständig bedienbar.
 */
export function KlemmiHelperGuide({
  helperDialogOpen,
  donationOpen,
  createdHelperId,
  availabilityTargetReady,
  nameError,
  onOpenHelperDialog,
  onGuideOpenChange,
}: KlemmiHelperGuideProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect>(null);
  const [celebrating, setCelebrating] = useState(false);
  const step = guideSteps[stepIndex];
  const workflowSteps = useMemo(
    () => guideSteps.filter(item => item.workflowStep !== undefined),
    []
  );
  const saveButtonLabel = donationOpen ? "Helfer & Spende anlegen" : "Helfer anlegen";
  const selector =
    step.key === "availability" && createdHelperId !== null
      ? `[data-klemmi-target="helper-availability"][data-klemmi-helper-id="${createdHelperId}"]`
      : step.selector;
  const targetReady = step.key !== "availability" || availabilityTargetReady;

  const closeGuide = () => {
    setOpen(false);
    setCelebrating(false);
    setHighlightRect(null);
    onGuideOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    if (createdHelperId !== null && step.key !== "availability") {
      setStepIndex(4);
      return;
    }
    if (step.key === "intro" && helperDialogOpen) setStepIndex(1);
  }, [createdHelperId, helperDialogOpen, open, step.key]);

  useLayoutEffect(() => {
    if (!open || celebrating || typeof window === "undefined") return;

    let frame = 0;
    const resolveVisibleTarget = () =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).find(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? null;
    const target = resolveVisibleTarget();
    const syncPosition = () => {
      const element = resolveVisibleTarget();
      if (!element) {
        setHighlightRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const left = clamp(rect.left - 8, 8, Math.max(8, window.innerWidth - 20));
      const top = clamp(rect.top - 8, 8, Math.max(8, window.innerHeight - 20));
      setHighlightRect({
        top,
        left,
        width: Math.max(0, Math.min(rect.width + 16, window.innerWidth - left - 8)),
        height: Math.max(0, Math.min(rect.height + 16, window.innerHeight - top - 8)),
      });
    };
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncPosition);
    };

    window.setTimeout(() => {
      const element = resolveVisibleTarget();
      element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      scheduleSync();
    }, targetReady ? 90 : 0);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("scroll", scheduleSync, true);
    const resizeObserver = target ? new ResizeObserver(scheduleSync) : null;
    if (target && resizeObserver) resizeObserver.observe(target);
    scheduleSync();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("scroll", scheduleSync, true);
      resizeObserver?.disconnect();
    };
  }, [open, selector, targetReady, celebrating]);

  const showPrevious = () => {
    if (step.key === "person") {
      setStepIndex(0);
      return;
    }
    if (step.key === "donation") {
      setStepIndex(1);
      return;
    }
    if (step.key === "save") {
      setStepIndex(2);
      return;
    }
    closeGuide();
  };

  const showNext = () => {
    if (step.key === "intro") {
      onOpenHelperDialog();
      setStepIndex(1);
      return;
    }
    if (step.key === "person") {
      setStepIndex(2);
      return;
    }
    if (step.key === "donation") {
      setStepIndex(3);
      return;
    }
    if (step.key === "availability") setCelebrating(true);
  };

  const canGoBack = step.key !== "intro" && step.key !== "availability";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-klemmi-trigger
        className="min-h-11 gap-2 border-blue-200 bg-blue-50 px-3 text-blue-950 shadow-sm hover:border-blue-300 hover:bg-blue-100"
        onClick={() => {
          setStepIndex(0);
          setOpen(true);
          onGuideOpenChange(true);
        }}
      >
        <img
          src={KLEMMI_IMAGE_URL}
          alt="Klemmi"
          className="size-7 rounded-md object-contain"
        />
        <span className="font-semibold">Klemmi zeigt&apos;s</span>
        <CircleHelp className="size-4" aria-hidden="true" />
      </Button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div data-klemmi-guide className="pointer-events-none fixed inset-0 z-[70]">
            {highlightRect && !celebrating && (
              <div
                aria-hidden="true"
                data-klemmi-highlight
                className="absolute rounded-xl border-[3px] border-[#ff7a2f] bg-[#ff7a2f]/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.12),0_0_0_6px_rgba(255,122,47,0.18)] transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
                style={highlightRect}
              />
            )}
            <section
              aria-live="polite"
              aria-label="Klemmi Schritt-für-Schritt-Anleitung"
              className="pointer-events-auto fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden rounded-2xl border border-blue-200 bg-white p-3 text-slate-950 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(25rem,calc(100vw-2.5rem))] sm:p-4"
            >
              {celebrating ? (
                <div className="klemmi-celebration text-center" data-klemmi-success>
                  <div className="klemmi-celebration-icon mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <PartyPopper className="size-8" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">
                    Klemmi freut sich mit dir
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-950">Geschafft!</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Du hast einen Helfer angelegt und kennst nun auch die Verfügbarkeit. So wird aus einer Zusage direkt eine planbare Unterstützung.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 min-h-10 bg-[#ff7a2f] text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                    onClick={closeGuide}
                  >
                    <CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />
                    Fertig
                  </Button>
                </div>
              ) : (
              <>
              <div className="flex items-start gap-3">
                <img
                  src={KLEMMI_IMAGE_URL}
                  alt="Klemmi, der digitale Helfer"
                  className="size-[76px] shrink-0 rounded-xl object-contain sm:size-[92px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">
                    {step.eyebrow}
                  </p>
                  <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-950 sm:text-lg">
                    {step.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {step.key === "save"
                      ? `Klicke jetzt unten rechts auf „${saveButtonLabel}“. ${step.text}`
                      : step.text}
                  </p>
                </div>
                <button
                  type="button"
                  className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:size-9"
                  aria-label="Klemmi-Anleitung schließen"
                  title="Anleitung schließen"
                  onClick={closeGuide}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              {nameError && step.key !== "availability" && (
                <p
                  data-klemmi-name-warning
                  role="alert"
                  className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950"
                >
                  <strong>Klemmi-Hinweis:</strong> {nameError}
                </p>
              )}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1" aria-label={step.workflowStep ? `Schritt ${step.workflowStep} von ${workflowSteps.length}` : "Einführung"}>
                  {workflowSteps.map(item => (
                    <span
                      key={item.key}
                      className={cn(
                        "h-1.5 w-5 rounded-full transition-colors",
                        item.workflowStep === step.workflowStep ? "bg-[#ff7a2f]" : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>

                <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-2">
                  {canGoBack && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-10 shrink-0 px-2 text-slate-700"
                      onClick={showPrevious}
                    >
                      <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
                      Zurück
                    </Button>
                  )}

                  {step.waitsForSave ? (
                    <p
                      data-klemmi-save-wait
                      className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-right text-xs leading-snug text-slate-600"
                    >
                      Klemmi wartet auf deinen Klick auf den markierten Speichern-Button.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10 min-w-0 max-w-full whitespace-normal bg-[#ff7a2f] px-3 text-right text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                      onClick={showNext}
                    >
                      {step.key === "availability" ? (
                        <CheckCircle2 className="mr-1.5 size-4 shrink-0" aria-hidden="true" />
                      ) : step.key === "donation" ? (
                        <Save className="mr-1.5 size-4 shrink-0" aria-hidden="true" />
                      ) : step.key === "person" ? (
                        <Gift className="mr-1.5 size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Sparkles className="mr-1.5 size-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0">{step.action}</span>
                      {step.key !== "availability" && <ChevronRight className="ml-1 size-4 shrink-0" aria-hidden="true" />}
                    </Button>
                  )}
                </div>
              </div>
              </>
              )}
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
