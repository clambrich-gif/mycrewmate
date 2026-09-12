import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerHelpVideoRoutes } from "./help-video-routes";

const servers: Server[] = [];

async function startTestServer(options: {
  role: "admin" | "user";
  upstream: (request: Request) => Response | Promise<Response>;
}) {
  const app = express();
  const authenticateRequest = vi.fn(async () => ({ role: options.role }));
  const getSignedUrl = vi.fn(async () => "https://storage.test/video.mp4");
  const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const request = new Request(input, init);
    return options.upstream(request);
  }) as unknown as typeof fetch;

  registerHelpVideoRoutes(app, {
    authenticateRequest,
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

describe("Hilfevideo-Streaming", () => {
  it("reicht Byte-Ranges mit MP4- und CORS-Headern als 206 durch", async () => {
    const requestedRanges: Array<string | null> = [];
    const testServer = await startTestServer({
      role: "admin",
      upstream: request => {
        requestedRanges.push(request.headers.get("range"));
        return new Response(Uint8Array.from([0, 1, 2, 3]), {
          status: 206,
          headers: {
            "Content-Length": "4",
            "Content-Range": "bytes 0-3/10",
            ETag: '"video-etag"',
          },
        });
      },
    });

    const response = await fetch(`${testServer.baseUrl}/api/videos/admin`, {
      headers: { Range: "bytes=0-3", Origin: testServer.baseUrl },
    });

    expect(response.status).toBe(206);
    expect((await response.arrayBuffer()).byteLength).toBe(4);
    expect(requestedRanges).toEqual(["bytes=0-3"]);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 0-3/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      testServer.baseUrl
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "Content-Range"
    );
  });

  it("blockiert das Video der jeweils anderen Rolle serverseitig", async () => {
    const testServer = await startTestServer({
      role: "user",
      upstream: () => new Response("nicht erwartet"),
    });

    const response = await fetch(`${testServer.baseUrl}/api/videos/admin`);

    expect(response.status).toBe(403);
    expect(testServer.getSignedUrl).not.toHaveBeenCalled();
    expect(testServer.fetchImpl).not.toHaveBeenCalled();
  });

  it("liefert HEAD-Metadaten mit vollständiger Dateigröße", async () => {
    const requestedRanges: Array<string | null> = [];
    const testServer = await startTestServer({
      role: "user",
      upstream: request => {
        requestedRanges.push(request.headers.get("range"));
        return new Response(Uint8Array.from([0]), {
          status: 206,
          headers: {
            "Content-Length": "1",
            "Content-Range": "bytes 0-0/20812536",
          },
        });
      },
    });

    const response = await fetch(
      `${testServer.baseUrl}/api/videos/planungsteam`,
      { method: "HEAD" }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(requestedRanges).toEqual(["bytes=0-0"]);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("20812536");
  });

  it("beantwortet CORS-Preflight ohne Videodownload", async () => {
    const testServer = await startTestServer({
      role: "admin",
      upstream: () => new Response("nicht erwartet"),
    });

    const response = await fetch(`${testServer.baseUrl}/api/videos/admin`, {
      method: "OPTIONS",
      headers: { Origin: testServer.baseUrl },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      testServer.baseUrl
    );
    expect(response.headers.get("access-control-allow-headers")).toBe("Range");
    expect(testServer.authenticateRequest).not.toHaveBeenCalled();
    expect(testServer.fetchImpl).not.toHaveBeenCalled();
  });
});
