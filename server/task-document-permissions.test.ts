import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  productAllowsCapability,
  type ProductPackageId,
} from "../shared/product-packages";
vi.mock("./session-presence", async importOriginal => ({
  ...(await importOriginal<typeof import("./session-presence")>()),
  recordSessionPresence: vi.fn(async () => {}),
}));
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
function caller(
  openId = "planning-team-access-71",
  authenticated = true,
  role: "user" | "admin" = "user"
) {
  return appRouter.createCaller({
    req: { headers: { "x-event-year": "2027", "x-event-id": "1" } } as any,
    res: {} as any,
    user: authenticated
      ? {
          id: 701,
          openId,
          name: "Nicht als ID verwendeter Name",
          email: "test@example.invalid",
          role,
          loginMethod: "password",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
  });
}
let access: Record<string, unknown>;
let packageId: ProductPackageId;
const upload = {
  area: "prep" as const,
  taskId: 3,
  kind: "receipt" as const,
  title: "Pokale",
  paidByKey: "contact:17",
  fileName: "pokale.pdf",
  base64: "JVBERi0=",
};
type TaskDocumentApi = ReturnType<typeof caller>["taskDocuments"];
const operations: Array<{
  name: string;
  run: (api: TaskDocumentApi, area: "prep" | "post") => Promise<unknown>;
}> = [
  { name: "list", run: (api, area) => api.list({ area, taskId: 3 }) },
  { name: "counts", run: (api, area) => api.counts({ area }) },
  { name: "payers", run: (api, area) => api.payers({ area }) },
  {
    name: "uploadReceipt",
    run: (api, area) => api.upload({ ...upload, area }),
  },
  {
    name: "uploadDocument",
    run: (api, area) =>
      api.upload({ ...upload, area, kind: "document", paidByKey: undefined }),
  },
  { name: "download", run: (api, area) => api.download({ area, id: 10 }) },
  { name: "remove", run: (api, area) => api.remove({ area, id: 10 }) },
];
const serviceCalls = [
  files.listTaskDocuments,
  files.listTaskDocumentCounts,
  files.listTaskDocumentPayers,
  files.uploadTaskDocument,
  files.downloadTaskDocument,
  files.removeTaskDocument,
];
describe("Aufgabendokumente: autorisierte Serverrouten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    packageId = "enterprise";
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
    vi.spyOn(db, "resolveTenantForUser").mockResolvedValue({
      tenantId: "test-verein",
    } as any);
    vi.spyOn(
      db,
      "isPlanningTeamAccessPasswordChangeRequired"
    ).mockResolvedValue(false);
    vi.spyOn(db, "isTenantAdminPasswordChangeRequired").mockResolvedValue(
      false
    );
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async operation =>
      operation()
    );
    vi.spyOn(db, "recordActivityLog").mockResolvedValue({} as any);
    vi.spyOn(db, "getCurrentTenantProductEntitlement").mockImplementation(
      async () =>
        ({
          packageId,
          eventId: 1,
          isUsable: true,
          status: "active",
        }) as any
    );
    vi.spyOn(db, "currentProductAllowsCapability").mockImplementation(
      async capability => productAllowsCapability(packageId, capability)
    );
    vi.spyOn(db, "currentProductAllowsPlanningModule").mockResolvedValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
  describe.each(["event_pass", "light"] as const)(
    "%s ohne Dokumentfähigkeit",
    deniedPackage => {
      it.each(["prep", "post"] as const)(
        "sperrt sämtliche %s-Operationen vor Dokumentdiensten, auch für Admins",
        async area => {
          packageId = deniedPackage;
          access.moduleAccess = {
            preparation: "write",
            postprocessing: "write",
            finances: "write",
          };
          for (const identity of [
            "personal",
            "shared",
            "delegated",
            "admin",
          ] as const) {
            access.contactId = identity === "shared" ? null : 17;
            access.isTenantAdmin = identity === "delegated";
            const api =
              identity === "admin"
                ? caller("tenant-admin:fixture", true, "admin").taskDocuments
                : caller().taskDocuments;
            for (const operation of operations) {
              await expect(
                operation.run(api, area),
                `${identity}: ${operation.name}`
              ).rejects.toMatchObject({ code: "FORBIDDEN" });
            }
          }
          expect(db.currentProductAllowsCapability).toHaveBeenCalledWith(
            "document_attachments"
          );
          expect(db.currentProductAllowsPlanningModule).not.toHaveBeenCalled();
          expect(db.getContact).not.toHaveBeenCalled();
          for (const service of serviceCalls)
            expect(service).not.toHaveBeenCalled();
        }
      );
    }
  );
  describe.each(["pro", "enterprise"] as const)(
    "%s mit Dokumentfähigkeit",
    allowedPackage => {
      it.each(["prep", "post"] as const)(
        "lässt sämtliche %s-Operationen durch und behält individuelle Actorrechte",
        async area => {
          packageId = allowedPackage;
          for (const rights of [
            {
              task: "read",
              finances: "off",
              taskWrite: false,
              financeWrite: false,
            },
            {
              task: "write",
              finances: "read",
              taskWrite: true,
              financeWrite: false,
            },
            {
              task: "read",
              finances: "write",
              taskWrite: false,
              financeWrite: true,
            },
          ] as const) {
            access.moduleAccess = {
              preparation: rights.task,
              postprocessing: rights.task,
              finances: rights.finances,
            };
            for (const operation of operations)
              await operation.run(caller().taskDocuments, area);
            const actor = expect.objectContaining({
              userId: 701,
              personalAccount: true,
              ownContactIds: new Set([17]),
              taskWrite: rights.taskWrite,
              financeWrite: rights.financeWrite,
            });
            expect(files.listTaskDocuments).toHaveBeenLastCalledWith(
              area,
              3,
              actor
            );
            expect(files.uploadTaskDocument).toHaveBeenLastCalledWith(
              expect.objectContaining({ area, kind: "document" }),
              actor
            );
            expect(files.downloadTaskDocument).toHaveBeenLastCalledWith(
              area,
              10,
              actor
            );
            expect(files.removeTaskDocument).toHaveBeenLastCalledWith(
              area,
              10,
              actor
            );
            expect(files.listTaskDocumentCounts).toHaveBeenLastCalledWith(area);
            expect(files.listTaskDocumentPayers).toHaveBeenCalled();
          }
          expect(db.currentProductAllowsCapability).toHaveBeenCalledWith(
            "document_attachments"
          );
        }
      );
      it("ersetzt keine persönliche Modulfreigabe durch die Paketfähigkeit", async () => {
        packageId = allowedPackage;
        access.moduleAccess = {
          preparation: "off",
          postprocessing: "off",
          finances: "write",
        };
        for (const area of ["prep", "post"] as const) {
          for (const operation of operations) {
            await expect(
              operation.run(caller().taskDocuments, area)
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
          }
        }
        for (const service of serviceCalls)
          expect(service).not.toHaveBeenCalled();
      });
      it("hält öffentliche Demoidentitäten trotz Paket- und Adminrechten gesperrt", async () => {
        packageId = allowedPackage;
        const api = caller(
          "tenant-admin:demo-session-fixture",
          true,
          "admin"
        ).taskDocuments;
        for (const area of ["prep", "post"] as const) {
          for (const operation of operations) {
            await expect(operation.run(api, area)).rejects.toMatchObject({
              code: "FORBIDDEN",
              message: expect.stringContaining("Vereinsdemo"),
            });
          }
        }
        for (const service of serviceCalls)
          expect(service).not.toHaveBeenCalled();
      });
    }
  );
  it("macht bestehende Dateien nach Downgrade unzugänglich und nach Pro-Rückkehr wieder zugänglich, ohne sie zu löschen", async () => {
    const api = caller().taskDocuments;
    packageId = "pro";
    const original = await api.download({ area: "prep", id: 10 });
    packageId = "light";
    for (const operation of operations) {
      await expect(operation.run(api, "prep")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect(files.downloadTaskDocument).toHaveBeenCalledTimes(1);
    expect(files.removeTaskDocument).not.toHaveBeenCalled();
    packageId = "pro";
    await expect(api.download({ area: "prep", id: 10 })).resolves.toEqual(
      original
    );
    expect(files.downloadTaskDocument).toHaveBeenCalledTimes(2);
  });
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
