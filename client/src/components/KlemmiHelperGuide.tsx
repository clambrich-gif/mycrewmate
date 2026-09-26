import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Gift,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const KLEMMI_IMAGE_URL = "/manus-storage/02-klemmbrett-konzept_0290bce1.png";

type GuideStepKey = "welcome" | "person" | "donation" | "availability";

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

type KlemmiHelperGuideProps = {
  helperDialogOpen: boolean;
  donationOpen: boolean;
  onOpenHelperDialog: () => void;
  onSetDonationOpen: (open: boolean) => void;
  onCloseHelperDialog: () => void;
};

const guideSteps: Array<{
  key: GuideStepKey;
  selector: string;
  eyebrow: string;
  title: string;
  text: string;
  action: string;
}> = [
  {
    key: "welcome",
    selector: '[data-klemmi-target="new-helper"]',
    eyebrow: "Klemmi zeigt's",
    title: "In wenigen Schritten zum neuen Helfer",
    text: "Klicke auf „Neuer Helfer“. Ich bleibe bei dir und zeige dir die wichtigsten Eingaben direkt auf der echten Oberfläche.",
    action: "Zum Formular",
  },
  {
    key: "person",
    selector: '#new-helper-dialog-name',
    eyebrow: "Schritt 1 von 3",
    title: "Person und Ansprechpartner erfassen",
    text: "Trage zuerst den Namen ein. Den passenden Ansprechpartner und eine Telefonnummer kannst du direkt daneben ergänzen – alles Weitere bleibt optional.",
    action: "Spende zeigen",
  },
  {
    key: "donation",
    selector: '[data-klemmi-target="new-helper-donation"]',
    eyebrow: "Schritt 2 von 3",
    title: "Kuchen oder Spende direkt mit aufnehmen",
    text: "Ein Häkchen genügt: Danach kannst du Kuchen, Salat oder eine andere Spende samt Allergenen sofort gemeinsam mit dem Helfer speichern.",
    action: "Verfügbarkeit zeigen",
  },
  {
    key: "availability",
    selector: '[data-klemmi-target="helper-availability"]',
    eyebrow: "Schritt 3 von 3",
    title: "Zeitfenster nach dem Anlegen festlegen",
    text: "Nach dem Speichern findest du die Tages-Verfügbarkeiten direkt in der Helferkarte. Tippe auf einen Tag und wähle „Ja“, „Nein“ oder ein Zeitfenster von–bis.",
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
  onOpenHelperDialog,
  onSetDonationOpen,
  onCloseHelperDialog,
}: KlemmiHelperGuideProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect>(null);
  const step = guideSteps[stepIndex];

  const closeGuide = () => {
    setOpen(false);
    setHighlightRect(null);
  };

  useEffect(() => {
    if (!open) return;
    if (step.key === "welcome" && helperDialogOpen) setStepIndex(1);
    if (step.key === "person" && donationOpen) setStepIndex(2);
  }, [donationOpen, helperDialogOpen, open, step.key]);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    let frame = 0;
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
      if (!element) {
        setHighlightRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      setHighlightRect({
        top: clamp(rect.top - 8, 8, Math.max(8, window.innerHeight - 20)),
        left: clamp(rect.left - 8, 8, Math.max(8, window.innerWidth - 20)),
        width: Math.max(0, rect.width + 16),
        height: Math.max(0, rect.height + 16),
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
    }, 90);
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
  }, [open, step.selector]);

  const showPrevious = () => {
    if (step.key === "donation") {
      onSetDonationOpen(false);
      setStepIndex(1);
      return;
    }
    if (step.key === "availability") {
      onOpenHelperDialog();
      onSetDonationOpen(true);
      setStepIndex(2);
      return;
    }
    closeGuide();
  };

  const showNext = () => {
    if (step.key === "welcome") {
      onOpenHelperDialog();
      setStepIndex(1);
      return;
    }
    if (step.key === "person") {
      onSetDonationOpen(true);
      setStepIndex(2);
      return;
    }
    if (step.key === "donation") {
      onCloseHelperDialog();
      setStepIndex(3);
      return;
    }
    closeGuide();
  };

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
            {highlightRect && (
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
              className="pointer-events-auto fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-2xl border border-blue-200 bg-white p-3 text-slate-950 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(25rem,calc(100vw-2.5rem))] sm:p-4"
            >
              <div className="flex items-start gap-3">
                <img
                  src={KLEMMI_IMAGE_URL}
                  alt="Klemmi, der digitale Helfer"
                  className="size-[76px] shrink-0 rounded-xl object-contain sm:size-[92px]"
                />
                <div className="min-w-0 flex-1 pr-7">
                  <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">
                    {step.eyebrow}
                  </p>
                  <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-950 sm:text-lg">
                    {step.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.text}</p>
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
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                <div className="flex gap-1" aria-label={`Schritt ${stepIndex + 1} von ${guideSteps.length}`}>
                  {guideSteps.map((item, index) => (
                    <span
                      key={item.key}
                      className={cn(
                        "h-1.5 w-5 rounded-full transition-colors",
                        index === stepIndex ? "bg-[#ff7a2f]" : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {stepIndex > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="min-h-10 px-2 text-slate-700" onClick={showPrevious}>
                      <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
                      Zurück
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-10 bg-[#ff7a2f] px-3 text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                    onClick={showNext}
                  >
                    {step.key === "availability" ? (
                      <CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />
                    ) : step.key === "donation" ? (
                      <Sparkles className="mr-1.5 size-4" aria-hidden="true" />
                    ) : step.key === "person" ? (
                      <Gift className="mr-1.5 size-4" aria-hidden="true" />
                    ) : null}
                    {step.action}
                    {step.key !== "availability" && <ChevronRight className="ml-1 size-4" aria-hidden="true" />}
                  </Button>
                </div>
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
