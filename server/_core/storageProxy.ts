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
  "RSC-Helferplanung-Schulung-Administratoren_f2c73550.mp4",
]);

const PROTECTED_STORAGE_PREFIXES = ["pdf-logos/"];

export function registerStorageProxy(app: Express) {
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

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
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
        console.error(
          `[StorageProxy] forge error: ${forgeResp.status} ${body}`
        );
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
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
