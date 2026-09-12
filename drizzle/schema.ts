import {
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { WEEKDAYS } from "../shared/weekdays";

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

export const eventYears = mysqlTable("event_years", {
  year: int("year").primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EventYear = typeof eventYears.$inferSelect;

export const events = mysqlTable(
  "events",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("events_year_name_unique").on(table.year, table.name)]
);
export type Event = typeof events.$inferSelect;

export const contacts = mysqlTable(
  "contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId")
      .notNull()
      .references(() => events.id),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 64 }),
    note: text("note"),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("contacts_event_name_unique").on(table.eventId, table.name),
  ]
);
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const helpers = mysqlTable(
  "helpers",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId")
      .notNull()
      .references(() => events.id),
    contactId: int("contactId").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    note: text("note"),
    willHelp: mysqlEnum("willHelp", ["ja", "nein"]).default("ja").notNull(),
    availFri: mysqlEnum("availFri", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availSat: mysqlEnum("availSat", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availSun: mysqlEnum("availSun", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    confirmed: mysqlEnum("confirmed", ["ja", "nein"]).default("nein").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("helpers_event_name_unique").on(table.eventId, table.name),
  ]
);
export type Helper = typeof helpers.$inferSelect;
export type InsertHelper = typeof helpers.$inferInsert;

export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  day: mysqlEnum("day", WEEKDAYS).notNull(),
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

export const shiftAreaContacts = mysqlTable(
  "shift_area_contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId")
      .notNull()
      .references(() => events.id),
    area: varchar("area", { length: 200 }).notNull(),
    contactId: int("contactId").references(() => contacts.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("shift_area_contacts_event_area_unique").on(
      table.eventId,
      table.area
    ),
  ]
);
export type ShiftAreaContact = typeof shiftAreaContacts.$inferSelect;

export const assignments = mysqlTable(
  "assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    shiftId: int("shiftId")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    helperId: int("helperId")
      .notNull()
      .references(() => helpers.id, { onDelete: "cascade" }),
    slot: int("slot").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("assignments_shift_slot_unique").on(table.shiftId, table.slot),
    uniqueIndex("assignments_shift_helper_unique").on(
      table.shiftId,
      table.helperId
    ),
  ]
);
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

export const appSettings = mysqlTable("app_settings", {
  id: int("id").primaryKey().default(1),
  eventName: varchar("eventName", { length: 200 })
    .default("MyEifelRide")
    .notNull(),
  eventYear: varchar("eventYear", { length: 16 }).default("2026").notNull(),
  helperPdfTitle: varchar("helperPdfTitle", { length: 200 })
    .default("Aufgabenübersicht")
    .notNull(),
  blankPlanTitle: varchar("blankPlanTitle", { length: 200 })
    .default("Einsatzplan – Blanko")
    .notNull(),
  contactLabel: varchar("contactLabel", { length: 120 })
    .default("Ansprechpartner")
    .notNull(),
  footerText: varchar("footerText", { length: 300 }).default("").notNull(),
  logoKey: varchar("logoKey", { length: 500 }),
  logoUrl: varchar("logoUrl", { length: 700 }),
  extraColumns: text("extraColumns").notNull(),
  blankRowsPerShift: int("blankRowsPerShift").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppSettings = typeof appSettings.$inferSelect;

export const securitySettings = mysqlTable("security_settings", {
  id: int("id").primaryKey().default(1),
  passwordHash: varchar("passwordHash", { length: 255 }),
  adminPasswordHash: varchar("adminPasswordHash", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deletionAuditLogs = mysqlTable("deletion_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  eventId: int("eventId").references(() => events.id, {
    onDelete: "set null",
  }),
  eventName: varchar("eventName", { length: 200 }),
  entityType: mysqlEnum("entityType", ["helper", "cake"]).notNull(),
  entityId: int("entityId").notNull(),
  entityLabel: varchar("entityLabel", { length: 300 }).notNull(),
  action: mysqlEnum("action", [
    "single_delete",
    "area_reset",
    "year_reset",
  ]).notNull(),
  actorUserId: int("actorUserId").notNull(),
  actorName: varchar("actorName", { length: 200 }).notNull(),
  actorRole: mysqlEnum("actorRole", ["user", "admin"]).notNull(),
  actorLoginMethod: varchar("actorLoginMethod", { length: 64 }),
  responsibleContactId: int("responsibleContactId"),
  responsibleContactName: varchar("responsibleContactName", { length: 200 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  restoredAt: timestamp("restoredAt"),
  restoredByUserId: int("restoredByUserId"),
  restoredByName: varchar("restoredByName", { length: 200 }),
});
export type DeletionAuditLog = typeof deletionAuditLogs.$inferSelect;

export const backupRestoreLogs = mysqlTable("backup_restore_logs", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  eventId: int("eventId").references(() => events.id, {
    onDelete: "set null",
  }),
  eventName: varchar("eventName", { length: 200 }).notNull(),
  sourceFilename: varchar("sourceFilename", { length: 255 }).notNull(),
  backupExportedAt: varchar("backupExportedAt", { length: 40 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  actorName: varchar("actorName", { length: 200 }).notNull(),
  actorRole: mysqlEnum("actorRole", ["user", "admin"]).notNull(),
  actorLoginMethod: varchar("actorLoginMethod", { length: 64 }),
  createdCount: int("createdCount").default(0).notNull(),
  updatedCount: int("updatedCount").default(0).notNull(),
  deletedCount: int("deletedCount").default(0).notNull(),
  beforeDigest: varchar("beforeDigest", { length: 64 }).notNull(),
  afterDigest: varchar("afterDigest", { length: 64 }).notNull(),
  workbookDigest: varchar("workbookDigest", { length: 64 }).notNull(),
  details: mediumtext("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BackupRestoreLog = typeof backupRestoreLogs.$inferSelect;

export const prepTasks = mysqlTable("prep_tasks", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  task: varchar("task", { length: 300 }).notNull(),
  dueText: varchar("dueText", { length: 200 }).default("").notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type PrepTask = typeof prepTasks.$inferSelect;

export const postTasks = mysqlTable("post_tasks", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  task: varchar("task", { length: 300 }).notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type PostTask = typeof postTasks.$inferSelect;

export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  article: varchar("article", { length: 300 }).notNull(),
  category: varchar("category", { length: 120 }).default("").notNull(),
  quantity: varchar("quantity", { length: 40 }).default("").notNull(),
  unit: varchar("unit", { length: 40 }).default("").notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  ordered: mysqlEnum("ordered", ["ja", "nein"]).default("nein").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Material = typeof materials.$inferSelect;

export const marketing = mysqlTable("marketing", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  measure: varchar("measure", { length: 300 }).notNull(),
  channel: varchar("channel", { length: 160 }).default("").notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Marketing = typeof marketing.$inferSelect;

export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  request: varchar("request", { length: 300 }).notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "beantragt", "genehmigt", "abgelehnt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Approval = typeof approvals.$inferSelect;

export const cakes = mysqlTable("cakes", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  donor: varchar("donor", { length: 200 }).notNull(),
  cake: varchar("cake", { length: 200 }).default("").notNull(),
  dropoffTime: varchar("dropoffTime", { length: 60 }).default("").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Cake = typeof cakes.$inferSelect;

export const finances = mysqlTable("finances", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId")
    .notNull()
    .references(() => events.id),
  category: varchar("category", { length: 160 }).notNull(),
  income: int("incomeCents").default(0).notNull(),
  expense: int("expenseCents").default(0).notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type Finance = typeof finances.$inferSelect;
