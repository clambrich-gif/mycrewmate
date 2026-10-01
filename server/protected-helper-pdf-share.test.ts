import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getEvent: vi.fn(),
  getHelper: vi.fn(),
  createProtectedHelperPdfShare: vi.fn(),
  findProtectedHelperPdfShare: vi.fn(),
  listActiveProtectedHelperPdfShares: vi.fn(),
  revokeProtectedHelperPdfShare: vi.fn(),
  getProtectedHelperPdfShareDelivery: vi.fn(),
  withPlanningWriteLock: vi.fn(async callback => callback()),
  recordActivityLog: vi.fn(),
}));

const pdfMocks = vi.hoisted(() => ({
  createPublicHelperTaskPdf: vi.fn(),
  renderClubPrivacyNoticeTemplatePdf: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getEvent: dbMocks.getEvent,
    getHelper: dbMocks.getHelper,
    createProtectedHelperPdfShare: dbMocks.createProtectedHelperPdfShare,
    findProtectedHelperPdfShare: dbMocks.findProtectedHelperPdfShare,
    listActiveProtectedHelperPdfShares:
      dbMocks.listActiveProtectedHelperPdfShares,
    revokeProtectedHelperPdfShare: dbMocks.revokeProtectedHelperPdfShare,
    getProtectedHelperPdfShareDelivery:
      dbMocks.getProtectedHelperPdfShareDelivery,
    withPlanningWriteLock: dbMocks.withPlanningWriteLock,
    recordActivityLog: dbMocks.recordActivityLog,
  };
});

vi.mock("./pdf", async importOriginal => {
  const actual = await importOriginal<typeof import("./pdf")>();
  return {
    ...actual,
    createPublicHelperTaskPdf: pdfMocks.createPublicHelperTaskPdf,
    renderClubPrivacyNoticeTemplatePdf:
      pdfMocks.renderClubPrivacyNoticeTemplatePdf,
  };
});

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
      loginMethod: "manus",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: { "x-event-year": "2026", "x-event-id": "1" },
    } as any,
    res: {} as any,
  };
}

describe("geschützte Helfer-PDF-Freigaben", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("erstellt eine geschützte WhatsApp-Freigabe mit Token und separatem Zugangscode", async () => {
    dbMocks.getEvent.mockResolvedValue({
      id: 1,
      year: 2026,
      name: "MyEifelRide",
      status: "active",
    });
    dbMocks.getHelper.mockResolvedValue({
      id: 12,
      eventId: 1,
      year: 2026,
      name: "Helfer Eins",
    });
    dbMocks.createProtectedHelperPdfShare.mockResolvedValue({
      token: "secret-token-1234567890123456",
      accessCode: "CODE12345678",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.pdf.createWhatsAppShare({
      helperId: 12,
      viewMode: "team",
    });

    expect(result.url).toBe(
      "https://app.mycrewmate.de/freigabe/secret-token-1234567890123456"
    );
    expect(result.accessCode).toBe("CODE12345678");
    expect(result.viewMode).toBe("team");
    expect(dbMocks.createProtectedHelperPdfShare).toHaveBeenCalledWith({
      helperId: 12,
      viewMode: "team",
    });
    expect(dbMocks.recordActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Helferfreigaben",
        action: "created",
      })
    );
  });

  it("listet aktive Freigaben, sendet bestehende Links erneut und widerruft sie sofort", async () => {
    dbMocks.getHelper.mockResolvedValue({
      id: 12,
      eventId: 1,
      year: 2026,
      name: "Helfer Eins",
    });
    dbMocks.listActiveProtectedHelperPdfShares.mockResolvedValue([
      {
        id: 7,
        viewMode: "team",
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        canResend: true,
      },
    ]);
    dbMocks.getProtectedHelperPdfShareDelivery.mockResolvedValue({
      token: "existing-token-1234567890123456",
      accessCode: "CODE12345678",
    });
    dbMocks.revokeProtectedHelperPdfShare.mockResolvedValue(true);

    const caller = appRouter.createCaller(createAuthContext());
    const list = await caller.pdf.activeWhatsAppShares({ helperId: 12 });
    expect(list).toHaveLength(1);
    expect(list[0].canResend).toBe(true);

    const resent = await caller.pdf.resendWhatsAppShare({
      helperId: 12,
      shareId: 7,
    });
    expect(resent.url).toBe(
      "https://app.mycrewmate.de/freigabe/existing-token-1234567890123456"
    );
    expect(resent.accessCode).toBe("CODE12345678");

    const revoked = await caller.pdf.revokeWhatsAppShare({
      helperId: 12,
      shareId: 7,
    });
    expect(revoked).toEqual({ success: true });
    expect(dbMocks.revokeProtectedHelperPdfShare).toHaveBeenCalledWith({
      id: 7,
      helperId: 12,
    });
  });

  it("erstellt das ausfüllbare Vereinsmuster als PDF", async () => {
    pdfMocks.renderClubPrivacyNoticeTemplatePdf.mockResolvedValue(
      Buffer.from("%PDF-1.7\nVereinsmuster")
    );
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.pdf.privacyNoticeTemplate();

    expect(result.filename).toBe(
      "Vereinsmuster_Datenschutzhinweis_Helfer_Ansprechpartner.pdf"
    );
    expect(result.mimeType).toBe("application/pdf");
    expect(pdfMocks.renderClubPrivacyNoticeTemplatePdf).toHaveBeenCalled();
  });

  it("liefert den PDF-Download nur bei passendem Token und gültigem Zugangscode", async () => {
    dbMocks.findProtectedHelperPdfShare.mockResolvedValue({
      helperId: 12,
      eventId: 1,
      year: 2026,
      tenantId: "default",
      viewMode: "team",
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    });
    pdfMocks.createPublicHelperTaskPdf.mockResolvedValue(
      Buffer.from("%PDF-1.7\nTeamansicht")
    );

    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.pdf.openWhatsAppShare({
      token: "secret-token-1234567890123456",
      accessCode: "CODE12345678",
    });

    expect(result.filename).toBe("Persoenlicher_Einsatzplan_mit_Team.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(pdfMocks.createPublicHelperTaskPdf).toHaveBeenCalledWith(12, "team");

    dbMocks.findProtectedHelperPdfShare.mockResolvedValueOnce(undefined);
    await expect(
      caller.pdf.openWhatsAppShare({
        token: "secret-token-1234567890123456",
        accessCode: "WRONGCODE123",
      })
    ).rejects.toThrow("Zugangscode ist falsch");
  });
});
