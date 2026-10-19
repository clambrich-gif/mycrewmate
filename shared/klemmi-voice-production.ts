/**
 * Verbindlicher Standard für künftig neu produzierte Klemmi-Puck-Aufnahmen.
 *
 * Diese Konfiguration löst bewusst keine Netzwerk- oder Sprach-KI-Anfrage aus.
 * MyCrewMate spielt ausschließlich vorher geprüfte, lokale MP3-Dateien ab.
 * Sie liefert der Produktion aber den einen unveränderlichen Parametersatz,
 * aus dem neue Sprachaufträge aufgebaut werden müssen.
 */
export const KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG = Object.freeze({
  profileVersion: "1.0",
  voiceName: "Puck",
  languageCode: "de-DE",
  style: "high pitch, bright, playful, animated",
  candidateCount: 3,
  review: {
    requiresReferenceListening: true,
    requiresTechnicalComparison: true,
    primaryReference: "weather-report-character-v1",
    secondaryReference: "live-dashboard-countdown-v1",
  },
} as const);

export type KlemmiPuckSpeechRequest = Readonly<{
  voice_name: typeof KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG.voiceName;
  language_code: typeof KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG.languageCode;
  turns: readonly [
    Readonly<{
      text: string;
      style: typeof KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG.style;
    }>,
  ];
}>;

/**
 * Baut ausschließlich den festen Sprachauftrag für ein bereits redaktionell
 * geprüftes Klemmi-Skript. Der Aufrufer erzeugt daraus drei Kandidaten und
 * übernimmt erst nach Hör- und Qualitätsprüfung eine MP3 in das Produkt.
 */
export function createKlemmiPuckSpeechRequest(
  spokenText: string
): KlemmiPuckSpeechRequest {
  const text = spokenText.trim();
  if (!text) throw new Error("Klemmi-Sprechtext darf nicht leer sein.");
  if (text.length > 6000) {
    throw new Error("Klemmi-Sprechtext überschreitet das sichere TTS-Limit.");
  }

  return {
    voice_name: KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG.voiceName,
    language_code: KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG.languageCode,
    turns: [
      {
        text,
        style: KLEMMI_PUCK_AUDIO_PRODUCTION_CONFIG.style,
      },
    ],
  };
}
