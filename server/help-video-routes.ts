import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl } from "./storage";

const HELP_VIDEOS = {
  admin: {
    role: "admin",
    storageKey: "RSC-Helferplanung-Erklaervideo-Administratoren_48a1d1ca.mp4",
  },
  planungsteam: {
    role: "user",
    storageKey: "RSC-Helferplanung-Erklaervideo-Planungsteam_3101461c.mp4",
  },
} as const;

type HelpVideoAudience = keyof typeof HELP_VIDEOS;
type AuthenticatedRole = Pick<User, "role">;

type HelpVideoRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<AuthenticatedRole>;
  getSignedUrl: (storageKey: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

const defaultDependencies: HelpVideoRouteDependencies = {
  authenticateRequest: req => sdk.authenticateRequest(req),
  getSignedUrl: storageGetSignedUrl,
  fetchImpl: fetch,
};

function getVideo(audience: string) {
  return HELP_VIDEOS[audience as HelpVideoAudience] ?? null;
}

function setStreamingHeaders(req: Request, res: Response) {
  res.set({
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Headers": "Range",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": "inline",
    "Content-Type": "video/mp4",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  res.vary("Origin");
  res.vary("Range");

  const origin = req.get("origin");
  const host = req.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host === host) {
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Access-Control-Allow-Credentials", "true");
      }
    } catch {
      // Ungültige Origin-Header werden bewusst nicht gespiegelt.
    }
  }
}

function copyUpstreamHeader(
  upstream: globalThis.Response,
  res: Response,
  name: "content-length" | "content-range" | "etag" | "last-modified"
) {
  const value = upstream.headers.get(name);
  if (value) res.set(name, value);
}

async function serveHelpVideo(
  req: Request,
  res: Response,
  dependencies: HelpVideoRouteDependencies,
  headOnly: boolean
) {
  setStreamingHeaders(req, res);

  const video = getVideo(req.params.audience);
  if (!video) {
    res.status(404).send("Video nicht gefunden");
    return;
  }

  let user: AuthenticatedRole;
  try {
    user = await dependencies.authenticateRequest(req);
  } catch {
    res.status(401).send("Anmeldung erforderlich");
    return;
  }

  if (user.role !== video.role) {
    res.status(403).send("Keine Berechtigung für dieses Video");
    return;
  }

  const abortController = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const signedUrl = await dependencies.getSignedUrl(video.storageKey);
    const requestedRange = headOnly ? "bytes=0-0" : req.get("range");
    const upstream = await dependencies.fetchImpl(signedUrl, {
      headers: requestedRange ? { Range: requestedRange } : undefined,
      signal: abortController.signal,
    });

    if (upstream.status === 416) {
      copyUpstreamHeader(upstream, res, "content-range");
      await upstream.body?.cancel();
      res.status(416).end();
      return;
    }
    if (!upstream.ok) {
      console.error(`[HelpVideo] storage response ${upstream.status}`);
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }

    copyUpstreamHeader(upstream, res, "etag");
    copyUpstreamHeader(upstream, res, "last-modified");

    if (headOnly) {
      const contentRange = upstream.headers.get("content-range");
      const totalLength = contentRange?.match(/\/(\d+)$/)?.[1];
      const contentLength = totalLength ?? upstream.headers.get("content-length");
      if (contentLength) res.set("Content-Length", contentLength);
      await upstream.body?.cancel();
      res.status(200).end();
      return;
    }

    copyUpstreamHeader(upstream, res, "content-length");
    copyUpstreamHeader(upstream, res, "content-range");
    res.status(upstream.status === 206 ? 206 : 200);

    if (!upstream.body) {
      res.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body as never), res);
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error("[HelpVideo] streaming failed:", error);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
}

export function registerHelpVideoRoutes(
  app: Express,
  dependencies: HelpVideoRouteDependencies = defaultDependencies
) {
  app.options("/api/videos/:audience", (req, res) => {
    setStreamingHeaders(req, res);
    res.status(204).end();
  });
  app.head("/api/videos/:audience", (req, res) => {
    void serveHelpVideo(req, res, dependencies, true);
  });
  app.get("/api/videos/:audience", (req, res) => {
    void serveHelpVideo(req, res, dependencies, false);
  });
}
