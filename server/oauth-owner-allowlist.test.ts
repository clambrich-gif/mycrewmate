import { describe, expect, it } from "vitest";
import { isConfiguredOAuthOwner } from "./db";

describe("konfigurierte OAuth-Eigentümer-Allowlist", () => {
  it("erlaubt nur die exakt konfigurierte und nicht leere Eigentümer-ID", () => {
    expect(isConfiguredOAuthOwner("owner-1", "owner-1")).toBe(true);
    expect(isConfiguredOAuthOwner("other-owner", "owner-1")).toBe(false);
    expect(isConfiguredOAuthOwner("owner-1", " ")).toBe(false);
  });
});
