import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPublicHelperPdfRoutes } from "./public-helper-pdf-routes";

const servers: Server[] = [];
const PDF = Buffer.from("%PDF-1.7\nPersönlicher Einsatzplan");

async function startTestServer(options: {
  claims: { year: number; eventId: number; helperId: number } | null;
  pdf?: Buffer;
  createPdfError?: Error;
}) {
  const app = express();
  const verifyToken = vi.fn(() => options.claims);
  const createPdf = vi.fn(async () => {
    if (options.createPdfError) throw options.createPdfError;
    return options.pdf ?? PDF;
  });
  const withScope = vi.fn(async (_year, _eventId, callback) => callback());
  registerPublicHelperPdfRoutes(app, { verifyToken, createPdf, withScope });

  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Testserver konnte nicht gestartet werden");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    verifyToken,
    createPdf,
    withScope,
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>((resolve, reject) =>
          server.close(error => (error ? reject(error) : resolve()))
        )
    )
  );
});

describe("öffentliche Helfer-PDF-Route", () => {
  it("liefert eine signiert freigegebene persönliche PDF ohne Anmeldung inline aus", async () => {
    const server = await startTestServer({
      claims: { year: 2027, eventId: 1020001, helperId: 44 },
    });

    const response = await fetch(`${server.baseUrl}/api/public/pdf/freigabe-token`);

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(server.verifyToken).toHaveBeenCalledWith("freigabe-token");
    expect(server.withScope).toHaveBeenCalledWith(
      2027,
      1020001,
      expect.any(Function)
    );
    expect(server.createPdf).toHaveBeenCalledWith(44);
  });

  it("beantwortet ungültige oder nicht mehr verfügbare Freigaben ohne PDF-Daten mit 404", async () => {
    const invalid = await startTestServer({ claims: null });
    const missing = await startTestServer({
      claims: { year: 2027, eventId: 1020001, helperId: 44 },
      createPdfError: new Error("Helfer wurde nicht gefunden"),
    });

    const invalidResponse = await fetch(
      `${invalid.baseUrl}/api/public/pdf/ungültig`
    );
    const missingResponse = await fetch(
      `${missing.baseUrl}/api/public/pdf/nicht-mehr-verfügbar`
    );

    expect(invalidResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
    expect(invalid.createPdf).not.toHaveBeenCalled();
  });

  it("liefert bei HEAD nur sichere PDF-Metadaten", async () => {
    const server = await startTestServer({
      claims: { year: 2027, eventId: 1020001, helperId: 44 },
    });

    const response = await fetch(`${server.baseUrl}/api/public/pdf/freigabe-token`, {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-length")).toBe(String(PDF.length));
    expect(response.headers.get("content-type")).toBe("application/pdf");
  });
});
