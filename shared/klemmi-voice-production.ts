/**
 * Verbindlicher Standard für künftig neu produzierte Klemmi-Stimmen.
 *
 * Diese Konfiguration löst bewusst keine Netzwerk- oder Sprach-KI-Anfrage aus.
 * MyCrewMate spielt ausschließlich vorher geprüfte, lokale MP3-Dateien ab.
 * Sie liefert der Produktion aber den einen unveränderlichen Parametersatz,
 * aus dem neue Sprachaufträge aufgebaut und geprüft werden müssen.
 */
export const KLEMMI_VOICE_PRODUCTION_CONFIG = Object.freeze({
  profileVersion: "2.0",

  /** Die fachliche und in MyCrewMate verwendete Bezeichnung der Charakterstimme. */
  voiceName: "Klemmi-Stimme",

  /**
   * Technische Kennung des Sprachdienstes. Sie ist keine sichtbare
   * MyCrewMate-Stimmenbezeichnung und darf nur für Sprachaufträge verwendet werden.
   */
  providerVoiceName: "Puck",
  languageCode: "de-DE",
  style: "high pitch, bright, playful, animated",
  candidateCount: 3,

  /**
   * Vom Projektinhaber am 20.10.2026 ausgewählte, hörbare Hauptreferenz.
   * Die Werte wurden mit der gemeinsamen librosa.pyin-Prüfmethode ermittelt.
   */
  primaryReference: {
    id: "klemmi-wetterbericht-referenz-b-plus-extrem-v1",
    fileName: "klemmi-wetterbericht-referenz-b-plus-extrem.wav",
    selectedAt: "2026-10-20T08:26:49+02:00",
    metrics: {
      durationSeconds: 13.6,
      wordsPerMinute: 136.8,
      meanF0Hz: 249.6,
      medianF0Hz: 205.3,
      f0P10Hz: 65.4,
      f0P90Hz: 432.2,
      f0P10ToP90RangeHz: 366.8,
      spectralBrightnessHz: 2431.6,
      activeLoudnessDbfs: -22.3,
    },
  },

  review: {
    requiresReferenceListening: true,
    requiresTechnicalComparison: true,
    requiresTranscriptCheck: true,
    /** Keine automatische Nachbearbeitung nur zum Erzwingen einzelner Messwerte. */
    prefersNaturalProsody: true,
    primaryReference: "klemmi-wetterbericht-referenz-b-plus-extrem-v1",
  },
} as const);

export type KlemmiSpeechRequest = Readonly<{
  voice_name: typeof KLEMMI_VOICE_PRODUCTION_CONFIG.providerVoiceName;
  language_code: typeof KLEMMI_VOICE_PRODUCTION_CONFIG.languageCode;
  turns: readonly [
    Readonly<{
      text: string;
      style: typeof KLEMMI_VOICE_PRODUCTION_CONFIG.style;
    }>,
  ];
}>;

/**
 * Baut ausschließlich den festen Sprachauftrag für ein bereits redaktionell
 * geprüftes Klemmi-Skript. Der Aufrufer erzeugt daraus drei Kandidaten und
 * übernimmt erst nach Hör- und Qualitätsprüfung eine MP3 in das Produkt.
 */
export function createKlemmiSpeechRequest(
  spokenText: string
): KlemmiSpeechRequest {
  const text = spokenText.trim();
  if (!text) throw new Error("Klemmi-Sprechtext darf nicht leer sein.");
  if (text.length > 6000) {
    throw new Error("Klemmi-Sprechtext überschreitet das sichere TTS-Limit.");
  }

  return {
    voice_name: KLEMMI_VOICE_PRODUCTION_CONFIG.providerVoiceName,
    language_code: KLEMMI_VOICE_PRODUCTION_CONFIG.languageCode,
    turns: [
      {
        text,
        style: KLEMMI_VOICE_PRODUCTION_CONFIG.style,
      },
    ],
  };
}
