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
  postTasks,
  prepTasks,
  revokedSessions,
  securitySettings,
  shiftAreaContacts,
  shifts,
  teamNotes,
  teamNoteAuditLogs,
  teamNoteTypings,
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
import { currentEventId, currentEventYear } from "./year-context";
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

const year = () => currentEventYear();
const event = () => currentEventId();

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

export async function listEvents(eventYear = year()) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.year, eventYear))
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
  eventIds: number[];
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PlanningTeamAccessCredential = {
  id: number;
  contactName: string | null;
  label: string;
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
    .where(inArray(events.id, normalized))
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
      passwordHash: planningTeamAccesses.passwordHash,
      mustChangePassword: planningTeamAccesses.mustChangePassword,
      sessionVersion: planningTeamAccesses.sessionVersion,
    })
    .from(planningTeamAccesses)
    .leftJoin(contacts, eq(contacts.id, planningTeamAccesses.contactId))
    .orderBy(planningTeamAccesses.id);
}

export async function createPlanningTeamAccess(input: {
  label: string;
  contactId?: number | null;
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
    const result: any = await tx.insert(planningTeamAccesses).values({
      contactId: contact?.id ?? null,
      label: contact?.name ?? input.label.trim(),
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

    await tx
      .update(planningTeamAccesses)
      .set({
        contactId: contact?.id ?? null,
        label: contact?.name ?? input.label.trim(),
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
    .where(eq(planningTeamAccessEvents.accessId, accessId))
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
    .where(and(eq(events.id, id), eq(events.year, year())))
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
    .where(and(eq(events.id, event()), eq(events.year, year())))
    .limit(1);
  if (!selectedEvent) throw new Error("Veranstaltung wurde nicht gefunden");
  await db
    .update(events)
    .set(values)
    .where(and(eq(events.id, event()), eq(events.year, year())));
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
        and(eq(events.id, selectedEventId), eq(events.year, selectedYear))
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
  return db.transaction(async tx => {
    const [selected] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.year, selectedYear)))
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
          and(eq(events.year, selectedYear), eq(events.name, nextName))
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
      .where(and(eq(events.id, id), eq(events.year, selectedYear)));

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
  const [existing] = await db
    .select()
    .from(events)
    .where(and(eq(events.year, eventYear), eq(events.name, normalizedName)))
    .limit(1);
  if (existing)
    return {
      ...existing,
      activeDays: eventWeekdays(existing.activeDays),
      created: false,
    };
  const result: any = await db
    .insert(events)
    .values({ year: eventYear, name: normalizedName, activeDays });
  const id = Number(result?.[0]?.insertId ?? result?.insertId);
  return {
    id,
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
  return db.transaction(async tx => {
    const yearEvents = await tx
      .select()
      .from(events)
      .where(eq(events.year, selectedYear))
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
      .where(and(eq(events.id, id), eq(events.year, selectedYear)));
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
  phone?: string | null;
  note?: string | null;
  passwordHash?: string;
}) {
  const existing = (await listContacts()).find(
    item => normalizePersonName(item.name) === normalizePersonName(v.name)
  );
  if (existing) {
    const updates = {
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
    const [access] = await database
      .select({ sessionVersion: planningTeamAccesses.sessionVersion })
      .from(planningTeamAccesses)
      .where(eq(planningTeamAccesses.id, planningTeamAccessId))
      .limit(1);
    // Ein gelöschter Zugang soll unmittelbar sämtliche offenen Sitzungen verlieren.
    return access?.sessionVersion ?? Number.MAX_SAFE_INTEGER;
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
      .where(and(eq(events.id, selectedEventId), eq(events.year, selectedYear)))
      .limit(1)
      .for("update");
    if (!selectedEvent) {
      throw new Error("Veranstaltung für Chat-Löschung nicht gefunden");
    }

    const eventScopeConditions = <TTable extends typeof teamNotes | typeof teamNoteTypings>(
      table: TTable
    ) => and(eq(table.year, selectedYear), eq(table.eventId, selectedEventId));

    const [result]: any = await tx
      .delete(teamNotes)
      .where(eventScopeConditions(teamNotes));
    await tx
      .delete(teamNoteTypings)
      .where(eventScopeConditions(teamNoteTypings));

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
      .where(eq(events.id, sourceEventId))
      .limit(1);
    const [targetEvent] = await tx
      .select()
      .from(events)
      .where(eq(events.id, targetEventId))
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
