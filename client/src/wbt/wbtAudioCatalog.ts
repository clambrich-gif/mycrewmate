import {
  WBT_ADMIN_CHAPTERS,
  WBT_HELPER_CHAPTERS,
  type WbtChapter,
} from "./wbtData";
import {
  getWbtKlemmiStepAudioId,
  getWbtKlemmiStepSpeechText,
  getWbtNarratorStepAudioId,
  getWbtNarratorStepSpeechText,
  getWbtSummaryAudioId,
  getWbtSummarySpeechText,
  WBT_COMPLETION_AUDIO_ID,
  WBT_INTRO_AUDIO,
  WBT_INTRO_TEXT,
  type WbtAudioClipId,
  type WbtAudioSpeaker,
} from "./wbtAudio";

export type WbtAudioCatalogEntry = {
  id: WbtAudioClipId;
  text: string;
  speaker: WbtAudioSpeaker;
  kind: "introduction" | "step-narration" | "step-tip" | "summary" | "completion";
};

function uniqueChapters(chapters: WbtChapter[]): WbtChapter[] {
  return Array.from(new Map(chapters.map(chapter => [chapter.id, chapter])).values());
}

/**
 * Vollständiger, revisionsfähiger Textbestand der WBT-Vertonung.
 * Jeder fachliche Schritt besteht aus zwei sauber getrennten Clips:
 * zuerst der neutrale Lernsprecher, anschließend Klemmi mit seiner Empfehlung.
 */
export const WBT_AUDIO_CATALOG: readonly WbtAudioCatalogEntry[] = [
  {
    id: WBT_INTRO_AUDIO.narratorWelcome,
    text: WBT_INTRO_TEXT.narratorWelcome,
    speaker: "narrator",
    kind: "introduction",
  },
  {
    id: WBT_INTRO_AUDIO.klemmiGreeting,
    text: WBT_INTRO_TEXT.klemmiGreeting,
    speaker: "klemmi",
    kind: "introduction",
  },
  {
    id: WBT_INTRO_AUDIO.narratorGuidance,
    text: WBT_INTRO_TEXT.narratorGuidance,
    speaker: "narrator",
    kind: "introduction",
  },
  ...uniqueChapters([...WBT_HELPER_CHAPTERS, ...WBT_ADMIN_CHAPTERS]).flatMap(chapter => [
    ...chapter.steps.flatMap(step => [
      {
        id: getWbtNarratorStepAudioId(chapter, step),
        text: getWbtNarratorStepSpeechText(step),
        speaker: "narrator" as const,
        kind: "step-narration" as const,
      },
      {
        id: getWbtKlemmiStepAudioId(chapter, step),
        text: getWbtKlemmiStepSpeechText(step),
        speaker: "klemmi" as const,
        kind: "step-tip" as const,
      },
    ]),
    {
      id: getWbtSummaryAudioId(chapter),
      text: getWbtSummarySpeechText(chapter.klemmiSummary),
      speaker: "klemmi" as const,
      kind: "summary" as const,
    },
  ]),
  {
    id: WBT_COMPLETION_AUDIO_ID,
    text: "Super gemacht! Du hast bewiesen, dass Planung im Ehrenamt richtig Spaß machen kann, wenn die Schritte klar sind. Egal ob Helferkontakt, Schichten oder Berechtigungen: Du bist bestens vorbereitet. Falls du im echten Event mal eine Frage hast: Klick mich einfach an!",
    speaker: "klemmi",
    kind: "completion",
  },
] as const;
