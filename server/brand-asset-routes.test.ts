import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerBrandAssetRoutes } from "./brand-asset-routes";

const servers: Server[] = [];

async function startTestServer() {
  const app = express();
  const getSignedUrl = vi.fn(async () => "https://storage.test/logo.png");
  const logo = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
  ]);
  const fetchImpl = vi.fn(async () =>
    new Response(logo, {
      status: 200,
      headers: {
        "Content-Length": String(logo.byteLength),
        ETag: '"logo-etag"',
        "Last-Modified": "Sat, 12 Sep 2026 20:00:00 GMT",
      },
    })
  ) as unknown as typeof fetch;

  registerBrandAssetRoutes(app, { getSignedUrl, fetchImpl });
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

describe("Öffentliche MyCrewMate-Logoauslieferung", () => {
  it("liefert das PNG direkt ohne Storage-Redirect aus", async () => {
    const testServer = await startTestServer();
    const response = await fetch(`${testServer.baseUrl}/mycrewmate-logo.png`, {
      redirect: "manual",
    });
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "mycrewmate-wordmark_853a60e9.png"
    );
  });

  it("liefert HEAD-Metadaten ohne Bildinhalt", async () => {
    const testServer = await startTestServer();
    const response = await fetch(`${testServer.baseUrl}/mycrewmate-logo.png`, {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("etag")).toBe('"logo-etag"');
  });

  it("beantwortet öffentlichen CORS-Preflight ohne Storagezugriff", async () => {
    const testServer = await startTestServer();
    const response = await fetch(`${testServer.baseUrl}/mycrewmate-logo.png`, {
      method: "OPTIONS",
      headers: { Origin: "https://example.org" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "GET"
    );
    expect(testServer.getSignedUrl).not.toHaveBeenCalled();
    expect(testServer.fetchImpl).not.toHaveBeenCalled();
  });
});
