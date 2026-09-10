import bcrypt from "bcryptjs";
import type { Request } from "express";

export const SHARED_PASSWORD_OPEN_ID = "shared-password-user";
export const ADMIN_PASSWORD_OPEN_ID = "shared-password-admin";
export const PASSWORD_SESSION_MS = 1000 * 60 * 60 * 12;

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAttemptAt: number }>();

export function getClientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0];
  return raw?.trim() || req.ip || req.socket.remoteAddress || "unknown";
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
  return (currentEntry(key)?.count ?? 0) >= MAX_ATTEMPTS;
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

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
