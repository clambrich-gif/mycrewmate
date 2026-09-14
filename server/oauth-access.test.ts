import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OAUTH_STATE_COOKIE, encodeOAuthState } from "../shared/const";

const dbMocks = vi.hoisted(() => ({
  refreshConfiguredOAuthOwner: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));
const sdkMocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/sdk", () => ({ sdk: sdkMocks }));

import { registerOAuthRoutes } from "./_core/oauth";

type TestServer = ReturnType<typeof createServer>;
const servers: TestServer[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    servers.splice(0).map(
      server => new Promise<void>(resolve => server.close(() => resolve()))
    )
  );
});

async function startOAuthTestServer() {
  const app = express();
  registerOAuthRoutes(app);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Testserver nicht verfügbar");
  return `http://127.0.0.1:${address.port}`;
}

function callbackUrl(baseUrl: string) {
  const state = encodeOAuthState({
    redirectUri: `${baseUrl}/`,
    nonce: "test-nonce",
  });
  return `${baseUrl}/api/oauth/callback?code=test-code&state=${encodeURIComponent(state)}`;
}

describe("OAuth-Zugangsschutz", () => {
  it("stellt für nicht zugelassene OAuth-Identitäten keine Sitzung aus", async () => {
    const baseUrl = await startOAuthTestServer();
    sdkMocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "access" });
    sdkMocks.getUserInfo.mockResolvedValue({
      openId: "unbekannte-identitaet",
      name: "Unbekannt",
      email: "unbekannt@example.test",
    });
    dbMocks.refreshConfiguredOAuthOwner.mockResolvedValue(undefined);

    const response = await fetch(callbackUrl(baseUrl), {
      redirect: "manual",
      headers: { cookie: `${OAUTH_STATE_COOKIE}=test-nonce` },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("nicht freigegeben"),
    });
    expect(dbMocks.refreshConfiguredOAuthOwner).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "unbekannte-identitaet" })
    );
    expect(sdkMocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("stellt nur nach serverseitig bestätigtem Eigentümerkonto eine Sitzung aus", async () => {
    const baseUrl = await startOAuthTestServer();
    sdkMocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "access" });
    sdkMocks.getUserInfo.mockResolvedValue({
      openId: "owner-identitaet",
      name: "Eigentümer",
      email: "owner@example.test",
    });
    dbMocks.refreshConfiguredOAuthOwner.mockResolvedValue({
      id: 1,
      openId: "owner-identitaet",
      name: "Eigentümer",
      email: "owner@example.test",
      loginMethod: "google",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    sdkMocks.createSessionToken.mockResolvedValue("owner-session");

    const response = await fetch(callbackUrl(baseUrl), {
      redirect: "manual",
      headers: { cookie: `${OAUTH_STATE_COOKIE}=test-nonce` },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).toContain("app_session_id=owner-session");
    expect(sdkMocks.createSessionToken).toHaveBeenCalledWith(
      "owner-identitaet",
      expect.any(Object)
    );
  });
});
