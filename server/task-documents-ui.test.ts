import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  canWrite: false,
  listError: null as { message: string } | null,
  payerError: null as { message: string } | null,
  listQuery: vi.fn(),
  countsQuery: vi.fn(),
  counts: [{ taskId: 41, count: 3 }],
  payerQuery: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  removeMutation: null as
    | ((input: { area: "prep" | "post"; id: number }) => Promise<unknown>)
    | null,
  invalidate: vi.fn(),
  invalidateCounts: vi.fn(),
  buttons: new Map<string, () => void>(),
  data: {
    files: [] as any[],
    canUploadDocuments: false,
    canUploadReceipts: true as const,
    receiptIdentityNotice: null as string | null,
  },
  payers: [
    { key: "contact:7", name: "Testperson" },
    { key: "helper:8", name: "Testperson" },
  ],
}));

vi.mock("@/components/ui/button", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/components/ui/button")>();
  const { createElement } = await import("react");
  return {
    ...actual,
    Button: (props: React.ComponentProps<typeof actual.Button>) => {
      if (props["aria-label"] && props.onClick)
        state.buttons.set(props["aria-label"], () => props.onClick!({} as any));
      return createElement(actual.Button, props);
    },
  };
});
vi.mock("@/components/ui/dialog", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/components/ui/dialog")>();
  const { createElement } = await import("react");
  const wrapper = ({ children }: { children?: ReactNode }) =>
    createElement("section", null, children);
  return {
    ...actual,
    Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) =>
      open ? wrapper({ children }) : null,
    ...Object.fromEntries(
      [
        "DialogContent",
        "DialogDescription",
        "DialogFooter",
        "DialogHeader",
        "DialogTitle",
      ].map(name => [name, wrapper])
    ),
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Testleser", role: "user" },
    loading: false,
  }),
}));
vi.mock("@/hooks/useTenantAdministration", () => ({
  useTenantAdministration: () => ({
    isTenantAdmin: false,
    canWriteModule: () => state.canWrite,
  }),
}));
vi.mock("@/hooks/useMyTasksDefault", () => ({
  useMyTasksDefault: () => ({
    isDefaultMyTasks: false,
    canRememberMyTasksDefault: false,
    setDefaultMyTasks: vi.fn(),
  }),
}));
vi.mock("@/hooks/useViewMode", () => ({
  useViewMode: () => ["liste", vi.fn()],
}));
vi.mock("wouter", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock("@/components/KlemmiSurfaceGuide", () => ({
  KlemmiSurfaceGuide: () => null,
}));
vi.mock("@/components/PlanResetDialogButton", () => ({
  PlanResetDialogButton: () => null,
}));
vi.mock("@/components/ConfirmDeleteDialog", () => ({
  ConfirmDeleteDialog: () => null,
}));
vi.mock("@/lib/trpc", () => {
  const task = {
    id: 41,
    year: 2026,
    eventId: 1,
    category: "Testbereich",
    task: "Synthetische Aufgabe",
    dueText: "",
    locationId: null,
    contactId: 7,
    helperId: null,
    helperIds: [],
    eventPassResponsibleHelperId: null,
    status: "offen",
    statusWording: "aufgabe",
    note: null,
    sortOrder: 0,
  };
  const mutation = {
    useMutation: () => ({
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    }),
  };
  const module = {
    list: { useQuery: () => ({ data: [task], isLoading: false }) },
    create: mutation,
    update: mutation,
    remove: mutation,
  };
  return {
    trpc: {
      useUtils: () => ({
        taskDocuments: {
          list: { invalidate: state.invalidate },
          counts: { invalidate: state.invalidateCounts },
          download: { fetch: state.download },
        },
        prep: { list: { invalidate: vi.fn() } },
        post: { list: { invalidate: vi.fn() } },
        dashboard: { invalidate: vi.fn() },
      }),
      taskDocuments: {
        list: {
          useQuery: (input: unknown, options: unknown) => {
            state.listQuery(input, options);
            return {
              data: state.data,
              error: state.listError,
              isLoading: false,
              isFetching: false,
              refetch: vi.fn(),
            };
          },
        },
        counts: {
          useQuery: (input: unknown) => {
            state.countsQuery(input);
            return { data: state.counts };
          },
        },
        payers: {
          useQuery: (input: unknown, options: unknown) => {
            state.payerQuery(input, options);
            return {
              data: state.payers,
              error: state.payerError,
              isLoading: false,
              isFetching: false,
              refetch: vi.fn(),
            };
          },
        },
        upload: { useMutation: () => ({ mutateAsync: state.upload }) },
        remove: {
          useMutation: (options?: { onSuccess?: () => void }) => {
            const mutateAsync = async (input: {
              area: "prep" | "post";
              id: number;
            }) => {
              const result = await state.remove(input);
              options?.onSuccess?.();
              return result;
            };
            state.removeMutation = mutateAsync;
            return { mutateAsync };
          },
        },
      },
      prep: module,
      post: module,
      tenantProduct: {
        current: { useQuery: () => ({ data: { packageId: "event_pass" } }) },
      },
      contacts: { list: { useQuery: () => ({ data: [] }) } },
      helpers: { list: { useQuery: () => ({ data: [] }) } },
      locations: { list: { useQuery: () => ({ data: [] }) } },
      pdf: { prepTaskOverview: mutation, postTaskOverview: mutation },
    },
  };
});

import Preparation from "../client/src/pages/Preparation";
import PostProcessing from "../client/src/pages/PostProcessing";
import {
  TaskDocumentsDialog,
  TaskDocumentsButton,
  createTaskDocumentDraftQueue,
  createTaskDocumentFileViewer,
  taskDocumentSelectionError,
  taskDocumentFormError,
  taskDocumentBase64,
  taskDocumentCanPreview,
  taskDocumentPayerLabel,
  MAX_TASK_DOCUMENT_BYTES,
  useTaskDocumentDrafts,
  type TaskDocumentDraftController,
  type TaskDocumentFile,
} from "../client/src/components/TaskDocumentsDialog";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  state.canWrite = false;
  state.listError = null;
  state.payerError = null;
  state.buttons.clear();
  state.removeMutation = null;
  state.counts = [{ taskId: 41, count: 3 }];
  state.data = {
    files: [],
    canUploadDocuments: false,
    canUploadReceipts: true,
    receiptIdentityNotice: null,
  };
  state.invalidate.mockResolvedValue(undefined);
  state.invalidateCounts.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fixtureFile = (name = "synthetisch.pdf", type = "application/pdf") =>
  new File(["%PDF-1.4 synthetic only"], name, { type });
const row = (values: Partial<TaskDocumentFile> = {}): TaskDocumentFile => ({
  id: 3,
  kind: "document",
  title: "Sichtbares Dokument",
  paidBy: null,
  fileName: "synthetisch.pdf",
  mimeType: "application/pdf",
  byteSize: 21,
  createdAt: "2026-11-05T15:00:00Z",
  canOpen: true,
  canDelete: false,
  ...values,
});
const controller = (
  overrides: Partial<TaskDocumentDraftController> = {}
): TaskDocumentDraftController => ({
  drafts: [],
  busy: false,
  stage: vi.fn(),
  discard: vi.fn(),
  clear: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  ...overrides,
});
const renderDialog = (
  props: Partial<React.ComponentProps<typeof TaskDocumentsDialog>> = {}
) =>
  renderToStaticMarkup(
    createElement(TaskDocumentsDialog, {
      area: "prep",
      taskId: 41,
      taskTitle: "Synthetische Aufgabe",
      canWriteTask: state.canWrite,
      drafts: controller(),
      onClose: vi.fn(),
      ...props,
    })
  );

describe("task document UI — synthetic mocks only", () => {
  it.each([
    ["prep", Preparation],
    ["post", PostProcessing],
  ] as const)(
    "offers reader row/card access with one area counts query and no metadata query (%s)",
    (area, Page) => {
      const html = renderToStaticMarkup(createElement(Page));
      expect(
        html.match(
          /aria-label="Belege \/ Dokumente zu Synthetische Aufgabe \(3 Dateien\)"/g
        ) ?? []
      ).toHaveLength(2);
      expect(
        html.match(/aria-hidden="true" class="absolute -right-1 -top-1/g) ?? []
      ).toHaveLength(2);
      expect(state.countsQuery).toHaveBeenCalledOnce();
      expect(state.countsQuery).toHaveBeenCalledWith({ area });
      expect(state.listQuery).not.toHaveBeenCalled();
      expect(state.payerQuery).not.toHaveBeenCalled();
      expect(state.upload).not.toHaveBeenCalled();
      expect(state.download).not.toHaveBeenCalled();
    }
  );

  it.each([1, 7])(
    "shows a compact count badge and accessible file count (%s)",
    count => {
      const html = renderToStaticMarkup(
        createElement(TaskDocumentsButton, {
          compact: true,
          count,
          taskTitle: "Testaufgabe",
          onClick: vi.fn(),
        })
      );
      expect(html).toContain(
        `Belege / Dokumente zu Testaufgabe (${count} ${count === 1 ? "Datei" : "Dateien"})`
      );
      expect(html).toContain('class="absolute -right-1 -top-1');
      expect(html).toContain(`>${count}</span>`);
      expect(html).toContain('aria-hidden="true"');
    }
  );

  it.each([0, undefined])(
    "shows no badge for zero or missing counts (%s)",
    count => {
      const html = renderToStaticMarkup(
        createElement(TaskDocumentsButton, {
          compact: true,
          count,
          onClick: vi.fn(),
        })
      );
      expect(html).not.toContain("<span");
      expect(html).toContain('aria-label="Belege / Dokumente"');
      expect(html).not.toContain("Dateien");
    }
  );

  it.each([
    ["prep", Preparation],
    ["post", PostProcessing],
  ] as const)(
    "shows no row/card badges for zero counts (%s)",
    (_area, Page) => {
      state.counts = [{ taskId: 41, count: 0 }];
      const html = renderToStaticMarkup(createElement(Page));
      expect(
        html.match(
          /aria-label="Belege \/ Dokumente zu Synthetische Aufgabe"/g
        ) ?? []
      ).toHaveLength(2);
      expect(html).not.toContain('class="absolute -right-1 -top-1');
    }
  );

  it("uses a clear neutral non-submit footer action", () => {
    const html = renderToStaticMarkup(
      createElement(TaskDocumentsButton, { onClick: vi.fn() })
    );
    expect(html).toContain('type="button"');
    expect(html).toContain("Belege / Dokumente");
    expect(html).toContain("border-slate-200 bg-white text-slate-700");
    for (const page of ["Preparation", "PostProcessing"]) {
      const text = source(`client/src/pages/${page}.tsx`);
      expect(text).toContain("sm:justify-between");
      expect(text).toContain("<TaskDocumentsButton disabled={pending}");
      expect(text).toContain('className="flex justify-end gap-2"');
    }
  });

  it("keeps locked receipt metadata visible to a reader but offers no file actions or name-based access", () => {
    state.data.files = [
      row(),
      row({
        id: 4,
        kind: "receipt",
        title: "Gesperrter Beleg",
        paidBy: "Testleser",
        fileName: "gesperrt.pdf",
        canOpen: false,
      }),
    ];
    const html = renderDialog();
    const locked =
      html.match(/<li[^>]*>.*?Gesperrter Beleg.*?<\/li>/)?.[0] ?? "";
    expect(locked).toContain("Beleg / Rechnung");
    expect(locked).toContain("Bezahlt von: Testleser");
    expect(locked).toContain("gesperrt.pdf");
    expect(locked).toContain("KiB");
    expect(locked).toContain("Hinzugefügt:");
    expect(locked).toContain("lucide-lock");
    expect(locked).toContain("Nur für berechtigte Personen");
    expect(locked.slice(locked.indexOf("Gesperrter Beleg"))).not.toContain(
      "<button"
    );
    expect(html).not.toContain(
      'aria-label="Gesperrter Beleg in neuer Vorschau anzeigen"'
    );
    expect(html).not.toContain('aria-label="Gesperrter Beleg herunterladen"');
    expect(html).toContain(
      'aria-label="Sichtbares Dokument in neuer Vorschau anzeigen"'
    );
    expect(html).toContain('aria-label="Sichtbares Dokument herunterladen"');
    expect(state.download).not.toHaveBeenCalled();
  });

  it("offers writer receipt access only when the server grants canOpen", () => {
    state.canWrite = true;
    state.data.canUploadDocuments = true;
    state.data.files = [
      row({ kind: "receipt", title: "Freigegebener Beleg", canOpen: true }),
    ];
    const html = renderDialog();
    expect(html).toContain(
      'aria-label="Freigegebener Beleg in neuer Vorschau anzeigen"'
    );
    expect(html).toContain('aria-label="Freigegebener Beleg herunterladen"');
    expect(html).not.toContain("Nur für berechtigte Personen");
    state.data.files[0].canOpen = false;
    expect(renderDialog()).not.toContain(
      'aria-label="Freigegebener Beleg herunterladen"'
    );
  });

  it.each([false, undefined])(
    "guards stale file handlers with strict canOpen before opening a tab or fetching (%s)",
    canOpen => {
      const file = row();
      state.data.files = [file];
      renderDialog();
      const preview = state.buttons.get(
        "Sichtbares Dokument in neuer Vorschau anzeigen"
      )!;
      const download = state.buttons.get("Sichtbares Dokument herunterladen")!;
      const open = vi.fn();
      vi.stubGlobal("window", { open });
      file.canOpen = canOpen as boolean;
      preview();
      download();
      expect(open).not.toHaveBeenCalled();
      expect(state.download).not.toHaveBeenCalled();
    }
  );

  it("allows every task reader receipts but not general-document upload/delete", () => {
    state.data.files = [
      row({ canDelete: true }),
      row({
        id: 4,
        kind: "receipt",
        title: "Eigener Beleg",
        paidBy: "Sichtbare Testperson",
        canDelete: true,
      }),
    ];
    const html = renderDialog();
    expect(html).toContain("Sichtbares Dokument");
    expect(html).toContain("Eigener Beleg");
    expect(html).toContain('value="document" disabled=""');
    expect(html).toContain('accept=".pdf,application/pdf"');
    expect(html).toContain("Bezahlt von");
    expect(html).toContain('value="contact:7"');
    expect(html).toContain('value="helper:8"');
    expect(html).toContain("Testperson (Ansprechpartner)");
    expect(html).toContain("Testperson (Helfer)");
    expect(html).toContain("Datei hochladen");
    expect(html).not.toContain('aria-label="Sichtbares Dokument löschen"');
    expect(html).toContain('aria-label="Eigener Beleg löschen"');
    expect(state.listQuery).toHaveBeenCalledWith(
      { area: "prep", taskId: 41 },
      { enabled: true, retry: false }
    );
    expect(state.payerQuery).toHaveBeenCalledWith(
      { area: "prep" },
      { retry: false }
    );
    for (const text of [
      "ZIP",
      "Betrag",
      "Firma",
      "Rechnungsdatum",
      "externe Person",
      "Name eingeben",
    ])
      expect(html).not.toContain(text);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("shows server identity notice neutrally only in the receipt form", () => {
    state.data.receiptIdentityNotice =
      "Synthetischer Hinweis für einen gemeinsamen Zugang.";
    expect(renderDialog()).toContain(state.data.receiptIdentityNotice);
    state.data.canUploadDocuments = true;
    expect(renderDialog()).not.toContain(state.data.receiptIdentityNotice);
  });

  it("uses server upload rights, not an assumed client writer grant, and respects per-file delete flags", () => {
    state.canWrite = true;
    state.data.files = [row({ title: "Nicht löschbar" })];
    expect(renderDialog()).toContain('value="document" disabled=""');
    state.data.canUploadDocuments = true;
    state.data.files.push(row({ id: 5, title: "Löschbar", canDelete: true }));
    const html = renderDialog();
    expect(html).toContain('accept=".pdf,.jpg,.jpeg,.doc,.docx,');
    expect(html).not.toContain('aria-label="Nicht löschbar löschen"');
    expect(html).toContain('aria-label="Löschbar löschen"');
    expect(html).not.toContain("Bezahlt von");
    expect(html).not.toContain("ZIP");
  });

  it("does not invent hidden receipt metadata and hides cached files on a list error", () => {
    state.data.files = [row({ title: "Nur serverseitig sichtbar" })];
    expect(renderDialog()).not.toContain("Fremder versteckter Beleg");
    state.listError = { message: "Kein Zugriff mehr" };
    const html = renderDialog();
    expect(html).toContain('role="alert"');
    expect(html).toContain("Kein Zugriff mehr");
    expect(html).toContain("Erneut laden");
    expect(html).not.toContain("Nur serverseitig sichtbar");
    expect(html).not.toContain("Testperson");
  });

  it("payer lookup errors never fall back to free-form identity or cached names", () => {
    state.payerError = { message: "Personen nicht verfügbar" };
    const html = renderDialog();
    expect(html).toContain("Personen nicht verfügbar");
    expect(html).toContain("Personen erneut laden");
    expect(html).not.toContain('value="contact:7"');
    expect(html).not.toContain("externe Person");
    expect(html).not.toContain("frei eingeben");
  });

  it("new task files stay local, never load fake-ID metadata, and have no automatic upload", () => {
    state.canWrite = true;
    const queue = createTaskDocumentDraftQueue("prep");
    queue.stage({
      kind: "document",
      title: "Lokaler Entwurf",
      file: fixtureFile(),
    });
    const html = renderDialog({
      taskId: undefined,
      drafts: controller(queue.getSnapshot()),
    });
    expect(html).toContain("Datei vormerken");
    expect(html).toContain("Lokaler Entwurf");
    expect(html).toContain("Vorgemerkte Dateien");
    expect(html).toContain("Abbrechen verwirft sie");
    expect(state.listQuery).toHaveBeenCalledWith(
      { area: "prep", taskId: 0 },
      { enabled: false, retry: false }
    );
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("makes retained failures and retry/discard visible and blocks controls while busy", () => {
    const draft = {
      localId: "local:1",
      kind: "receipt" as const,
      title: "Fehlgeschlagener Beleg",
      file: fixtureFile(),
      paidByKey: "contact:7",
      status: "failed" as const,
      error: "Synthetischer Uploadfehler",
    };
    const html = renderDialog({ drafts: controller({ drafts: [draft] }) });
    expect(html).toContain("Ausstehende Uploads erneut versuchen");
    expect(html).toContain("Vormerkung verwerfen");
    expect(html).toContain("Synthetischer Uploadfehler");
    expect(html).toContain("Datei bleibt für einen neuen Versuch vorgemerkt");
    const busyHtml = renderDialog({
      drafts: controller({ drafts: [draft], busy: true }),
    });
    expect(busyHtml).toContain('disabled=""');
    expect(busyHtml).toContain("Lädt hoch …");
  });

  it("offers fresh preview for PDF/JPEG and download only for Word", () => {
    state.data.files = [
      row({ title: "PDF" }),
      row({
        id: 4,
        title: "JPEG",
        fileName: "bild.jpg",
        mimeType: "image/jpeg",
      }),
      row({
        id: 5,
        title: "Word",
        fileName: "brief.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ];
    const html = renderDialog();
    expect(html).toContain('aria-label="PDF in neuer Vorschau anzeigen"');
    expect(html).toContain('aria-label="JPEG in neuer Vorschau anzeigen"');
    expect(html).not.toContain('aria-label="Word in neuer Vorschau anzeigen"');
    expect(html).toContain('aria-label="Word herunterladen"');
    expect(taskDocumentCanPreview("text/html")).toBe(false);
  });
});

describe("local drafts and upload lifecycle", () => {
  const hookController = (area: "prep" | "post") => {
    let drafts!: TaskDocumentDraftController;
    const Capture = () => {
      drafts = useTaskDocumentDrafts(area);
      return null;
    };
    renderToStaticMarkup(createElement(Capture));
    // Browser file reading is purely synthetic; no storage or network is involved.
    vi.stubGlobal(
      "FileReader",
      class {
        result = "data:application/pdf;base64,c3ludGhldGlj";
        onload: (() => void) | null = null;
        readAsDataURL() {
          this.onload?.();
        }
      }
    );
    return drafts;
  };

  it.each(["prep", "post"] as const)(
    "invalidates counts and the existing list after confirmed uploads (%s)",
    async area => {
      const drafts = hookController(area);
      drafts.stage({ kind: "document", title: "Erfolg", file: fixtureFile() });
      state.upload.mockResolvedValueOnce({ id: 11 });
      expect(await drafts.flush(41)).toBe(true);
      expect(state.invalidate).toHaveBeenCalledWith({ area, taskId: 41 });
      expect(state.invalidateCounts).toHaveBeenCalledWith({ area });
      expect(state.upload).toHaveBeenCalledOnce();
    }
  );

  it("invalidates counts after partial flush successes, without re-uploading confirmed files on retry", async () => {
    const drafts = hookController("prep");
    for (const title of ["Erfolg", "Fehler", "Weiterer Erfolg"])
      drafts.stage({ kind: "document", title, file: fixtureFile() });
    state.upload
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error("Fiktiver Fehler"))
      .mockResolvedValueOnce({ id: 3 });
    expect(await drafts.flush(41)).toBe(false);
    expect(state.invalidate).toHaveBeenCalledWith({ area: "prep", taskId: 41 });
    expect(state.invalidateCounts).toHaveBeenCalledOnce();
    expect(state.invalidateCounts).toHaveBeenCalledWith({ area: "prep" });
    state.upload.mockResolvedValueOnce({ id: 2 });
    expect(await drafts.flush(41)).toBe(true);
    expect(state.upload.mock.calls.map(([input]) => input.title)).toEqual([
      "Erfolg",
      "Fehler",
      "Weiterer Erfolg",
      "Fehler",
    ]);
    expect(state.invalidateCounts).toHaveBeenCalledTimes(2);
  });

  it("does not count local drafts or entirely failed uploads", async () => {
    const drafts = hookController("post");
    drafts.stage({ kind: "document", title: "Lokal", file: fixtureFile() });
    expect(state.invalidateCounts).not.toHaveBeenCalled();
    state.upload.mockRejectedValueOnce(new Error("Fiktiver Fehler"));
    expect(await drafts.flush(41)).toBe(false);
    expect(state.invalidateCounts).not.toHaveBeenCalled();
    expect(state.invalidate).toHaveBeenCalledWith({ area: "post", taskId: 41 });
  });

  it("does not turn cache refresh failures into upload failures or duplicates", async () => {
    const drafts = hookController("prep");
    drafts.stage({
      kind: "document",
      title: "Gespeichert",
      file: fixtureFile(),
    });
    state.upload.mockResolvedValueOnce({ id: 1 });
    state.invalidate.mockRejectedValue(new Error("Fiktiver Cachefehler"));
    state.invalidateCounts.mockRejectedValue(new Error("Fiktiver Cachefehler"));
    expect(await drafts.flush(41)).toBe(true);
    expect(await drafts.flush(41)).toBe(true);
    expect(state.upload).toHaveBeenCalledOnce();
    expect(state.invalidateCounts).toHaveBeenCalledOnce();
  });

  it.each(["prep", "post"] as const)(
    "invalidates area counts only after successful deletion and preserves list refresh (%s)",
    async area => {
      renderDialog({ area });
      state.remove.mockRejectedValueOnce(new Error("Fiktiver Löschfehler"));
      await expect(state.removeMutation!({ area, id: 3 })).rejects.toThrow(
        "Fiktiver Löschfehler"
      );
      expect(state.invalidateCounts).not.toHaveBeenCalled();
      state.remove.mockResolvedValueOnce({ success: true });
      await state.removeMutation!({ area, id: 3 });
      expect(state.invalidateCounts).toHaveBeenCalledOnce();
      expect(state.invalidateCounts).toHaveBeenCalledWith({ area });
      const text = source("client/src/components/TaskDocumentsDialog.tsx");
      expect(text).toMatch(
        /await remove\.mutateAsync\(\{ area, id: row\.id \}\);\s*setDeleteId\(null\);\s*await list\.refetch\(\);/
      );
    }
  );

  it("discards any number of new-task drafts without uploading/orphaning anything", () => {
    const queue = createTaskDocumentDraftQueue("prep");
    queue.stage({ kind: "document", title: "Erstes", file: fixtureFile() });
    queue.stage({
      kind: "receipt",
      title: "Zweites",
      paidByKey: "contact:7",
      file: fixtureFile(),
    });
    expect(queue.getSnapshot().drafts).toHaveLength(2);
    queue.clear();
    expect(queue.getSnapshot().drafts).toEqual([]);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("does not flush queued files when task creation fails", async () => {
    const queue = createTaskDocumentDraftQueue("prep");
    queue.stage({
      kind: "document",
      title: "Bleibt lokal",
      file: fixtureFile(),
    });
    const create = vi
      .fn()
      .mockRejectedValue(new Error("Anlage fehlgeschlagen"));
    await expect(
      (async () => {
        const created = await create();
        await queue.flush(created.id, state.upload);
      })()
    ).rejects.toThrow("Anlage fehlgeschlagen");
    expect(queue.getSnapshot().drafts).toHaveLength(1);
    expect(state.upload).not.toHaveBeenCalled();
    queue.clear();
    expect(queue.getSnapshot().drafts).toHaveLength(0);
  });

  it.each([0, -1, NaN, 1.5])(
    "refuses uploads before a valid saved ID (%s)",
    async taskId => {
      const queue = createTaskDocumentDraftQueue("post");
      queue.stage({ kind: "document", title: "Entwurf", file: fixtureFile() });
      const encode = vi.fn();
      await expect(queue.flush(taskId, state.upload, encode)).rejects.toThrow(
        "erfolgreicher Aufgabenanlage"
      );
      expect(state.upload).not.toHaveBeenCalled();
      expect(encode).not.toHaveBeenCalled();
      expect(queue.getSnapshot().drafts).toHaveLength(1);
    }
  );

  it("waits for successful create, sends real ID and keyed payer, removes confirmed successes", async () => {
    const queue = createTaskDocumentDraftQueue("post");
    queue.stage({
      kind: "receipt",
      title: "Rechnung",
      paidByKey: "contact:7",
      paidByLabel: "Testperson",
      file: fixtureFile(),
    });
    const create = vi.fn().mockResolvedValue({ id: 74 });
    const upload = vi.fn().mockResolvedValue({ id: 99 });
    const result = await create();
    expect(upload).not.toHaveBeenCalled();
    expect(
      await queue.flush(
        result.id,
        upload,
        vi.fn().mockResolvedValue("synthetic-base64")
      )
    ).toBe(true);
    expect(upload).toHaveBeenCalledWith({
      area: "post",
      taskId: 74,
      kind: "receipt",
      title: "Rechnung",
      paidByKey: "contact:7",
      fileName: "synthetisch.pdf",
      base64: "synthetic-base64",
    });
    expect(queue.getSnapshot()).toEqual({ drafts: [], busy: false });
  });

  it("retains only failed files, continues other uploads, then retries without recreating or duplicating successes", async () => {
    const queue = createTaskDocumentDraftQueue("prep");
    for (const title of ["Erfolg", "Fehler", "Weiterer Erfolg"])
      queue.stage({ kind: "document", title, file: fixtureFile() });
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error("Synthetischer Fehler"))
      .mockResolvedValueOnce({ id: 3 });
    const encode = vi.fn().mockResolvedValue("base64");
    expect(await queue.flush(41, upload, encode)).toBe(false);
    expect(queue.getSnapshot().drafts).toHaveLength(1);
    expect(queue.getSnapshot().drafts[0]).toMatchObject({
      title: "Fehler",
      status: "failed",
      error: "Synthetischer Fehler",
    });
    upload.mockResolvedValueOnce({ id: 2 });
    expect(await queue.flush(41, upload, encode)).toBe(true);
    expect(upload.mock.calls.map(([input]) => input.title)).toEqual([
      "Erfolg",
      "Fehler",
      "Weiterer Erfolg",
      "Fehler",
    ]);
    expect(upload.mock.calls.every(([input]) => input.taskId === 41)).toBe(
      true
    );
    expect(upload.mock.calls.every(([input]) => !("paidByKey" in input))).toBe(
      true
    );
  });

  it("locks synchronously against double-click uploads and draft deletion during upload", async () => {
    const queue = createTaskDocumentDraftQueue("prep");
    queue.stage({ kind: "document", title: "Nur einmal", file: fixtureFile() });
    let release!: () => void;
    const upload = vi.fn(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        })
    );
    const first = queue.flush(41, upload, vi.fn().mockResolvedValue("base64"));
    await Promise.resolve();
    expect(queue.getSnapshot().busy).toBe(true);
    queue.clear();
    queue.discard(queue.getSnapshot().drafts[0].localId);
    expect(queue.getSnapshot().drafts).toHaveLength(1);
    expect(await queue.flush(41, upload)).toBe(false);
    expect(upload).toHaveBeenCalledOnce();
    release();
    expect(await first).toBe(true);
  });

  it("retains file-read failures without issuing any upload and can retry", async () => {
    const queue = createTaskDocumentDraftQueue("post");
    queue.stage({ kind: "document", title: "Lesefehler", file: fixtureFile() });
    const encode = vi
      .fn()
      .mockRejectedValueOnce(new Error("Datei nicht lesbar"))
      .mockResolvedValueOnce("base64");
    expect(await queue.flush(41, state.upload, encode)).toBe(false);
    expect(state.upload).not.toHaveBeenCalled();
    expect(queue.getSnapshot().drafts[0].error).toBe("Datei nicht lesbar");
    expect(await queue.flush(41, state.upload, encode)).toBe(true);
  });

  it("page save handlers keep editing IDs on failures, clear only committed log entries, and wait for attachments", () => {
    for (const page of ["Preparation", "PostProcessing"]) {
      const text = source(`client/src/pages/${page}.tsx`);
      expect(text).toContain("await create.mutateAsync");
      expect(text).toContain("await update.mutateAsync");
      expect(text).toContain("await documents.flush(taskId!)");
      expect(text).toContain("saveInFlight.current = true");
      expect(text).toContain("Aufgabe gespeichert. Einige Dateien");
      expect(text.indexOf("setEditingTask(Object.assign")).toBeLessThan(
        text.indexOf("await documents.flush(taskId!)")
      );
      expect(text).toContain(
        'setForm(current => ({ ...current, logEntry: "" }))'
      );
      expect(text).not.toContain("ZIP");
    }
  });
});

describe("file formats and person keys", () => {
  it("permits only nonempty PDF/JPEG/DOC/DOCX up to exactly five MiB", () => {
    for (const [name, type] of [
      ["test.pdf", "application/pdf"],
      ["test.JPG", "image/jpeg"],
      ["test.jpeg", "image/jpeg"],
      ["test.doc", "application/msword"],
      [
        "test.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    ]) {
      const file = { name, type, size: MAX_TASK_DOCUMENT_BYTES };
      expect(taskDocumentSelectionError("document", file)).toBeNull();
      expect(
        taskDocumentSelectionError("document", { ...file, size: file.size + 1 })
      ).toContain("5 MiB");
      expect(
        taskDocumentSelectionError("document", { ...file, size: 0 })
      ).toContain("leer");
      expect(
        taskDocumentSelectionError("document", { ...file, type: "" })
      ).toBeNull();
    }
    expect(
      taskDocumentSelectionError("document", {
        name: "test.zip",
        type: "application/zip",
        size: 10,
      })
    ).not.toBeNull();
    expect(
      taskDocumentSelectionError("document", {
        name: "test.png",
        type: "image/png",
        size: 10,
      })
    ).not.toBeNull();
    expect(
      taskDocumentSelectionError("document", {
        name: "test.pdf",
        type: "text/html",
        size: 10,
      })
    ).toContain("passen nicht");
    expect(
      taskDocumentSelectionError("receipt", {
        name: "test.jpg",
        type: "image/jpeg",
        size: 10,
      })
    ).toContain("PDF");
  });

  it("receipt requires title, PDF and an exact known payer key, never a free-form person name", () => {
    const file = fixtureFile();
    expect(
      taskDocumentFormError(
        "receipt",
        "Rechnung",
        file,
        "contact:7",
        state.payers
      )
    ).toBeNull();
    expect(
      taskDocumentFormError(
        "receipt",
        "Rechnung",
        file,
        "helper:8",
        state.payers
      )
    ).toBeNull();
    for (const key of ["Testperson", "external", "contact:999", ""])
      expect(
        taskDocumentFormError("receipt", "Rechnung", file, key, state.payers)
      ).toContain("bekannte");
    expect(
      taskDocumentFormError("document", "Dokument", file, "", [])
    ).toBeNull();
    expect(taskDocumentFormError("document", " ", file, "", [])).toContain(
      "Bezeichnung"
    );
    expect(taskDocumentFormError("document", "Titel", null, "", [])).toContain(
      "Datei"
    );
  });

  it("disambiguates duplicate names without deduplicating distinct person keys", () => {
    expect(taskDocumentPayerLabel(state.payers[0], state.payers)).toBe(
      "Testperson (Ansprechpartner)"
    );
    expect(taskDocumentPayerLabel(state.payers[1], state.payers)).toBe(
      "Testperson (Helfer)"
    );
    expect(taskDocumentPayerLabel(state.payers[0], [state.payers[0]])).toBe(
      "Testperson"
    );
  });

  it("checks real file headers before upload rather than trusting extension/MIME", async () => {
    vi.stubGlobal(
      "FileReader",
      class {
        result = "data:application/pdf;base64,c3ludGhldGlj";
        onload: (() => void) | null = null;
        readAsDataURL() {
          this.onload?.();
        }
      }
    );
    expect(await taskDocumentBase64(fixtureFile(), "receipt")).toBe(
      "c3ludGhldGlj"
    );
    await expect(
      taskDocumentBase64(
        new File(["not-a-pdf"], "test.pdf", { type: "application/pdf" }),
        "receipt"
      )
    ).rejects.toThrow("Dateikopf");
    await expect(
      taskDocumentBase64(
        new File(["not-word"], "test.doc", { type: "application/msword" }),
        "document"
      )
    ).rejects.toThrow("Dateikopf");
  });
});

describe("Blob preview/download resource cleanup", () => {
  const setup = () => {
    vi.useFakeTimers();
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:one")
      .mockReturnValueOnce("blob:two");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { appendChild: vi.fn() },
    });
    const file = {
      fileName: "fixture.pdf",
      mimeType: "application/pdf",
      base64: btoa("%PDF-1.4 synthetic"),
    };
    return { anchor, createObjectURL, revokeObjectURL, file };
  };

  it("creates a fresh real Blob for each preview and revokes on close and unmount", () => {
    const { createObjectURL, revokeObjectURL, file } = setup();
    const first = { opener: {}, closed: false, location: { replace: vi.fn() } };
    const second = {
      opener: {},
      closed: false,
      location: { replace: vi.fn() },
    };
    const viewer = createTaskDocumentFileViewer();
    viewer.show(file, "preview", first as unknown as Window);
    viewer.show(file, "preview", second as unknown as Window);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(first.opener).toBeNull();
    expect(first.location.replace).toHaveBeenCalledWith("blob:one");
    expect(second.location.replace).toHaveBeenCalledWith("blob:two");
    first.closed = true;
    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:one");
    viewer.dispose();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:two");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("downloads Word through a Blob anchor, sanitizes filename and releases URL", () => {
    const { anchor, revokeObjectURL, file } = setup();
    const viewer = createTaskDocumentFileViewer();
    viewer.show(
      { ...file, fileName: "test/brief.doc", mimeType: "application/msword" },
      "download"
    );
    expect(anchor.download).toBe("test-brief.doc");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:one");
    viewer.dispose();
  });

  it("rejects unsupported preview formats and cleans up a failed navigation", () => {
    const { revokeObjectURL, file } = setup();
    const viewer = createTaskDocumentFileViewer();
    expect(() =>
      viewer.show({ ...file, mimeType: "application/msword" }, "preview")
    ).toThrow("herunterladen");
    const preview = {
      location: {
        replace: () => {
          throw new Error("navigation failed");
        },
      },
    } as unknown as Window;
    expect(() => viewer.show(file, "preview", preview)).toThrow(
      "navigation failed"
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:one");
    viewer.dispose();
  });
});
