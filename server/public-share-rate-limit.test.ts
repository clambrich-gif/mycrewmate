import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  assertProtectedPdfShareAttemptAllowed,
  clearProtectedPdfShareFailures,
  recordProtectedPdfShareFailure,
  PROTECTED_PDF_SHARE_MAX_ATTEMPTS,
} from "./public-share-rate-limit";

function mockRequest(ip: string): Request {
  return { ip, socket: { remoteAddress: ip } } as unknown as Request;
}

describe("Rate-Limit für geschützte PDF-Codeabfragen", () => {
  it("lässt bis zu fünf Fehlversuche zu und blockiert anschließend", () => {
    const ip = "192.0.2.77";
    const req = mockRequest(ip);
    clearProtectedPdfShareFailures(ip);

    for (let i = 0; i < PROTECTED_PDF_SHARE_MAX_ATTEMPTS; i++) {
      expect(assertProtectedPdfShareAttemptAllowed(req)).toBe(ip);
      recordProtectedPdfShareFailure(ip);
    }

    expect(() => assertProtectedPdfShareAttemptAllowed(req)).toThrowError(
      /Zu viele Versuche/
    );

    clearProtectedPdfShareFailures(ip);
    expect(assertProtectedPdfShareAttemptAllowed(req)).toBe(ip);
  });
});
