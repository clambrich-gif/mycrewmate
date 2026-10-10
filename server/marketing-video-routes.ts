import { Readable } from "node:stream";
import type { Express, Request, Response } from "express";

const MARKETING_PROMO_VIDEO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/NmSgPWXCECmcADpS.mp4";
const MARKETING_PROMO_VIDEO_FILENAME = "MyCrewMate-Werbefilm.mp4";
const PILOT_EXPLAINER_VIDEO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/ivXEhtTdNKmHIaik.mp4";
const PILOT_EXPLAINER_VIDEO_FILENAME = "MyCrewMate-Pilotfilm.mp4";

function setVideoHeaders(
  res: Response,
  upstream: globalThis.Response,
  filename: string
) {
  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");

  res.set({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentLength) res.set("Content-Length", contentLength);
  if (contentRange) res.set("Content-Range", contentRange);
}

async function serveMarketingVideo(
  req: Request,
  res: Response,
  headOnly: boolean,
  sourceUrl: string,
  filename: string
) {
  try {
    const requestedRange = req.headers.range;
    const upstream = await fetch(sourceUrl, {
      method: headOnly ? "HEAD" : "GET",
      headers: requestedRange ? { Range: requestedRange } : undefined,
    });

    if (upstream.status !== 200 && upstream.status !== 206) {
      res.status(502).send("Werbefilm ist momentan nicht verfügbar");
      return;
    }

    setVideoHeaders(res, upstream, filename);
    res.status(upstream.status);
    if (headOnly) {
      res.end();
      return;
    }
    if (!upstream.body) {
      res.status(502).send("Werbefilm ist momentan nicht verfügbar");
      return;
    }

    const stream = Readable.fromWeb(upstream.body as never);
    stream.on("error", error => {
      console.error("[MarketingVideo] Videostream konnte nicht weitergeleitet werden:", error);
      if (!res.headersSent) {
        res.status(502).send("Werbefilm ist momentan nicht verfügbar");
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("[MarketingVideo] Werbefilm konnte nicht geladen werden:", error);
    if (!res.headersSent) {
      res.status(502).send("Werbefilm ist momentan nicht verfügbar");
    } else {
      res.destroy(error as Error);
    }
  }
}

/** Liefert ausschließlich den freigegebenen Werbefilm same-origin und rangefähig aus. */
export function registerMarketingVideoRoutes(app: Express) {
  app.head("/api/marketing/promo-video", (req, res) => {
    void serveMarketingVideo(req, res, true, MARKETING_PROMO_VIDEO_URL, MARKETING_PROMO_VIDEO_FILENAME);
  });
  app.get("/api/marketing/promo-video", (req, res) => {
    void serveMarketingVideo(req, res, false, MARKETING_PROMO_VIDEO_URL, MARKETING_PROMO_VIDEO_FILENAME);
  });
  /** Der Pilotfilm wird über die eigene Origin und mit Range-Unterstützung gezeigt. */
  app.head("/api/marketing/pilot-video", (req, res) => {
    void serveMarketingVideo(req, res, true, PILOT_EXPLAINER_VIDEO_URL, PILOT_EXPLAINER_VIDEO_FILENAME);
  });
  app.get("/api/marketing/pilot-video", (req, res) => {
    void serveMarketingVideo(req, res, false, PILOT_EXPLAINER_VIDEO_URL, PILOT_EXPLAINER_VIDEO_FILENAME);
  });
}

export { MARKETING_PROMO_VIDEO_URL, PILOT_EXPLAINER_VIDEO_URL };
