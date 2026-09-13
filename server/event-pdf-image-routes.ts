import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { events } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import {
  resolveEventPdfLogoKey,
  type EventPdfImageSettings,
} from "./event-pdf-image";
import { storageGetSignedUrl } from "./storage";

const MAX_EVENT_IMAGE_BYTES = 3_000_000;

type EventPdfImageRouteDependencies = {
  authenticateRequest: (req: Request) => Promise<unknown>;
  findEvent: (
    year: number,
    eventId: number
  ) => Promise<EventPdfImageSettings | null>;
  getSignedUrl: (storageKey: string) => Promise<string>;
  fetchImpl: typeof fetch;
};

const defaultDependencies: EventPdfImageRouteDependencies = {
  authenticateRequest: req => sdk.authenticateRequest(req),
  findEvent: async (year, eventId) => {
    const db = await getDb();
    if (!db) return null;
    const [event] = await db
      .select({
        pdfLogoKey: events.pdfLogoKey,
        pdfLogoFallback: events.pdfLogoFallback,
      })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.year, year)))
      .limit(1);
    return event ?? null;
  },
  getSignedUrl: storageGetSignedUrl,
  fetchImpl: fetch,
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

  const contentType = imageContentType(storageKey);
  setImageHeaders(res, contentType);
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
      declaredLength > MAX_EVENT_IMAGE_BYTES
    ) {
      await upstream.body?.cancel();
      res.status(502).send("PDF-Bild überschreitet die Größenbegrenzung");
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
    if (!bytes.length || bytes.length > MAX_EVENT_IMAGE_BYTES) {
      res.status(502).send("PDF-Bild ist leer oder zu groß");
      return;
    }
    res.set("Content-Length", String(bytes.length));
    res.status(200).send(bytes);
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error("[EventPdfImage] delivery failed:", error);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
}

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
