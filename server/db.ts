import { and, eq, getTableColumns, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appSettings,
  approvals,
  assignments,
  cakes,
  contacts,
  eventYears,
  finances,
  helpers,
  InsertUser,
  marketing,
  materials,
  postTasks,
  prepTasks,
  securitySettings,
  shifts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { currentEventYear } from "./year-context";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] === undefined) continue;
    const value = user[field] ?? null;
    values[field] = value;
    updateSet[field] = value;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

type DB = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const year = () => currentEventYear();

export function normalizePersonName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");
}

export async function listEventYears() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventYears).orderBy(eventYears.year);
}

export async function ensureEventYear(eventYear = year()) {
  const db = (await getDb()) as DB;
  await db
    .insert(eventYears)
    .values({ year: eventYear, label: `MyEifelRide ${eventYear}` })
    .onDuplicateKeyUpdate({ set: { label: `MyEifelRide ${eventYear}` } });
  return eventYear;
}

export async function listContacts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.year, year()))
    .orderBy(contacts.sortOrder, contacts.name);
}
export async function listHelpers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(helpers)
    .where(eq(helpers.year, year()))
    .orderBy(helpers.name);
}
export async function listShifts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shifts)
    .where(eq(shifts.year, year()))
    .orderBy(shifts.sortOrder, shifts.id);
}
export async function listAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ ...getTableColumns(assignments) })
    .from(assignments)
    .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
    .where(eq(shifts.year, year()));
}
export async function listPrep() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(prepTasks)
    .where(eq(prepTasks.year, year()))
    .orderBy(prepTasks.sortOrder, prepTasks.id);
}
export async function listPost() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(postTasks)
    .where(eq(postTasks.year, year()))
    .orderBy(postTasks.sortOrder, postTasks.id);
}
export async function listMaterials() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(materials)
    .where(eq(materials.year, year()))
    .orderBy(materials.sortOrder, materials.id);
}
export async function listMarketing() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(marketing)
    .where(eq(marketing.year, year()))
    .orderBy(marketing.sortOrder, marketing.id);
}
export async function listApprovals() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(approvals)
    .where(eq(approvals.year, year()))
    .orderBy(approvals.sortOrder, approvals.id);
}
export async function listCakes() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cakes)
    .where(eq(cakes.year, year()))
    .orderBy(cakes.sortOrder, cakes.id);
}
export async function listFinances() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(finances)
    .where(eq(finances.year, year()))
    .orderBy(finances.sortOrder, finances.id);
}
export async function getAppSettings() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  return result[0];
}
export async function getSecuritySettings() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(securitySettings)
    .where(eq(securitySettings.id, 1))
    .limit(1);
  return result[0];
}

export async function createContact(v: {
  name: string;
  phone?: string;
  note?: string;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const normalizedName = v.name.trim().replace(/\s+/g, " ");
    const result: any = await tx
      .insert(contacts)
      .values({ ...v, name: normalizedName, year: year() });
    const id = Number(result?.[0]?.insertId ?? result?.insertId);
    const helper = await syncContactToSelfHelperWithClient(tx, {
      id,
      name: normalizedName,
      phone: v.phone ?? null,
    });
    return { id, helperId: helper.id, helperCreated: helper.created };
  });
}
export async function updateContact(
  id: number,
  v: { name?: string; phone?: string | null; note?: string | null }
) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [before] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.year, year())))
      .limit(1);
    if (!before) throw new Error("Ansprechpartner wurde nicht gefunden");
    const values = {
      ...v,
      ...(v.name ? { name: v.name.trim().replace(/\s+/g, " ") } : {}),
    };
    const contact = { ...before, ...values };
    const result = await tx
      .update(contacts)
      .set(values)
      .where(and(eq(contacts.id, id), eq(contacts.year, year())));
    await syncContactToSelfHelperWithClient(tx, contact, before.name);
    return result;
  });
}
export async function deleteContact(id: number) {
  const db = (await getDb()) as DB;
  return db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.year, year())));
}

export async function upsertContactByName(v: {
  name: string;
  phone?: string | null;
  note?: string | null;
}) {
  const existing = (await listContacts()).find(
    item => normalizePersonName(item.name) === normalizePersonName(v.name)
  );
  if (existing) {
    const updates = {
      ...(v.phone ? { phone: v.phone } : {}),
      ...(v.note ? { note: v.note } : {}),
    };
    if (Object.keys(updates).length) await updateContact(existing.id, updates);
    const helper = await syncContactToSelfHelper({
      ...existing,
      phone: v.phone || existing.phone,
    });
    return {
      id: existing.id,
      created: false,
      helperId: helper.id,
      helperCreated: helper.created,
    };
  }
  const result = await createContact({
    name: v.name.trim().replace(/\s+/g, " "),
    phone: v.phone ?? undefined,
    note: v.note ?? undefined,
  });
  return {
    id: result.id,
    created: true,
    helperId: result.helperId,
    helperCreated: result.helperCreated,
  };
}

export async function createHelper(
  v: Partial<typeof helpers.$inferInsert> & { name: string }
) {
  const db = (await getDb()) as DB;
  return db
    .insert(helpers)
    .values({ ...v, year: year() } as typeof helpers.$inferInsert);
}
export async function updateHelper(
  id: number,
  v: Partial<typeof helpers.$inferInsert>
) {
  const db = (await getDb()) as DB;
  const { year: ignored, ...safe } = v;
  return db.transaction(async tx => {
    const [helper] = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.id, id), eq(helpers.year, year())))
      .limit(1);
    if (!helper) throw new Error("Helfer wurde nicht gefunden");
    const selfContact = helper.contactId
      ? (
          await tx
            .select()
            .from(contacts)
            .where(
              and(eq(contacts.id, helper.contactId), eq(contacts.year, year()))
            )
            .limit(1)
        )[0]
      : undefined;
    const isSelfHelper =
      selfContact &&
      normalizePersonName(selfContact.name) ===
        normalizePersonName(helper.name);
    if (
      isSelfHelper &&
      ((safe.contactId !== undefined && safe.contactId !== helper.contactId) ||
        (safe.name !== undefined &&
          normalizePersonName(safe.name) !== normalizePersonName(helper.name)))
    ) {
      throw new Error(
        "Der eigene Helfereintrag eines Ansprechpartners kann nicht umgehängt oder umbenannt werden"
      );
    }
    return tx
      .update(helpers)
      .set(safe)
      .where(and(eq(helpers.id, id), eq(helpers.year, year())));
  });
}
export async function deleteHelper(
  id: number,
  options: { allowAssigned?: boolean } = {}
) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [helper] = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.id, id), eq(helpers.year, year())))
      .limit(1);
    if (!helper) throw new Error("Helfer wurde nicht gefunden");
    if (!options.allowAssigned) {
      const [assignment] = await tx
        .select({ id: assignments.id })
        .from(assignments)
        .where(eq(assignments.helperId, id))
        .limit(1);
      if (assignment) {
        throw new Error(
          "Dieser Helfer ist im Einsatzplan eingeteilt und kann nur von einem Administrator gelöscht werden"
        );
      }
    }
    if (helper.contactId) {
      const [contact] = await tx
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, helper.contactId), eq(contacts.year, year()))
        )
        .limit(1);
      if (
        contact &&
        normalizePersonName(contact.name) === normalizePersonName(helper.name)
      ) {
        throw new Error(
          "Dieser Helfer gehört zum gleichnamigen Ansprechpartner. Löschen Sie zuerst den Ansprechpartner."
        );
      }
    }
    return tx
      .delete(helpers)
      .where(and(eq(helpers.id, id), eq(helpers.year, year())));
  });
}
export async function upsertHelperByName(
  v: Partial<typeof helpers.$inferInsert> & { name: string }
) {
  const existing = (await listHelpers()).find(
    item => normalizePersonName(item.name) === normalizePersonName(v.name)
  );
  if (existing) {
    const { name: ignored, year: ignoredYear, ...updates } = v;
    if (Object.keys(updates).length) await updateHelper(existing.id, updates);
    return { id: existing.id, created: false };
  }
  const result: any = await createHelper({
    ...v,
    name: v.name.trim().replace(/\s+/g, " "),
  });
  return {
    id: Number(result?.[0]?.insertId ?? result?.insertId),
    created: true,
  };
}

export function selfHelperValues(contact: {
  id: number;
  name: string;
  phone?: string | null;
}) {
  return {
    name: contact.name.trim().replace(/\s+/g, " "),
    contactId: contact.id,
    phone: contact.phone ?? null,
  };
}

async function syncContactToSelfHelperWithClient(
  client: any,
  contact: { id: number; name: string; phone?: string | null },
  previousName?: string,
  selectedYear = year()
) {
  const helperRows = await client
    .select()
    .from(helpers)
    .where(eq(helpers.year, selectedYear));
  const targetName = normalizePersonName(contact.name);
  const target = helperRows.find(
    (item: typeof helpers.$inferSelect) =>
      normalizePersonName(item.name) === targetName
  );
  const previous = previousName
    ? helperRows.find(
        (item: typeof helpers.$inferSelect) =>
          item.contactId === contact.id &&
          normalizePersonName(item.name) === normalizePersonName(previousName)
      )
    : undefined;

  if (previous && target && previous.id !== target.id) {
    throw new Error(
      `Der Name „${contact.name}“ wird bereits von einem anderen Helfer verwendet`
    );
  }

  const existing = previous ?? target;
  const values = selfHelperValues(contact);
  if (existing) {
    await client
      .update(helpers)
      .set(values)
      .where(and(eq(helpers.id, existing.id), eq(helpers.year, selectedYear)));
    return { id: existing.id, created: false };
  }

  const result: any = await client
    .insert(helpers)
    .values({ ...values, year: selectedYear });
  return {
    id: Number(result?.[0]?.insertId ?? result?.insertId),
    created: true,
  };
}

export async function syncContactToSelfHelper(
  contact: {
    id: number;
    name: string;
    phone?: string | null;
  },
  previousName?: string
) {
  const db = (await getDb()) as DB;
  return syncContactToSelfHelperWithClient(db, contact, previousName);
}

export async function syncContactsToSelfHelpers() {
  const contactRows = await listContacts();
  let created = 0;
  let updated = 0;
  for (const contact of contactRows) {
    const result = await syncContactToSelfHelper(contact);
    result.created ? created++ : updated++;
  }
  return { created, updated };
}

export async function createShift(
  v: Partial<typeof shifts.$inferInsert> & {
    day: "Freitag" | "Samstag" | "Sonntag";
    area: string;
    task: string;
  }
) {
  const db = (await getDb()) as DB;
  return db
    .insert(shifts)
    .values({ ...v, year: year() } as typeof shifts.$inferInsert);
}
export async function updateShift(
  id: number,
  v: Partial<typeof shifts.$inferInsert>
) {
  const db = (await getDb()) as DB;
  const { year: ignored, ...safe } = v;
  return db
    .update(shifts)
    .set(safe)
    .where(and(eq(shifts.id, id), eq(shifts.year, year())));
}
export async function deleteShift(id: number) {
  const db = (await getDb()) as DB;
  return db
    .delete(shifts)
    .where(and(eq(shifts.id, id), eq(shifts.year, year())));
}
export async function assignHelper(v: {
  shiftId: number;
  helperId: number;
  slot: number;
}) {
  const db = (await getDb()) as DB;
  return db.insert(assignments).values(v);
}
export async function replaceShiftAssignment(v: {
  shiftId: number;
  helperId: number;
  slot: number;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [shift] = await tx
      .select({ id: shifts.id, needed: shifts.needed })
      .from(shifts)
      .where(and(eq(shifts.id, v.shiftId), eq(shifts.year, year())))
      .limit(1);
    const [helper] = await tx
      .select({ id: helpers.id })
      .from(helpers)
      .where(and(eq(helpers.id, v.helperId), eq(helpers.year, year())))
      .limit(1);
    if (!shift || !helper)
      throw new Error("Schicht oder Helfer wurde nicht gefunden");
    if (v.slot < 0 || v.slot >= shift.needed)
      throw new Error("Helferplatz liegt außerhalb des Schichtbedarfs");
    const current = await tx
      .select()
      .from(assignments)
      .where(eq(assignments.shiftId, v.shiftId));
    if (
      current.some(item => item.slot === v.slot && item.helperId === v.helperId)
    )
      return;
    await tx
      .delete(assignments)
      .where(
        and(
          eq(assignments.shiftId, v.shiftId),
          or(eq(assignments.slot, v.slot), eq(assignments.helperId, v.helperId))
        )
      );
    await tx.insert(assignments).values(v);
  });
}
export async function removeShiftAssignment(v: {
  shiftId: number;
  slot: number;
}) {
  const db = (await getDb()) as DB;
  const [shift] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.id, v.shiftId), eq(shifts.year, year())))
    .limit(1);
  if (!shift) throw new Error("Schicht wurde nicht gefunden");
  return db
    .delete(assignments)
    .where(
      and(eq(assignments.shiftId, v.shiftId), eq(assignments.slot, v.slot))
    );
}
export async function unassignHelper(id: number) {
  const db = (await getDb()) as DB;
  return db
    .delete(assignments)
    .where(
      and(
        eq(assignments.id, id),
        inArray(
          assignments.shiftId,
          db
            .select({ id: shifts.id })
            .from(shifts)
            .where(eq(shifts.year, year()))
        )
      )
    );
}
export async function clearAssignments() {
  const db = (await getDb()) as DB;
  return db
    .delete(assignments)
    .where(
      inArray(
        assignments.shiftId,
        db.select({ id: shifts.id }).from(shifts).where(eq(shifts.year, year()))
      )
    );
}

export async function updateAppSettings(
  values: Partial<typeof appSettings.$inferInsert>
) {
  const db = (await getDb()) as DB;
  const { id: ignoredId, ...safe } = values;
  return db
    .insert(appSettings)
    .values({
      id: 1,
      eventName: "MyEifelRide",
      eventYear: String(year()),
      helperPdfTitle: "Aufgabenübersicht",
      blankPlanTitle: "Einsatzplan – Blanko",
      contactLabel: "Ansprechpartner",
      footerText: "",
      extraColumns: "[]",
      blankRowsPerShift: 0,
      ...safe,
    })
    .onDuplicateKeyUpdate({ set: safe });
}
export async function setPasswordHash(passwordHash: string) {
  const db = (await getDb()) as DB;
  return db
    .insert(securitySettings)
    .values({ id: 1, passwordHash })
    .onDuplicateKeyUpdate({ set: { passwordHash } });
}
export async function setAdminPasswordHash(adminPasswordHash: string) {
  const db = (await getDb()) as DB;
  return db
    .insert(securitySettings)
    .values({ id: 1, adminPasswordHash })
    .onDuplicateKeyUpdate({ set: { adminPasswordHash } });
}

function yearValues<T extends Record<string, unknown>>(values: T) {
  return { ...values, year: year() };
}
function yearWhere(table: { id: any; year: any }, id: number) {
  return and(eq(table.id, id), eq(table.year, year()));
}

async function createYearRow(table: any, values: Record<string, unknown>) {
  const db = (await getDb()) as DB;
  const result: any = await db.insert(table).values(yearValues(values));
  const id = Number(result?.[0]?.insertId ?? result?.insertId);
  const [created] = await db
    .select()
    .from(table)
    .where(yearWhere(table, id))
    .limit(1);
  if (!created)
    throw new Error("Gespeicherter Eintrag konnte nicht gelesen werden");
  return created;
}

export const createPrep = async (v: any) => createYearRow(prepTasks, v);
export const updatePrep = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(prepTasks)
    .set(v)
    .where(yearWhere(prepTasks, id));
export const deletePrep = async (id: number) =>
  ((await getDb()) as DB).delete(prepTasks).where(yearWhere(prepTasks, id));
export const createPost = async (v: any) => createYearRow(postTasks, v);
export const updatePost = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(postTasks)
    .set(v)
    .where(yearWhere(postTasks, id));
export const deletePost = async (id: number) =>
  ((await getDb()) as DB).delete(postTasks).where(yearWhere(postTasks, id));
export const createMaterial = async (v: any) => createYearRow(materials, v);
export const updateMaterial = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(materials)
    .set(v)
    .where(yearWhere(materials, id));
export const deleteMaterial = async (id: number) =>
  ((await getDb()) as DB).delete(materials).where(yearWhere(materials, id));
export const createMarketing = async (v: any) => createYearRow(marketing, v);
export const updateMarketing = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(marketing)
    .set(v)
    .where(yearWhere(marketing, id));
export const deleteMarketing = async (id: number) =>
  ((await getDb()) as DB).delete(marketing).where(yearWhere(marketing, id));
export const createApproval = async (v: any) => createYearRow(approvals, v);
export const updateApproval = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(approvals)
    .set(v)
    .where(yearWhere(approvals, id));
export const deleteApproval = async (id: number) =>
  ((await getDb()) as DB).delete(approvals).where(yearWhere(approvals, id));
export const createCake = async (v: any) => createYearRow(cakes, v);
export const updateCake = async (id: number, v: any) =>
  ((await getDb()) as DB).update(cakes).set(v).where(yearWhere(cakes, id));
export const deleteCake = async (id: number) =>
  ((await getDb()) as DB).delete(cakes).where(yearWhere(cakes, id));

type FinanceWrite = {
  category?: string;
  incomeCents?: number;
  expenseCents?: number;
  note?: string | null;
};
export const mapFinanceWrite = ({
  incomeCents,
  expenseCents,
  ...rest
}: FinanceWrite) => ({
  ...rest,
  ...(incomeCents === undefined ? {} : { income: incomeCents }),
  ...(expenseCents === undefined ? {} : { expense: expenseCents }),
});
export const createFinance = async (v: FinanceWrite & { category: string }) =>
  createYearRow(finances, mapFinanceWrite(v));
export const updateFinance = async (id: number, v: FinanceWrite) =>
  ((await getDb()) as DB)
    .update(finances)
    .set(mapFinanceWrite(v))
    .where(yearWhere(finances, id));
export const deleteFinance = async (id: number) =>
  ((await getDb()) as DB).delete(finances).where(yearWhere(finances, id));

export type ResetArea =
  | "contacts"
  | "helpers"
  | "shifts"
  | "prep"
  | "post"
  | "materials"
  | "marketing"
  | "approvals"
  | "cakes"
  | "finances"
  | "all";

export async function resetArea(area: ResetArea) {
  const db = (await getDb()) as DB;
  const selectedYear = year();
  const remove = async (table: any) =>
    db.delete(table).where(eq(table.year, selectedYear));
  if (area === "all") {
    await db.transaction(async tx => {
      await tx
        .delete(assignments)
        .where(
          inArray(
            assignments.shiftId,
            tx
              .select({ id: shifts.id })
              .from(shifts)
              .where(eq(shifts.year, selectedYear))
          )
        );
      await tx.delete(shifts).where(eq(shifts.year, selectedYear));
      await tx.delete(helpers).where(eq(helpers.year, selectedYear));
      await tx.delete(contacts).where(eq(contacts.year, selectedYear));
      await tx.delete(prepTasks).where(eq(prepTasks.year, selectedYear));
      await tx.delete(postTasks).where(eq(postTasks.year, selectedYear));
      await tx.delete(materials).where(eq(materials.year, selectedYear));
      await tx.delete(marketing).where(eq(marketing.year, selectedYear));
      await tx.delete(approvals).where(eq(approvals.year, selectedYear));
      await tx.delete(cakes).where(eq(cakes.year, selectedYear));
      await tx.delete(finances).where(eq(finances.year, selectedYear));
    });
    return;
  }
  const tableByArea = {
    contacts,
    helpers,
    shifts,
    prep: prepTasks,
    post: postTasks,
    materials,
    marketing,
    approvals,
    cakes,
    finances,
  } as const;
  await remove(tableByArea[area]);
  if (area === "helpers") await syncContactsToSelfHelpers();
}

const shiftKey = (shift: {
  day: string;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
}) =>
  [shift.day, shift.area, shift.task, shift.startTime, shift.endTime]
    .map(value => value.trim().toLocaleLowerCase("de-DE"))
    .join("|");

export async function copyPlanFromYear(
  sourceYear: number,
  targetYear = year()
) {
  if (sourceYear === targetYear)
    throw new Error("Quell- und Zieljahr müssen verschieden sein");
  const db = (await getDb()) as DB;
  const [
    sourceContacts,
    sourceHelpers,
    sourceShifts,
    sourceAssignments,
    targetContacts,
    targetHelpers,
    targetShifts,
  ] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.year, sourceYear)),
    db.select().from(helpers).where(eq(helpers.year, sourceYear)),
    db.select().from(shifts).where(eq(shifts.year, sourceYear)),
    db
      .select({ ...getTableColumns(assignments) })
      .from(assignments)
      .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
      .where(eq(shifts.year, sourceYear)),
    db.select().from(contacts).where(eq(contacts.year, targetYear)),
    db.select().from(helpers).where(eq(helpers.year, targetYear)),
    db.select().from(shifts).where(eq(shifts.year, targetYear)),
  ]);

  await ensureEventYear(targetYear);
  const contactMap = new Map<number, number>();
  const contactByName = new Map(
    targetContacts.map(item => [normalizePersonName(item.name), item.id])
  );
  let contactsCreated = 0;
  for (const item of sourceContacts) {
    let targetId = contactByName.get(normalizePersonName(item.name));
    if (!targetId) {
      const result: any = await db.insert(contacts).values({
        year: targetYear,
        name: item.name,
        phone: item.phone,
        note: item.note,
        sortOrder: item.sortOrder,
      });
      targetId = Number(result?.[0]?.insertId ?? result?.insertId);
      contactByName.set(normalizePersonName(item.name), targetId);
      contactsCreated++;
    }
    contactMap.set(item.id, targetId);
  }

  const helperMap = new Map<number, number>();
  const helperByName = new Map(
    targetHelpers.map(item => [normalizePersonName(item.name), item.id])
  );
  let helpersCreated = 0;
  for (const item of sourceHelpers) {
    let targetId = helperByName.get(normalizePersonName(item.name));
    if (!targetId) {
      const result: any = await db.insert(helpers).values({
        year: targetYear,
        name: item.name,
        contactId: item.contactId
          ? (contactMap.get(item.contactId) ?? null)
          : null,
        email: item.email,
        phone: item.phone,
        note: item.note,
        willHelp: item.willHelp,
        availFri: item.availFri,
        availSat: item.availSat,
        availSun: item.availSun,
        confirmed: item.confirmed,
      });
      targetId = Number(result?.[0]?.insertId ?? result?.insertId);
      helperByName.set(normalizePersonName(item.name), targetId);
      helpersCreated++;
    }
    helperMap.set(item.id, targetId);
  }

  const copiedContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.year, targetYear));
  for (const contact of copiedContacts) {
    const helper = await syncContactToSelfHelperWithClient(
      db,
      contact,
      undefined,
      targetYear
    );
    if (!helperByName.has(normalizePersonName(contact.name))) {
      helperByName.set(normalizePersonName(contact.name), helper.id);
      helpersCreated++;
    }
  }

  const shiftMap = new Map<number, number>();
  const targetShiftByKey = new Map(
    targetShifts.map(item => [shiftKey(item), item.id])
  );
  let shiftsCreated = 0;
  for (const item of sourceShifts) {
    let targetId = targetShiftByKey.get(shiftKey(item));
    if (!targetId) {
      const result: any = await db.insert(shifts).values({
        year: targetYear,
        day: item.day,
        area: item.area,
        task: item.task,
        startTime: item.startTime,
        endTime: item.endTime,
        needed: item.needed,
        note: item.note,
        sortOrder: item.sortOrder,
      });
      targetId = Number(result?.[0]?.insertId ?? result?.insertId);
      targetShiftByKey.set(shiftKey(item), targetId);
      shiftsCreated++;
    }
    shiftMap.set(item.id, targetId);
  }

  const currentAssignments = await db
    .select({ ...getTableColumns(assignments) })
    .from(assignments)
    .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
    .where(eq(shifts.year, targetYear));
  const occupied = new Set(
    currentAssignments.map(item => `${item.shiftId}:${item.slot}`)
  );
  const assignedHelpers = new Set(
    currentAssignments.map(item => `${item.shiftId}:${item.helperId}`)
  );
  let assignmentsCreated = 0;
  for (const item of sourceAssignments) {
    const shiftId = shiftMap.get(item.shiftId);
    const helperId = helperMap.get(item.helperId);
    if (
      !shiftId ||
      !helperId ||
      occupied.has(`${shiftId}:${item.slot}`) ||
      assignedHelpers.has(`${shiftId}:${helperId}`)
    )
      continue;
    await db.insert(assignments).values({ shiftId, helperId, slot: item.slot });
    occupied.add(`${shiftId}:${item.slot}`);
    assignedHelpers.add(`${shiftId}:${helperId}`);
    assignmentsCreated++;
  }
  return { contactsCreated, helpersCreated, shiftsCreated, assignmentsCreated };
}
