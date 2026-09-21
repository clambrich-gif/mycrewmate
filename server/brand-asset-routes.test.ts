import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerBrandAssetRoutes } from "./brand-asset-routes";

const servers: Server[] = [];

async function startTestServer() {
  const app = express();
  registerBrandAssetRoutes(app);
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Testserver konnte nicht gestartet werden");
  }
  return `http://127.0.0.1:${address.port}`;
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
  it("liefert die gebündelte Wortmarke direkt ohne externe Storage-URL aus", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/brand/wordmark`, {
      redirect: "manual",
    });
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(1_000);
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it("liefert HEAD-Metadaten ohne Bildinhalt", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/brand/infinity`, {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(1_000);
  });

  it("weist unbekannte Markenassets ohne Dateizugriff ab", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/brand/unbekannt`);
    expect(response.status).toBe(404);
  });
});
