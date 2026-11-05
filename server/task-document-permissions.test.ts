import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./task-documents", () => ({
  listTaskDocuments: vi.fn(async () => ({
    files: [],
    canUploadDocuments: false,
    canUploadReceipts: true,
  })),
  listTaskDocumentCounts: vi.fn(async () => [{ taskId: 3, count: 2 }]),
  listTaskDocumentPayers: vi.fn(async () => [
    { key: "contact:17", name: "Musterperson" },
  ]),
  uploadTaskDocument: vi.fn(async () => ({ id: 10 })),
  downloadTaskDocument: vi.fn(async () => ({
    fileName: "Beleg.pdf",
    mimeType: "application/pdf",
    base64: "ZmlrdGl2",
  })),
  removeTaskDocument: vi.fn(async () => ({ success: true })),
}));
import { appRouter } from "./routers";
import * as db from "./db";
import * as files from "./task-documents";
function caller(openId = "planning-team-access-71", authenticated = true) {
  return appRouter.createCaller({
    req: { headers: { "x-event-year": "2027", "x-event-id": "1" } } as any,
    res: {} as any,
    user: authenticated
      ? {
          id: 701,
          openId,
          name: "Nicht als ID verwendeter Name",
          email: "test@example.invalid",
          role: "user",
          loginMethod: "password",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
  });
}
let access: Record<string, unknown>;
const upload = {
  area: "prep" as const,
  taskId: 3,
  kind: "receipt" as const,
  title: "Pokale",
  paidByKey: "contact:17",
  fileName: "pokale.pdf",
  base64: "JVBERi0=",
};
describe("Aufgabendokumente: autorisierte Serverrouten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access = {
      id: 71,
      contactId: 17,
      isTenantAdmin: false,
      moduleAccess: {
        preparation: "read",
        postprocessing: "read",
        finances: "off",
      },
    };
    vi.spyOn(db, "getPlanningTeamAccessTenantId").mockResolvedValue(
      "test-verein"
    );
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(true);
    vi.spyOn(
      db,
      "getPlanningTeamAccessCredentialForCurrentTenant"
    ).mockImplementation(async () => access as any);
    vi.spyOn(db, "getContact").mockResolvedValue({
      id: 17,
      eventId: 1,
      year: 2027,
    } as any);
    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 1,
      year: 2027,
      tenantId: "test-verein",
      status: "active",
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
  });
  afterEach(() => vi.restoreAllMocks());
  it("Aufgaben-Leser können Rechnungen einreichen; die individuelle Lesefreigabe bleibt beim Dokumentdienst", async () => {
    await caller().taskDocuments.upload(upload);
    expect(files.uploadTaskDocument).toHaveBeenCalledWith(
      upload,
      expect.objectContaining({
        userId: 701,
        personalAccount: true,
        financeWrite: false,
        taskWrite: false,
        ownContactIds: new Set([17]),
      })
    );
    await caller().taskDocuments.list({ area: "post", taskId: 4 });
    expect(files.listTaskDocuments).toHaveBeenCalledWith(
      "post",
      4,
      expect.objectContaining({ taskWrite: false, financeWrite: false })
    );
  });
  it.each(["prep", "post"] as const)(
    "%s-Leser erhalten alle Anhangszähler ohne Finanzrechte",
    async area => {
      await expect(caller().taskDocuments.counts({ area })).resolves.toEqual([
        { taskId: 3, count: 2 },
      ]);
      expect(files.listTaskDocumentCounts).toHaveBeenCalledWith(area);
    }
  );
  it("Schreibrechte werden ausschließlich für den jeweils angefragten Aufgabenbereich aufgelöst", async () => {
    access.moduleAccess = {
      preparation: "write",
      postprocessing: "read",
      finances: "off",
    };
    await caller().taskDocuments.list({ area: "prep", taskId: 3 });
    expect(files.listTaskDocuments).toHaveBeenLastCalledWith(
      "prep",
      3,
      expect.objectContaining({ taskWrite: true, financeWrite: false })
    );
    await caller().taskDocuments.list({ area: "post", taskId: 4 });
    expect(files.listTaskDocuments).toHaveBeenLastCalledWith(
      "post",
      4,
      expect.objectContaining({ taskWrite: false, financeWrite: false })
    );
  });
  it("Finanz-Lesezugriff ist kein Finanz-Schreibrecht, auch beim Direktdownload", async () => {
    access.moduleAccess = {
      preparation: "write",
      postprocessing: "write",
      finances: "read",
    };
    await caller().taskDocuments.download({ area: "prep", id: 10 });
    expect(files.downloadTaskDocument).toHaveBeenCalledWith(
      "prep",
      10,
      expect.objectContaining({ financeWrite: false })
    );
    access.moduleAccess = {
      preparation: "read",
      postprocessing: "read",
      finances: "write",
    };
    await caller().taskDocuments.list({ area: "prep", taskId: 3 });
    expect(files.listTaskDocuments).toHaveBeenLastCalledWith(
      "prep",
      3,
      expect.objectContaining({ financeWrite: true })
    );
  });
  it("Kein Modulzugriff: Listen, Zahler, Upload und direkter Download sind gesperrt", async () => {
    access.moduleAccess = {
      preparation: "off",
      postprocessing: "off",
      finances: "write",
    };
    const api = caller().taskDocuments;
    for (const call of [
      () => api.list({ area: "prep", taskId: 3 }),
      () => api.counts({ area: "prep" }),
      () => api.counts({ area: "post" }),
      () => api.payers({ area: "post" }),
      () => api.upload(upload),
      () => api.download({ area: "prep", id: 10 }),
      () => api.remove({ area: "post", id: 10 }),
    ])
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(files.listTaskDocuments).not.toHaveBeenCalled();
    expect(files.listTaskDocumentCounts).not.toHaveBeenCalled();
    expect(files.uploadTaskDocument).not.toHaveBeenCalled();
    expect(files.downloadTaskDocument).not.toHaveBeenCalled();
  });
  it("Ohne Anmeldung kein Dateizugriff", async () => {
    await expect(
      caller("planning-team-access-71", false).taskDocuments.download({
        area: "prep",
        id: 10,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller("planning-team-access-71", false).taskDocuments.counts({
        area: "prep",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(files.listTaskDocumentCounts).not.toHaveBeenCalled();
    expect(files.downloadTaskDocument).not.toHaveBeenCalled();
  });
  it("Unverknüpfte gemeinsame Logins erhalten keine private Uploaderidentität und keine Kontaktrechte", async () => {
    access.contactId = null;
    await caller().taskDocuments.upload(upload);
    expect(files.uploadTaskDocument).toHaveBeenCalledWith(
      upload,
      expect.objectContaining({
        personalAccount: false,
        ownContactIds: new Set(),
      })
    );
  });
  it("Ein fehlender Kontakt im aktuellen Event wird nicht per gleichem Namen ersetzt", async () => {
    vi.mocked(db.getContact).mockResolvedValue(undefined);
    await caller().taskDocuments.list({ area: "prep", taskId: 3 });
    expect(files.listTaskDocuments).toHaveBeenCalledWith(
      "prep",
      3,
      expect.objectContaining({ ownContactIds: new Set() })
    );
  });
  it("Paketgrenzen bleiben auch für die neue Dokument-API wirksam", async () => {
    vi.mocked(db.currentProductAllowsPlanningModule).mockResolvedValue(false);
    await expect(
      caller().taskDocuments.list({ area: "prep", taskId: 3 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().taskDocuments.counts({ area: "post" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(files.listTaskDocumentCounts).not.toHaveBeenCalled();
    expect(files.listTaskDocuments).not.toHaveBeenCalled();
  });
  it("Validiert nur die reduzierte Belegstruktur und nimmt keine Finanzbeträge auf", async () => {
    await expect(
      caller().taskDocuments.upload({ ...upload, paidByKey: "name:Freitext" })
    ).rejects.toThrow();
    await caller().taskDocuments.upload({ ...upload, income: 10000 } as any);
    expect(files.uploadTaskDocument).toHaveBeenCalledWith(
      upload,
      expect.anything()
    );
  });
});
