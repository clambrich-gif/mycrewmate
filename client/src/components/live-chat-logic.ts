export const TYPING_RENEWAL_MS = 4_000;

/**
 * Der Server verwirft Tippstatus nach acht Sekunden. Während laufender Eingabe
 * wird der Status bewusst höchstens alle vier Sekunden erneuert.
 */
export function shouldRenewTypingStatus(lastReportedAt: number, now: number) {
  return lastReportedAt === 0 || now - lastReportedAt >= TYPING_RENEWAL_MS;
}
