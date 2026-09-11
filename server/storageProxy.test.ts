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
      `${baseUrl}/manus-storage/RSC-Helferplanung-Anleitung_211fadc0.pdf`,
      { redirect: "manual" }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
});
