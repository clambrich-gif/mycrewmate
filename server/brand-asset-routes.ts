import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";

const BRAND_ASSET_ROOT = path.resolve(process.cwd(), "client", "public", "brand");

const BRAND_ASSETS = {
  wordmark: {
    filename: "mycrewmate-wordmark.png",
    downloadName: "mycrewmate-logo.png",
  },
  infinity: {
    filename: "mycrewmate-infinity-mark.png",
    downloadName: "mycrewmate-infinity-mark.png",
  },
} as const;

type BrandAssetName = keyof typeof BRAND_ASSETS;

function getBrandAsset(name: string) {
  return BRAND_ASSETS[name as BrandAssetName] ?? null;
}

export function getBrandAssetPath(name: BrandAssetName) {
  return path.join(BRAND_ASSET_ROOT, BRAND_ASSETS[name].filename);
}

export async function loadBrandAsset(name: BrandAssetName) {
  return fs.readFile(getBrandAssetPath(name));
}

function setBrandAssetHeaders(res: Response, filename: string, size?: number) {
  res.set({
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Content-Type": "image/png",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (size !== undefined) res.set("Content-Length", String(size));
}

async function serveBrandAsset(req: Request, res: Response, headOnly: boolean) {
  const asset = getBrandAsset(req.params.asset);
  if (!asset) {
    res.status(404).send("Markenasset nicht gefunden");
    return;
  }

  try {
    const assetPath = getBrandAssetPath(req.params.asset as BrandAssetName);
    const info = await fs.stat(assetPath);
    setBrandAssetHeaders(res, asset.downloadName, info.size);
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(await fs.readFile(assetPath));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("Markenasset nicht gefunden");
      return;
    }
    console.error("[BrandAssets] Lokales Markenasset konnte nicht geladen werden:", error);
    res.status(500).send("Markenasset konnte nicht geladen werden");
  }
}

/** Liefert gebündelte Markenassets ausschließlich aus dem Repository aus. */
export function registerBrandAssetRoutes(app: Express) {
  app.head("/api/brand/:asset", (req, res) => {
    void serveBrandAsset(req, res, true);
  });
  app.get("/api/brand/:asset", (req, res) => {
    void serveBrandAsset(req, res, false);
  });
}
