import type { Express, Request, Response } from "express";
import { createHelperTaskPdf } from "./pdf";
import {
  verifyPublicHelperPdfToken,
  type PublicHelperPdfScope,
} from "./public-helper-pdf-token";
import { withEventScope } from "./year-context";

const MAX_PUBLIC_HELPER_PDF_BYTES = 5_000_000;

type PublicHelperPdfRouteDependencies = {
  verifyToken: (token: string) => PublicHelperPdfScope | null;
  createPdf: (helperId: number) => Promise<Buffer>;
  withScope: <T>(
    year: number,
    eventId: number,
    callback: () => Promise<T>
  ) => Promise<T>;
};

const defaultDependencies: PublicHelperPdfRouteDependencies = {
  verifyToken: verifyPublicHelperPdfToken,
  createPdf: createHelperTaskPdf,
  withScope: (year, eventId, callback) => withEventScope(year, eventId, callback),
};

function setPublicPdfCorsHeaders(res: Response) {
  res.set({
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Content-Type",
  });
}

function setPdfHeaders(res: Response, contentLength?: number) {
  setPublicPdfCorsHeaders(res);
  res.set({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": "inline; filename=Einsatzplan.pdf",
    "Content-Type": "application/pdf",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  if (contentLength !== undefined) {
    res.set("Content-Length", String(contentLength));
  }
}

function notAvailable(res: Response) {
  res.status(404).type("text/plain").send("Der persönliche Einsatzplan ist nicht verfügbar.");
}

async function servePublicHelperPdf(
  req: Request,
  res: Response,
  dependencies: PublicHelperPdfRouteDependencies,
  headOnly: boolean
) {
  setPublicPdfCorsHeaders(res);
  const claims = dependencies.verifyToken(req.params.token ?? "");
  if (!claims) {
    notAvailable(res);
    return;
  }

  try {
    const pdf = await dependencies.withScope(
      claims.year,
      claims.eventId,
      () => dependencies.createPdf(claims.helperId)
    );
    if (
      !Buffer.isBuffer(pdf) ||
      pdf.length < 5 ||
      pdf.length > MAX_PUBLIC_HELPER_PDF_BYTES ||
      pdf.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new Error("Ungültige Helfer-PDF");
    }
    setPdfHeaders(res, pdf.length);
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(pdf);
  } catch (error) {
    console.warn("[PublicHelperPdf] PDF-Freigabe nicht verfügbar", {
      year: claims.year,
      eventId: claims.eventId,
      helperId: claims.helperId,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) notAvailable(res);
    else res.destroy();
  }
}

/**
 * Liefert eine persönliche Helfer-PDF ohne Anmeldung ausschließlich über ein
 * signiertes, zeitlich begrenztes Freigabetoken aus.
 */
export function registerPublicHelperPdfRoutes(
  app: Express,
  dependencies: PublicHelperPdfRouteDependencies = defaultDependencies
) {
  app.options("/api/public/pdf/:token", (_req, res) => {
    setPublicPdfCorsHeaders(res);
    res.status(204).end();
  });
  app.head("/api/public/pdf/:token", (req, res) => {
    void servePublicHelperPdf(req, res, dependencies, true);
  });
  app.get("/api/public/pdf/:token", (req, res) => {
    void servePublicHelperPdf(req, res, dependencies, false);
  });
}
