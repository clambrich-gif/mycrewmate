import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;

function normalizeBase32(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

function base32Encode(value: Buffer) {
  let bits = 0;
  let accumulator = 0;
  let encoded = "";
  for (let index = 0; index < value.length; index++) {
    const byte = value[index];
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32_ALPHABET[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    encoded += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  }
  return encoded;
}

function base32Decode(value: string) {
  const normalized = normalizeBase32(value);
  if (!/^[A-Z2-7]{16,128}$/.test(normalized)) {
    throw new Error("Ungültiger TOTP-Schlüssel");
  }
  let bits = 0;
  let accumulator = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function calculateTotp(secret: string, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

export function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function buildTotpUri(input: { secret: string; accountName: string }) {
  const issuer = "MyCrewMate";
  const label = `${issuer}:${input.accountName}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(
    normalizeBase32(input.secret)
  )}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function verifyTotpCode(input: {
  secret: string;
  code: string;
  now?: Date;
}) {
  const code = input.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor((input.now?.getTime() ?? Date.now()) / 1000 / TOTP_STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    const expected = calculateTotp(input.secret, counter + offset);
    if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true;
  }
  return false;
}

export function createRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256")
    .update(`mycrewmate:mfa-recovery:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

export function recoveryCodeMatches(code: string, hashes: string[]) {
  const candidate = Buffer.from(hashRecoveryCode(code));
  return hashes.some(hash => {
    const known = Buffer.from(hash);
    return known.length === candidate.length && timingSafeEqual(known, candidate);
  });
}
