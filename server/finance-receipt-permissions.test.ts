import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./finance-documents", () => ({
  requireFinance: vi.fn(async () => ({ id: 7, category: "Breitensport" })),
  listFinanceReceipts: vi.fn(async () => []),
  listFinancePayers: vi.fn(async () => ["Muster Person"]),
  uploadFinanceReceipt: vi.fn(async () => ({ id: 42 })),
  downloadFinanceReceipt: vi.fn(async () => ({
    fileName: "beleg.pdf",
    base64: "ZmlrdGl2",
  })),
  removeFinanceReceipt: vi.fn(async () => ({ success: true })),
  exportFinanceReceipts: vi.fn(async () => ({
    fileName: "belege.zip",
    base64: "ZmlrdGl2",
  })),
}));
import { appRouter } from "./routers";
import * as db from "./db";
import * as documents from "./finance-documents";

function caller(authenticated = true, admin = false) {
  return appRouter.createCaller({
    req: { headers: { "x-event-year": "2027", "x-event-id": "1" } } as any,
    res: {} as any,
    user: authenticated
      ? {
          id: 71,
          openId: admin ? "tenant-admin:test" : "planning-team-access-71",
          name: "Test Person",
          email: "person@example.invalid",
          loginMethod: "password",
          role: admin ? "admin" : "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
  });
}

function access(finances: "off" | "read" | "write") {
  vi.spyOn(
    db,
    "getPlanningTeamAccessCredentialForCurrentTenant"
  ).mockResolvedValue({
    id: 71,
    isTenantAdmin: false,
    moduleAccess: { finances },
  } as any);
}

const receipt = {
  financeId: 7,
  title: "Pokale Vereinsmeisterschaft",
  paidBy: "Muster Person",
  fileName: "pokale.pdf",
  pdfBase64: "JVBERi0=",
};

describe("Finanzbelege: serverseitige Schreibberechtigung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(db, "getPlanningTeamAccessTenantId").mockResolvedValue(
      "fixture-verein"
    );
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(true);
    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 1,
      year: 2027,
      status: "active",
      tenantId: "fixture-verein",
    } as any);
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async operation =>
      operation()
    );
    vi.spyOn(db, "recordActivityLog").mockResolvedValue({} as any);
    vi.spyOn(db, "getCurrentTenantProductEntitlement").mockResolvedValue({
      packageId: "enterprise",
      isUsable: true,
      status: "active",
    } as any);
    vi.spyOn(db, "currentProductAllowsPlanningModule").mockResolvedValue(true);
    vi.spyOn(db, "listFinances").mockResolvedValue([
      {
        id: 7,
        category: "Breitensport",
        income: 0,
        expense: 0,
        note: "Hinweis",
        sortOrder: 0,
        year: 2027,
        eventId: 1,
      },
    ]);
    vi.spyOn(db, "appendFinanceNote").mockResolvedValue({} as any);
    vi.spyOn(db, "createFinance").mockResolvedValue({ id: 7 } as any);
  });
  afterEach(() => vi.restoreAllMocks());

  it("Lesezugriff sieht die Finanzübersicht, aber keinen einzigen Belegzugang", async () => {
    access("read");
    const api = caller().finances;
    expect(await api.list()).toHaveLength(1);
    const calls = [
      () => api.receipts({ financeId: 7 }),
      () => api.payers(),
      () => api.downloadReceipt({ id: 42 }),
      () => api.exportReceipts({}),
      () => api.uploadReceipt(receipt),
      () => api.removeReceipt({ id: 42 }),
      () => api.appendNote({ id: 7, text: "Hinweis" }),
    ];
    for (const call of calls)
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(documents.listFinanceReceipts).not.toHaveBeenCalled();
    expect(documents.listFinancePayers).not.toHaveBeenCalled();
    expect(documents.downloadFinanceReceipt).not.toHaveBeenCalled();
    expect(documents.exportFinanceReceipts).not.toHaveBeenCalled();
    expect(documents.uploadFinanceReceipt).not.toHaveBeenCalled();
    expect(documents.removeFinanceReceipt).not.toHaveBeenCalled();
    expect(db.appendFinanceNote).not.toHaveBeenCalled();
  });

  it("ohne Anmeldung oder mit ausgeschaltetem Finanzbereich sind Belege gesperrt", async () => {
    access("off");
    await expect(
      caller().finances.receipts({ financeId: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(false).finances.downloadReceipt({ id: 42 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(documents.downloadFinanceReceipt).not.toHaveBeenCalled();
  });

  it("Schreibzugriff darf Belege mehrmals je Kategorie anlegen, lesen, sichern und löschen", async () => {
    access("write");
    const api = caller().finances;
    expect(await api.payers()).toEqual(["Muster Person"]);
    await api.receipts({ financeId: 7 });
    await api.uploadReceipt(receipt);
    await api.uploadReceipt({
      ...receipt,
      title: "Weitere Pokale",
      fileName: "weitere.pdf",
    });
    await api.downloadReceipt({ id: 42 });
    await api.exportReceipts({ financeId: 7 });
    await api.removeReceipt({ id: 42 });
    expect(documents.uploadFinanceReceipt).toHaveBeenCalledTimes(2);
    expect(documents.downloadFinanceReceipt).toHaveBeenCalledWith(42);
    expect(documents.exportFinanceReceipts).toHaveBeenCalledWith(7);
  });

  it("Notiz ergänzt Zeit und den serverseitigen Autor, nicht einen Client-Autor", async () => {
    access("write");
    await caller().finances.appendNote({ id: 7, text: "  Privat bezahlt  " });
    expect(documents.requireFinance).toHaveBeenCalledWith(7);
    expect(db.appendFinanceNote).toHaveBeenCalledWith(
      7,
      "Privat bezahlt",
      "Test Person"
    );
    await caller().finances.create({
      category: "  Breitensport  ",
      note: "Privat bezahlt",
    });
    expect(db.createFinance).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Breitensport",
        note: expect.stringMatching(
          /\d{2}\.\d{2}\.\d{4}.*\(Test Person\): Privat bezahlt/
        ),
      })
    );
  });

  it("Beleg-Upload nimmt keine Beträge in die Finanzsummen auf", async () => {
    access("write");
    const update = vi.spyOn(db, "updateFinance").mockResolvedValue({} as any);
    await caller().finances.uploadReceipt(receipt);
    expect(db.createFinance).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("validiert Eingabefelder und erlaubt keine negativen/nebenkommigen Geldwerte", async () => {
    access("write");
    await expect(
      caller().finances.uploadReceipt({ ...receipt, paidBy: "  " })
    ).rejects.toThrow();
    await expect(
      caller().finances.uploadReceipt({ ...receipt, title: "" })
    ).rejects.toThrow();
    await expect(caller().finances.create({ category: "" })).rejects.toThrow();
    await expect(
      caller().finances.create({ category: "Catering", incomeCents: -1 })
    ).rejects.toThrow();
    await expect(
      caller().finances.create({ category: "Catering", expenseCents: 1.5 })
    ).rejects.toThrow();
  });
});
