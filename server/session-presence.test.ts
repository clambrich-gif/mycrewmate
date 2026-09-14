import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { ONLINE_WINDOW_MS, sessionPresenceKey } from "./session-presence";

const request = (headers: Record<string, string>) =>
  ({ headers }) as unknown as Request;

describe("Session-Presence", () => {
  it("bildet Cookie- und Bearer-Session desselben Tokens auf denselben anonymen Schlüssel ab", () => {
    const token = "signed-session-token";
    const cookieKey = sessionPresenceKey(
      request({ cookie: `app_session_id=${token}; other=value` })
    );
    const bearerKey = sessionPresenceKey(
      request({ authorization: `Bearer ${token}` })
    );

    expect(cookieKey).toBe(bearerKey);
    expect(cookieKey).toMatch(/^[a-f0-9]{64}$/);
    expect(cookieKey).not.toContain(token);
  });

  it("bevorzugt wie die Authentifizierung das Session-Cookie vor einem Bearer-Header", () => {
    const combinedKey = sessionPresenceKey(
      request({
        cookie: "app_session_id=cookie-token",
        authorization: "Bearer bearer-token",
      })
    );
    const cookieKey = sessionPresenceKey(
      request({ cookie: "app_session_id=cookie-token" })
    );

    expect(combinedKey).toBe(cookieKey);
  });

  it("liefert ohne authentifizierendes Token keinen Präsenzschlüssel", () => {
    expect(sessionPresenceKey(request({}))).toBeNull();
    expect(sessionPresenceKey(request({ authorization: "Basic abc" }))).toBeNull();
  });

  it("definiert das Aktivitätsfenster exakt mit zehn Minuten", () => {
    expect(ONLINE_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});
