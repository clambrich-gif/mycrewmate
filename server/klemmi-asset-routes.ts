import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Response } from "express";

const KLEMMI_ASSET_PATH = path.resolve(
  process.cwd(),
  "server",
  "assets",
  "klemmi-helper.webp"
);

function setKlemmiHeaders(res: Response, size?: number) {
  res.set({
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": 'inline; filename="klemmi-helfer.webp"',
    "Content-Type": "image/webp",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (size !== undefined) res.set("Content-Length", String(size));
}

async function serveKlemmiAsset(res: Response, headOnly: boolean) {
  try {
    const info = await fs.stat(KLEMMI_ASSET_PATH);
    setKlemmiHeaders(res, info.size);
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(await fs.readFile(KLEMMI_ASSET_PATH));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("Klemmi-Asset nicht gefunden");
      return;
    }
    console.error("[KlemmiAsset] Das Maskottchen konnte nicht ausgeliefert werden:", error);
    res.status(500).send("Klemmi-Asset konnte nicht ausgeliefert werden");
  }
}

/** Liefert das schlanke Klemmi-Maskottchen für In-App-Führungen aus. */
export function registerKlemmiAssetRoutes(app: Express) {
  app.head("/api/klemmi/mascot", (_req, res) => {
    void serveKlemmiAsset(res, true);
  });
  app.get("/api/klemmi/mascot", (_req, res) => {
    void serveKlemmiAsset(res, false);
  });
}
