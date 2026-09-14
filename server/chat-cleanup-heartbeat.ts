import type { Request, Response } from "express";
import { cleanupExpiredTeamNoteTypings, cleanupExpiredTeamNotes } from "./db";
import { sdk } from "./_core/sdk";

/**
 * Project-level Heartbeat endpoint. The platform authenticates the scheduled
 * caller as a cron identity; no client-controlled event or year is accepted.
 * Both delete operations are idempotent, so platform retries are safe.
 */
export async function handleTeamNotesCleanupHeartbeat(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    const now = new Date();
    const [expiredNotesDeleted, expiredTypingDeleted] = await Promise.all([
      cleanupExpiredTeamNotes(now),
      cleanupExpiredTeamNoteTypings(now),
    ]);

    res.status(200).json({
      ok: true,
      expiredNotesDeleted,
      expiredTypingDeleted,
      ranAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[TeamNotesCleanup] Heartbeat failed", error);
    res.status(500).json({
      error: "team-notes-cleanup-failed",
      timestamp: new Date().toISOString(),
    });
  }
}
