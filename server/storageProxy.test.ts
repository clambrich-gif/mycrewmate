import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
});
