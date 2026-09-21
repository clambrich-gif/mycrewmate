import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { locations } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { storageRead } from "./storage";

const MAX_LOCATION_LOGO_BYTES = 3_000_000;

type LocationLogoRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<unknown>;
  findLocationLogo: (
    year: number,
    eventId: number,
    locationId: number
  ) => Promise<{ logoKey: string | null } | null>;
  readFile: (storageKey: string) => Promise<Buffer>;
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
  readFile: storageRead,
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

function setLocationLogoHeaders(res: Response, storageKey: string, size: number) {
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Length": String(size),
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

  try {
    const bytes = await dependencies.readFile(location.logoKey);
    if (!bytes.length || bytes.length > MAX_LOCATION_LOGO_BYTES) {
      res.status(422).send("Standortlogo ist leer oder überschreitet die Größenbegrenzung");
      return;
    }
    setLocationLogoHeaders(res, location.logoKey, bytes.length);
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(bytes);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("Standortlogodatei nicht gefunden");
      return;
    }
    console.error("[LocationLogo] Lokales Standortlogo konnte nicht geladen werden:", error);
    res.status(500).end();
  }
}

/** Liefert das geschützte Standortlogo aus dem persistierten Coolify-Volume aus. */
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
