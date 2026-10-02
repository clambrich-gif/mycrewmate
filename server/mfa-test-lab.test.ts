import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { buildTotpUri } from "./mfa";
import {
  createMfaTestSession,
  isMfaTestLabAllowed,
  mfaTestSessionCountForTests,
  verifyMfaTestSession,
} from "./mfa-test-lab";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value: string) {
  let bits = 0;
  let accumulator = 0;
  const output: number[] = [];
  for (const character of value) {
    accumulator = (accumulator << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function codeFor(secret: string, now: Date) {
  const counter = Math.floor(now.getTime() / 1000 / 30);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

describe("isoliertes MFA-Testlabor", () => {
  it("erlaubt es ausschließlich außerhalb der Produktivumgebung auf lokalen oder Manus-Vorschauhosts", () => {
    expect(isMfaTestLabAllowed({ environment: "development", hostname: "localhost" })).toBe(true);
    expect(isMfaTestLabAllowed({ environment: "development", hostname: "3000-preview.manus.computer" })).toBe(true);
    expect(isMfaTestLabAllowed({ environment: "development", hostname: "www.mycrewmate.de" })).toBe(false);
    expect(isMfaTestLabAllowed({ environment: "production", hostname: "3000-preview.manus.computer" })).toBe(false);
  });

  it("erzeugt nur kurzlebige Sessions und bestätigt einen tatsächlichen TOTP-Code", () => {
    const now = new Date("2026-10-02T16:30:00.000Z");
    const test = createMfaTestSession(now.getTime());
    const sessionCountBefore = mfaTestSessionCountForTests();

    expect(test.otpauthUri).toContain("otpauth://totp/");
    expect(verifyMfaTestSession({ testSessionToken: test.testSessionToken, code: "123456", now })).toEqual({
      valid: false,
      reason: "invalid",
    });

    // Der TOTP-Schlüssel steckt ausschließlich im Server-Speicher. Für diesen Test
    // wird die URL dekodiert, damit der reale kryptografische Ablauf geprüft wird.
    const secret = new URL(test.otpauthUri).searchParams.get("secret");
    expect(secret).toMatch(/^[A-Z2-7]{16,64}$/);
    expect(
      verifyMfaTestSession({
        testSessionToken: test.testSessionToken,
        code: codeFor(secret!, now),
        now,
      })
    ).toMatchObject({ valid: true });
    expect(mfaTestSessionCountForTests()).toBe(sessionCountBefore);
  });

  it("verwirft abgelaufene Testschlüssel automatisch", () => {
    const now = new Date("2026-10-02T16:30:00.000Z");
    const test = createMfaTestSession(now.getTime());

    expect(
      verifyMfaTestSession({
        testSessionToken: test.testSessionToken,
        code: "123456",
        now: new Date(now.getTime() + 10 * 60 * 1000 + 1),
      })
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("erzeugt aus einer otpauth-URI einen lokal gerenderten QR-Code", async () => {
    const image = await QRCode.toDataURL(
      buildTotpUri({ secret: "JBSWY3DPEHPK3PXP", accountName: "MFA-Testlabor" }),
      { errorCorrectionLevel: "M", width: 192 }
    );

    expect(image).toMatch(/^data:image\/png;base64,/);
  });

  it("belässt das Testlabor ausschließlich auf dem expliziten Stagingpfad", () => {
    const app = readFileSync(path.resolve(__dirname, "../client/src/App.tsx"), "utf8");
    const layout = readFileSync(path.resolve(__dirname, "../client/src/components/Layout.tsx"), "utf8");

    expect(app).toContain('path="/_staging/mfa-testlabor"');
    expect(app).not.toContain('path="/mfa-testlabor"');
    expect(layout).not.toContain('href="/_staging/mfa-testlabor"');
    expect(layout).not.toContain("MFA-Testlabor öffnen (ohne Login)");
  });
});
