import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lokale Wiedergabe für die neutrale WBT-Sprecherstimme. Sie ist absichtlich
 * von Klemmi getrennt: Während der Fachtext läuft, bleibt Klemmi unbewegt.
 */
export function useWbtNarratorVoice({ muted }: { muted: boolean }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const releaseRef = useRef<((completed: boolean) => void) | null>(null);

  const cancel = useCallback(() => {
    const release = releaseRef.current;
    releaseRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    release?.(false);
    setIsSpeaking(false);
  }, []);

  const playUrl = useCallback(
    (url: string, clipLabel = "WBT-Sprecher") => {
      if (muted || typeof window === "undefined" || typeof Audio === "undefined") {
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
          if (releaseRef.current === release) releaseRef.current = null;
          setIsSpeaking(false);
          resolve(completed);
        };

        releaseRef.current = release;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => release(true);
        audio.onerror = () => {
          console.warn(`[WbtNarratorVoice] Clip „${clipLabel}“ konnte nicht geladen werden.`);
          release(false);
        };
        void audio.play().catch(() => release(false));
      });
    },
    [cancel, muted]
  );

  useEffect(() => {
    if (muted) cancel();
  }, [cancel, muted]);

  useEffect(() => cancel, [cancel]);

  return { isSpeaking, playUrl, cancel };
}
