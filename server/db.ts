import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne as notEq,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appSettings,
  activityLogs,
  approvals,
  assignments,
  backupRestoreLogs,
  cakes,
  contacts,
  deletionAuditLogs,
  events,
  eventYears,
  finances,
  gpxTracks,
  helpers,
  InsertUser,
  User,
  marketing,
  materials,
  locations,
  planningTeamAccesses,
  planningTeamAccessEvents,
  planningTeamInvitations,
  platformLaunchSettings,
  platformTenantHandoffs,
  postTasks,
  prepTasks,
  revokedSessions,
  securitySettings,
  shiftAreaContacts,
  shifts,
  teamNotes,
  teamNoteAuditLogs,
  teamNoteReadStates,
  teamNoteTypings,
  tenantAdminCredentials,
  tenantAdminInvitations,
  tenants,
  userTenantMemberships,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  eventWeekdays,
  helperEligibleForShift,
  helperAvailableForShift,
  helperAvailableOnDay,
  WEEKDAYS,
  type Weekday,
} from "../shared/weekdays";
import { eventDateRangeError } from "../shared/event-dates";
import { prependPreparationLogbookEntry } from "../shared/preparation-logbook";
import {
  ADMIN_PASSWORD_OPEN_ID,
  planningTeamAccessIdFromOpenId,
  planningTeamAccessOpenId,
  SHARED_PASSWORD_OPEN_ID,
} from "./password-auth";
import {
  DEFAULT_TENANT_ID,
  currentEventId,
  currentEventYear,
  currentTenantId,
} from "./year-context";
import { overlaps } from "./logic";
import {
  normalizedAssignedSlotUpdates,
  splitShiftAssignmentsByHelper,
  unassignedAssignmentIds,
  validateExistingAssignmentsForShiftUpdate,
} from "./shift-update-validation";

type DB = ReturnType<typeof drizzle>;
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];
type DBClient = DB | Transaction;
let _db: DB | null = null;
const planningWriteClientStorage = new AsyncLocalStorage<DBClient>();

export async function getDb(): Promise<DBClient | null> {
  const transactionClient = planningWriteClientStorage.getStore();
  if (transactionClient) return transactionClient;
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

/**
 * OAuth dient ausschließlich dem fest konfigurierten Eigentümerkonto. Andere
 * Nutzer verwenden die getrennten Passwortzugänge und dürfen nie durch einen
 * OAuth-Callback als Planungsteam angelegt werden.
 */
export function isConfiguredOAuthOwner(
  openId: string,
  ownerOpenId = ENV.ownerOpenId
) {
  return ownerOpenId.trim().length > 0 && openId === ownerOpenId;
}

/**
 * Erlaubt genau das konfigurierte Eigentümerkonto – oder dessen bereits
 * verifizierte, administrativ gespeicherte Nachfolge-ID. Letztere entsteht
 * ausschließlich im OAuth-Callback durch eine identische, vom Provider
 * gelieferte E-Mail-Adresse. Passwortkonten sind ausdrücklich ausgeschlossen.
 */
export async function isAuthorizedOAuthOwner(openId: string) {
  const db = await getDb();
  if (!db) return false;
  const [settings] = await db
    .select({ oauthOwnerOpenId: securitySettings.oauthOwnerOpenId })
    .from(securitySettings)
    .where(eq(securitySettings.id, 1))
    .limit(1);
  const ownerOpenId = settings?.oauthOwnerOpenId?.trim() || ENV.ownerOpenId;
  return ownerOpenId.trim().length > 0 && openId === ownerOpenId;
}

export async function refreshConfiguredOAuthOwner(
  user: Pick<InsertUser, "openId" | "name" | "email" | "loginMethod" | "lastSignedIn">
): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedEmail = user.email?.trim().toLowerCase();
  const [settings] = await db
    .select({ oauthOwnerOpenId: securitySettings.oauthOwnerOpenId })
    .from(securitySettings)
    .where(eq(securitySettings.id, 1))
    .limit(1);
  const configuredOwnerOpenId =
    settings?.oauthOwnerOpenId?.trim() || ENV.ownerOpenId;
  if (!configuredOwnerOpenId.trim()) return undefined;

  const candidates = await db
    .select()
    .from(users)
    .where(
      normalizedEmail
        ? or(
            eq(users.openId, user.openId),
            eq(users.openId, configuredOwnerOpenId),
            eq(users.email, normalizedEmail)
          )
        : or(
            eq(users.openId, user.openId),
            eq(users.openId, configuredOwnerOpenId)
          )
    )
    .limit(3);
  const existing = candidates.find(
    row => row.openId === configuredOwnerOpenId
  );
  if (!existing) return undefined;

  const matchesConfiguredOwner = user.openId === configuredOwnerOpenId;
  const canMigrateOwnerIdentity = Boolean(
    !matchesConfiguredOwner &&
      normalizedEmail &&
      existing.role === "admin" &&
      existing.loginMethod !== "password" &&
      existing.loginMethod !== "admin-password" &&
      existing.email?.trim().toLowerCase() === normalizedEmail
  );
  if (!matchesConfiguredOwner && !canMigrateOwnerIdentity) return undefined;

  await db.transaction(async tx => {
    await tx
      .update(users)
      .set({
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        lastSignedIn: user.lastSignedIn ?? new Date(),
        // Der Eigentümerzugang bleibt unabhängig vom vorherigen Altdatenstatus
        // administrativ. Dies legt jedoch kein unbekanntes Konto an.
        role: "admin",
      })
      .where(eq(users.id, existing.id));
    await tx
      .insert(securitySettings)
      .values({ id: 1, oauthOwnerOpenId: user.openId })
      .onDuplicateKeyUpdate({ set: { oauthOwnerOpenId: user.openId } });
  });

  const [refreshed] = await db
    .select()
    .from(users)
    .where(eq(users.id, existing.id))
    .limit(1);
  return refreshed;
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

export type ActiveTenantMembership = {
  tenantId: string;
  role: "tenant_admin" | "planner";
  isDefault: boolean;
  tenantName: string;
  tenantStatus: "pilot" | "sample" | "active" | "suspended" | "archived";
};

/** Liefert nur aktiv freigeschaltete Vereinszuordnungen eines Kontos. */
export async function listActiveTenantMembershipsForUser(
  userId: number
): Promise<ActiveTenantMembership[]> {
  const database = await getDb();
  if (!database) return [];
  return database
    .select({
      tenantId: userTenantMemberships.tenantId,
      role: userTenantMemberships.role,
      isDefault: userTenantMemberships.isDefault,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(userTenantMemberships)
    .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
    .where(
      and(
        eq(userTenantMemberships.userId, userId),
        eq(userTenantMemberships.status, "active"),
        notEq(tenants.status, "suspended"),
        notEq(tenants.status, "archived")
      )
    )
    .orderBy(desc(userTenantMemberships.isDefault), asc(tenants.name));
}

/**
 * Bestimmt den serverseitig gültigen Verein eines Kontos. Eine Browserangabe
 * wird nur verwendet, wenn das Konto genau diesem Verein aktiv angehört.
 */
export async function resolveTenantForUser(input: {
  userId: number;
  userOpenId?: string | null;
  preferredTenantId?: string | null;
}): Promise<ActiveTenantMembership | undefined> {
  const preferredTenantId = input.preferredTenantId?.trim();

  // Der Plattform-Inhaber darf nach einem Master-Handoff einen nicht
  // archivierten bzw. nicht pausierten Verein in der Vereinsansicht öffnen.
  // Für alle regulären Vereinskonten bleibt die serverseitige Mitgliedschaft
  // die einzige Berechtigungsquelle.
  if (input.userOpenId === ADMIN_PASSWORD_OPEN_ID && preferredTenantId) {
    const database = await getDb();
    if (database) {
      const [selectedTenant] = await database
        .select({
          id: tenants.id,
          name: tenants.name,
          status: tenants.status,
        })
        .from(tenants)
        .where(
          and(
            eq(tenants.id, preferredTenantId),
            notEq(tenants.status, "suspended"),
            notEq(tenants.status, "archived")
          )
        )
        .limit(1);
      if (selectedTenant) {
        return {
          tenantId: selectedTenant.id,
          role: "tenant_admin",
          isDefault: false,
          tenantName: selectedTenant.name,
          tenantStatus: selectedTenant.status,
        };
      }
    }
  }

  const memberships = await listActiveTenantMembershipsForUser(input.userId);
  if (!memberships.length) {
    // Solange während der Pilotphase noch Altsitzungen oder Mock-Benutzer ohne
    // explizite Mitgliedschaft existieren, greift der sichere Pilotmandant
    // als Fallback, damit bestehende Abläufe nicht unvermittelt abbrechen.
    const [pilotRecord] = await (await getDb())!
      .select({
        id: tenants.id,
        name: tenants.name,
        status: tenants.status,
      })
      .from(tenants)
      .where(eq(tenants.id, DEFAULT_TENANT_ID))
      .limit(1);
    return pilotRecord
      ? {
          tenantId: pilotRecord.id,
          role: "planner",
          isDefault: true,
          tenantName: pilotRecord.name,
          tenantStatus: pilotRecord.status,
        }
      : undefined;
  }
  return (
    memberships.find(
      membership => membership.tenantId === input.preferredTenantId
    ) ?? memberships.find(membership => membership.isDefault) ?? memberships[0]
  );
}

async function makeTenantMembershipDefault(
  tx: DBClient,
  userId: number,
  tenantId: string
) {
  await tx
    .update(userTenantMemberships)
    .set({ isDefault: false })
    .where(eq(userTenantMemberships.userId, userId));
  await tx
    .update(userTenantMemberships)
    .set({ isDefault: true })
    .where(
      and(
        eq(userTenantMemberships.userId, userId),
        eq(userTenantMemberships.tenantId, tenantId)
      )
    );
}

export async function ensureTenantMembership(input: {
  userId: number;
  tenantId: string;
  role: "tenant_admin" | "planner";
  makeDefault?: boolean;
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const [tenantRecord] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .limit(1)
      .for("update");
    if (!tenantRecord) throw new Error("Der zugeordnete Verein wurde nicht gefunden");

    await tx
      .insert(userTenantMemberships)
      .values({
        userId: input.userId,
        tenantId: input.tenantId,
        role: input.role,
        status: "active",
        isDefault: false,
      })
      .onDuplicateKeyUpdate({
        set: {
          role: input.role,
          status: "active",
        },
      });

    const [defaultMembership] = await tx
      .select({ id: userTenantMemberships.id })
      .from(userTenantMemberships)
      .where(
        and(
          eq(userTenantMemberships.userId, input.userId),
          eq(userTenantMemberships.isDefault, true)
        )
      )
      .limit(1)
      .for("update");
    if (input.makeDefault || !defaultMembership) {
      await makeTenantMembershipDefault(tx, input.userId, input.tenantId);
    }
  });
}

/**
 * Ein Planungsteamzugang erhält ausschließlich Mitgliedschaften an Vereinen,
 * für die ihm mindestens eine Veranstaltung freigegeben wurde. Die erste
 * freigegebene Zuordnung wird beim erfolgreichen Login zum sicheren Standard.
 */
export async function synchronizePlanningTeamTenantMemberships(accessId: number) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const openId = planningTeamAccessOpenId(accessId);
    let [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1)
      .for("update");
    if (!user) {
      await tx.insert(users).values({
        openId,
        name: "Planungsteam",
        loginMethod: "password",
        role: "user",
        lastSignedIn: new Date(),
      });
      const [created] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1)
        .for("update");
      if (!created) throw new Error("Planungsteamkonto konnte nicht angelegt werden");
      user = created;
    }

    const rows = await tx
      .selectDistinct({ tenantId: events.tenantId })
      .from(planningTeamAccessEvents)
      .innerJoin(events, eq(events.id, planningTeamAccessEvents.eventId))
      .where(eq(planningTeamAccessEvents.accessId, accessId))
      .orderBy(events.tenantId);
    if (!rows.length) {
      // Falls einem Testzugang noch kein Event zugewiesen ist, greift der sichere Pilotmandant
      rows.push({ tenantId: DEFAULT_TENANT_ID });
    }

    for (const row of rows) {
      await tx
        .insert(userTenantMemberships)
        .values({
          userId: user.id,
          tenantId: row.tenantId,
          role: "planner",
          status: "active",
          isDefault: false,
        })
        .onDuplicateKeyUpdate({
          set: { role: "planner", status: "active" },
        });
    }
    await makeTenantMembershipDefault(tx, user.id, rows[0].tenantId);
    return rows.map(row => row.tenantId);
  });
}

const year = () => currentEventYear();
const event = () => currentEventId();
const tenant = () => currentTenantId();

function planningScope(table: { year: any; eventId: any }) {
  return and(eq(table.year, year()), eq(table.eventId, event()));
}

function planningScopeFor(
  table: { year: any; eventId: any },
  selectedYear: number,
  selectedEventId: number
) {
  return and(eq(table.year, selectedYear), eq(table.eventId, selectedEventId));
}

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
  return db
    .selectDistinct({ year: eventYears.year, label: eventYears.label, createdAt: eventYears.createdAt })
    .from(events)
    .innerJoin(eventYears, eq(eventYears.year, events.year))
    .where(eq(events.tenantId, tenant()))
    .orderBy(eventYears.year);
}

export async function listTenants() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tenants)
    .orderBy(tenants.status, tenants.name);
}

/**
 * Plattformweite, ausschließlich lesende Übersicht für das Master-Admin-Portal.
 * Sie enthält bewusst keine Planungs-, Helfer- oder Anmeldedaten einzelner Vereine.
 */
export async function listTenantOverviewsForPlatformAdmin() {
  const db = await getDb();
  if (!db) return [];
  const [tenantRows, eventRows] = await Promise.all([
    db.select().from(tenants).orderBy(tenants.status, tenants.name),
    db
      .select({
        id: events.id,
        tenantId: events.tenantId,
        year: events.year,
        name: events.name,
        startDate: events.startDate,
        endDate: events.endDate,
      })
      .from(events)
      .orderBy(events.tenantId, events.startDate, events.year, events.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return tenantRows.map(tenantRow => {
    const tenantEvents = eventRows.filter(eventRow => eventRow.tenantId === tenantRow.id);
    const nextEvent =
      tenantEvents.find(eventRow => eventRow.startDate !== null && eventRow.startDate >= today) ??
      tenantEvents.find(eventRow => eventRow.startDate !== null) ??
      tenantEvents[0] ??
      null;
    return {
      id: tenantRow.id,
      name: tenantRow.name,
      legalName: tenantRow.legalName,
      status: tenantRow.status,
      planName: tenantRow.planName,
      contactEmail: tenantRow.contactEmail,
      supportEmail: tenantRow.supportEmail,
      createdAt: tenantRow.createdAt,
      eventCount: tenantEvents.length,
      nextEvent: nextEvent
        ? {
            id: nextEvent.id,
            name: nextEvent.name,
            year: nextEvent.year,
            startDate: nextEvent.startDate,
            endDate: nextEvent.endDate,
          }
        : null,
    };
  });
}

/**
 * Ausschließlich für das geschützte Master-Portal: liefert die tatsächlich
 * anmeldefähigen persönlichen Zugänge mit ihrem Mandantenbezug. Passworthashes
 * sowie Einladungs-Token bleiben dabei konsequent außerhalb der Antwort.
 */
export type PlatformAccessInventoryItem = {
  type: "tenant_admin" | "planning_team";
  accessId: number;
  name: string;
  email: string | null;
  status: "active" | "suspended" | "legacy";
  tenantNames: string[];
  createdAt: Date;
  hasDuplicateEmail: boolean;
};

export async function listPlatformAccessInventoryForPlatformAdmin(): Promise<
  PlatformAccessInventoryItem[]
> {
  const database = await getDb();
  if (!database) return [];

  const [tenantAdminRows, membershipRows, planningRows, planningEventRows] =
    await Promise.all([
      database
        .select({
          accessId: tenantAdminCredentials.userId,
          name: users.name,
          email: tenantAdminCredentials.email,
          status: tenantAdminCredentials.status,
          createdAt: tenantAdminCredentials.createdAt,
        })
        .from(tenantAdminCredentials)
        .innerJoin(users, eq(users.id, tenantAdminCredentials.userId))
        .orderBy(asc(tenantAdminCredentials.email)),
      database
        .select({
          userId: userTenantMemberships.userId,
          tenantName: tenants.name,
        })
        .from(userTenantMemberships)
        .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
        .where(eq(userTenantMemberships.role, "tenant_admin")),
      database
        .select({
          accessId: planningTeamAccesses.id,
          label: planningTeamAccesses.label,
          email: planningTeamAccesses.email,
          createdAt: planningTeamAccesses.createdAt,
        })
        .from(planningTeamAccesses)
        .orderBy(asc(planningTeamAccesses.label), asc(planningTeamAccesses.id)),
      database
        .select({
          accessId: planningTeamAccessEvents.accessId,
          tenantName: tenants.name,
        })
        .from(planningTeamAccessEvents)
        .innerJoin(events, eq(events.id, planningTeamAccessEvents.eventId))
        .innerJoin(tenants, eq(tenants.id, events.tenantId)),
    ]);

  const tenantNamesByUser = new Map<number, string[]>();
  for (const row of membershipRows) {
    const current = tenantNamesByUser.get(row.userId) ?? [];
    if (!current.includes(row.tenantName)) current.push(row.tenantName);
    tenantNamesByUser.set(row.userId, current);
  }
  const tenantNamesByPlanningAccess = new Map<number, string[]>();
  for (const row of planningEventRows) {
    const current = tenantNamesByPlanningAccess.get(row.accessId) ?? [];
    if (!current.includes(row.tenantName)) current.push(row.tenantName);
    tenantNamesByPlanningAccess.set(row.accessId, current);
  }

  const items: PlatformAccessInventoryItem[] = [
    ...tenantAdminRows.map(row => ({
      type: "tenant_admin" as const,
      accessId: row.accessId,
      name: row.name?.trim() || "Unbenannter Vereinsadministrator",
      email: row.email,
      status: row.status,
      tenantNames: tenantNamesByUser.get(row.accessId) ?? [],
      createdAt: row.createdAt,
      hasDuplicateEmail: false,
    })),
    ...planningRows.map(row => ({
      type: "planning_team" as const,
      accessId: row.accessId,
      name: row.label,
      email: row.email,
      status: row.email ? ("active" as const) : ("legacy" as const),
      tenantNames: tenantNamesByPlanningAccess.get(row.accessId) ?? [],
      createdAt: row.createdAt,
      hasDuplicateEmail: false,
    })),
  ];

  const emailCounts = new Map<string, number>();
  for (const item of items) {
    const email = item.email?.trim().toLocaleLowerCase("de-DE");
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }
  return items.map(item => ({
    ...item,
    hasDuplicateEmail:
      Boolean(item.email) &&
      (emailCounts.get(item.email!.trim().toLocaleLowerCase("de-DE")) ?? 0) > 1,
  }));
}

/**
 * Entfernt ausschließlich anmeldefähige Testzugänge. Planungs- und
 * Ansprechpartnerdaten bleiben ausdrücklich erhalten. Ein Vereinsadmin kann
 * mehreren Mandanten angehören; seine Löschung entzieht daher bewusst alle
 * persönlichen Vereinsadmin-Mitgliedschaften dieses Testkontos.
 */
export async function deletePlatformAccessForMasterAdmin(input: {
  type: "tenant_admin" | "planning_team";
  accessId: number;
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    if (input.type === "planning_team") {
      const [access] = await tx
        .select({ id: planningTeamAccesses.id, label: planningTeamAccesses.label })
        .from(planningTeamAccesses)
        .where(eq(planningTeamAccesses.id, input.accessId))
        .limit(1)
        .for("update");
      if (!access) throw new Error("Planungsteam-Zugang wurde nicht gefunden");

      // Die abhängigen Einladungen und Eventfreigaben werden über Datenbank-
      // Fremdschlüssel entfernt; der zugehörige Login-Benutzer wird danach
      // gelöscht und damit jede bestehende Sitzung ungültig.
      await tx.delete(planningTeamAccesses).where(eq(planningTeamAccesses.id, access.id));
      await tx
        .delete(users)
        .where(eq(users.openId, planningTeamAccessOpenId(access.id)));
      return {
        type: input.type,
        name: access.label,
        removedTenantCount: 0,
      } as const;
    }

    const [admin] = await tx
      .select({
        userId: tenantAdminCredentials.userId,
        email: tenantAdminCredentials.email,
        name: users.name,
        openId: users.openId,
      })
      .from(tenantAdminCredentials)
      .innerJoin(users, eq(users.id, tenantAdminCredentials.userId))
      .where(eq(tenantAdminCredentials.userId, input.accessId))
      .limit(1)
      .for("update");
    if (!admin) throw new Error("Vereinsadmin-Zugang wurde nicht gefunden");
    if (!admin.openId.startsWith("tenant-admin:")) {
      throw new Error("Dieser Zugang ist kein löschbarer persönlicher Vereinsadmin-Testzugang");
    }

    const memberships = await tx
      .select({ id: userTenantMemberships.id })
      .from(userTenantMemberships)
      .where(eq(userTenantMemberships.userId, admin.userId))
      .for("update");
    // Durch die Kaskaden werden Credentials, Einladungen, Mitgliedschaften und
    // Anwesenheit dieses privaten Login-Kontos atomar aufgehoben.
    await tx.delete(users).where(eq(users.id, admin.userId));
    return {
      type: input.type,
      name: admin.name?.trim() || admin.email,
      removedTenantCount: memberships.length,
    } as const;
  });
}

export type PlatformTenantSetupStatus = "pilot" | "sample";
export type PlatformTenantLifecycleStatus =
  | "pilot"
  | "sample"
  | "suspended"
  | "archived";

function tenantSlugFromName(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 84);
  return base.length >= 3 ? base : "verein";
}

async function nextAvailableTenantId(tx: DBClient, name: string) {
  const base = tenantSlugFromName(name);
  for (let sequence = 0; sequence < 500; sequence++) {
    const suffix = sequence === 0 ? "" : `-${sequence + 1}`;
    const candidate = `${base.slice(0, 96 - suffix.length)}${suffix}`;
    const [existing] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Für diesen Vereinsnamen konnte keine eindeutige Kennung erzeugt werden");
}

/**
 * Legt ausschließlich einen internen Pilot- oder Musterverein an. Ein Status
 * "active" ist absichtlich nicht möglich: öffentliche Freischaltung bleibt ein
 * späterer, gesondert abgesicherter Marktstartschritt.
 */
export async function createTenantForPlatformAdmin(input: {
  name: string;
  legalName: string;
  contactEmail: string;
  supportEmail: string;
  status: PlatformTenantSetupStatus;
  planName: string;
  initialEventName: string;
  initialEventYear: number;
  activeDays: Weekday[];
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const name = input.name.trim();
    const legalName = input.legalName.trim();
    const contactEmail = input.contactEmail.trim().toLocaleLowerCase("de-DE");
    const supportEmail = input.supportEmail.trim().toLocaleLowerCase("de-DE");
    const planName = input.planName.trim();
    const initialEventName = normalizeEventName(input.initialEventName);
    if (!name || !legalName || !contactEmail || !supportEmail || !planName || !initialEventName) {
      throw new Error("Die Vereins- und Startangaben sind unvollständig");
    }
    if (!input.activeDays.length) {
      throw new Error("Für die Startveranstaltung muss mindestens ein Veranstaltungstag gewählt sein");
    }
    const [sameName] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.name, name))
      .limit(1)
      .for("update");
    if (sameName) {
      throw new Error("Ein Verein mit diesem Namen ist bereits angelegt");
    }
    const tenantId = await nextAvailableTenantId(tx, name);
    const [yearRecord] = await tx
      .select({ year: eventYears.year })
      .from(eventYears)
      .where(eq(eventYears.year, input.initialEventYear))
      .limit(1)
      .for("update");
    if (!yearRecord) {
      await tx.insert(eventYears).values({
        year: input.initialEventYear,
        label: `Veranstaltungsjahr ${input.initialEventYear}`,
      });
    }

    await tx.insert(tenants).values({
      id: tenantId,
      name,
      legalName,
      status: input.status,
      planName,
      contactEmail,
      supportEmail,
    });
    const eventResult: any = await tx.insert(events).values({
      tenantId,
      year: input.initialEventYear,
      name: initialEventName,
      activeDays: input.activeDays,
      sortOrder: 0,
    });
    const eventId = Number(eventResult?.[0]?.insertId ?? eventResult?.insertId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new Error("Die Startveranstaltung konnte nicht angelegt werden");
    }
    return { tenantId, eventId, status: input.status } as const;
  });
}

/** Beschränkt Statusänderungen vor dem Marktstart auf interne Lebenszykluswerte. */
export async function updateTenantLifecycleForPlatformAdmin(input: {
  tenantId: string;
  status: PlatformTenantLifecycleStatus;
}) {
  const database = (await getDb()) as DB;
  const result: any = await database
    .update(tenants)
    .set({ status: input.status })
    .where(eq(tenants.id, input.tenantId));
  const affected = Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
  if (!affected) throw new Error("Der Verein wurde nicht gefunden");
  return { tenantId: input.tenantId, status: input.status } as const;
}

export async function getTenant(id = tenant()) {
  const db = await getDb();
  if (!db) return undefined;
  const [selected] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return selected;
}

export async function ensureEventYear(eventYear = year()) {
  const db = (await getDb()) as DB;
  const label = `Veranstaltungsjahr ${eventYear}`;
  await db
    .insert(eventYears)
    .values({ year: eventYear, label })
    .onDuplicateKeyUpdate({ set: { label } });
  return eventYear;
}

export async function listEvents(eventYear = year()) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.tenantId, tenant()), eq(events.year, eventYear)))
    .orderBy(events.sortOrder, events.name, events.id);
  return rows.map(row => ({
    ...row,
    activeDays: eventWeekdays(row.activeDays),
  }));
}

export type PlanningTeamAccessSummary = {
  id: number;
  contactId: number | null;
  contactName: string | null;
  label: string;
  email: string | null;
  modulePermissions: import("../shared/tenant-permissions").PlanningModule[];
  eventIds: number[];
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PlanningTeamAccessCredential = {
  id: number;
  contactName: string | null;
  label: string;
  email: string | null;
  modulePermissions: import("../shared/tenant-permissions").PlanningModule[];
  passwordHash: string;
  mustChangePassword: boolean;
  sessionVersion: number;
};

function distinctEventIds(eventIds: number[]) {
  const normalized = Array.from(new Set(eventIds));
  if (!normalized.length) {
    throw new Error("Mindestens eine Veranstaltung muss freigegeben werden");
  }
  return normalized;
}

async function requireExistingEvents(tx: DBClient, eventIds: number[]) {
  const normalized = distinctEventIds(eventIds);
  const rows = await tx
    .select({ id: events.id })
    .from(events)
    .where(and(inArray(events.id, normalized), eq(events.tenantId, tenant())))
    .for("update");
  if (rows.length !== normalized.length) {
    throw new Error("Mindestens eine ausgewählte Veranstaltung wurde nicht gefunden");
  }
  return normalized;
}

async function requireExistingContactForPlanningTeamAccess(
  tx: DBClient,
  contactId: number
) {
  const [contact] = await tx
    .select({ id: contacts.id, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)
    .for("update");
  if (!contact) {
    throw new Error("Der ausgewählte Ansprechpartner wurde nicht gefunden");
  }
  return contact;
}

export async function listPlanningTeamAccesses(): Promise<
  PlanningTeamAccessSummary[]
> {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({
      id: planningTeamAccesses.id,
      contactId: planningTeamAccesses.contactId,
      contactName: contacts.name,
      label: planningTeamAccesses.label,
      email: planningTeamAccesses.email,
      modulePermissions: planningTeamAccesses.modulePermissions,
      mustChangePassword: planningTeamAccesses.mustChangePassword,
      createdAt: planningTeamAccesses.createdAt,
      updatedAt: planningTeamAccesses.updatedAt,
      eventId: planningTeamAccessEvents.eventId,
    })
    .from(planningTeamAccesses)
    .leftJoin(contacts, eq(contacts.id, planningTeamAccesses.contactId))
    .leftJoin(
      planningTeamAccessEvents,
      eq(planningTeamAccessEvents.accessId, planningTeamAccesses.id)
    )
    .orderBy(planningTeamAccesses.label, planningTeamAccesses.id);

  const grouped = new Map<number, PlanningTeamAccessSummary>();
  for (const row of rows) {
    const current = grouped.get(row.id) ?? {
      id: row.id,
      contactId: row.contactId,
      contactName: row.contactName,
      label: row.label,
      email: row.email ?? null,
      modulePermissions: Array.isArray(row.modulePermissions) ? row.modulePermissions : [],
      eventIds: [],
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    if (row.eventId !== null) current.eventIds.push(row.eventId);
    grouped.set(row.id, current);
  }
  return Array.from(grouped.values()).map(access => ({
    ...access,
    eventIds: access.eventIds.sort((a, b) => a - b),
  }));
}

export async function listPlanningTeamAccessCredentials(): Promise<
  PlanningTeamAccessCredential[]
> {
  const database = await getDb();
  if (!database) return [];
  return database
    .select({
      id: planningTeamAccesses.id,
      contactName: contacts.name,
      label: planningTeamAccesses.label,
      email: planningTeamAccesses.email,
      modulePermissions: sql<import("../shared/tenant-permissions").PlanningModule[]>`COALESCE(${planningTeamAccesses.modulePermissions}, JSON_ARRAY())`,
      passwordHash: planningTeamAccesses.passwordHash,
      mustChangePassword: planningTeamAccesses.mustChangePassword,
      sessionVersion: planningTeamAccesses.sessionVersion,
    })
    .from(planningTeamAccesses)
    .leftJoin(contacts, eq(contacts.id, planningTeamAccesses.contactId))
    .orderBy(planningTeamAccesses.id);
}

/** Liefert einen persönlichen Planungsteam-Zugang ausschließlich über seine E-Mail-Adresse. */
export async function getPlanningTeamAccessCredentialByEmail(email: string) {
  const database = await getDb();
  if (!database) return undefined;
  const normalizedEmail = email.trim().toLocaleLowerCase("de-DE");
  const [row] = await database
    .select({
      id: planningTeamAccesses.id,
      contactName: contacts.name,
      label: planningTeamAccesses.label,
      email: planningTeamAccesses.email,
      modulePermissions: sql<import("../shared/tenant-permissions").PlanningModule[]>`COALESCE(${planningTeamAccesses.modulePermissions}, JSON_ARRAY())`,
      passwordHash: planningTeamAccesses.passwordHash,
      mustChangePassword: planningTeamAccesses.mustChangePassword,
      sessionVersion: planningTeamAccesses.sessionVersion,
    })
    .from(planningTeamAccesses)
    .leftJoin(contacts, eq(contacts.id, planningTeamAccesses.contactId))
    .where(eq(planningTeamAccesses.email, normalizedEmail))
    .limit(1);
  return row;
}

async function assertNoActiveTenantAdminEmailConflict(
  tx: any,
  normalizedEmail: string | null
) {
  if (!normalizedEmail) return;
  const [tenantAdmin] = await tx
    .select({ userId: tenantAdminCredentials.userId })
    .from(tenantAdminCredentials)
    .where(
      and(
        eq(tenantAdminCredentials.email, normalizedEmail),
        eq(tenantAdminCredentials.status, "active")
      )
    )
    .limit(1)
    .for("update");
  if (tenantAdmin) {
    throw new Error(
      "Diese E-Mail-Adresse ist bereits einem aktiven Vereinsadministrator zugeordnet. Bitte für den Planungsteam-Zugang eine andere E-Mail-Adresse verwenden."
    );
  }
}

export async function createPlanningTeamAccess(input: {
  label: string;
  contactId?: number | null;
  email?: string | null;
  modulePermissions?: import("../shared/tenant-permissions").PlanningModule[];
  passwordHash: string;
  mustChangePassword?: boolean;
  eventIds: number[];
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const eventIds = await requireExistingEvents(tx, input.eventIds);
    const contact = input.contactId
      ? await requireExistingContactForPlanningTeamAccess(tx, input.contactId)
      : null;
    const normalizedEmail = input.email?.trim().toLocaleLowerCase("de-DE") || null;
    await assertNoActiveTenantAdminEmailConflict(tx, normalizedEmail);
    const result: any = await tx.insert(planningTeamAccesses).values({
      contactId: contact?.id ?? null,
      label: contact?.name ?? input.label.trim(),
      email: normalizedEmail,
      modulePermissions: input.modulePermissions ?? [],
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword ?? false,
      sessionVersion: 1,
    });
    const id = Number(result?.[0]?.insertId ?? result?.insertId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Planungsteam-Zugang konnte nicht angelegt werden");
    }
    await tx.insert(planningTeamAccessEvents).values(
      eventIds.map(eventId => ({ accessId: id, eventId }))
    );
    const [access] = await tx
      .select()
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, id))
      .limit(1);
    if (!access) throw new Error("Planungsteam-Zugang konnte nicht gelesen werden");
    return { ...access, eventIds };
  });
}

export async function updatePlanningTeamAccess(input: {
  id: number;
  label: string;
  contactId?: number | null;
  email?: string | null;
  modulePermissions?: import("../shared/tenant-permissions").PlanningModule[];
  passwordHash?: string;
  mustChangePassword?: boolean;
  eventIds: number[];
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const eventIds = await requireExistingEvents(tx, input.eventIds);
    const [existing] = await tx
      .select({
        id: planningTeamAccesses.id,
        contactId: planningTeamAccesses.contactId,
        email: planningTeamAccesses.email,
        modulePermissions: planningTeamAccesses.modulePermissions,
        sessionVersion: planningTeamAccesses.sessionVersion,
      })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, input.id))
      .limit(1)
      .for("update");
    if (!existing) throw new Error("Planungsteam-Zugang wurde nicht gefunden");
    const nextContactId =
      input.contactId === undefined ? existing.contactId : input.contactId;
    const contact = nextContactId
      ? await requireExistingContactForPlanningTeamAccess(tx, nextContactId)
      : null;
    const nextEmail =
      input.email === undefined
        ? existing.email
        : input.email?.trim().toLocaleLowerCase("de-DE") || null;
    const nextPermissions =
      input.modulePermissions === undefined
        ? existing.modulePermissions
        : input.modulePermissions;
    await assertNoActiveTenantAdminEmailConflict(tx, nextEmail);

    await tx
      .update(planningTeamAccesses)
      .set({
        contactId: contact?.id ?? null,
        label: contact?.name ?? input.label.trim(),
        email: nextEmail,
        modulePermissions: nextPermissions ?? [],
        ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
        ...(input.mustChangePassword !== undefined
          ? { mustChangePassword: input.mustChangePassword }
          : {}),
        sessionVersion: existing.sessionVersion + 1,
      })
      .where(eq(planningTeamAccesses.id, input.id));
    await tx
      .delete(planningTeamAccessEvents)
      .where(eq(planningTeamAccessEvents.accessId, input.id));
    await tx.insert(planningTeamAccessEvents).values(
      eventIds.map(eventId => ({ accessId: input.id, eventId }))
    );
    const [access] = await tx
      .select()
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, input.id))
      .limit(1);
    if (!access) throw new Error("Planungsteam-Zugang konnte nicht gelesen werden");
    return { ...access, eventIds };
  });
}

export async function isPlanningTeamAccessPasswordChangeRequired(accessId: number) {
  const database = await getDb();
  if (!database) return false;
  const [access] = await database
    .select({ mustChangePassword: planningTeamAccesses.mustChangePassword })
    .from(planningTeamAccesses)
    .where(eq(planningTeamAccesses.id, accessId))
    .limit(1);
  return access?.mustChangePassword ?? false;
}

/**
 * Stellt einen neuen, zeitlich begrenzten Aktivierungslink aus. Der bisherige
 * Link desselben Vereins wird gleichzeitig unbrauchbar. Sitzungen werden erst
 * bei tatsächlicher Linkeinlösung entwertet, damit ein SMTP-Fehler keinen
 * bestehenden Zugang unbeabsichtigt sperrt.
 */
export async function createPlanningTeamInvitation(input: {
  accessId: number;
  tenantId: string;
  tokenHash: string;
  expiresInSeconds?: number;
}) {
  const database = (await getDb()) as DB;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (input.expiresInSeconds ?? 48 * 60 * 60) * 1000
  );
  return database.transaction(async tx => {
    const [access] = await tx
      .select({ id: planningTeamAccesses.id })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, input.accessId))
      .limit(1)
      .for("update");
    if (!access) throw new Error("Planungsteam-Zugang wurde nicht gefunden");

    const [allowedEvent] = await tx
      .select({ eventId: planningTeamAccessEvents.eventId })
      .from(planningTeamAccessEvents)
      .innerJoin(events, eq(events.id, planningTeamAccessEvents.eventId))
      .where(
        and(
          eq(planningTeamAccessEvents.accessId, input.accessId),
          eq(events.tenantId, input.tenantId)
        )
      )
      .limit(1)
      .for("update");
    if (!allowedEvent) {
      throw new Error("Der Planungsteam-Zugang ist für diesen Verein nicht freigegeben");
    }

    await tx
      .update(planningTeamInvitations)
      .set({ usedAt: now })
      .where(
        and(
          eq(planningTeamInvitations.accessId, input.accessId),
          eq(planningTeamInvitations.tenantId, input.tenantId),
          isNull(planningTeamInvitations.usedAt)
        )
      );
    await tx.insert(planningTeamInvitations).values({
      tokenHash: input.tokenHash,
      accessId: input.accessId,
      tenantId: input.tenantId,
      expiresAt,
    });
    return { expiresAt } as const;
  });
}

/** Löst einen Planungsteam-Aktivierungslink atomar genau einmal ein. */
export async function consumePlanningTeamInvitation(tokenHash: string) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const now = new Date();
    const [row] = await tx
      .select({
        accessId: planningTeamInvitations.accessId,
        tenantId: planningTeamInvitations.tenantId,
        label: planningTeamAccesses.label,
        email: planningTeamAccesses.email,
        contactName: contacts.name,
        sessionVersion: planningTeamAccesses.sessionVersion,
      })
      .from(planningTeamInvitations)
      .innerJoin(
        planningTeamAccesses,
        eq(planningTeamAccesses.id, planningTeamInvitations.accessId)
      )
      .leftJoin(contacts, eq(contacts.id, planningTeamAccesses.contactId))
      .innerJoin(
        planningTeamAccessEvents,
        eq(planningTeamAccessEvents.accessId, planningTeamAccesses.id)
      )
      .innerJoin(
        events,
        and(
          eq(events.id, planningTeamAccessEvents.eventId),
          eq(events.tenantId, planningTeamInvitations.tenantId)
        )
      )
      .where(
        and(
          eq(planningTeamInvitations.tokenHash, tokenHash),
          isNull(planningTeamInvitations.usedAt),
          gt(planningTeamInvitations.expiresAt, now)
        )
      )
      .limit(1)
      .for("update");
    if (!row) return null;
    await tx
      .update(planningTeamInvitations)
      .set({ usedAt: now })
      .where(eq(planningTeamInvitations.tokenHash, tokenHash));
    const sessionVersion = row.sessionVersion + 1;
    await tx
      .update(planningTeamAccesses)
      .set({ mustChangePassword: true, sessionVersion })
      .where(eq(planningTeamAccesses.id, row.accessId));
    return { ...row, sessionVersion };
  });
}

/**
 * Ersetzt ausschließlich einen einmalig ausgegebenen Zugangscode. Die neue
 * Sitzungsnummer entwertet alle bisherigen Sitzungstoken des Zugangs.
 */
export async function completePlanningTeamInitialPasswordChange(input: {
  accessId: number;
  passwordHash: string;
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const [access] = await tx
      .select({
        id: planningTeamAccesses.id,
        sessionVersion: planningTeamAccesses.sessionVersion,
        mustChangePassword: planningTeamAccesses.mustChangePassword,
      })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, input.accessId))
      .limit(1)
      .for("update");
    if (!access) throw new Error("Planungsteam-Zugang wurde nicht gefunden");
    if (!access.mustChangePassword) {
      throw new Error("Für diesen Zugang ist kein Passwortwechsel erforderlich");
    }

    const sessionVersion = access.sessionVersion + 1;
    await tx
      .update(planningTeamAccesses)
      .set({
        passwordHash: input.passwordHash,
        mustChangePassword: false,
        sessionVersion,
      })
      .where(eq(planningTeamAccesses.id, input.accessId));
    return { id: access.id, sessionVersion };
  });
}

export async function deletePlanningTeamAccess(accessId: number) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const [access] = await tx
      .select({ id: planningTeamAccesses.id, label: planningTeamAccesses.label })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, accessId))
      .limit(1)
      .for("update");
    if (!access) throw new Error("Planungsteam-Zugang wurde nicht gefunden");
    await tx.delete(planningTeamAccesses).where(eq(planningTeamAccesses.id, accessId));
    await tx
      .delete(users)
      .where(eq(users.openId, planningTeamAccessOpenId(accessId)));
    return { deletedId: access.id, deletedLabel: access.label };
  });
}

export async function isPlanningTeamAccessAllowedForEvent(
  accessId: number,
  eventId: number
) {
  const database = await getDb();
  if (!database) return false;
  const [access] = await database
    .select({ accessId: planningTeamAccessEvents.accessId })
    .from(planningTeamAccessEvents)
    .where(
      and(
        eq(planningTeamAccessEvents.accessId, accessId),
        eq(planningTeamAccessEvents.eventId, eventId)
      )
    )
    .limit(1);
  return Boolean(access);
}

export async function listEventYearsForPlanningTeamAccess(accessId: number) {
  const database = await getDb();
  if (!database) return [];
  return database
    .selectDistinct({ year: eventYears.year, label: eventYears.label })
    .from(planningTeamAccessEvents)
    .innerJoin(events, eq(events.id, planningTeamAccessEvents.eventId))
    .innerJoin(eventYears, eq(eventYears.year, events.year))
    .where(
      and(
        eq(planningTeamAccessEvents.accessId, accessId),
        eq(events.tenantId, tenant())
      )
    )
    .orderBy(eventYears.year);
}

export async function listEventsForPlanningTeamAccess(
  accessId: number,
  eventYear = year()
) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({ event: events })
    .from(planningTeamAccessEvents)
    .innerJoin(events, eq(events.id, planningTeamAccessEvents.eventId))
    .where(
      and(
        eq(planningTeamAccessEvents.accessId, accessId),
        eq(events.tenantId, tenant()),
        eq(events.year, eventYear)
      )
    )
    .orderBy(events.sortOrder, events.name, events.id);
  return rows.map(({ event }) => ({
    ...event,
    activeDays: eventWeekdays(event.activeDays),
  }));
}

export async function listAllEventsForPlanningTeamAccess(accessId: number) {
  const years = await listEventYearsForPlanningTeamAccess(accessId);
  const grouped = await Promise.all(
    years.map(item => listEventsForPlanningTeamAccess(accessId, item.year))
  );
  return grouped.flat();
}

export async function getHelper(helperId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [helper] = await db
    .select()
    .from(helpers)
    .where(and(eq(helpers.id, helperId), planningScope(helpers)))
    .limit(1);
  return helper;
}

export async function getHelperByPdfShareCode(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [helper] = await db
    .select()
    .from(helpers)
    .where(eq(helpers.pdfShareCode, shareCode))
    .limit(1);
  return helper;
}

function createPdfShareCode() {
  return randomBytes(6).toString("base64url");
}

/**
 * Erstellt bei der ersten Freigabe einen kurzen zufälligen Code für /p/:code.
 * Die Helfer-ID wird absichtlich nicht offen gelegt und kann nicht hochgezählt
 * werden. Ein globaler Unique-Index verhindert Code-Kollisionen.
 */
export async function ensureHelperPdfShareCode(helperId: number) {
  const database = (await getDb()) as DB;
  const helper = await getHelper(helperId);
  if (!helper) throw new Error("Helfer wurde nicht gefunden");
  if (helper.pdfShareCode) return helper.pdfShareCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = createPdfShareCode();
    try {
      const result = await database
        .update(helpers)
        .set({ pdfShareCode: shareCode })
        .where(
          and(
            eq(helpers.id, helperId),
            planningScope(helpers),
            isNull(helpers.pdfShareCode)
          )
        );
      if (Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0) {
        return shareCode;
      }
      const refreshed = await getHelper(helperId);
      if (refreshed?.pdfShareCode) return refreshed.pdfShareCode;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }

  throw new Error("PDF-Freigabecode konnte nicht erstellt werden");
}

export async function getEvent(id = event()) {
  const db = await getDb();
  if (!db) return undefined;
  const [selected] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, id),
        eq(events.tenantId, tenant()),
        eq(events.year, year())
      )
    )
    .limit(1);
  return selected
    ? { ...selected, activeDays: eventWeekdays(selected.activeDays) }
    : undefined;
}

export async function updateCurrentEventPdfImage(values: {
  pdfLogoKey?: string | null;
  pdfLogoUrl?: string | null;
  pdfLogoFallback?: "none" | "brand";
}) {
  const db = (await getDb()) as DB;
  const [selectedEvent] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.id, event()),
        eq(events.tenantId, tenant()),
        eq(events.year, year())
      )
    )
    .limit(1);
  if (!selectedEvent) throw new Error("Veranstaltung wurde nicht gefunden");
  await db
    .update(events)
    .set(values)
    .where(
      and(
        eq(events.id, event()),
        eq(events.tenantId, tenant()),
        eq(events.year, year())
      )
    );
  return values;
}

export async function withPlanningWriteLock<T>(callback: () => Promise<T>) {
  const database = (await getDb()) as DB;
  const selectedYear = year();
  const selectedEventId = event();
  return database.transaction(async tx => {
    const [selectedYearRow] = await tx
      .select({ year: eventYears.year })
      .from(eventYears)
      .where(eq(eventYears.year, selectedYear))
      .limit(1)
      .for("update");
    if (!selectedYearRow) {
      throw new Error("Das gewählte Veranstaltungsjahr ist nicht verfügbar");
    }
    const [selectedEvent] = await tx
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.id, selectedEventId),
          eq(events.tenantId, tenant()),
          eq(events.year, selectedYear)
        )
      )
      .limit(1)
      .for("update");
    if (!selectedEvent) {
      throw new Error(
        "Die gewählte Veranstaltung gehört nicht zum gewählten Veranstaltungsjahr"
      );
    }
    return planningWriteClientStorage.run(tx, callback);
  });
}

function normalizeEventName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function updateEventDetails(
  id: number,
  input: {
    name?: string;
    startDate?: string | null;
    endDate?: string | null;
    donationTargetKuchen?: number;
    donationTargetSalat?: number;
    donationTargetSnack?: number;
    donationTargetSonstiges?: number;
  }
) {
  const db = (await getDb()) as DB;
  const selectedYear = year();
  const selectedTenant = tenant();
  return db.transaction(async tx => {
    const [selected] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, id),
          eq(events.tenantId, selectedTenant),
          eq(events.year, selectedYear)
        )
      )
      .limit(1)
      .for("update");
    if (!selected) throw new Error("Veranstaltung wurde nicht gefunden");

    const nextName =
      input.name !== undefined ? normalizeEventName(input.name) : selected.name;
    if (!nextName) throw new Error("Veranstaltungsname darf nicht leer sein");
    if (input.name !== undefined) {
      const [duplicate] = await tx
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.tenantId, selectedTenant),
            eq(events.year, selectedYear),
            eq(events.name, nextName)
          )
        )
        .limit(1);
      if (duplicate && duplicate.id !== id) {
        throw new Error(
          "Eine Veranstaltung mit diesem Namen ist in diesem Jahr bereits vorhanden"
        );
      }
    }

    const startDate =
      input.startDate !== undefined ? input.startDate || null : selected.startDate;
    const endDate =
      input.endDate !== undefined ? input.endDate || null : selected.endDate;
    const datesError = eventDateRangeError({ startDate, endDate });
    if (datesError) throw new Error(datesError);
    const donationTargetKuchen =
      input.donationTargetKuchen ?? selected.donationTargetKuchen;
    const donationTargetSalat =
      input.donationTargetSalat ?? selected.donationTargetSalat;
    const donationTargetSnack =
      input.donationTargetSnack ?? selected.donationTargetSnack;
    const donationTargetSonstiges =
      input.donationTargetSonstiges ?? selected.donationTargetSonstiges;

    await tx
      .update(events)
      .set({
        name: nextName,
        startDate,
        endDate,
        donationTargetKuchen,
        donationTargetSalat,
        donationTargetSnack,
        donationTargetSonstiges,
      })
      .where(
        and(
          eq(events.id, id),
          eq(events.tenantId, selectedTenant),
          eq(events.year, selectedYear)
        )
      );

    return {
      ...selected,
      name: nextName,
      startDate,
      endDate,
      donationTargetKuchen,
      donationTargetSalat,
      donationTargetSnack,
      donationTargetSonstiges,
    };
  });
}

export async function createEvent(
  name: string,
  eventYear = year(),
  activeDays: Weekday[] = [...WEEKDAYS]
) {
  const db = (await getDb()) as DB;
  await ensureEventYear(eventYear);
  const normalizedName = normalizeEventName(name);
  const selectedTenant = tenant();
  const [existing] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.tenantId, selectedTenant),
        eq(events.year, eventYear),
        eq(events.name, normalizedName)
      )
    )
    .limit(1);
  if (existing)
    return {
      ...existing,
      activeDays: eventWeekdays(existing.activeDays),
      created: false,
    };
  const result: any = await db
    .insert(events)
    .values({
      tenantId: selectedTenant,
      year: eventYear,
      name: normalizedName,
      activeDays,
    });
  const id = Number(result?.[0]?.insertId ?? result?.insertId);
  return {
    id,
    tenantId: selectedTenant,
    year: eventYear,
    name: normalizedName,
    activeDays,
    pdfLogoKey: null,
    pdfLogoUrl: null,
    pdfLogoFallback: "none" as const,
    donationTargetKuchen: 0,
    donationTargetSalat: 0,
    donationTargetSnack: 0,
    donationTargetSonstiges: 0,
    created: true,
  };
}

export async function deleteEvent(id: number) {
  const db = (await getDb()) as DB;
  const selectedYear = year();
  const selectedTenant = tenant();
  return db.transaction(async tx => {
    const yearEvents = await tx
      .select()
      .from(events)
      .where(
        and(eq(events.tenantId, selectedTenant), eq(events.year, selectedYear))
      )
      .orderBy(events.sortOrder, events.name, events.id)
      .for("update");
    const selected = yearEvents.find(item => item.id === id);
    if (!selected) throw new Error("Veranstaltung wurde nicht gefunden");
    if (yearEvents.length <= 1) {
      throw new Error(
        "Die letzte Veranstaltung eines Jahres kann nicht gelöscht werden"
      );
    }

    const scope = <T extends { eventId: any }>(table: T) =>
      eq(table.eventId, id);
    await tx
      .delete(assignments)
      .where(
        inArray(
          assignments.shiftId,
          tx.select({ id: shifts.id }).from(shifts).where(scope(shifts))
        )
      );
    await tx.delete(shiftAreaContacts).where(scope(shiftAreaContacts));
    await tx.delete(shifts).where(scope(shifts));
    await tx.delete(prepTasks).where(scope(prepTasks));
    await tx.delete(gpxTracks).where(scope(gpxTracks));
    await tx.delete(locations).where(scope(locations));
    await tx.delete(postTasks).where(scope(postTasks));
    await tx.delete(materials).where(scope(materials));
    await tx.delete(marketing).where(scope(marketing));
    await tx.delete(approvals).where(scope(approvals));
    await tx.delete(cakes).where(scope(cakes));
    await tx.delete(finances).where(scope(finances));
    await tx.delete(helpers).where(scope(helpers));
    await tx.delete(contacts).where(scope(contacts));
    const result = await tx
      .delete(events)
      .where(
        and(
          eq(events.id, id),
          eq(events.tenantId, selectedTenant),
          eq(events.year, selectedYear)
        )
      );
    requireDeletedRows(result, 1);

    const nextEvent = yearEvents.find(item => item.id !== id)!;
    return {
      deletedId: id,
      deletedName: selected.name,
      nextEventId: nextEvent.id,
    };
  });
}

export async function listContacts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contacts)
    .where(planningScope(contacts))
    .orderBy(contacts.sortOrder, contacts.name);
}

/** Für die Administratorverwaltung aller eventübergreifenden Zugänge. */
export async function listAllContactsForPlanningTeamAccess() {
  const database = await getDb();
  if (!database) return [];
  return database
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      year: contacts.year,
      eventId: contacts.eventId,
      eventName: events.name,
    })
    .from(contacts)
    .innerJoin(events, eq(events.id, contacts.eventId))
    .orderBy(contacts.name, contacts.year, events.name, contacts.id);
}
export async function listLocations() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(locations)
    .where(planningScope(locations))
    .orderBy(locations.sortOrder, locations.name);
}
export async function getLocation(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [location] = await db
    .select()
    .from(locations)
    .where(and(eq(locations.id, id), planningScope(locations)))
    .limit(1);
  return location;
}
export async function createLocation(
  value: Pick<
    typeof locations.$inferInsert,
    "name" | "latitude" | "longitude" | "logoKey" | "logoUrl"
  >
) {
  const db = (await getDb()) as DB;
  const result: any = await db.insert(locations).values({
    ...value,
    year: year(),
    eventId: event(),
  });
  const id = Number(result?.[0]?.insertId ?? result?.insertId);
  const created = Number.isSafeInteger(id) ? await getLocation(id) : undefined;
  if (!created) throw new Error("Der neue Standort konnte nicht geladen werden");
  return created;
}
export async function updateLocation(
  id: number,
  value: Partial<
    Pick<
      typeof locations.$inferInsert,
      "name" | "latitude" | "longitude" | "logoKey" | "logoUrl"
    >
  >
) {
  const db = (await getDb()) as DB;
  return db
    .update(locations)
    .set(value)
    .where(and(eq(locations.id, id), planningScope(locations)));
}
export async function deleteLocation(id: number) {
  const db = (await getDb()) as DB;
  const result = await db
    .delete(locations)
    .where(and(eq(locations.id, id), planningScope(locations)));
  requireDeletedRows(result, 1);
  return { success: true } as const;
}
export async function listGpxTracks() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gpxTracks)
    .where(planningScope(gpxTracks))
    .orderBy(gpxTracks.name, gpxTracks.id);
}
export async function createGpxTrack(
  value: Pick<typeof gpxTracks.$inferInsert, "name" | "fileKey" | "fileUrl" | "color">
) {
  const db = (await getDb()) as DB;
  return db.insert(gpxTracks).values({
    ...value,
    year: year(),
    eventId: event(),
  });
}
export async function updateGpxTrackName(id: number, name: string) {
  const db = (await getDb()) as DB;
  const result = await db
    .update(gpxTracks)
    .set({ name })
    .where(and(eq(gpxTracks.id, id), planningScope(gpxTracks)));
  requireDeletedRows(result, 1);
  return { success: true } as const;
}
export async function deleteGpxTrack(id: number) {
  const db = (await getDb()) as DB;
  const result = await db
    .delete(gpxTracks)
    .where(and(eq(gpxTracks.id, id), planningScope(gpxTracks)));
  requireDeletedRows(result, 1);
  return { success: true } as const;
}
export async function getContact(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), planningScope(contacts)))
    .limit(1);
  return contact;
}
export async function listHelpers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(helpers)
    .where(planningScope(helpers))
    .orderBy(helpers.name);
}
export async function listShifts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shifts)
    .where(planningScope(shifts))
    .orderBy(shifts.day, shifts.sortOrder, shifts.startTime, shifts.id);
}
export async function listShiftAreaContacts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shiftAreaContacts)
    .where(planningScope(shiftAreaContacts))
    .orderBy(shiftAreaContacts.area);
}
export async function listAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ ...getTableColumns(assignments) })
    .from(assignments)
    .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
    .where(planningScope(shifts));
}
export async function listPrep() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(prepTasks)
    .where(and(planningScope(prepTasks), eq(prepTasks.deleted, false)))
    .orderBy(prepTasks.sortOrder, prepTasks.id);
}
export async function listPost() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(postTasks)
    .where(and(planningScope(postTasks), eq(postTasks.deleted, false)))
    .orderBy(postTasks.sortOrder, postTasks.id);
}
export async function listMaterials() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(materials)
    .where(and(planningScope(materials), eq(materials.deleted, false)))
    .orderBy(materials.sortOrder, materials.id);
}
export async function listMarketing() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(marketing)
    .where(planningScope(marketing))
    .orderBy(marketing.sortOrder, marketing.id);
}
export async function listApprovals() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(approvals)
    .where(planningScope(approvals))
    .orderBy(approvals.sortOrder, approvals.id);
}
export async function listCakes() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cakes)
    .where(planningScope(cakes))
    .orderBy(cakes.sortOrder, cakes.id);
}
export async function listFinances() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(finances)
    .where(planningScope(finances))
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

export type PlanningTeamLoginProtection = {
  failedAttempts: number;
  locked: boolean;
};

export async function getPlanningTeamLoginProtection(): Promise<PlanningTeamLoginProtection> {
  const settings = await getSecuritySettings();
  return {
    failedAttempts: settings?.planningTeamFailedAttempts ?? 0,
    locked: settings?.planningTeamLocked ?? false,
  };
}

export async function recordFailedPlanningTeamPasswordLogin(
  maxAttempts: number
): Promise<PlanningTeamLoginProtection> {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    await tx
      .insert(securitySettings)
      .values({ id: 1 })
      .onDuplicateKeyUpdate({ set: { id: 1 } });
    const [settings] = await tx
      .select({
        failedAttempts: securitySettings.planningTeamFailedAttempts,
        locked: securitySettings.planningTeamLocked,
      })
      .from(securitySettings)
      .where(eq(securitySettings.id, 1))
      .limit(1)
      .for("update");
    if (settings.locked) return settings;

    const failedAttempts = Math.min(
      settings.failedAttempts + 1,
      maxAttempts
    );
    const locked = failedAttempts >= maxAttempts;
    await tx
      .update(securitySettings)
      .set({ planningTeamFailedAttempts: failedAttempts, planningTeamLocked: locked })
      .where(eq(securitySettings.id, 1));
    return { failedAttempts, locked };
  });
}

export async function clearPlanningTeamLoginFailuresIfUnlocked() {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    await tx
      .insert(securitySettings)
      .values({ id: 1 })
      .onDuplicateKeyUpdate({ set: { id: 1 } });
    const [settings] = await tx
      .select({ locked: securitySettings.planningTeamLocked })
      .from(securitySettings)
      .where(eq(securitySettings.id, 1))
      .limit(1)
      .for("update");
    if (settings.locked) return false;
    await tx
      .update(securitySettings)
      .set({ planningTeamFailedAttempts: 0 })
      .where(eq(securitySettings.id, 1));
    return true;
  });
}

export async function unlockPlanningTeamLogin() {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    await tx
      .insert(securitySettings)
      .values({ id: 1 })
      .onDuplicateKeyUpdate({ set: { id: 1 } });
    await tx
      .update(securitySettings)
      .set({ planningTeamFailedAttempts: 0, planningTeamLocked: false })
      .where(eq(securitySettings.id, 1));
    return { failedAttempts: 0, locked: false } as const;
  });
}

export async function lockPlanningTeamLogin() {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    await tx
      .insert(securitySettings)
      .values({ id: 1 })
      .onDuplicateKeyUpdate({ set: { id: 1 } });
    await tx
      .update(securitySettings)
      .set({ planningTeamLocked: true })
      .where(eq(securitySettings.id, 1));
    return { locked: true } as const;
  });
}

export async function createContact(v: {
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  passwordHash?: string;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const { passwordHash, ...contactValues } = v;
    const normalizedName = v.name.trim().replace(/\s+/g, " ");
    const result: any = await tx.insert(contacts).values({
      ...contactValues,
      name: normalizedName,
      year: year(),
      eventId: event(),
    });
    const id = Number(result?.[0]?.insertId ?? result?.insertId);
    const helper = await syncContactToSelfHelperWithClient(tx, {
      id,
      name: normalizedName,
      phone: v.phone ?? null,
    });
    if (passwordHash) {
      const accessResult: any = await tx.insert(planningTeamAccesses).values({
        contactId: id,
        label: normalizedName,
        email: v.email?.trim().toLocaleLowerCase("de-DE") || null,
        passwordHash,
        sessionVersion: 1,
      });
      const accessId = Number(
        accessResult?.[0]?.insertId ?? accessResult?.insertId
      );
      await tx.insert(planningTeamAccessEvents).values({
        accessId,
        eventId: event(),
      });
    }
    return {
      id,
      helperId: helper.id,
      helperCreated: helper.created,
      accessCreated: Boolean(passwordHash),
    };
  });
}
export async function updateContact(
  id: number,
  v: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    note?: string | null;
    passwordHash?: string;
  }
) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [before] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), planningScope(contacts)))
      .limit(1);
    if (!before) throw new Error("Ansprechpartner wurde nicht gefunden");
    const { passwordHash, ...contactFields } = v;
    const values = {
      ...contactFields,
      ...(contactFields.name
        ? { name: contactFields.name.trim().replace(/\s+/g, " ") }
        : {}),
    };
    const contact = { ...before, ...values };
    const result = await tx
      .update(contacts)
      .set(values)
      .where(and(eq(contacts.id, id), planningScope(contacts)));
    await syncContactToSelfHelperWithClient(tx, contact, before.name);
    const [access] = await tx
      .select({ id: planningTeamAccesses.id, sessionVersion: planningTeamAccesses.sessionVersion })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.contactId, id))
      .limit(1)
      .for("update");
    if (access) {
      await tx
        .update(planningTeamAccesses)
        .set({
          label: contact.name,
          ...(passwordHash ? { passwordHash } : {}),
          sessionVersion: access.sessionVersion + 1,
        })
        .where(eq(planningTeamAccesses.id, access.id));
    } else if (passwordHash) {
      const accessResult: any = await tx.insert(planningTeamAccesses).values({
        contactId: id,
        label: contact.name,
        passwordHash,
        sessionVersion: 1,
      });
      const accessId = Number(
        accessResult?.[0]?.insertId ?? accessResult?.insertId
      );
      await tx.insert(planningTeamAccessEvents).values({
        accessId,
        eventId: before.eventId,
      });
    }
    return result;
  });
}
export async function deleteContact(id: number, actor: AuditActor) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [contact] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), planningScope(contacts)))
      .limit(1)
      .for("update");
    if (!contact) throw new Error("Ansprechpartner wurde nicht gefunden");

    const contactAccesses = await tx
      .select({ id: planningTeamAccesses.id })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.contactId, id))
      .for("update");
    if (contactAccesses.length) {
      await tx.delete(users).where(
        inArray(
          users.openId,
          contactAccesses.map(access => planningTeamAccessOpenId(access.id))
        )
      );
    }

    const linkedHelpers = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.contactId, id), planningScope(helpers)))
      .for("update");
    const selfHelper = linkedHelpers.find(
      helper =>
        normalizePersonName(helper.name) === normalizePersonName(contact.name)
    );

    if (selfHelper) {
      const helperAssignments = await tx
        .select({
          shiftId: assignments.shiftId,
          slot: assignments.slot,
        })
        .from(assignments)
        .where(eq(assignments.helperId, selfHelper.id))
        .for("update");
      await recordDeletionAudit(tx, actor, "single_delete", [
        helperAuditEntity(selfHelper, helperAssignments),
      ]);
      const helperResult = await tx
        .delete(helpers)
        .where(and(eq(helpers.id, selfHelper.id), planningScope(helpers)));
      requireDeletedRows(helperResult, 1);
    }

    // Vor dem Löschen des Ansprechpartners werden abhängige Mappings und Zuweisungen
    // transaktional aufgeräumt: Bereichskontakte werden gelöscht, Helfer- und
    // Aufgabenreferenzen entkoppelt (SET NULL).
    await tx
      .delete(shiftAreaContacts)
      .where(
        and(
          planningScope(shiftAreaContacts),
          eq(shiftAreaContacts.contactId, id)
        )
      );

    const clearContactReference = <TTable extends typeof helpers>(table: TTable) =>
      tx
        .update(table as any)
        .set({ contactId: null })
        .where(and(eq((table as any).contactId, id), planningScope(table as any)));
    await clearContactReference(helpers);
    await clearContactReference(prepTasks as any);
    await clearContactReference(postTasks as any);
    await clearContactReference(materials as any);
    await clearContactReference(marketing as any);
    await clearContactReference(approvals as any);

    const contactResult = await tx
      .delete(contacts)
      .where(and(eq(contacts.id, id), planningScope(contacts)));
    requireDeletedRows(contactResult, 1);
    return {
      deletedContactId: id,
      deletedHelperId: selfHelper?.id ?? null,
    };
  });
}

export async function upsertContactByName(v: {
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  passwordHash?: string;
}) {
  const existing = (await listContacts()).find(
    item => normalizePersonName(item.name) === normalizePersonName(v.name)
  );
  if (existing) {
    const updates = {
      ...(v.email ? { email: v.email.trim().toLocaleLowerCase("de-DE") } : {}),
      ...(v.phone ? { phone: v.phone } : {}),
      ...(v.note ? { note: v.note } : {}),
      ...(v.passwordHash ? { passwordHash: v.passwordHash } : {}),
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
    email: v.email ?? undefined,
    phone: v.phone ?? undefined,
    note: v.note ?? undefined,
    passwordHash: v.passwordHash,
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
  if (v.contactId !== undefined && v.contactId !== null) {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, v.contactId), planningScope(contacts)))
      .limit(1);
    if (!contact) {
      throw new Error(
        "Der Ansprechpartner gehört nicht zur ausgewählten Veranstaltung"
      );
    }
  }
  return db.insert(helpers).values({
    ...v,
    year: year(),
    eventId: event(),
  } as typeof helpers.$inferInsert);
}
export async function updateHelper(
  id: number,
  v: Partial<typeof helpers.$inferInsert>
) {
  const db = (await getDb()) as DB;
  const { year: ignored, eventId: ignoredEventId, ...safe } = v;
  const availabilityFields = [
    "willHelp",
    "availMon",
    "availTue",
    "availWed",
    "availThu",
    "availFri",
    "availSat",
    "availSun",
    "availMonStart",
    "availMonEnd",
    "availTueStart",
    "availTueEnd",
    "availWedStart",
    "availWedEnd",
    "availThuStart",
    "availThuEnd",
    "availFriStart",
    "availFriEnd",
    "availSatStart",
    "availSatEnd",
    "availSunStart",
    "availSunEnd",
  ] as const;
  const availabilityChanged = availabilityFields.some(
    field => safe[field] !== undefined
  );
  return db.transaction(async tx => {
    const [helper] = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.id, id), planningScope(helpers)))
      .limit(1);
    if (!helper) throw new Error("Helfer wurde nicht gefunden");
    if (safe.contactId !== undefined && safe.contactId !== null) {
      const [selectedContact] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, safe.contactId), planningScope(contacts)))
        .limit(1);
      if (!selectedContact) {
        throw new Error(
          "Der Ansprechpartner gehört nicht zur ausgewählten Veranstaltung"
        );
      }
    }
    const selfContact = helper.contactId
      ? (
          await tx
            .select()
            .from(contacts)
            .where(
              and(eq(contacts.id, helper.contactId), planningScope(contacts))
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
    const result = await tx
      .update(helpers)
      .set(safe)
      .where(and(eq(helpers.id, id), planningScope(helpers)));
    if (availabilityChanged) {
      const affectedAssignments = await tx
        .select({ shiftId: assignments.shiftId })
        .from(assignments)
        .where(and(eq(assignments.helperId, id), planningScope(assignments)));
      const affectedShiftIds = Array.from(
        new Set(affectedAssignments.map(assignment => assignment.shiftId))
      );
      if (affectedShiftIds.length) {
        await tx
          .update(shifts)
          .set({
            manualOkConfirmed: false,
            manualDoubleConflictAccepted: false,
          })
          .where(
            and(planningScope(shifts), inArray(shifts.id, affectedShiftIds))
          );
      }
    }
    return result;
  });
}

export type AuditActor = {
  userId: number;
  name: string;
  role: "user" | "admin";
  loginMethod?: string | null;
  responsibleContactId?: number | null;
  responsibleContactName?: string | null;
};

export type ActivityLogAction =
  | "created"
  | "updated"
  | "deleted"
  | "reset"
  | "imported"
  | "copied";

/** Schreibt eine erfolgreiche operative Aktion mit der serverseitigen Sitzungsidentität. */
export async function recordActivityLog(input: {
  actor: AuditActor;
  module: string;
  action: ActivityLogAction;
  subject: string;
}) {
  const database = (await getDb()) as DB;
  const selectedYear = year();
  const selectedEventId = event();
  let validEventId: number | null = null;
  let eventName = `Veranstaltung ${selectedYear}`;
  try {
    const [selectedEvent] = await database
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(
        and(eq(events.id, selectedEventId), eq(events.year, selectedYear))
      )
      .limit(1);
    if (selectedEvent) {
      validEventId = selectedEvent.id;
      eventName = selectedEvent.name;
    }
  } catch {
    // Bei Mock-Aufrufen ohne volles Event-Schema Fallback beibehalten
  }
  await database.insert(activityLogs).values({
    year: selectedYear,
    eventId: validEventId,
    eventName,
    module: input.module,
    action: input.action,
    subject: input.subject.slice(0, 500),
    actorUserId: input.actor.userId > 0 ? input.actor.userId : null,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    actorLoginMethod: input.actor.loginMethod ?? null,
  });
}

type AuditEntity = {
  entityType: "helper" | "cake" | "prep" | "post" | "material";
  entityId: number;
  entityLabel: string;
  details: Record<string, unknown>;
};

async function recordDeletionAudit(
  client: any,
  actor: AuditActor,
  action: "single_delete" | "area_reset" | "year_reset",
  entries: AuditEntity[],
  selectedYear = year(),
  selectedEventId = event()
) {
  if (!entries.length) return;
  const [selectedEvent] = await client
    .select({ name: events.name })
    .from(events)
    .where(
      and(eq(events.id, selectedEventId), eq(events.year, selectedYear))
    )
    .limit(1);
  if (!selectedEvent) {
    throw new Error(
      "Die ausgewählte Veranstaltung gehört nicht zum gewählten Jahr"
    );
  }
  await client.insert(deletionAuditLogs).values(
    entries.map(entry => ({
      year: selectedYear,
      eventId: selectedEventId,
      eventName: selectedEvent.name,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      action,
      actorUserId: actor.userId,
      actorName: actor.name,
      actorRole: actor.role,
      actorLoginMethod: actor.loginMethod ?? null,
      responsibleContactId: actor.responsibleContactId ?? null,
      responsibleContactName: actor.responsibleContactName ?? null,
      details: JSON.stringify(entry.details),
    }))
  );
}

function affectedRows(result: any) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

function requireDeletedRows(result: any, expected: number) {
  const actual = affectedRows(result);
  if (actual !== expected) {
    throw new Error(
      `Löschung wurde wegen einer gleichzeitigen Änderung abgebrochen (erwartet: ${expected}, gelöscht: ${actual})`
    );
  }
}

const helperAuditEntity = (
  helper: typeof helpers.$inferSelect,
  helperAssignments: Array<{ shiftId: number; slot: number }> = []
): AuditEntity => ({
  entityType: "helper",
  entityId: helper.id,
  entityLabel: helper.name,
  details: {
    contactId: helper.contactId,
    email: helper.email,
    phone: helper.phone,
    note: helper.note,
    willHelp: helper.willHelp,
    availMon: helper.availMon,
    availTue: helper.availTue,
    availWed: helper.availWed,
    availThu: helper.availThu,
    availFri: helper.availFri,
    availSat: helper.availSat,
    availSun: helper.availSun,
    confirmed: helper.confirmed,
    assignments: helperAssignments,
    assignmentCount: helperAssignments.length,
  },
});

const cakeAuditEntity = (cake: typeof cakes.$inferSelect): AuditEntity => ({
  entityType: "cake",
  entityId: cake.id,
  entityLabel: cake.donor,
  details: {
    cake: cake.cake,
    donationCategory: cake.donationCategory,
    dropoffTime: cake.dropoffTime,
    dropoffDate: cake.dropoffDate,
    vegan: cake.vegan,
    glutenFree: cake.glutenFree,
    lactoseFree: cake.lactoseFree,
    containsNuts: cake.containsNuts,
    meat: cake.meat,
    note: cake.note,
    sortOrder: cake.sortOrder,
  },
});

const prepAuditEntity = (task: typeof prepTasks.$inferSelect): AuditEntity => ({
  entityType: "prep",
  entityId: task.id,
  entityLabel: task.category?.trim()
    ? `${task.category.trim()} - ${task.task}`
    : task.task,
  details: {
    task: task.task,
    category: task.category,
    dueText: task.dueText,
    locationId: task.locationId,
    contactId: task.contactId,
    status: task.status,
    statusWording: task.statusWording,
    note: task.note,
    sortOrder: task.sortOrder,
  },
});

const postAuditEntity = (task: typeof postTasks.$inferSelect): AuditEntity => ({
  entityType: "post",
  entityId: task.id,
  entityLabel: task.category?.trim()
    ? `${task.category.trim()} - ${task.task}`
    : task.task,
  details: {
    task: task.task,
    category: task.category,
    dueText: task.dueText,
    locationId: task.locationId,
    contactId: task.contactId,
    status: task.status,
    note: task.note,
    sortOrder: task.sortOrder,
  },
});

const materialAuditEntity = (material: typeof materials.$inferSelect): AuditEntity => ({
  entityType: "material",
  entityId: material.id,
  entityLabel: material.article,
  details: {
    article: material.article,
    category: material.category,
    quantity: material.quantity,
    unit: material.unit,
    locationId: material.locationId,
    contactId: material.contactId,
    status: material.status,
    note: material.note,
    sortOrder: material.sortOrder,
  },
});

export async function listDeletionAuditLogs(filters?: {
  eventYear?: number;
  eventId?: number;
  entityType?: "helper" | "cake" | "prep" | "post" | "material";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    ...(filters?.eventYear
      ? [eq(deletionAuditLogs.year, filters.eventYear)]
      : []),
    ...(filters?.eventId
      ? [eq(deletionAuditLogs.eventId, filters.eventId)]
      : []),
    ...(filters?.entityType
      ? [eq(deletionAuditLogs.entityType, filters.entityType)]
      : []),
  ];
  const query = db.select().from(deletionAuditLogs);
  const filteredQuery = conditions.length
    ? query.where(and(...conditions))
    : query;
  return filteredQuery
    .orderBy(desc(deletionAuditLogs.createdAt), desc(deletionAuditLogs.id))
    .limit(filters?.limit ?? 500);
}

export async function listActivityLogs(filters?: {
  eventYear?: number;
  eventId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    ...(filters?.eventYear ? [eq(activityLogs.year, filters.eventYear)] : []),
    ...(filters?.eventId ? [eq(activityLogs.eventId, filters.eventId)] : []),
  ];
  const query = db.select().from(activityLogs);
  const filteredQuery = conditions.length
    ? query.where(and(...conditions))
    : query;
  return filteredQuery
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(filters?.limit ?? 500);
}

export async function clearDeletionAuditLogs(filters?: {
  eventYear?: number;
  eventId?: number;
}) {
  const db = (await getDb()) as DB;
  const conditions = [
    ...(filters?.eventYear
      ? [eq(deletionAuditLogs.year, filters.eventYear)]
      : []),
    ...(filters?.eventId
      ? [eq(deletionAuditLogs.eventId, filters.eventId)]
      : []),
  ];
  if (!conditions.length) return db.delete(deletionAuditLogs);
  return db.delete(deletionAuditLogs).where(and(...conditions));
}

export async function restoreDeletionAuditLog(
  id: number,
  actor: Pick<AuditActor, "userId" | "name">
) {
  const db = (await getDb()) as DB;
  const selectedYear = year();
  const selectedEventId = event();
  return db.transaction(async tx => {
    const [entry] = await tx
      .select()
      .from(deletionAuditLogs)
      .where(
        and(
          eq(deletionAuditLogs.id, id),
          eq(deletionAuditLogs.year, selectedYear),
          eq(deletionAuditLogs.eventId, selectedEventId)
        )
      )
      .limit(1)
      .for("update");
    if (!entry)
      throw new Error(
        "Protokolleintrag wurde in der ausgewählten Veranstaltung nicht gefunden"
      );
    if (entry.action !== "single_delete") {
      throw new Error(
        "Nur einzelne Löschungen können gezielt rückgängig gemacht werden"
      );
    }
    if (entry.restoredAt) {
      throw new Error("Diese Löschung wurde bereits rückgängig gemacht");
    }
    const [selectedEvent] = await tx
      .select()
      .from(events)
      .where(
        and(eq(events.id, selectedEventId), eq(events.year, selectedYear))
      )
      .limit(1)
      .for("update");
    if (!selectedEvent) {
      throw new Error("Die ursprüngliche Veranstaltung wurde nicht gefunden");
    }

    let details: Record<string, unknown> = {};
    try {
      details = entry.details ? JSON.parse(entry.details) : {};
    } catch {
      throw new Error("Der gespeicherte Datensatz ist nicht lesbar");
    }

    let restoredAssignments = 0;
    let skippedAssignments = 0;
    let skippedUnavailableAssignments = 0;
    let skippedConflictingAssignments = 0;
    if (entry.entityType === "helper") {
      const helperRows = await tx
        .select()
        .from(helpers)
        .where(
          planningScopeFor(helpers, selectedYear, selectedEventId)
        );
      if (
        helperRows.some(
          item =>
            normalizePersonName(item.name) ===
            normalizePersonName(entry.entityLabel)
        )
      ) {
        throw new Error(
          `Der Helfer „${entry.entityLabel}“ ist in dieser Veranstaltung bereits vorhanden`
        );
      }
      const requestedContactId =
        typeof details.contactId === "number" ? details.contactId : null;
      const [contact] = requestedContactId
        ? await tx
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.id, requestedContactId),
                planningScopeFor(contacts, selectedYear, selectedEventId)
              )
            )
            .limit(1)
        : [];
      const restoredHelper = {
        year: selectedYear,
        eventId: selectedEventId,
        name: entry.entityLabel,
        contactId: contact?.id ?? null,
        email: typeof details.email === "string" ? details.email : null,
        phone: typeof details.phone === "string" ? details.phone : null,
        note: typeof details.note === "string" ? details.note : null,
        willHelp: details.willHelp === "nein" ? "nein" : "ja",
        availMon:
          details.availMon === "ja" || details.availMon === "nein"
            ? details.availMon
            : "vielleicht",
        availTue:
          details.availTue === "ja" || details.availTue === "nein"
            ? details.availTue
            : "vielleicht",
        availWed:
          details.availWed === "ja" || details.availWed === "nein"
            ? details.availWed
            : "vielleicht",
        availThu:
          details.availThu === "ja" || details.availThu === "nein"
            ? details.availThu
            : "vielleicht",
        availFri:
          details.availFri === "ja" || details.availFri === "nein"
            ? details.availFri
            : "vielleicht",
        availSat:
          details.availSat === "ja" || details.availSat === "nein"
            ? details.availSat
            : "vielleicht",
        availSun:
          details.availSun === "ja" || details.availSun === "nein"
            ? details.availSun
            : "vielleicht",
        confirmed: details.confirmed === "ja" ? "ja" : "nein",
      } as const;
      const result: any = await tx.insert(helpers).values(restoredHelper);
      const helperId = Number(result?.[0]?.insertId ?? result?.insertId);
      const assignmentSnapshots = Array.isArray(details.assignments)
        ? details.assignments
        : [];
      for (const snapshot of assignmentSnapshots) {
        if (
          !snapshot ||
          typeof snapshot !== "object" ||
          typeof snapshot.shiftId !== "number" ||
          typeof snapshot.slot !== "number"
        ) {
          skippedAssignments++;
          continue;
        }
        const [shift] = await tx
          .select()
          .from(shifts)
          .where(
            and(
              eq(shifts.id, snapshot.shiftId),
              planningScopeFor(shifts, selectedYear, selectedEventId)
            )
          )
          .limit(1)
          .for("update");
        const [occupied] = shift
          ? await tx
              .select({ id: assignments.id })
              .from(assignments)
              .where(
                and(
                  eq(assignments.shiftId, snapshot.shiftId),
                  eq(assignments.slot, snapshot.slot)
                )
              )
              .limit(1)
              .for("update")
          : [];
        if (
          !shift ||
          occupied ||
          snapshot.slot < 0 ||
          snapshot.slot >= shift.needed
        ) {
          skippedAssignments++;
          continue;
        }
        if (
          !eventWeekdays(selectedEvent.activeDays).includes(shift.day) ||
          !helperAvailableOnDay(restoredHelper, shift.day)
        ) {
          skippedAssignments++;
          skippedUnavailableAssignments++;
          continue;
        }
        const assignedShifts = await tx
          .select({ ...getTableColumns(shifts) })
          .from(assignments)
          .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
          .where(
            and(
              eq(assignments.helperId, helperId),
              planningScopeFor(shifts, selectedYear, selectedEventId)
            )
          )
          .for("update");
        if (assignedShifts.some(other => overlaps(shift, other))) {
          skippedAssignments++;
          skippedConflictingAssignments++;
          continue;
        }
        await tx.insert(assignments).values({
          shiftId: snapshot.shiftId,
          helperId,
          year: selectedYear,
          eventId: selectedEventId,
          slot: snapshot.slot,
        });
        restoredAssignments++;
      }
    } else if (entry.entityType === "cake") {
      await tx.insert(cakes).values({
        year: selectedYear,
        eventId: selectedEventId,
        donor: entry.entityLabel,
        cake: typeof details.cake === "string" ? details.cake : "",
        dropoffTime:
          typeof details.dropoffTime === "string" ? details.dropoffTime : "",
        note: typeof details.note === "string" ? details.note : null,
        sortOrder:
          typeof details.sortOrder === "number" ? details.sortOrder : 0,
      });
    } else if (entry.entityType === "prep") {
      const result = await tx
        .update(prepTasks)
        .set({ deleted: false })
        .where(
          and(
            eq(prepTasks.id, entry.entityId),
            planningScopeFor(prepTasks, selectedYear, selectedEventId),
            eq(prepTasks.deleted, true)
          )
        );
      if (affectedRows(result) !== 1) {
        throw new Error(
          "Die Vorbereitungsaufgabe ist nicht mehr wiederherstellbar, weil sie bereits aktiv ist oder inzwischen endgültig entfernt wurde"
        );
      }
    } else if (entry.entityType === "post") {
      const result = await tx
        .update(postTasks)
        .set({ deleted: false })
        .where(
          and(
            eq(postTasks.id, entry.entityId),
            planningScopeFor(postTasks, selectedYear, selectedEventId),
            eq(postTasks.deleted, true)
          )
        );
      if (affectedRows(result) !== 1) {
        throw new Error(
          "Die Nachbereitungsaufgabe ist nicht mehr wiederherstellbar, weil sie bereits aktiv ist oder inzwischen endgültig entfernt wurde"
        );
      }
    } else {
      const result = await tx
        .update(materials)
        .set({ deleted: false })
        .where(
          and(
            eq(materials.id, entry.entityId),
            planningScopeFor(materials, selectedYear, selectedEventId),
            eq(materials.deleted, true)
          )
        );
      if (affectedRows(result) !== 1) {
        throw new Error(
          "Der Materialartikel ist nicht mehr wiederherstellbar, weil er bereits aktiv ist oder inzwischen endgültig entfernt wurde"
        );
      }
    }

    await tx
      .update(deletionAuditLogs)
      .set({
        restoredAt: new Date(),
        restoredByUserId: actor.userId,
        restoredByName: actor.name,
      })
      .where(
        and(
          eq(deletionAuditLogs.id, id),
          eq(deletionAuditLogs.year, selectedYear),
          eq(deletionAuditLogs.eventId, selectedEventId),
          isNull(deletionAuditLogs.restoredAt)
        )
      );

    return {
      entityType: entry.entityType,
      entityLabel: entry.entityLabel,
      eventId: selectedEventId,
      eventName: selectedEvent.name,
      restoredAssignments,
      skippedAssignments,
      skippedUnavailableAssignments,
      skippedConflictingAssignments,
    };
  });
}

export async function deleteHelper(
  id: number,
  options: { allowAssigned?: boolean; actor: AuditActor }
) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [helper] = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.id, id), planningScope(helpers)))
      .limit(1)
      .for("update");
    if (!helper) throw new Error("Helfer wurde nicht gefunden");
    const helperAssignments = await tx
      .select({
        id: assignments.id,
        shiftId: assignments.shiftId,
        slot: assignments.slot,
      })
      .from(assignments)
      .where(eq(assignments.helperId, id));
    if (!options.allowAssigned) {
      const [assignment] = helperAssignments;
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
        .where(and(eq(contacts.id, helper.contactId), planningScope(contacts)))
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
    await recordDeletionAudit(tx, options.actor, "single_delete", [
      helperAuditEntity(
        helper,
        helperAssignments.map(item => ({
          shiftId: item.shiftId,
          slot: item.slot,
        }))
      ),
    ]);
    const result = await tx
      .delete(helpers)
      .where(and(eq(helpers.id, id), planningScope(helpers)));
    requireDeletedRows(result, 1);
    return result;
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
  selectedYear = year(),
  selectedEventId = event()
) {
  const helperRows = await client
    .select()
    .from(helpers)
    .where(
      and(eq(helpers.year, selectedYear), eq(helpers.eventId, selectedEventId))
    );
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
      .where(
        and(
          eq(helpers.id, existing.id),
          eq(helpers.year, selectedYear),
          eq(helpers.eventId, selectedEventId)
        )
      );
    return { id: existing.id, created: false };
  }

  const result: any = await client
    .insert(helpers)
    .values({ ...values, year: selectedYear, eventId: selectedEventId });
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

async function requireActiveEventDay(day: Weekday) {
  const selectedEvent = await getEvent();
  if (!selectedEvent?.activeDays.includes(day)) {
    throw new Error(`${day} ist für diese Veranstaltung nicht aktiviert`);
  }
}

async function scopedLocationValues(values: Record<string, unknown>) {
  if (!("locationId" in values) || values.locationId === null) return values;
  const locationId = Number(values.locationId);
  const db = (await getDb()) as DB;
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), planningScope(locations)))
    .limit(1);
  if (!location)
    throw new Error("Der Ort gehört nicht zur ausgewählten Veranstaltung");
  return values;
}

export async function createShift(
  v: Partial<typeof shifts.$inferInsert> & {
    day: Weekday;
    area: string;
    task: string;
  }
) {
  await requireActiveEventDay(v.day);
  const db = (await getDb()) as DB;
  return db.insert(shifts).values({
    ...(await scopedLocationValues(v)),
    year: year(),
    eventId: event(),
  } as typeof shifts.$inferInsert);
}
export async function updateShift(
  id: number,
  v: Partial<typeof shifts.$inferInsert>
) {
  if (v.day) await requireActiveEventDay(v.day as Weekday);
  const db = (await getDb()) as DB;
  const {
    id: ignoredId,
    year: ignoredYear,
    eventId: ignoredEventId,
    createdAt: ignoredCreatedAt,
    ...safe
  } = v;
  const requiresAssignmentValidation =
    safe.day !== undefined ||
    safe.startTime !== undefined ||
    safe.endTime !== undefined ||
    safe.allowFlexibleAssignment !== undefined ||
    safe.needed !== undefined;

  return db.transaction(async tx => {
    const [existingShift] = await tx
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), planningScope(shifts)))
      .limit(1)
      .for("update");
    if (!existingShift) throw new Error("Schicht wurde nicht gefunden");

    if (requiresAssignmentValidation) {
      const existingAssignments = await tx
        .select()
        .from(assignments)
        .where(eq(assignments.shiftId, existingShift.id))
        .for("update");
      const { assigned: assignmentsWithHelpers } =
        splitShiftAssignmentsByHelper(existingAssignments);
      const helperIds = Array.from(
        new Set(assignmentsWithHelpers.map(item => item.helperId))
      );
      const assignedHelpers = helperIds.length
        ? await tx
            .select()
            .from(helpers)
            .where(and(planningScope(helpers), inArray(helpers.id, helperIds)))
            .for("update")
        : [];
      const proposedShift = {
        ...existingShift,
        ...safe,
      } as typeof shifts.$inferSelect;
      validateExistingAssignmentsForShiftUpdate({
        proposedShift,
        existingAssignments,
        assignedHelpers,
      });

      // Altimporte konnten leere Slot-Zeilen erzeugen. Diese sind kein
      // Helferplatz und werden bei einer expliziten Bedarfsänderung entfernt.
      // Die echten Helfer werden danach in ihre natürliche Reihenfolge
      // verdichtet. Damit ist etwa eine Belegung in Platz 11 bei zehn echten
      // Helfern weiterhin zulässig: Entscheidend ist die Helferanzahl, nicht
      // eine zufällig aus älteren Daten übrig gebliebene Slotnummer.
      if (safe.needed !== undefined) {
        const emptySlotIds = unassignedAssignmentIds(existingAssignments);
        if (emptySlotIds.length) {
          await tx
            .delete(assignments)
            .where(
              and(
                eq(assignments.shiftId, existingShift.id),
                inArray(assignments.id, emptySlotIds)
              )
            );
        }

        const slotUpdates = normalizedAssignedSlotUpdates(existingAssignments);
        const movedAssignments = slotUpdates.filter(
          update => update.previousSlot !== update.slot
        );
        if (movedAssignments.length) {
          // Die Zwischenwerte verhindern, dass der Unique-Index
          // (shiftId, slot) beim Vertauschen oder Verdichten kollidiert.
          for (let index = 0; index < movedAssignments.length; index++) {
            const update = movedAssignments[index];
            await tx
              .update(assignments)
              .set({ slot: -1 - index })
              .where(
                and(
                  eq(assignments.id, update.id),
                  eq(assignments.shiftId, existingShift.id)
                )
              );
          }
          for (const update of movedAssignments) {
            await tx
              .update(assignments)
              .set({ slot: update.slot })
              .where(
                and(
                  eq(assignments.id, update.id),
                  eq(assignments.shiftId, existingShift.id)
                )
              );
          }
        }
      }
    }

    const shiftsFundamentallyChanged =
      (safe.day !== undefined && safe.day !== existingShift.day) ||
      (safe.startTime !== undefined && safe.startTime !== existingShift.startTime) ||
      (safe.endTime !== undefined && safe.endTime !== existingShift.endTime) ||
      (safe.allowFlexibleAssignment !== undefined &&
        safe.allowFlexibleAssignment !== existingShift.allowFlexibleAssignment) ||
      (safe.needed !== undefined && safe.needed !== existingShift.needed);
    const shouldResetManualOk =
      shiftsFundamentallyChanged &&
      existingShift.manualOkConfirmed;
    const shouldResetManualDoubleConflict =
      shiftsFundamentallyChanged &&
      existingShift.manualDoubleConflictAccepted;
    const updateValues = {
      ...(await scopedLocationValues(safe)),
      ...(shouldResetManualOk ? { manualOkConfirmed: false } : {}),
      ...(shouldResetManualDoubleConflict
        ? { manualDoubleConflictAccepted: false }
        : {}),
    };
    const result = await tx
      .update(shifts)
      .set(updateValues)
      .where(and(eq(shifts.id, existingShift.id), planningScope(shifts)));
    if (shiftsFundamentallyChanged) {
      const shiftedAssignments = await tx
        .select({ helperId: assignments.helperId })
        .from(assignments)
        .where(eq(assignments.shiftId, existingShift.id));
      await resetManualShiftConfirmationsForHelpers(
        tx,
        shiftedAssignments.map(assignment => assignment.helperId),
        [existingShift.id]
      );
    }
    if (safe.area !== undefined) await removeOrphanShiftAreaContactsForClient(tx);
    return result;
  });
}
export async function deleteShift(id: number) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const result = await tx
      .delete(shifts)
      .where(and(eq(shifts.id, id), planningScope(shifts)));
    await removeOrphanShiftAreaContactsForClient(tx);
    return result;
  });
}
export async function setShiftAreaContact(
  area: string,
  contactId: number | null
) {
  const db = (await getDb()) as DB;
  const normalizedArea = area.trim().replace(/\s+/g, " ");
  const [existingArea] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(planningScope(shifts), eq(shifts.area, normalizedArea)))
    .limit(1);
  if (!existingArea) throw new Error("Bereich wurde nicht gefunden");
  if (contactId !== null) {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), planningScope(contacts)))
      .limit(1);
    if (!contact) throw new Error("Ansprechpartner wurde nicht gefunden");
  }
  if (contactId === null) {
    return db
      .delete(shiftAreaContacts)
      .where(
        and(
          planningScope(shiftAreaContacts),
          eq(shiftAreaContacts.area, normalizedArea)
        )
      );
  }
  return db
    .insert(shiftAreaContacts)
    .values({
      year: year(),
      eventId: event(),
      area: normalizedArea,
      contactId,
    })
    .onDuplicateKeyUpdate({ set: { contactId } });
}
async function removeOrphanShiftAreaContactsForClient(db: DBClient) {
  const activeAreas = await db
    .select({ area: shifts.area })
    .from(shifts)
    .where(planningScope(shifts));
  if (!activeAreas.length) {
    return db.delete(shiftAreaContacts).where(planningScope(shiftAreaContacts));
  }
  const areaSet = new Set(activeAreas.map(item => item.area));
  const mappings = await db
    .select({ id: shiftAreaContacts.id, area: shiftAreaContacts.area })
    .from(shiftAreaContacts)
    .where(planningScope(shiftAreaContacts));
  const orphanIds = mappings
    .filter(item => !areaSet.has(item.area))
    .map(item => item.id);
  if (!orphanIds.length) return;
  return db
    .delete(shiftAreaContacts)
    .where(
      and(
        planningScope(shiftAreaContacts),
        inArray(shiftAreaContacts.id, orphanIds)
      )
    );
}

async function resetManualShiftConfirmationsForHelpers(
  tx: DBClient,
  helperIds: number[],
  additionalShiftIds: number[] = []
) {
  const uniqueHelperIds = Array.from(new Set(helperIds));
  const affectedAssignments = uniqueHelperIds.length
    ? await tx
        .select({ shiftId: assignments.shiftId })
        .from(assignments)
        .where(
          and(
            planningScope(assignments),
            inArray(assignments.helperId, uniqueHelperIds)
          )
        )
    : [];
  const affectedShiftIds = Array.from(
    new Set([
      ...additionalShiftIds,
      ...affectedAssignments.map(assignment => assignment.shiftId),
    ])
  );
  if (!affectedShiftIds.length) return;
  await tx
    .update(shifts)
    .set({
      manualOkConfirmed: false,
      manualDoubleConflictAccepted: false,
    })
    .where(and(planningScope(shifts), inArray(shifts.id, affectedShiftIds)));
}

export async function assignHelper(v: {
  shiftId: number;
  helperId: number;
  slot: number;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [shift] = await tx
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, v.shiftId), planningScope(shifts)))
      .limit(1)
      .for("update");
    const [helper] = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.id, v.helperId), planningScope(helpers)))
      .limit(1)
      .for("update");
    if (!shift || !helper)
      throw new Error("Schicht oder Helfer wurde nicht gefunden");
    if (v.slot < 0 || v.slot >= shift.needed)
      throw new Error("Helferplatz liegt außerhalb des Schichtbedarfs");
    if (!helperEligibleForShift(helper, shift))
      throw new Error("Der Helfer ist für diese Schichtzeit nicht verfügbar");
    const [existing] = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.shiftId, v.shiftId),
          or(
            eq(assignments.slot, v.slot),
            eq(assignments.helperId, v.helperId)
          )
        )
      )
      .limit(1)
      .for("update");
    if (existing)
      throw new Error("Helferplatz oder Helfer ist bereits belegt");
    await tx.insert(assignments).values({
      ...v,
      year: shift.year,
      eventId: shift.eventId,
    });
    await resetManualShiftConfirmationsForHelpers(
      tx,
      [v.helperId],
      [shift.id]
    );
    return { success: true } as const;
  });
}
export async function replaceShiftAssignment(v: {
  shiftId: number;
  helperId: number;
  slot: number;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [shift] = await tx
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, v.shiftId), planningScope(shifts)))
      .limit(1);
    const [helper] = await tx
      .select()
      .from(helpers)
      .where(and(eq(helpers.id, v.helperId), planningScope(helpers)))
      .limit(1);
    if (!shift || !helper)
      throw new Error("Schicht oder Helfer wurde nicht gefunden");
    if (v.slot < 0 || v.slot >= shift.needed)
      throw new Error("Helferplatz liegt außerhalb des Schichtbedarfs");
    if (!helperEligibleForShift(helper, shift))
      throw new Error("Der Helfer ist für diese Schichtzeit nicht verfügbar");
    const current = await tx
      .select()
      .from(assignments)
      .where(eq(assignments.shiftId, v.shiftId))
      .for("update");
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
    await tx.insert(assignments).values({
      ...v,
      year: shift.year,
      eventId: shift.eventId,
    });
    await resetManualShiftConfirmationsForHelpers(
      tx,
      [v.helperId, ...current.map(item => item.helperId)],
      [shift.id]
    );
    return { success: true } as const;
  });
}
export async function removeShiftAssignment(v: {
  shiftId: number;
  slot: number;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [shift] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.id, v.shiftId), planningScope(shifts)))
      .limit(1)
      .for("update");
    if (!shift) throw new Error("Schicht wurde nicht gefunden");
    const [assignment] = await tx
      .select({ helperId: assignments.helperId })
      .from(assignments)
      .where(
        and(eq(assignments.shiftId, v.shiftId), eq(assignments.slot, v.slot))
      )
      .limit(1)
      .for("update");
    await tx
      .delete(assignments)
      .where(
        and(eq(assignments.shiftId, v.shiftId), eq(assignments.slot, v.slot))
      );
    await resetManualShiftConfirmationsForHelpers(
      tx,
      assignment ? [assignment.helperId] : [],
      [shift.id]
    );
    return { success: true } as const;
  });
}
export async function unassignHelper(id: number) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [assignment] = await tx
      .select({ shiftId: assignments.shiftId, helperId: assignments.helperId })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, id),
          inArray(
            assignments.shiftId,
            tx.select({ id: shifts.id }).from(shifts).where(planningScope(shifts))
          )
        )
      )
      .limit(1)
      .for("update");
    if (!assignment) return;
    await tx.delete(assignments).where(eq(assignments.id, id));
    await resetManualShiftConfirmationsForHelpers(
      tx,
      [assignment.helperId],
      [assignment.shiftId]
    );
    return { success: true } as const;
  });
}
export async function clearAssignments() {
  const db = (await getDb()) as DB;
  const selectedYear = year();
  const selectedEventId = event();
  return db.transaction(async tx => {
    const scopedShifts = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(planningScopeFor(shifts, selectedYear, selectedEventId))
      .for("update");
    const shiftIds = scopedShifts.map(shift => shift.id);
    if (!shiftIds.length) return { cleared: 0 };

    const assignedRows = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          planningScopeFor(assignments, selectedYear, selectedEventId),
          inArray(assignments.shiftId, shiftIds)
        )
      )
      .for("update");
    if (!assignedRows.length) return { cleared: 0 };

    const result = await tx
      .delete(assignments)
      .where(
        and(
          planningScopeFor(assignments, selectedYear, selectedEventId),
          inArray(
            assignments.id,
            assignedRows.map(assignment => assignment.id)
          )
        )
      );
    requireDeletedRows(result, assignedRows.length);
    await tx
      .update(shifts)
      .set({
        manualOkConfirmed: false,
        manualDoubleConflictAccepted: false,
      })
      .where(planningScopeFor(shifts, selectedYear, selectedEventId));
    return { cleared: assignedRows.length };
  });
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
      whatsAppMessageTemplate: null,
      tenantLogoKey: null,
      tenantLogoUrl: null,
      extraColumns: "[]",
      blankRowsPerShift: 0,
      ...safe,
    })
    .onDuplicateKeyUpdate({ set: safe });
}

export async function updateTenantLogo(values: {
  tenantLogoKey: string | null;
  tenantLogoUrl: string | null;
}) {
  return updateAppSettings(values);
}
export async function revokeSessionKey(
  sessionKey: string,
  reason: "logout" | "security_reset" = "logout"
) {
  const db = (await getDb()) as DB;
  await db
    .insert(revokedSessions)
    .values({ sessionKey, reason, revokedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { reason, revokedAt: new Date() } });
}

export async function isSessionRevoked(sessionKey: string) {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select({ sessionKey: revokedSessions.sessionKey })
    .from(revokedSessions)
    .where(eq(revokedSessions.sessionKey, sessionKey))
    .limit(1);
  return Boolean(row);
}

export async function getExpectedSessionVersion(openId: string) {
  const planningTeamAccessId = planningTeamAccessIdFromOpenId(openId);
  if (planningTeamAccessId !== null) {
    const database = await getDb();
    if (!database) return Number.MAX_SAFE_INTEGER;
    const [settings, access] = await Promise.all([
      getSecuritySettings(),
      database
        .select({ sessionVersion: planningTeamAccesses.sessionVersion })
        .from(planningTeamAccesses)
        .where(eq(planningTeamAccesses.id, planningTeamAccessId))
        .limit(1),
    ]);
    // Der globale Notfall-Stopp muss auch bereits angemeldete
    // Planungsteam-Sitzungen sofort abschneiden – nicht nur neue Logins.
    if (settings?.planningTeamLocked) return Number.MAX_SAFE_INTEGER;
    const accessRow = access[0];
    // Ein gelöschter Zugang soll unmittelbar sämtliche offenen Sitzungen verlieren.
    return accessRow?.sessionVersion ?? Number.MAX_SAFE_INTEGER;
  }
  if (openId.startsWith("tenant-admin:")) {
    const database = await getDb();
    if (!database) return Number.MAX_SAFE_INTEGER;
    const [credential] = await database
      .select({
        sessionVersion: tenantAdminCredentials.sessionVersion,
        status: tenantAdminCredentials.status,
      })
      .from(tenantAdminCredentials)
      .innerJoin(users, eq(users.id, tenantAdminCredentials.userId))
      .where(eq(users.openId, openId))
      .limit(1);
    // Ein gelöschter oder pausierter Vereinsadmin verliert seine Sitzung sofort.
    return credential?.status === "active"
      ? credential.sessionVersion
      : Number.MAX_SAFE_INTEGER;
  }
  if (
    openId !== SHARED_PASSWORD_OPEN_ID &&
    openId !== ADMIN_PASSWORD_OPEN_ID
  ) {
    return 1;
  }
  const settings = await getSecuritySettings();
  return openId === ADMIN_PASSWORD_OPEN_ID
    ? settings?.adminSessionVersion ?? 1
    : settings?.planningTeamSessionVersion ?? 1;
}

export async function bumpSessionVersion(role: "user" | "admin") {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    await tx
      .insert(securitySettings)
      .values({ id: 1 })
      .onDuplicateKeyUpdate({ set: { id: 1 } });
    const [settings] = await tx
      .select({
        planningTeamSessionVersion: securitySettings.planningTeamSessionVersion,
        adminSessionVersion: securitySettings.adminSessionVersion,
      })
      .from(securitySettings)
      .where(eq(securitySettings.id, 1))
      .for("update");

    if (role === "admin") {
      const next = (settings?.adminSessionVersion ?? 1) + 1;
      await tx
        .update(securitySettings)
        .set({ adminSessionVersion: next })
        .where(eq(securitySettings.id, 1));
      return next;
    }

    const next = (settings?.planningTeamSessionVersion ?? 1) + 1;
    await tx
      .update(securitySettings)
      .set({ planningTeamSessionVersion: next })
      .where(eq(securitySettings.id, 1));
    return next;
  });
}

export async function setPasswordHash(passwordHash: string) {
  const db = (await getDb()) as DB;
  return db
    .insert(securitySettings)
    .values({ id: 1, passwordHash, planningTeamSessionVersion: 2 })
    .onDuplicateKeyUpdate({
      set: {
        passwordHash,
        planningTeamSessionVersion: sql`${securitySettings.planningTeamSessionVersion} + 1`,
      },
    });
}
export async function setAdminPasswordHash(adminPasswordHash: string) {
  const db = (await getDb()) as DB;
  return db
    .insert(securitySettings)
    .values({ id: 1, adminPasswordHash, adminSessionVersion: 2 })
    .onDuplicateKeyUpdate({
      set: {
        adminPasswordHash,
        adminSessionVersion: sql`${securitySettings.adminSessionVersion} + 1`,
      },
    });
}

function yearValues<T extends Record<string, unknown>>(values: T) {
  return { ...values, year: year(), eventId: event() };
}
function yearWhere(table: { id: any; year: any; eventId: any }, id: number) {
  return and(eq(table.id, id), planningScope(table));
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

async function scopedContactValues(values: Record<string, unknown>) {
  if (!("contactId" in values) || values.contactId === null) return values;
  const contactId = Number(values.contactId);
  const db = (await getDb()) as DB;
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), planningScope(contacts)))
    .limit(1);
  if (!contact) {
    throw new Error(
      "Der Ansprechpartner gehört nicht zur ausgewählten Veranstaltung"
    );
  }
  return values;
}

export const createPrep = async (v: any) => {
  const { logEntry, logEntryAuthor, activityEntry, activityAuthor, ...values } = v;
  const noteWithManualEntry = prependPreparationLogbookEntry(
    logEntry,
    values.note,
    new Date(),
    logEntryAuthor
  );
  const valuesWithLogbook =
    logEntry === undefined && !activityEntry
      ? values
      : {
          ...values,
          note: prependPreparationLogbookEntry(
            activityEntry,
            noteWithManualEntry,
            new Date(),
            activityAuthor ?? logEntryAuthor
          ),
        };
  return createYearRow(
    prepTasks,
    await scopedContactValues(await scopedLocationValues(valuesWithLogbook))
  );
};
export const updatePrep = async (id: number, v: any) => {
  const { logEntry, logEntryAuthor, activityEntry, activityAuthor, ...values } = v;
  const database = (await getDb()) as DB;
  if (logEntry === undefined && !activityEntry) {
    return database
      .update(prepTasks)
      .set(await scopedContactValues(await scopedLocationValues(values)))
      .where(and(yearWhere(prepTasks, id), eq(prepTasks.deleted, false)));
  }

  const existing = await database
    .select({ note: prepTasks.note })
    .from(prepTasks)
    .where(and(yearWhere(prepTasks, id), eq(prepTasks.deleted, false)))
    .limit(1);
  if (!existing[0]) throw new Error("Vorbereitungsaufgabe wurde nicht gefunden");

  return database
    .update(prepTasks)
    .set(
      await scopedContactValues(await scopedLocationValues({
        ...values,
        note: prependPreparationLogbookEntry(
          activityEntry,
          prependPreparationLogbookEntry(
            logEntry,
            existing[0].note,
            new Date(),
            logEntryAuthor
          ),
          new Date(),
          activityAuthor ?? logEntryAuthor
        ),
      }))
    )
    .where(and(yearWhere(prepTasks, id), eq(prepTasks.deleted, false)));
};
export async function deletePrep(
  id: number,
  options: { actor: AuditActor }
) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [task] = await tx
      .select()
      .from(prepTasks)
      .where(
        and(
          eq(prepTasks.id, id),
          planningScope(prepTasks),
          eq(prepTasks.deleted, false)
        )
      )
      .limit(1)
      .for("update");
    if (!task) throw new Error("Vorbereitungsaufgabe wurde nicht gefunden");
    await recordDeletionAudit(tx, options.actor, "single_delete", [
      prepAuditEntity(task),
    ]);
    const result = await tx
      .update(prepTasks)
      .set({ deleted: true })
      .where(
        and(
          eq(prepTasks.id, id),
          planningScope(prepTasks),
          eq(prepTasks.deleted, false)
        )
      );
    requireDeletedRows(result, 1);
    return result;
  });
}

export type ModuleAssignmentClearArea =
  | "helpers"
  | "prep"
  | "post"
  | "materials";

/**
 * Der neutrale Helferzustand entspricht einer noch nicht abgestimmten, aber
 * grundsätzlich aktiven Person. Stammdaten wie Name, Telefon und E-Mail sowie
 * bereits bestehende Einsatzplan-Schichten bleiben bewusst unverändert.
 */
export const helperAssignmentClearValues = () => ({
  contactId: null,
  note: null,
  companion: null,
  willHelp: "ja" as const,
  availMon: "vielleicht" as const,
  availTue: "vielleicht" as const,
  availWed: "vielleicht" as const,
  availThu: "vielleicht" as const,
  availFri: "vielleicht" as const,
  availSat: "vielleicht" as const,
  availSun: "vielleicht" as const,
  availMonStart: null,
  availMonEnd: null,
  availTueStart: null,
  availTueEnd: null,
  availWedStart: null,
  availWedEnd: null,
  availThuStart: null,
  availThuEnd: null,
  availFriStart: null,
  availFriEnd: null,
  availSatStart: null,
  availSatEnd: null,
  availSunStart: null,
  availSunEnd: null,
  confirmed: "nein" as const,
});

/**
 * Feldwerte für den nicht-destruktiven Modulreset. Die Helfer, Aufgaben bzw.
 * Materialpositionen bleiben dabei bestehen; nur ihre operative Belegung wird
 * auf den neutralen Ausgangszustand zurückgesetzt.
 */
export function moduleAssignmentClearValues(area: ModuleAssignmentClearArea) {
  switch (area) {
    case "helpers":
      return helperAssignmentClearValues();
    case "prep":
      return {
        contactId: null,
        dueText: "",
        status: "offen" as const,
        statusWording: "aufgabe" as const,
        note: null,
      };
    case "post":
      return {
        contactId: null,
        dueText: "",
        status: "offen" as const,
        note: null,
      };
    case "materials":
      return {
        contactId: null,
        status: "offen" as const,
      };
  }
}

/**
 * Leert ausschließlich die operativen Belegungsfelder der aktuell gewählten
 * Veranstaltung. Helfer, einzelne Aufgaben und Materialpositionen werden nie
 * gelöscht. Bestehende Einsatzplan-Zuweisungen bleiben dabei unberührt.
 */
export async function clearModuleAssignments(area: ModuleAssignmentClearArea) {
  const database = (await getDb()) as DB;
  const selectedYear = year();
  const selectedEventId = event();

  return database.transaction(async tx => {
    if (area === "helpers") {
      const rows = await tx
        .select({ id: helpers.id })
        .from(helpers)
        .where(planningScopeFor(helpers, selectedYear, selectedEventId))
        .for("update");
      if (!rows.length) return { area, cleared: 0 };
      await tx
        .update(helpers)
        .set(moduleAssignmentClearValues("helpers"))
        .where(
          and(
            planningScopeFor(helpers, selectedYear, selectedEventId),
            inArray(
              helpers.id,
              rows.map(row => row.id)
            )
          )
        );
      return { area, cleared: rows.length };
    }

    if (area === "prep") {
      const rows = await tx
        .select({ id: prepTasks.id })
        .from(prepTasks)
        .where(
          and(
            planningScopeFor(prepTasks, selectedYear, selectedEventId),
            eq(prepTasks.deleted, false)
          )
        )
        .for("update");
      if (!rows.length) return { area, cleared: 0 };
      await tx
        .update(prepTasks)
        .set(moduleAssignmentClearValues("prep"))
        .where(
          and(
            planningScopeFor(prepTasks, selectedYear, selectedEventId),
            eq(prepTasks.deleted, false),
            inArray(
              prepTasks.id,
              rows.map(row => row.id)
            )
          )
        );
      return { area, cleared: rows.length };
    }

    if (area === "post") {
      const rows = await tx
        .select({ id: postTasks.id })
        .from(postTasks)
        .where(
          and(
            planningScopeFor(postTasks, selectedYear, selectedEventId),
            eq(postTasks.deleted, false)
          )
        )
        .for("update");
      if (!rows.length) return { area, cleared: 0 };
      await tx
        .update(postTasks)
        .set(moduleAssignmentClearValues("post"))
        .where(
          and(
            planningScopeFor(postTasks, selectedYear, selectedEventId),
            eq(postTasks.deleted, false),
            inArray(
              postTasks.id,
              rows.map(row => row.id)
            )
          )
        );
      return { area, cleared: rows.length };
    }

    const rows = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(
        and(
          planningScopeFor(materials, selectedYear, selectedEventId),
          eq(materials.deleted, false)
        )
      )
      .for("update");
    if (!rows.length) return { area, cleared: 0 };
    await tx
      .update(materials)
      .set(moduleAssignmentClearValues("materials"))
      .where(
        and(
          planningScopeFor(materials, selectedYear, selectedEventId),
          eq(materials.deleted, false),
          inArray(
            materials.id,
            rows.map(row => row.id)
          )
        )
      );
    return { area, cleared: rows.length };
  });
}
export const createPost = async (v: any) => {
  const { logEntry, logEntryAuthor, activityEntry, activityAuthor, ...values } = v;
  const noteWithManualEntry = prependPreparationLogbookEntry(
    logEntry,
    values.note,
    new Date(),
    logEntryAuthor
  );
  const valuesWithLogbook =
    logEntry === undefined && !activityEntry
      ? values
      : {
          ...values,
          note: prependPreparationLogbookEntry(
            activityEntry,
            noteWithManualEntry,
            new Date(),
            activityAuthor ?? logEntryAuthor
          ),
        };
  return createYearRow(
    postTasks,
    await scopedContactValues(await scopedLocationValues(valuesWithLogbook))
  );
};
export const updatePost = async (id: number, v: any) => {
  const { logEntry, logEntryAuthor, activityEntry, activityAuthor, ...values } = v;
  const database = (await getDb()) as DB;
  if (logEntry === undefined && !activityEntry) {
    return database
      .update(postTasks)
      .set(await scopedContactValues(await scopedLocationValues(values)))
      .where(and(yearWhere(postTasks, id), eq(postTasks.deleted, false)));
  }
  const existing = await database
    .select({ note: postTasks.note })
    .from(postTasks)
    .where(and(yearWhere(postTasks, id), eq(postTasks.deleted, false)))
    .limit(1);
  if (!existing[0]) throw new Error("Nachbereitungsaufgabe wurde nicht gefunden");
  return database
    .update(postTasks)
    .set(
      await scopedContactValues(await scopedLocationValues({
        ...values,
        note: prependPreparationLogbookEntry(
          activityEntry,
          prependPreparationLogbookEntry(
            logEntry,
            existing[0].note,
            new Date(),
            logEntryAuthor
          ),
          new Date(),
          activityAuthor ?? logEntryAuthor
        ),
      }))
    )
    .where(and(yearWhere(postTasks, id), eq(postTasks.deleted, false)));
};
export async function deletePost(
  id: number,
  options: { actor: AuditActor }
) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [task] = await tx
      .select()
      .from(postTasks)
      .where(
        and(
          eq(postTasks.id, id),
          planningScope(postTasks),
          eq(postTasks.deleted, false)
        )
      )
      .limit(1)
      .for("update");
    if (!task) throw new Error("Nachbereitungsaufgabe wurde nicht gefunden");
    await recordDeletionAudit(tx, options.actor, "single_delete", [
      postAuditEntity(task),
    ]);
    const result = await tx
      .update(postTasks)
      .set({ deleted: true })
      .where(
        and(
          eq(postTasks.id, id),
          planningScope(postTasks),
          eq(postTasks.deleted, false)
        )
      );
    requireDeletedRows(result, 1);
    return result;
  });
}
export const createMaterial = async (v: any) =>
  createYearRow(
    materials,
    await scopedContactValues(await scopedLocationValues(v))
  );
export const updateMaterial = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(materials)
    .set(await scopedContactValues(await scopedLocationValues(v)))
    .where(and(yearWhere(materials, id), eq(materials.deleted, false)));
export async function deleteMaterial(id: number, options: { actor: AuditActor }) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [material] = await tx
      .select()
      .from(materials)
      .where(
        and(
          eq(materials.id, id),
          planningScope(materials),
          eq(materials.deleted, false)
        )
      )
      .limit(1)
      .for("update");
    if (!material) throw new Error("Materialartikel wurde nicht gefunden");
    await recordDeletionAudit(tx, options.actor, "single_delete", [
      materialAuditEntity(material),
    ]);
    const result = await tx
      .update(materials)
      .set({ deleted: true })
      .where(
        and(
          eq(materials.id, id),
          planningScope(materials),
          eq(materials.deleted, false)
        )
      );
    requireDeletedRows(result, 1);
    return result;
  });
}
export const createMarketing = async (v: any) =>
  createYearRow(marketing, await scopedContactValues(v));
export const updateMarketing = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(marketing)
    .set(await scopedContactValues(v))
    .where(yearWhere(marketing, id));
export const deleteMarketing = async (id: number) =>
  ((await getDb()) as DB).delete(marketing).where(yearWhere(marketing, id));
export const createApproval = async (v: any) =>
  createYearRow(approvals, await scopedContactValues(v));
export const updateApproval = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(approvals)
    .set(await scopedContactValues(v))
    .where(yearWhere(approvals, id));
export const deleteApproval = async (id: number) =>
  ((await getDb()) as DB).delete(approvals).where(yearWhere(approvals, id));
export const createCake = async (v: any) =>
  createYearRow(cakes, await scopedLocationValues(v));
export const updateCake = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(cakes)
    .set(await scopedLocationValues(v))
    .where(yearWhere(cakes, id));
export async function deleteCake(id: number, actor: AuditActor) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [cake] = await tx
      .select()
      .from(cakes)
      .where(yearWhere(cakes, id))
      .limit(1)
      .for("update");
    if (!cake) throw new Error("Kucheneintrag wurde nicht gefunden");
    await recordDeletionAudit(tx, actor, "single_delete", [
      cakeAuditEntity(cake),
    ]);
    const result = await tx.delete(cakes).where(yearWhere(cakes, id));
    requireDeletedRows(result, 1);
    return result;
  });
}

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

export async function resetArea(area: ResetArea, actor: AuditActor) {
  const db = (await getDb()) as DB;
  const selectedYear = year();
  const selectedEventId = event();

  if (area === "all") {
    await db.transaction(async tx => {
      const helperRows = await tx
        .select()
        .from(helpers)
        .where(planningScopeFor(helpers, selectedYear, selectedEventId))
        .for("update");
      const cakeRows = await tx
        .select()
        .from(cakes)
        .where(planningScopeFor(cakes, selectedYear, selectedEventId))
        .for("update");
      await recordDeletionAudit(
        tx,
        actor,
        "year_reset",
        [
          ...helperRows.map(item => helperAuditEntity(item)),
          ...cakeRows.map(item => cakeAuditEntity(item)),
        ],
        selectedYear,
        selectedEventId
      );
      await tx.delete(assignments).where(
        inArray(
          assignments.shiftId,
          tx
            .select({ id: shifts.id })
            .from(shifts)
            .where(planningScopeFor(shifts, selectedYear, selectedEventId))
        )
      );
      await tx
        .delete(shifts)
        .where(planningScopeFor(shifts, selectedYear, selectedEventId));
      await tx
        .delete(shiftAreaContacts)
        .where(
          planningScopeFor(shiftAreaContacts, selectedYear, selectedEventId)
        );
      if (helperRows.length) {
        const result = await tx.delete(helpers).where(
          and(
            planningScopeFor(helpers, selectedYear, selectedEventId),
            inArray(
              helpers.id,
              helperRows.map(item => item.id)
            )
          )
        );
        requireDeletedRows(result, helperRows.length);
      }
      await tx
        .delete(contacts)
        .where(planningScopeFor(contacts, selectedYear, selectedEventId));
      await tx
        .delete(prepTasks)
        .where(planningScopeFor(prepTasks, selectedYear, selectedEventId));
      await tx
        .delete(postTasks)
        .where(planningScopeFor(postTasks, selectedYear, selectedEventId));
      await tx
        .delete(materials)
        .where(planningScopeFor(materials, selectedYear, selectedEventId));
      await tx
        .delete(marketing)
        .where(planningScopeFor(marketing, selectedYear, selectedEventId));
      await tx
        .delete(approvals)
        .where(planningScopeFor(approvals, selectedYear, selectedEventId));
      if (cakeRows.length) {
        const result = await tx.delete(cakes).where(
          and(
            planningScopeFor(cakes, selectedYear, selectedEventId),
            inArray(
              cakes.id,
              cakeRows.map(item => item.id)
            )
          )
        );
        requireDeletedRows(result, cakeRows.length);
      }
      await tx
        .delete(finances)
        .where(planningScopeFor(finances, selectedYear, selectedEventId));
    });
    return;
  }

  if (area === "contacts") {
    await db.transaction(async tx => {
      const contactRows = await tx
        .select()
        .from(contacts)
        .where(planningScopeFor(contacts, selectedYear, selectedEventId))
        .for("update");
      const linkedHelpers = await tx
        .select()
        .from(helpers)
        .where(planningScopeFor(helpers, selectedYear, selectedEventId))
        .for("update");
      const contactById = new Map(contactRows.map(item => [item.id, item]));
      const selfHelpers = linkedHelpers.filter(helper => {
        const contact = helper.contactId
          ? contactById.get(helper.contactId)
          : undefined;
        return (
          contact &&
          normalizePersonName(helper.name) === normalizePersonName(contact.name)
        );
      });
      const selfHelperIds = selfHelpers.map(item => item.id);
      const assignmentRows = selfHelperIds.length
        ? await tx
            .select({
              helperId: assignments.helperId,
              shiftId: assignments.shiftId,
              slot: assignments.slot,
            })
            .from(assignments)
            .where(inArray(assignments.helperId, selfHelperIds))
            .for("update")
        : [];
      await recordDeletionAudit(
        tx,
        actor,
        "area_reset",
        selfHelpers.map(helper =>
          helperAuditEntity(
            helper,
            assignmentRows
              .filter(item => item.helperId === helper.id)
              .map(({ shiftId, slot }) => ({ shiftId, slot }))
          )
        ),
        selectedYear,
        selectedEventId
      );
      if (selfHelperIds.length) {
        const helperResult = await tx
          .delete(helpers)
          .where(
            and(
              planningScopeFor(helpers, selectedYear, selectedEventId),
              inArray(helpers.id, selfHelperIds)
            )
          );
        requireDeletedRows(helperResult, selfHelperIds.length);
      }
      if (contactRows.length) {
        const contactIds = contactRows.map(item => item.id);
        await tx
          .delete(shiftAreaContacts)
          .where(
            and(
              planningScopeFor(shiftAreaContacts, selectedYear, selectedEventId),
              inArray(shiftAreaContacts.contactId, contactIds)
            )
          );
        const clearContactRefForScope = <TTable extends typeof helpers>(table: TTable) =>
          tx
            .update(table as any)
            .set({ contactId: null })
            .where(
              and(
                planningScopeFor(table as any, selectedYear, selectedEventId),
                inArray((table as any).contactId, contactIds)
              )
            );
        await clearContactRefForScope(helpers);
        await clearContactRefForScope(prepTasks as any);
        await clearContactRefForScope(postTasks as any);
        await clearContactRefForScope(materials as any);
        await clearContactRefForScope(marketing as any);
        await clearContactRefForScope(approvals as any);
      }
      if (contactRows.length) {
        const contactResult = await tx
          .delete(contacts)
          .where(
            and(
              planningScopeFor(contacts, selectedYear, selectedEventId),
              inArray(
                contacts.id,
                contactRows.map(item => item.id)
              )
            )
          );
        requireDeletedRows(contactResult, contactRows.length);
      }
    });
    return;
  }

  if (area === "helpers" || area === "cakes") {
    await db.transaction(async tx => {
      if (area === "helpers") {
        const rows = await tx
          .select()
          .from(helpers)
          .where(planningScopeFor(helpers, selectedYear, selectedEventId))
          .for("update");
        await recordDeletionAudit(
          tx,
          actor,
          "area_reset",
          rows.map(item => helperAuditEntity(item)),
          selectedYear,
          selectedEventId
        );
        if (rows.length) {
          const result = await tx.delete(helpers).where(
            and(
              planningScopeFor(helpers, selectedYear, selectedEventId),
              inArray(
                helpers.id,
                rows.map(item => item.id)
              )
            )
          );
          requireDeletedRows(result, rows.length);
        }
      } else {
        const rows = await tx
          .select()
          .from(cakes)
          .where(planningScopeFor(cakes, selectedYear, selectedEventId))
          .for("update");
        await recordDeletionAudit(
          tx,
          actor,
          "area_reset",
          rows.map(item => cakeAuditEntity(item)),
          selectedYear,
          selectedEventId
        );
        if (rows.length) {
          const result = await tx.delete(cakes).where(
            and(
              planningScopeFor(cakes, selectedYear, selectedEventId),
              inArray(
                cakes.id,
                rows.map(item => item.id)
              )
            )
          );
          requireDeletedRows(result, rows.length);
        }
        await tx
          .update(events)
          .set({
            donationTargetKuchen: 0,
            donationTargetSalat: 0,
            donationTargetSnack: 0,
            donationTargetSonstiges: 0,
          })
          .where(
            and(
              eq(events.id, selectedEventId),
              eq(events.year, selectedYear)
            )
          );
      }
    });
    return;
  }

  if (area === "shifts") {
    await db.transaction(async tx => {
      await tx
        .delete(shiftAreaContacts)
        .where(
          planningScopeFor(shiftAreaContacts, selectedYear, selectedEventId)
        );
      await tx
        .delete(shifts)
        .where(planningScopeFor(shifts, selectedYear, selectedEventId));
    });
    return;
  }

  const tableByArea = {
    prep: prepTasks,
    post: postTasks,
    materials,
    marketing,
    approvals,
    cakes,
    finances,
  } as const;
  const table = tableByArea[area];
  await db.transaction(async tx => {
    const rows = await tx
      .select({ id: table.id })
      .from(table)
      .where(planningScopeFor(table, selectedYear, selectedEventId))
      .for("update");
    if (!rows.length) return;
    const result = await tx
      .delete(table)
      .where(
        and(
          planningScopeFor(table, selectedYear, selectedEventId),
          inArray(
            table.id,
            rows.map(row => row.id)
          )
        )
      );
    requireDeletedRows(result, rows.length);
  });
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

export const TEAM_NOTES_TTL_MS = 24 * 60 * 60 * 1000;
export const TEAM_NOTE_TYPING_TTL_MS = 8 * 1000;

export async function cleanupExpiredTeamNotes(now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const threshold = new Date(now.getTime() - TEAM_NOTES_TTL_MS);
  const [result]: any = await (db as DB)
    .delete(teamNotes)
    .where(lt(teamNotes.createdAt, threshold));
  return affectedRows(result);
}

export async function cleanupExpiredTeamNoteTypings(now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const threshold = new Date(now.getTime() - TEAM_NOTE_TYPING_TTL_MS);
  const [result]: any = await (db as DB)
    .delete(teamNoteTypings)
    .where(lt(teamNoteTypings.updatedAt, threshold));
  return affectedRows(result);
}

export async function listTeamNotes(options?: {
  sinceId?: number;
  limit?: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  await cleanupExpiredTeamNotes(options?.now);
  await cleanupExpiredTeamNoteTypings(options?.now);
  const cutoff = new Date((options?.now ?? new Date()).getTime() - TEAM_NOTES_TTL_MS);
  const conditions = [
    planningScope(teamNotes),
    gte(teamNotes.createdAt, cutoff),
    ...(options?.sinceId ? [gt(teamNotes.id, options.sinceId)] : []),
  ];
  return db
    .select()
    .from(teamNotes)
    .where(and(...conditions))
    .orderBy(asc(teamNotes.id))
    .limit(Math.min(options?.limit ?? 150, 300));
}

export type TeamNoteReadIdentity = {
  identityKey: string;
  userId?: number | null;
  sessionName: string;
  role: "user" | "admin";
};

/** Liefert die serverseitig persistierte Anzahl seit dem letzten Öffnen des Chats. */
export async function getTeamNoteUnreadStatus(
  identity: TeamNoteReadIdentity,
  now = new Date()
) {
  const database = await getDb();
  if (!database) return { unreadCount: 0, hasImportantUnread: false } as const;

  await cleanupExpiredTeamNotes(now);
  const [readState] = await database
    .select({ lastReadAt: teamNoteReadStates.lastReadAt })
    .from(teamNoteReadStates)
    .where(
      and(
        planningScope(teamNoteReadStates),
        eq(teamNoteReadStates.identityKey, identity.identityKey)
      )
    )
    .limit(1);

  const cutoff = new Date(now.getTime() - TEAM_NOTES_TTL_MS);
  const conditions = [
    planningScope(teamNotes),
    gte(teamNotes.createdAt, cutoff),
    ...(readState ? [gt(teamNotes.createdAt, readState.lastReadAt)] : []),
  ];
  const [countRow] = await database
    .select({ count: sql<number>`count(*)` })
    .from(teamNotes)
    .where(and(...conditions));
  const [importantRow] = await database
    .select({ id: teamNotes.id })
    .from(teamNotes)
    .where(and(...conditions, eq(teamNotes.important, true)))
    .limit(1);

  return {
    unreadCount: Number(countRow?.count ?? 0),
    hasImportantUnread: Boolean(importantRow),
  } as const;
}

/** Markiert alle bis zu diesem Zeitpunkt sichtbaren Notizen als gelesen. */
export async function markTeamNotesRead(
  identity: TeamNoteReadIdentity,
  readAt = new Date()
) {
  const database = (await getDb()) as DB;
  await database
    .insert(teamNoteReadStates)
    .values({
      year: year(),
      eventId: event(),
      identityKey: identity.identityKey,
      userId: identity.userId ?? null,
      sessionName: identity.sessionName,
      role: identity.role,
      lastReadAt: readAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: identity.userId ?? null,
        sessionName: identity.sessionName,
        role: identity.role,
        lastReadAt: readAt,
      },
    });
  return { lastReadAt: readAt } as const;
}

export async function setTeamNoteTyping(params: {
  sessionKey: string;
  senderUserId?: number | null;
  senderName: string;
  senderRole: "user" | "admin";
  isTyping: boolean;
}) {
  const db = (await getDb()) as DB;
  await cleanupExpiredTeamNoteTypings();
  if (!params.isTyping) {
    await db
      .delete(teamNoteTypings)
      .where(
        and(
          eq(teamNoteTypings.sessionKey, params.sessionKey),
          planningScope(teamNoteTypings)
        )
      );
    return false;
  }
  const now = new Date();
  const cleanName = params.senderName.trim().replace(/\s+/g, " ");
  await db
    .insert(teamNoteTypings)
    .values({
      sessionKey: params.sessionKey,
      year: year(),
      eventId: event(),
      userId: params.senderUserId ?? null,
      senderName: cleanName,
      senderRole: params.senderRole,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        year: year(),
        eventId: event(),
        userId: params.senderUserId ?? null,
        senderName: cleanName,
        senderRole: params.senderRole,
        updatedAt: now,
      },
    });
  return true;
}

export async function listActiveTypers(params?: {
  excludeSessionKey?: string | null;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  await cleanupExpiredTeamNoteTypings(params?.now);
  const activeSince = new Date(
    (params?.now ?? new Date()).getTime() - TEAM_NOTE_TYPING_TTL_MS
  );
  const conditions = [
    planningScope(teamNoteTypings),
    gte(teamNoteTypings.updatedAt, activeSince),
    ...(params?.excludeSessionKey
      ? [notEq(teamNoteTypings.sessionKey, params.excludeSessionKey)]
      : []),
  ];
  const rows = await db
    .select({
      sessionKey: teamNoteTypings.sessionKey,
      senderName: teamNoteTypings.senderName,
      senderRole: teamNoteTypings.senderRole,
      updatedAt: teamNoteTypings.updatedAt,
    })
    .from(teamNoteTypings)
    .where(and(...conditions))
    .orderBy(desc(teamNoteTypings.updatedAt));
  return rows;
}

export async function createTeamNote(params: {
  senderUserId?: number | null;
  senderName: string;
  senderRole: "user" | "admin";
  message: string;
  important?: boolean;
  sessionKey?: string | null;
}) {
  const db = (await getDb()) as DB;
  await cleanupExpiredTeamNotes();
  const cleanMessage = params.message.trim();
  const cleanName = params.senderName.trim().replace(/\s+/g, " ");
  const result: any = await db.insert(teamNotes).values({
    year: year(),
    eventId: event(),
    senderUserId: params.senderUserId ?? null,
    senderName: cleanName,
    senderRole: params.senderRole,
    message: cleanMessage,
    important: Boolean(params.important),
  });
  if (params.sessionKey) {
    await db
      .delete(teamNoteTypings)
      .where(
        and(
          eq(teamNoteTypings.sessionKey, params.sessionKey),
          planningScope(teamNoteTypings)
        )
      );
  }
  const id = Number(result?.[0]?.insertId ?? result?.insertId);
  const [created] = await db
    .select()
    .from(teamNotes)
    .where(and(eq(teamNotes.id, id), planningScope(teamNotes)))
    .limit(1);
  if (!created) {
    throw new Error("Team-Notiz konnte nicht gespeichert werden");
  }
  return created;
}

export async function clearTeamNotes(
  actor?: AuditActor,
  scopeOverride?: { year: number; eventId: number }
) {
  const db = (await getDb()) as DB;
  const selectedYear = scopeOverride?.year ?? year();
  const selectedEventId = scopeOverride?.eventId ?? event();
  return db.transaction(async tx => {
    const [selectedEvent] = await tx
      .select({ name: events.name })
      .from(events)
      .where(
        and(
          eq(events.id, selectedEventId),
          eq(events.tenantId, tenant()),
          eq(events.year, selectedYear)
        )
      )
      .limit(1)
      .for("update");
    if (!selectedEvent) {
      throw new Error("Veranstaltung für Chat-Löschung nicht gefunden");
    }

    const eventScopeConditions = <
      TTable extends
        | typeof teamNotes
        | typeof teamNoteTypings
        | typeof teamNoteReadStates
    >(
      table: TTable
    ) => and(eq(table.year, selectedYear), eq(table.eventId, selectedEventId));

    const [result]: any = await tx
      .delete(teamNotes)
      .where(eventScopeConditions(teamNotes));
    await tx
      .delete(teamNoteTypings)
      .where(eventScopeConditions(teamNoteTypings));
    await tx
      .delete(teamNoteReadStates)
      .where(eventScopeConditions(teamNoteReadStates));

    const deletedCount = affectedRows(result);
    if (actor) {
      await tx.insert(teamNoteAuditLogs).values({
        year: selectedYear,
        eventId: selectedEventId,
        eventName: selectedEvent.name,
        action: "clear",
        deletedCount,
        actorUserId: actor.userId,
        actorName: actor.name,
        actorRole: "admin",
        actorLoginMethod: actor.loginMethod ?? null,
      });
    }
    return { deletedCount } as const;
  });
}

export async function copyPlanFromEvent(
  sourceEventId: number,
  targetEventId = event()
) {
  if (sourceEventId === targetEventId)
    throw new Error("Quell- und Zielveranstaltung müssen verschieden sein");
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const [sourceEvent] = await tx
      .select()
      .from(events)
      .where(
        and(eq(events.id, sourceEventId), eq(events.tenantId, tenant()))
      )
      .limit(1);
    const [targetEvent] = await tx
      .select()
      .from(events)
      .where(
        and(eq(events.id, targetEventId), eq(events.tenantId, tenant()))
      )
      .limit(1);
    if (!sourceEvent || !targetEvent)
      throw new Error("Quell- oder Zielveranstaltung wurde nicht gefunden");
    if (targetEvent.year !== year())
      throw new Error("Die Zielveranstaltung gehört nicht zum gewählten Jahr");

    const [
      sourceContacts,
      sourceHelpers,
      sourceShifts,
      sourceAssignments,
      sourceAreaContacts,
      sourceLocations,
      targetContacts,
      targetHelpers,
      targetShifts,
      targetAreaContacts,
    ] = await Promise.all([
      tx.select().from(contacts).where(eq(contacts.eventId, sourceEventId)),
      tx.select().from(helpers).where(eq(helpers.eventId, sourceEventId)),
      tx.select().from(shifts).where(eq(shifts.eventId, sourceEventId)),
      tx
        .select({ ...getTableColumns(assignments) })
        .from(assignments)
        .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
        .where(eq(shifts.eventId, sourceEventId)),
      tx
        .select()
        .from(shiftAreaContacts)
        .where(eq(shiftAreaContacts.eventId, sourceEventId)),
      tx.select().from(locations).where(eq(locations.eventId, sourceEventId)),
      tx.select().from(contacts).where(eq(contacts.eventId, targetEventId)),
      tx.select().from(helpers).where(eq(helpers.eventId, targetEventId)),
      tx.select().from(shifts).where(eq(shifts.eventId, targetEventId)),
      tx
        .select()
        .from(shiftAreaContacts)
        .where(eq(shiftAreaContacts.eventId, targetEventId)),
    ]);

    const targetActiveDays = eventWeekdays(targetEvent.activeDays);
    const sourceShiftDays = new Set(sourceShifts.map(item => item.day));
    const inactiveSourceDays = WEEKDAYS.filter(
      day => sourceShiftDays.has(day) && !targetActiveDays.includes(day)
    );
    if (inactiveSourceDays.length)
      throw new Error(
        `Die Quellplanung enthält Schichten an nicht aktiven Zieltagen: ${inactiveSourceDays.join(", ")}. Bitte wählen Sie diese Tage zuerst beim Anlegen der Zielveranstaltung aus.`
      );

    const contactMap = new Map<number, number>();
    const contactByName = new Map(
      targetContacts.map(item => [normalizePersonName(item.name), item.id])
    );
    let contactsCreated = 0;
    for (const item of sourceContacts) {
      let targetId = contactByName.get(normalizePersonName(item.name));
      if (!targetId) {
        const result: any = await tx.insert(contacts).values({
          year: targetEvent.year,
          eventId: targetEvent.id,
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

    const targetAreaNames = new Set(targetAreaContacts.map(item => item.area));
    let areaContactsCreated = 0;
    for (const item of sourceAreaContacts) {
      const contactId = item.contactId ? contactMap.get(item.contactId) : null;
      if (!contactId || targetAreaNames.has(item.area)) continue;
      await tx.insert(shiftAreaContacts).values({
        year: targetEvent.year,
        eventId: targetEvent.id,
        area: item.area,
        contactId,
      });
      targetAreaNames.add(item.area);
      areaContactsCreated++;
    }

    const helperMap = new Map<number, number>();
    const helperByName = new Map(
      targetHelpers.map(item => [normalizePersonName(item.name), item.id])
    );
    let helpersCreated = 0;
    for (const item of sourceHelpers) {
      let targetId = helperByName.get(normalizePersonName(item.name));
      if (!targetId) {
        const result: any = await tx.insert(helpers).values({
          year: targetEvent.year,
          eventId: targetEvent.id,
          name: item.name,
          contactId: item.contactId
            ? (contactMap.get(item.contactId) ?? null)
            : null,
          email: item.email,
          phone: item.phone,
          note: item.note,
          willHelp: item.willHelp,
          availMon: item.availMon,
          availTue: item.availTue,
          availWed: item.availWed,
          availThu: item.availThu,
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

    const copiedContacts = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.eventId, targetEventId));
    for (const contact of copiedContacts) {
      const helper = await syncContactToSelfHelperWithClient(
        tx,
        contact,
        undefined,
        targetEvent.year,
        targetEvent.id
      );
      if (!helperByName.has(normalizePersonName(contact.name))) {
        helperByName.set(normalizePersonName(contact.name), helper.id);
        helpersCreated++;
      }
    }

    const locationMap = new Map<number, number>();
    const targetLocations = await tx.select().from(locations).where(eq(locations.eventId, targetEventId));
    const locationByName = new Map(targetLocations.map(item => [item.name.trim().toLowerCase(), item.id]));
    for (const item of sourceLocations) {
      let targetId = locationByName.get(item.name.trim().toLowerCase());
      if (!targetId) {
        const result: any = await tx.insert(locations).values({
          year: targetEvent.year,
          eventId: targetEvent.id,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          sortOrder: item.sortOrder,
        });
        targetId = Number(result?.[0]?.insertId ?? result?.insertId);
        locationByName.set(item.name.trim().toLowerCase(), targetId);
      }
      locationMap.set(item.id, targetId);
    }

    const shiftMap = new Map<number, number>();
    const targetShiftByKey = new Map(
      targetShifts.map(item => [shiftKey(item), item.id])
    );
    let shiftsCreated = 0;
    for (const item of sourceShifts) {
      let targetId = targetShiftByKey.get(shiftKey(item));
      if (!targetId) {
        const result: any = await tx.insert(shifts).values({
          year: targetEvent.year,
          eventId: targetEvent.id,
          day: item.day,
          area: item.area,
          task: item.task,
          locationId: item.locationId ? (locationMap.get(item.locationId) ?? null) : null,
          startTime: item.startTime,
          endTime: item.endTime,
          allowFlexibleAssignment: item.allowFlexibleAssignment,
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

    const currentAssignments = await tx
      .select({ ...getTableColumns(assignments) })
      .from(assignments)
      .innerJoin(shifts, eq(assignments.shiftId, shifts.id))
      .where(eq(shifts.eventId, targetEventId));
    const occupied = new Set(
      currentAssignments.map(item => String(item.shiftId) + ":" + item.slot)
    );
    const assignedHelpers = new Set(
      currentAssignments.map(item => String(item.shiftId) + ":" + item.helperId)
    );
    let assignmentsCreated = 0;
    for (const item of sourceAssignments) {
      const shiftId = shiftMap.get(item.shiftId);
      const helperId = helperMap.get(item.helperId);
      if (
        !shiftId ||
        !helperId ||
        occupied.has(String(shiftId) + ":" + item.slot) ||
        assignedHelpers.has(String(shiftId) + ":" + helperId)
      )
        continue;
      await tx.insert(assignments).values({
        shiftId,
        helperId,
        year: targetEvent.year,
        eventId: targetEvent.id,
        slot: item.slot,
      });
      occupied.add(String(shiftId) + ":" + item.slot);
      assignedHelpers.add(String(shiftId) + ":" + helperId);
      assignmentsCreated++;
    }

    return {
      sourceEvent: sourceEvent.name,
      targetEvent: targetEvent.name,
      contactsCreated,
      helpersCreated,
      shiftsCreated,
      assignmentsCreated,
      areaContactsCreated,
    };
  });
}

export function tenantAdminOpenId(userId: number) {
  return `tenant-admin-${userId}`;
}

export async function getTenantAdminCredentialsByEmail(email: string) {
  const database = await getDb();
  if (!database) return undefined;
  const normalizedEmail = email.trim().toLocaleLowerCase("de-DE");
  const [row] = await database
    .select({
      userId: tenantAdminCredentials.userId,
      email: tenantAdminCredentials.email,
      passwordHash: tenantAdminCredentials.passwordHash,
      mustChangePassword: tenantAdminCredentials.mustChangePassword,
      sessionVersion: tenantAdminCredentials.sessionVersion,
      status: tenantAdminCredentials.status,
      userName: users.name,
      userOpenId: users.openId,
    })
    .from(tenantAdminCredentials)
    .innerJoin(users, eq(users.id, tenantAdminCredentials.userId))
    .where(and(eq(tenantAdminCredentials.email, normalizedEmail), eq(tenantAdminCredentials.status, "active")))
    .limit(1);
  return row;
}

/** Liefert, ob ein persönlicher Vereinsadmin noch seinen Einmalcode ersetzen muss. */
export async function isTenantAdminPasswordChangeRequired(userId: number) {
  const database = await getDb();
  if (!database) return false;
  const [credential] = await database
    .select({
      mustChangePassword: tenantAdminCredentials.mustChangePassword,
      status: tenantAdminCredentials.status,
    })
    .from(tenantAdminCredentials)
    .where(eq(tenantAdminCredentials.userId, userId))
    .limit(1);
  return credential?.status === "active" && credential.mustChangePassword;
}

export async function createOrUpdateTenantAdminForPlatformAdmin(input: {
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const normalizedEmail = input.email.trim().toLocaleLowerCase("de-DE");
    const name = input.name.trim();
    if (!name || !normalizedEmail) {
      throw new Error("Name und E-Mail des Vereinsadministrators sind erforderlich");
    }

    const [planningAccessWithSameEmail] = await tx
      .select({ id: planningTeamAccesses.id })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.email, normalizedEmail))
      .limit(1)
      .for("update");
    if (planningAccessWithSameEmail) {
      throw new Error(
        "Diese E-Mail-Adresse ist bereits einem Planungsteam-Zugang zugeordnet. Bitte zunächst den Testzugang entfernen oder eine andere E-Mail-Adresse verwenden."
      );
    }

    let [existingUser] = await tx
      .select({ id: users.id, openId: users.openId })
      .from(users)
      .where(or(eq(users.email, normalizedEmail), eq(users.openId, `tenant-admin:${normalizedEmail}`)))
      .limit(1)
      .for("update");

    if (!existingUser) {
      const tempOpenId = `tenant-admin:${normalizedEmail}`;
      await tx.insert(users).values({
        openId: tempOpenId,
        name,
        email: normalizedEmail,
        role: "admin",
        loginMethod: "password",
        lastSignedIn: new Date(),
      });
      const [created] = await tx
        .select({ id: users.id, openId: users.openId })
        .from(users)
        .where(eq(users.openId, tempOpenId))
        .limit(1)
        .for("update");
      if (!created) throw new Error("Benutzerkonto konnte nicht angelegt werden");
      existingUser = created;
    } else {
      await tx
        .update(users)
        .set({ name, email: normalizedEmail, role: "admin", loginMethod: "password" })
        .where(eq(users.id, existingUser.id));
    }

    await tx
      .insert(tenantAdminCredentials)
      .values({
        userId: existingUser.id,
        email: normalizedEmail,
        passwordHash: input.passwordHash,
        mustChangePassword: true,
        sessionVersion: 1,
        status: "active",
      })
      .onDuplicateKeyUpdate({
        set: {
          passwordHash: input.passwordHash,
          mustChangePassword: true,
          sessionVersion: sql`${tenantAdminCredentials.sessionVersion} + 1`,
          status: "active",
        },
      });

    await tx
      .insert(userTenantMemberships)
      .values({
        userId: existingUser.id,
        tenantId: input.tenantId,
        role: "tenant_admin",
        status: "active",
        isDefault: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          role: "tenant_admin",
          status: "active",
          isDefault: true,
        },
      });

    return { userId: existingUser.id, email: normalizedEmail, name } as const;
  });
}

/** Ersetzt eventuell noch offene Einladungen desselben Vereinsadmin-Kontos. */
export async function createTenantAdminInvitation(input: {
  userId: number;
  tenantId: string;
  tokenHash: string;
  expiresInSeconds?: number;
}) {
  const database = (await getDb()) as DB;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (input.expiresInSeconds ?? 48 * 60 * 60) * 1000
  );

  return database.transaction(async tx => {
    // Bei einer erneuten Einladung darf ausschließlich der jüngste Link gelten.
    await tx
      .update(tenantAdminInvitations)
      .set({ usedAt: now })
      .where(
        and(
          eq(tenantAdminInvitations.userId, input.userId),
          eq(tenantAdminInvitations.tenantId, input.tenantId),
          isNull(tenantAdminInvitations.usedAt)
        )
      );

    await tx.insert(tenantAdminInvitations).values({
      tokenHash: input.tokenHash,
      userId: input.userId,
      tenantId: input.tenantId,
      expiresAt,
    });

    return { expiresAt } as const;
  });
}

/** Löst einen Aktivierungslink atomar genau einmal ein. */
export async function consumeTenantAdminInvitation(tokenHash: string) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const now = new Date();
    const [row] = await tx
      .select({
        userId: tenantAdminInvitations.userId,
        tenantId: tenantAdminInvitations.tenantId,
        userOpenId: users.openId,
        userName: users.name,
        sessionVersion: tenantAdminCredentials.sessionVersion,
      })
      .from(tenantAdminInvitations)
      .innerJoin(users, eq(users.id, tenantAdminInvitations.userId))
      .innerJoin(
        tenantAdminCredentials,
        eq(tenantAdminCredentials.userId, tenantAdminInvitations.userId)
      )
      .innerJoin(
        userTenantMemberships,
        and(
          eq(userTenantMemberships.userId, tenantAdminInvitations.userId),
          eq(userTenantMemberships.tenantId, tenantAdminInvitations.tenantId)
        )
      )
      .where(
        and(
          eq(tenantAdminInvitations.tokenHash, tokenHash),
          isNull(tenantAdminInvitations.usedAt),
          gt(tenantAdminInvitations.expiresAt, now),
          eq(tenantAdminCredentials.status, "active"),
          eq(userTenantMemberships.status, "active")
        )
      )
      .limit(1)
      .for("update");

    if (!row) return null;
    await tx
      .update(tenantAdminInvitations)
      .set({ usedAt: now })
      .where(eq(tenantAdminInvitations.tokenHash, tokenHash));
    return row;
  });
}

export async function completeTenantAdminInitialPasswordChange(input: {
  userId: number;
  passwordHash: string;
}) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    await tx
      .update(tenantAdminCredentials)
      .set({
        passwordHash: input.passwordHash,
        mustChangePassword: false,
        sessionVersion: sql`${tenantAdminCredentials.sessionVersion} + 1`,
      })
      .where(eq(tenantAdminCredentials.userId, input.userId));

    const [row] = await tx
      .select({
        userId: tenantAdminCredentials.userId,
        sessionVersion: tenantAdminCredentials.sessionVersion,
        userName: users.name,
        userOpenId: users.openId,
      })
      .from(tenantAdminCredentials)
      .innerJoin(users, eq(users.id, tenantAdminCredentials.userId))
      .where(eq(tenantAdminCredentials.userId, input.userId))
      .limit(1);
    if (!row) throw new Error("Zugangsdaten nicht gefunden");
    return row;
  });
}

export async function getPlatformLaunchSettings() {
  const database = await getDb();
  if (!database) {
    return {
      paymentsEnabled: false,
      publicSelfServiceEnabled: false,
      paymentProvider: "none" as const,
      invoiceWorkflow: "manual" as const,
    };
  }
  const [row] = await database
    .select()
    .from(platformLaunchSettings)
    .where(eq(platformLaunchSettings.id, 1))
    .limit(1);
  if (!row) {
    await database.insert(platformLaunchSettings).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: 1 } });
    return {
      paymentsEnabled: false,
      publicSelfServiceEnabled: false,
      paymentProvider: "none" as const,
      invoiceWorkflow: "manual" as const,
    };
  }
  return {
    paymentsEnabled: row.paymentsEnabled,
    publicSelfServiceEnabled: row.publicSelfServiceEnabled,
    paymentProvider: row.paymentProvider,
    invoiceWorkflow: row.invoiceWorkflow,
  };
}

export async function createPlatformTenantHandoff(input: {
  tenantId: string;
  createdByOpenId: string;
  tokenHash: string;
  expiresInSeconds?: number;
}) {
  const database = (await getDb()) as DB;
  const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 300) * 1000);
  await database.insert(platformTenantHandoffs).values({
    tokenHash: input.tokenHash,
    tenantId: input.tenantId,
    createdByOpenId: input.createdByOpenId,
    expiresAt,
  });
  return { tenantId: input.tenantId, expiresAt } as const;
}

export async function consumePlatformTenantHandoff(tokenHash: string) {
  const database = (await getDb()) as DB;
  return database.transaction(async tx => {
    const now = new Date();
    const [row] = await tx
      .select()
      .from(platformTenantHandoffs)
      .where(and(eq(platformTenantHandoffs.tokenHash, tokenHash), isNull(platformTenantHandoffs.usedAt), gt(platformTenantHandoffs.expiresAt, now)))
      .limit(1)
      .for("update");
    if (!row) return null;
    await tx
      .update(platformTenantHandoffs)
      .set({ usedAt: now })
      .where(eq(platformTenantHandoffs.tokenHash, tokenHash));
    return {
      tenantId: row.tenantId,
      createdByOpenId: row.createdByOpenId,
    } as const;
  });
}
