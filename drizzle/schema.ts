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
  date,
} from "drizzle-orm/mysql-core";
import { WEEKDAYS, type Weekday } from "../shared/weekdays";
import type { PlanningModule } from "../shared/tenant-permissions";

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
    /** Präsenzdaten sind ausschließlich im aktuell serverbestätigten Verein sichtbar. */
    tenantId: varchar("tenantId", { length: 96 }).notNull(),
    role: mysqlEnum("role", ["user", "admin"]).notNull(),
    /**
     * Die technische Loginrolle reicht für Co-Admins nicht aus. Diese explizite,
     * serverseitig ermittelte Präsenzrolle steuert ausschließlich die Anzeige.
     */
    presenceRole: mysqlEnum("presenceRole", [
      "planner",
      "primary_admin",
      "co_admin",
    ])
      .default("planner")
      .notNull(),
    /** Sitzungsname aus dem signierten Login-Token für parallele Personen. */
    sessionName: varchar("sessionName", { length: 200 })
      .default("Unbekannt")
      .notNull(),
    lastSeen: timestamp("lastSeen").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("session_presences_last_seen_idx").on(table.lastSeen),
    index("session_presences_role_last_seen_idx").on(
      table.role,
      table.lastSeen
    ),
    index("session_presences_tenant_role_last_seen_idx").on(
      table.tenantId,
      table.presenceRole,
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

/**
 * Persistierter Lesestatus pro Person und Veranstaltung. Die identityKey trennt
 * insbesondere parallel angemeldete Administratoren, obwohl diese technisch
 * dieselbe Passwort-OpenID verwenden können.
 */
export const teamNoteReadStates = mysqlTable(
  "team_note_read_states",
  {
    id: int("id").autoincrement().primaryKey(),
    year: int("year").notNull(),
    eventId: int("eventId").notNull(),
    identityKey: varchar("identityKey", { length: 260 }).notNull(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    sessionName: varchar("sessionName", { length: 200 }).notNull(),
    role: mysqlEnum("role", ["user", "admin"]).notNull(),
    lastReadAt: timestamp("lastReadAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "team_note_read_states_event_year_fk",
      columns: [table.eventId, table.year],
      foreignColumns: [events.id, events.year],
    }).onDelete("cascade"),
    uniqueIndex("team_note_read_states_event_identity_unique").on(
      table.eventId,
      table.identityKey
    ),
    index("team_note_read_states_event_read_idx").on(
      table.eventId,
      table.lastReadAt
    ),
  ]
);
export type TeamNoteReadState = typeof teamNoteReadStates.$inferSelect;

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

// ---------- MyCrewMate Mandanten- und Planungsplattform ----------

/**
 * Ein Mandant repräsentiert einen eigenständig getrennten Verein oder Veranstalter.
 * Fachliche Planungsdaten bleiben über die Veranstaltung mit diesem Mandanten verbunden.
 */
export const tenants = mysqlTable(
  "tenants",
  {
    id: varchar("id", { length: 96 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    legalName: varchar("legalName", { length: 240 }).notNull(),
    status: mysqlEnum("status", [
      "pilot",
      "sample",
      "active",
      "suspended",
      "archived",
    ])
      .default("sample")
      .notNull(),
    planName: varchar("planName", { length: 120 }).notNull(),
    contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
    supportEmail: varchar("supportEmail", { length: 320 }).notNull(),
    logoKey: varchar("logoKey", { length: 500 }),
    logoUrl: varchar("logoUrl", { length: 700 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tenants_status_idx").on(table.status),
    uniqueIndex("tenants_name_unique").on(table.name),
  ]
);
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * Ein Benutzerkonto kann mehreren Vereinen angehören. Die Zuordnung ist die
 * serverseitige Sicherheitsgrenze für alle Planungsdaten; der Browser wählt
 * niemals eigenständig einen fremden Mandanten aus.
 */
export const userTenantMemberships = mysqlTable(
  "user_tenant_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    tenantId: varchar("tenantId", { length: 96 }).notNull(),
    role: mysqlEnum("role", ["tenant_admin", "planner"])
      .default("planner")
      .notNull(),
    status: mysqlEnum("status", ["active", "suspended"])
      .default("active")
      .notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({
      name: "user_tenant_memberships_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "user_tenant_memberships_tenant_id_tenants_id_fk",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("cascade"),
    uniqueIndex("user_tenant_memberships_user_tenant_unique").on(
      table.userId,
      table.tenantId
    ),
    index("user_tenant_memberships_user_status_idx").on(
      table.userId,
      table.status,
      table.isDefault
    ),
    index("user_tenant_memberships_tenant_status_idx").on(
      table.tenantId,
      table.status
    ),
  ]
);
export type UserTenantMembership = typeof userTenantMemberships.$inferSelect;
export type InsertUserTenantMembership = typeof userTenantMemberships.$inferInsert;

/** Persönliche Zugangsdaten für Vereinsadmins; ein Konto kann mehreren Vereinen angehören. */
export const tenantAdminCredentials = mysqlTable(
  "tenant_admin_credentials",
  {
    userId: int("userId").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
    sessionVersion: int("sessionVersion").default(1).notNull(),
    status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({ name: "tenant_admin_credentials_user_id_users_id_fk", columns: [table.userId], foreignColumns: [users.id] }).onDelete("cascade"),
    uniqueIndex("tenant_admin_credentials_email_unique").on(table.email),
  ]
);

/**
 * Einmalige Aktivierungslinks für persönliche Vereinsadministratoren.
 * Der Link enthält ausschließlich einen zufälligen Token; gespeichert wird nur
 * dessen SHA-256-Hash. Nach der Verwendung oder nach Ablauf kann er nicht mehr
 * zur Kontoübernahme eingesetzt werden.
 */
export const tenantAdminInvitations = mysqlTable(
  "tenant_admin_invitations",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    tenantId: varchar("tenantId", { length: 96 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "tenant_admin_invitations_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tenant_admin_invitations_tenant_id_tenants_id_fk",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("cascade"),
    index("tenant_admin_invitations_user_expiry_idx").on(
      table.userId,
      table.expiresAt
    ),
    index("tenant_admin_invitations_expiry_idx").on(table.expiresAt),
  ]
);

/** Einmalige, fünf Minuten gültige Übergabe vom Master-Portal in die Vereinsansicht. */
export const platformTenantHandoffs = mysqlTable(
  "platform_tenant_handoffs",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    tenantId: varchar("tenantId", { length: 96 }).notNull(),
    createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({ name: "platform_tenant_handoffs_tenant_id_tenants_id_fk", columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete("cascade"),
    index("platform_tenant_handoffs_expiry_idx").on(table.expiresAt),
  ]
);

/** Marktstart-Schalter: bis zum ausdrücklichen Go-live bleiben alle Verkaufswege aus. */
export const platformLaunchSettings = mysqlTable("platform_launch_settings", {
  id: int("id").primaryKey().default(1),
  paymentsEnabled: boolean("paymentsEnabled").default(false).notNull(),
  publicSelfServiceEnabled: boolean("publicSelfServiceEnabled").default(false).notNull(),
  paymentProvider: mysqlEnum("paymentProvider", ["none", "stripe"]).default("none").notNull(),
  invoiceWorkflow: mysqlEnum("invoiceWorkflow", ["manual", "automated"]).default("manual").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
    tenantId: varchar("tenantId", { length: 96 })
      .default("rsc-eifelland-mayen")
      .notNull(),
    year: int("year").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    activeDays: json("activeDays").$type<Weekday[]>().notNull(),
    startDate: date("startDate", { mode: "string" }),
    endDate: date("endDate", { mode: "string" }),
    donationTargetKuchen: int("donationTargetKuchen").notNull().default(0),
    donationTargetSalat: int("donationTargetSalat").notNull().default(0),
    donationTargetSnack: int("donationTargetSnack").notNull().default(0),
    donationTargetSonstiges: int("donationTargetSonstiges")
      .notNull()
      .default(0),
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
      name: "events_tenant_id_tenants_id_fk",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "events_year_fk",
      columns: [table.year],
      foreignColumns: [eventYears.year],
    }).onDelete("cascade"),
    // Der einzelne Jahresindex erhält die bestehende Fremdschlüsselbeziehung
    // zu event_years, wenn der frühere Index (year, name) mandantenfähig
    // durch (tenantId, year, name) ersetzt wird.
    index("events_year_fk_idx").on(table.year),
    uniqueIndex("events_tenant_year_name_unique").on(
      table.tenantId,
      table.year,
      table.name
    ),
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
    /** Persönliche Kontaktadresse; sie wird beim Anlegen eines Zugangs vorgeschlagen. */
    email: varchar("email", { length: 320 }),
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
    index("shifts_event_year_day_idx").on(table.eventId, table.year, table.day),
    index("shifts_event_location_idx").on(table.eventId, table.locationId),
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
    index("assignments_helper_event_idx").on(table.helperId, table.eventId),
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
  tenantLogoKey: varchar("tenantLogoKey", { length: 500 }),
  tenantLogoUrl: varchar("tenantLogoUrl", { length: 700 }),
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

/**
 * Ein separat verwalteter Planungsteam-Zugang. Das Passwort wird ausschließlich
 * als bcrypt-Hash gespeichert; die zugehörigen Veranstaltungsfreigaben stehen
 * in `planning_team_access_events`.
 */
export const planningTeamAccesses = mysqlTable("planning_team_accesses", {
  id: int("id").autoincrement().primaryKey(),
  /**
   * Ein Ansprechpartner kann genau einen eigenen Planungsteam-Zugang erhalten.
   * Ältere, aus der früheren globalen Passwortverwaltung übernommene Zugänge
   * bleiben bewusst ohne Ansprechpartner-Verknüpfung lesbar und verwaltbar.
   */
  contactId: int("contactId"),
  label: varchar("label", { length: 120 }).notNull(),
  /** Persönliche E-Mail für den individuellen Login; Altbestände dürfen leer bleiben. */
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  /** Ausschließlich die hier vergebenen Fachbereiche dürfen bearbeitet werden. */
  modulePermissions: json("modulePermissions").$type<PlanningModule[]>(),
  /**
   * Vereinsinterne Stellvertretung: erhält volle Rechte nur im eigenen Verein,
   * darf aber keine weiteren Stellvertretungen ernennen oder verwalten.
   */
  isTenantAdmin: boolean("isTenantAdmin").default(false).notNull(),
  /** Ein einmalig ausgegebener Zugangscode muss nach der ersten Anmeldung ersetzt werden. */
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  /** Änderungen an Passwort oder Freigaben machen bestehende Sitzungen ungültig. */
  sessionVersion: int("sessionVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  foreignKey({
    name: "pta_contact_fk",
    columns: [table.contactId],
    foreignColumns: [contacts.id],
  }).onDelete("cascade"),
  uniqueIndex("planning_team_access_contact_unique").on(table.contactId),
  uniqueIndex("planning_team_access_email_unique").on(table.email),
]);
export type PlanningTeamAccess = typeof planningTeamAccesses.$inferSelect;

/** Die explizite Many-to-many-Freigabe eines Planungsteam-Zugangs für Events. */
export const planningTeamAccessEvents = mysqlTable(
  "planning_team_access_events",
  {
    accessId: int("accessId").notNull(),
    eventId: int("eventId").notNull(),
  },
  table => [
    foreignKey({
      name: "pta_events_access_fk",
      columns: [table.accessId],
      foreignColumns: [planningTeamAccesses.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "pta_events_event_fk",
      columns: [table.eventId],
      foreignColumns: [events.id],
    }).onDelete("cascade"),
    uniqueIndex("planning_team_access_event_unique").on(
      table.accessId,
      table.eventId
    ),
    index("planning_team_access_events_event_idx").on(table.eventId),
  ]
);

/**
 * Einmalige Aktivierungslinks für individuelle Planungsteam-Zugänge.
 * Es wird ausschließlich der SHA-256-Hash des zufälligen Links gespeichert.
 */
export const planningTeamInvitations = mysqlTable(
  "planning_team_invitations",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    accessId: int("accessId").notNull(),
    tenantId: varchar("tenantId", { length: 96 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      name: "planning_team_invitations_access_id_planning_team_accesses_id_fk",
      columns: [table.accessId],
      foreignColumns: [planningTeamAccesses.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "planning_team_invitations_tenant_id_tenants_id_fk",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("cascade"),
    index("planning_team_invitations_access_tenant_expiry_idx").on(
      table.accessId,
      table.tenantId,
      table.expiresAt
    ),
    index("planning_team_invitations_expiry_idx").on(table.expiresAt),
  ]
);

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
  /** Vereinssicht des Protokolleintrags; null kennzeichnet ein reines Plattformereignis. */
  tenantId: varchar("tenantId", { length: 96 }).references(() => tenants.id, {
    onDelete: "cascade",
  }),
  year: int("year").notNull(),
  eventId: int("eventId").references(() => events.id, {
    onDelete: "set null",
  }),
  eventName: varchar("eventName", { length: 200 }),
  entityType: mysqlEnum("entityType", ["helper", "cake", "prep", "post", "material"]).notNull(),
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
}, table => [
  index("deletion_audit_logs_tenant_created_idx").on(
    table.tenantId,
    table.createdAt
  ),
  index("deletion_audit_logs_tenant_event_created_idx").on(
    table.tenantId,
    table.eventId,
    table.createdAt
  ),
]);
export type DeletionAuditLog = typeof deletionAuditLogs.$inferSelect;

/** Zentraler, unveränderlicher Verlauf aller operativen Planungsaktionen. */
export const activityLogs = mysqlTable(
  "activity_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Vereinssicht des Protokolleintrags; null kennzeichnet ein reines Plattformereignis. */
    tenantId: varchar("tenantId", { length: 96 }).references(() => tenants.id, {
      onDelete: "cascade",
    }),
    year: int("year").notNull(),
    eventId: int("eventId").references(() => events.id, {
      onDelete: "set null",
    }),
    eventName: varchar("eventName", { length: 200 }).notNull(),
    module: varchar("module", { length: 80 }).notNull(),
    action: mysqlEnum("action", [
      "created",
      "updated",
      "deleted",
      "reset",
      "imported",
      "copied",
    ]).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    actorUserId: int("actorUserId"),
    actorName: varchar("actorName", { length: 200 }).notNull(),
    actorRole: mysqlEnum("actorRole", ["user", "admin"]).notNull(),
    actorLoginMethod: varchar("actorLoginMethod", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("activity_logs_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("activity_logs_tenant_event_created_idx").on(
      table.tenantId,
      table.eventId,
      table.createdAt
    ),
    index("activity_logs_event_created_idx").on(table.eventId, table.createdAt),
    index("activity_logs_year_created_idx").on(table.year, table.createdAt),
  ]
);
export type ActivityLog = typeof activityLogs.$inferSelect;

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
  /** Einzelne Löschungen bleiben für das Administratorprotokoll wiederherstellbar. */
  deleted: boolean("deleted").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "prep_tasks_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
  index("prep_tasks_event_deleted_idx").on(table.eventId, table.year, table.deleted),
  index("prep_tasks_event_location_idx").on(table.eventId, table.locationId),
]);
export type PrepTask = typeof prepTasks.$inferSelect;

export const postTasks = mysqlTable("post_tasks", {
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
  status: mysqlEnum("status", ["offen", "inArbeit", "erledigt"])
    .default("offen")
    .notNull(),
  note: text("note"),
  /** Einzelne Löschungen bleiben für das Administratorprotokoll wiederherstellbar. */
  deleted: boolean("deleted").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "post_tasks_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
  index("post_tasks_event_deleted_idx").on(table.eventId, table.year, table.deleted),
  index("post_tasks_event_location_idx").on(table.eventId, table.locationId),
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
  /** Beschaffungsstand: offen, bestellt oder vollständig geliefert. */
  status: mysqlEnum("status", ["offen", "bestellt", "geliefert"])
    .default("offen")
    .notNull(),
  note: text("note"),
  /** Einzelne Löschungen bleiben für das Administratorprotokoll wiederherstellbar. */
  deleted: boolean("deleted").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [
  foreignKey({
    name: "materials_event_year_fk",
    columns: [table.eventId, table.year],
    foreignColumns: [events.id, events.year],
  }).onDelete("cascade"),
  index("materials_event_deleted_idx").on(table.eventId, table.year, table.deleted),
  index("materials_event_location_idx").on(table.eventId, table.locationId),
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
  /** Neutrale Bezeichnung der Spende; der bestehende Spaltenname bleibt kompatibel. */
  cake: varchar("cake", { length: 200 }).default("").notNull(),
  /** Einfache Verpflegungskategorie für Buffet- und Organisationsübersichten. */
  donationCategory: mysqlEnum("donationCategory", [
    "kuchen",
    "salat",
    "snack",
    "sonstiges",
  ])
    .default("kuchen")
    .notNull(),
  /** Optionaler Abgabeort; die Spendenansicht zeigt ihn bewusst ohne Kartenlink. */
  locationId: int("locationId").references(() => locations.id, {
    onDelete: "set null",
  }),
  /** ISO-Datum für die strukturierte Abgabeplanung. */
  dropoffDate: varchar("dropoffDate", { length: 10 }).default("").notNull(),
  /** Strukturierte Uhrzeit im Format HH:MM für native Mobile-Zeitpicker. */
  dropoffTime: varchar("dropoffTimeStructured", { length: 5 }).default("").notNull(),
  /** Bisheriger Freitext bleibt für bestehende Kuchenspenden verlustfrei erhalten. */
  legacyDropoffText: varchar("dropoffTime", { length: 60 }).default("").notNull(),
  /** Freiwillige Kennzeichnungen für die schnelle Ausgabe am Kuchenbuffet. */
  vegan: boolean("vegan").default(false).notNull(),
  glutenFree: boolean("glutenFree").default(false).notNull(),
  lactoseFree: boolean("lactoseFree").default(false).notNull(),
  containsNuts: boolean("containsNuts").default(false).notNull(),
  meat: boolean("meat").default(false).notNull(),
  /** Freitext für zusätzliche Hinweise wie Alkohol oder konkrete Zutaten. */
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
