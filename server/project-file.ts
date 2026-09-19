import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuditActor } from "./db";
import {
  createCurrentProjectDocument,
  previewProjectDocument,
  repairImportedDocumentRelations,
  restoreProjectDocument,
  type BackupDocument,
} from "./excel-backup";
import { overlaps, toMinutes } from "./logic";
import {
  eventWeekdays,
  helperEligibleForShift,
  helperAvailableForShift,
  helperAvailableOnDay,
  WEEKDAYS,
} from "../shared/weekdays";
import { normalizeMaterialStatus } from "../shared/material-status";
import { eventDateRangeError } from "../shared/event-dates";

const PROJECT_FORMAT = "RSC-HELFERPLANUNG-PROJEKTDATEI";
const PROJECT_VERSION = 17;
const MAX_PROJECT_BYTES = 10_000_000;
const MAX_ROWS = 10_000;

const id = z.number().int().positive().nullable();
const short = (max: number) => z.string().max(max);
const eventMetadataSchema = z
  .object({
    format: z.literal(PROJECT_FORMAT),
    version: z.literal(PROJECT_VERSION),
    eventId: z.number().int().positive(),
    eventName: short(200).min(1),
    year: z.number().int().min(2020).max(2100),
    activeDays: z
      .array(z.enum(WEEKDAYS))
      .min(1)
      .max(WEEKDAYS.length)
      .refine(days => new Set(days).size === days.length),
    pdfLogoKey: short(500).nullable(),
    pdfLogoUrl: short(700).nullable(),
    pdfLogoFallback: z.enum(["none", "brand"]),
    startDate: short(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    endDate: short(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    donationTargetKuchen: z.number().int().min(0).max(10_000).default(0),
    donationTargetSalat: z.number().int().min(0).max(10_000).default(0),
    donationTargetSnack: z.number().int().min(0).max(10_000).default(0),
    donationTargetSonstiges: z.number().int().min(0).max(10_000).default(0),
    exportedAt: z.string().datetime(),
  })
  .superRefine((metadata, context) => {
    const error = eventDateRangeError(metadata);
    if (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: error,
      });
    }
  });
const commonTask = z.object({
  sourceId: id,
  task: short(300).min(1),
  contactSourceId: id,
  contactName: short(200),
  status: z.enum(["offen", "inArbeit", "erledigt"]),
  note: short(10_000),
  sortOrder: z.number().int().min(0).max(1_000_000),
});
const documentSchema = z
  .object({
    metadata: eventMetadataSchema,
    contacts: z
      .array(
        z.object({
          sourceId: id,
          name: short(200).min(1),
          phone: short(64),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    helpers: z
      .array(
        z.object({
          sourceId: id,
          contactSourceId: id,
          contactName: short(200),
          name: short(200).min(1),
          email: short(320),
          phone: short(64),
          note: short(10_000),
          companion: short(500).default(""),
          willHelp: z.enum(["ja", "nein"]),
          availMon: z.enum(["ja", "nein", "vielleicht"]),
          availTue: z.enum(["ja", "nein", "vielleicht"]),
          availWed: z.enum(["ja", "nein", "vielleicht"]),
          availThu: z.enum(["ja", "nein", "vielleicht"]),
          availFri: z.enum(["ja", "nein", "vielleicht"]),
          availSat: z.enum(["ja", "nein", "vielleicht"]),
          availSun: z.enum(["ja", "nein", "vielleicht"]),
          availMonStart: short(5).default(""),
          availMonEnd: short(5).default(""),
          availTueStart: short(5).default(""),
          availTueEnd: short(5).default(""),
          availWedStart: short(5).default(""),
          availWedEnd: short(5).default(""),
          availThuStart: short(5).default(""),
          availThuEnd: short(5).default(""),
          availFriStart: short(5).default(""),
          availFriEnd: short(5).default(""),
          availSatStart: short(5).default(""),
          availSatEnd: short(5).default(""),
          availSunStart: short(5).default(""),
          availSunEnd: short(5).default(""),
          confirmed: z.enum(["ja", "nein"]),
        })
      )
      .max(MAX_ROWS),
    locations: z
      .array(
        z.object({
          sourceId: id,
          name: short(200).min(1),
          latitude: z.number().finite().min(-90).max(90),
          longitude: z.number().finite().min(-180).max(180),
          logoKey: short(500).nullable().default(null),
          logoUrl: short(700).nullable().default(null),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    shifts: z
      .array(
        z.object({
          sourceId: id,
          day: z.enum(WEEKDAYS),
          area: short(200).min(1),
          task: short(300).min(1),
          locationSourceId: id,
          locationName: short(200),
          startTime: short(16),
          endTime: short(16),
          allowFlexibleAssignment: z.boolean().default(false),
          manualOkConfirmed: z.boolean().default(false),
          manualDoubleConflictAccepted: z.boolean().default(false),
          needed: z.number().int().min(0).max(20),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
          areaContactSourceId: id,
          areaContactName: short(200),
          slots: z
            .array(
              z.object({
                slot: z.number().int().min(0).max(19),
                helperSourceId: id,
                helperName: short(200).min(1),
              })
            )
            .max(20),
        })
      )
      .max(MAX_ROWS),
    prep: z
      .array(
        commonTask.extend({
          category: short(120).default(""),
          dueText: short(200),
          locationSourceId: id,
          locationName: short(200),
          status: z.enum(["offen", "inArbeit", "erledigt", "abgelehnt"]),
          statusWording: z.enum(["aufgabe", "genehmigung"]).default("aufgabe"),
        })
      )
      .max(MAX_ROWS),
    post: z
      .array(
        commonTask.extend({
          category: short(120).default(""),
          dueText: short(200).default(""),
          locationSourceId: id,
          locationName: short(200),
        })
      )
      .max(MAX_ROWS),
    materials: z
      .array(
        z.object({
          sourceId: id,
          article: short(300).min(1),
          category: short(120),
          quantity: short(40),
          unit: short(40),
          locationSourceId: id,
          locationName: short(200),
          contactSourceId: id,
          contactName: short(200),
          status: z.enum(["offen", "bestellt", "geliefert"]),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    marketing: z
      .array(
        z.object({
          sourceId: id,
          measure: short(300).min(1),
          channel: short(160),
          contactSourceId: id,
          contactName: short(200),
          status: z.enum(["offen", "inArbeit", "erledigt"]),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    approvals: z
      .array(
        z.object({
          sourceId: id,
          request: short(300).min(1),
          contactSourceId: id,
          contactName: short(200),
          status: z.enum(["offen", "beantragt", "genehmigt", "abgelehnt"]),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    cakes: z
      .array(
        z.object({
          sourceId: id,
          donor: short(200).min(1),
          cake: short(200),
          donationCategory: z
            .enum(["kuchen", "salat", "snack", "sonstiges", "deftiges"])
            .default("kuchen")
            .transform(value => (value === "deftiges" ? "sonstiges" : value)),
          locationSourceId: id,
          locationName: short(200),
          dropoffDate: short(10)
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .or(z.literal("")),
          dropoffTime: short(5)
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .or(z.literal("")),
          legacyDropoffText: short(60),
          vegan: z.boolean().default(false),
          glutenFree: z.boolean().default(false),
          lactoseFree: z.boolean().default(false),
          containsNuts: z.boolean().default(false),
          meat: z.boolean().default(false),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    finances: z
      .array(
        z.object({
          sourceId: id,
          category: short(160).min(1),
          income: z.number().int().min(0).max(10_000_000_000),
          expense: z.number().int().min(0).max(10_000_000_000),
          note: short(10_000),
          sortOrder: z.number().int().min(0).max(1_000_000),
        })
      )
      .max(MAX_ROWS),
    warnings: z.array(short(1_000)).max(1_000),
  })
  .strict();

const key = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");

function assertUnique(
  rows: Array<{ sourceId: number | null }>,
  label: (row: any) => string,
  section: string
) {
  const ids = new Set<number>();
  const labels = new Set<string>();
  for (const row of rows) {
    if (row.sourceId !== null) {
      if (ids.has(row.sourceId))
        throw new Error(`${section}: ID ${row.sourceId} ist doppelt vorhanden`);
      ids.add(row.sourceId);
    }
    const normalized = key(label(row));
    if (labels.has(normalized))
      throw new Error(`${section}: „${label(row)}“ ist doppelt vorhanden`);
    labels.add(normalized);
  }
}

function validateRelations(document: BackupDocument) {
  assertUnique(document.locations, row => row.name, "Orte");
  assertUnique(document.contacts, row => row.name, "Ansprechpartner");
  assertUnique(document.helpers, row => row.name, "Helfer");
  assertUnique(
    document.shifts,
    row => `${row.day}|${row.area}|${row.task}|${row.startTime}|${row.endTime}`,
    "Einsatzplan"
  );
  for (const [rows, label, name] of [
    [document.prep, "Vorbereitung", (row: any) => row.task],
    [document.post, "Nachbereitung", (row: any) => row.task],
    [document.materials, "Material", (row: any) => row.article],
    [document.marketing, "Marketing", (row: any) => row.measure],
    [document.approvals, "Genehmigungen", (row: any) => row.request],
    [document.cakes, "Kuchen", (row: any) => `${row.donor}|${row.cake}`],
    [document.finances, "Finanzen", (row: any) => row.category],
  ] as const)
    assertUnique(rows as any, name, label);

  const contactsById = new Map(
    document.contacts.flatMap(row =>
      row.sourceId === null ? [] : ([[row.sourceId, row]] as const)
    )
  );
  const contactsByName = new Map(
    document.contacts.map(row => [key(row.name), row])
  );
  const locationsById = new Map(
    document.locations.flatMap(row =>
      row.sourceId === null ? [] : ([[row.sourceId, row]] as const)
    )
  );
  const locationsByName = new Map(
    document.locations.map(row => [key(row.name), row])
  );
  const helpersById = new Map(
    document.helpers.flatMap(row =>
      row.sourceId === null ? [] : ([[row.sourceId, row]] as const)
    )
  );
  const helpersByName = new Map(
    document.helpers.map(row => [key(row.name), row])
  );
  const requireContact = (
    sourceId: number | null,
    name: string,
    label: string
  ) => {
    if (sourceId === null && !name) return;
    const byId = sourceId === null ? undefined : contactsById.get(sourceId);
    if (byId && name && key(byId.name) !== key(name))
      throw new Error(
        `${label}: Ansprechpartner-ID und Name widersprechen sich`
      );
    if (byId || contactsByName.has(key(name))) return;
    throw new Error(`${label}: Ansprechpartner-Bezug ist ungültig`);
  };
  const requireLocation = (
    sourceId: number | null,
    name: string,
    label: string
  ) => {
    if (sourceId === null && !name) return;
    const byId = sourceId === null ? undefined : locationsById.get(sourceId);
    if (byId && name && key(byId.name) !== key(name))
      throw new Error(`${label}: Orts-ID und Name widersprechen sich`);
    if (byId || locationsByName.has(key(name))) return;
    throw new Error(`${label}: Ortsbezug ist ungültig`);
  };

  for (const contact of document.contacts) {
    const helper = helpersByName.get(key(contact.name));
    if (
      !helper ||
      !(
        (contact.sourceId !== null &&
          helper.contactSourceId === contact.sourceId) ||
        key(helper.contactName) === key(contact.name)
      )
    )
      throw new Error(
        `Für „${contact.name}“ fehlt der zugeordnete eigene Helfereintrag`
      );
  }
  for (const helper of document.helpers)
    requireContact(
      helper.contactSourceId,
      helper.contactName,
      `Helfer „${helper.name}“`
    );
  for (const shift of document.shifts)
    requireLocation(
      shift.locationSourceId,
      shift.locationName,
      `Einsatzplan „${shift.task}“`
    );
  for (const prep of document.prep)
    requireLocation(
      prep.locationSourceId,
      prep.locationName,
      `Vorbereitung „${prep.task}“`
    );
  for (const row of [
    ...document.prep,
    ...document.post,
    ...document.materials,
    ...document.marketing,
    ...document.approvals,
  ])
    requireContact(
      row.contactSourceId,
      row.contactName,
      `Eintrag „${"task" in row ? row.task : "article" in row ? row.article : "measure" in row ? row.measure : row.request}“`
    );

  const helperShifts = new Map<string, typeof document.shifts>();
  const helperNames = new Map<string, string>();
  const areaContacts = new Map<string, string>();
  const activeDays = new Set(document.metadata.activeDays);
  for (const shift of document.shifts) {
    if (!activeDays.has(shift.day))
      throw new Error(
        `Einsatzplan „${shift.task}“: ${shift.day} ist in den Veranstaltungstagen nicht aktiviert`
      );
    const start = toMinutes(shift.startTime);
    const end = toMinutes(shift.endTime);
    if ((shift.startTime === "") !== (shift.endTime === ""))
      throw new Error(
        `Einsatzplan „${shift.task}“: Beginn und Ende müssen beide leer oder beide gesetzt sein`
      );
    if (shift.startTime !== "" && (start === null || end === null))
      throw new Error(
        `Einsatzplan „${shift.task}“: Uhrzeit muss im Format HH:MM vorliegen`
      );
    if (start !== null && end !== null && end <= start)
      throw new Error(
        `Einsatzplan „${shift.task}“: Das Ende muss nach dem Beginn liegen`
      );
    requireContact(
      shift.areaContactSourceId,
      shift.areaContactName,
      `Bereich „${shift.area}“`
    );
    const areaKey = key(shift.area);
    const contactKey = shift.areaContactSourceId
      ? `id:${shift.areaContactSourceId}`
      : `name:${key(shift.areaContactName)}`;
    if (areaContacts.has(areaKey) && areaContacts.get(areaKey) !== contactKey)
      throw new Error(
        `Einsatzplan: Bereich „${shift.area}“ hat unterschiedliche Ansprechpartner`
      );
    areaContacts.set(areaKey, contactKey);
    const seenSlots = new Set<number>();
    const seenHelpers = new Set<string>();
    for (const slot of shift.slots) {
      if (slot.slot >= shift.needed)
        throw new Error(
          `Einsatzplan „${shift.task}“: Helfer steht außerhalb des Bedarfs`
        );
      if (seenSlots.has(slot.slot))
        throw new Error(
          `Einsatzplan „${shift.task}“: Platz ist doppelt belegt`
        );
      seenSlots.add(slot.slot);
      const helper =
        (slot.helperSourceId !== null
          ? helpersById.get(slot.helperSourceId)
          : undefined) ?? helpersByName.get(key(slot.helperName));
      if (!helper)
        throw new Error(
          `Einsatzplan „${shift.task}“: Helfer „${slot.helperName}“ fehlt`
        );
      if (
        slot.helperSourceId !== null &&
        helpersById.has(slot.helperSourceId) &&
        key(helpersById.get(slot.helperSourceId)?.name) !== key(slot.helperName)
      )
        throw new Error(
          `Einsatzplan „${shift.task}“: Helfer-ID und Name widersprechen sich`
        );
      if (!helperEligibleForShift(helper, shift))
        throw new Error(
          `Einsatzplan „${shift.task}“: Helfer „${helper.name}“ ist für die Schichtzeit am ${shift.day} nicht verfügbar`
        );
      const helperKey = helper.sourceId
        ? `id:${helper.sourceId}`
        : `name:${key(helper.name)}`;
      if (seenHelpers.has(helperKey))
        throw new Error(
          `Einsatzplan „${shift.task}“: Helfer ist doppelt eingetragen`
        );
      seenHelpers.add(helperKey);
      helperNames.set(helperKey, helper.name);
      const list = helperShifts.get(helperKey) ?? [];
      list.push(shift);
      helperShifts.set(helperKey, list);
    }
  }
  for (const [helperKey, assigned] of Array.from(helperShifts.entries())) {
    let overlapWarning = "";
    for (let left = 0; left < assigned.length && !overlapWarning; left++)
      for (let right = left + 1; right < assigned.length; right++)
        if (overlaps(assigned[left] as any, assigned[right] as any)) {
          overlapWarning = `Doppelbelegung: ${helperNames.get(helperKey) ?? helperKey} ist gleichzeitig in „${assigned[left].task}“ und „${assigned[right].task}“ eingeteilt.`;
          break;
        }
    if (
      overlapWarning &&
      document.warnings.length < 1_000 &&
      !document.warnings.includes(overlapWarning)
    )
      document.warnings.push(overlapWarning);
  }
}

const digest = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export function parseProjectFile(base64: string): {
  document: BackupDocument;
  sourceDigest: string;
} {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_PROJECT_BYTES)
    throw new Error("Die Speicherdatei ist leer oder größer als 10 MB");
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Die Speicherdatei ist beschädigt oder kein gültiges JSON");
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 1
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = {
      ...legacy.metadata,
      version: 2,
      activeDays: [...WEEKDAYS],
    };
    legacy.helpers = Array.isArray(legacy.helpers)
      ? legacy.helpers.map((helper: Record<string, unknown>) => ({
          ...helper,
          availMon: helper.availMon ?? "ja",
          availTue: helper.availTue ?? "ja",
          availWed: helper.availWed ?? "ja",
          availThu: helper.availThu ?? "ja",
        }))
      : legacy.helpers;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 2
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = {
      ...legacy.metadata,
      version: PROJECT_VERSION,
      pdfLogoKey: null,
      pdfLogoUrl: null,
      pdfLogoFallback: "none",
    };
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 3
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.helpers = Array.isArray(legacy.helpers)
      ? legacy.helpers.map((helper: Record<string, unknown>) => ({
          ...helper,
          availMonStart: helper.availMonStart ?? "",
          availMonEnd: helper.availMonEnd ?? "",
          availTueStart: helper.availTueStart ?? "",
          availTueEnd: helper.availTueEnd ?? "",
          availWedStart: helper.availWedStart ?? "",
          availWedEnd: helper.availWedEnd ?? "",
          availThuStart: helper.availThuStart ?? "",
          availThuEnd: helper.availThuEnd ?? "",
          availFriStart: helper.availFriStart ?? "",
          availFriEnd: helper.availFriEnd ?? "",
          availSatStart: helper.availSatStart ?? "",
          availSatEnd: helper.availSatEnd ?? "",
          availSunStart: helper.availSunStart ?? "",
          availSunEnd: helper.availSunEnd ?? "",
        }))
      : legacy.helpers;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 4
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.shifts = Array.isArray(legacy.shifts)
      ? legacy.shifts.map((shift: Record<string, unknown>) => ({
          ...shift,
          allowFlexibleAssignment: shift.allowFlexibleAssignment ?? false,
        }))
      : legacy.shifts;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 5
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.shifts = Array.isArray(legacy.shifts)
      ? legacy.shifts.map((shift: Record<string, unknown>) => ({
          ...shift,
          manualOkConfirmed: shift.manualOkConfirmed ?? false,
        }))
      : legacy.shifts;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 6
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.shifts = Array.isArray(legacy.shifts)
      ? legacy.shifts.map((shift: Record<string, unknown>) => ({
          ...shift,
          manualDoubleConflictAccepted:
            shift.manualDoubleConflictAccepted ?? false,
        }))
      : legacy.shifts;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 7
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.locations = Array.isArray(legacy.locations) ? legacy.locations : [];
    legacy.shifts = Array.isArray(legacy.shifts)
      ? legacy.shifts.map((shift: Record<string, unknown>) => ({
          ...shift,
          locationSourceId: shift.locationSourceId ?? null,
          locationName: shift.locationName ?? "",
        }))
      : legacy.shifts;
    legacy.prep = Array.isArray(legacy.prep)
      ? legacy.prep.map((task: Record<string, unknown>) => ({
          ...task,
          locationSourceId: task.locationSourceId ?? null,
          locationName: task.locationName ?? "",
        }))
      : legacy.prep;
    legacy.materials = Array.isArray(legacy.materials)
      ? legacy.materials.map((material: Record<string, unknown>) => ({
          ...material,
          locationSourceId: material.locationSourceId ?? null,
          locationName: material.locationName ?? "",
        }))
      : legacy.materials;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 8
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.materials = Array.isArray(legacy.materials)
      ? legacy.materials.map((material: Record<string, unknown>) => ({
          ...material,
          locationSourceId: material.locationSourceId ?? null,
          locationName: material.locationName ?? "",
        }))
      : legacy.materials;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 9
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.locations = Array.isArray(legacy.locations)
      ? legacy.locations.map((location: Record<string, unknown>) => ({
          ...location,
          logoKey: location.logoKey ?? null,
          logoUrl: location.logoUrl ?? null,
        }))
      : [];
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 10
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.post = Array.isArray(legacy.post)
      ? legacy.post.map((task: Record<string, unknown>) => ({
          ...task,
          category: task.category ?? "",
          dueText: task.dueText ?? "",
          locationSourceId: task.locationSourceId ?? null,
          locationName: task.locationName ?? "",
        }))
      : legacy.post;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 11
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.materials = Array.isArray(legacy.materials)
      ? legacy.materials.map((material: Record<string, unknown>) => {
          const { ordered, ...withoutOrdered } = material;
          return {
            ...withoutOrdered,
            status: normalizeMaterialStatus(material.status ?? ordered),
          };
        })
      : legacy.materials;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 12
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = {
      ...legacy.metadata,
      version: PROJECT_VERSION,
      startDate: legacy.metadata.startDate ?? null,
      endDate: legacy.metadata.endDate ?? null,
    };
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 13
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.cakes = Array.isArray(legacy.cakes)
      ? legacy.cakes.map((cake: Record<string, unknown>) => ({
          ...cake,
          locationSourceId: null,
          locationName: "",
          dropoffDate: "",
          dropoffTime: "",
          legacyDropoffText: cake.dropoffTime ?? "",
          vegan: cake.vegan ?? false,
          glutenFree: cake.glutenFree ?? false,
          lactoseFree: cake.lactoseFree ?? false,
          containsNuts: cake.containsNuts ?? false,
          donationCategory: cake.donationCategory ?? "kuchen",
          meat: cake.meat ?? false,
        }))
      : legacy.cakes;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 14
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.cakes = Array.isArray(legacy.cakes)
      ? legacy.cakes.map((cake: Record<string, unknown>) => ({
          ...cake,
          locationSourceId: null,
          locationName: "",
          dropoffDate: "",
          dropoffTime: "",
          legacyDropoffText: cake.dropoffTime ?? "",
          donationCategory: cake.donationCategory ?? "kuchen",
          meat: cake.meat ?? false,
        }))
      : legacy.cakes;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 15
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = { ...legacy.metadata, version: PROJECT_VERSION };
    legacy.cakes = Array.isArray(legacy.cakes)
      ? legacy.cakes.map((cake: Record<string, unknown>) => ({
          ...cake,
          donationCategory: cake.donationCategory ?? "kuchen",
          meat: cake.meat ?? false,
        }))
      : legacy.cakes;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === 16
  ) {
    const legacy = raw as Record<string, any>;
    legacy.metadata = {
      ...legacy.metadata,
      version: PROJECT_VERSION,
      donationTargetKuchen: 0,
      donationTargetSalat: 0,
      donationTargetSnack: 0,
      donationTargetSonstiges: 0,
    };
  }
  if (
    raw &&
    typeof raw === "object" &&
    "metadata" in raw &&
    raw.metadata &&
    typeof raw.metadata === "object" &&
    "version" in raw.metadata &&
    raw.metadata.version === PROJECT_VERSION
  ) {
    const document = raw as Record<string, any>;
    if (document.metadata) {
      document.metadata.startDate = document.metadata.startDate ?? null;
      document.metadata.endDate = document.metadata.endDate ?? null;
      document.metadata.donationTargetKuchen =
        document.metadata.donationTargetKuchen ?? 0;
      document.metadata.donationTargetSalat =
        document.metadata.donationTargetSalat ?? 0;
      document.metadata.donationTargetSnack =
        document.metadata.donationTargetSnack ?? 0;
      document.metadata.donationTargetSonstiges =
        document.metadata.donationTargetSonstiges ?? 0;
    }
    document.locations = Array.isArray(document.locations)
      ? document.locations.map((location: Record<string, unknown>) => ({
          ...location,
          logoKey: location.logoKey ?? null,
          logoUrl: location.logoUrl ?? null,
        }))
      : [];
    document.shifts = Array.isArray(document.shifts)
      ? document.shifts.map((shift: Record<string, unknown>) => ({
          ...shift,
          locationSourceId: shift.locationSourceId ?? null,
          locationName: shift.locationName ?? "",
        }))
      : document.shifts;
    document.prep = Array.isArray(document.prep)
      ? document.prep.map((task: Record<string, unknown>) => ({
          ...task,
          locationSourceId: task.locationSourceId ?? null,
          locationName: task.locationName ?? "",
        }))
      : document.prep;
    document.post = Array.isArray(document.post)
      ? document.post.map((task: Record<string, unknown>) => ({
          ...task,
          category: task.category ?? "",
          dueText: task.dueText ?? "",
          locationSourceId: task.locationSourceId ?? null,
          locationName: task.locationName ?? "",
        }))
      : document.post;
    document.materials = Array.isArray(document.materials)
      ? document.materials.map((material: Record<string, unknown>) => {
          const { ordered, ...withoutOrdered } = material;
          return {
            ...withoutOrdered,
            locationSourceId: material.locationSourceId ?? null,
            locationName: material.locationName ?? "",
            status: normalizeMaterialStatus(material.status ?? ordered),
          };
        })
      : document.materials;
    document.cakes = Array.isArray(document.cakes)
      ? document.cakes.map((cake: Record<string, unknown>) => ({
          ...cake,
          locationSourceId: cake.locationSourceId ?? null,
          locationName: cake.locationName ?? "",
          dropoffDate: cake.dropoffDate ?? "",
          dropoffTime: cake.dropoffTime ?? "",
          legacyDropoffText: cake.legacyDropoffText ?? "",
          vegan: cake.vegan ?? false,
          glutenFree: cake.glutenFree ?? false,
          lactoseFree: cake.lactoseFree ?? false,
          containsNuts: cake.containsNuts ?? false,
          donationCategory: cake.donationCategory ?? "kuchen",
          meat: cake.meat ?? false,
        }))
      : document.cakes;
  }
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      `Die Speicherdatei ist ungültig: ${parsed.error.issues[0]?.path.join(".") || "Struktur"}`
    );
  const document = parsed.data as BackupDocument;
  document.metadata.activeDays = eventWeekdays(document.metadata.activeDays);
  repairImportedDocumentRelations(document);
  validateRelations(document);
  return { document, sourceDigest: digest(bytes) };
}

export async function exportProjectFile() {
  const document = await createCurrentProjectDocument();
  document.metadata.format = PROJECT_FORMAT;
  document.metadata.version = PROJECT_VERSION;
  const buffer = Buffer.from(JSON.stringify(document), "utf8");
  if (buffer.length > MAX_PROJECT_BYTES)
    throw new Error("Der Projektstand ist größer als 10 MB");
  return {
    buffer,
    exportedAt: document.metadata.exportedAt,
    eventName: document.metadata.eventName,
  };
}

export async function previewProjectFile(base64: string) {
  const parsed = parseProjectFile(base64);
  return previewProjectDocument(parsed.document, parsed.sourceDigest);
}

export async function loadProjectFile(
  base64: string,
  filename: string,
  expectedCurrentDigest: string,
  actor: AuditActor
) {
  const parsed = parseProjectFile(base64);
  return restoreProjectDocument(
    parsed.document,
    parsed.sourceDigest,
    filename,
    expectedCurrentDigest,
    actor
  );
}
