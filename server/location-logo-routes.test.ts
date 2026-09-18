import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  locationLogoUrl,
  registerLocationLogoRoutes,
} from "./location-logo-routes";

const servers: Server[] = [];

async function startTestServer(options?: {
  authenticated?: boolean;
  location?: { logoKey: string | null } | null;
}) {
  const app = express();
  const authenticateRequest = vi.fn(async () => {
    if (options?.authenticated === false) throw new Error("unauthorized");
    return { role: "user" };
  });
  const findLocationLogo = vi.fn(async () =>
    options && "location" in options
      ? (options.location ?? null)
      : { logoKey: "location-logos/events/2027/77/viehmarkt.png" }
  );
  const getSignedUrl = vi.fn(async () => "https://storage.test/location-logo.png");
  const image = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
  ]);
  const fetchImpl = vi.fn(async () =>
    new Response(image, {
      status: 200,
      headers: { "Content-Length": String(image.byteLength) },
    })
  ) as unknown as typeof fetch;

  registerLocationLogoRoutes(app, {
    authenticateRequest,
    findLocationLogo,
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
    findLocationLogo,
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

describe("Stabile Standortlogo-Anwendungsroute", () => {
  it("liefert das Event- und Standort-gebundene Bild direkt als Same-Origin-Antwort", async () => {
    const testServer = await startTestServer();
    const response = await fetch(
      `${testServer.baseUrl}/api/location-logo/2027/77/12`,
      { redirect: "manual" }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(response.headers.get("vary")).toContain("Authorization");
    expect(testServer.findLocationLogo).toHaveBeenCalledWith(2027, 77, 12);
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "location-logos/events/2027/77/viehmarkt.png"
    );
  });

  it("verweigert einen Zugriff ohne Sitzung", async () => {
    const testServer = await startTestServer({ authenticated: false });
    const response = await fetch(
      `${testServer.baseUrl}/api/location-logo/2027/77/12`
    );

    expect(response.status).toBe(401);
    expect(testServer.findLocationLogo).not.toHaveBeenCalled();
  });

  it("liefert 404, wenn der Standort kein Logo führt", async () => {
    const testServer = await startTestServer({ location: { logoKey: null } });
    const response = await fetch(
      `${testServer.baseUrl}/api/location-logo/2027/77/12`
    );

    expect(response.status).toBe(404);
    expect(testServer.getSignedUrl).not.toHaveBeenCalled();
  });

  it("erstellt nur bei vorhandenem Storage-Key eine stabile Anwendungs-URL", () => {
    expect(
      locationLogoUrl({
        id: 12,
        year: 2027,
        eventId: 77,
        logoKey: "location-logos/events/2027/77/viehmarkt.png",
      })
    ).toBe("/api/location-logo/2027/77/12");
    expect(
      locationLogoUrl({ id: 12, year: 2027, eventId: 77, logoKey: null })
    ).toBeNull();
  });
});
