import { createHash } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { sessionPresences, type User } from "../drizzle/schema";
import { getDb } from "./db";

export const ONLINE_WINDOW_MS = 10 * 60 * 1000;

function sessionTokenFromRequest(req: Request) {
  const cookies = req.headers.cookie
    ? parseCookieHeader(req.headers.cookie)
    : undefined;
  const cookieToken = cookies?.[COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authorization = req.headers.authorization;
  if (
    typeof authorization === "string" &&
    authorization.startsWith("Bearer ")
  ) {
    const bearerToken = authorization.slice(7).trim();
    return bearerToken || null;
  }

  return null;
}

export function sessionPresenceKey(req: Request) {
  const token = sessionTokenFromRequest(req);
  if (!token) return null;
  return createHash("sha256").update(token).digest("hex");
}

export async function recordSessionPresence(
  req: Request,
  user: Pick<User, "id" | "role" | "name">,
  context: {
    tenantId: string;
    presenceRole: "planner" | "primary_admin" | "co_admin";
  }
) {
  if (user.id <= 0) return false;
  const sessionKey = sessionPresenceKey(req);
  if (!sessionKey) return false;

  const db = await getDb();
  if (!db) return false;

  const now = new Date();
  await db
    .insert(sessionPresences)
    .values({
      sessionKey,
      userId: user.id,
      tenantId: context.tenantId,
      role: user.role,
      presenceRole: context.presenceRole,
      sessionName:
        user.name?.trim() ||
        (user.role === "admin" ? "Administrator" : "Planungsteam"),
      lastSeen: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: user.id,
        tenantId: context.tenantId,
        role: user.role,
        presenceRole: context.presenceRole,
        sessionName:
          user.name?.trim() ||
          (user.role === "admin" ? "Administrator" : "Planungsteam"),
        lastSeen: now,
      },
    });

  return true;
}

export async function removeSessionPresence(req: Request) {
  const sessionKey = sessionPresenceKey(req);
  if (!sessionKey) return false;

  const db = await getDb();
  if (!db) return false;
  await db
    .delete(sessionPresences)
    .where(eq(sessionPresences.sessionKey, sessionKey));
  return true;
}

export async function getOnlinePresenceCounts(
  tenantId: string,
  now = new Date()
) {
  const db = await getDb();
  if (!db) return { planningTeam: 0, administrators: 0 } as const;

  const activeSince = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const rows = await db
    .select({
      role: sessionPresences.role,
      total: count(),
    })
    .from(sessionPresences)
    .where(
      and(
        eq(sessionPresences.tenantId, tenantId),
        gte(sessionPresences.lastSeen, activeSince)
      )
    )
    .groupBy(sessionPresences.role);

  const byRole = new Map(rows.map(row => [row.role, Number(row.total)]));
  return {
    planningTeam: byRole.get("user") ?? 0,
    administrators: byRole.get("admin") ?? 0,
  } as const;
}

export async function getOnlinePresenceStatus(
  tenantId: string,
  now = new Date()
) {
  const db = await getDb();
  if (!db) {
    return {
      planningTeam: 0,
      administrators: 0,
      planningTeamNames: [] as string[],
      administratorNames: [] as string[],
    };
  }

  const activeSince = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const sessions = await db
    .select({
      role: sessionPresences.role,
      presenceRole: sessionPresences.presenceRole,
      sessionName: sessionPresences.sessionName,
    })
    .from(sessionPresences)
    .where(
      and(
        eq(sessionPresences.tenantId, tenantId),
        gte(sessionPresences.lastSeen, activeSince)
      )
    )
    .orderBy(asc(sessionPresences.sessionName));

  const planningTeamCount = sessions.filter(
    session => session.presenceRole === "planner"
  ).length;
  const adminCount = sessions.filter(
    session =>
      session.presenceRole === "primary_admin" ||
      session.presenceRole === "co_admin"
  ).length;
  const namesForPresenceRole = (
    roles: readonly ("planner" | "primary_admin" | "co_admin")[]
  ) =>
    Array.from(
      new Set(
        sessions
          .filter(session => roles.includes(session.presenceRole))
          .map(session => {
            const roleLabel =
              session.presenceRole === "primary_admin"
                ? "Hauptadministrator"
                : session.presenceRole === "co_admin"
                  ? "Co-Admin"
                  : null;
            return `${session.sessionName.trim()}${roleLabel ? ` (${roleLabel})` : ""}`;
          })
          .filter(Boolean)
      )
    );

  return {
    planningTeam: planningTeamCount,
    administrators: adminCount,
    planningTeamNames: namesForPresenceRole(["planner"]),
    administratorNames: namesForPresenceRole(["primary_admin", "co_admin"]),
  };
}

export async function isSessionOnline(req: Request, now = new Date()) {
  const sessionKey = sessionPresenceKey(req);
  if (!sessionKey) return false;

  const db = await getDb();
  if (!db) return false;
  const activeSince = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const [row] = await db
    .select({ sessionKey: sessionPresences.sessionKey })
    .from(sessionPresences)
    .where(
      and(
        eq(sessionPresences.sessionKey, sessionKey),
        gte(sessionPresences.lastSeen, activeSince)
      )
    )
    .limit(1);
  return Boolean(row);
}
