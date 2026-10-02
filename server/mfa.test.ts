import { describe, expect, it } from "vitest";
import {
  buildTotpUri,
  createRecoveryCodes,
  createTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodeMatches,
  verifyTotpCode,
} from "./mfa";

describe("MFA-Helfer", () => {
  it("erzeugt einen gültigen Base32-Schlüssel und eine otpauth-URL", () => {
    const secret = createTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{16,64}$/);
    const uri = buildTotpUri({ secret, accountName: "verein@test.de" });
    expect(uri).toContain("otpauth://totp/MyCrewMate%3Averein%40test.de");
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=MyCrewMate");
  });

  it("akzeptiert nur korrekte 6-stellige Codes und toleriert das Zeitfenster", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    expect(verifyTotpCode({ secret, code: "12345" })).toBe(false);
    expect(verifyTotpCode({ secret, code: "abcdef" })).toBe(false);
  });

  it("erzeugt und prüft acht eindeutige Recovery-Codes", () => {
    const codes = createRecoveryCodes();
    expect(codes).toHaveLength(8);
    const hashes = codes.map(hashRecoveryCode);
    expect(recoveryCodeMatches(codes[0], hashes)).toBe(true);
    expect(recoveryCodeMatches("FALSCH-CODE", hashes)).toBe(false);
    expect(normalizeRecoveryCode(codes[0])).toHaveLength(10);
  });
});
