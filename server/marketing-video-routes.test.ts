import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerMarketingVideoRoutes } from "./marketing-video-routes";

const nativeFetch = globalThis.fetch;
const servers: Server[] = [];

async function startTestServer() {
  const app = express();
  registerMarketingVideoRoutes(app);
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
  vi.unstubAllGlobals();
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>((resolve, reject) =>
          server.close(error => (error ? reject(error) : resolve()))
        )
    )
  );
});

describe("Same-Origin-Auslieferung des öffentlichen Werbefilms", () => {
  it("reicht eine Bereichsanfrage als inline MP4 durch", async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 206,
        headers: {
          "content-length": "4",
          "content-range": "bytes 0-3/100",
          "content-type": "video/mp4",
        },
      })
    );
    vi.stubGlobal("fetch", upstreamFetch);
    const baseUrl = await startTestServer();

    const response = await nativeFetch(`${baseUrl}/api/marketing/promo-video`, {
      headers: { Range: "bytes=0-3" },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 0-3/100");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.stringContaining("NmSgPWXCECmcADpS.mp4"),
      expect.objectContaining({
        headers: { Range: "bytes=0-3" },
        method: "GET",
      })
    );
  });

  it("liefert bei HEAD nur sichere Videometadaten", async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "content-length": "38054728",
          "content-type": "video/mp4",
        },
      })
    );
    vi.stubGlobal("fetch", upstreamFetch);
    const baseUrl = await startTestServer();

    const response = await nativeFetch(`${baseUrl}/api/marketing/promo-video`, {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("38054728");
    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "HEAD" })
    );
  });
});
