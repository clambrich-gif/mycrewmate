import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { events } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import {
  resolveEventPdfLogoKey,
  type EventPdfImageSettings,
} from "./event-pdf-image";
import { storageRead } from "./storage";

const MAX_EVENT_IMAGE_BYTES = 3_000_000;

type EventPdfImageRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<unknown>;
  findEvent: (
    year: number,
    eventId: number
  ) => Promise<EventPdfImageSettings | null>;
  readFile: (storageKey: string) => Promise<Buffer>;
};

const defaultDependencies: EventPdfImageRouteDependencies = {
  authenticateRequest: req => sdk.authenticateRequest(req),
  findEvent: async (year, eventId) => {
    const db = await getDb();
    if (!db) return null;
    const [event] = await db
      .select({ pdfLogoKey: events.pdfLogoKey })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.year, year)))
      .limit(1);
    return event ?? null;
  },
  readFile: storageRead,
};

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

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

async function serveEventPdfImage(
  req: Request,
  res: Response,
  dependencies: EventPdfImageRouteDependencies,
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
  if (!year || year < 2020 || year > 2100 || !eventId) {
    res.status(400).send("Ungültige Veranstaltung");
    return;
  }

  const event = await dependencies.findEvent(year, eventId);
  const storageKey = event ? resolveEventPdfLogoKey(event) : null;
  if (!storageKey) {
    res.status(404).send("Für diese Veranstaltung ist kein PDF-Bild hinterlegt");
    return;
  }

  try {
    const bytes = await dependencies.readFile(storageKey);
    if (!bytes.length || bytes.length > MAX_EVENT_IMAGE_BYTES) {
      res.status(422).send("PDF-Bild ist leer oder überschreitet die Größenbegrenzung");
      return;
    }
    setImageHeaders(res, imageContentType(storageKey));
    res.set("Content-Length", String(bytes.length));
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(bytes);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).send("PDF-Bilddatei nicht gefunden");
      return;
    }
    console.error("[EventPdfImage] Lokales Bild konnte nicht geladen werden:", error);
    res.status(500).end();
  }
}

/** Liefert das Eventbild aus dem persistenten lokalen Uploadvolume aus. */
export function registerEventPdfImageRoutes(
  app: Express,
  dependencies: EventPdfImageRouteDependencies = defaultDependencies
) {
  app.head("/api/pdf/event-image/:year/:eventId", (req, res) => {
    void serveEventPdfImage(req, res, dependencies, true);
  });
  app.get("/api/pdf/event-image/:year/:eventId", (req, res) => {
    void serveEventPdfImage(req, res, dependencies, false);
  });
}
