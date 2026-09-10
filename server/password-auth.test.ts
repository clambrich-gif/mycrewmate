import { describe, expect, it } from "vitest";
import {
  clearPasswordLoginFailures,
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

  it("sperrt nach fünf Fehlversuchen und kann nach Erfolg zurückgesetzt werden", () => {
    const key = "test-client-password-lock";
    clearPasswordLoginFailures(key);
    for (let index = 0; index < 4; index++) recordFailedPasswordLogin(key);
    expect(isPasswordLoginBlocked(key)).toBe(false);
    recordFailedPasswordLogin(key);
    expect(isPasswordLoginBlocked(key)).toBe(true);
    clearPasswordLoginFailures(key);
    expect(isPasswordLoginBlocked(key)).toBe(false);
  });
});
