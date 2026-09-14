import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";

describe("OAuth-Sitzungswächter", () => {
  it("lehnt nicht zugelassene OAuth-Sitzungen ab, bevor ein Benutzer abgefragt oder angelegt wird", async () => {
    const openId = "__test__nicht-zugelassene-oauth-identitaet";
    const token = await sdk.createSessionToken(openId, {
      name: "Nicht zugelassen",
      expiresInMs: 60_000,
    });
    const getUserSpy = vi.spyOn(db, "getUserByOpenId");

    try {
      await expect(
        sdk.authenticateRequest({
          headers: { cookie: `${COOKIE_NAME}=${token}` },
        } as any)
      ).rejects.toThrow("OAuth session identity is not authorized");
      expect(getUserSpy).not.toHaveBeenCalled();
    } finally {
      getUserSpy.mockRestore();
    }
  });
});
