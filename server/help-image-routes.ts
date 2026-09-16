import type { Express, Request, Response } from "express";
import { storageGetSignedUrl } from "./storage";

const HELP_IMAGES = {
  dashboard: {
    storageKey: "dashboard-current_8a026d64.png",
    filename: "hilfe-dashboard.png",
  },
  helpers: {
    storageKey: "helpers-mobile-current_12ee73cd.png",
    filename: "hilfe-helfer-mobil.png",
  },
  plan: {
    storageKey: "plan-current_62afa870.png",
    filename: "hilfe-einsatzplan.png",
  },
  chat: {
    storageKey: "chat-current_1677525e.png",
    filename: "hilfe-live-chat.png",
  },
  pdf: {
    storageKey: "pdf-export-current_5a3894fb.png",
    filename: "hilfe-pdf-ausgabe.png",
  },
  "app-speichern": {
    storageKey: "pwa-app-speichern-telefon_075d3868.png",
    filename: "hilfe-rsc-als-app-speichern.png",
  },
  "video-planungsteam": {
    storageKey: "planungsteam-poster_411f8a0e.png",
    filename: "schulung-planungsteam.png",
  },
  "video-administratoren": {
    storageKey: "admin-security-highlight_740eaaef.png",
    filename: "schulung-administratoren.png",
  },
} as const;

type HelpImageName = keyof typeof HELP_IMAGES;
type HelpImageRouteDependencies = {
  getSignedUrl: (storageKey: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

const defaultDependencies: HelpImageRouteDependencies = {
  getSignedUrl: storageGetSignedUrl,
  fetchImpl: fetch,
};

function getHelpImage(name: string) {
  return HELP_IMAGES[name as HelpImageName] ?? null;
}

function setImageHeaders(res: Response, filename: string) {
  res.set({
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Content-Type": "image/png",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
}

async function serveHelpImage(
  req: Request,
  res: Response,
  dependencies: HelpImageRouteDependencies,
  headOnly: boolean
) {
  const image = getHelpImage(req.params.image);
  if (!image) {
    res.status(404).send("Hilfebild nicht gefunden");
    return;
  }

  setImageHeaders(res, image.filename);

  try {
    const signedUrl = await dependencies.getSignedUrl(image.storageKey);
    const upstream = await dependencies.fetchImpl(signedUrl);

    if (!upstream.ok) {
      await upstream.body?.cancel();
      console.error(`[HelpImage] storage response ${upstream.status}`);
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }

    for (const header of ["content-length", "etag", "last-modified"] as const) {
      const value = upstream.headers.get(header);
      if (value) res.set(header, value);
    }

    if (headOnly) {
      await upstream.body?.cancel();
      res.status(200).end();
      return;
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(bytes);
  } catch (error) {
    console.error("[HelpImage] delivery failed:", error);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
}

export function registerHelpImageRoutes(
  app: Express,
  dependencies: HelpImageRouteDependencies = defaultDependencies
) {
  app.head("/api/help/images/:image", (req, res) => {
    void serveHelpImage(req, res, dependencies, true);
  });
  app.get("/api/help/images/:image", (req, res) => {
    void serveHelpImage(req, res, dependencies, false);
  });
}
