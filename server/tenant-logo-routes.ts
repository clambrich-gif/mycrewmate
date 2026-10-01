import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { storageRead } from "./storage";
import { ADMIN_PASSWORD_OPEN_ID } from "./password-auth";

const MAX_TENANT_LOGO_BYTES = 3_000_000;

type TenantLogoRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<{
    openId: string;
    role: "user" | "admin";
  }>;
  getTenantLogoKey: () => Promise<string | null>;
  readFile: (storageKey: string) => Promise<Buffer>;
};

const defaultDependencies: TenantLogoRouteDependencies = {
  authenticateRequest: req => sdk.authenticateRequest(req),
  getTenantLogoKey: async () => (await db.getAppSettings())?.tenantLogoKey ?? null,
  readFile: storageRead,
};

function contentTypeForLogo(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

async function serveTenantLogo(
  req: Request,
  res: Response,
  dependencies: TenantLogoRouteDependencies,
  headOnly: boolean
) {
  try {
    const user = await dependencies.authenticateRequest(req);
    // Der ältere globale Logo-Speicher besitzt keine Vereinszuordnung. Er bleibt
    // daher ausschließlich für die Plattformadministration lesbar, bis er
    // vollständig durch mandantengebundene Brandingdaten ersetzt ist.
    if (user.role !== "admin" || user.openId !== ADMIN_PASSWORD_OPEN_ID) {
      res.status(404).send("Nicht gefunden");
      return;
    }
  } catch {
    res.status(401).send("Anmeldung erforderlich");
    return;
  }

  const logoKey = await dependencies.getTenantLogoKey();
  if (!logoKey) {
    res.status(404).send("Kein Vereinslogo hinterlegt");
    return;
  }

  try {
    const bytes = await dependencies.readFile(logoKey);
    if (!bytes.length || bytes.length > MAX_TENANT_LOGO_BYTES) {
      res.status(422).send("Vereinslogo ist leer oder überschreitet die Größenbegrenzung");
      return;
    }
    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Length": String(bytes.length),
      "Content-Type": contentTypeForLogo(logoKey),
      "Cross-Origin-Resource-Policy": "same-origin",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
    });
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(bytes);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("Vereinslogodatei nicht gefunden");
      return;
    }
    console.error("[TenantLogo] Lokales Vereinslogo konnte nicht geladen werden:", error);
    res.status(500).end();
  }
}

/** Liefert das geschützte Vereinslogo aus dem persistierten Coolify-Volume aus. */
export function registerTenantLogoRoutes(
  app: Express,
  dependencies: TenantLogoRouteDependencies = defaultDependencies
) {
  app.head("/api/tenant-logo", (req, res) => {
    void serveTenantLogo(req, res, dependencies, true);
  });
  app.get("/api/tenant-logo", (req, res) => {
    void serveTenantLogo(req, res, dependencies, false);
  });
}
