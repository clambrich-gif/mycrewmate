import { klemmiAudioUrl, type KlemmiAudioId } from "@/lib/klemmiAudio";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spielt ausschließlich vorproduzierte Klemmi-Clips aus lokalen Produktassets
 * ab. So bleibt Klemmi überall dieselbe warme, organisatorische Cartoon-Stimme
 * und der Browser weicht nicht auf eine uneinheitliche Systemstimme aus.
 */
export function useKlemmiVoice() {
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const speak = useCallback(
    (text: string, clipId?: KlemmiAudioId) => {
      if (muted || !text.trim() || typeof window === "undefined" || !clipId || typeof Audio === "undefined") {
        return;
      }
      cancel();

      const audio = new Audio(klemmiAudioUrl(clipId));
      audio.preload = "auto";
      audio.volume = 0.9;
      audioRef.current = audio;
      const release = () => {
        if (audioRef.current === audio) audioRef.current = null;
      };
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
    },
    [cancel, muted]
  );

  const toggleMuted = useCallback(() => {
    setMuted(current => {
      const next = !current;
      if (next) cancel();
      return next;
    });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { muted, speak, toggleMuted, cancel };
}
