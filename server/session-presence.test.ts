import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  ONLINE_WINDOW_MS,
  getOnlinePresenceStatus,
  sessionPresenceKey,
} from "./session-presence";
import * as db from "./db";
import { vi } from "vitest";

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

  it("liefert pro Verein aktive Rollenzähler mit Haupt- und Co-Admin-Kennzeichnung", async () => {
    const activeDate = new Date();
    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { role: "user", presenceRole: "planner", sessionName: "Anne Veling" },
            { role: "admin", presenceRole: "primary_admin", sessionName: "Holger Fischer" },
            { role: "user", presenceRole: "co_admin", sessionName: "Peter Lustig" },
            { role: "user", presenceRole: "co_admin", sessionName: "Peter Lustig" },
          ]),
        }),
      }),
    });
    vi.spyOn(db, "getDb").mockResolvedValue({
      select: selectMock,
    } as any);

    const status = await getOnlinePresenceStatus("rsv-musterstadt", activeDate);
    expect(status.planningTeamNames).toEqual(["Anne Veling"]);
    expect(status.administrators).toBe(3);
    expect(status.administratorNames).toEqual([
      "Holger Fischer (Hauptadministrator)",
      "Peter Lustig (Co-Admin)",
    ]);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });
});
