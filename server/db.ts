import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  approvals, assignments, cakes, contacts, finances, helpers,
  InsertUser, marketing, materials, postTasks, prepTasks, shifts, users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---------- Feature-Queries ----------
type DB = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function listContacts() { const db = await getDb(); if (!db) return []; return db.select().from(contacts).orderBy(contacts.sortOrder, contacts.name); }
export async function listHelpers() { const db = await getDb(); if (!db) return []; return db.select().from(helpers).orderBy(helpers.name); }
export async function listShifts() { const db = await getDb(); if (!db) return []; return db.select().from(shifts).orderBy(shifts.sortOrder, shifts.id); }
export async function listAssignments() { const db = await getDb(); if (!db) return []; return db.select().from(assignments); }
export async function listPrep() { const db = await getDb(); if (!db) return []; return db.select().from(prepTasks).orderBy(prepTasks.sortOrder, prepTasks.id); }
export async function listPost() { const db = await getDb(); if (!db) return []; return db.select().from(postTasks).orderBy(postTasks.sortOrder, postTasks.id); }
export async function listMaterials() { const db = await getDb(); if (!db) return []; return db.select().from(materials).orderBy(materials.sortOrder, materials.id); }
export async function listMarketing() { const db = await getDb(); if (!db) return []; return db.select().from(marketing).orderBy(marketing.sortOrder, marketing.id); }
export async function listApprovals() { const db = await getDb(); if (!db) return []; return db.select().from(approvals).orderBy(approvals.sortOrder, approvals.id); }
export async function listCakes() { const db = await getDb(); if (!db) return []; return db.select().from(cakes).orderBy(cakes.sortOrder, cakes.id); }
export async function listFinances() { const db = await getDb(); if (!db) return []; return db.select().from(finances).orderBy(finances.sortOrder, finances.id); }

// ---------- Mutations ----------
export async function createContact(v: { name: string; note?: string }) { const db = await getDb() as DB; return db.insert(contacts).values(v); }
export async function updateContact(id: number, v: { name?: string; note?: string | null }) { const db = await getDb() as DB; return db.update(contacts).set(v).where(eq(contacts.id, id)); }
export async function deleteContact(id: number) { const db = await getDb() as DB; await db.delete(contacts).where(eq(contacts.id, id)); }

export async function createHelper(v: Partial<typeof helpers.$inferInsert> & { name: string }) { const db = await getDb() as DB; return db.insert(helpers).values(v as typeof helpers.$inferInsert); }
export async function updateHelper(id: number, v: Partial<typeof helpers.$inferInsert>) { const db = await getDb() as DB; await db.update(helpers).set(v).where(eq(helpers.id, id)); }
export async function deleteHelper(id: number) { const db = await getDb() as DB; await db.delete(helpers).where(eq(helpers.id, id)); }

export async function createShift(v: Partial<typeof shifts.$inferInsert> & { day: "Freitag" | "Samstag" | "Sonntag"; area: string; task: string }) { const db = await getDb() as DB; return db.insert(shifts).values(v as typeof shifts.$inferInsert); }
export async function updateShift(id: number, v: Partial<typeof shifts.$inferInsert>) { const db = await getDb() as DB; await db.update(shifts).set(v).where(eq(shifts.id, id)); }
export async function deleteShift(id: number) { const db = await getDb() as DB; await db.delete(shifts).where(eq(shifts.id, id)); }

export async function assignHelper(v: { shiftId: number; helperId: number; slot: number }) { const db = await getDb() as DB; return db.insert(assignments).values(v); }
export async function unassignHelper(id: number) { const db = await getDb() as DB; await db.delete(assignments).where(eq(assignments.id, id)); }
export async function clearAssignments() { const db = await getDb() as DB; await db.delete(assignments); }

// Generische einfache Module
export const createPrep = async (v: any) => { const db = await getDb() as DB; return db.insert(prepTasks).values(v); };
export const updatePrep = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(prepTasks).set(v).where(eq(prepTasks.id, id)); };
export const deletePrep = async (id: number) => { const db = await getDb() as DB; return db.delete(prepTasks).where(eq(prepTasks.id, id)); };
export const createPost = async (v: any) => { const db = await getDb() as DB; return db.insert(postTasks).values(v); };
export const updatePost = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(postTasks).set(v).where(eq(postTasks.id, id)); };
export const deletePost = async (id: number) => { const db = await getDb() as DB; return db.delete(postTasks).where(eq(postTasks.id, id)); };
export const createMaterial = async (v: any) => { const db = await getDb() as DB; return db.insert(materials).values(v); };
export const updateMaterial = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(materials).set(v).where(eq(materials.id, id)); };
export const deleteMaterial = async (id: number) => { const db = await getDb() as DB; return db.delete(materials).where(eq(materials.id, id)); };
export const createMarketing = async (v: any) => { const db = await getDb() as DB; return db.insert(marketing).values(v); };
export const updateMarketing = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(marketing).set(v).where(eq(marketing.id, id)); };
export const deleteMarketing = async (id: number) => { const db = await getDb() as DB; return db.delete(marketing).where(eq(marketing.id, id)); };
export const createApproval = async (v: any) => { const db = await getDb() as DB; return db.insert(approvals).values(v); };
export const updateApproval = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(approvals).set(v).where(eq(approvals.id, id)); };
export const deleteApproval = async (id: number) => { const db = await getDb() as DB; return db.delete(approvals).where(eq(approvals.id, id)); };
export const createCake = async (v: any) => { const db = await getDb() as DB; return db.insert(cakes).values(v); };
export const updateCake = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(cakes).set(v).where(eq(cakes.id, id)); };
export const deleteCake = async (id: number) => { const db = await getDb() as DB; return db.delete(cakes).where(eq(cakes.id, id)); };
export const createFinance = async (v: any) => { const db = await getDb() as DB; return db.insert(finances).values(v); };
export const updateFinance = async (id: number, v: any) => { const db = await getDb() as DB; return db.update(finances).set(v).where(eq(finances.id, id)); };
export const deleteFinance = async (id: number) => { const db = await getDb() as DB; return db.delete(finances).where(eq(finances.id, id)); };
