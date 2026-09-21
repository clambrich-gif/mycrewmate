import { describe, expect, it, vi } from "vitest";
import express from "express";
import { registerTenantLogoRoutes } from "./tenant-logo-routes";

describe("Geschützte Vereinslogo-Auslieferung", () => {
  it("liefert das konfigurierte Vereinslogo mit Same-Origin-Headern aus dem lokalen Volume aus", async () => {
    const app = express();
    const fakePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1]);
    const readFile = vi.fn().mockResolvedValue(fakePng);

    registerTenantLogoRoutes(app, {
      authenticateRequest: vi.fn().mockResolvedValue({ id: 1, role: "admin" }),
      getTenantLogoKey: vi.fn().mockResolvedValue("tenant-logos/ui/tenant-logo.png"),
      readFile,
    });

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/tenant-logo`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.equals(fakePng)).toBe(true);
      expect(readFile).toHaveBeenCalledWith("tenant-logos/ui/tenant-logo.png");
    } finally {
      server.close();
    }
  });

  it("gibt 404 zurück, wenn noch kein Vereinslogo hochgeladen wurde", async () => {
    const app = express();
    registerTenantLogoRoutes(app, {
      authenticateRequest: vi.fn().mockResolvedValue({ id: 2, role: "user" }),
      getTenantLogoKey: vi.fn().mockResolvedValue(null),
      readFile: vi.fn(),
    });

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/tenant-logo`);
      expect(response.status).toBe(404);
    } finally {
      server.close();
    }
  });
});
