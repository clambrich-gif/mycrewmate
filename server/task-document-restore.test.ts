import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getCurrentTenantProductEntitlement: vi.fn(),
  storageDelete: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getCurrentTenantProductEntitlement: mocks.getCurrentTenantProductEntitlement,
}));
vi.mock("./storage", () => ({ storageDelete: mocks.storageDelete }));

import {
  detachTaskDocumentsForRestore,
  exportBackupExcel,
  parseBackupWorkbook,
  previewProjectDocument,
  reattachTaskDocumentsAfterRestore,
  restoreProjectDocument,
  stableTaskDocumentRestoreIds,
  taskDocumentRestoreReferences,
  type TaskDocumentRestoreMaps,
} from "./excel-backup";
import { withPlanningScope } from "./year-context";
import type { taskDocuments } from "../drizzle/schema";

type DocumentRow = typeof taskDocuments.$inferSelect;
type State = Record<string, Array<Record<string, any>>>;
const scope = { tenantId: "fixture-verein", eventId: 81, year: 2027 };
const inScope = <T>(fn: () => T) => withPlanningScope(scope, fn);
const actor = {
  userId: 901,
  name: "Admin",
  role: "admin",
  loginMethod: "password",
} as const;
const emptyMaps = (): TaskDocumentRestoreMaps => ({
  prep: new Map(),
  post: new Map(),
  contacts: new Map(),
  helpers: new Map(),
});
function document(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 42,
    ...scope,
    prepTaskId: 70,
    postTaskId: null,
    kind: "receipt",
    title: "Originalbeleg",
    uploadedByUserId: 901,
    paidByContactId: 10,
    paidByHelperId: null,
    paidBy: "Chris Leitung",
    fileName: "beleg.pdf",
    mimeType: "application/pdf",
    byteSize: 24,
    storageKey: "task-documents/fixture-verein/2027/81/private.pdf",
    createdAt: new Date("2026-11-05T10:00:00Z"),
    // Auch vor der parallelen Schema-Ergänzung wird dieses unveränderte Feld geprüft.
    paidByUserId: 902,
    ...overrides,
  } as DocumentRow;
}
function task(id: number, name: string, extra = {}) {
  return {
    id,
    eventId: scope.eventId,
    year: scope.year,
    task: name,
    category: "",
    dueText: "",
    locationId: null,
    contactId: null,
    helperId: null,
    status: "offen",
    note: null,
    sortOrder: 0,
    deleted: false,
    ...extra,
  };
}
function helper(id: number, name: string) {
  return {
    id,
    eventId: scope.eventId,
    year: scope.year,
    contactId: 10,
    name,
    email: null,
    phone: null,
    note: null,
    companion: null,
    willHelp: "ja",
    availMon: "vielleicht",
    availTue: "vielleicht",
    availWed: "vielleicht",
    availThu: "vielleicht",
    availFri: "ja",
    availSat: "ja",
    availSun: "ja",
    confirmed: "nein",
    birthDate: null,
  };
}
function fixture(): State {
  return {
    event_years: [{ year: scope.year }],
    events: [
      {
        id: scope.eventId,
        year: scope.year,
        name: "MyEifelRide",
        tenantId: scope.tenantId,
        activeDays: ["Freitag", "Samstag", "Sonntag"],
        startDate: "2027-06-18",
        endDate: "2027-06-20",
        donationTargetKuchen: 0,
        donationTargetSalat: 0,
        donationTargetSnack: 0,
        donationTargetSonstiges: 0,
        pdfLogoKey: null,
        pdfLogoUrl: null,
        pdfLogoFallback: "none",
      },
    ],
    contacts: [
      {
        id: 10,
        year: scope.year,
        eventId: scope.eventId,
        name: "Chris Leitung",
        email: null,
        phone: null,
        note: null,
        sortOrder: 0,
      },
    ],
    helpers: [helper(20, "Chris Leitung"), helper(21, "Alex Beispiel")],
    prep_tasks: [task(70, "Aufbauen", { statusWording: "aufgabe" })],
    post_tasks: [task(71, "Abbauen")],
    finances: [
      {
        id: 60,
        year: scope.year,
        eventId: scope.eventId,
        category: "Startgeld",
        income: 1000,
        expense: 0,
        note: null,
        sortOrder: 0,
      },
    ],
    task_documents: [
      document(),
      document({
        id: 43,
        prepTaskId: null,
        postTaskId: 71,
        paidByContactId: null,
        paidByHelperId: 21,
        paidBy: "Alex Beispiel",
      }),
    ],
    prep_task_helpers: [],
    post_task_helpers: [],
    locations: [],
    shifts: [],
    assignments: [],
    shift_area_contacts: [],
    materials: [],
    marketing: [],
    approvals: [],
    cakes: [],
    planning_team_accesses: [],
    users: [],
    backup_restore_logs: [],
  };
}

/** In-memory transaction with FK effects; never connects to a real database. */
function fakeDatabase(initial: State) {
  let state = structuredClone(initial);
  let nextId = 1000;
  let failOnInsert: string | null = null;
  const operations: Array<{
    kind: string;
    table: string;
    values?: any;
    query?: string;
    params?: unknown[];
  }> = [];
  const dialect = new MySqlDialect();
  function matches(condition: any, row: Record<string, any>) {
    if (!condition) return true;
    const query = dialect.sqlToQuery(condition);
    const equalities = Array.from(
      query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)
    );
    return equalities.every(match => {
      const paramIndex = (query.sql.slice(0, match.index).match(/\?/g) ?? [])
        .length;
      const expected = query.params[paramIndex];
      return row[match[1]] === expected;
    });
  }
  const db: any = {
    select(fields?: Record<string, any>) {
      let table = "";
      let condition: any;
      let max = Infinity;
      const chain: any = {
        from(value: any) {
          table = getTableName(value);
          return chain;
        },
        where(value: any) {
          condition = value;
          return chain;
        },
        limit(value: number) {
          max = value;
          return chain;
        },
        orderBy() {
          return chain;
        },
        for(lock: string) {
          operations.push({ kind: `lock:${lock}`, table });
          return chain;
        },
        getSQL: () => sql`select id from shifts`,
        then(resolve: any, reject: any) {
          const rows = (state[table] ?? [])
            .filter(row => matches(condition, row))
            .slice(0, max);
          const projected = fields
            ? rows.map(row =>
                Object.fromEntries(
                  Object.entries(fields).map(([key, column]) => [
                    key,
                    row[column.name],
                  ])
                )
              )
            : rows;
          return Promise.resolve(structuredClone(projected)).then(
            resolve,
            reject
          );
        },
      };
      return chain;
    },
    update(table: any) {
      const name = getTableName(table);
      return {
        set: (values: any) => ({
          where: async (condition: any) => {
            const query = dialect.sqlToQuery(condition);
            operations.push({
              kind: "update",
              table: name,
              values: structuredClone(values),
              query: query.sql,
              params: query.params,
            });
            for (const row of state[name] ?? [])
              if (matches(condition, row)) Object.assign(row, values);
          },
        }),
      };
    },
    delete(table: any) {
      const name = getTableName(table);
      return {
        where: async (condition: any) => {
          operations.push({ kind: "delete", table: name });
          const removed = (state[name] ?? []).filter(row =>
            matches(condition, row)
          );
          const ids = new Set(removed.map(row => row.id));
          state[name] = (state[name] ?? []).filter(
            row => !matches(condition, row)
          );
          const taskColumn =
            name === "prep_tasks"
              ? "prepTaskId"
              : name === "post_tasks"
                ? "postTaskId"
                : null;
          if (taskColumn) {
            state.task_documents = state.task_documents.filter(
              row => !ids.has(row[taskColumn])
            );
            const links =
              name === "prep_tasks" ? "prep_task_helpers" : "post_task_helpers";
            state[links] = state[links].filter(
              row => !ids.has(row[taskColumn])
            );
          }
          if (name === "contacts" || name === "helpers") {
            const field =
              name === "contacts" ? "paidByContactId" : "paidByHelperId";
            for (const row of state.task_documents)
              if (ids.has(row[field])) row[field] = null;
          }
        },
      };
    },
    insert(table: any) {
      const name = getTableName(table);
      return {
        values: async (value: any) => {
          operations.push({
            kind: "insert",
            table: name,
            values: structuredClone(value),
          });
          if (name === failOnInsert)
            throw new Error(`Simulated ${name} insert failure`);
          const rows = Array.isArray(value) ? value : [value];
          const inserted = rows.map(row => ({
            id: row.id ?? nextId++,
            ...(name === "prep_tasks" || name === "post_tasks"
              ? { deleted: false }
              : {}),
            ...row,
          }));
          (state[name] ??= []).push(...inserted);
          return [{ insertId: inserted[0]?.id }];
        },
      };
    },
    async transaction(run: (tx: any) => any) {
      const before = structuredClone(state);
      try {
        return await run(db);
      } catch (error) {
        state = before;
        throw error;
      }
    },
  };
  return {
    db,
    operations,
    state: () => state,
    failInsert: (table: string) => {
      failOnInsert = table;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentTenantProductEntitlement.mockResolvedValue({
    packageId: "pro",
    entitlements: {
      maxContactsPerEvent: null,
      maxLocationsPerEvent: null,
      maxHelpersPerEvent: null,
    },
  });
});

describe("technical task-document restore identity", () => {
  it("reattaches changed task and payer IDs through exact original IDs", () => {
    const maps = {
      prep: stableTaskDocumentRestoreIds(new Set([70]), [
        { sourceId: 70, actualId: 700 },
      ]),
      post: stableTaskDocumentRestoreIds(new Set([71]), [
        { sourceId: 71, actualId: 710 },
      ]),
      contacts: stableTaskDocumentRestoreIds(new Set([10]), [
        { sourceId: 10, actualId: 100 },
      ]),
      helpers: stableTaskDocumentRestoreIds(new Set([21]), [
        { sourceId: 21, actualId: 210 },
      ]),
    };
    expect(taskDocumentRestoreReferences(document(), maps)).toEqual({
      prepTaskId: 700,
      postTaskId: null,
      paidByContactId: 100,
      paidByHelperId: null,
    });
    expect(
      taskDocumentRestoreReferences(
        document({
          prepTaskId: null,
          postTaskId: 71,
          paidByContactId: null,
          paidByHelperId: 21,
        }),
        maps
      )
    ).toEqual({
      prepTaskId: null,
      postTaskId: 710,
      paidByContactId: null,
      paidByHelperId: 210,
    });
  });

  it("rejects foreign, other-area, soft-deleted and duplicate numeric identities", () => {
    const maps = emptyMaps();
    maps.prep = stableTaskDocumentRestoreIds(new Set([70]), [
      { sourceId: 999, actualId: 70 }, // Foreign input must not inherit ID 70.
      { sourceId: 71, actualId: 700 }, // Existing only in the other area.
      { sourceId: 72, actualId: 720 }, // Soft-deleted: absent from the active snapshot.
      { sourceId: null, actualId: 70 },
    ]);
    expect(maps.prep.size).toBe(0);
    expect(
      taskDocumentRestoreReferences(document(), maps).prepTaskId
    ).toBeNull();
    expect(
      stableTaskDocumentRestoreIds(new Set([70]), [
        { sourceId: 70, actualId: 700 },
        { sourceId: 70, actualId: 701 },
      ]).size
    ).toBe(0);
  });

  it("never falls back to task/person names or a preserved ID matched by name", () => {
    const sameNameTarget = { sourceId: null, actualId: 700, task: "Aufbauen" };
    const sameNamePayer = {
      sourceId: 999,
      actualId: 10,
      name: "Chris Leitung",
    };
    const maps = {
      ...emptyMaps(),
      prep: stableTaskDocumentRestoreIds(new Set([70]), [sameNameTarget]),
      contacts: stableTaskDocumentRestoreIds(new Set([10]), [sameNamePayer]),
    };
    expect(taskDocumentRestoreReferences(document(), maps)).toEqual({
      prepTaskId: null,
      postTaskId: null,
      paidByContactId: null,
      paidByHelperId: null,
    });
    maps.prep.set(70, 700);
    expect(
      taskDocumentRestoreReferences(document(), maps).paidByContactId
    ).toBeNull();
  });

  it("leaves invalid double-task attachments inaccessible", () => {
    const maps = {
      ...emptyMaps(),
      prep: new Map([[70, 70]]),
      post: new Map([[71, 71]]),
    };
    expect(
      taskDocumentRestoreReferences(document({ postTaskId: 71 }), maps)
    ).toEqual({
      prepTaskId: null,
      postTaskId: null,
      paidByContactId: null,
      paidByHelperId: null,
    });
  });

  it("detaches and reattaches only tenant/event/year scoped rows, preserving all other metadata", async () => {
    const rows = [
      document(),
      document({ id: 50, tenantId: "other-verein" }),
      document({ id: 51, eventId: 82 }),
      document({ id: 52, year: 2028 }),
    ];
    const fake = fakeDatabase({ ...fixture(), task_documents: rows });
    const snapshot = await detachTaskDocumentsForRestore(fake.db, scope);
    expect(snapshot).toEqual([rows[0]]);
    expect(fake.state().task_documents[0]).toEqual({
      ...rows[0],
      prepTaskId: null,
      paidByContactId: null,
      paidByHelperId: null,
    });
    expect(fake.state().task_documents.slice(1)).toEqual(rows.slice(1));
    await reattachTaskDocumentsAfterRestore(fake.db, scope, rows, {
      ...emptyMaps(),
      prep: new Map([[70, 700]]),
      contacts: new Map([[10, 100]]),
    });
    expect(fake.state().task_documents[0]).toEqual({
      ...rows[0],
      prepTaskId: 700,
      paidByContactId: 100,
    });
    expect(fake.state().task_documents.slice(1)).toEqual(rows.slice(1));
    const updates = fake.operations.filter(op => op.kind === "update");
    expect(updates).toHaveLength(2);
    for (const op of updates) {
      expect(op.query).toContain("`tenantId` = ?");
      expect(op.query).toContain("`eventId` = ?");
      expect(op.query).toContain("`year` = ?");
      expect(op.params?.slice(0, 3)).toEqual([
        scope.tenantId,
        scope.eventId,
        scope.year,
      ]);
      expect(Object.keys(op.values).sort()).toEqual([
        "paidByContactId",
        "paidByHelperId",
        "postTaskId",
        "prepTaskId",
      ]);
    }
    expect(fake.operations[0]).toEqual({
      kind: "lock:update",
      table: "task_documents",
    });
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });
});

async function restoreFixture(
  fake: ReturnType<typeof fakeDatabase>,
  change: (document: ReturnType<typeof parseBackupWorkbook>) => void,
  select?: (
    changes: Awaited<ReturnType<typeof previewProjectDocument>>["changes"]
  ) => string[]
) {
  mocks.getDb.mockResolvedValue(fake.db);
  return inScope(async () => {
    const exported = await exportBackupExcel();
    const target = parseBackupWorkbook(exported.buffer.toString("base64"));
    change(target);
    const preview = await previewProjectDocument(target, "fixture-digest");
    return restoreProjectDocument(
      target,
      "fixture-digest",
      "fixture.xlsx",
      preview.currentDigest,
      actor,
      select?.(preview.changes)
    );
  });
}

describe("restoreProjectDocument attachment transaction (no live DB)", () => {
  it("preserves prep/post documents and payer/user metadata on an unrelated finance-only import", async () => {
    const fake = fakeDatabase(fixture());
    const before = structuredClone(fake.state().task_documents);
    await restoreFixture(fake, target => {
      target.finances[0].income = 2000;
    });
    expect(fake.state().task_documents).toEqual(before);
    expect(fake.state().finances[0].income).toBe(2000);
    const detach = fake.operations.findIndex(
      op => op.kind === "update" && op.table === "task_documents"
    );
    for (const table of ["prep_tasks", "post_tasks", "contacts", "helpers"])
      expect(detach).toBeLessThan(
        fake.operations.findIndex(
          op => op.kind === "delete" && op.table === table
        )
      );
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it("uses the selected target, not unselected task deletions in a partial import", async () => {
    const fake = fakeDatabase(fixture());
    const before = structuredClone(fake.state().task_documents);
    await restoreFixture(
      fake,
      target => {
        target.prep = [];
        target.post = [];
        target.finances[0].income = 2000;
      },
      changes =>
        changes
          .filter(change => change.area === "FINANZEN")
          .map(change => change.key)
    );
    expect(fake.state().task_documents).toEqual(before);
    expect(fake.state().prep_tasks[0].id).toBe(70);
    expect(fake.state().post_tasks[0].id).toBe(71);
  });

  it("leaves soft-deleted task documents detached without attaching to a same-name replacement", async () => {
    const initial = fixture();
    initial.prep_tasks.push(
      task(72, "Aufbauen", { deleted: true, statusWording: "aufgabe" })
    );
    initial.task_documents.push(document({ id: 44, prepTaskId: 72 }));
    const fake = fakeDatabase(initial);
    await restoreFixture(fake, target => {
      target.finances[0].income = 2000;
    });
    expect(
      fake.state().task_documents.find(row => row.id === 44)
    ).toMatchObject({
      prepTaskId: null,
      postTaskId: null,
      paidByContactId: null,
      paidByHelperId: null,
      storageKey: initial.task_documents[2].storageKey,
    });
    expect(
      fake.state().task_documents.find(row => row.id === 42)?.prepTaskId
    ).toBe(70);
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it("does not move an old document onto a same-name task with a foreign source ID", async () => {
    const fake = fakeDatabase(fixture());
    const before = structuredClone(fake.state());
    await expect(
      restoreFixture(fake, target => {
        target.prep[0].sourceId = 9999;
        target.finances[0].income = 2000;
      })
    ).rejects.toThrow("Der Import würde vorhandene Belege oder Dokumente");
    expect(fake.state()).toEqual(before);
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it("rolls back an import that would silently remove an active attachment's task", async () => {
    const fake = fakeDatabase(fixture());
    const before = structuredClone(fake.state());
    await expect(
      restoreFixture(fake, target => {
        target.prep = [];
      })
    ).rejects.toThrow("Es wurden keine Änderungen übernommen");
    expect(fake.state()).toEqual(before);
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it.each(["prep_tasks", "backup_restore_logs"])(
    "rolls back attachment detach/reattach and all rows after %s failure",
    async failure => {
      const initial = fixture();
      const fake = fakeDatabase(initial);
      fake.failInsert(failure);
      await expect(
        restoreFixture(fake, target => {
          target.finances[0].income = 2000;
        })
      ).rejects.toThrow("Simulated");
      expect(fake.state()).toEqual(initial);
      expect(
        fake.operations.some(
          op => op.table === "task_documents" && op.kind === "update"
        )
      ).toBe(true);
      if (failure === "backup_restore_logs") {
        expect(
          fake.operations.filter(
            op => op.table === "task_documents" && op.kind === "update"
          )
        ).toHaveLength(3);
      }
      expect(mocks.storageDelete).not.toHaveBeenCalled();
    }
  );
});
