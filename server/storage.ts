import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express } from "express";

const PROTECTED_STORAGE_KEYS = new Set([
  "Handbuch_RSC_Helferplanung_742fcb04.pdf",
]);

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

/**
 * Löscht eine anwendungsverwaltete Uploaddatei. Nicht mehr vorhandene Dateien
 * gelten dabei als erfolgreich bereinigt, damit Wiederholungen eines
 * Retention-Laufs sicher und idempotent bleiben.
 */
export async function storageDelete(relKey: string): Promise<boolean> {
  const { target } = filePathForKey(relKey);
  try {
    await fs.unlink(target);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicUrlForKey(key) };
}

/**
 * Der persistente Uploadspeicher ist keine öffentliche Dateifreigabe. Jede
 * nutzerbezogene Datei wird ausschließlich über eine fachlich autorisierte
 * Anwendungsschnittstelle ausgeliefert (z. B. Standortlogo oder PDF-Eventbild).
 */
export function registerLocalStorageRoutes(app: Express) {
  app.all("/uploads/*", (_req, res) => {
    // Einheitliche 404-Antwort verhindert sowohl Rohdownloads als auch
    // Rückschlüsse auf gespeicherte Schlüsselnamen.
    res.status(404).send("Nicht gefunden");
  });
}

export { storageRoot };
