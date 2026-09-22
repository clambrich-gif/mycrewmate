import { describe, expect, it } from "vitest";
import { getSessionCookieOptions, isEmbeddedManusPreview } from "./_core/cookies";

function requestFor(hostname: string, protocol = "https") {
  return {
    hostname,
    protocol,
    headers: { "x-forwarded-proto": protocol },
  } as any;
}

describe("Session-Cookies für MyCrewMate", () => {
  it("setzt in der eingebetteten Manus-Vorschau einen Secure-SameSite-None-Cookie", () => {
    const req = requestFor("3000-i3grg6r1ftlulshgj6h98-09e2c58f.us1.manus.computer");

    expect(isEmbeddedManusPreview(req)).toBe(true);
    expect(getSessionCookieOptions(req)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("belässt MyCrewMate.de bei der Same-Origin-Sitzung mit SameSite=Lax", () => {
    const req = requestFor("mycrewmate.de");

    expect(isEmbeddedManusPreview(req)).toBe(false);
    expect(getSessionCookieOptions(req)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});
