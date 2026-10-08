/**
 * Klemmi meldet sich je Browser-Sitzung höchstens zweimal: nach fünf und nach
 * zehn Minuten ohne Aktivität. Jede Nutzeraktion startet die Messung der
 * aktuellen Ruhephase neu, ohne die bereits erreichten Hinweisstufen zu löschen.
 */
export const IDLE_HINT_DELAYS_MS = [5 * 60_000, 10 * 60_000] as const;
export const MAX_IDLE_HINTS_PER_SESSION = IDLE_HINT_DELAYS_MS.length;

/**
 * Gibt zurück, wie lange bis zur nächsten vorgesehenen Hinweisstufe noch zu
 * warten ist. Nach dem zweiten Hinweis gibt es bewusst keinen weiteren Timer.
 */
export function idleHintDelayMs(
  shownHints: number,
  idleForMs: number
): number | null {
  const threshold = IDLE_HINT_DELAYS_MS[shownHints];
  if (threshold === undefined) return null;
  return Math.max(0, threshold - Math.max(0, idleForMs));
}
