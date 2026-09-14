import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
const cleanupMocks = vi.hoisted(() => ({
  cleanupExpiredTeamNotes: vi.fn(),
  cleanupExpiredTeamNoteTypings: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: authMocks }));
vi.mock("./db", () => cleanupMocks);

import { handleTeamNotesCleanupHeartbeat } from "./chat-cleanup-heartbeat";

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("Teamnotizen-Cleanup-Heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("akzeptiert ausschließlich Cron-Aufrufe und bereinigt beide abgelaufenen Datenarten", async () => {
    authMocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "cron_1" });
    cleanupMocks.cleanupExpiredTeamNotes.mockResolvedValue(4);
    cleanupMocks.cleanupExpiredTeamNoteTypings.mockResolvedValue(2);
    const res = response();

    await handleTeamNotesCleanupHeartbeat({} as any, res as any);

    expect(cleanupMocks.cleanupExpiredTeamNotes).toHaveBeenCalledOnce();
    expect(cleanupMocks.cleanupExpiredTeamNoteTypings).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        expiredNotesDeleted: 4,
        expiredTypingDeleted: 2,
      })
    );
  });

  it("verweigert normale Sitzungen ohne Datenbereinigung", async () => {
    authMocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();

    await handleTeamNotesCleanupHeartbeat({} as any, res as any);

    expect(cleanupMocks.cleanupExpiredTeamNotes).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
