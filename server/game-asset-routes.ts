import { Readable } from "node:stream";
import type { Express, Request, Response } from "express";

const FESTIVAL_MUSIC_UPSTREAM =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/HXJcZFfaPkQEfvfl.mp3";

async function proxyGameMedia(
  req: Request,
  res: Response,
  url: string,
  contentType: string,
  filename: string
) {
  try {
    const range = req.headers.range;
    const upstream = await fetch(url, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: range ? { Range: range } : undefined,
    });
    if (upstream.status !== 200 && upstream.status !== 206) {
      res.status(502).send("Spielasset momentan nicht verfügbar");
      return;
    }

    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    res.set({
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=604800, immutable",
      "Content-Disposition": `inline; filename=\"${filename}\"`,
      "Content-Type": upstream.headers.get("content-type") ?? contentType,
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    if (contentLength) res.set("Content-Length", contentLength);
    if (contentRange) res.set("Content-Range", contentRange);

    res.status(upstream.status);
    if (req.method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }
    const stream = Readable.fromWeb(upstream.body as never);
    stream.on("error", error => {
      console.error("[GameMediaProxy] Stream-Fehler:", error);
      if (!res.headersSent) res.status(502).send("Spielasset nicht verfügbar");
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("[GameMediaProxy] Konnte Asset nicht laden:", error);
    if (!res.headersSent) res.status(502).send("Spielasset nicht verfügbar");
    else res.destroy(error as Error);
  }
}

function registerProxy(app: Express, path: string, url: string, type: string, filename: string) {
  app.head(path, (req, res) => void proxyGameMedia(req, res, url, type, filename));
  app.get(path, (req, res) => void proxyGameMedia(req, res, url, type, filename));
}

/** Liefert ausschließlich die freigegebenen Medien des Radsport-Planungssimulators same-origin aus. */
export function registerGameAssetRoutes(app: Express) {
  registerProxy(app, "/api/game/festival-music", FESTIVAL_MUSIC_UPSTREAM, "audio/mpeg", "festplatz-loopsong.mp3");
}

export { FESTIVAL_MUSIC_UPSTREAM };
