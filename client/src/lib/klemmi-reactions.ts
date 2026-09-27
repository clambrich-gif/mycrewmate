export const KLEMMI_REACTION_EVENT = "mycrewmate:klemmi-reaction";

export type KlemmiReactionKind = "error" | "shift-success";

/**
 * Meldet eine kurze, nicht blockierende Klemmi-Reaktion an die globale
 * Arbeitsoberfläche. Fachseiten behalten dabei ihre eigenen Fehlermeldungen
 * und Bedienabläufe vollständig bei.
 */
export function triggerKlemmiReaction(kind: KlemmiReactionKind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<KlemmiReactionKind>(KLEMMI_REACTION_EVENT, { detail: kind })
  );
}
