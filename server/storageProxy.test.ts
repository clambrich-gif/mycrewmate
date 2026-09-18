import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerStorageProxy } from "./_core/storageProxy";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  registerStorageProxy(app);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Testserver konnte nicht gestartet werden");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
});

describe("Storage-Proxy", () => {
  it("liefert die Anleitung nicht über den öffentlichen Storage-Pfad aus", async () => {
    const response = await fetch(
      `${baseUrl}/manus-storage/Handbuch_RSC_Helferplanung_742fcb04.pdf`,
      { redirect: "manual" }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    "pdf-logos/veranstaltungslogo_21d8a485.jpg",
    "pdf-logos/events/2027/77/pdf-logo_a1b2c3d4.png",
    "RSC-Helferplanung-Erklaervideo-Administratoren_48a1d1ca.mp4",
    "RSC-Helferplanung-Erklaervideo-Planungsteam_3101461c.mp4",
    "RSC-Helferplanung-Einweisung-Planungsteam_01385146.mp4",
    "RSC-Helferplanung-Planungsteam-Schulung-A-bis-Z_0353653d.mp4",
    "RSC-Helferplanung-Planungsteam-Schulung-A-bis-Z_199b9f42.mp4",
    "RSC-Helferplanung-Schulung-Administratoren_f2c73550.mp4",
  ])("liefert geschützte Medien nicht über den öffentlichen Storage-Pfad aus: %s", async key => {
    const response = await fetch(`${baseUrl}/manus-storage/${key}`, {
      redirect: "manual",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("liefert Standortlogos als Same-Origin-Bild statt als Redirect aus", async () => {
    const app = express();
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const getSignedUrl = vi.fn().mockResolvedValue("https://storage.example.test/logo.png");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { "content-length": String(bytes.length) },
      })
    );
    registerStorageProxy(app, { getSignedUrl, fetchImpl });
    const logoServer = await new Promise<Server>(resolve => {
      const next = app.listen(0, "127.0.0.1", () => resolve(next));
    });
    const address = logoServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Testserver konnte nicht gestartet werden");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/manus-storage/location-logos/events/2027/1/viehmarkt.png`,
        { redirect: "manual" }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
      expect(response.headers.get("location")).toBeNull();
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(getSignedUrl).toHaveBeenCalledWith(
        "location-logos/events/2027/1/viehmarkt.png"
      );
      expect(fetchImpl).toHaveBeenCalledWith("https://storage.example.test/logo.png");
    } finally {
      await new Promise<void>((resolve, reject) => {
        logoServer.close(error => (error ? reject(error) : resolve()));
      });
    }
  });
});
