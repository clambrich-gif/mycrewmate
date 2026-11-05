import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  canRead: true,
  canWrite: false,
  receiptsQuery: vi.fn(),
  payersQuery: vi.fn(),
  mutate: vi.fn(),
  rows: [
    {
      id: 42,
      category: "Testkategorie",
      income: 4500,
      expense: 1200,
      note: "05.11.2026 14:30 Uhr (Testperson): Synthetische Testnotiz",
    },
  ],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ loading: false }),
}));
vi.mock("@/contexts/YearContext", () => ({
  useEventYear: () => ({ year: 2026, eventId: 10 }),
}));
vi.mock("@/hooks/useTenantAdministration", () => ({
  useTenantAdministration: () => ({
    isTenantAdmin: false,
    canReadModule: () => state.canRead,
    canWriteModule: () => state.canWrite,
    moduleAccess: { isLoading: false },
    administrativeContext: { isLoading: false },
  }),
}));
vi.mock("@/components/KlemmiSurfaceGuide", () => ({
  KlemmiSurfaceGuide: () => null,
}));
vi.mock("@/components/ResetAreaButton", () => ({
  ResetAreaButton: () => null,
}));
vi.mock("@/components/ui/dialog", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/components/ui/dialog")>();
  const { createElement } = await import("react");
  const wrapper = ({ children }: { children?: ReactNode }) =>
    createElement("section", null, children);
  return {
    ...actual,
    ...Object.fromEntries(
      [
        "Dialog",
        "DialogContent",
        "DialogDescription",
        "DialogFooter",
        "DialogHeader",
        "DialogTitle",
      ].map(name => [name, wrapper])
    ),
  };
});
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutateAsync: state.mutate }) };
  return {
    trpc: {
      useUtils: () => ({
        finances: {
          list: { invalidate: vi.fn() },
          receipts: { invalidate: vi.fn() },
        },
        dashboard: { invalidate: vi.fn() },
      }),
      finances: {
        list: {
          useQuery: () => ({
            data: state.rows,
            isLoading: false,
            isFetching: false,
            error: null,
          }),
        },
        create: mutation,
        update: mutation,
        remove: mutation,
        appendNote: mutation,
        uploadReceipt: mutation,
        downloadReceipt: mutation,
        removeReceipt: mutation,
        exportReceipts: mutation,
        receipts: {
          useQuery: (input: unknown, options: { enabled: boolean }) => {
            state.receiptsQuery(input, options);
            return {
              data: [],
              isLoading: false,
              error: null,
              isFetching: false,
            };
          },
        },
        payers: {
          useQuery: (input: unknown, options: { enabled: boolean }) => {
            state.payersQuery(input, options);
            return {
              data: ["Testperson aus Kontakt", "Testperson aus Helfer"],
              isLoading: false,
              error: null,
            };
          },
        },
      },
    },
  };
});

import Finances from "../client/src/pages/Finances";
import {
  FinanceCategoryDialog,
  financeInputCents,
} from "../client/src/components/FinanceCategoryDialog";
import { FinanceNotebookDialog } from "../client/src/components/FinanceNotebookDialog";
import {
  FinanceReceiptsDialog,
  FINANCE_RECEIPT_BACKUP_HINT,
  MAX_FINANCE_PDF_BYTES,
  financePdfSelectionError,
  downloadFinanceFile,
} from "../client/src/components/FinanceReceiptsDialog";

beforeEach(() => {
  vi.clearAllMocks();
  state.canRead = true;
  state.canWrite = false;
  // Supports both classic and automatic JSX transforms in this node-only test.
  vi.stubGlobal("React", React);
});

const componentSource = (name: string) =>
  readFileSync(
    new URL(`../client/src/components/${name}.tsx`, import.meta.url),
    "utf8"
  );
const pageSource = () =>
  readFileSync(
    new URL("../client/src/pages/Finances.tsx", import.meta.url),
    "utf8"
  );

describe("finance documents UI (synthetic fixtures only)", () => {
  it("read-only finance users see values and notebooks, but no receipt controls or metadata queries", () => {
    const html = renderToStaticMarkup(createElement(Finances));
    expect(html).toContain("Testkategorie");
    expect(html).toContain("Notizbuch");
    expect(html).toContain("33,00");
    for (const text of [
      "Belege",
      "ZIP",
      "Bearbeiten",
      "Neue Kategorie",
      "Löschen",
    ])
      expect(html).not.toContain(text);
    expect(state.receiptsQuery).not.toHaveBeenCalled();
    expect(state.payersQuery).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("finance writers get neutral dialog actions and an explicit separate ZIP backup", () => {
    state.canWrite = true;
    const html = renderToStaticMarkup(createElement(Finances));
    for (const text of [
      "Neue Kategorie",
      "Bearbeiten",
      "Notizbuch",
      "Belege",
      "Belege sichern (ZIP)",
      "keine PDF-Dateien",
      "keine Datei für den normalen JSON-Import",
    ])
      expect(html).toContain(text);
    // Opening the overview alone does not fetch receipt existence/metadata.
    expect(state.receiptsQuery).not.toHaveBeenCalled();
    expect(state.payersQuery).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("shows existing timestamp/author notebook history without an append form for read-only users", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceNotebookDialog, {
        row: state.rows[0],
        canWrite: false,
        onClose: vi.fn(),
      })
    );
    expect(html).toContain("Synthetische Testnotiz");
    expect(html).toContain("05.11.2026");
    expect(html).toContain("14:30");
    expect(html).toContain("von Testperson");
    expect(html).not.toContain("textarea");
    expect(html).not.toContain("Eintrag speichern");
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("creation includes the optional first note; editing never replaces the notebook", () => {
    const createHtml = renderToStaticMarkup(
      createElement(FinanceCategoryDialog, {
        row: null,
        canWrite: true,
        onClose: vi.fn(),
      })
    );
    const editHtml = renderToStaticMarkup(
      createElement(FinanceCategoryDialog, {
        row: state.rows[0],
        canWrite: true,
        onClose: vi.fn(),
      })
    );
    expect(createHtml).toContain("Erste Notiz (optional)");
    expect(createHtml).toContain("Einnahmen (€)");
    expect(createHtml).toContain("Ausgaben (€)");
    expect(editHtml).not.toContain("textarea");
    expect(editHtml).toContain("Bestehende Einträge bleiben erhalten");
    expect(componentSource("FinanceCategoryDialog")).toContain(
      "await update.mutateAsync({ id: row.id, ...values })"
    );
  });

  it("receipt form asks only title, person and one PDF, not monetary/invoice fields", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceReceiptsDialog, {
        row: state.rows[0],
        canWrite: true,
        onClose: vi.fn(),
      })
    );
    for (const text of [
      "Bezeichnung",
      "Bezahlt von",
      "Testperson aus Kontakt",
      "Testperson aus Helfer",
      "externe Person",
      "PDF-Datei (max. 5 MiB)",
    ])
      expect(html).toContain(text);
    expect(html).toContain('accept=".pdf,application/pdf"');
    expect(html).not.toContain("multiple");
    for (const text of [
      "Rechnungsdatum",
      "Lieferant",
      "Betrag",
      'type="number"',
      "Rechnungsnummer",
    ])
      expect(html).not.toContain(text);
    expect(state.receiptsQuery).toHaveBeenCalledWith(
      { financeId: 42 },
      { enabled: true, retry: false }
    );
    expect(state.payersQuery).toHaveBeenCalledWith(undefined, {
      enabled: true,
      retry: false,
    });
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("receipt component itself refuses read-only rendering and gates every query", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceReceiptsDialog, {
        row: state.rows[0],
        canWrite: false,
        onClose: vi.fn(),
      })
    );
    expect(html).toBe("");
    expect(state.receiptsQuery).toHaveBeenCalledWith(
      { financeId: 42 },
      { enabled: false, retry: false }
    );
    expect(state.payersQuery).toHaveBeenCalledWith(undefined, {
      enabled: false,
      retry: false,
    });
  });

  it("requires a nonempty PDF up to exactly 5 MiB", () => {
    const pdf = {
      name: "test.pdf",
      type: "application/pdf",
      size: MAX_FINANCE_PDF_BYTES,
    };
    expect(financePdfSelectionError(pdf)).toBeNull();
    expect(financePdfSelectionError({ ...pdf, size: pdf.size + 1 })).toContain(
      "5 MiB"
    );
    expect(financePdfSelectionError({ ...pdf, size: 0 })).toContain("leer");
    expect(
      financePdfSelectionError({ ...pdf, name: "test.png", type: "image/png" })
    ).toContain("PDF");
    expect(financePdfSelectionError({ ...pdf, type: "" })).toBeNull();
    expect(
      financePdfSelectionError({ ...pdf, name: `${"x".repeat(200)}.pdf` })
    ).toContain("200");
  });

  it("converts decimal euros without truncation, NaN or unsafe amounts", () => {
    expect(financeInputCents("12,50")).toBe(1250);
    expect(financeInputCents("12.50")).toBe(1250);
    expect(financeInputCents("0,29")).toBe(29);
    expect(financeInputCents("")).toBe(0);
    for (const invalid of [
      "-1",
      "NaN",
      "Infinity",
      "1,234",
      "1e5",
      "100000000000",
    ])
      expect(financeInputCents(invalid)).toBeNull();
  });

  it("downloads a real local Blob and releases its object URL without opening a tab", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { href: "", download: "", click, remove };
    const createObjectURL = vi.fn(() => "blob:synthetic-test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("window", { setTimeout });
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { appendChild: vi.fn() },
    });
    try {
      downloadFinanceFile(
        { fileName: "test.pdf", base64: btoa("%PDF-1.4 synthetic fixture") },
        "application/pdf"
      );
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(anchor.download).toBe("test.pdf");
      expect(click).toHaveBeenCalledOnce();
      expect(remove).toHaveBeenCalledOnce();
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-test");
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("protects duplicate requests, appends notes, and never changes financial amounts via receipts", () => {
    const receipts = componentSource("FinanceReceiptsDialog");
    const notebook = componentSource("FinanceNotebookDialog");
    expect(receipts).toContain("requestInFlight.current");
    expect(receipts).toContain('header !== "%PDF-"');
    expect(receipts).not.toMatch(/finances\.(?:create|update)\./);
    expect(notebook).toContain("finances.appendNote.useMutation");
    expect(notebook).toContain("utils.finances.list.invalidate()");
    expect(pageSource()).toContain('canWriteModule("finances")');
    expect(pageSource()).toContain('audioGuideId="finances-dialog-text"');
    expect(pageSource()).toContain("voiceMuted");
    expect(FINANCE_RECEIPT_BACKUP_HINT).toContain("keine PDF-Dateien");
    expect(FINANCE_RECEIPT_BACKUP_HINT).toContain(
      "keine Datei für den normalen JSON-Import"
    );
  });
});
