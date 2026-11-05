import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `/uploads/${key}` })),
  storageRead: vi.fn(async () => Buffer.from("%PDF-1.7\nfixture\n%%EOF")),
  storageDelete: vi.fn(async () => true),
}));
import * as db from "./db";
import { storagePut, storageRead, storageDelete } from "./storage";
import { withPlanningScope } from "./year-context";
import {
  validateFinancePdf,
  MAX_FINANCE_PDF_BYTES,
  listFinanceReceipts,
  listFinancePayers,
  uploadFinanceReceipt,
  downloadFinanceReceipt,
  removeFinanceReceipt,
  exportFinanceReceipts,
} from "./finance-documents";

const scope = { tenantId: "fixture-verein", year: 2027, eventId: 81 };
const inScope = <T>(fn: () => T) => withPlanningScope(scope, fn);
const pdfBase64 = Buffer.from("%PDF-1.7\nfixture\n%%EOF").toString("base64");
const finance = {
  id: 7,
  eventId: 81,
  year: 2027,
  category: "Breitensport",
  income: 7000,
  expense: 4500,
  note: "Vorhandene Notiz",
};
const receipt = {
  id: 42,
  eventId: 81,
  year: 2027,
  category: "Breitensport",
  title: "Pokale",
  paidBy: "Muster Person",
  fileName: "pokale.pdf",
  byteSize: 24,
  storageKey: "finance-receipts/fixture-verein/2027/81/private.pdf",
  createdAt: new Date("2026-11-05T10:00:00Z"),
};
const filters: { table: string; query: string; params: unknown[] }[] = [];
const mutations: { kind: string; table: string; values?: unknown }[] = [];
let results: Record<string, any[][]>;
let insertFails = false;
function fakeDatabase() {
  const dialect = new MySqlDialect();
  const fake: any = {
    select: () => {
      let table = "";
      const query: any = {
        from(value: any) {
          table = getTableName(value);
          return query;
        },
        where(condition: any) {
          const compiled = dialect.sqlToQuery(condition);
          filters.push({ table, query: compiled.sql, params: compiled.params });
          return query;
        },
        limit() {
          return query;
        },
        orderBy() {
          return query;
        },
        for() {
          return query;
        },
        getSQL: () => sql`select category from finances`,
        then(resolve: any, reject: any) {
          return Promise.resolve(results[table]?.shift() ?? []).then(
            resolve,
            reject
          );
        },
      };
      return query;
    },
    insert: (table: any) => ({
      values: async (values: any) => {
        mutations.push({ kind: "insert", table: getTableName(table), values });
        if (insertFails) throw new Error("Insert failed");
        return [{ insertId: 42 }];
      },
    }),
    delete: (table: any) => ({
      where: async (condition: any) => {
        const compiled = dialect.sqlToQuery(condition);
        filters.push({
          table: getTableName(table),
          query: compiled.sql,
          params: compiled.params,
        });
        mutations.push({ kind: "delete", table: getTableName(table) });
        return [{ affectedRows: 1 }];
      },
    }),
    transaction: async (operation: (tx: any) => any) => operation(fake),
  };
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  filters.length = 0;
  mutations.length = 0;
  insertFails = false;
  results = {
    events: [[{ id: 81 }]],
    finances: [[finance]],
    financeReceipts: [[receipt]],
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDatabase());
});
afterEach(() => vi.restoreAllMocks());

describe("PDF-Prüfung ohne Speicherzugriff", () => {
  it("erkennt eine vollständige PDF und bereinigt Pfad-/Steuerzeichen im Dateinamen", () => {
    const valid = validateFinancePdf("../pokale\n.pdf", pdfBase64);
    expect(valid.bytes.toString()).toContain("%PDF-1.7");
    expect(valid.fileName).not.toMatch(/[/\\\n]/);
  });
  it("weist Nicht-PDF, abgeschnittene und zu große PDFs zurück", () => {
    expect(() => validateFinancePdf("datei.txt", pdfBase64)).toThrow();
    expect(() =>
      validateFinancePdf(
        "datei.pdf",
        Buffer.from("Kein PDF").toString("base64")
      )
    ).toThrow();
    expect(() =>
      validateFinancePdf(
        "datei.pdf",
        Buffer.from("%PDF-1.7 ohne Ende").toString("base64")
      )
    ).toThrow();
    expect(() =>
      validateFinancePdf(
        "datei.pdf",
        Buffer.alloc(MAX_FINANCE_PDF_BYTES + 1).toString("base64")
      )
    ).toThrow("höchstens 5 MB");
    expect(() =>
      validateFinancePdf(
        "datei.pdf",
        "data:application/pdf;base64," + pdfBase64
      )
    ).toThrow();
  });
  it.each(["JavaScript", "Launch", "EmbeddedFile", "Encrypt", "XFA"])(
    "weist aktive/verschlüsselte PDF-Inhalte %s zurück",
    action => {
      expect(() =>
        validateFinancePdf(
          "datei.pdf",
          Buffer.from(`%PDF-1.7\n/${action}\n%%EOF`).toString("base64")
        )
      ).toThrow();
    }
  );
});

describe("Geschützte Finanzbelege", () => {
  it("liefert Metadaten ohne Speicher-Key/öffentliche URL und begrenzt Kategorie, Jahr, Event und Verein", async () => {
    const rows = await inScope(() => listFinanceReceipts(7));
    expect(rows).toEqual([
      expect.objectContaining({
        id: 42,
        title: "Pokale",
        paidBy: "Muster Person",
      }),
    ]);
    expect(rows[0]).not.toHaveProperty("storageKey");
    expect(rows[0]).not.toHaveProperty("url");
    expect(filters.find(row => row.table === "events")?.params).toEqual([
      81,
      2027,
      "fixture-verein",
    ]);
    expect(filters.find(row => row.table === "finances")?.params).toEqual([
      81, 2027, 7,
    ]);
    expect(
      filters.find(row => row.table === "financeReceipts")?.params
    ).toEqual([81, 2027, "Breitensport"]);
  });
  it("kann einen fremden Verein/eine fremde Kategorie nicht mit einer geratenen ID umgehen", async () => {
    results.events = [[]];
    await expect(
      inScope(() => downloadFinanceReceipt(42))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageRead).not.toHaveBeenCalled();
    results.events = [[{ id: 81 }]];
    results.finances = [[]];
    await expect(inScope(() => listFinanceReceipts(999))).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
  });
  it("Download prüft Event/Jahr/Existenz der Kategorie erneut und liest nur intern", async () => {
    const file = await inScope(() => downloadFinanceReceipt(42));
    expect(file.fileName).toBe("pokale.pdf");
    expect(Buffer.from(file.base64, "base64").toString()).toContain("%PDF-1.7");
    expect(storageRead).toHaveBeenCalledWith(receipt.storageKey);
    const filter = filters.find(row => row.table === "financeReceipts")!;
    expect(filter.params).toEqual([81, 2027, 42]);
    expect(filter.query).toContain(" in ");
  });
  it("ablehnender Scoped-Download liest keine Datei", async () => {
    results.financeReceipts = [[]];
    await expect(
      inScope(() => downloadFinanceReceipt(42))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageRead).not.toHaveBeenCalled();
  });
  it("speichert exakt einen Beleg, unveränderte Finanzsummen und den Namen der zahlenden Person", async () => {
    results.finances = [[finance], [finance]];
    results.financeReceipts = [[]];
    await inScope(() =>
      uploadFinanceReceipt({
        financeId: 7,
        title: "Pokale",
        paidBy: "Muster Person",
        fileName: "pokale.pdf",
        pdfBase64,
      })
    );
    expect(mutations).toEqual([
      {
        kind: "insert",
        table: "financeReceipts",
        values: expect.objectContaining({
          eventId: 81,
          year: 2027,
          category: "Breitensport",
          title: "Pokale",
          paidBy: "Muster Person",
          byteSize: Buffer.from(pdfBase64, "base64").length,
        }),
      },
    ]);
    expect(storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^finance-receipts\/fixture-verein\/2027\/81\//),
      expect.any(Buffer),
      "application/pdf"
    );
    expect(finance.income).toBe(7000);
    expect(finance.expense).toBe(4500);
  });
  it("räumt die private Datei auf, wenn die Kategorie während des Uploads gelöscht wurde", async () => {
    results.finances = [[finance], []];
    await expect(
      inScope(() =>
        uploadFinanceReceipt({
          financeId: 7,
          title: "Pokale",
          paidBy: "Muster Person",
          fileName: "pokale.pdf",
          pdfBase64,
        })
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageDelete).toHaveBeenCalledOnce();
    expect(mutations).toEqual([]);
  });
  it("räumt auch bei einem gescheiterten Metadateninsert die Datei auf", async () => {
    results.finances = [[finance], [finance]];
    results.financeReceipts = [[]];
    insertFails = true;
    await expect(
      inScope(() =>
        uploadFinanceReceipt({
          financeId: 7,
          title: "Pokale",
          paidBy: "Muster Person",
          fileName: "pokale.pdf",
          pdfBase64,
        })
      )
    ).rejects.toThrow("Insert failed");
    expect(storageDelete).toHaveBeenCalledOnce();
  });
  it("entdoppelt Personennamen aus Helfern und Ansprechpartnern ohne Unternehmen", async () => {
    results.contacts = [[{ name: "Muster Person" }]];
    results.helpers = [[{ name: "Muster Person" }, { name: "Andere Person" }]];
    expect(await inScope(() => listFinancePayers())).toEqual([
      "Andere Person",
      "Muster Person",
    ]);
    expect(
      filters
        .filter(row => ["contacts", "helpers"].includes(row.table))
        .every(row => JSON.stringify(row.params) === "[81,2027]")
    ).toBe(true);
  });
  it("löscht nur den ausgewählten Event-Beleg und seinen privaten Speicherinhalt", async () => {
    await inScope(() => removeFinanceReceipt(42));
    expect(mutations).toEqual([{ kind: "delete", table: "financeReceipts" }]);
    expect(storageDelete).toHaveBeenCalledWith(receipt.storageKey);
  });
  it("ZIP enthält Original-PDF und Manifest, jedoch weder Speicher-Keys noch öffentliche URL", async () => {
    const archive = await inScope(() => exportFinanceReceipts());
    const zip = Buffer.from(archive.base64, "base64");
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    expect(zip.includes(Buffer.from("PDF/42-pokale.pdf"))).toBe(true);
    expect(zip.includes(Buffer.from("Finanzbelege.json"))).toBe(true);
    expect(zip.includes(Buffer.from("Hinweis.txt"))).toBe(true);
    expect(storageRead).toHaveBeenCalledWith(receipt.storageKey);
    expect(archive).not.toHaveProperty("url");
  });
  it("ZIP bricht bei fehlender Datei ab und meldet keinen erfolgreichen Teil-Download", async () => {
    vi.mocked(storageRead).mockRejectedValueOnce(new Error("ENOENT"));
    await expect(inScope(() => exportFinanceReceipts())).rejects.toThrow(
      "nicht vollständig"
    );
  });
});
