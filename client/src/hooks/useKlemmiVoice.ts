import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spricht den jeweils sichtbaren Klemmi-Hinweis lokal über die
 * Browser-Sprachausgabe. Es werden keine Texte oder Nutzerdaten an einen
 * externen Sprachdienst übertragen.
 */
export function useKlemmiVoice() {
  const [muted, setMuted] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (
        muted ||
        !text.trim() ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        typeof SpeechSynthesisUtterance === "undefined"
      ) {
        return;
      }

      cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      // Leicht höhere Tonlage und etwas flotteres Tempo geben Klemmi eine
      // freundliche, zeichentrickhafte Wirkung, ohne die Verständlichkeit zu verlieren.
      utterance.pitch = 1.28;
      utterance.rate = 1.08;
      utterance.volume = 0.9;

      const germanVoice = window.speechSynthesis
        .getVoices()
        .find(voice => voice.lang.toLowerCase().startsWith("de"));
      if (germanVoice) utterance.voice = germanVoice;

      utterance.onend = () => {
        if (utteranceRef.current === utterance) utteranceRef.current = null;
      };
      utterance.onerror = () => {
        if (utteranceRef.current === utterance) utteranceRef.current = null;
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
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
