import { Button } from "@/components/ui/button";
import { KlemmiGuideCard } from "@/components/KlemmiGuideCard";
import { KlemmiMascot, KlemmiTriggerMascot } from "@/components/KlemmiMascot";
import { KlemmiVoiceControl } from "@/components/KlemmiVoiceControl";
import { useKlemmiVoice } from "@/hooks/useKlemmiVoice";
import { isKlemmiAudioId } from "@/lib/klemmiAudio";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

export type KlemmiSurfaceStep = {
  key: string;
  selector: string;
  eyebrow: string;
  title: string;
  text: string;
  /** Optionaler Audio-Suffix, wenn sich der gesprochene Text je nach Zustand unterscheidet. */
  audioKey?: string;
  action?: string;
  /** Der erklärende Schritt bleibt auch bei einer noch leeren Übersicht nutzbar. */
  allowMissingTarget?: boolean;
  /** Wechselt weiter, sobald die Seite einen echten, vom Nutzer ausgelösten Öffnungsschritt meldet. */
  advancesOnSignal?: boolean;
  waitsForSuccess?: boolean;
  completeOnSuccess?: boolean;
};

type KlemmiSurfaceGuideProps = {
  guideId: string;
  title: string;
  introText: string;
  steps: KlemmiSurfaceStep[];
  successSignal: number | null;
  onStepAction?: (stepKey: string) => void;
  /** Reagiert auf Vor- und Zurückblättern, etwa um rein erklärend einen Bereich zu öffnen. */
  onStepChange?: (stepKey: string) => void;
  onOpenChange?: (open: boolean) => void;
  completionTitle?: string;
  completionText?: string;
  /** Optionaler eigener Abschlussclip für reine Übersichtstouren. */
  completionAudioKey?: string;
  /** Externe Stummschaltung, etwa über den Dashboard-Schalter. */
  voiceMuted?: boolean;
  onVoiceMutedChange?: (muted: boolean) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Klemmi-Touren werden teils als reine Textdaten zusammengesetzt. Damit eine
 * versehentlich übernommene HTML-Entität niemals als technischer Text wie
 * „&apos;“ erscheint, werden die wenigen relevanten Entitäten vor Anzeige und
 * Vorlesen konsequent in Klartext übertragen.
 */
function readableKlemmiCopy(value: string) {
  const entities: Record<string, string> = {
    "&apos;": "’",
    "&#39;": "’",
    "&quot;": '"',
    "&#34;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
  };
  return value.replace(
    /&(apos|quot|amp|lt|gt|#39|#34);/gi,
    entity => entities[entity.toLowerCase()] ?? entity
  );
}

/**
 * Nicht-modale Klemmi-Führung für echte Bereiche der Anwendung.
 * Die Zielseiten übergeben nur reale DOM-Anker und echte Aktionen; Klemmi
 * sperrt weder Eingaben noch speichert oder verändert Daten eigenständig.
 */
export function KlemmiSurfaceGuide({
  guideId,
  title,
  introText,
  steps,
  successSignal,
  onStepAction,
  onStepChange,
  onOpenChange,
  completionTitle = "Geschafft!",
  completionText = "Du kennst jetzt die wichtigsten Schritte. Klemmi bleibt jederzeit über „Klemmi zeigt’s“ für dich da.",
  completionAudioKey = "complete",
  voiceMuted,
  onVoiceMutedChange,
}: KlemmiSurfaceGuideProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [openingPending, setOpeningPending] = useState(false);
  const [narrationComplete, setNarrationComplete] = useState(false);
  const acceptedSuccessSignal = useRef<number | null>(null);
  /**
   * Der Live-Chat-Schritt startet seinen Clip direkt im Nutzer-Klick auf
   * „Weiter“. So kann kein Browser die Wiedergabe wegen eines nachgelagerten
   * Effekts als automatische Audioausgabe blockieren.
   */
  const directlyStartedNarrationStep = useRef<string | null>(null);
  const { muted, isSpeaking, speak, playOpening, toggleMuted, cancel } =
    useKlemmiVoice({
      muted: voiceMuted,
      onMutedChange: onVoiceMutedChange,
    });
  const step = steps[stepIndex];
  const workflowSteps = useMemo(
    () => steps.filter(item => item.key !== "intro"),
    [steps]
  );
  const isIntro = step?.key === "intro";
  const audioSuffix =
    step?.audioKey ?? (isIntro ? "intro" : (step?.key ?? "intro"));
  const audioCandidate = celebrating
    ? `${guideId}-${completionAudioKey}`
    : `${guideId}-${audioSuffix}`;
  const audioClipId = isKlemmiAudioId(audioCandidate)
    ? audioCandidate
    : undefined;
  const displayTitle = readableKlemmiCopy(title);
  const displayIntroText = readableKlemmiCopy(introText);
  const displayCompletionTitle = readableKlemmiCopy(completionTitle);
  const displayCompletionText = readableKlemmiCopy(completionText);
  const displayStepEyebrow = readableKlemmiCopy(step?.eyebrow ?? "");
  const displayStepTitle = readableKlemmiCopy(step?.title ?? "");
  const displayStepText = readableKlemmiCopy(step?.text ?? "");

  const closeGuide = () => {
    cancel();
    setOpen(false);
    setCelebrating(false);
    setNarrationComplete(false);
    setHighlightRect(null);
    setTargetReady(false);
    onOpenChange?.(false);
  };

  useEffect(() => {
    if (!open || !step?.waitsForSuccess || successSignal === null) return;
    if (acceptedSuccessSignal.current === successSignal) return;

    acceptedSuccessSignal.current = successSignal;
    if (step.completeOnSuccess || stepIndex === steps.length - 1) {
      setCelebrating(true);
      return;
    }
    setTargetReady(false);
    setStepIndex(current => Math.min(current + 1, steps.length - 1));
  }, [
    open,
    step?.waitsForSuccess,
    step?.completeOnSuccess,
    stepIndex,
    steps.length,
    successSignal,
  ]);

  useEffect(() => {
    if (!open || celebrating || !step) return;
    onStepChange?.(step.key);
  }, [celebrating, onStepChange, open, step]);

  useEffect(() => {
    if (!open || !step || openingPending) return;
    // Der Live-Chat-Clip wird im Weiter-Klick bewusst schon gestartet. Bis
    // der neue Schritt sein Ziel gefunden hat, darf kein Zwischen-Render den
    // gerade laufenden Clip über die Standardbereinigung anhalten.
    if (directlyStartedNarrationStep.current) {
      if (
        directlyStartedNarrationStep.current === step.key &&
        targetReady
      ) {
        directlyStartedNarrationStep.current = null;
        setNarrationComplete(true);
      }
      return;
    }
    cancel();
    setNarrationComplete(false);
    // Ein Schritt mit echtem Ziel beginnt erst, wenn etwa ein Dialog oder eine
    // Kachel sichtbar im DOM steht. So läuft Klemmi nie einer noch unsichtbaren
    // Spendenanlage voraus.
    if (!celebrating && !targetReady) return;
    let active = true;
    const text = celebrating
      ? `${displayCompletionTitle} ${displayCompletionText}`
      : isIntro
        ? `${displayTitle}. ${displayIntroText}`
        : `${displayStepTitle}. ${displayStepText}`;
    const timeout = window.setTimeout(() => {
      void speak(text, audioClipId).finally(() => {
        if (active) setNarrationComplete(true);
      });
    }, 160);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      // Der Chat-Clip startet bewusst direkt im „Weiter“-Klick. Beim
      // anschließenden React-Schrittwechsel darf das Cleanup des vorherigen
      // Schritts genau diesen gerade gestarteten Clip nicht wieder stoppen.
      if (directlyStartedNarrationStep.current) return;
      cancel();
    };
  }, [
    audioClipId,
    cancel,
    celebrating,
    displayCompletionText,
    displayCompletionTitle,
    displayIntroText,
    displayStepText,
    displayStepTitle,
    displayTitle,
    isIntro,
    open,
    openingPending,
    speak,
    step.key,
    targetReady,
  ]);

  useLayoutEffect(() => {
    if (
      !open ||
      celebrating ||
      !step?.selector ||
      typeof window === "undefined"
    )
      return;

    let frame = 0;
    setTargetReady(false);
    const resolveVisibleTarget = () =>
      Array.from(document.querySelectorAll<HTMLElement>(step.selector)).find(
        element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }
      ) ?? null;
    const target = resolveVisibleTarget();
    const syncPosition = () => {
      const element = resolveVisibleTarget();
      setTargetReady(current => {
        const next = Boolean(element) || Boolean(step.allowMissingTarget);
        return current === next ? current : next;
      });
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
        width: Math.max(
          0,
          Math.min(rect.width + 16, window.innerWidth - left - 8)
        ),
        height: Math.max(
          0,
          Math.min(rect.height + 16, window.innerHeight - top - 8)
        ),
      });
    };
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncPosition);
    };

    window.setTimeout(() => {
      resolveVisibleTarget()?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      scheduleSync();
    }, 80);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("scroll", scheduleSync, true);
    const resizeObserver = target ? new ResizeObserver(scheduleSync) : null;
    if (target && resizeObserver) resizeObserver.observe(target);
    const mutationObserver = new MutationObserver(scheduleSync);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "aria-hidden",
        "data-state",
      ],
    });
    scheduleSync();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("scroll", scheduleSync, true);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
    };
  }, [open, celebrating, step?.allowMissingTarget, step?.selector]);

  const showPrevious = () => {
    if (stepIndex === 0) return;
    setTargetReady(false);
    setStepIndex(current => Math.max(0, current - 1));
  };

  const showNext = () => {
    if (!step || step.waitsForSuccess) return;
    onStepAction?.(step.key);
    if (stepIndex === steps.length - 1) {
      setCelebrating(true);
      return;
    }
    const nextStep = steps[stepIndex + 1];
    if (nextStep?.key === "chat") {
      const chatAudioCandidate = `${guideId}-${nextStep.audioKey ?? nextStep.key}`;
      if (isKlemmiAudioId(chatAudioCandidate)) {
        directlyStartedNarrationStep.current = nextStep.key;
        setNarrationComplete(false);
        const chatNarration = `${readableKlemmiCopy(nextStep.title)}. ${readableKlemmiCopy(nextStep.text)}`;
        void speak(chatNarration, chatAudioCandidate).finally(() => {
          if (directlyStartedNarrationStep.current === nextStep.key) {
            setNarrationComplete(true);
          }
        });
      }
    }
    setTargetReady(false);
    setStepIndex(current => Math.min(current + 1, steps.length - 1));
  };

  if (!step) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-klemmi-trigger={guideId}
        className="min-h-11 min-w-0 gap-2 border-blue-200 bg-blue-50 px-3 text-blue-950 shadow-sm hover:border-blue-300 hover:bg-blue-100 max-sm:gap-1 max-sm:px-1.5 max-sm:text-xs max-sm:[&_.klemmi-trigger-mascot]:size-5 max-sm:[&_.klemmi-trigger-mascot_img]:size-5 max-sm:[&>svg]:size-3"
        onClick={() => {
          acceptedSuccessSignal.current = successSignal;
          setStepIndex(0);
          setCelebrating(false);
          setTargetReady(false);
          setOpeningPending(true);
          setOpen(true);
          onOpenChange?.(true);
          void playOpening().finally(() => setOpeningPending(false));
        }}
      >
        <KlemmiTriggerMascot />
        <span className="font-semibold">Klemmi zeigt’s</span>
        <CircleHelp className="size-4" aria-hidden="true" />
      </Button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-klemmi-guide
            className="pointer-events-none fixed inset-0 z-[70]"
          >
            {highlightRect && !celebrating && (
              <div
                aria-hidden="true"
                data-klemmi-highlight
                className="klemmi-guide-highlight absolute rounded-xl border-[3px] border-[#ff7a2f] bg-[#ff7a2f]/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.12),0_0_0_6px_rgba(255,122,47,0.18)] transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
                style={highlightRect}
              />
            )}
            <KlemmiGuideCard
              position={
                step.selector === '[data-klemmi-target="dashboard-live-chat"]'
                  ? "above-chat"
                  : "bottom-right"
              }
            >
              {celebrating ? (
                <div
                  className="klemmi-celebration text-center"
                  data-klemmi-success
                  data-klemmi-narration-complete={
                    narrationComplete ? "true" : "false"
                  }
                >
                  <KlemmiMascot
                    isSpeaking={isSpeaking}
                    decorative
                    className="klemmi-guide-mascot"
                  />
                  <div className="klemmi-celebration-icon mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <PartyPopper className="size-8" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">
                    Klemmi freut sich mit dir
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-950">
                    {displayCompletionTitle}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {displayCompletionText}
                  </p>
                  <p data-klemmi-mobile-caption>{displayCompletionTitle}</p>
                  <Button
                    type="button"
                    data-klemmi-finish-control
                    className="mt-4 min-h-10 bg-[#ff7a2f] text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                    onClick={closeGuide}
                  >
                    <CheckCircle2
                      className="mr-1.5 size-4"
                      aria-hidden="true"
                    />
                    Fertig
                  </Button>
                </div>
              ) : (
                <>
                  <KlemmiMascot
                    isSpeaking={isSpeaking}
                    decorative
                    className="klemmi-guide-mascot"
                  />
                  <div className="flex items-start gap-3" data-klemmi-narration>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">
                        {isIntro ? "Klemmi zeigt’s" : displayStepEyebrow}
                      </p>
                      <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-950 sm:text-lg">
                        {isIntro ? displayTitle : displayStepTitle}
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {isIntro ? displayIntroText : displayStepText}
                      </p>
                      <p data-klemmi-mobile-caption>
                        {isIntro ? displayTitle : displayStepTitle}
                      </p>
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                      <KlemmiVoiceControl
                        muted={muted}
                        onToggle={toggleMuted}
                      />
                      <button
                        type="button"
                        data-klemmi-close-control
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:size-9"
                        aria-label="Klemmi-Anleitung schließen"
                        title="Anleitung schließen"
                        onClick={closeGuide}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="mt-3 border-t border-slate-100 pt-3"
                    data-klemmi-navigation
                  >
                    <div
                      className="flex items-center gap-1"
                      aria-label={isIntro ? "Einführung" : displayStepEyebrow}
                    >
                      {workflowSteps.map(item => (
                        <span
                          key={item.key}
                          className={cn(
                            "h-1.5 w-5 rounded-full transition-colors",
                            item.key === step.key
                              ? "bg-[#ff7a2f]"
                              : "bg-slate-200"
                          )}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-2">
                      {stepIndex > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-klemmi-back-control
                          className="min-h-10 shrink-0 px-2 text-slate-700"
                          onClick={showPrevious}
                        >
                          <ChevronLeft
                            className="mr-1 size-4"
                            aria-hidden="true"
                          />
                          Zurück
                        </Button>
                      )}
                      {step.waitsForSuccess ? (
                        <p
                          data-klemmi-save-wait
                          className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-right text-xs leading-snug text-slate-600"
                        >
                          Klemmi wartet auf deinen Klick auf den markierten
                          Speichern-Button.
                        </p>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          data-klemmi-next-control
                          data-klemmi-narration-complete={
                            narrationComplete ? "true" : "false"
                          }
                          className="min-h-10 min-w-0 max-w-full whitespace-normal bg-[#ff7a2f] px-3 text-right text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                          onClick={showNext}
                        >
                          {isIntro ? (
                            <Sparkles
                              className="mr-1.5 size-4 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="mr-1.5 size-4 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span className="min-w-0">
                            {step.action ?? "Weiter"}
                          </span>
                          {!isIntro && (
                            <ChevronRight
                              className="ml-1 size-4 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </KlemmiGuideCard>
          </div>,
          document.body
        )}
    </>
  );
}
