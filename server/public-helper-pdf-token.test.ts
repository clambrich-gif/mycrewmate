import { describe, expect, it } from "vitest";
import {
  createPublicHelperPdfToken,
  PUBLIC_HELPER_PDF_LINK_TTL_MS,
  verifyPublicHelperPdfToken,
} from "./public-helper-pdf-token";

const issuedAt = Date.UTC(2026, 8, 16, 8, 0, 0);
const scope = { year: 2027, eventId: 1020001, helperId: 44 };

describe("öffentliche Helfer-PDF-Freigaben", () => {
  it("signiert einen auf Helfer und Veranstaltung begrenzten 90-Tage-Link", () => {
    const token = createPublicHelperPdfToken(scope, issuedAt);

    expect(verifyPublicHelperPdfToken(token, issuedAt + 1)).toEqual({
      version: 1,
      ...scope,
      expiresAt: issuedAt + PUBLIC_HELPER_PDF_LINK_TTL_MS,
    });
  });

  it("weist manipulierte, abgelaufene und unvollständige Tokens zurück", () => {
    const token = createPublicHelperPdfToken(scope, issuedAt);
    const [claims, signature] = token.split(".");
    const manipulated = `${claims.slice(0, -1)}A.${signature}`;

    expect(verifyPublicHelperPdfToken(manipulated, issuedAt + 1)).toBeNull();
    expect(
      verifyPublicHelperPdfToken(
        token,
        issuedAt + PUBLIC_HELPER_PDF_LINK_TTL_MS + 1
      )
    ).toBeNull();
    expect(verifyPublicHelperPdfToken("not-a-token", issuedAt)).toBeNull();
  });
});
