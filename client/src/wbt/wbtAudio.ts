import type { WbtChapter, WbtStep } from "./wbtData";

/**
 * Jede WBT-Erklärung besitzt einen festen, vorproduzierten Klemmi-Clip.
 * Die IDs werden ausschließlich aus definierten Trainingsdaten gebildet und
 * niemals aus Nutzereingaben. Dadurch bleibt die WBT-Audioauslieferung
 * vollständig datenfrei und vorhersagbar.
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

export type WbtAudioClipId =
  | `wbt-${string}-step-${(typeof STEP_NUMBER_WORDS)[number]}`
  | `wbt-${string}-summary`
  | "wbt-training-complete";

export const WBT_AUDIO_REVISION = "20261004-wbt-klemmi-v1";
export const WBT_COMPLETION_AUDIO_ID = "wbt-training-complete";

export function getWbtStepAudioId(
  chapter: Pick<WbtChapter, "id">,
  step: Pick<WbtStep, "stepNumber">
): WbtAudioClipId {
  const numberWord = STEP_NUMBER_WORDS[step.stepNumber] ?? "one";
  return `wbt-${chapter.id}-step-${numberWord}`;
}

export function getWbtSummaryAudioId(
  chapter: Pick<WbtChapter, "id">
): WbtAudioClipId {
  return `wbt-${chapter.id}-summary`;
}

export function wbtKlemmiAudioUrl(clipId: WbtAudioClipId) {
  return `/api/klemmi/audio/${clipId}?v=${WBT_AUDIO_REVISION}`;
}

/** Vollständiger, für die Aufnahme bestimmter Sprechtext eines Trainingsschritts. */
export function getWbtStepSpeechText(step: Pick<WbtStep, "explanation" | "klemmiTip">) {
  return `${step.explanation} Klemmi sagt: ${step.klemmiTip}`;
}

/** Vollständiger, für die Aufnahme bestimmter Sprechtext einer Kapitelzusammenfassung. */
export function getWbtSummarySpeechText(
  summary: Pick<WbtChapter["klemmiSummary"], "heading" | "text" | "takeaway">
) {
  return `${summary.heading}. ${summary.text} Kern-Erkenntnis: ${summary.takeaway}`;
}
