import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appSettings,
  approvals,
  assignments,
  cakes,
  contacts,
  deletionAuditLogs,
  events,
  eventYears,
  finances,
  helpers,
  InsertUser,
  marketing,
  materials,
  postTasks,
  prepTasks,
  securitySettings,
  shiftAreaContacts,
  shifts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { currentEventId, currentEventYear } from "./year-context";

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
  return db
    .select()
    .from(events)
    .where(eq(events.year, eventYear))
    .orderBy(events.sortOrder, events.name, events.id);
}

export async function getEvent(id = event()) {
  const db = await getDb();
  if (!db) return undefined;
  const [selected] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.year, year())))
    .limit(1);
  return selected;
}

export async function createEvent(name: string, eventYear = year()) {
  const db = (await getDb()) as DB;
  await ensureEventYear(eventYear);
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const [existing] = await db
    .select()
    .from(events)
    .where(and(eq(events.year, eventYear), eq(events.name, normalizedName)))
    .limit(1);
  if (existing) return { ...existing, created: false };
  const result: any = await db
    .insert(events)
    .values({ year: eventYear, name: normalizedName });
  const id = Number(result?.[0]?.insertId ?? result?.insertId);
  return { id, year: eventYear, name: normalizedName, created: true };
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
    .orderBy(shifts.sortOrder, shifts.id);
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
    .where(planningScope(prepTasks))
    .orderBy(prepTasks.sortOrder, prepTasks.id);
}
export async function listPost() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(postTasks)
    .where(planningScope(postTasks))
    .orderBy(postTasks.sortOrder, postTasks.id);
}
export async function listMaterials() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(materials)
    .where(planningScope(materials))
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

export async function createContact(v: {
  name: string;
  phone?: string;
  note?: string;
}) {
  const db = (await getDb()) as DB;
  return db.transaction(async tx => {
    const normalizedName = v.name.trim().replace(/\s+/g, " ");
    const result: any = await tx.insert(contacts).values({
      ...v,
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
      .where(and(eq(contacts.id, id), planningScope(contacts)))
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
      .where(and(eq(contacts.id, id), planningScope(contacts)));
    await syncContactToSelfHelperWithClient(tx, contact, before.name);
    return result;
  });
}
export async function deleteContact(id: number) {
  const db = (await getDb()) as DB;
  return db
    .delete(contacts)
    .where(and(eq(contacts.id, id), planningScope(contacts)));
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
    return tx
      .update(helpers)
      .set(safe)
      .where(and(eq(helpers.id, id), planningScope(helpers)));
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

type AuditEntity = {
  entityType: "helper" | "cake";
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
    .where(eq(events.id, selectedEventId))
    .limit(1);
  await client.insert(deletionAuditLogs).values(
    entries.map(entry => ({
      year: selectedYear,
      eventId: selectedEventId,
      eventName: selectedEvent?.name ?? null,
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
    dropoffTime: cake.dropoffTime,
    note: cake.note,
    sortOrder: cake.sortOrder,
  },
});

export async function listDeletionAuditLogs(filters?: {
  eventYear?: number;
  eventId?: number;
  entityType?: "helper" | "cake";
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
  return db.transaction(async tx => {
    const [entry] = await tx
      .select()
      .from(deletionAuditLogs)
      .where(eq(deletionAuditLogs.id, id))
      .limit(1)
      .for("update");
    if (!entry) throw new Error("Protokolleintrag wurde nicht gefunden");
    if (entry.action !== "single_delete") {
      throw new Error(
        "Nur einzelne Löschungen können gezielt rückgängig gemacht werden"
      );
    }
    if (entry.restoredAt) {
      throw new Error("Diese Löschung wurde bereits rückgängig gemacht");
    }
    if (!entry.eventId) {
      throw new Error(
        "Die ursprüngliche Veranstaltung ist nicht mehr verfügbar"
      );
    }
    const [selectedEvent] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, entry.eventId), eq(events.year, entry.year)))
      .limit(1);
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
    if (entry.entityType === "helper") {
      const helperRows = await tx
        .select()
        .from(helpers)
        .where(eq(helpers.eventId, entry.eventId));
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
                eq(contacts.eventId, entry.eventId)
              )
            )
            .limit(1)
        : [];
      const result: any = await tx.insert(helpers).values({
        year: entry.year,
        eventId: entry.eventId,
        name: entry.entityLabel,
        contactId: contact?.id ?? null,
        email: typeof details.email === "string" ? details.email : null,
        phone: typeof details.phone === "string" ? details.phone : null,
        note: typeof details.note === "string" ? details.note : null,
        willHelp: details.willHelp === "nein" ? "nein" : "ja",
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
      });
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
          .select({ id: shifts.id, needed: shifts.needed })
          .from(shifts)
          .where(
            and(
              eq(shifts.id, snapshot.shiftId),
              eq(shifts.eventId, entry.eventId)
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
        if (!shift || occupied || snapshot.slot >= shift.needed) {
          skippedAssignments++;
          continue;
        }
        await tx.insert(assignments).values({
          shiftId: snapshot.shiftId,
          helperId,
          slot: snapshot.slot,
        });
        restoredAssignments++;
      }
    } else {
      await tx.insert(cakes).values({
        year: entry.year,
        eventId: entry.eventId,
        donor: entry.entityLabel,
        cake: typeof details.cake === "string" ? details.cake : "",
        dropoffTime:
          typeof details.dropoffTime === "string" ? details.dropoffTime : "",
        note: typeof details.note === "string" ? details.note : null,
        sortOrder:
          typeof details.sortOrder === "number" ? details.sortOrder : 0,
      });
    }

    await tx
      .update(deletionAuditLogs)
      .set({
        restoredAt: new Date(),
        restoredByUserId: actor.userId,
        restoredByName: actor.name,
      })
      .where(
        and(eq(deletionAuditLogs.id, id), isNull(deletionAuditLogs.restoredAt))
      );

    return {
      entityType: entry.entityType,
      entityLabel: entry.entityLabel,
      eventId: entry.eventId,
      eventName: selectedEvent.name,
      restoredAssignments,
      skippedAssignments,
    };
  });
}

export async function deleteHelper(
  id: number,
  options: { allowAssigned?: boolean; actor: AuditActor }
) {
  if (
    !options.actor.responsibleContactId ||
    !options.actor.responsibleContactName
  ) {
    throw new Error(
      "Für die Helferlöschung muss der ausführende Ansprechpartner ausgewählt werden"
    );
  }
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

export async function createShift(
  v: Partial<typeof shifts.$inferInsert> & {
    day: "Freitag" | "Samstag" | "Sonntag";
    area: string;
    task: string;
  }
) {
  const db = (await getDb()) as DB;
  return db.insert(shifts).values({
    ...v,
    year: year(),
    eventId: event(),
  } as typeof shifts.$inferInsert);
}
export async function updateShift(
  id: number,
  v: Partial<typeof shifts.$inferInsert>
) {
  const db = (await getDb()) as DB;
  const { year: ignored, eventId: ignoredEventId, ...safe } = v;
  const result = await db
    .update(shifts)
    .set(safe)
    .where(and(eq(shifts.id, id), planningScope(shifts)));
  if (safe.area !== undefined) await removeOrphanShiftAreaContacts();
  return result;
}
export async function deleteShift(id: number) {
  const db = (await getDb()) as DB;
  const result = await db
    .delete(shifts)
    .where(and(eq(shifts.id, id), planningScope(shifts)));
  await removeOrphanShiftAreaContacts();
  return result;
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
async function removeOrphanShiftAreaContacts() {
  const db = (await getDb()) as DB;
  const activeAreas = await db
    .select({ area: shifts.area })
    .from(shifts)
    .where(planningScope(shifts));
  if (!activeAreas.length) {
    return db.delete(shiftAreaContacts).where(planningScope(shiftAreaContacts));
  }
  const areaSet = new Set(activeAreas.map(item => item.area));
  const mappings = await listShiftAreaContacts();
  const orphanIds = mappings
    .filter(item => !areaSet.has(item.area))
    .map(item => item.id);
  if (!orphanIds.length) return;
  return db
    .delete(shiftAreaContacts)
    .where(inArray(shiftAreaContacts.id, orphanIds));
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
      .where(and(eq(shifts.id, v.shiftId), planningScope(shifts)))
      .limit(1);
    const [helper] = await tx
      .select({ id: helpers.id })
      .from(helpers)
      .where(and(eq(helpers.id, v.helperId), planningScope(helpers)))
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
    .where(and(eq(shifts.id, v.shiftId), planningScope(shifts)))
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
          db.select({ id: shifts.id }).from(shifts).where(planningScope(shifts))
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
        db.select({ id: shifts.id }).from(shifts).where(planningScope(shifts))
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

export const createPrep = async (v: any) =>
  createYearRow(prepTasks, await scopedContactValues(v));
export const updatePrep = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(prepTasks)
    .set(await scopedContactValues(v))
    .where(yearWhere(prepTasks, id));
export const deletePrep = async (id: number) =>
  ((await getDb()) as DB).delete(prepTasks).where(yearWhere(prepTasks, id));
export const createPost = async (v: any) =>
  createYearRow(postTasks, await scopedContactValues(v));
export const updatePost = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(postTasks)
    .set(await scopedContactValues(v))
    .where(yearWhere(postTasks, id));
export const deletePost = async (id: number) =>
  ((await getDb()) as DB).delete(postTasks).where(yearWhere(postTasks, id));
export const createMaterial = async (v: any) =>
  createYearRow(materials, await scopedContactValues(v));
export const updateMaterial = async (id: number, v: any) =>
  ((await getDb()) as DB)
    .update(materials)
    .set(await scopedContactValues(v))
    .where(yearWhere(materials, id));
export const deleteMaterial = async (id: number) =>
  ((await getDb()) as DB).delete(materials).where(yearWhere(materials, id));
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
export const createCake = async (v: any) => createYearRow(cakes, v);
export const updateCake = async (id: number, v: any) =>
  ((await getDb()) as DB).update(cakes).set(v).where(yearWhere(cakes, id));
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
  if (
    (area === "helpers" || area === "all") &&
    (!actor.responsibleContactId || !actor.responsibleContactName)
  ) {
    throw new Error(
      "Für das Löschen von Helferdaten muss der ausführende Ansprechpartner ausgewählt werden"
    );
  }
  const remove = async (table: any) =>
    db
      .delete(table)
      .where(planningScopeFor(table, selectedYear, selectedEventId));

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
      }
    });
    if (area === "helpers") await syncContactsToSelfHelpers();
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
    contacts,
    helpers,
    prep: prepTasks,
    post: postTasks,
    materials,
    marketing,
    approvals,
    cakes,
    finances,
  } as const;
  await remove(tableByArea[area]);
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
      tx.select().from(contacts).where(eq(contacts.eventId, targetEventId)),
      tx.select().from(helpers).where(eq(helpers.eventId, targetEventId)),
      tx.select().from(shifts).where(eq(shifts.eventId, targetEventId)),
      tx
        .select()
        .from(shiftAreaContacts)
        .where(eq(shiftAreaContacts.eventId, targetEventId)),
    ]);

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
