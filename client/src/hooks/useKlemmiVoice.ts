import {
  KLEMMI_OPENING_AUDIO_IDS,
  klemmiAudioUrl,
  type KlemmiAudioId,
} from "@/lib/klemmiAudio";
import { useCallback, useEffect, useRef, useState } from "react";

function chooseOpeningClip(previousClip: KlemmiAudioId | null) {
  const candidates = KLEMMI_OPENING_AUDIO_IDS.filter(clipId => clipId !== previousClip);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? KLEMMI_OPENING_AUDIO_IDS[0];
}

/**
 * Spielt ausschließlich vorproduzierte Klemmi-Clips aus lokalen Produktassets
 * ab. So bleibt Klemmi überall dieselbe warme, organisatorische Cartoon-Stimme
 * und der Browser weicht nicht auf eine uneinheitliche Systemstimme aus.
 */
export function useKlemmiVoice() {
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastOpeningClipRef = useRef<KlemmiAudioId | null>(null);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const playClip = useCallback(
    (clipId: KlemmiAudioId) => {
      if (muted || typeof window === "undefined" || typeof Audio === "undefined") {
        return Promise.resolve();
      }
      cancel();

      return new Promise<void>(resolve => {
        const audio = new Audio(klemmiAudioUrl(clipId));
        audio.preload = "auto";
        audio.volume = 0.9;
        audioRef.current = audio;
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          if (audioRef.current === audio) audioRef.current = null;
          setIsSpeaking(false);
          resolve();
        };
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = release;
        audio.onerror = () => {
          console.warn(`[KlemmiVoice] Markenclip „${clipId}“ konnte nicht geladen werden.`);
          release();
        };
        void audio.play().catch(() => {
          // Browser dürfen Audio ohne direkte Nutzeraktion blockieren. In diesem
          // Fall bleibt Klemmi stumm, statt auf eine fremde Systemstimme zu wechseln.
          release();
        });
      });
    },
    [cancel, muted]
  );

  /**
   * Jeder bewusste Klick auf „Klemmi zeigt's“ erhält einen kurzen, zufällig
   * ausgewählten Einstieg. Der zuletzt verwendete Einstieg wird nie direkt
   * wiederholt; bei Stummschaltung beginnt die eigentliche Anleitung sofort.
   */
  const playOpening = useCallback(async () => {
    if (muted || !KLEMMI_OPENING_AUDIO_IDS.length) return;
    const clipId = chooseOpeningClip(lastOpeningClipRef.current);
    lastOpeningClipRef.current = clipId;
    await playClip(clipId);
  }, [muted, playClip]);

  const speak = useCallback(
    (text: string, clipId?: KlemmiAudioId) => {
      if (!text.trim() || !clipId) return;
      void playClip(clipId);
    },
    [playClip]
  );

  const toggleMuted = useCallback(() => {
    setMuted(current => {
      const next = !current;
      if (next) cancel();
      return next;
    });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { muted, isSpeaking, speak, playOpening, toggleMuted, cancel };
}
