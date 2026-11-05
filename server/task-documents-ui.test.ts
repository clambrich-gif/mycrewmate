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
  payerQuery: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  invalidate: vi.fn(),
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
        remove: { useMutation: () => ({ mutateAsync: state.remove }) },
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
  type TaskDocumentDraftController,
  type TaskDocumentFile,
} from "../client/src/components/TaskDocumentsDialog";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  state.canWrite = false;
  state.listError = null;
  state.payerError = null;
  state.data = {
    files: [],
    canUploadDocuments: false,
    canUploadReceipts: true,
    receiptIdentityNotice: null,
  };
  state.invalidate.mockResolvedValue(undefined);
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
  it.each([Preparation, PostProcessing])(
    "offers reader access in both stored task row and card without querying metadata on overview",
    Page => {
      const html = renderToStaticMarkup(createElement(Page));
      expect(
        html.match(
          /aria-label="Belege \/ Dokumente zu Synthetische Aufgabe"/g
        ) ?? []
      ).toHaveLength(2);
      expect(state.listQuery).not.toHaveBeenCalled();
      expect(state.payerQuery).not.toHaveBeenCalled();
      expect(state.upload).not.toHaveBeenCalled();
      expect(state.download).not.toHaveBeenCalled();
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
