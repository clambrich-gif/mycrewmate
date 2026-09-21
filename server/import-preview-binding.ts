import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { ENV } from "./_core/env";

const PREVIEW_BINDING_TTL_MS = 15 * 60 * 1000;
const ALGORITHM = "sha256";

export type PreviewBindingOperation =
  | "project-file"
  | `module:${string}`
  | `modules:${string}`;

type PreviewBindingClaims = {
  version: 1;
  sourceDigest: string;
  currentDigest: string;
  year: number;
  eventId: number;
  operation: PreviewBindingOperation;
  userId: number;
  expiresAt: number;
};

type ExpectedPreviewBinding = Omit<PreviewBindingClaims, "version" | "expiresAt">;

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

const signingSecret = () => {
  if (!ENV.cookieSecret)
    throw new Error("Die Vorschau-Freigabe ist nicht konfiguriert");
  return ENV.cookieSecret;
};

const signature = (encodedClaims: string) =>
  createHmac(ALGORITHM, signingSecret()).update(encodedClaims).digest("base64url");

const rejected = () =>
  new Error(
    "Die Vorschau-Freigabe ist ungültig oder abgelaufen. Bitte die Datei erneut prüfen."
  );

export const uploadedFileDigest = (base64: string) =>
  createHash(ALGORITHM).update(Buffer.from(base64, "base64")).digest("hex");

/**
 * Bindet eine geprüfte Datei an Datenstand, Veranstaltung, Importart und den
 * Administrator, der die Vorschau erstellt hat. Das HMAC kann nicht vom Client
 * verändert oder für eine andere Datei wiederverwendet werden.
 */
export function createPreviewBinding(
  input: Omit<PreviewBindingClaims, "version" | "expiresAt">
) {
  const claims: PreviewBindingClaims = {
    ...input,
    version: 1,
    expiresAt: Date.now() + PREVIEW_BINDING_TTL_MS,
  };
  const encodedClaims = base64url(JSON.stringify(claims));
  return `${encodedClaims}.${signature(encodedClaims)}`;
}

export function verifyPreviewBinding(
  binding: string,
  expected: ExpectedPreviewBinding
) {
  const [encodedClaims, receivedSignature, ...remainder] = binding.split(".");
  if (!encodedClaims || !receivedSignature || remainder.length) throw rejected();

  const expectedSignature = signature(encodedClaims);
  const received = Buffer.from(receivedSignature, "utf8");
  const calculated = Buffer.from(expectedSignature, "utf8");
  if (
    received.length !== calculated.length ||
    !timingSafeEqual(received, calculated)
  )
    throw rejected();

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8"));
  } catch {
    throw rejected();
  }
  if (!claims || typeof claims !== "object") throw rejected();
  const parsed = claims as Partial<PreviewBindingClaims>;
  if (
    parsed.version !== 1 ||
    typeof parsed.expiresAt !== "number" ||
    !Number.isSafeInteger(parsed.expiresAt) ||
    parsed.expiresAt < Date.now() ||
    parsed.sourceDigest !== expected.sourceDigest ||
    parsed.currentDigest !== expected.currentDigest ||
    parsed.year !== expected.year ||
    parsed.eventId !== expected.eventId ||
    parsed.operation !== expected.operation ||
    parsed.userId !== expected.userId
  )
    throw rejected();
}
