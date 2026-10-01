import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerLocalStorageRoutes } from "./storage";

const servers: Server[] = [];

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

describe("Geschlossener lokaler Uploadspeicher", () => {
  it("liefert keinen Dateischlüssel über die generische Uploadroute aus", async () => {
    const app = express();
    registerLocalStorageRoutes(app);
    const server = await new Promise<Server>(resolve => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Testserver konnte nicht starten");

    const response = await fetch(
      `http://127.0.0.1:${address.port}/uploads/gpx-tracks/events/2027/77/geheime-route.gpx`
    );
    expect(response.status).toBe(404);
  });
});
