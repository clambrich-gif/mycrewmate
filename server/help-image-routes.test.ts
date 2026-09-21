import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerHelpImageRoutes } from "./help-image-routes";

const servers: Server[] = [];

async function startTestServer() {
  const app = express();
  registerHelpImageRoutes(app);

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

describe("Same-Origin-Hilfebilder", () => {
  it("liefert Dashboardbilder aus dem lokalen Projektordner ohne externe Weiterleitung", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/help/images/dashboard`, {
      redirect: "manual",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(1_000);
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin"
    );
  });

  it("liefert HEAD-Metadaten ohne Bildinhalt", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/help/images/plan`, {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(1_000);
  });

  it("liefert die aktuellen Rollenposter über die lokale Same-Origin-Bildroute", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/help/images/video-planungsteam`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("liefert die bebilderte PWA-Anleitung über die lokale Same-Origin-Bildroute", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/help/images/app-speichern`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("weist unbekannte Bildnamen ab", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/api/help/images/unbekannt`);
    expect(response.status).toBe(404);
  });
});
