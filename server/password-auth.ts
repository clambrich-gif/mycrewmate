import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Request } from "express";

export const SHARED_PASSWORD_OPEN_ID = "shared-password-user";
export const ADMIN_PASSWORD_OPEN_ID = "shared-password-admin";
export const PASSWORD_SESSION_MS = 1000 * 60 * 60 * 12;
export const PLANNING_TEAM_MAX_ATTEMPTS = 5;

const ADMIN_MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAttemptAt: number }>();

/**
 * Client-spezifischer TTL-Rate-Limiter mit progressiver Verzögerung (Cooldown)
 * für das Planungsteam. Verhindert, dass anonyme Angreifer durch 5 Fehlversuche
 * das gesamte Planungsteam global lahmlegen (DoS-Schutz).
 */
type PlanningRateLimitEntry = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
};
const planningAttempts = new Map<string, PlanningRateLimitEntry>();

export function getClientKey(req: Request) {
  // X-Forwarded-For bleibt vollständig außerhalb der Sicherheitsgrenze, weil
  // dieser Dienst keine feste, exklusiv kontrollierte Proxy-IP voraussetzt.
  return req.socket.remoteAddress || "unknown";
}

function currentEntry(key: string) {
  const entry = attempts.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key);
    return undefined;
  }
  return entry;
}

export function isPasswordLoginBlocked(key: string) {
  return (currentEntry(key)?.count ?? 0) >= ADMIN_MAX_ATTEMPTS;
}

export function recordFailedPasswordLogin(key: string) {
  const entry = currentEntry(key);
  attempts.set(
    key,
    entry
      ? { ...entry, count: entry.count + 1 }
      : { count: 1, firstAttemptAt: Date.now() }
  );
}

export function clearPasswordLoginFailures(key: string) {
  attempts.delete(key);
}

export function getPlanningTeamCooldownMs(attemptCount: number): number {
  if (attemptCount < PLANNING_TEAM_MAX_ATTEMPTS) return 0;
  // Ab dem 5. Fehlversuch progressive Verzögerung:
  // 5 Versuche: 30s Cooldown
  // 6 Versuche: 60s (1m) Cooldown
  // 7 Versuche: 120s (2m) Cooldown
  // 8+ Versuche: 300s (5m) Cooldown (Maximum)
  const excess = attemptCount - PLANNING_TEAM_MAX_ATTEMPTS;
  if (excess === 0) return 30 * 1000;
  if (excess === 1) return 60 * 1000;
  if (excess === 2) return 120 * 1000;
  return 300 * 1000;
}

export function getPlanningTeamRateLimitStatus(clientKey: string): {
  isBlocked: boolean;
  retryAfterSeconds: number;
  attempts: number;
} {
  const entry = planningAttempts.get(clientKey);
  if (!entry) return { isBlocked: false, retryAfterSeconds: 0, attempts: 0 };

  const now = Date.now();
  // Zeitfenster abgelaufen (15 Minuten ohne neue Aktionen)?
  if (now - entry.firstAttemptAt > WINDOW_MS && now > entry.blockedUntil) {
    planningAttempts.delete(clientKey);
    return { isBlocked: false, retryAfterSeconds: 0, attempts: 0 };
  }

  if (now < entry.blockedUntil) {
    const remainingSec = Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
    return { isBlocked: true, retryAfterSeconds: remainingSec, attempts: entry.count };
  }

  return { isBlocked: false, retryAfterSeconds: 0, attempts: entry.count };
}

export function recordFailedPlanningTeamLogin(clientKey: string): {
  isBlocked: boolean;
  retryAfterSeconds: number;
  attempts: number;
} {
  const now = Date.now();
  const existing = planningAttempts.get(clientKey);
  const count = existing ? existing.count + 1 : 1;
  const firstAttemptAt = existing ? existing.firstAttemptAt : now;
  const cooldownMs = getPlanningTeamCooldownMs(count);
  const blockedUntil = cooldownMs > 0 ? now + cooldownMs : 0;

  planningAttempts.set(clientKey, { count, firstAttemptAt, blockedUntil });

  const remainingSec = cooldownMs > 0 ? Math.ceil(cooldownMs / 1000) : 0;
  return {
    isBlocked: remainingSec > 0,
    retryAfterSeconds: remainingSec,
    attempts: count,
  };
}

export function clearPlanningTeamFailures(clientKey: string) {
  planningAttempts.delete(clientKey);
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function verifyRecoveryKey(providedKey: string, configuredKey: string): boolean {
  const cleanProvided = providedKey.trim();
  const cleanConfigured = configuredKey.trim();
  if (!cleanConfigured || !cleanProvided) return false;
  const providedBuffer = Buffer.from(cleanProvided);
  const configuredBuffer = Buffer.from(cleanConfigured);
  if (providedBuffer.length !== configuredBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, configuredBuffer);
}
