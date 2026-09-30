import { KlemmiMascot } from "@/components/KlemmiMascot";
import { useKlemmiVoice } from "@/hooks/useKlemmiVoice";
import {
  KLEMMI_REACTION_EVENT,
  type KlemmiReactionKind,
} from "@/lib/klemmi-reactions";
import {
  isKlemmiAudioId,
  KLEMMI_AUDIO_SCRIPTS,
  type KlemmiAudioId,
} from "@/lib/klemmiAudio";
import { trpc } from "@/lib/trpc";
import {
  KLEMMI_ERROR_AUDIO_IDS,
  KLEMMI_IDLE_AUDIO_IDS,
  KLEMMI_SHIFT_SUCCESS_AUDIO_IDS,
} from "@shared/klemmi-reactions";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GreetingKind = "login" | "idle" | "error" | "shift-success";
type ActiveGreeting = { kind: GreetingKind; clipId: KlemmiAudioId };

const INACTIVITY_DELAY_MS = 120_000;
const MAX_IDLE_HINTS_PER_SESSION = 2;
/** Sichtbarer Fallback bei stummgeschalteter oder vom Browser blockierter Audioausgabe. */
const MIN_GREETING_VISIBLE_MS = 4_500;
/** Die kurze Ausfahrbewegung beginnt erst nach der vollständigen Ansage. */
const GREETING_EXIT_DURATION_MS = 360;

function chooseClip(
  ids: readonly string[],
  previous: KlemmiAudioId | null
): KlemmiAudioId | null {
  const candidates = ids.filter(
    (id): id is KlemmiAudioId => isKlemmiAudioId(id) && id !== previous
  );
  const usable = candidates.length ? candidates : ids.filter(isKlemmiAudioId);
  return usable[Math.floor(Math.random() * usable.length)] ?? null;
}

function aDialogIsOpen() {
  return Boolean(
    document.querySelector('[data-slot="dialog-content"][data-state="open"]')
  );
}

/**
 * Begrüßt jeden Zugang serverseitig höchstens einmal pro Kalendertag. Zusätzlich
 * bleibt Klemmi bei langer Ruhe sehr zurückhaltend und reagiert auf zentrale
 * Eingabefehler bzw. erfolgreiche Schichtbesetzungen ohne die Oberfläche zu sperren.
 */
export function KlemmiLoginGreeting({
  enabled,
  muted = false,
}: {
  enabled: boolean;
  muted?: boolean;
}) {
  const {
    muted: voiceMuted,
    isSpeaking,
    speak,
    cancel,
  } = useKlemmiVoice({ muted });
  const claimDailyGreeting = trpc.auth.claimDailyKlemmiGreeting.useMutation();
  const [active, setActive] = useState<ActiveGreeting | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const claimAttemptedRef = useRef(false);
  const lastClipRef = useRef<KlemmiAudioId | null>(null);
  const idleHintsRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    cancel();
    setActive(null);
  }, [cancel]);

  const showLocalReaction = useCallback(
    (kind: Exclude<GreetingKind, "login">) => {
      if (!enabled || active || aDialogIsOpen()) return;
      const ids =
        kind === "idle"
          ? KLEMMI_IDLE_AUDIO_IDS
          : kind === "error"
            ? KLEMMI_ERROR_AUDIO_IDS
            : KLEMMI_SHIFT_SUCCESS_AUDIO_IDS;
      const clipId = chooseClip(ids, lastClipRef.current);
      if (!clipId) return;
      lastClipRef.current = clipId;
      setActive({ kind, clipId });
    },
    [active, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      claimAttemptedRef.current = false;
      idleHintsRef.current = 0;
      dismiss();
      return;
    }
    if (claimAttemptedRef.current) return;
    claimAttemptedRef.current = true;
    claimDailyGreeting.mutate(undefined, {
      onSuccess: result => {
        if (!result.show || !result.clipId || !isKlemmiAudioId(result.clipId))
          return;
        lastClipRef.current = result.clipId;
        setActive({ kind: "login", clipId: result.clipId });
      },
    });
  }, [claimDailyGreeting, dismiss, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onReaction = (event: Event) => {
      const kind = (event as CustomEvent<KlemmiReactionKind>).detail;
      if (kind === "error") showLocalReaction("error");
      if (kind === "shift-success") showLocalReaction("shift-success");
    };
    window.addEventListener(KLEMMI_REACTION_EVENT, onReaction);
    return () => window.removeEventListener(KLEMMI_REACTION_EVENT, onReaction);
  }, [enabled, showLocalReaction]);

  useEffect(() => {
    if (!enabled) return;
    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
    const scheduleIdleHint = () => {
      clearIdleTimer();
      if (idleHintsRef.current >= MAX_IDLE_HINTS_PER_SESSION) return;
      idleTimerRef.current = window.setTimeout(() => {
        if (!aDialogIsOpen() && !document.hidden && !active) {
          idleHintsRef.current += 1;
          showLocalReaction("idle");
        }
      }, INACTIVITY_DELAY_MS);
    };
    const handleActivity = () => scheduleIdleHint();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "focus",
    ];
    events.forEach(eventName =>
      window.addEventListener(eventName, handleActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", handleActivity);
    scheduleIdleHint();
    return () => {
      clearIdleTimer();
      events.forEach(eventName =>
        window.removeEventListener(eventName, handleActivity)
      );
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, [active, enabled, showLocalReaction]);

  useEffect(() => {
    if (!active) return;
    setIsLeaving(false);
    let disposed = false;
    let leaveTimer: number | null = null;
    let closeTimer: number | null = null;
    const speakTimer = window.setTimeout(() => {
      const shownAt = Date.now();
      void speak(KLEMMI_AUDIO_SCRIPTS[active.clipId], active.clipId).then(
        completedWithAudio => {
          if (disposed) return;
          // Der Markenclip entscheidet über die sichtbare Dauer. Nur ohne Ton
          // bleibt Klemmi kurz als visueller Hinweis stehen.
          const fallbackDelay = completedWithAudio
            ? 0
            : voiceMuted
              ? Math.max(0, MIN_GREETING_VISIBLE_MS - (Date.now() - shownAt))
              : MIN_GREETING_VISIBLE_MS;
          leaveTimer = window.setTimeout(() => {
            if (disposed) return;
            setIsLeaving(true);
            closeTimer = window.setTimeout(() => {
              if (!disposed) setActive(null);
            }, GREETING_EXIT_DURATION_MS);
          }, fallbackDelay);
        }
      );
    }, 180);
    return () => {
      disposed = true;
      window.clearTimeout(speakTimer);
      if (leaveTimer !== null) window.clearTimeout(leaveTimer);
      if (closeTimer !== null) window.clearTimeout(closeTimer);
      cancel();
    };
  }, [active, cancel, speak, voiceMuted]);

  if (!active || typeof document === "undefined") return null;
  const caption = KLEMMI_AUDIO_SCRIPTS[active.clipId];
  const label =
    active.kind === "login"
      ? "Klemmis Tagesbegrüßung schließen"
      : "Klemmis Hinweis schließen";

  return createPortal(
    <button
      type="button"
      className={`klemmi-login-greeting ${isLeaving ? "is-leaving" : ""} pointer-events-auto fixed bottom-[max(0.8rem,env(safe-area-inset-bottom))] right-3 z-[75] w-[min(22rem,calc(100vw-1.5rem))] cursor-pointer border-0 bg-transparent p-0 text-left focus:outline-none sm:bottom-5 sm:right-5`}
      aria-label={label}
      data-klemmi-login-greeting={active.kind}
      onClick={dismiss}
    >
      <span className="klemmi-login-greeting-copy block rounded-2xl border border-blue-100 bg-white/92 px-3 py-2 pr-16 text-sm font-medium leading-snug text-slate-800 shadow-lg backdrop-blur-sm sm:pr-20">
        {caption}
      </span>
      <span
        className="klemmi-login-greeting-mascot absolute -right-1 -top-12 size-20 sm:-top-14 sm:size-24"
        aria-hidden="true"
      >
        <KlemmiMascot isSpeaking={isSpeaking} decorative />
      </span>
    </button>,
    document.body
  );
}
