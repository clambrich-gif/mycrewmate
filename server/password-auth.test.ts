import { describe, expect, it } from "vitest";
import {
  clearPasswordLoginFailures,
  getClientKey,
  hashPassword,
  isPasswordLoginBlocked,
  recordFailedPasswordLogin,
  verifyPassword,
} from "./password-auth";

describe("Passwortschutz", () => {
  it("speichert kein Klartextpasswort und prüft den Hash korrekt", async () => {
    const hash = await hashPassword("Ein-starkes-Passwort-2026!");
    expect(hash).not.toContain("Ein-starkes-Passwort-2026!");
    await expect(
      verifyPassword("Ein-starkes-Passwort-2026!", hash)
    ).resolves.toBe(true);
    await expect(verifyPassword("falsch", hash)).resolves.toBe(false);
  });

  it("sperrt den temporären Admin-Schutz nach fünf Fehlversuchen und kann ihn zurücksetzen", () => {
    const key = "test-client-password-lock";
    clearPasswordLoginFailures(key);
    for (let index = 0; index < 4; index++) recordFailedPasswordLogin(key);
    expect(isPasswordLoginBlocked(key)).toBe(false);
    recordFailedPasswordLogin(key);
    expect(isPasswordLoginBlocked(key)).toBe(true);
    clearPasswordLoginFailures(key);
    expect(isPasswordLoginBlocked(key)).toBe(false);
  });

  it("ignoriert manipulierbares X-Forwarded-For für den Rate-Limit-Schlüssel", () => {
    const request = {
      headers: { "x-forwarded-for": "198.51.100.10" },
      socket: { remoteAddress: "10.0.0.8" },
    } as any;
    expect(getClientKey(request)).toBe("10.0.0.8");
    request.headers["x-forwarded-for"] = "203.0.113.44";
    expect(getClientKey(request)).toBe("10.0.0.8");
  });
});
