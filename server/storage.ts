import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Response } from "express";

const PROTECTED_STORAGE_KEYS = new Set([
  "Handbuch_RSC_Helferplanung_742fcb04.pdf",
]);
const PROTECTED_STORAGE_PREFIXES = ["pdf-logos/"];

function normalizeKey(relKey: string): string {
  const normalized = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.split("/").some(part => part === "" || part === "." || part === "..")
  ) {
    throw new Error("Ungültiger Dateischlüssel");
  }
  return normalized;
}

function storageRoot() {
  return path.resolve(
    process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), "data", "uploads")
  );
}

function filePathForKey(relKey: string) {
  const key = normalizeKey(relKey);
  const root = storageRoot();
  const target = path.resolve(root, ...key.split("/"));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ungültiger Dateischlüssel");
  }
  return { key, target };
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function publicUrlForKey(key: string) {
  return `/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function contentTypeForKey(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".gpx")) return "application/gpx+xml";
  if (normalized.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function isProtectedStorageKey(key: string) {
  return (
    PROTECTED_STORAGE_KEYS.has(key) ||
    PROTECTED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))
  );
}

/**
 * Persistenter, selbst gehosteter Dateispeicher. Coolify mountet hierfür ein
 * Volume nach LOCAL_STORAGE_PATH (standardmäßig /app/data/uploads).
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const { target } = filePathForKey(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, data);
  await fs.rename(temporary, target);
  return { key, url: publicUrlForKey(key) };
}

export async function storageRead(relKey: string): Promise<Buffer> {
  const { key, target } = filePathForKey(relKey);
  try {
    return await fs.readFile(target);
  } catch (error: unknown) {
    // Das mitgelieferte Handbuch darf direkt aus dem Image gelesen werden. Eine
    // gleichnamige Datei im persistenten Volume hat dabei bewusst Vorrang.
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" &&
      PROTECTED_STORAGE_KEYS.has(key)
    ) {
      const bundled = path.resolve(
        process.cwd(),
        "client",
        "public",
        "handbook",
        key
      );
      return fs.readFile(bundled);
    }
    throw error;
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicUrlForKey(key) };
}

function setPublicStorageHeaders(res: Response, key: string, size: number) {
  res.set({
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": "inline",
    "Content-Length": String(size),
    "Content-Type": contentTypeForKey(key),
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
}

/** Öffentliche, aber bewusst auf nicht-sensitive Uploads begrenzte Anwendungsroute. */
export function registerLocalStorageRoutes(app: Express) {
  app.get("/uploads/*", async (req, res) => {
    const rawKey = (req.params as Record<string, string>)[0];
    if (!rawKey) {
      res.status(400).send("Dateischlüssel fehlt");
      return;
    }

    let key: string;
    try {
      key = normalizeKey(rawKey);
    } catch {
      res.status(400).send("Ungültiger Dateischlüssel");
      return;
    }
    if (isProtectedStorageKey(key)) {
      res.status(404).send("Nicht gefunden");
      return;
    }

    try {
      const bytes = await storageRead(key);
      setPublicStorageHeaders(res, key, bytes.length);
      res.status(200).send(bytes);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.status(404).send("Datei nicht gefunden");
        return;
      }
      console.error("[LocalStorage] Datei konnte nicht ausgeliefert werden:", error);
      res.status(500).send("Datei konnte nicht ausgeliefert werden");
    }
  });
}

export { contentTypeForKey, storageRoot };
