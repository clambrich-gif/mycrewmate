import { and, eq, like, lt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import {
  approvals,
  assignments,
  cakes,
  contacts,
  events,
  finances,
  gpxTracks,
  helpers,
  locations,
  marketing,
  materials,
  prepTasks,
  postTasks,
  shifts,
  tenants,
  userTenantMemberships,
  users,
} from "../drizzle/schema";
import type { ProductPackageId } from "../shared/product-packages";
import * as db from "./db";
import { hashPassword } from "./password-auth";
import { storageDelete, storagePut } from "./storage";

export const PUBLIC_DEMO_OPEN_ID_PREFIX = "tenant-admin:demo-session-";
export const PUBLIC_DEMO_TENANT_ID_PREFIX = "mycrewmate-demo-";
export const PUBLIC_DEMO_SESSION_MS = 30 * 60 * 1000;
export const PUBLIC_DEMO_MAX_AGE_MS = 35 * 60 * 1000;

export type PublicDemoPackage = Extract<
  ProductPackageId,
  "event_pass" | "light" | "pro"
>;

type DemoDefinition = {
  packageId: PublicDemoPackage;
  clubName: string;
  eventName: string;
  eventDateRange: { start: string; end: string };
  activeDays: Array<"Freitag" | "Samstag" | "Sonntag">;
  helperCount: number;
  plannerCount: number;
  planName: string;
};

const DEMO_DEFINITIONS: Record<PublicDemoPackage, DemoDefinition> = {
  event_pass: {
    packageId: "event_pass",
    clubName: "Vereinsdemo · Event Pass",
    eventName: "Sommerabend am Sportplatz 2027",
    eventDateRange: { start: "2027-06-19", end: "2027-06-19" },
    activeDays: ["Samstag"],
    helperCount: 30,
    plannerCount: 1,
    planName: "Event Pass · Musterdemo",
  },
  light: {
    packageId: "light",
    clubName: "Vereinsdemo · Light",
    eventName: "Dorf- und Familienfest 2027",
    eventDateRange: { start: "2027-06-18", end: "2027-06-20" },
    activeDays: ["Freitag", "Samstag", "Sonntag"],
    helperCount: 50,
    plannerCount: 5,
    planName: "Light · Musterdemo",
  },
  pro: {
    packageId: "pro",
    clubName: "Vereinsdemo · Pro",
    eventName: "EifelRide Radsportfestival 2027",
    eventDateRange: { start: "2027-06-11", end: "2027-06-13" },
    activeDays: ["Freitag", "Samstag", "Sonntag"],
    helperCount: 150,
    plannerCount: 10,
    planName: "Pro · Musterdemo",
  },
};

const FIRST_NAMES = [
  "Anna",
  "Ben",
  "Clara",
  "David",
  "Elena",
  "Felix",
  "Greta",
  "Henrik",
  "Ida",
  "Jonas",
  "Klara",
  "Lukas",
  "Mara",
  "Nils",
  "Olivia",
  "Paul",
  "Rike",
  "Simon",
  "Tanja",
  "Uwe",
];

const LAST_NAMES = [
  "Berg",
  "Fischer",
  "Gerber",
  "Hoffmann",
  "Klein",
  "Lenz",
  "Meier",
  "Neumann",
  "Otto",
  "Schneider",
];

const CONTACTS = [
  ["Mara König", "Gesamtkoordination"],
  ["Jonas Becker", "Helferkoordination"],
  ["Svenja Roth", "Strecke & Sicherheit"],
  ["Tim Scholz", "Catering & Material"],
  ["Lea Winter", "Anmeldung & Kommunikation"],
  ["Ralf Krüger", "Start/Ziel"],
  ["Eva Peters", "Kinderprogramm"],
  ["Moritz Baum", "Sponsoring"],
  ["Nina Frank", "Expo & Rahmenprogramm"],
  ["Daniel Wolf", "Technik & Bühne"],
] as const;

function isPublicDemoTenantId(value: string) {
  return value.startsWith(PUBLIC_DEMO_TENANT_ID_PREFIX);
}

function hashDemoToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isPublicDemoOpenId(value: string | null | undefined) {
  return Boolean(value?.startsWith(PUBLIC_DEMO_OPEN_ID_PREFIX));
}

function demoHelperName(index: number) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function gpxDocument(name: string, points: Array<[number, number]>) {
  const trackPoints = points
    .map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MyCrewMate Vereinsdemo" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${name}</name><trkseg>
${trackPoints}
  </trkseg></trk>
</gpx>`;
}

async function createDemoGpxFiles(tenantId: string) {
  const routeBase = `public-demo/${tenantId}/strecken`;
  return Promise.all([
    storagePut(
      `${routeBase}/gravel-runde.gpx`,
      gpxDocument("Gravel-Runde 68 km", [
        [50.3296, 7.2232],
        [50.3421, 7.2463],
        [50.3574, 7.2824],
        [50.3467, 7.3039],
        [50.3234, 7.2875],
        [50.3142, 7.2561],
        [50.3296, 7.2232],
      ]),
      "application/gpx+xml"
    ),
    storagePut(
      `${routeBase}/marathon-runde.gpx`,
      gpxDocument("Marathon-Runde 121 km", [
        [50.3296, 7.2232],
        [50.3672, 7.2286],
        [50.3901, 7.2718],
        [50.3798, 7.3229],
        [50.3417, 7.3398],
        [50.3113, 7.3031],
        [50.3296, 7.2232],
      ]),
      "application/gpx+xml"
    ),
    storagePut(
      `${routeBase}/familien-tour.gpx`,
      gpxDocument("Familien-Tour 18 km", [
        [50.3296, 7.2232],
        [50.3364, 7.2373],
        [50.3413, 7.2507],
        [50.3339, 7.2595],
        [50.3245, 7.2447],
        [50.3296, 7.2232],
      ]),
      "application/gpx+xml"
    ),
  ]);
}

async function seedPublicDemoData(input: {
  tenantId: string;
  eventId: number;
  definition: DemoDefinition;
}) {
  const database = await db.getDb();
  if (!database) throw new Error("Die Datenbank ist für die Vereinsdemo nicht verfügbar.");

  const gpxFiles =
    input.definition.packageId === "pro"
      ? await createDemoGpxFiles(input.tenantId)
      : [];

  try {
    await database.transaction(async tx => {
      const year = 2027;
      const locationSeed = [
        ["Festplatz · Start & Ziel", 50.3296, 7.2232],
        ["Sporthalle · Anmeldung", 50.3319, 7.2188],
        ["Bürgerhaus · Helfertreff", 50.3251, 7.2281],
        ["Waldparkplatz Nord · Verpflegung", 50.3574, 7.2824],
        ["Expo-Fläche · Partnerstände", 50.3272, 7.2201],
      ] as const;

      await tx
        .update(events)
        .set({
          startDate: input.definition.eventDateRange.start,
          endDate: input.definition.eventDateRange.end,
          donationTargetKuchen: 24,
          donationTargetSalat: 16,
          donationTargetSnack: 40,
          donationTargetSonstiges: 18,
        })
        .where(eq(events.id, input.eventId));

      await tx.insert(contacts).values(
        CONTACTS.slice(0, input.definition.plannerCount).map(([name, role], index) => ({
          eventId: input.eventId,
          year,
          name,
          email: `demo-${index + 1}@beispiel.invalid`,
          phone: `0265${index} 000${index + 1}`,
          note: `${role} · fiktiver Ansprechpartner der Vereinsdemo`,
          sortOrder: index,
        }))
      );

      await tx.insert(locations).values(
        locationSeed.map(([name, latitude, longitude], index) => ({
          eventId: input.eventId,
          year,
          name,
          latitude,
          longitude,
          sortOrder: index,
        }))
      );

      const locationRows = await tx
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(eq(locations.eventId, input.eventId));
      const locationId = (name: string) =>
        locationRows.find(location => location.name === name)?.id ?? null;

      const contactRows = await tx
        .select({ id: contacts.id, name: contacts.name })
        .from(contacts)
        .where(eq(contacts.eventId, input.eventId));
      const contactId = (name: string) =>
        contactRows.find(contact => contact.name === name)?.id ?? null;

      await tx.insert(helpers).values(
        Array.from({ length: input.definition.helperCount }, (_, index) => ({
          eventId: input.eventId,
          year,
          name: demoHelperName(index),
          email: `helfer-${index + 1}@beispiel.invalid`,
          phone: `0176 100${String(index + 1).padStart(3, "0")}`,
          willHelp: "ja" as const,
          availMon: "nein" as const,
          availTue: "nein" as const,
          availWed: "vielleicht" as const,
          availThu: "vielleicht" as const,
          availFri: "ja" as const,
          availSat: "ja" as const,
          availSun: "ja" as const,
          availFriStart: "08:00",
          availFriEnd: "22:00",
          availSatStart: "06:00",
          availSatEnd: "23:00",
          availSunStart: "06:00",
          availSunEnd: "20:00",
          confirmed: index % 7 === 0 ? ("nein" as const) : ("ja" as const),
          companion: index % 17 === 0 ? "+ Begleitperson" : null,
          note: index % 23 === 0 ? "Fiktiver Demo-Eintrag" : null,
        }))
      );

      const helperRows = await tx
        .select({ id: helpers.id, name: helpers.name })
        .from(helpers)
        .where(eq(helpers.eventId, input.eventId));
      const helperId = (index: number) => helperRows[index]?.id ?? null;

      const shiftSeed = [
        ["Freitag", "Aufbau", "Start/Ziel aufbauen", "08:00", "12:00", 6, "Bürgerhaus · Helfertreff"],
        ["Freitag", "Expo", "Aussteller einweisen", "13:00", "18:00", 4, "Expo-Fläche · Partnerstände"],
        ["Freitag", "Catering", "Helferabend vorbereiten", "17:00", "21:00", 4, "Sporthalle · Anmeldung"],
        ["Samstag", "Anmeldung", "Startnummern & Nachmeldungen", "06:30", "11:30", 7, "Sporthalle · Anmeldung"],
        ["Samstag", "Strecke", "Streckenposten Nord", "07:00", "13:00", 8, "Waldparkplatz Nord · Verpflegung"],
        ["Samstag", "Start/Ziel", "Startblock & Zielkanal", "07:30", "14:30", 7, "Festplatz · Start & Ziel"],
        ["Samstag", "Catering", "Verpflegung Start/Ziel", "08:00", "16:00", 6, "Festplatz · Start & Ziel"],
        ["Samstag", "Kinderprogramm", "Kinderparcours begleiten", "10:00", "16:00", 4, "Festplatz · Start & Ziel"],
        ["Sonntag", "Strecke", "Familien-Tour absichern", "08:30", "13:30", 5, "Waldparkplatz Nord · Verpflegung"],
        ["Sonntag", "Abbau", "Material & Fläche zurückbauen", "14:00", "18:00", 8, "Bürgerhaus · Helfertreff"],
      ] as const;
      const activeShiftSeed = shiftSeed.filter(([day]) =>
        input.definition.activeDays.includes(day as "Freitag" | "Samstag" | "Sonntag")
      );

      await tx.insert(shifts).values(
        activeShiftSeed.map(([day, area, task, startTime, endTime, needed, locationName], index) => ({
          eventId: input.eventId,
          year,
          day,
          area,
          task,
          startTime,
          endTime,
          needed,
          locationId: locationId(locationName),
          note: index % 3 === 0 ? "Bitte 15 Minuten vor Beginn am Treffpunkt sein." : null,
          sortOrder: index,
        }))
      );

      const shiftRows = await tx
        .select({ id: shifts.id })
        .from(shifts)
        .where(eq(shifts.eventId, input.eventId));
      const assignmentRows = shiftRows.flatMap((shift, shiftIndex) =>
        Array.from({ length: Math.max(1, Math.min(3, activeShiftSeed[shiftIndex]?.[5] ?? 1) - 1) }, (_, slot) => ({
          shiftId: shift.id,
          helperId: helperId(shiftIndex * 3 + slot),
          eventId: input.eventId,
          year,
          slot,
        }))
      ).filter((row): row is { shiftId: number; helperId: number; eventId: number; year: number; slot: number } => Boolean(row.helperId));
      if (assignmentRows.length) await tx.insert(assignments).values(assignmentRows);

      await tx.insert(prepTasks).values([
        {
          eventId: input.eventId, year, task: "Sicherheitsbesprechung mit Streckenteam", category: "Sicherheit", dueText: "bis 03. Juni", contactId: contactId("Svenja Roth"), helperId: helperId(2), status: "erledigt", note: "Fiktiver Demostatus", sortOrder: 1,
        },
        {
          eventId: input.eventId, year, task: "Helferplan auf offene Stellen prüfen", category: "Helfer", dueText: "bis 07. Juni", contactId: contactId("Jonas Becker"), helperId: helperId(4), status: "inArbeit", note: "6 Plätze sind noch offen", sortOrder: 2,
        },
        {
          eventId: input.eventId, year, task: "Beschilderung und Absperrungen bereitstellen", category: "Material", dueText: "bis 09. Juni", contactId: contactId("Tim Scholz"), helperId: helperId(8), status: "offen", note: "Abholung beim Bauhof abstimmen", sortOrder: 3,
        },
        {
          eventId: input.eventId, year, task: "Info an Presse und Partner versenden", category: "Kommunikation", dueText: "bis 05. Juni", contactId: contactId("Lea Winter"), helperId: helperId(12), status: "erledigt", note: "Pressemappe liegt bereit", sortOrder: 4,
        },
      ]);

      await tx.insert(postTasks).values([
        { eventId: input.eventId, year, task: "Geliehene Absperrungen zurückgeben", category: "Material", dueText: "Montag nach dem Event", contactId: contactId("Tim Scholz"), status: "offen", note: "Fiktive Nachbereitungsaufgabe", sortOrder: 1 },
        { eventId: input.eventId, year, task: "Helferinnen und Helfern danken", category: "Kommunikation", dueText: "bis Mittwoch", contactId: contactId("Lea Winter"), status: "offen", note: "Vorlage im Chat vorbereiten", sortOrder: 2 },
      ]);

      await tx.insert(materials).values([
        { eventId: input.eventId, year, article: "Absperrgitter", category: "Sicherheit", quantity: "42", unit: "Stück", locationId: locationId("Festplatz · Start & Ziel"), contactId: contactId("Tim Scholz"), status: "bestellt", note: "Anlieferung Freitag 08:00", sortOrder: 1 },
        { eventId: input.eventId, year, article: "Warnwesten", category: "Helfer", quantity: "85", unit: "Stück", locationId: locationId("Bürgerhaus · Helfertreff"), contactId: contactId("Jonas Becker"), status: "geliefert", note: "Größen sortieren", sortOrder: 2 },
        { eventId: input.eventId, year, article: "Pavillons", category: "Infrastruktur", quantity: "8", unit: "Stück", locationId: locationId("Expo-Fläche · Partnerstände"), contactId: contactId("Tim Scholz"), status: "offen", note: "2 Stück vom Nachbarverein anfragen", sortOrder: 3 },
        { eventId: input.eventId, year, article: "Streckenpfeile", category: "Strecke", quantity: "260", unit: "Stück", locationId: locationId("Waldparkplatz Nord · Verpflegung"), contactId: contactId("Svenja Roth"), status: "geliefert", note: "Farbe nach Streckenlänge sortiert", sortOrder: 4 },
      ]);

      await tx.insert(marketing).values([
        { eventId: input.eventId, year, measure: "Strecken-Teaser veröffentlichen", channel: "Instagram & Facebook", contactId: contactId("Lea Winter"), status: "erledigt", note: "Fiktive Musterdaten", sortOrder: 1 },
        { eventId: input.eventId, year, measure: "Sponsoren vorstellen", channel: "Website & Newsletter", contactId: contactId("Moritz Baum"), status: "inArbeit", note: "Logos final abstimmen", sortOrder: 2 },
      ]);

      await tx.insert(approvals).values([
        { eventId: input.eventId, year, request: "Verkehrsrechtliche Anordnung", contactId: contactId("Svenja Roth"), status: "genehmigt", note: "Fiktive Genehmigung", sortOrder: 1 },
        { eventId: input.eventId, year, request: "Sanitätsdienst buchen", contactId: contactId("Mara König"), status: "beantragt", note: "Rückmeldung bis Ende Mai", sortOrder: 2 },
      ]);

      await tx.insert(cakes).values([
        { eventId: input.eventId, year, donor: "Familie Berg", cake: "Apfelkuchen", donationCategory: "kuchen", locationId: locationId("Sporthalle · Anmeldung"), dropoffDate: input.definition.eventDateRange.start, dropoffTime: "08:00", legacyDropoffText: "08:00 Uhr", vegetarian: true, note: "Fiktive Spende", sortOrder: 1 },
        { eventId: input.eventId, year, donor: "Team Café", cake: "Couscous-Salat", donationCategory: "salat", locationId: locationId("Sporthalle · Anmeldung"), dropoffDate: input.definition.eventDateRange.start, dropoffTime: "09:00", legacyDropoffText: "09:00 Uhr", vegetarian: true, vegan: true, note: "Fiktive Spende", sortOrder: 2 },
      ]);

      await tx.insert(finances).values([
        { eventId: input.eventId, year, category: "Startgelder", income: 124500, expense: 0, note: "Fiktive Demo-Zahl", sortOrder: 1 },
        { eventId: input.eventId, year, category: "Sponsoring", income: 45000, expense: 0, note: "Fiktive Demo-Zahl", sortOrder: 2 },
        { eventId: input.eventId, year, category: "Catering-Einkauf", income: 0, expense: 28600, note: "Fiktive Demo-Zahl", sortOrder: 3 },
        { eventId: input.eventId, year, category: "Absperrung & Technik", income: 0, expense: 39400, note: "Fiktive Demo-Zahl", sortOrder: 4 },
      ]);

      if (gpxFiles.length) {
        await tx.insert(gpxTracks).values([
          { eventId: input.eventId, year, name: "Gravel-Runde · 68 km", fileKey: gpxFiles[0].key, fileUrl: gpxFiles[0].url, color: "#ea580c" },
          { eventId: input.eventId, year, name: "Marathon-Runde · 121 km", fileKey: gpxFiles[1].key, fileUrl: gpxFiles[1].url, color: "#2563eb" },
          { eventId: input.eventId, year, name: "Familien-Tour · 18 km", fileKey: gpxFiles[2].key, fileUrl: gpxFiles[2].url, color: "#16a34a" },
        ]);
      }
    });
  } catch (error) {
    await Promise.all(gpxFiles.map(file => storageDelete(file.key).catch(() => false)));
    throw error;
  }
}

/** Erstellt einen vollständig getrennten, fiktiven Mandanten für eine öffentliche Demo. */
export async function createPublicDemoSession(packageId: PublicDemoPackage) {
  await cleanupExpiredPublicDemoTenants();

  const definition = DEMO_DEFINITIONS[packageId];
  const suffix = randomBytes(9).toString("base64url").toLowerCase();
  const email = `demo-session-${suffix}@beispiel.invalid`;
  const openId = `tenant-admin:${email}`;
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));

  const created = await db.createTenantForPlatformAdmin({
    name: `MyCrewMate Demo · ${definition.packageId.toUpperCase()} · ${suffix}`,
    legalName: `${definition.clubName} ${suffix}`,
    contactEmail: "vereinsdemo@mycrewmate.de",
    supportEmail: "support@mycrewmate.de",
    status: "sample",
    planName: definition.planName,
    packageId,
    packageStatus: "test",
    packageInternalNote: "Automatisch angelegte, temporäre öffentliche Vereinsdemo",
    initialEventName: definition.eventName,
    initialEventYear: 2027,
    activeDays: definition.activeDays,
    initialAdmin: {
      name: "Demo-Planung",
      email,
      passwordHash,
    },
  });

  try {
    const user = await db.getUserByOpenId(openId);
    if (!user) throw new Error("Der temporäre Demozugang konnte nicht angelegt werden.");
    await db.completeTenantAdminInitialPasswordChange({
      userId: user.id,
      passwordHash,
    });
    await db.completeTenantAdminOnboarding(user.id);
    // Die technische Demoidentität ist keine reale Vereinsvertretung. Damit
    // Testende nicht eine rechtlich bedeutungslose Annahme bestätigen müssen,
    // erhält ausschließlich der temporäre Mustermandant einen fiktiven Nachweis.
    await db.acceptCurrentTenantContractDocuments({
      tenantId: created.tenantId,
      acceptedByUserId: user.id,
    });
    await seedPublicDemoData({
      tenantId: created.tenantId,
      eventId: created.eventId,
      definition,
    });

    const handoffToken = randomBytes(24).toString("base64url");
    await db.createPlatformTenantHandoff({
      tenantId: created.tenantId,
      createdByOpenId: openId,
      tokenHash: hashDemoToken(handoffToken),
      expiresInSeconds: 5 * 60,
    });

    return {
      handoffToken,
      tenantId: created.tenantId,
      eventId: created.eventId,
      year: 2027,
      packageId,
    } as const;
  } catch (error) {
    await deletePublicDemoTenant(created.tenantId).catch(() => undefined);
    throw error;
  }
}

/** Entfernt einen temporären Demomandanten mitsamt seinen fiktiven Planungsdaten. */
export async function deletePublicDemoTenant(tenantId: string) {
  if (!isPublicDemoTenantId(tenantId)) return { removed: false } as const;
  const database = await db.getDb();
  if (!database) return { removed: false } as const;

  const tracks = await database
    .select({ fileKey: gpxTracks.fileKey })
    .from(gpxTracks)
    .innerJoin(events, eq(events.id, gpxTracks.eventId))
    .where(eq(events.tenantId, tenantId));

  try {
    await db.deleteInternalTestTenantForPlatformAdmin(tenantId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("wurde nicht gefunden")) {
      return { removed: false } as const;
    }
    throw error;
  }

  await Promise.all(tracks.map(track => storageDelete(track.fileKey).catch(() => false)));
  return { removed: true } as const;
}

/** Beendet eine Demo nur für deren eigene kurzlebige technische Sitzungsidentität. */
export async function endPublicDemoForOpenId(openId: string) {
  if (!isPublicDemoOpenId(openId)) return { removed: false } as const;
  const database = await db.getDb();
  if (!database) return { removed: false } as const;

  const [membership] = await database
    .select({ tenantId: userTenantMemberships.tenantId })
    .from(users)
    .innerJoin(userTenantMemberships, eq(userTenantMemberships.userId, users.id))
    .where(eq(users.openId, openId))
    .limit(1);
  if (!membership || !isPublicDemoTenantId(membership.tenantId)) {
    return { removed: false } as const;
  }
  return deletePublicDemoTenant(membership.tenantId);
}

/** Prüft den Einmal-Handoff und liefert ausschließlich den gebundenen Demokontext. */
export async function getPublicDemoLoginDetails(input: {
  tenantId: string;
  openId: string;
}) {
  if (!isPublicDemoTenantId(input.tenantId) || !isPublicDemoOpenId(input.openId)) {
    return null;
  }
  const user = await db.getUserByOpenId(input.openId);
  if (!user) return null;
  const membership = await db.resolveTenantForUser({
    userId: user.id,
    userOpenId: user.openId,
    allowPilotFallback: false,
  });
  if (!membership || membership.tenantId !== input.tenantId) return null;
  const credentials = await db.getTenantAdminCredentialsByUserId(user.id);
  if (!credentials || credentials.status !== "active") return null;
  const database = await db.getDb();
  if (!database) return null;
  const [event] = await database
    .select({ id: events.id, year: events.year })
    .from(events)
    .where(eq(events.tenantId, input.tenantId))
    .limit(1);
  if (!event) return null;
  const entitlement = await db.getTenantProductEntitlement(input.tenantId);
  return {
    user,
    sessionVersion: credentials.sessionVersion,
    eventId: event.id,
    year: event.year,
    packageId: entitlement.packageId,
  } as const;
}

/** Löscht abgelaufene Demos als Fallback, falls ein Browser ohne pagehide endet. */
export async function cleanupExpiredPublicDemoTenants() {
  const database = await db.getDb();
  if (!database) return { removed: 0 } as const;
  const cutoff = new Date(Date.now() - PUBLIC_DEMO_MAX_AGE_MS);
  const stale = await database
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        like(tenants.id, `${PUBLIC_DEMO_TENANT_ID_PREFIX}%`),
        lt(tenants.createdAt, cutoff)
      )
    );

  let removed = 0;
  for (const tenant of stale) {
    const result = await deletePublicDemoTenant(tenant.id);
    if (result.removed) removed += 1;
  }
  return { removed } as const;
}
