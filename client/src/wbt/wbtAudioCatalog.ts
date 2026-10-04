import {
  WBT_ADMIN_CHAPTERS,
  WBT_HELPER_CHAPTERS,
  type WbtChapter,
} from "./wbtData";
import {
  getWbtStepAudioId,
  getWbtStepSpeechText,
  getWbtSummaryAudioId,
  getWbtSummarySpeechText,
  type WbtAudioClipId,
} from "./wbtAudio";

export type WbtAudioCatalogEntry = {
  id: WbtAudioClipId | "wbt-training-complete";
  text: string;
  kind: "step" | "summary" | "completion";
};

function uniqueChapters(chapters: WbtChapter[]): WbtChapter[] {
  return Array.from(new Map(chapters.map(chapter => [chapter.id, chapter])).values());
}

/**
 * Der komplette, revisionsfähige Textbestand aller WBT-Audios. Die
 * Helferkapitel sind in beiden Trainingspfaden identisch und werden deshalb
 * nur einmal aufgenommen. Die Aufnahmen enthalten keine Vereins- oder
 * Personendaten, sondern ausschließlich feste Schulungsinhalte.
 */
export const WBT_AUDIO_CATALOG: readonly WbtAudioCatalogEntry[] = [
  ...uniqueChapters([...WBT_HELPER_CHAPTERS, ...WBT_ADMIN_CHAPTERS]).flatMap(chapter => [
    ...chapter.steps.map(step => ({
      id: getWbtStepAudioId(chapter, step),
      text: getWbtStepSpeechText(step),
      kind: "step" as const,
    })),
    {
      id: getWbtSummaryAudioId(chapter),
      text: getWbtSummarySpeechText(chapter.klemmiSummary),
      kind: "summary" as const,
    },
  ]),
  {
    id: "wbt-training-complete",
    text: "Super gemacht! Du hast bewiesen, dass Planung im Ehrenamt richtig Spaß machen kann, wenn die Schritte klar sind. Egal ob Helferkontakt, Schichten oder Berechtigungen: Du bist bestens vorbereitet. Falls du im echten Event mal eine Frage hast: Klick mich einfach an!",
    kind: "completion",
  },
] as const;
