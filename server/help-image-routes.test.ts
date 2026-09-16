import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerHelpImageRoutes } from "./help-image-routes";

const servers: Server[] = [];

async function startTestServer(options: {
  upstream: () => Response | Promise<Response>;
}) {
  const app = express();
  const getSignedUrl = vi.fn(async () => "https://storage.test/help-image.png");
  const fetchImpl = vi.fn(async () => options.upstream()) as unknown as typeof fetch;
  registerHelpImageRoutes(app, { getSignedUrl, fetchImpl });

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

describe("Same-Origin-Hilfebilder", () => {
  it("liefert Dashboardbilder ohne externe Weiterleitung mit festen PNG-Headern", async () => {
    const testServer = await startTestServer({
      upstream: () =>
        new Response(Uint8Array.from([137, 80, 78, 71]), {
          status: 200,
          headers: {
            "Content-Length": "4",
            ETag: '"help-image-etag"',
          },
        }),
    });

    const response = await fetch(
      `${testServer.baseUrl}/api/help/images/dashboard`,
      { redirect: "manual" }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin"
    );
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "dashboard-current_8a026d64.png"
    );
    expect(testServer.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("liefert HEAD-Metadaten ohne den Bildinhalt abzurufen", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(Uint8Array.from([1]));
      },
    });
    const testServer = await startTestServer({
      upstream: () =>
        new Response(body, {
          status: 200,
          headers: { "Content-Length": "166208" },
        }),
    });

    const response = await fetch(`${testServer.baseUrl}/api/help/images/plan`, {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("166208");
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "plan-current_62afa870.png"
    );
  });

  it("liefert die aktuellen Rollenposter über die Same-Origin-Bildroute", async () => {
    const testServer = await startTestServer({
      upstream: () => new Response(Uint8Array.from([137, 80, 78, 71])),
    });

    const response = await fetch(
      `${testServer.baseUrl}/api/help/images/video-planungsteam`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "planning-login-highlight_f7715b9e.png"
    );
  });

  it("liefert die bebilderte PWA-Anleitung über die Same-Origin-Bildroute", async () => {
    const testServer = await startTestServer({
      upstream: () => new Response(Uint8Array.from([137, 80, 78, 71])),
    });

    const response = await fetch(
      `${testServer.baseUrl}/api/help/images/app-speichern`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(testServer.getSignedUrl).toHaveBeenCalledWith(
      "pwa-app-speichern-telefon_075d3868.png"
    );
  });

  it("weist unbekannte Bildnamen ab, ohne Storage anzufragen", async () => {
    const testServer = await startTestServer({
      upstream: () => new Response("nicht erwartet"),
    });

    const response = await fetch(
      `${testServer.baseUrl}/api/help/images/unbekannt`
    );

    expect(response.status).toBe(404);
    expect(testServer.getSignedUrl).not.toHaveBeenCalled();
    expect(testServer.fetchImpl).not.toHaveBeenCalled();
  });
});
