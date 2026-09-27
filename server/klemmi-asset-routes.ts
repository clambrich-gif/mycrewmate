import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Response } from "express";

const KLEMMI_ASSET_DIRECTORY = path.resolve(process.cwd(), "server", "assets");
const KLEMMI_ASSET_PATH = path.join(KLEMMI_ASSET_DIRECTORY, "klemmi-helper.webp");
const KLEMMI_VOICE_DIRECTORY = path.join(KLEMMI_ASSET_DIRECTORY, "klemmi-voice");

function setKlemmiHeaders(
  res: Response,
  { contentType, filename, size }: { contentType: string; filename: string; size?: number }
) {
  res.set({
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (size !== undefined) res.set("Content-Length", String(size));
}

async function serveStaticKlemmiAsset(
  res: Response,
  { assetPath, contentType, filename, headOnly }: {
    assetPath: string;
    contentType: string;
    filename: string;
    headOnly: boolean;
  }
) {
  try {
    const info = await fs.stat(assetPath);
    setKlemmiHeaders(res, { contentType, filename, size: info.size });
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(await fs.readFile(assetPath));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("Klemmi-Asset nicht gefunden");
      return;
    }
    console.error("[KlemmiAsset] Ein Klemmi-Asset konnte nicht ausgeliefert werden:", error);
    res.status(500).send("Klemmi-Asset konnte nicht ausgeliefert werden");
  }
}

function klemmiVoiceAssetPath(clipId: string) {
  // Nur feste, vorproduzierte Clip-IDs dürfen als Pfadbestandteil dienen.
  if (!/^[a-z][a-z-]{1,80}$/.test(clipId)) return null;
  const assetPath = path.resolve(KLEMMI_VOICE_DIRECTORY, `${clipId}.mp3`);
  return assetPath.startsWith(`${KLEMMI_VOICE_DIRECTORY}${path.sep}`) ? assetPath : null;
}

/** Liefert Maskottchen und feste Klemmi-Markenstimme für In-App-Führungen aus. */
export function registerKlemmiAssetRoutes(app: Express) {
  for (const method of ["head", "get"] as const) {
    app[method]("/api/klemmi/mascot", (_req, res) => {
      void serveStaticKlemmiAsset(res, {
        assetPath: KLEMMI_ASSET_PATH,
        contentType: "image/webp",
        filename: "klemmi-helfer.webp",
        headOnly: method === "head",
      });
    });

    app[method]("/api/klemmi/audio/:clipId", (req, res) => {
      const assetPath = klemmiVoiceAssetPath(req.params.clipId);
      if (!assetPath) {
        res.status(404).send("Klemmi-Audio nicht gefunden");
        return;
      }
      void serveStaticKlemmiAsset(res, {
        assetPath,
        contentType: "audio/mpeg",
        filename: `klemmi-${req.params.clipId}.mp3`,
        headOnly: method === "head",
      });
    });
  }
}
