import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import {
  cleanupExpiredPublicDemoTenants,
  endPublicDemoForOpenId,
  getPublicDemoLoginDetails,
  isPublicDemoOpenId,
  PUBLIC_DEMO_SESSION_MS,
} from "./public-demo";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Übernimmt den Einmal-Link vollständig auf dem App-Host. Damit entsteht die
 * Sitzungs-Cookie dort, wo die echte Anwendung läuft, ohne dass ein React-
 * Entwicklungsmodus oder eine Cross-Origin-Übergabe den Token doppelt nutzt.
 */
export async function handlePublicDemoAccess(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!rawToken || rawToken.length < 20 || rawToken.length > 200) {
      res.redirect(303, "/vereinsdemo");
      return;
    }
    const handoff = await db.consumePlatformTenantHandoff(hashToken(rawToken));
    if (!handoff) {
      res.redirect(303, "/vereinsdemo?demo=ungueltig");
      return;
    }
    const demo = await getPublicDemoLoginDetails({
      tenantId: handoff.tenantId,
      openId: handoff.createdByOpenId,
    });
    if (!demo) {
      res.redirect(303, "/vereinsdemo?demo=ungueltig");
      return;
    }
    const sessionToken = await sdk.createSessionToken(demo.user.openId, {
      name: "Demo-Planung",
      expiresInMs: PUBLIC_DEMO_SESSION_MS,
      sessionVersion: demo.sessionVersion,
    });
    res.cookie(COOKIE_NAME, sessionToken, {
      ...getSessionCookieOptions(req),
      maxAge: PUBLIC_DEMO_SESSION_MS,
    });
    const params = new URLSearchParams({
      demotenant: handoff.tenantId,
      event: String(demo.eventId),
      jahr: String(demo.year),
    });
    res.redirect(303, `/?${params.toString()}`);
  } catch (error) {
    console.error("[PublicDemoAccess] Einmalzugang fehlgeschlagen", error);
    res.redirect(303, "/vereinsdemo?demo=ungueltig");
  }
}

/**
 * Best-Effort-Aufräumen beim Schließen oder Verlassen der Demo. Die Route ist
 * ausschließlich über die temporäre App-Sitzung erreichbar und akzeptiert keine
 * vom Browser übergebene Mandanten-ID.
 */
export async function handlePublicDemoEnd(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!isPublicDemoOpenId(user.openId)) {
      res.status(403).json({ error: "public-demo-only" });
      return;
    }
    const result = await endPublicDemoForOpenId(user.openId);
    res.clearCookie(COOKIE_NAME, {
      ...getSessionCookieOptions(req),
      maxAge: -1,
    });
    res.status(200).json({ ok: true, ...result });
  } catch {
    // Ein Browser darf den Tab auch nach Ablauf der Demo noch schließen. Die
    // Antwort bleibt absichtlich neutral; der TTL-Lauf entfernt den Rest.
    res.status(204).end();
  }
}

/** Idempotenter Fallback für Tabs, die kein pagehide-Signal senden konnten. */
export async function handlePublicDemoCleanupHeartbeat(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    const result = await cleanupExpiredPublicDemoTenants();
    res.status(200).json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error("[PublicDemoCleanup] Heartbeat failed", error);
    res.status(500).json({
      error: "public-demo-cleanup-failed",
      timestamp: new Date().toISOString(),
    });
  }
}
