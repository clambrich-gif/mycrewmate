import { Readable } from "node:stream";
import type { Express, Request, Response } from "express";

const HELPER_TRAINING_VIDEO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/WZnXHeiEiCYpKqQM.mp4";
const TRAINING_VIDEO_FILENAME = "mycrewmate-helfer-schulung.mp4";

function setVideoHeaders(res: Response, upstream: globalThis.Response) {
  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");

  res.set({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": `inline; filename="${TRAINING_VIDEO_FILENAME}"`,
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentLength) res.set("Content-Length", contentLength);
  if (contentRange) res.set("Content-Range", contentRange);
}

async function serveTrainingVideo(req: Request, res: Response, headOnly: boolean) {
  try {
    const requestedRange = req.headers.range;
    const upstream = await fetch(HELPER_TRAINING_VIDEO_URL, {
      method: headOnly ? "HEAD" : "GET",
      headers: requestedRange ? { Range: requestedRange } : undefined,
    });

    if (upstream.status !== 200 && upstream.status !== 206) {
      res.status(502).send("Schulungsvideo ist momentan nicht verfügbar");
      return;
    }

    setVideoHeaders(res, upstream);
    res.status(upstream.status);
    if (headOnly) {
      res.end();
      return;
    }
    if (!upstream.body) {
      res.status(502).send("Schulungsvideo ist momentan nicht verfügbar");
      return;
    }

    const stream = Readable.fromWeb(upstream.body as never);
    stream.on("error", error => {
      console.error("[HelpTrainingVideo] Videostream konnte nicht weitergeleitet werden:", error);
      if (!res.headersSent) res.status(502).send("Schulungsvideo ist momentan nicht verfügbar");
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("[HelpTrainingVideo] Schulungsvideo konnte nicht geladen werden:", error);
    if (!res.headersSent) res.status(502).send("Schulungsvideo ist momentan nicht verfügbar");
    else res.destroy(error as Error);
  }
}

/** Liefert das freigegebene Helferschulungsvideo same-origin und rangefähig aus. */
export function registerHelpTrainingVideoRoutes(app: Express) {
  app.head("/api/help/training-video", (req, res) => {
    void serveTrainingVideo(req, res, true);
  });
  app.get("/api/help/training-video", (req, res) => {
    void serveTrainingVideo(req, res, false);
  });
}

export { HELPER_TRAINING_VIDEO_URL };
