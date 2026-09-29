import type { Request, Response } from "express";
import {
  claimTenantProductExpiryReminder,
  listTenantProductExpiryReminderCandidates,
  markTenantProductExpiryReminderSent,
  releaseTenantProductExpiryReminderClaim,
} from "./db";
import { renderProductExpiryReminderEmail, sendTransactionalEmail } from "./mail-service";
import { PRODUCT_PACKAGE_META } from "../shared/product-packages";
import { sdk } from "./_core/sdk";

type ExpiryReminderRun = {
  candidates: number;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Führt den täglichen Hinweisversand aus. Ein Versand wird nur nach erfolgreicher
 * SMTP-Annahme als erledigt markiert; bei einem Fehler wird die Kurzzeit-Lease
 * freigegeben und der nächste Heartbeat versucht es erneut.
 */
export async function sendUpcomingProductExpiryReminders(
  now = new Date()
): Promise<ExpiryReminderRun> {
  const candidates = await listTenantProductExpiryReminderCandidates({ now, withinDays: 7 });
  const result: ExpiryReminderRun = {
    candidates: candidates.length,
    claimed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    const claimed = await claimTenantProductExpiryReminder({
      tenantId: candidate.tenantId,
      endsOn: candidate.endsOn,
      now,
    });
    if (!claimed) {
      result.skipped += 1;
      continue;
    }
    result.claimed += 1;
    try {
      const packageMeta = PRODUCT_PACKAGE_META[candidate.packageId];
      const content = renderProductExpiryReminderEmail({
        tenantName: candidate.tenantName,
        packageName: packageMeta.name,
        packageStatus: candidate.status,
        endsOn: candidate.endsOn,
        daysRemaining: candidate.daysRemaining,
      });
      const delivery = await sendTransactionalEmail({
        to: candidate.contactEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      if (!delivery.success) {
        result.failed += 1;
        await releaseTenantProductExpiryReminderClaim(candidate);
        continue;
      }
      await markTenantProductExpiryReminderSent({
        tenantId: candidate.tenantId,
        endsOn: candidate.endsOn,
        sentAt: now,
      });
      result.sent += 1;
    } catch (error) {
      console.error("[ProductExpiryReminder] Versand fehlgeschlagen", error);
      result.failed += 1;
      await releaseTenantProductExpiryReminderClaim(candidate);
    }
  }

  return result;
}

/** Ausschließlich durch den Plattform-Heartbeat aufrufbare Tagesroutine. */
export async function handleProductExpiryReminderHeartbeat(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    const result = await sendUpcomingProductExpiryReminders();
    if (result.failed > 0) {
      res.status(500).json({
        ok: false,
        error: "product-expiry-reminder-delivery-failed",
        ...result,
        ranAt: new Date().toISOString(),
      });
      return;
    }
    res.status(200).json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error("[ProductExpiryReminder] Heartbeat failed", error);
    res.status(500).json({
      error: "product-expiry-reminder-failed",
      timestamp: new Date().toISOString(),
    });
  }
}
