import {
  KLEMMI_OPENING_AUDIO_IDS,
  klemmiAudioUrl,
  type KlemmiAudioId,
} from "@/lib/klemmiAudio";
import {
  getKlemmiMuted,
  KLEMMI_MUTE_EVENT,
  setKlemmiMuted,
} from "@/lib/dashboard-klemmi-muted";
import { useCallback, useEffect, useRef, useState } from "react";

function chooseOpeningClip(previousClip: KlemmiAudioId | null) {
  const candidates = KLEMMI_OPENING_AUDIO_IDS.filter(
    clipId => clipId !== previousClip
  );
  return (
    candidates[Math.floor(Math.random() * candidates.length)] ??
    KLEMMI_OPENING_AUDIO_IDS[0]
  );
}

/**
 * Spielt ausschließlich vorproduzierte Klemmi-Clips aus lokalen Produktassets
 * ab. So bleibt Klemmi überall dieselbe warme, organisatorische Cartoon-Stimme
 * und der Browser weicht nicht auf eine uneinheitliche Systemstimme aus.
 */
export function useKlemmiVoice(options?: {
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
}) {
  const externalMuted = options?.muted;
  const onMutedChange = options?.onMutedChange;
  const [globalMuted, setGlobalMuted] = useState(getKlemmiMuted);
  const muted = Boolean(externalMuted) || globalMuted;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const releaseAudioRef = useRef<((completed: boolean) => void) | null>(null);
  const lastOpeningClipRef = useRef<KlemmiAudioId | null>(null);

  const cancel = useCallback(() => {
    const release = releaseAudioRef.current;
    releaseAudioRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    release?.(false);
    setIsSpeaking(false);
  }, []);

  /**
   * Spielt einen weiteren festen Produktclip ab. Die URL wird ausschließlich
   * im Quellcode aus einer festen Clip-ID
   * gebildet; sie enthält nie Nutzereingaben oder Planungsdaten.
   */
  const playUrl = useCallback(
    (url: string, clipLabel = "Klemmi") => {
      if (
        muted ||
        typeof window === "undefined" ||
        typeof Audio === "undefined"
      ) {
        return Promise.resolve(false);
      }
      cancel();

      return new Promise<boolean>(resolve => {
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = 0.9;
        audioRef.current = audio;
        let released = false;
        const release = (completed: boolean) => {
          if (released) return;
          released = true;
          if (audioRef.current === audio) audioRef.current = null;
          if (releaseAudioRef.current === release)
            releaseAudioRef.current = null;
          setIsSpeaking(false);
          resolve(completed);
        };
        releaseAudioRef.current = release;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => release(true);
        audio.onerror = () => {
          console.warn(
            `[KlemmiVoice] Markenclip „${clipLabel}“ konnte nicht geladen werden.`
          );
          release(false);
        };
        void audio.play().catch(() => {
          // Browser dürfen Audio ohne direkte Nutzeraktion blockieren. In diesem
          // Fall bleibt Klemmi stumm, statt auf eine fremde Systemstimme zu wechseln.
          release(false);
        });
      });
    },
    [cancel, muted]
  );

  const playClip = useCallback(
    (clipId: KlemmiAudioId) => {
      return playUrl(klemmiAudioUrl(clipId), clipId);
    },
    [playUrl]
  );

  useEffect(() => {
    const synchronizeGlobalMute = () => setGlobalMuted(getKlemmiMuted());
    window.addEventListener(KLEMMI_MUTE_EVENT, synchronizeGlobalMute);
    window.addEventListener("storage", synchronizeGlobalMute);
    return () => {
      window.removeEventListener(KLEMMI_MUTE_EVENT, synchronizeGlobalMute);
      window.removeEventListener("storage", synchronizeGlobalMute);
    };
  }, []);

  useEffect(() => {
    if (muted) cancel();
  }, [cancel, muted]);

  /**
   * Jeder bewusste Klick auf „Klemmi zeigt's“ erhält einen kurzen, zufällig
   * ausgewählten Einstieg. Der zuletzt verwendete Einstieg wird nie direkt
   * wiederholt; bei Stummschaltung beginnt die eigentliche Anleitung sofort.
   */
  const playOpening = useCallback(async () => {
    if (muted || !KLEMMI_OPENING_AUDIO_IDS.length) return false;
    const clipId = chooseOpeningClip(lastOpeningClipRef.current);
    lastOpeningClipRef.current = clipId;
    return playClip(clipId);
  }, [muted, playClip]);

  const speak = useCallback(
    (text: string, clipId?: KlemmiAudioId) => {
      if (!text.trim() || !clipId) return Promise.resolve(false);
      return playClip(clipId);
    },
    [playClip]
  );

  const toggleMuted = useCallback(() => {
    const next = !muted;
    setKlemmiMuted(next);
    setGlobalMuted(next);
    if (next) cancel();
    onMutedChange?.(next);
  }, [cancel, muted, onMutedChange]);

  useEffect(() => cancel, [cancel]);

  return { muted, isSpeaking, speak, playOpening, playUrl, toggleMuted, cancel };
}
