import { Button } from "@/components/ui/button";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import { KlemmiVoiceControl } from "@/components/KlemmiVoiceControl";
import { useKlemmiVoice } from "@/hooks/useKlemmiVoice";
import { CheckCircle2, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

const KLEMMI_INTRO_TEXT =
  "Hallo! Ich bin Klemmi. Und nein – nicht weil ich verklemmt bin, sondern weil ich immer genau dann zur Stelle bin, wenn es irgendwo klemmt, oder halt, wenn du das erste Mal hier bist! Egal ob Schichten, Helfer oder Event-Planung: Wenn du mal nicht weiterweißt, klick mich einfach an! Du findest mich ab jetzt auf jeder Seite ganz oben im Menü.";
const KLEMMI_CO_ADMIN_TEXT =
  "Und noch ein Tipp für dich als Co-Admin: Im nächsten Schritt siehst du deine wichtigsten Rechte. Die vollständige Rechte-Matrix findest du später jederzeit im Hilfe-Bereich.";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Einmalige, echte Begrüßung direkt nach dem 15-Sekunden-Willkommensfenster.
 * Das Overlay hebt ausschließlich einen tatsächlich sichtbaren Klemmi-Auslöser
 * hervor. Es speichert den Onboardingstatus nicht selbst; erst der bewusste
 * Abschluss durch die umgebende Einführung beendet ihn dauerhaft.
 */
export function FirstLoginKlemmiIntro({
  open,
  isCoAdmin = false,
  autoSpeak = true,
  externalSpeaking = false,
  completing = false,
  onComplete,
}: {
  open: boolean;
  isCoAdmin?: boolean;
  /** Die Staging-Demo startet Audio unmittelbar über ihren Testbutton. */
  autoSpeak?: boolean;
  /** Synchronisiert die Gesichtsanimation mit extern ausgelöstem Demo-Audio. */
  externalSpeaking?: boolean;
  completing?: boolean;
  onComplete: () => void;
}) {
  const [highlightRect, setHighlightRect] = useState<HighlightRect>(null);
  const [leaving, setLeaving] = useState(false);
  const { muted, isSpeaking, speak, toggleMuted, cancel } = useKlemmiVoice();

  useEffect(() => {
    if (!open) {
      setLeaving(false);
      setHighlightRect(null);
      cancel();
      return;
    }

    setLeaving(false);
    if (!autoSpeak) return;
    // Der Audiostart wird versucht, sobald der Einstieg sichtbar ist. Browser,
    // die das nach der Willkommenszeit unterbinden, erhalten die klar sichtbare
    // Wiederholen-Schaltfläche – nie eine fremde Systemstimme als Ersatz.
    const timer = window.setTimeout(() => {
      speak(
        isCoAdmin ? `${KLEMMI_INTRO_TEXT} ${KLEMMI_CO_ADMIN_TEXT}` : KLEMMI_INTRO_TEXT,
        isCoAdmin ? "first-login-co-admin" : "first-login-intro"
      );
    }, 360);
    return () => window.clearTimeout(timer);
  }, [autoSpeak, cancel, isCoAdmin, open, speak]);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    let frame = 0;
    const resolveTarget = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-klemmi-trigger]")).find(
        element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }
      ) ?? null;

    const syncHighlight = () => {
      const target = resolveTarget();
      if (!target) {
        setHighlightRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
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
      frame = window.requestAnimationFrame(syncHighlight);
    };

    scheduleSync();
    const retry = window.setInterval(scheduleSync, 180);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("scroll", scheduleSync, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(retry);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("scroll", scheduleSync, true);
    };
  }, [open]);

  const finish = () => {
    if (leaving || completing) return;
    cancel();
    setLeaving(true);
    window.setTimeout(onComplete, 360);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-klemmi-first-login-intro
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="klemmi-first-login-backdrop absolute inset-0 bg-slate-950/18 backdrop-blur-[1px]"
      />
      {highlightRect && (
        <div
          aria-hidden="true"
          data-klemmi-first-login-highlight
          className="klemmi-first-login-highlight absolute rounded-xl border-[3px] border-[#ff7a2f] bg-[#ff7a2f]/12 shadow-[0_0_0_9999px_rgba(15,23,42,0.09),0_0_0_8px_rgba(255,122,47,0.22)]"
          style={highlightRect}
        />
      )}

      <section
        role="dialog"
        aria-modal="false"
        aria-label="Klemmis kurze Einführung"
        className="klemmi-first-login-card pointer-events-auto fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] overflow-visible rounded-2xl border border-blue-200 bg-white p-4 text-slate-950 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(29rem,calc(100vw-2.5rem))] sm:p-5"
        data-leaving={leaving ? "true" : "false"}
      >
        <div
          aria-hidden="true"
          className="klemmi-first-login-mascot"
          data-leaving={leaving ? "true" : "false"}
        >
          <KlemmiMascot isSpeaking={isSpeaking || externalSpeaking} decorative />
          <span className="klemmi-first-login-question" aria-hidden="true">?</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#e86117] shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">Klemmi ist für dich da</p>
            <h2 className="mt-0.5 text-lg font-bold leading-snug text-slate-950">Hallo, ich bin Klemmi!</h2>
          </div>
          <div className="-mr-1 -mt-1 flex shrink-0 items-center">
            <KlemmiVoiceControl muted={muted} onToggle={toggleMuted} />
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{KLEMMI_INTRO_TEXT}</p>
        {isCoAdmin && (
          <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-relaxed text-blue-950">
            <span className="font-semibold">Co-Admin-Tipp:</span> {KLEMMI_CO_ADMIN_TEXT.replace("Und noch ein Tipp für dich als Co-Admin: ", "")}
          </p>
        )}
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Der orange Rahmen zeigt dir den echten Hilfeauslöser auf dieser Seite.
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-blue-200 text-blue-900 hover:bg-blue-50"
            onClick={() =>
              speak(
                isCoAdmin ? `${KLEMMI_INTRO_TEXT} ${KLEMMI_CO_ADMIN_TEXT}` : KLEMMI_INTRO_TEXT,
                isCoAdmin ? "first-login-co-admin" : "first-login-intro"
              )
            }
            disabled={muted || completing || leaving}
          >
            <Volume2 className="mr-1.5 size-4" aria-hidden="true" />
            Noch einmal vorlesen
          </Button>
          <Button
            type="button"
            className="min-h-11 bg-[#ff7a2f] text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
            onClick={finish}
            disabled={completing || leaving}
          >
            <CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />
            {completing ? "Einführung wird abgeschlossen …" : "Verstanden – danke, Klemmi!"}
          </Button>
        </div>
      </section>
    </div>,
    document.body
  );
}
