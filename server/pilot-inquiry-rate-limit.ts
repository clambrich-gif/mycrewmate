const PILOT_INQUIRY_WINDOW_MS = 15 * 60 * 1000;
const PILOT_INQUIRY_MAX_ATTEMPTS = 3;

type PilotInquiryAttempt = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, PilotInquiryAttempt>();

function pruneExpiredAttempts(now: number) {
  for (const [clientKey, entry] of Array.from(attempts.entries())) {
    if (entry.resetAt <= now) attempts.delete(clientKey);
  }
}

/**
 * Begrenzung für das öffentliche Pilotformular. Sie schützt die persönliche
 * Support-Adresse vor automatisiertem Versand, ohne Daten dauerhaft zu speichern.
 */
export function allowPublicPilotInquiryAttempt(clientKey: string, now = Date.now()) {
  pruneExpiredAttempts(now);
  const entry = attempts.get(clientKey);

  if (entry && entry.count >= PILOT_INQUIRY_MAX_ATTEMPTS) return false;

  attempts.set(clientKey, {
    count: (entry?.count ?? 0) + 1,
    resetAt: entry?.resetAt ?? now + PILOT_INQUIRY_WINDOW_MS,
  });
  return true;
}

/** Nur für automatische Tests; im laufenden Betrieb werden Einträge zeitbasiert entfernt. */
export function resetPublicPilotInquiryRateLimitForTests() {
  attempts.clear();
}

export const PUBLIC_PILOT_INQUIRY_RATE_LIMIT = {
  maxAttempts: PILOT_INQUIRY_MAX_ATTEMPTS,
  windowMs: PILOT_INQUIRY_WINDOW_MS,
} as const;
