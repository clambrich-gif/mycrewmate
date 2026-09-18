import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { locations } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";

const MAX_LOCATION_LOGO_BYTES = 3_000_000;

type LocationLogoRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<unknown>;
  findLocationLogo: (
    year: number,
    eventId: number,
    locationId: number
  ) => Promise<{ logoKey: string | null } | null>;
  getSignedUrl: (storageKey: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

const defaultDependencies: LocationLogoRouteDependencies = {
  authenticateRequest: req => sdk.authenticateRequest(req),
  findLocationLogo: async (year, eventId, locationId) => {
    const db = await getDb();
    if (!db) return null;
    const [location] = await db
      .select({ logoKey: locations.logoKey })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.year, year),
          eq(locations.eventId, eventId)
        )
      )
      .limit(1);
    return location ?? null;
  },
  getSignedUrl: storageGetSignedUrl,
  fetchImpl: fetch,
};

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function locationLogoUrl(
  location: { id: number; year: number; eventId: number; logoKey: string | null }
) {
  if (!location.logoKey) return null;
  return `/api/location-logo/${location.year}/${location.eventId}/${location.id}`;
}

function locationLogoContentType(storageKey: string) {
  const normalized = storageKey.toLocaleLowerCase();
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "image/png";
}

function setLocationLogoHeaders(res: Response, storageKey: string) {
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Type": locationLogoContentType(storageKey),
    "Cross-Origin-Resource-Policy": "same-origin",
    Vary: "Cookie, Authorization",
    "X-Content-Type-Options": "nosniff",
  });
}

async function serveLocationLogo(
  req: Request,
  res: Response,
  dependencies: LocationLogoRouteDependencies,
  headOnly: boolean
) {
  try {
    await dependencies.authenticateRequest(req);
  } catch {
    res.status(401).send("Anmeldung erforderlich");
    return;
  }

  const year = positiveInteger(req.params.year);
  const eventId = positiveInteger(req.params.eventId);
  const locationId = positiveInteger(req.params.locationId);
  if (!year || year < 2020 || year > 2100 || !eventId || !locationId) {
    res.status(400).send("Ungültiger Standort");
    return;
  }

  const location = await dependencies.findLocationLogo(year, eventId, locationId);
  if (!location?.logoKey) {
    res.status(404).send("Für diesen Standort ist kein Logo hinterlegt");
    return;
  }

  setLocationLogoHeaders(res, location.logoKey);
  const abortController = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const signedUrl = await dependencies.getSignedUrl(location.logoKey);
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
      declaredLength > MAX_LOCATION_LOGO_BYTES
    ) {
      await upstream.body?.cancel();
      res.status(502).send("Standortlogo überschreitet die Größenbegrenzung");
      return;
    }
    if (headOnly) {
      if (Number.isFinite(declaredLength)) {
        res.set("Content-Length", String(declaredLength));
      }
      await upstream.body?.cancel();
      res.status(200).end();
      return;
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_LOCATION_LOGO_BYTES) {
      res.status(502).send("Standortlogo ist leer oder zu groß");
      return;
    }
    res.set("Content-Length", String(bytes.length));
    res.status(200).send(bytes);
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error("[LocationLogo] delivery failed:", error);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
}

export function registerLocationLogoRoutes(
  app: Express,
  dependencies: LocationLogoRouteDependencies = defaultDependencies
) {
  app.head("/api/location-logo/:year/:eventId/:locationId", (req, res) => {
    void serveLocationLogo(req, res, dependencies, true);
  });
  app.get("/api/location-logo/:year/:eventId/:locationId", (req, res) => {
    void serveLocationLogo(req, res, dependencies, false);
  });
}
