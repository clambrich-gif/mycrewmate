import {
  foreignKey,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  boolean,
  double,
} from "drizzle-orm/mysql-core";
import { WEEKDAYS, type Weekday } from "../shared/weekdays";

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

export const sessionPresences = mysqlTable(
  "session_presences",
  {
    sessionKey: varchar("sessionKey", { length: 64 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["user", "admin"]).notNull(),
    lastSeen: timestamp("lastSeen").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("session_presences_last_seen_idx").on(table.lastSeen),
    index("session_presences_role_last_seen_idx").on(
      table.role,
      table.lastSeen
    ),
  ]
);
export type SessionPresence = typeof sessionPresences.$inferSelect;

/** Serverseitig gesperrte, gehashte JWT-Sitzungen (z. B. nach Logout). */
export const revokedSessions = mysqlTable(
  "revoked_sessions",
  {
    sessionKey: varchar("sessionKey", { length: 64 }).primaryKey(),
    reason: mysqlEnum("reason", ["logout", "security_reset"]).notNull(),
    revokedAt: timestamp("revokedAt").defaultNow().notNull(),
  },
  table => [index("revoked_sessions_revoked_at_idx").on(table.revokedAt)]
);
export type RevokedSession = typeof revokedSessions.$inferSelect;

export const teamNotes = mysqlTable(
  "team_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").notNull(),
    eventId: int("eventId").notNull(),
    senderUserId: int("senderUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    senderName: varchar("senderName", { length: 200 }).notNull(),
    senderRole: mysqlEnum("senderRole", ["user", "admin"]).notNull(),
    message: text("message").notNull(),
    important: boolean("important").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "team_notes_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    index("team_notes_event_created_idx").on(
      table.eventId,
      table.createdAt
    ),
    index("team_notes_event_id_idx").on(table.eventId, table.id),
    // Globaler 24h-Cleanup filtert nur auf createdAt; Eventindizes würden
    // dafür mit wachsendem Verlauf nicht als führender Index greifen.
    index("team_notes_created_at_cleanup_idx").on(table.createdAt),
  ]
);
export type TeamNote = typeof teamNotes.$inferSelect;

export const teamNoteTypings = mysqlTable(
  "team_note_typings",
  {
    sessionKey: varchar("sessionKey", { length: 64 }).primaryKey(),
    year: int("year").notNull(),
    eventId: int("eventId").notNull(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    senderName: varchar("senderName", { length: 200 }).notNull(),
    senderRole: mysqlEnum("senderRole", ["user", "admin"]).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({
      name: "team_note_typings_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    index("team_note_typings_event_updated_idx").on(
      table.eventId,
      table.updatedAt
    ),
    // Der globale TTL-Cleanup der flüchtigen Tippstatus filtert nur zeitlich.
    index("team_note_typings_updated_at_cleanup_idx").on(table.updatedAt),
  ]
);
export type TeamNoteTyping = typeof teamNoteTypings.$inferSelect;

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
    activeDays: json("activeDays").$type<Weekday[]>().notNull(),
    pdfLogoKey: varchar("pdfLogoKey", { length: 500 }),
    pdfLogoUrl: varchar("pdfLogoUrl", { length: 700 }),
    pdfLogoFallback: mysqlEnum("pdfLogoFallback", ["none", "brand"])
      .default("none")
      .notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "events_year_fk",
      columns: [table.year],
      foreignColumns: [eventYears.year],
    }).onDelete("cascade"),
    uniqueIndex("events_year_name_unique").on(table.year, table.name),
    uniqueIndex("events_id_year_unique").on(table.id, table.year),
  ]
);
export type Event = typeof events.$inferSelect;

export const contacts = mysqlTable(
  "contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 64 }),
    note: text("note"),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "contacts_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    uniqueIndex("contacts_event_name_unique").on(table.eventId, table.name),
    uniqueIndex("contacts_id_event_year_unique").on(
      table.id,
      table.eventId,
      table.year
    ),
  ]
);
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const helpers = mysqlTable(
  "helpers",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId").notNull(),
    contactId: int("contactId"),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    note: text("note"),
    companion: varchar("companion", { length: 500 }),
    // Kurzer, nicht erratbarer Freigabecode für persönliche PDF-Links (/p/:code).
    pdfShareCode: varchar("pdfShareCode", { length: 12 }),
    willHelp: mysqlEnum("willHelp", ["ja", "nein"]).default("ja").notNull(),
    availMon: mysqlEnum("availMon", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availTue: mysqlEnum("availTue", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availWed: mysqlEnum("availWed", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availThu: mysqlEnum("availThu", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availFri: mysqlEnum("availFri", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availSat: mysqlEnum("availSat", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availSun: mysqlEnum("availSun", ["ja", "nein", "vielleicht"])
      .default("vielleicht")
      .notNull(),
    availMonStart: varchar("availMonStart", { length: 5 }),
    availMonEnd: varchar("availMonEnd", { length: 5 }),
    availTueStart: varchar("availTueStart", { length: 5 }),
    availTueEnd: varchar("availTueEnd", { length: 5 }),
    availWedStart: varchar("availWedStart", { length: 5 }),
    availWedEnd: varchar("availWedEnd", { length: 5 }),
    availThuStart: varchar("availThuStart", { length: 5 }),
    availThuEnd: varchar("availThuEnd", { length: 5 }),
    availFriStart: varchar("availFriStart", { length: 5 }),
    availFriEnd: varchar("availFriEnd", { length: 5 }),
    availSatStart: varchar("availSatStart", { length: 5 }),
    availSatEnd: varchar("availSatEnd", { length: 5 }),
    availSunStart: varchar("availSunStart", { length: 5 }),
    availSunEnd: varchar("availSunEnd", { length: 5 }),
    confirmed: mysqlEnum("confirmed", ["ja", "nein"]).default("nein").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "helpers_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    foreignKey({
      name: "helpers_contactId_contacts_id_fk",
      columns: [table.contactId],
      foreignColumns: [contacts.id],
    }).onDelete("set null"),
    uniqueIndex("helpers_event_name_unique").on(table.eventId, table.name),
    uniqueIndex("helpers_id_event_year_unique").on(
      table.id,
      table.eventId,
      table.year
    ),
    uniqueIndex("helpers_pdf_share_code_unique").on(table.pdfShareCode),
  ]
);
export type Helper = typeof helpers.$inferSelect;
export type InsertHelper = typeof helpers.$inferInsert;

/** Zentral gepflegte, veranstaltungsbezogene Einsatzorte. */
export const locations = mysqlTable(
  "locations",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    logoKey: varchar("logoKey", { length: 500 }),
    logoUrl: varchar("logoUrl", { length: 700 }),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "locations_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    uniqueIndex("locations_event_name_unique").on(table.eventId, table.name),
  ]
);
export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

/** Hochgeladene GPX-Strecken für die Live-Standortkarte. */
export const gpxTracks = mysqlTable(
  "gpx_tracks",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    fileKey: varchar("fileKey", { length: 500 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 700 }).notNull(),
    color: varchar("color", { length: 7 }).default("#2563eb").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "gpx_tracks_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    uniqueIndex("gpx_tracks_event_name_unique").on(table.eventId, table.name),
  ]
);
export type GpxTrack = typeof gpxTracks.$inferSelect;
export type InsertGpxTrack = typeof gpxTracks.$inferInsert;

export const shifts = mysqlTable(
  "shifts",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId").notNull(),
    day: mysqlEnum("day", WEEKDAYS).notNull(),
    area: varchar("area", { length: 200 }).notNull(),
    task: varchar("task", { length: 300 }).notNull(),
    locationId: int("locationId").references(() => locations.id, {
      onDelete: "set null",
    }),
    startTime: varchar("startTime", { length: 16 }).default("").notNull(),
    endTime: varchar("endTime", { length: 16 }).default("").notNull(),
    allowFlexibleAssignment: boolean("allowFlexibleAssignment")
      .default(false)
      .notNull(),
    manualOkConfirmed: boolean("manualOkConfirmed").default(false).notNull(),
    manualDoubleConflictAccepted: boolean("manualDoubleConflictAccepted")
      .default(false)
      .notNull(),
    needed: int("needed").default(1).notNull(),
    note: text("note"),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "shifts_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    uniqueIndex("shifts_id_event_year_unique").on(
      table.id,
      table.eventId,
      table.year
    ),
  ]
);
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

export const shiftAreaContacts = mysqlTable(
  "shift_area_contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").default(2026).notNull(),
    eventId: int("eventId").notNull(),
    area: varchar("area", { length: 200 }).notNull(),
    contactId: int("contactId"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({
      name: "shift_area_contacts_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    foreignKey({
      name: "shift_area_contacts_contactId_contacts_id_fk",
      columns: [table.contactId],
      foreignColumns: [contacts.id],
    }).onDelete("cascade"),
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
    year: int("year").notNull(),
    eventId: int("eventId").notNull(),
    slot: int("slot").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "assignments_shift_event_year_fk",
      columns: [table.shiftId, table.eventId, table.year],
      foreignColumns: [shifts.id, shifts.eventId, shifts.year],
    }).onDelete("cascade"),
    foreignKey({
      name: "assignments_helper_event_year_fk",
      columns: [table.helperId, table.eventId, table.year],
      foreignColumns: [helpers.id, helpers.eventId, helpers.year],
    }).onDelete("cascade"),
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
  whatsAppMessageTemplate: mediumtext("whatsAppMessageTemplate"),
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
  oauthOwnerOpenId: varchar("oauthOwnerOpenId", { length: 64 }),
  planningTeamFailedAttempts: int("planningTeamFailedAttempts")
    .default(0)
    .notNull(),
  planningTeamLocked: boolean("planningTeamLocked").default(false).notNull(),
  planningTeamSessionVersion: int("planningTeamSessionVersion")
    .default(1)
    .notNull(),
  adminSessionVersion: int("adminSessionVersion").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Nachvollziehbarkeit sicherheitsrelevanter Änderungen am Team-Chat. */
export const teamNoteAuditLogs = mysqlTable(
  "team_note_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").notNull(),
    eventId: int("eventId").references(() => events.id, {
      onDelete: "set null",
    }),
    eventName: varchar("eventName", { length: 200 }).notNull(),
    action: mysqlEnum("action", ["clear"]).notNull(),
    deletedCount: int("deletedCount").default(0).notNull(),
    actorUserId: int("actorUserId").notNull(),
    actorName: varchar("actorName", { length: 200 }).notNull(),
    actorRole: mysqlEnum("actorRole", ["admin"]).notNull(),
    actorLoginMethod: varchar("actorLoginMethod", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("team_note_audit_logs_event_created_idx").on(
      table.eventId,
      table.createdAt
    ),
  ]
);
export type TeamNoteAuditLog = typeof teamNoteAuditLogs.$inferSelect;

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
  eventId: int("eventId").notNull(),
  task: varchar("task", { length: 300 }).notNull(),
  category: varchar("category", { length: 120 }).default("").notNull(),
  dueText: varchar("dueText", { length: 200 }).default("").notNull(),
  locationId: int("locationId").references(() => locations.id, {
    onDelete: "set null",
  }),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt", "abgelehnt"])
    .default("offen")
    .notNull(),
  statusWording: mysqlEnum("statusWording", ["aufgabe", "genehmigung"])
    .default("aufgabe")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "prep_tasks_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type PrepTask = typeof prepTasks.$inferSelect;

export const postTasks = mysqlTable("post_tasks", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId").notNull(),
  task: varchar("task", { length: 300 }).notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "post_tasks_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type PostTask = typeof postTasks.$inferSelect;

export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId").notNull(),
  article: varchar("article", { length: 300 }).notNull(),
  category: varchar("category", { length: 120 }).default("").notNull(),
  quantity: varchar("quantity", { length: 40 }).default("").notNull(),
  unit: varchar("unit", { length: 40 }).default("").notNull(),
  locationId: int("locationId").references(() => locations.id, {
    onDelete: "set null",
  }),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  ordered: mysqlEnum("ordered", ["ja", "nein"]).default("nein").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "materials_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type Material = typeof materials.$inferSelect;

export const marketing = mysqlTable("marketing", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId").notNull(),
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
}, table => [
  foreignKey({
    name: "marketing_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type Marketing = typeof marketing.$inferSelect;

export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId").notNull(),
  request: varchar("request", { length: 300 }).notNull(),
  contactId: int("contactId").references(() => contacts.id, {
    onDelete: "set null",
  }),
  status: mysqlEnum("status", ["offen", "beantragt", "genehmigt", "abgelehnt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "approvals_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type Approval = typeof approvals.$inferSelect;

export const cakes = mysqlTable("cakes", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId").notNull(),
  donor: varchar("donor", { length: 200 }).notNull(),
  cake: varchar("cake", { length: 200 }).default("").notNull(),
  dropoffTime: varchar("dropoffTime", { length: 60 }).default("").notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "cakes_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type Cake = typeof cakes.$inferSelect;

export const finances = mysqlTable("finances", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").default(2026).notNull(),
  eventId: int("eventId").notNull(),
  category: varchar("category", { length: 160 }).notNull(),
  income: int("incomeCents").default(0).notNull(),
  expense: int("expenseCents").default(0).notNull(),
  note: text("note"),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "finances_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
]);
export type Finance = typeof finances.$inferSelect;
