import type { Express, Request, Response } from "express";
import { storageGetSignedUrl } from "./storage";
import { MYCREWMATE_WORDMARK } from "./brand-assets";

type BrandAssetRouteDependencies = {
  getSignedUrl: (storageKey: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

const defaultDependencies: BrandAssetRouteDependencies = {
  getSignedUrl: storageGetSignedUrl,
  fetchImpl: fetch,
};

function setLogoHeaders(res: Response) {
  res.set({
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${MYCREWMATE_WORDMARK.filename}"`,
    "Content-Type": MYCREWMATE_WORDMARK.contentType,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  });
}

async function fetchLogo(
  req: Request,
  res: Response,
  dependencies: BrandAssetRouteDependencies,
  headOnly: boolean
) {
  setLogoHeaders(res);
  const abortController = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const signedUrl = await dependencies.getSignedUrl(
      MYCREWMATE_WORDMARK.storageKey
    );
    const upstream = await dependencies.fetchImpl(signedUrl, {
      signal: abortController.signal,
    });

    if (!upstream.ok) {
      await upstream.body?.cancel();
      console.error(`[BrandAsset] logo storage response ${upstream.status}`);
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }

    const contentLength = upstream.headers.get("content-length");
    const etag = upstream.headers.get("etag");
    const lastModified = upstream.headers.get("last-modified");
    if (contentLength) res.set("Content-Length", contentLength);
    if (etag) res.set("ETag", etag);
    if (lastModified) res.set("Last-Modified", lastModified);

    if (headOnly) {
      await upstream.body?.cancel();
      res.status(200).end();
      return;
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(bytes);
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error("[BrandAsset] logo delivery failed:", error);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
}

export function registerBrandAssetRoutes(
  app: Express,
  dependencies: BrandAssetRouteDependencies = defaultDependencies
) {
  const path = "/mycrewmate-logo.png";
  app.options(path, (_req, res) => {
    setLogoHeaders(res);
    res.status(204).end();
  });
  app.head(path, (req, res) => {
    void fetchLogo(req, res, dependencies, true);
  });
  app.get(path, (req, res) => {
    void fetchLogo(req, res, dependencies, false);
  });
}
