import { describe, expect, it } from "vitest";
import { isConfiguredOAuthOwner, isAuthorizedOAuthOwner } from "./db";

describe("konfigurierte OAuth-Eigentümer-Allowlist", () => {
  it("erlaubt nur die exakt konfigurierte und nicht leere Eigentümer-ID", () => {
    expect(isConfiguredOAuthOwner("owner-1", "owner-1")).toBe(true);
    expect(isConfiguredOAuthOwner("other-owner", "owner-1")).toBe(false);
    expect(isConfiguredOAuthOwner("owner-1", " ")).toBe(false);
  });

  it("lehnt leere oder unbekannte Identitäten bei der autorisierten Eigentümerprüfung ab", async () => {
    await expect(isAuthorizedOAuthOwner("")).resolves.toBe(false);
    await expect(isAuthorizedOAuthOwner("   ")).resolves.toBe(false);
  });
});
