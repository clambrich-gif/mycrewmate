import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------- MyEifelRide Planungsplattform ----------

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const helpers = mysqlTable("helpers", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId"),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  willHelp: mysqlEnum("willHelp", ["ja", "nein"]).default("ja").notNull(),
  availFri: mysqlEnum("availFri", ["ja", "nein", "vielleicht"]).default("vielleicht").notNull(),
  availSat: mysqlEnum("availSat", ["ja", "nein", "vielleicht"]).default("vielleicht").notNull(),
  availSun: mysqlEnum("availSun", ["ja", "nein", "vielleicht"]).default("vielleicht").notNull(),
  confirmed: mysqlEnum("confirmed", ["ja", "nein"]).default("nein").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Helper = typeof helpers.$inferSelect;
export type InsertHelper = typeof helpers.$inferInsert;

export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  day: mysqlEnum("day", ["Freitag", "Samstag", "Sonntag"]).notNull(),
  area: varchar("area", { length: 200 }).notNull(),
  task: varchar("task", { length: 300 }).notNull(),
  startTime: varchar("startTime", { length: 16 }).default("").notNull(),
  endTime: varchar("endTime", { length: 16 }).default("").notNull(),
  needed: int("needed").default(1).notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  shiftId: int("shiftId").notNull(),
  helperId: int("helperId").notNull(),
  slot: int("slot").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

export const prepTasks = mysqlTable("prep_tasks", {
  id: int("id").autoincrement().primaryKey(),
  task: varchar("task", { length: 300 }).notNull(),
  contactId: int("contactId"),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"]).default("offen").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type PrepTask = typeof prepTasks.$inferSelect;

export const postTasks = mysqlTable("post_tasks", {
  id: int("id").autoincrement().primaryKey(),
  task: varchar("task", { length: 300 }).notNull(),
  contactId: int("contactId"),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"]).default("offen").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type PostTask = typeof postTasks.$inferSelect;

export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  article: varchar("article", { length: 300 }).notNull(),
  category: varchar("category", { length: 120 }).default("").notNull(),
  quantity: varchar("quantity", { length: 40 }).default("").notNull(),
  unit: varchar("unit", { length: 40 }).default("").notNull(),
  contactId: int("contactId"),
  ordered: mysqlEnum("ordered", ["ja", "nein"]).default("nein").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Material = typeof materials.$inferSelect;

export const marketing = mysqlTable("marketing", {
  id: int("id").autoincrement().primaryKey(),
  measure: varchar("measure", { length: 300 }).notNull(),
  channel: varchar("channel", { length: 160 }).default("").notNull(),
  contactId: int("contactId"),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"]).default("offen").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Marketing = typeof marketing.$inferSelect;

export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  request: varchar("request", { length: 300 }).notNull(),
  contactId: int("contactId"),
  status: mysqlEnum("status", ["offen", "beantragt", "genehmigt", "abgelehnt"]).default("offen").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Approval = typeof approvals.$inferSelect;

export const cakes = mysqlTable("cakes", {
  id: int("id").autoincrement().primaryKey(),
  donor: varchar("donor", { length: 200 }).notNull(),
  cake: varchar("cake", { length: 200 }).default("").notNull(),
  dropoffTime: varchar("dropoffTime", { length: 60 }).default("").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Cake = typeof cakes.$inferSelect;

export const finances = mysqlTable("finances", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 160 }).notNull(),
  income: int("incomeCents").default(0).notNull(),
  expense: int("expenseCents").default(0).notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Finance = typeof finances.$inferSelect;
