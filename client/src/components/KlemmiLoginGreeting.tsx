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
const GREETING_VISIBLE_MS = 5_000;

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
  return Boolean(document.querySelector('[data-slot="dialog-content"][data-state="open"]'));
}

/**
 * Begrüßt jeden Zugang serverseitig höchstens einmal pro Kalendertag. Zusätzlich
 * bleibt Klemmi bei langer Ruhe sehr zurückhaltend und reagiert auf zentrale
 * Eingabefehler bzw. erfolgreiche Schichtbesetzungen ohne die Oberfläche zu sperren.
 */
export function KlemmiLoginGreeting({ enabled }: { enabled: boolean }) {
  const { isSpeaking, speak, cancel } = useKlemmiVoice();
  const claimDailyGreeting = trpc.auth.claimDailyKlemmiGreeting.useMutation();
  const [active, setActive] = useState<ActiveGreeting | null>(null);
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
        if (!result.show || !result.clipId || !isKlemmiAudioId(result.clipId)) return;
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
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "focus"];
    events.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleActivity);
    scheduleIdleHint();
    return () => {
      clearIdleTimer();
      events.forEach(eventName => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, [active, enabled, showLocalReaction]);

  useEffect(() => {
    if (!active) return;
    const speakTimer = window.setTimeout(() => {
      void speak(KLEMMI_AUDIO_SCRIPTS[active.clipId], active.clipId);
    }, 180);
    const dismissTimer = window.setTimeout(dismiss, GREETING_VISIBLE_MS);
    return () => {
      window.clearTimeout(speakTimer);
      window.clearTimeout(dismissTimer);
      cancel();
    };
  }, [active, cancel, dismiss, speak]);

  if (!active || typeof document === "undefined") return null;
  const caption = KLEMMI_AUDIO_SCRIPTS[active.clipId];
  const label =
    active.kind === "login"
      ? "Klemmis Tagesbegrüßung schließen"
      : "Klemmis Hinweis schließen";

  return createPortal(
    <button
      type="button"
      className="klemmi-login-greeting pointer-events-auto fixed bottom-[max(0.8rem,env(safe-area-inset-bottom))] right-3 z-[75] w-[min(22rem,calc(100vw-1.5rem))] cursor-pointer border-0 bg-transparent p-0 text-left focus:outline-none sm:bottom-5 sm:right-5"
      aria-label={label}
      data-klemmi-login-greeting={active.kind}
      onClick={dismiss}
    >
      <span className="klemmi-login-greeting-copy block rounded-2xl border border-blue-100 bg-white/92 px-3 py-2 pr-16 text-sm font-medium leading-snug text-slate-800 shadow-lg backdrop-blur-sm sm:pr-20">
        {caption}
      </span>
      <span className="klemmi-login-greeting-mascot absolute -right-1 -top-12 size-20 sm:-top-14 sm:size-24" aria-hidden="true">
        <KlemmiMascot isSpeaking={isSpeaking} decorative />
      </span>
    </button>,
    document.body
  );
}
