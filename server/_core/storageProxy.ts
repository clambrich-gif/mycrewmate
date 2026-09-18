import type { Express } from "express";
import { ENV } from "./env";

const PROTECTED_STORAGE_KEYS = new Set([
  "RSC-Helferplanung-Anleitung_211fadc0.pdf",
  "RSC-Helferplanung-Anleitung_b2d47388.pdf",
  "RSC-Helferplanung-Anleitung_eb096530.pdf",
  "RSC-Helferplanung-Anleitung_ee2c395b.pdf",
  "RSC-Helferplanung-Anleitung_ddd7bf07.pdf",
  "RSC-Helferplanung-Anleitung_4f84ed2a.pdf",
  "RSC-Helferplanung-Anleitung_2a9c73bd.pdf",
  "Handbuch_RSC_Helferplanung_742fcb04.pdf",
  "RSC-Helferplanung-Erklaervideo-Administratoren_48a1d1ca.mp4",
  "RSC-Helferplanung-Erklaervideo-Planungsteam_3101461c.mp4",
  "RSC-Helferplanung-Einweisung-Planungsteam_01385146.mp4",
  "RSC-Helferplanung-Planungsteam-Schulung-A-bis-Z_0353653d.mp4",
  "RSC-Helferplanung-Planungsteam-Schulung-A-bis-Z_199b9f42.mp4",
  "RSC-Helferplanung-Schulung-Administratoren_f2c73550.mp4",
]);

const PROTECTED_STORAGE_PREFIXES = ["pdf-logos/"];
const INLINE_LOCATION_LOGO_PREFIX = "location-logos/";
const MAX_LOCATION_LOGO_BYTES = 3_000_000;

export type StorageProxyDependencies = {
  getSignedUrl: (key: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

function locationLogoContentType(key: string) {
  const normalized = key.toLocaleLowerCase();
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg"))
    return "image/jpeg";
  return "image/png";
}

const defaultDependencies: StorageProxyDependencies = {
  getSignedUrl: async key => {
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      throw new Error("Storage proxy not configured");
    }
    const forgeUrl = new URL(
      "v1/storage/presign/get",
      ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
    );
    forgeUrl.searchParams.set("path", key);
    const forgeResp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!forgeResp.ok) {
      const body = await forgeResp.text().catch(() => "");
      throw new Error(`Storage backend error: ${forgeResp.status} ${body}`);
    }
    const { url } = (await forgeResp.json()) as { url: string };
    if (!url) throw new Error("Empty signed URL from backend");
    return url;
  },
  fetchImpl: fetch,
};

export function registerStorageProxy(
  app: Express,
  dependencies: StorageProxyDependencies = defaultDependencies
) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (
      PROTECTED_STORAGE_KEYS.has(key) ||
      PROTECTED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))
    ) {
      res.status(404).send("Not found");
      return;
    }

    try {
      const url = await dependencies.getSignedUrl(key);

      // Standortlogos müssen in Dialogvorschau und Leaflet-divIcon als echte
      // Same-Origin-Bilder ausgeliefert werden. Ein CloudFront-Redirect kann
      // je nach eingebettetem Browser oder CSP als defektes Bild enden.
      if (key.startsWith(INLINE_LOCATION_LOGO_PREFIX)) {
        const upstream = await dependencies.fetchImpl(url);
        if (!upstream.ok) {
          await upstream.body?.cancel();
          res.status(upstream.status === 404 ? 404 : 502).end();
          return;
        }
        const declaredLength = Number(upstream.headers.get("content-length"));
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAX_LOCATION_LOGO_BYTES
        ) {
          await upstream.body?.cancel();
          res.status(502).send("Standortlogo überschreitet die Größenbegrenzung");
          return;
        }
        const bytes = Buffer.from(await upstream.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_LOCATION_LOGO_BYTES) {
          res.status(502).send("Standortlogo ist leer oder zu groß");
          return;
        }
        res.set({
          "Cache-Control": "private, max-age=300",
          "Content-Disposition": "inline",
          "Content-Length": String(bytes.length),
          "Content-Type": locationLogoContentType(key),
          "Cross-Origin-Resource-Policy": "same-origin",
          "X-Content-Type-Options": "nosniff",
        });
        res.status(200).send(bytes);
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
