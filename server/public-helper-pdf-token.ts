import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const TOKEN_VERSION = 1;
export const PUBLIC_HELPER_PDF_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type PublicHelperPdfClaims = {
  version: typeof TOKEN_VERSION;
  year: number;
  eventId: number;
  helperId: number;
  expiresAt: number;
};

export type PublicHelperPdfScope = Pick<
  PublicHelperPdfClaims,
  "year" | "eventId" | "helperId"
>;

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

function signingSecret() {
  if (!ENV.cookieSecret) {
    throw new Error("Die öffentliche PDF-Freigabe ist nicht konfiguriert");
  }
  return ENV.cookieSecret;
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret())
    .update(`public-helper-pdf:${payload}`)
    .digest("base64url");
}

function sameSignature(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

/**
 * Erstellt eine nicht erratbare, HMAC-signierte Freigabe für genau einen Helfer
 * im gewählten Veranstaltungs-Scope. Es werden keine personenbezogenen Daten in
 * Klartext in der URL hinterlegt.
 */
export function createPublicHelperPdfToken(
  scope: PublicHelperPdfScope,
  now = Date.now()
) {
  const claims: PublicHelperPdfClaims = {
    version: TOKEN_VERSION,
    year: scope.year,
    eventId: scope.eventId,
    helperId: scope.helperId,
    expiresAt: now + PUBLIC_HELPER_PDF_LINK_TTL_MS,
  };
  const encodedClaims = base64url(JSON.stringify(claims));
  return `${encodedClaims}.${signature(encodedClaims)}`;
}

/** Liefert nur bei gültiger Signatur und noch nicht abgelaufener Freigabe Claims. */
export function verifyPublicHelperPdfToken(
  token: string,
  now = Date.now()
): PublicHelperPdfClaims | null {
  const [encodedClaims, receivedSignature, ...remainder] = token.split(".");
  if (!encodedClaims || !receivedSignature || remainder.length) return null;

  let expectedSignature: string;
  try {
    expectedSignature = signature(encodedClaims);
  } catch {
    return null;
  }
  if (!sameSignature(receivedSignature, expectedSignature)) return null;

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;

  const claims = value as Partial<PublicHelperPdfClaims>;
  const { version, year, eventId, helperId, expiresAt } = claims;
  if (
    version !== TOKEN_VERSION ||
    typeof year !== "number" ||
    typeof eventId !== "number" ||
    typeof helperId !== "number" ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(year) ||
    !Number.isSafeInteger(eventId) ||
    !Number.isSafeInteger(helperId) ||
    !Number.isSafeInteger(expiresAt) ||
    year < 2020 ||
    year > 2100 ||
    eventId <= 0 ||
    helperId <= 0 ||
    expiresAt <= now
  ) {
    return null;
  }

  return { version: TOKEN_VERSION, year, eventId, helperId, expiresAt };
}
