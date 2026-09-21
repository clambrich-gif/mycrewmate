import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";

const HELP_ASSET_ROOT = path.resolve(process.cwd(), "client", "public", "help");

const HELP_IMAGES = {
  dashboard: { filename: "dashboard.png", downloadName: "hilfe-dashboard.png" },
  locations: { filename: "locations.png", downloadName: "hilfe-orte-und-standorte.png" },
  helpers: { filename: "helpers.png", downloadName: "hilfe-helfer.png" },
  plan: { filename: "plan.png", downloadName: "hilfe-einsatzplan.png" },
  preparation: { filename: "preparation.png", downloadName: "hilfe-vorbereitung.png" },
  materials: { filename: "materials.png", downloadName: "hilfe-material.png" },
  donations: { filename: "donations.png", downloadName: "hilfe-spenden.png" },
  finances: { filename: "finances.png", downloadName: "hilfe-finanzen.png" },
  chat: { filename: "chat.png", downloadName: "hilfe-live-chat.png" },
  pdf: { filename: "pdf.png", downloadName: "hilfe-pdf-ausgabe.png" },
  "data-management": {
    filename: "data-management.png",
    downloadName: "hilfe-projektstand-speichern.png",
  },
  security: { filename: "security.png", downloadName: "hilfe-schutz-und-protokoll.png" },
  "help-center": { filename: "help-center.png", downloadName: "hilfe-center.png" },
  "app-speichern": {
    filename: "app-speichern.png",
    downloadName: "hilfe-mycrewmate-als-app-speichern.png",
  },
  "video-planungsteam": {
    filename: "video-planungsteam.png",
    downloadName: "schulung-planungsteam.png",
  },
  "video-administratoren": {
    filename: "video-administratoren.png",
    downloadName: "schulung-administratoren.png",
  },
} as const;

type HelpImageName = keyof typeof HELP_IMAGES;

function getHelpImage(name: string) {
  return HELP_IMAGES[name as HelpImageName] ?? null;
}

function setImageHeaders(res: Response, filename: string, size?: number) {
  res.set({
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Content-Type": "image/png",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (size !== undefined) res.set("Content-Length", String(size));
}

async function serveHelpImage(req: Request, res: Response, headOnly: boolean) {
  const image = getHelpImage(req.params.image);
  if (!image) {
    res.status(404).send("Hilfebild nicht gefunden");
    return;
  }

  try {
    const assetPath = path.join(HELP_ASSET_ROOT, image.filename);
    const info = await fs.stat(assetPath);
    setImageHeaders(res, image.downloadName, info.size);
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(await fs.readFile(assetPath));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("Hilfebild nicht gefunden");
      return;
    }
    console.error("[HelpImage] Lokales Hilfebild konnte nicht geladen werden:", error);
    res.status(500).end();
  }
}

/** Liefert die dokumentierten Hilfebilder lokal aus dem Repository aus. */
export function registerHelpImageRoutes(app: Express) {
  app.head("/api/help/images/:image", (req, res) => {
    void serveHelpImage(req, res, true);
  });
  app.get("/api/help/images/:image", (req, res) => {
    void serveHelpImage(req, res, false);
  });
}
