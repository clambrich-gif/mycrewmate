import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import jpeg from "jpeg-js";
import * as CFB from "cfb";

// Replace the entire DB/storage modules before importing production code. Even
// with DATABASE_URL present, this suite cannot open a connection or write files.
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({
    key,
    url: `https://storage.invalid/${key}`,
  })),
  storageRead: vi.fn(async () => Buffer.from("private fixture contents")),
  storageDelete: vi.fn(async () => undefined),
}));

import * as db from "./db";
import { storageDelete, storagePut, storageRead } from "./storage";
import { withPlanningScope } from "./year-context";
import { planningTeamAccessOpenId } from "./password-auth";
import type { taskDocuments } from "../drizzle/schema";
import {
  MAX_TASK_FILE_BYTES,
  canReadTaskReceipt,
  downloadTaskDocument,
  listTaskDocuments,
  uploadTaskDocument,
  validateTaskFile,
  type TaskDocumentActor,
  type TaskDocumentArea,
} from "./task-documents";

type DocumentRow = typeof taskDocuments.$inferSelect;
type Row = Record<string, any>;
type State = Record<string, Row[]>;
type QueryLog = { table: string; sql: string; params: unknown[] };
const scope = { tenantId: "fixture-verein", eventId: 81, year: 2027 };
const inScope = <T>(fn: () => T) => withPlanningScope(scope, fn);
const TASK_ID = 70;
const POST_TASK_ID = 71;
const PRIVATE_KEY = "task-documents/fixture-verein/2027/81/private.pdf";
const toBase64 = (bytes: Buffer | Uint8Array) =>
  Buffer.from(bytes).toString("base64");

function actor(overrides: Partial<TaskDocumentActor> = {}): TaskDocumentActor {
  return {
    userId: 901,
    personalAccount: true,
    ownContactIds: new Set<number>(),
    financeWrite: false,
    taskWrite: false,
    ...overrides,
  };
}
function document(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 42,
    ...scope,
    prepTaskId: TASK_ID,
    postTaskId: null,
    kind: "receipt",
    title: "Vertraulicher Beleg",
    uploadedByUserId: 902,
    paidByUserId: null,
    paidByContactId: null,
    paidByHelperId: null,
    paidBy: "Vertrauliche zahlende Person",
    fileName: "vertraulich.pdf",
    mimeType: "application/pdf",
    byteSize: 1234,
    storageKey: PRIVATE_KEY,
    createdAt: new Date("2026-11-05T10:00:00Z"),
    ...overrides,
  };
}
function task(id = TASK_ID, overrides: Row = {}): Row {
  return {
    id,
    eventId: scope.eventId,
    year: scope.year,
    task: "Aufgabe",
    contactId: null,
    helperId: null,
    deleted: false,
    ...overrides,
  };
}
function fixture(): State {
  return {
    events: [{ id: scope.eventId, year: scope.year, tenantId: scope.tenantId }],
    prep_tasks: [task()],
    post_tasks: [task(POST_TASK_ID)],
    task_documents: [document()],
    contacts: [
      {
        id: 10,
        eventId: scope.eventId,
        year: scope.year,
        name: "Identischer Name",
      },
    ],
    helpers: [
      {
        id: 11,
        eventId: scope.eventId,
        year: scope.year,
        name: "Identischer Name",
        contactId: 10,
      },
    ],
    planning_team_accesses: [{ id: 20, contactId: 10 }],
    users: [
      {
        id: 903,
        openId: planningTeamAccessOpenId(20),
        name: "Identischer Name",
      },
    ],
    finances: [{ id: 1, income: 7000, expense: 4500 }],
  };
}

/** Minimal fluent Drizzle fake, evaluating the SQL emitted by the real code.
 * It supports precisely these functions' AND/equality queries; unsupported SQL
 * fails rather than accidentally allowing a request. All state is in memory.
 */
function fakeDatabase(state: State) {
  const dialect = new MySqlDialect();
  const queries: QueryLog[] = [];
  const mutations: { table: string; values: Row }[] = [];
  const locks: { table: string; mode: string }[] = [];
  let failInsert = false;
  let beforeTransaction: (() => void) | undefined;
  function matches(query: QueryLog | undefined, row: Row) {
    if (!query) return true;
    const equalities = Array.from(
      query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)
    );
    if (
      /\bor\b/i.test(query.sql) ||
      equalities.length !== query.params.length
    ) {
      throw new Error(`Unsupported fake predicate: ${query.sql}`);
    }
    return equalities.every(
      (match, index) => row[match[1]] === query.params[index]
    );
  }
  const fake: any = {
    select(fields?: Record<string, { name: string }>) {
      let table = "";
      let condition: QueryLog | undefined;
      let maximum = Infinity;
      let ordered = false;
      const chain: any = {
        from(value: any) {
          table = getTableName(value);
          return chain;
        },
        where(value: SQL) {
          const compiled = dialect.sqlToQuery(value);
          condition = { table, sql: compiled.sql, params: compiled.params };
          queries.push(condition);
          return chain;
        },
        limit(value: number) {
          maximum = value;
          return chain;
        },
        orderBy() {
          ordered = true;
          return chain;
        },
        for(mode: string) {
          locks.push({ table, mode });
          return chain;
        },
        then(resolve: any, reject: any) {
          return Promise.resolve()
            .then(() => {
              let rows = (state[table] ?? []).filter(row =>
                matches(condition, row)
              );
              if (ordered) rows = [...rows].sort((a, b) => a.id - b.id);
              rows = rows.slice(0, maximum);
              return fields
                ? rows.map(row =>
                    Object.fromEntries(
                      Object.entries(fields).map(([key, column]) => [
                        key,
                        row[column.name],
                      ])
                    )
                  )
                : rows;
            })
            .then(resolve, reject);
        },
      };
      return chain;
    },
    insert(table: any) {
      const name = getTableName(table);
      return {
        values: async (values: Row) => {
          if (failInsert) throw new Error("Simulated insert failure");
          mutations.push({ table: name, values: { ...values } });
          const id = 1000;
          (state[name] ??= []).push({ id, createdAt: new Date(), ...values });
          return [{ insertId: id }];
        },
      };
    },
    async transaction(run: (tx: any) => any) {
      beforeTransaction?.();
      const before = structuredClone(state);
      try {
        return await run(fake);
      } catch (error) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, before);
        throw error;
      }
    },
  };
  return {
    db: fake,
    state,
    queries,
    mutations,
    locks,
    failInsert: () => {
      failInsert = true;
    },
    beforeTransaction: (run: () => void) => {
      beforeTransaction = run;
    },
  };
}
let memory: ReturnType<typeof fakeDatabase>;
let pdfBytes: Buffer;
let jpegBytes: Buffer;
let docxBytes: Buffer;
const documentContentType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
async function makeDocx(
  extra: Record<string, string | Buffer> = {},
  contentType = documentContentType
) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="${contentType}"/>
</Types>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Fixture</w:t></w:r></w:p></w:body>
</w:document>`
  );
  for (const [name, content] of Object.entries(extra)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer" });
}
function makeDoc(streams = ["WordDocument"]) {
  const container = CFB.utils.cfb_new();
  // Minimal structured-storage fixture, not a claim of a renderable Word file.
  for (const name of streams)
    CFB.utils.cfb_add(container, name, Buffer.alloc(32));
  return Buffer.from(CFB.write(container, { type: "buffer" }));
}
beforeAll(async () => {
  pdfBytes = await new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ compress: false });
    const chunks: Buffer[] = [];
    pdf.on("data", chunk => chunks.push(Buffer.from(chunk)));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.text("Task document test fixture");
    pdf.end();
  });
  jpegBytes = Buffer.from(
    jpeg.encode(
      {
        width: 2,
        height: 2,
        data: Buffer.from([
          255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
        ]),
      },
      80
    ).data
  );
  docxBytes = await makeDocx();
});
beforeEach(() => {
  vi.clearAllMocks();
  memory = fakeDatabase(fixture());
  vi.spyOn(db, "getDb").mockResolvedValue(memory.db);
});
afterEach(() => vi.restoreAllMocks());

async function expectBadFile(
  name: string,
  base64: string,
  kind: "document" | "receipt" = "document"
) {
  await expect(validateTaskFile(kind, name, base64)).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(db.getDb).not.toHaveBeenCalled();
  expect(storagePut).not.toHaveBeenCalled();
  expect(storageRead).not.toHaveBeenCalled();
}

describe("validateTaskFile — echte In-Memory-Dateien, keine DB/Storage-Zugriffe", () => {
  it.each(["document", "receipt"] as const)(
    "akzeptiert PDFKit-PDF als %s",
    async kind => {
      const result = await validateTaskFile(
        kind,
        "test.PDF",
        toBase64(pdfBytes)
      );
      expect(result).toEqual({
        bytes: pdfBytes,
        fileName: "test.PDF",
        mimeType: "application/pdf",
        ext: "pdf",
      });
      expect(db.getDb).not.toHaveBeenCalled();
      expect(storagePut).not.toHaveBeenCalled();
    }
  );
  it.each(["document", "receipt"] as const)(
    "akzeptiert geprüfte xrechnung.xml als %s und bewahrt das Original",
    async kind => {
      const original = readFileSync(
        "server/test-fixtures/pdf-policy/xrechnung-cii.pdf"
      );
      const result = await validateTaskFile(
        kind,
        "rechnung.pdf",
        toBase64(original)
      );
      expect(result.bytes).toEqual(original);
      expect(result.mimeType).toBe("application/pdf");
      expect(db.getDb).not.toHaveBeenCalled();
      expect(storagePut).not.toHaveBeenCalled();
    }
  );
  it.each(["jpg", "jpeg", "docx", "doc"])(
    "weist Beleg mit Nicht-PDF-Endung .%s zurück",
    async ext => {
      const bytes =
        ext === "docx" ? docxBytes : ext === "doc" ? makeDoc() : jpegBytes;
      await expectBadFile(`beleg.${ext}`, toBase64(bytes), "receipt");
    }
  );
  it.each(["", "!!!!", "YQ", "YQ==\n", " YQ==", "Y==="])(
    "weist leere/ungültige Base64-Daten %j zurück",
    async base64 => {
      await expectBadFile("test.pdf", base64);
    }
  );
  it("weist sowohl dekodierte Übergröße als auch überlanges Base64 vor dem Parsen zurück", async () => {
    await expectBadFile(
      "test.pdf",
      toBase64(Buffer.alloc(MAX_TASK_FILE_BYTES + 1))
    );
    await expectBadFile(
      "test.pdf",
      "A".repeat(Math.ceil(MAX_TASK_FILE_BYTES / 3) * 4 + 4)
    );
  });
  it.each(["txt", "png", "exe", "pdf.exe"])(
    "weist nicht erlaubte Endung %s auch bei echten PDF-Bytes zurück",
    async ext => {
      await expectBadFile(`test.${ext}`, toBase64(pdfBytes));
    }
  );
  it("vertraut keinem MIME-Data-URI oder einer vorgetäuschten PDF-Endung", async () => {
    await expectBadFile(
      "test.pdf",
      `data:application/pdf;base64,${toBase64(pdfBytes)}`
    );
    await expectBadFile("test.pdf", toBase64(jpegBytes));
    await expectBadFile("test.jpg", toBase64(pdfBytes));
    await expectBadFile("test.docx", toBase64(pdfBytes));
    await expectBadFile("test.doc", toBase64(pdfBytes));
  });
  it("weist PDF ohne EOF zurück", async () => {
    await expectBadFile(
      "test.pdf",
      toBase64(pdfBytes.subarray(0, pdfBytes.indexOf("%%EOF")))
    );
  });
  it.each([
    "dangerous-javascript.pdf",
    "escaped-javascript.pdf",
    "launch.pdf",
    "extra-attachment.pdf",
    "encrypted.pdf",
  ])(
    "weist echte gefährliche/verschlüsselte PDF %s zurück",
    async fixtureName => {
      const invalid = readFileSync(
        `server/test-fixtures/pdf-policy/${fixtureName}`
      );
      await expectBadFile("test.pdf", toBase64(invalid));
    }
  );
  it.each(["jpg", "jpeg"])(
    "akzeptiert jpeg-js-kodiertes .%s mit abgeleitetem MIME",
    async ext => {
      const result = await validateTaskFile(
        "document",
        `foto.${ext}`,
        toBase64(jpegBytes)
      );
      expect(result.bytes).toEqual(jpegBytes);
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.ext).toBe(ext);
    }
  );
  it("weist Fake-JPEG trotz Startmarker und abgeschnittenes echtes JPEG zurück", async () => {
    await expectBadFile(
      "fake.jpg",
      toBase64(Buffer.from([0xff, 0xd8, 0, 0, 0xff, 0xd9]))
    );
    await expectBadFile(
      "truncated.jpeg",
      toBase64(jpegBytes.subarray(0, Math.floor(jpegBytes.length / 2)))
    );
  });
  it("akzeptiert minimales JSZip-DOCX mit Dokument-Content-Type und word/document.xml", async () => {
    expect(
      await validateTaskFile("document", "test.docx", toBase64(docxBytes))
    ).toEqual({
      bytes: docxBytes,
      fileName: "test.docx",
      ext: "docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });
  it.each(["[Content_Types].xml", "word/document.xml"])(
    "weist DOCX ohne %s zurück",
    async part => {
      const zip = await JSZip.loadAsync(docxBytes);
      zip.remove(part);
      await expectBadFile(
        "test.docx",
        toBase64(await zip.generateAsync({ type: "nodebuffer" }))
      );
    }
  );
  it.each([
    "word/vbaProject.bin",
    "word/embeddings/object.bin",
    "word/activeX/control.xml",
  ])("weist aktive/eingebettete DOCX-Komponente %s zurück", async entry => {
    await expectBadFile(
      "test.docx",
      toBase64(await makeDocx({ [entry]: "fixture" }))
    );
  });
  it("weist makroaktivierten oder falschen Dokument-Content-Type zurück", async () => {
    for (const type of [
      "application/vnd.ms-word.document.macroEnabled.main+xml",
      "application/xml",
    ]) {
      await expectBadFile("test.docx", toBase64(await makeDocx({}, type)));
    }
  });
  it.each([
    'TargetMode="External"',
    "TargetMode = 'External'",
    'targetmode="external"',
  ])("weist externe DOCX-Beziehungen %s zurück", async attribute => {
    const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="image" Target="https://private.invalid/image" ${attribute}/></Relationships>`;
    await expectBadFile(
      "test.docx",
      toBase64(await makeDocx({ "word/_rels/document.xml.rels": rels }))
    );
  });
  it("weist beschädigten ZIP-Container zurück", async () => {
    await expectBadFile("test.docx", toBase64(docxBytes.subarray(0, 20)));
  });
  it("akzeptiert minimales CFB-.doc mit WordDocument-Stream", async () => {
    const bytes = makeDoc();
    expect(
      await validateTaskFile("document", "test.doc", toBase64(bytes))
    ).toEqual({
      bytes,
      fileName: "test.doc",
      mimeType: "application/msword",
      ext: "doc",
    });
  });
  it.each(["VBA/Module1", "Macros/Module1", "ObjectPool/Object1"])(
    "weist CFB-.doc mit %s zurück",
    async stream => {
      await expectBadFile(
        "test.doc",
        toBase64(makeDoc(["WordDocument", stream]))
      );
    }
  );
  it("weist CFB ohne WordDocument sowie bloßen/falschen CFB-Header zurück", async () => {
    await expectBadFile("test.doc", toBase64(makeDoc(["NotWordDocument"])));
    await expectBadFile(
      "test.doc",
      toBase64(Buffer.from("d0cf11e0a1b11ae1", "hex"))
    );
    await expectBadFile(
      "test.doc",
      toBase64(Buffer.from("not a compound file"))
    );
  });
  it("bereinigt Pfad-/Steuerzeichen und begrenzt den Dateinamen", async () => {
    const result = await validateTaskFile(
      "document",
      "../folder\\foto\n.jpg",
      toBase64(jpegBytes)
    );
    expect(result.fileName).toBe(".._folder_foto_.jpg");
    expect(result.fileName).not.toMatch(/[/\\\x00-\x1f\x7f]/);
    await expectBadFile(`${"a".repeat(201)}.jpg`, toBase64(jpegBytes));
  });
});

type AccessCase = {
  label: string;
  actor: TaskDocumentActor;
  file?: Partial<DocumentRow>;
  task?: Row;
  allowed: boolean;
};
const accessCases: AccessCase[] = [
  {
    label: "persönlicher Uploader",
    actor: actor(),
    file: { uploadedByUserId: 901 },
    allowed: true,
  },
  {
    label: "derselbe Uploader in geteiltem Zugang",
    actor: actor({ personalAccount: false }),
    file: { uploadedByUserId: 901 },
    allowed: false,
  },
  {
    label: "explizite persönliche Payer-User-ID",
    actor: actor(),
    file: { paidByUserId: 901 },
    allowed: true,
  },
  {
    label: "Payer-User-ID bei geteiltem Zugang",
    actor: actor({ personalAccount: false }),
    file: { paidByUserId: 901 },
    allowed: false,
  },
  {
    label: "explizite eigene Payer-Kontakt-ID",
    actor: actor({ ownContactIds: new Set([10]) }),
    file: { paidByContactId: 10 },
    allowed: true,
  },
  {
    label: "andere Payer-Kontakt-ID",
    actor: actor({ ownContactIds: new Set([10]) }),
    file: { paidByContactId: 12 },
    allowed: false,
  },
  {
    label: "Aufgabenverantwortung über eigene Kontakt-ID",
    actor: actor({ ownContactIds: new Set([10]) }),
    task: { contactId: 10 },
    allowed: true,
  },
  {
    label: "fremde Aufgabenverantwortung",
    actor: actor({ ownContactIds: new Set([10]) }),
    task: { contactId: 12 },
    allowed: false,
  },
  {
    label: "Finanzen schreiben",
    actor: actor({ financeWrite: true, personalAccount: false }),
    allowed: true,
  },
  {
    label: "Finanzen nur lesen: financeWrite=false",
    actor: actor({ financeWrite: false }),
    allowed: false,
  },
  {
    label: "Aufgaben schreiben allein",
    actor: actor({ taskWrite: true }),
    allowed: false,
  },
  {
    label: "nur beaufsichtigter zahlender Helfer",
    actor: actor({ ownContactIds: new Set([10]) }),
    file: { paidByHelperId: 11 },
    task: { helperId: 11 },
    allowed: false,
  },
  {
    label: "Helfer-ID gleich eigener User-ID ist keine Identität",
    actor: actor(),
    file: { paidByHelperId: 901 },
    allowed: false,
  },
  {
    label: "Helfer-ID gleich eigener Kontakt-ID ist keine Identität",
    actor: actor({ ownContactIds: new Set([11]) }),
    file: { paidByHelperId: 11 },
    allowed: false,
  },
  {
    label: "nur gleicher Name",
    actor: Object.assign(actor(), { name: "Identischer Name" }),
    file: { paidBy: "Identischer Name" },
    task: { responsible: "Identischer Name" },
    allowed: false,
  },
  {
    label: "unbeteiligter persönlicher Zugang",
    actor: actor(),
    allowed: false,
  },
];

describe("canReadTaskReceipt — Identitäts-/Rechtematrix, niemals Namens-/Betreuerinferenz", () => {
  it.each(accessCases)("$label => $allowed", entry => {
    expect(
      canReadTaskReceipt(
        entry.actor,
        document(entry.file),
        task(TASK_ID, entry.task)
      )
    ).toBe(entry.allowed);
  });
});

describe("list/download — dieselbe Belegmatrix und keine versteckten Metadaten", () => {
  it.each(accessCases)(
    "$label: Liste und Download stimmen überein",
    async entry => {
      const privateFile = document(entry.file);
      const publicFile = document({
        id: 43,
        kind: "document",
        title: "Allgemeines Dokument",
        fileName: "allgemein.pdf",
        paidBy: null,
        storageKey: "different-private-key",
      });
      memory.state.task_documents = [privateFile, publicFile];
      memory.state.prep_tasks = [task(TASK_ID, entry.task)];
      const listed = await inScope(() =>
        listTaskDocuments("prep", TASK_ID, entry.actor)
      );
      expect(listed.files.map(file => file.id)).toEqual(
        entry.allowed ? [42, 43] : [43]
      );
      expect(listed.files).toHaveLength(entry.allowed ? 2 : 1);
      expect(listed.canUploadDocuments).toBe(entry.actor.taskWrite);
      expect(listed.canUploadReceipts).toBe(true);
      expect(listed).not.toHaveProperty("totalCount");
      expect(listed).not.toHaveProperty("receiptCount");
      for (const metadata of listed.files) {
        expect(Object.keys(metadata).sort()).toEqual(
          [
            "id",
            "kind",
            "title",
            "paidBy",
            "fileName",
            "mimeType",
            "byteSize",
            "createdAt",
            "canDelete",
          ].sort()
        );
      }
      if (!entry.allowed) {
        const serialized = JSON.stringify(listed);
        for (const secret of [
          privateFile.title,
          privateFile.fileName,
          privateFile.paidBy!,
          PRIVATE_KEY,
        ]) {
          expect(serialized).not.toContain(secret);
        }
        await expect(
          inScope(() => downloadTaskDocument("prep", 42, entry.actor))
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
          message: "Datei wurde nicht gefunden.",
        });
        expect(storageRead).not.toHaveBeenCalled();
      } else {
        const downloaded = await inScope(() =>
          downloadTaskDocument("prep", 42, entry.actor)
        );
        expect(downloaded).toEqual({
          fileName: privateFile.fileName,
          mimeType: privateFile.mimeType,
          base64: toBase64(Buffer.from("private fixture contents")),
        });
        expect(storageRead).toHaveBeenCalledOnce();
        expect(storageRead).toHaveBeenCalledWith(PRIVATE_KEY);
        expect(downloaded).not.toHaveProperty("storageKey");
        expect(downloaded).not.toHaveProperty("url");
      }
      expect(storagePut).not.toHaveBeenCalled();
      expect(memory.mutations).toEqual([]);
    }
  );
  it("liefert bei ausschließlich versteckten Belegen keine Dateien/Belegzahlen und keine Bytes", async () => {
    const listed = await inScope(() =>
      listTaskDocuments("prep", TASK_ID, actor())
    );
    expect(listed).toMatchObject({
      files: [],
      canUploadDocuments: false,
      canUploadReceipts: true,
    });
    memory.state.task_documents = [];
    expect(
      await inScope(() => listTaskDocuments("prep", TASK_ID, actor()))
    ).toEqual(listed);
    expect(storageRead).not.toHaveBeenCalled();
  });
  it.each(["prep", "post"] as const)(
    "allgemeine Dokumente in %s sind ohne Finanzrechte lesbar, Belege nicht",
    async area => {
      const taskId = area === "prep" ? TASK_ID : POST_TASK_ID;
      memory.state.task_documents = [
        document({
          kind: "document",
          prepTaskId: area === "prep" ? taskId : null,
          postTaskId: area === "post" ? taskId : null,
        }),
      ];
      expect(
        (await inScope(() => listTaskDocuments(area, taskId, actor()))).files[0]
      ).toMatchObject({
        id: 42,
        kind: "document",
        canDelete: false,
      });
      await inScope(() => downloadTaskDocument(area, 42, actor()));
      expect(storageRead).toHaveBeenCalledOnce();
      expect(storageRead).toHaveBeenCalledWith(PRIVATE_KEY);
      memory.state.task_documents[0].kind = "receipt";
      vi.mocked(storageRead).mockClear();
      expect(
        (await inScope(() => listTaskDocuments(area, taskId, actor()))).files
      ).toEqual([]);
      await expect(
        inScope(() => downloadTaskDocument(area, 42, actor()))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(storageRead).not.toHaveBeenCalled();
    }
  );
});

describe("Scopes — SQL-begrenzte Listen/Downloads, aktive Aufgabe erforderlich", () => {
  const foreignScopes = [
    { label: "anderer Verein", overrides: { tenantId: "fremder-verein" } },
    { label: "anderes Event", overrides: { eventId: 82 } },
    { label: "anderes Jahr", overrides: { year: 2028 } },
  ];
  it.each(foreignScopes)(
    "$label: Dokument-ID und Metadaten bleiben unsichtbar",
    async ({ overrides }) => {
      memory.state.task_documents = [
        document({ ...overrides, kind: "document" }),
      ];
      const privileged = actor({ financeWrite: true, taskWrite: true });
      expect(
        (await inScope(() => listTaskDocuments("prep", TASK_ID, privileged)))
          .files
      ).toEqual([]);
      await expect(
        inScope(() => downloadTaskDocument("prep", 42, privileged))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(storageRead).not.toHaveBeenCalled();
      expect(
        memory.queries
          .filter(query => query.table === "task_documents")
          .map(query => query.params)
      ).toEqual([
        [scope.tenantId, scope.eventId, scope.year, TASK_ID],
        [scope.tenantId, scope.eventId, scope.year, 42],
      ]);
    }
  );
  it.each(foreignScopes)(
    "$label im Event-Gate verweigert sogar privilegierte Zugänge",
    async ({ overrides }) => {
      const eventOverrides = { ...overrides } as Row;
      if (eventOverrides.eventId) {
        eventOverrides.id = eventOverrides.eventId;
        delete eventOverrides.eventId;
      }
      Object.assign(memory.state.events[0], eventOverrides);
      const privileged = actor({ financeWrite: true });
      await expect(
        inScope(() => listTaskDocuments("prep", TASK_ID, privileged))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        inScope(() => downloadTaskDocument("prep", 42, privileged))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(memory.queries.every(query => query.table === "events")).toBe(
        true
      );
      expect(storageRead).not.toHaveBeenCalled();
    }
  );
  it.each(["prep", "post"] as const)(
    "%s prüft Event/Jahr und deleted=false am Task",
    async area => {
      const taskId = area === "prep" ? TASK_ID : POST_TASK_ID;
      const table = area === "prep" ? "prep_tasks" : "post_tasks";
      memory.state.task_documents = [
        document({
          prepTaskId: area === "prep" ? taskId : null,
          postTaskId: area === "post" ? taskId : null,
        }),
      ];
      for (const overrides of [
        { eventId: 82 },
        { year: 2028 },
        { deleted: true },
      ]) {
        memory.state[table] = [task(taskId, overrides)];
        await expect(
          inScope(() =>
            listTaskDocuments(area, taskId, actor({ financeWrite: true }))
          )
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(
          inScope(() =>
            downloadTaskDocument(area, 42, actor({ financeWrite: true }))
          )
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
      expect(storageRead).not.toHaveBeenCalled();
      for (const query of memory.queries.filter(
        query => query.table === table
      )) {
        expect(query.params).toEqual([
          taskId,
          scope.eventId,
          scope.year,
          false,
        ]);
        expect(query.sql).toContain("`deleted`");
      }
    }
  );
  it.each(["prep", "post"] as const)(
    "Datei aus dem jeweils anderen Bereich ist in %s nicht erreichbar",
    async requestedArea => {
      const taskId = requestedArea === "prep" ? TASK_ID : POST_TASK_ID;
      memory.state.task_documents = [
        document({
          kind: "document",
          prepTaskId: requestedArea === "post" ? TASK_ID : null,
          postTaskId: requestedArea === "prep" ? POST_TASK_ID : null,
        }),
      ];
      expect(
        (await inScope(() => listTaskDocuments(requestedArea, taskId, actor())))
          .files
      ).toEqual([]);
      await expect(
        inScope(() =>
          downloadTaskDocument(requestedArea, 42, actor({ financeWrite: true }))
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(storageRead).not.toHaveBeenCalled();
      expect(
        memory.queries.find(query => query.table === "task_documents")?.sql
      ).toContain(requestedArea === "prep" ? "`prepTaskId`" : "`postTaskId`");
    }
  );
  it("filtert fremde Task-ID aus Listen und verweigert fehlende IDs ohne Speicherzugriff", async () => {
    memory.state.task_documents = [
      document({ prepTaskId: 999, kind: "document" }),
    ];
    expect(
      (await inScope(() => listTaskDocuments("prep", TASK_ID, actor()))).files
    ).toEqual([]);
    await expect(
      inScope(() => downloadTaskDocument("prep", 42, actor()))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      inScope(() => downloadTaskDocument("prep", 999, actor()))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      inScope(() => listTaskDocuments("prep", 999, actor()))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageRead).not.toHaveBeenCalled();
  });
  it("prüft auf Nachbereitung ebenfalls Tenant, Event und Jahr", async () => {
    memory.state.task_documents = [
      document({
        kind: "document",
        prepTaskId: null,
        postTaskId: POST_TASK_ID,
      }),
      document({
        id: 43,
        kind: "document",
        prepTaskId: null,
        postTaskId: POST_TASK_ID,
        tenantId: "fremder-verein",
      }),
    ];
    expect(
      (
        await inScope(() => listTaskDocuments("post", POST_TASK_ID, actor()))
      ).files.map(file => file.id)
    ).toEqual([42]);
    await inScope(() => downloadTaskDocument("post", 42, actor()));
    expect(
      memory.queries
        .filter(query => query.table === "task_documents")
        .map(query => query.params)
    ).toEqual([
      [scope.tenantId, scope.eventId, scope.year, POST_TASK_ID],
      [scope.tenantId, scope.eventId, scope.year, 42],
    ]);
    expect(
      memory.queries
        .filter(query => query.table === "events")
        .every(
          query =>
            JSON.stringify(query.params) ===
            JSON.stringify([scope.eventId, scope.year, scope.tenantId])
        )
    ).toBe(true);
  });
});

function uploadInput(overrides: Row = {}) {
  return {
    area: "prep" as TaskDocumentArea,
    taskId: TASK_ID,
    kind: "receipt" as "document" | "receipt",
    title: "Ein Beleg, keine Buchung",
    paidByKey: "contact:10",
    fileName: "beleg.pdf",
    base64: toBase64(pdfBytes),
    ...overrides,
  };
}
describe("Upload — vertrauenswürdiger Actor, private Ablage und genau eine Datei ohne Betrag", () => {
  it.each([
    { area: "prep" as const, personalAccount: true },
    { area: "post" as const, personalAccount: true },
    { area: "prep" as const, personalAccount: false },
  ])(
    "$area / personalAccount=$personalAccount: Serveridentität statt gefälschtem Input",
    async ({ area, personalAccount }) => {
      const beforeFinance = structuredClone(memory.state.finances);
      const result = await inScope(() =>
        uploadTaskDocument(
          uploadInput({
            area,
            taskId: area === "prep" ? TASK_ID : POST_TASK_ID,
            uploadedByUserId: 666,
            paidByUserId: 666,
            paidBy: "Gefälschter Name",
            amount: 99999,
            income: 99999,
            expense: 99999,
            storageKey: "attacker-key",
            mimeType: "application/javascript",
          }),
          actor({ personalAccount })
        )
      );
      expect(result).toEqual({ id: 1000 });
      expect(Object.keys(result)).toEqual(["id"]);
      expect(memory.mutations).toHaveLength(1);
      expect(memory.mutations[0]).toEqual({
        table: "task_documents",
        values: {
          ...scope,
          prepTaskId: area === "prep" ? TASK_ID : null,
          postTaskId: area === "post" ? POST_TASK_ID : null,
          kind: "receipt",
          title: "Ein Beleg, keine Buchung",
          uploadedByUserId: personalAccount ? 901 : null,
          paidByUserId: 903,
          paidBy: "Identischer Name",
          paidByContactId: 10,
          paidByHelperId: null,
          fileName: "beleg.pdf",
          mimeType: "application/pdf",
          byteSize: pdfBytes.length,
          storageKey: expect.stringMatching(
            /^task-documents\/fixture-verein\/2027\/81\/[a-f0-9-]+\.pdf$/
          ),
        },
      });
      expect(memory.state.finances).toEqual(beforeFinance);
      expect(storagePut).toHaveBeenCalledOnce();
      expect(storagePut).toHaveBeenCalledWith(
        memory.mutations[0].values.storageKey,
        pdfBytes,
        "application/pdf"
      );
      expect(storageDelete).not.toHaveBeenCalled();
      expect(memory.locks).toEqual([
        { table: "events", mode: "update" },
        {
          table: area === "prep" ? "prep_tasks" : "post_tasks",
          mode: "update",
        },
      ]);
      for (const query of memory.queries.filter(query =>
        ["contacts", "helpers"].includes(query.table)
      )) {
        expect(query.params).toEqual([scope.eventId, scope.year]);
      }
      const uploader = actor({ personalAccount });
      const listed = await inScope(() =>
        listTaskDocuments(
          area,
          area === "prep" ? TASK_ID : POST_TASK_ID,
          uploader
        )
      );
      expect(listed.files.some(file => file.id === 1000)).toBe(personalAccount);
      expect(JSON.stringify(listed)).not.toContain("task-documents/");
      expect(JSON.stringify(listed)).not.toContain("storage.invalid");
    }
  );
  it("gleichnamiger Helfer liefert keine Payer-User/Kontakt-Identität seines Betreuers", async () => {
    await inScope(() =>
      uploadTaskDocument(uploadInput({ paidByKey: "helper:11" }), actor())
    );
    expect(memory.mutations[0].values).toMatchObject({
      paidByHelperId: 11,
      paidByContactId: null,
      paidByUserId: null,
      paidBy: "Identischer Name",
    });
    expect(
      memory.queries.some(query =>
        ["planning_team_accesses", "users"].includes(query.table)
      )
    ).toBe(false);
    const supervisor = actor({ userId: 904, ownContactIds: new Set([10]) });
    expect(
      (await inScope(() => listTaskDocuments("prep", TASK_ID, supervisor)))
        .files
    ).toEqual([]);
    await expect(
      inScope(() => downloadTaskDocument("prep", 1000, supervisor))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageRead).not.toHaveBeenCalled();
  });
  it("weist Dokumentupload ohne taskWrite zurück, bevor Bytes gespeichert werden", async () => {
    await expect(
      inScope(() =>
        uploadTaskDocument(uploadInput({ kind: "document" }), actor())
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
    expect(memory.mutations).toEqual([]);
  });
  it("erlaubt allgemeinen Dokumentupload mit taskWrite, ohne Payer-/Finanzbuchung", async () => {
    await inScope(() =>
      uploadTaskDocument(
        uploadInput({ kind: "document" }),
        actor({ taskWrite: true })
      )
    );
    expect(memory.mutations).toHaveLength(1);
    expect(memory.mutations[0].values).toMatchObject({
      kind: "document",
      uploadedByUserId: 901,
      paidByUserId: null,
      paidByContactId: null,
      paidByHelperId: null,
      paidBy: null,
    });
    expect(
      memory.queries.some(query =>
        ["contacts", "helpers"].includes(query.table)
      )
    ).toBe(false);
  });
  it("weist Payer aus fremdem Event/Jahr zurück, selbst bei identischem Namen", async () => {
    memory.state.contacts[0].eventId = 82;
    memory.state.helpers[0].year = 2028;
    for (const paidByKey of ["contact:10", "helper:11", "contact:999"]) {
      await expect(
        inScope(() => uploadTaskDocument(uploadInput({ paidByKey }), actor()))
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(storagePut).not.toHaveBeenCalled();
    expect(memory.mutations).toEqual([]);
  });
  it("weist ungültige Bytes ohne Storage-Put oder DB-Insert zurück", async () => {
    await expect(
      inScope(() =>
        uploadTaskDocument(
          uploadInput({ base64: toBase64(jpegBytes) }),
          actor()
        )
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storagePut).not.toHaveBeenCalled();
    expect(memory.mutations).toEqual([]);
  });
  it("erneut softgelöschte Aufgabe unter Lock: keine Metadaten, private Datei wird aufgeräumt", async () => {
    memory.beforeTransaction(() => {
      memory.state.prep_tasks[0].deleted = true;
    });
    await expect(
      inScope(() => uploadTaskDocument(uploadInput(), actor()))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(memory.mutations).toEqual([]);
    expect(storageDelete).toHaveBeenCalledOnce();
    expect(storageDelete).toHaveBeenCalledWith(
      vi.mocked(storagePut).mock.calls[0][0]
    );
  });
  it("Eventkontingent über 250 MiB: keine Buchung/Metadaten und Storage-Cleanup", async () => {
    memory.state.task_documents[0].byteSize = 250 * 1024 * 1024;
    await expect(
      inScope(() => uploadTaskDocument(uploadInput(), actor()))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(memory.mutations).toEqual([]);
    expect(storageDelete).toHaveBeenCalledOnce();
    expect(storageDelete).toHaveBeenCalledWith(
      vi.mocked(storagePut).mock.calls[0][0]
    );
  });
  it("fehlgeschlagener In-Memory-Insert entfernt die zuvor privat abgelegte Datei", async () => {
    memory.failInsert();
    await expect(
      inScope(() => uploadTaskDocument(uploadInput(), actor()))
    ).rejects.toThrow("Simulated insert failure");
    expect(memory.state.task_documents).toHaveLength(1);
    expect(storageDelete).toHaveBeenCalledOnce();
    expect(storageDelete).toHaveBeenCalledWith(
      vi.mocked(storagePut).mock.calls[0][0]
    );
  });
});
