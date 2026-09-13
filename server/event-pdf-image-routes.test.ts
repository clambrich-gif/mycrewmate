import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerEventPdfImageRoutes } from "./event-pdf-image-routes";

const servers: Server[] = [];

async function startTestServer(options?: {
  authenticated?: boolean;
  event?: {
    pdfLogoKey: string | null;
    pdfLogoFallback: "none" | "brand";
  } | null;
}) {
  const app = express();
  const authenticateRequest = vi.fn(async () => {
    if (options?.authenticated === false) throw new Error("unauthorized");
    return { role: "user" };
  });
  const findEvent = vi.fn(async () =>
    options && "event" in options
      ? (options.event ?? null)
      : {
          pdfLogoKey: "pdf-logos/events/2027/77/weihnachtsbaum.png",
          pdfLogoFallback: "none" as const,
        }
  );
  const getSignedUrl = vi.fn(async () => "https://storage.test/event-image.png");
  const image = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
  ]);
  const fetchImpl = vi.fn(async () =>
    new Response(image, {
      status: 200,
      headers: { "Content-Length": String(image.byteLength) },
    })
  ) as unknown as typeof fetch;

  registerEventPdfImageRoutes(app, {
    authenticateRequest,
    findEvent,
    getSignedUrl,
    fetchImpl,
  });
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
    authenticateRequest,
    findEvent,
    getSignedUrl,
    fetchImpl,
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

describe("Veranstaltungsspezifische PDF-Bildauslieferung", () => {
  it("liefert ausschließlich das Bild der angeforderten Event-ID direkt aus", async () => {
    const testServer = await startTestServer();
    const response = await fetch(
      `${testServer.baseUrl}/api/pdf/event-image/2027/77`,
      { redirect: "manual" }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(response.headers.get("vary")).toContain("Authorization");
    expect(testServer.findEvent).toHaveBeenCalledWith(2027, 77);
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "pdf-logos/events/2027/77/weihnachtsbaum.png"
    );
  });

  it("verwendet nur bei konfiguriertem Fallback das RSC-Vereinslogo", async () => {
    const withFallback = await startTestServer({
      event: { pdfLogoKey: null, pdfLogoFallback: "brand" },
    });
    const fallbackResponse = await fetch(
      `${withFallback.baseUrl}/api/pdf/event-image/2027/77`
    );
    expect(fallbackResponse.status).toBe(200);
    expect(withFallback.getSignedUrl).toHaveBeenCalledWith(
      "rsc-eifelland-logo-chrome_25463ad8.png"
    );

    const withoutFallback = await startTestServer({
      event: { pdfLogoKey: null, pdfLogoFallback: "none" },
    });
    const emptyResponse = await fetch(
      `${withoutFallback.baseUrl}/api/pdf/event-image/2027/78`
    );
    expect(emptyResponse.status).toBe(404);
    expect(withoutFallback.getSignedUrl).not.toHaveBeenCalled();
  });

  it("liefert ohne gültige Sitzung kein Eventbild aus", async () => {
    const testServer = await startTestServer({ authenticated: false });
    const response = await fetch(
      `${testServer.baseUrl}/api/pdf/event-image/2027/77`
    );

    expect(response.status).toBe(401);
    expect(testServer.findEvent).not.toHaveBeenCalled();
    expect(testServer.getSignedUrl).not.toHaveBeenCalled();
  });
});
