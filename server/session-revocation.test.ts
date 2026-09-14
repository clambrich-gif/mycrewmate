import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import {
  ADMIN_PASSWORD_OPEN_ID,
  SHARED_PASSWORD_OPEN_ID,
} from "./password-auth";

function createMockRequest(cookieToken?: string): Request {
  return {
    protocol: "https",
    headers: {
      cookie: cookieToken ? `app_session_id=${cookieToken}` : undefined,
    },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;
}

describe("Serverseitiger JWT-Sitzungswiderruf", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("akzeptiert eine gültige Sitzung mit passender Versionsnummer", async () => {
    vi.spyOn(db, "getExpectedSessionVersion").mockResolvedValue(1);
    vi.spyOn(db, "isSessionRevoked").mockResolvedValue(false);
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue({
      id: 2,
      openId: SHARED_PASSWORD_OPEN_ID,
      name: "Planungsteam",
      email: null,
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);

    const token = await sdk.createSessionToken(SHARED_PASSWORD_OPEN_ID, {
      name: "Planungsteam",
      sessionVersion: 1,
    });
    const req = createMockRequest(token);

    const authenticated = await sdk.authenticateRequest(req);
    expect(authenticated.openId).toBe(SHARED_PASSWORD_OPEN_ID);
    expect(authenticated.role).toBe("user");
  });

  it("weist eine serverseitig widerrufene Sitzung (z. B. nach Logout) sofort ab", async () => {
    vi.spyOn(db, "getExpectedSessionVersion").mockResolvedValue(1);
    vi.spyOn(db, "isSessionRevoked").mockResolvedValue(true);

    const token = await sdk.createSessionToken(SHARED_PASSWORD_OPEN_ID, {
      name: "Planungsteam",
      sessionVersion: 1,
    });
    const req = createMockRequest(token);

    await expect(sdk.authenticateRequest(req)).rejects.toMatchObject({
      message: expect.stringContaining("Session has been revoked"),
    });
  });

  it("erkennt veraltete Sitzungsversionen nach einem Passwortwechsel und lehnt sie ab", async () => {
    // Token wurde mit Version 1 ausgestellt; Sicherheits-Einstellung verlangt Version 2
    vi.spyOn(db, "getExpectedSessionVersion").mockResolvedValue(2);
    vi.spyOn(db, "isSessionRevoked").mockResolvedValue(false);

    const oldToken = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
      name: "Administrator",
      sessionVersion: 1,
    });
    const req = createMockRequest(oldToken);

    await expect(sdk.authenticateRequest(req)).rejects.toMatchObject({
      message: expect.stringContaining("Session expired due to security update"),
    });
  });

  it("stuft Legacy-Tokens ohne Versionsangabe als Version 0 ein und lehnt sie ab", async () => {
    vi.spyOn(db, "getExpectedSessionVersion").mockResolvedValue(1);
    vi.spyOn(db, "isSessionRevoked").mockResolvedValue(false);

    const legacyToken = await sdk.signSession({
      openId: SHARED_PASSWORD_OPEN_ID,
      appId: "myeifelride",
      name: "Planungsteam",
    });
    const req = createMockRequest(legacyToken);

    await expect(sdk.authenticateRequest(req)).rejects.toMatchObject({
      message: expect.stringContaining("Session expired due to security update"),
    });
  });
});
