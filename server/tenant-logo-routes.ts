import type { Express, Request, Response } from "express";
import { appSettings } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";

const MAX_TENANT_LOGO_BYTES = 3_000_000;

type TenantLogoRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<unknown>;
  getTenantLogoKey: () => Promise<string | null>;
  getSignedUrl: (storageKey: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

const defaultDependencies: TenantLogoRouteDependencies = {
  authenticateRequest: req => sdk.authenticateRequest(req),
  getTenantLogoKey: async () => {
    const db = await getDb();
    if (!db) return null;
    const [settings] = await db
      .select({ tenantLogoKey: appSettings.tenantLogoKey })
      .from(appSettings)
      .limit(1);
    return settings?.tenantLogoKey ?? null;
  },
  getSignedUrl: storageGetSignedUrl,
  fetchImpl: fetch,
};

function imageContentType(storageKey: string) {
  return storageKey.toLocaleLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";
}

function setImageHeaders(res: Response, contentType: string) {
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    Vary: "Cookie, Authorization",
    "X-Content-Type-Options": "nosniff",
  });
}

async function serveTenantLogo(
  req: Request,
  res: Response,
  dependencies: TenantLogoRouteDependencies,
  headOnly: boolean
) {
  try {
    await dependencies.authenticateRequest(req);
  } catch {
    res.status(401).send("Anmeldung erforderlich");
    return;
  }

  const storageKey = await dependencies.getTenantLogoKey();
  if (!storageKey) {
    res.status(404).send("Kein Vereinslogo hinterlegt");
    return;
  }

  const abortController = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const signedUrl = await dependencies.getSignedUrl(storageKey);
    const upstream = await dependencies.fetchImpl(signedUrl, {
      signal: abortController.signal,
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }
    const declaredLength = Number(upstream.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      (declaredLength <= 0 || declaredLength > MAX_TENANT_LOGO_BYTES)
    ) {
      await upstream.body?.cancel();
      res.status(502).send("Vereinslogo ist leer oder zu groß");
      return;
    }
    setImageHeaders(res, imageContentType(storageKey));
    if (headOnly) {
      if (Number.isFinite(declaredLength)) {
        res.set("Content-Length", String(declaredLength));
      }
      await upstream.body?.cancel();
      res.status(200).end();
      return;
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_TENANT_LOGO_BYTES) {
      res.status(502).send("Vereinslogo ist leer oder zu groß");
      return;
    }
    res.set("Content-Length", String(bytes.length));
    res.status(200).send(bytes);
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error("[TenantLogo] delivery failed:", error);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
}

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

export type { TenantLogoRouteDependencies };
