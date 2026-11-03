import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isPublicDemoOpenId, isPublicDemoTenantId, registerRetiredPublicDemoRoutes } from "./public-demo";
import { publicSiteMetadataFor, sitemapXml } from "./public-site-metadata";

vi.mock("./db", () => ({
  consumePlatformTenantHandoff: vi.fn(),
  isAuthorizedOAuthOwner: vi.fn(async () => false),
  getExpectedSessionVersion: vi.fn(async () => 0),
  isSessionRevoked: vi.fn(async () => false),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getTenantAdminCredentialsByUserId: vi.fn(),
}));
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { appRouter } from "./routers";
import { ADMIN_PASSWORD_OPEN_ID } from "./password-auth";

const retiredIdentity = "tenant-admin:demo-session-test123@beispiel.invalid";
const read = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("Öffentliche Vereinsdemo ist endgültig stillgelegt", () => {
  it("sperrt Seiten, Unterpfade, alte APIs und kodierte Direktaufrufe ohne SPA-Fallback", async () => {
    const app = express();
    registerRetiredPublicDemoRoutes(app);
    app.use((_req, res) => res.status(200).send("Normaler Bereich"));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      for (const route of ["/vereinsdemo", "/vereinsdemo/?package=pro", "/demozugang", "/demozugang/token", "/Vereinsdemo", "/%76ereinsdemo", "/api/public-demo/access?token=alt", "/api/public-demo/end", "/api/scheduled/public-demo-cleanup"]) {
        for (const method of ["GET", "HEAD", "POST"]) {
          const response = await fetch(base + route, { method });
          expect(response.status, `${method} ${route}`).toBe(410);
          expect(response.headers.get("x-robots-tag")).toBe("noindex,nofollow");
          expect(response.headers.get("cache-control")).toBe("no-store");
          if (method !== "HEAD") expect(await response.text()).not.toContain("<script");
        }
      }
      for (const route of ["/", "/login", "/hilfe", "/schulung", "/api/trpc/auth.me", "/api/scheduled/product-expiry-reminders"]) {
        expect((await fetch(base + route)).status).toBe(200);
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("entfernt Demoneuanlage und Seeding vollständig aus dem Router", () => {
    expect(appRouter._def.procedures).not.toHaveProperty("publicDemo.start");
    expect(read("server/routers.ts")).not.toContain("createPublicDemoSession");
    expect(read("server/public-demo.ts")).not.toContain("seedPublicDemoData");
    expect(read("server/_core/index.ts").indexOf("registerRetiredPublicDemoRoutes(app)")).toBeLessThan(read("server/_core/index.ts").indexOf('app.use(express.json'));
  });

  it("veröffentlicht keine Demo-Metadaten oder Sitemap-Einträge mehr", () => {
    const metadata = publicSiteMetadataFor("www.mycrewmate.de", "/vereinsdemo");
    expect(metadata.isMarketingPage).toBe(false);
    expect(metadata.robots).toBe("noindex,nofollow");
    expect(metadata.canonicalUrl).toBeNull();
    expect(sitemapXml()).not.toMatch(/vereinsdemo|demozugang/);
    expect(publicSiteMetadataFor("www.mycrewmate.de", "/").robots).toBe("index,follow");
  });

  it("unterscheidet ausschließlich reservierte Demoidentitäten von echten Konten", () => {
    expect(isPublicDemoOpenId(retiredIdentity)).toBe(true);
    expect(isPublicDemoTenantId("mycrewmate-demo-test123")).toBe(true);
    for (const id of [ADMIN_PASSWORD_OPEN_ID, "tenant-admin:admin@club.invalid", "planning-access:15", "oauth-owner"]) expect(isPublicDemoOpenId(id)).toBe(false);
    expect(isPublicDemoTenantId("rsc-eifel")).toBe(false);
  });

  it.each(["cookie", "bearer"])("weist gültig signierte Alt-Demos über %s vor jedem Datenbankzugriff ab", async transport => {
    const token = await sdk.createSessionToken(retiredIdentity, { name: "Demo-Planung", expiresInMs: 60000, sessionVersion: 1 });
    const request = { headers: transport === "cookie" ? { cookie: `app_session_id=${token}` } : { authorization: `Bearer ${token}` } } as Request;
    // Der zentrale Cookie-Name wird im Projekt festgelegt; Bearer und Cookie teilen dieselbe Prüfung.
    if (transport === "cookie") {
      const { COOKIE_NAME } = await import("../shared/const");
      request.headers.cookie = `${COOKIE_NAME}=${token}`;
    }
    await expect(sdk.authenticateRequest(request)).rejects.toThrow("no longer available");
    expect(db.getExpectedSessionVersion).not.toHaveBeenCalled();
    expect(db.getUserByOpenId).not.toHaveBeenCalled();
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it.each([
    ["real-club", retiredIdentity],
    ["mycrewmate-demo-old", ADMIN_PASSWORD_OPEN_ID],
    ["real-club", "unauthorized-issuer"],
  ])("lässt alten oder fremden Handoff für %s nie als Masteranmeldung durch", async (tenantId, createdByOpenId) => {
    vi.mocked(db.consumePlatformTenantHandoff).mockResolvedValue({ tenantId, createdByOpenId } as never);
    const cookie = vi.fn();
    const caller = appRouter.createCaller({ user: null, req: { headers: {}, protocol: "https" } as Request, res: { cookie } as unknown as Response });
    await expect(caller.auth.consumeHandoffToken({ token: "expired-demo-token" })).rejects.toThrow("ungültig oder abgelaufen");
    expect(cookie).not.toHaveBeenCalled();
  });

  it("erhält den normalen vom Plattformadministrator ausgestellten Einmalwechsel", async () => {
    vi.mocked(db.consumePlatformTenantHandoff).mockResolvedValue({ tenantId: "real-club", createdByOpenId: ADMIN_PASSWORD_OPEN_ID } as never);
    const cookie = vi.fn();
    const caller = appRouter.createCaller({ user: null, req: { headers: {}, protocol: "https" } as Request, res: { cookie } as unknown as Response });
    expect(await caller.auth.consumeHandoffToken({ token: "legitimate-master-token" })).toMatchObject({ success: true, tenantId: "real-club" });
    expect(cookie).toHaveBeenCalledOnce();
  });
});
