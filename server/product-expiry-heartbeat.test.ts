import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
const mailMocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  renderPilotEndEmail: vi.fn(),
  renderProductExpiryReminderEmail: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  archiveExpiredPilotTenants: vi.fn(),
  claimPilotEndNotification: vi.fn(),
  cleanupExpiredArchivedPilotTenants: vi.fn(),
  cleanupExpiredAnonymousPublicReachMetrics: vi.fn(),
  cleanupExpiredPilotInquiries: vi.fn(),
  listTenantProductExpiryReminderCandidates: vi.fn(),
  listPendingPilotEndNotifications: vi.fn(),
  markPilotEndNotificationSent: vi.fn(),
  claimTenantProductExpiryReminder: vi.fn(),
  releasePilotEndNotificationClaim: vi.fn(),
  markTenantProductExpiryReminderSent: vi.fn(),
  releaseTenantProductExpiryReminderClaim: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: authMocks }));
vi.mock("./mail-service", () => mailMocks);
vi.mock("./db", () => dbMocks);

import {
  handleProductExpiryReminderHeartbeat,
  runPilotLifecycle,
  sendUpcomingProductExpiryReminders,
} from "./product-expiry-heartbeat";

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("Automatische Paketablauf-Benachrichtigung (7-Tage-Fenster)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.archiveExpiredPilotTenants.mockResolvedValue([]);
    dbMocks.listPendingPilotEndNotifications.mockResolvedValue([]);
    dbMocks.cleanupExpiredPilotInquiries.mockResolvedValue({ inquiriesDeleted: 0 });
    dbMocks.cleanupExpiredArchivedPilotTenants.mockResolvedValue({ tenantsDeleted: 0, filesDeleted: 0 });
    dbMocks.cleanupExpiredAnonymousPublicReachMetrics.mockResolvedValue({ metricsDeleted: 0 });
  });

  it("sendet Erinnerungen für fällige Test- und Aktivzugänge und markiert sie atomar als versendet", async () => {
    dbMocks.listTenantProductExpiryReminderCandidates.mockResolvedValue([
      {
        tenantId: "rsc-mayen",
        tenantName: "RSC Eifelland Mayen e. V.",
        contactEmail: "vorstand@rsc-mayen.de",
        packageId: "event_pass",
        status: "test",
        endsOn: "2026-10-06",
        daysRemaining: 7,
      },
      {
        tenantId: "tus-eifel",
        tenantName: "TuS Eifeltal e. V.",
        contactEmail: "info@tus-eifel.de",
        packageId: "light",
        status: "active",
        endsOn: "2026-10-02",
        daysRemaining: 3,
      },
    ]);
    dbMocks.claimTenantProductExpiryReminder.mockResolvedValue(true);
    mailMocks.renderProductExpiryReminderEmail.mockReturnValue({
      subject: "Test-Betreff",
      text: "Test-Text",
      html: "<p>Test</p>",
    });
    mailMocks.sendTransactionalEmail.mockResolvedValue({ success: true, simulated: false });
    mailMocks.sendTransactionalEmail.mockResolvedValue({ success: true, simulated: false });

    const result = await sendUpcomingProductExpiryReminders(new Date("2026-09-29T08:00:00Z"));

    expect(result).toEqual({
      candidates: 2,
      claimed: 2,
      sent: 2,
      skipped: 0,
      failed: 0,
    });
    expect(dbMocks.claimTenantProductExpiryReminder).toHaveBeenCalledTimes(2);
    expect(mailMocks.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(dbMocks.markTenantProductExpiryReminderSent).toHaveBeenCalledTimes(2);
    expect(dbMocks.releaseTenantProductExpiryReminderClaim).not.toHaveBeenCalled();
  });

  it("gibt den Lease frei, wenn der SMTP-Versand fehlschlägt, damit der nächste Heartbeat es erneut versuchen kann", async () => {
    dbMocks.listTenantProductExpiryReminderCandidates.mockResolvedValue([
      {
        tenantId: "rsc-mayen",
        tenantName: "RSC Eifelland Mayen e. V.",
        contactEmail: "vorstand@rsc-mayen.de",
        packageId: "pro",
        status: "test",
        endsOn: "2026-10-01",
        daysRemaining: 2,
      },
    ]);
    dbMocks.claimTenantProductExpiryReminder.mockResolvedValue(true);
    mailMocks.renderProductExpiryReminderEmail.mockReturnValue({
      subject: "Test-Betreff",
      text: "Test-Text",
      html: "<p>Test</p>",
    });
    mailMocks.sendTransactionalEmail.mockResolvedValue({ success: false, simulated: false });

    const result = await sendUpcomingProductExpiryReminders(new Date("2026-09-29T08:00:00Z"));

    expect(result).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 0,
      skipped: 0,
      failed: 1,
    });
    expect(dbMocks.markTenantProductExpiryReminderSent).not.toHaveBeenCalled();
    expect(dbMocks.releaseTenantProductExpiryReminderClaim).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "rsc-mayen", endsOn: "2026-10-01" })
    );
  });

  it("überspringt Vereine, die gerade von einem parallelen Lauf reserviert sind", async () => {
    dbMocks.listTenantProductExpiryReminderCandidates.mockResolvedValue([
      {
        tenantId: "rsc-mayen",
        tenantName: "RSC Eifelland Mayen e. V.",
        contactEmail: "vorstand@rsc-mayen.de",
        packageId: "enterprise",
        status: "active",
        endsOn: "2026-10-05",
        daysRemaining: 6,
      },
    ]);
    dbMocks.claimTenantProductExpiryReminder.mockResolvedValue(false);

    const result = await sendUpcomingProductExpiryReminders(new Date("2026-09-29T08:00:00Z"));

    expect(result).toEqual({
      candidates: 1,
      claimed: 0,
      sent: 0,
      skipped: 1,
      failed: 0,
    });
    expect(mailMocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("archiviert einen abgelaufenen Piloten, bestätigt die Aufbewahrungsfrist per E-Mail und bereinigt fällige Daten", async () => {
    dbMocks.archiveExpiredPilotTenants.mockResolvedValue([{ tenantId: "rsc-mayen" }]);
    dbMocks.listPendingPilotEndNotifications.mockResolvedValue([
      {
        notificationId: 7,
        tenantId: "rsc-mayen",
        tenantName: "RSC Eifelland Mayen e. V.",
        contactEmail: "vorstand@rsc-mayen.de",
        packageId: "pro",
        endsOn: "2026-10-01",
        archivedAt: new Date("2026-10-02T08:00:00Z"),
        retentionEndsAt: new Date("2029-10-02T08:00:00Z"),
      },
    ]);
    dbMocks.claimPilotEndNotification.mockResolvedValue(true);
    dbMocks.cleanupExpiredPilotInquiries.mockResolvedValue({ inquiriesDeleted: 2 });
    dbMocks.cleanupExpiredArchivedPilotTenants.mockResolvedValue({ tenantsDeleted: 1, filesDeleted: 3 });
    dbMocks.cleanupExpiredAnonymousPublicReachMetrics.mockResolvedValue({ metricsDeleted: 4 });
    mailMocks.renderPilotEndEmail.mockReturnValue({ subject: "Ende", text: "Text", html: "<p>Ende</p>" });
    mailMocks.sendTransactionalEmail.mockResolvedValue({ success: true, simulated: false });

    const result = await runPilotLifecycle(new Date("2026-10-02T08:00:00Z"));

    expect(result).toEqual({
      archived: 1,
      endNoticeCandidates: 1,
      endNoticeClaimed: 1,
      endNoticesSent: 1,
      endNoticesSkipped: 0,
      failed: 0,
      inquiriesDeleted: 2,
      tenantsDeleted: 1,
      filesDeleted: 3,
      publicReachMetricsDeleted: 4,
    });
    expect(dbMocks.cleanupExpiredAnonymousPublicReachMetrics).toHaveBeenCalledWith(
      new Date("2026-10-02T08:00:00Z")
    );
    expect(dbMocks.markPilotEndNotificationSent).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 7 })
    );
  });

  it("blockiert nicht-autorisierte Webaufrufe und akzeptiert nur Cron-Aufrufe", async () => {
    authMocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();

    await handleProductExpiryReminderHeartbeat({} as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("führt als Cron-Aufruf den Benachrichtigungslauf erfolgreich aus", async () => {
    authMocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "cron_daily" });
    dbMocks.listTenantProductExpiryReminderCandidates.mockResolvedValue([]);
    const res = response();

    await handleProductExpiryReminderHeartbeat({} as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        candidates: 0,
        sent: 0,
      })
    );
  });
});
