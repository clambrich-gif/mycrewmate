import { randomBytes } from "node:crypto";
import { buildTotpUri, createTotpSecret, verifyTotpCode } from "./mfa";

const TEST_SESSION_TTL_MS = 10 * 60 * 1000;

type MfaTestSession = {
  secret: string;
  expiresAt: number;
  verifiedAt: number | null;
};

const sessions = new Map<string, MfaTestSession>();

function pruneExpiredSessions(now = Date.now()) {
  sessions.forEach((session, token) => {
    if (session.expiresAt <= now) sessions.delete(token);
  });
}

/**
 * Ausschließlich für die isolierte Manus-/Local-Vorschau.
 * Keine Datenbank, keine Benutzerkonten und keine Produktionsdomain werden berührt.
 */
export function isMfaTestLabAllowed(input: {
  environment?: string;
  hostname?: string | null;
}) {
  if (input.environment === "test") return true;
  if (input.environment === "production") return false;

  const hostname = (input.hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".manus.computer")
  );
}

export function createMfaTestSession(now = Date.now()) {
  pruneExpiredSessions(now);
  const secret = createTotpSecret();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + TEST_SESSION_TTL_MS;

  sessions.set(token, {
    secret,
    expiresAt,
    verifiedAt: null,
  });

  return {
    testSessionToken: token,
    otpauthUri: buildTotpUri({
      secret,
      accountName: "MFA-Testlabor (Vorschau)",
    }),
    expiresAt: new Date(expiresAt),
  } as const;
}

export function verifyMfaTestSession(input: {
  testSessionToken: string;
  code: string;
  now?: Date;
}) {
  const now = input.now?.getTime() ?? Date.now();
  pruneExpiredSessions(now);
  const session = sessions.get(input.testSessionToken);

  if (!session) {
    return {
      valid: false,
      reason: "expired" as const,
    };
  }

  if (!verifyTotpCode({ secret: session.secret, code: input.code, now: new Date(now) })) {
    return {
      valid: false,
      reason: "invalid" as const,
    };
  }

  session.verifiedAt = now;
  return {
    valid: true,
    expiresAt: new Date(session.expiresAt),
  } as const;
}

export function clearMfaTestSession(testSessionToken: string) {
  sessions.delete(testSessionToken);
}

export function mfaTestSessionCountForTests() {
  return sessions.size;
}
