import type { Express, Request, Response } from "express";
import { getHelperByPdfShareCode } from "./db";
import { createHelperTaskPdf } from "./pdf";
import {
  verifyPublicHelperPdfToken,
  type PublicHelperPdfScope,
} from "./public-helper-pdf-token";
import { DEFAULT_TENANT_ID, withPlanningScope } from "./year-context";

const MAX_PUBLIC_HELPER_PDF_BYTES = 5_000_000;
const SHORT_PDF_CODE = /^[A-Za-z0-9_-]{8,12}$/;

type PublicHelperPdfRouteDependencies = {
  verifyToken: (token: string) => PublicHelperPdfScope | null;
  findHelperByShortCode: (
    shortCode: string
  ) => Promise<PublicHelperPdfScope | null | undefined>;
  createPdf: (helperId: number) => Promise<Buffer>;
  withScope: <T>(scope: PublicHelperPdfScope, callback: () => Promise<T>) => Promise<T>;
};

const defaultDependencies: PublicHelperPdfRouteDependencies = {
  verifyToken: verifyPublicHelperPdfToken,
  findHelperByShortCode: async shortCode => {
    const helper = await getHelperByPdfShareCode(shortCode);
    return helper
      ? {
          tenantId: helper.tenantId,
          year: helper.year,
          eventId: helper.eventId,
          helperId: helper.id,
        }
      : null;
  },
  createPdf: createHelperTaskPdf,
  withScope: (scope, callback) =>
    withPlanningScope(
      {
        tenantId: scope.tenantId ?? DEFAULT_TENANT_ID,
        year: scope.year,
        eventId: scope.eventId,
      },
      callback
    ),
};

function setPublicPdfCorsHeaders(res: Response) {
  res.set({
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers":
      "Content-Disposition, Content-Length, Content-Type",
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
  res
    .status(404)
    .type("text/plain")
    .send("Der persönliche Einsatzplan ist nicht verfügbar.");
}

function isValidPdf(pdf: unknown): pdf is Buffer {
  return (
    Buffer.isBuffer(pdf) &&
    pdf.length >= 5 &&
    pdf.length <= MAX_PUBLIC_HELPER_PDF_BYTES &&
    pdf.subarray(0, 5).toString("ascii") === "%PDF-"
  );
}

async function servePdfForScope(
  res: Response,
  scope: PublicHelperPdfScope,
  dependencies: PublicHelperPdfRouteDependencies,
  headOnly: boolean,
  logContext: Record<string, unknown>
) {
  try {
    const pdf = await dependencies.withScope(scope, () =>
      dependencies.createPdf(scope.helperId)
    );
    if (!isValidPdf(pdf)) throw new Error("Ungültige Helfer-PDF");
    setPdfHeaders(res, pdf.length);
    if (headOnly) {
      res.status(200).end();
      return;
    }
    res.status(200).send(pdf);
  } catch (error) {
    console.warn("[PublicHelperPdf] PDF-Freigabe nicht verfügbar", {
      ...logContext,
      ...scope,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) notAvailable(res);
    else res.destroy();
  }
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
  await servePdfForScope(res, claims, dependencies, headOnly, {
    route: "signed-token",
  });
}

async function serveShortPublicHelperPdf(
  req: Request,
  res: Response,
  dependencies: PublicHelperPdfRouteDependencies,
  headOnly: boolean
) {
  setPublicPdfCorsHeaders(res);
  const shortCode = req.params.shortCode ?? "";
  if (!SHORT_PDF_CODE.test(shortCode)) {
    notAvailable(res);
    return;
  }
  const helper = await dependencies.findHelperByShortCode(shortCode);
  if (!helper) {
    notAvailable(res);
    return;
  }
  await servePdfForScope(res, helper, dependencies, headOnly, {
    route: "short-code",
    shortCode,
  });
}

/**
 * Liefert persönliche Helfer-PDFs ohne Anmeldung:
 * - /api/public/pdf/:token bleibt für bereits versendete 90-Tage-Freigaben.
 * - /p/:shortCode ist die kompakte Route für neue WhatsApp-Nachrichten.
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

  app.options("/p/:shortCode", (_req, res) => {
    setPublicPdfCorsHeaders(res);
    res.status(204).end();
  });
  app.head("/p/:shortCode", (req, res) => {
    void serveShortPublicHelperPdf(req, res, dependencies, true);
  });
  app.get("/p/:shortCode", (req, res) => {
    void serveShortPublicHelperPdf(req, res, dependencies, false);
  });
}
