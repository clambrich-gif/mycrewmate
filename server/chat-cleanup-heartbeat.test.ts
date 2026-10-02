import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
const cleanupMocks = vi.hoisted(() => ({
  cleanupExpiredClosedEvents: vi.fn(),
  cleanupExpiredOperationalAuditLogs: vi.fn(),
  cleanupExpiredProtectedHelperPdfShares: vi.fn(),
  cleanupExpiredTransientSecurityRecords: vi.fn(),
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
    authMocks.authenticateRequest.mockResolvedValue({
      isCron: true,
      taskUid: "cron_1",
    });
    cleanupMocks.cleanupExpiredTeamNotes.mockResolvedValue(4);
    cleanupMocks.cleanupExpiredTeamNoteTypings.mockResolvedValue(2);
    cleanupMocks.cleanupExpiredProtectedHelperPdfShares.mockResolvedValue(1);
    cleanupMocks.cleanupExpiredTransientSecurityRecords.mockResolvedValue({
      tenantAdminInvitationsDeleted: 1,
      planningTeamInvitationsDeleted: 0,
      handoffsDeleted: 1,
      revokedSessionsDeleted: 2,
    });
    cleanupMocks.cleanupExpiredOperationalAuditLogs.mockResolvedValue({
      activityLogsDeleted: 2,
      deletionLogsDeleted: 1,
      teamNoteLogsDeleted: 0,
    });
    cleanupMocks.cleanupExpiredClosedEvents.mockResolvedValue({
      eventsDeleted: 1,
      filesDeleted: 3,
    });
    const res = response();

    await handleTeamNotesCleanupHeartbeat({} as any, res as any);

    expect(cleanupMocks.cleanupExpiredTeamNotes).toHaveBeenCalledOnce();
    expect(cleanupMocks.cleanupExpiredTeamNoteTypings).toHaveBeenCalledOnce();
    expect(
      cleanupMocks.cleanupExpiredProtectedHelperPdfShares
    ).toHaveBeenCalledOnce();
    expect(cleanupMocks.cleanupExpiredTransientSecurityRecords).toHaveBeenCalledOnce();
    expect(cleanupMocks.cleanupExpiredOperationalAuditLogs).toHaveBeenCalledOnce();
    expect(cleanupMocks.cleanupExpiredClosedEvents).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        expiredNotesDeleted: 4,
        expiredTypingDeleted: 2,
        expiredPdfSharesDeleted: 1,
        expiredClosedEvents: { eventsDeleted: 1, filesDeleted: 3 },
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
