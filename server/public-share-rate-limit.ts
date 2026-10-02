import type { Request } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type AttemptWindow = { count: number; firstAttemptAt: number };
const attempts = new Map<string, AttemptWindow>();

function clientKey(req?: Request) {
  // Der Express-Server vertraut ausschließlich dem einen Coolify-Proxy.
  // req.ip enthält damit die tatsächliche Client-IP, ohne frei übergebene Header
  // direkt auszuwerten.
  if (!req) return "unknown";
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function prune(now: number) {
  attempts.forEach((value, key) => {
    if (now - value.firstAttemptAt >= WINDOW_MS) attempts.delete(key);
  });
}

export function assertProtectedPdfShareAttemptAllowed(req?: Request) {
  const now = Date.now();
  prune(now);
  const key = clientKey(req);
  const state = attempts.get(key);
  if (state && state.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - state.firstAttemptAt)) / 1000));
    const error = new Error("Zu viele Versuche. Bitte versuchen Sie es in einigen Minuten erneut.");
    Object.assign(error, { code: "RATE_LIMITED", retryAfterSeconds });
    throw error;
  }
  return key;
}

export function recordProtectedPdfShareFailure(key: string) {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || now - state.firstAttemptAt >= WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    state.count += 1;
  }
}

export function clearProtectedPdfShareFailures(key: string) {
  attempts.delete(key);
}

export const PROTECTED_PDF_SHARE_MAX_ATTEMPTS = MAX_ATTEMPTS;
