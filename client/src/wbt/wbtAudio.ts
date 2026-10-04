import type { WbtChapter, WbtStep } from "./wbtData";

/**
 * Das WBT trennt bewusst die neutrale Lernsprecherstimme von Klemmi:
 * Der Sprecher erklärt den Ablauf; Klemmi gibt nur die persönliche,
 * praxisnahe Empfehlung. Alle IDs werden ausschließlich aus festen
 * Schulungsdaten gebildet und enthalten nie Nutzereingaben.
 */
const STEP_NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
] as const;

type StepNumberWord = (typeof STEP_NUMBER_WORDS)[number];

export type WbtKlemmiAudioClipId =
  | `wbt-${string}-step-${StepNumberWord}`
  | `wbt-${string}-summary`
  | "wbt-intro-klemmi"
  | "wbt-training-complete";

export type WbtNarratorAudioClipId =
  | `wbt-narrator-${string}-step-${StepNumberWord}`
  | "wbt-intro-narrator-welcome"
  | "wbt-intro-narrator-guidance";

export type WbtAudioClipId = WbtKlemmiAudioClipId | WbtNarratorAudioClipId;
export type WbtAudioSpeaker = "narrator" | "klemmi";

export const WBT_AUDIO_REVISION = "20261004-wbt-two-voices-v2";
export const WBT_COMPLETION_AUDIO_ID = "wbt-training-complete" as const;

export const WBT_INTRO_AUDIO = {
  narratorWelcome: "wbt-intro-narrator-welcome",
  klemmiGreeting: "wbt-intro-klemmi",
  narratorGuidance: "wbt-intro-narrator-guidance",
} as const satisfies Record<string, WbtAudioClipId>;

export const WBT_INTRO_TEXT = {
  narratorWelcome:
    "Willkommen in der MyCrewMate Lernwerkstatt. Bevor dein Training startet, lernst du Klemmi kennen: Klemmi ist dein digitaler Begleiter für die Vereins- und Eventplanung.",
  klemmiGreeting:
    "Hallo, ich bin Klemmi! Ich helfe dir dabei, die einzelnen Schritte verständlich und entspannt zu planen.",
  narratorGuidance:
    "Klemmi begleitet dich durch dieses Web-Based-Training. Du findest ihn später auch im echten MyCrewMate-Programm: Dort erklärt er dir die Funktionen direkt an der jeweiligen Stelle. Lass uns starten.",
} as const;

export function getWbtKlemmiStepAudioId(
  chapter: Pick<WbtChapter, "id">,
  step: Pick<WbtStep, "stepNumber">
): WbtKlemmiAudioClipId {
  const numberWord = STEP_NUMBER_WORDS[step.stepNumber] ?? "one";
  return `wbt-${chapter.id}-step-${numberWord}`;
}

export function getWbtNarratorStepAudioId(
  chapter: Pick<WbtChapter, "id">,
  step: Pick<WbtStep, "stepNumber">
): WbtNarratorAudioClipId {
  const numberWord = STEP_NUMBER_WORDS[step.stepNumber] ?? "one";
  return `wbt-narrator-${chapter.id}-step-${numberWord}`;
}

export function getWbtSummaryAudioId(
  chapter: Pick<WbtChapter, "id">
): WbtKlemmiAudioClipId {
  return `wbt-${chapter.id}-summary`;
}

export function wbtAudioUrl(clipId: WbtAudioClipId) {
  return `/api/klemmi/audio/${clipId}?v=${WBT_AUDIO_REVISION}`;
}

/** Neutraler Sprechertext: Erklärung plus hörbare Übergabe an Klemmi. */
export function getWbtNarratorStepSpeechText(
  step: Pick<WbtStep, "explanation">
) {
  return `${step.explanation} Klemmi empfiehlt hierzu:`;
}

/** Klemmi spricht ausschließlich die kurze, persönliche Empfehlung. */
export function getWbtKlemmiStepSpeechText(
  step: Pick<WbtStep, "klemmiTip">
) {
  return step.klemmiTip;
}

/** Kapitelzusammenfassungen sind bewusst Klemmis persönlicher Abschluss. */
export function getWbtSummarySpeechText(
  summary: Pick<WbtChapter["klemmiSummary"], "heading" | "text" | "takeaway">
) {
  return `${summary.heading}. ${summary.text} Kern-Erkenntnis: ${summary.takeaway}`;
}
