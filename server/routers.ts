import { COOKIE_NAME } from "@shared/const";
import {
  eventWeekdays,
  helperEligibleForShift,
  helperAvailableForShift,
  isHelperWithoutFirstContact,
  WEEKDAYS,
} from "@shared/weekdays";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  protectedProcedure as baseProtectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { ShiftUpdateValidationError } from "./shift-update-validation";
import {
  evaluateShifts,
  helperActiveOnDay,
  toMinutes,
  type Day,
} from "./logic";
import {
  clearBackupRestoreLogs,
  exportProjectExcel,
  getBackupRestoreLog,
  listBackupRestoreLogs,
  withExcelOperationLimit,
} from "./excel-backup";
import {
  exportProjectFile,
  loadProjectFile,
  previewProjectFile,
} from "./project-file";
import {
  createPreviewBinding,
  uploadedFileDigest,
  verifyPreviewBinding,
} from "./import-preview-binding";
import {
  applyModuleExcelImport,
  MODULE_IMPORT_AREAS,
  previewModuleExcelImport,
} from "./module-excel-import";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import {
  ADMIN_PASSWORD_OPEN_ID,
  clearPasswordLoginFailures,
  clearPlanningTeamFailures,
  getClientKey,
  getPlanningTeamRateLimitStatus,
  hashPassword,
  isPasswordLoginBlocked,
  PASSWORD_SESSION_MS,
  PLANNING_TEAM_MAX_ATTEMPTS,
  recordFailedPasswordLogin,
  recordFailedPlanningTeamLogin,
  SHARED_PASSWORD_OPEN_ID,
  verifyPassword,
  verifyRecoveryKey,
} from "./password-auth";
import {
  createAllHelperTaskZip,
  createBlankPlanPdf,
  createDonationOverviewPdf,
  createHelperTaskPdf,
  createMaterialPacklistPdf,
  createPlanPdf,
  createPostTaskOverviewPdf,
  createPrepTaskOverviewPdf,
  DEFAULT_PDF_SETTINGS,
} from "./pdf";
import { publicAppUrl } from "./public-app-url";
import {
  currentEventId,
  currentEventYear,
  requestedPlanningScope,
  withPlanningScope,
} from "./year-context";
import { storageGetSignedUrl, storagePut } from "./storage";
import { locationLogoUrl } from "./location-logo-routes";
import {
  getOnlinePresenceCounts,
  recordSessionPresence,
  removeSessionPresence,
  sessionPresenceKey,
} from "./session-presence";
import { upcomingPreparationDeadlines } from "./dashboard-deadlines";

const GUIDE_PDF_KEY = "Handbuch_RSC_Helferplanung_742fcb04.pdf";
const GUIDE_PDF_FILENAME = "Handbuch_RSC_Helferplanung.pdf";
const GUIDE_PDF_MAX_BYTES = 5_000_000;

async function safelyRecordPresence(
  req: Parameters<typeof recordSessionPresence>[0],
  user: Parameters<typeof recordSessionPresence>[1]
) {
  try {
    await recordSessionPresence(req, user);
  } catch (error) {
    console.warn("[Presence] Aktivitätszeit konnte nicht gespeichert werden", error);
  }
}

async function readResponseBodyLimited(
  response: Response,
  maxBytes: number
): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes < 0 ||
      declaredBytes > maxBytes
    ) {
      throw new Error("Datei überschreitet die Größenbegrenzung");
    }
  }
  if (!response.body) throw new Error("Datei hat keinen Inhalt");

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel("Datei überschreitet die Größenbegrenzung");
        throw new Error("Datei überschreitet die Größenbegrenzung");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

type GpxMapTrack = {
  id: number;
  name: string;
  color: string;
  points: Array<[number, number]>;
};

const LOCATION_LOGO_MAX_BYTES = 3_000_000;
const locationLogoMimeType = z.enum([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
]);
type LocationLogoMimeType = z.infer<typeof locationLogoMimeType>;

function locationLogoExtension(mimeType: LocationLogoMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "svg";
}

function decodeLocationLogoBase64(base64: string) {
  const compact = base64.replace(/\s/g, "");
  if (
    !compact ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)
  )
    return null;
  const buffer = Buffer.from(compact, "base64");
  return buffer.toString("base64") === compact ? buffer : null;
}

function isValidLocationLogo(buffer: Buffer, mimeType: LocationLogoMimeType) {
  if (mimeType === "image/png")
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (mimeType === "image/jpeg")
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  const svg = buffer.toString("utf8").trim();
  return (
    /^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg) &&
    !/<script\b|\son\w+\s*=|<foreignObject\b/i.test(svg)
  );
}

function parseGpxMapPoints(xml: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const pointTags = Array.from(xml.matchAll(/<(?:trkpt|rtept)\b([^>]*)>/gi));
  for (const match of pointTags) {
    const attributes = match[1];
    const latitude = Number(attributes.match(/\blat\s*=\s*["']([^"']+)["']/i)?.[1]);
    const longitude = Number(attributes.match(/\blon\s*=\s*["']([^"']+)["']/i)?.[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      points.push([latitude, longitude]);
    }
  }
  if (points.length < 2) {
    throw new Error("GPX-Datei enthält keine lesbare Streckenlinie");
  }

  // Große Original-GPX-Dateien werden für die Browserkarte gleichmäßig
  // ausgedünnt. Start- und Endpunkt bleiben immer erhalten.
  const maxPoints = 5_000;
  if (points.length <= maxPoints) return points;
  const step = Math.ceil((points.length - 1) / (maxPoints - 1));
  const reduced = points.filter((_, index) => index % step === 0);
  if (reduced[reduced.length - 1] !== points[points.length - 1]) {
    reduced.push(points[points.length - 1]);
  }
  return reduced;
}

async function loadGpxMapTrack(track: {
  id: number;
  name: string;
  fileKey: string;
  color: string;
}): Promise<GpxMapTrack> {
  const signedUrl = await storageGetSignedUrl(track.fileKey);
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`GPX-Datei konnte nicht geladen werden (${response.status})`);
  }
  const xml = (await readResponseBodyLimited(response, 6_000_000)).toString("utf8");
  return {
    id: track.id,
    name: track.name,
    color: track.color,
    points: parseGpxMapPoints(xml),
  };
}

const activeSessionProcedure = baseProtectedProcedure.use(
  async ({ ctx, next }) => {
    await safelyRecordPresence(ctx.req, ctx.user);
    return next();
  }
);

// Reine Hintergrundabfragen (insbesondere notes.list) dürfen keine Präsenz
// verlängern. Sonst würden inaktive Browsertabs durch 5-Sekunden-Polling
// dauerhaft als "online" erscheinen.
const scopedReadProcedure = baseProtectedProcedure
  .use(({ ctx, next }) =>
    withPlanningScope(requestedPlanningScope(ctx.req), () => next())
  )
  .use(async ({ next }) => {
    if (!(await db.getEvent())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Die gewählte Veranstaltung gehört nicht zum gewählten Veranstaltungsjahr",
      });
    }
    return next();
  });

const accountAdminProcedure = activeSessionProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

const scopedProtectedProcedure = activeSessionProcedure.use(({ ctx, next }) =>
  withPlanningScope(requestedPlanningScope(ctx.req), () => next())
);

const protectedProcedure = scopedProtectedProcedure.use(
  async ({ next, type }) => {
    if (!(await db.getEvent())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Die gewählte Veranstaltung gehört nicht zum gewählten Veranstaltungsjahr",
      });
    }
    if (type === "mutation") {
      return db.withPlanningWriteLock(() => next());
    }
    return next();
  }
);

const scopeAdminAuthProcedure = scopedProtectedProcedure.use(
  ({ ctx, next }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return next({ ctx });
  }
);

const scopeAdminProcedure = scopeAdminAuthProcedure.use(
  async ({ next, type }) => {
    if (type === "mutation") {
      return db.withPlanningWriteLock(() => next());
    }
    return next();
  }
);

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

const yn = z.enum(["ja", "nein"]);
const ynv = z.enum(["ja", "nein", "vielleicht"]);
const dayEnum = z.enum(WEEKDAYS);
const activeDaysInput = z
  .array(dayEnum)
  .min(1, "Mindestens ein Veranstaltungstag muss ausgewählt sein")
  .max(WEEKDAYS.length)
  .refine(days => new Set(days).size === days.length, {
    message: "Veranstaltungstage dürfen nicht doppelt ausgewählt werden",
  });
const statusTask = z.enum(["offen", "inArbeit", "erledigt"]);
const statusPrep = z.enum(["offen", "inArbeit", "erledigt", "abgelehnt"]);
const materialStatus = z.enum(["offen", "bestellt", "geliefert"]);
const prepStatusWording = z.enum(["aufgabe", "genehmigung"]);
const passwordInput = z.string().min(10).max(200);
const eventYearInput = z.number().int().min(2020).max(2100);
const safeExportName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Veranstaltung";
const resetAreaInput = z.enum([
  "contacts",
  "helpers",
  "shifts",
  "prep",
  "post",
  "materials",
  "marketing",
  "approvals",
  "cakes",
  "finances",
  "all",
]);
const pdfSettingsInput = z.object({
  eventName: z.string().trim().min(1).max(200),
  eventYear: z.string().trim().min(1).max(16),
  helperPdfTitle: z.string().trim().min(1).max(200),
  blankPlanTitle: z.string().trim().min(1).max(200),
  contactLabel: z.string().trim().min(1).max(120),
  footerText: z.string().trim().max(300),
  whatsAppMessageTemplate: z.string().trim().min(1).max(4_000),
  extraColumns: z.array(z.string().trim().min(1).max(50)).max(5),
  blankRowsPerShift: z.number().int().min(0).max(20),
});
const planPdfInput = z.object({
  mode: z.enum(["blank", "filled"]),
  days: z.array(dayEnum).max(WEEKDAYS.length).optional(),
  areas: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  statuses: z
    .array(z.enum(["OFFEN", "KNAPP", "OK"]))
    .max(3)
    .optional(),
  contactIds: z.array(z.number().int().positive()).max(500).optional(),
  includeUnassignedContact: z.boolean().optional(),
});
const clockTime = z
  .string()
  .trim()
  .refine(value => value === "" || toMinutes(value) !== null, {
    message: "Uhrzeit muss im Format HH:MM vorliegen",
  });

const availabilityClockTime = z
  .string()
  .trim()
  .max(5)
  .refine(value => value === "" || toMinutes(value) !== null, {
    message: "Uhrzeit muss im Format HH:MM vorliegen",
  })
  .nullable()
  .optional();

const HELPER_TIME_WINDOW_FIELDS = [
  ["availMon", "availMonStart", "availMonEnd", "Montag"],
  ["availTue", "availTueStart", "availTueEnd", "Dienstag"],
  ["availWed", "availWedStart", "availWedEnd", "Mittwoch"],
  ["availThu", "availThuStart", "availThuEnd", "Donnerstag"],
  ["availFri", "availFriStart", "availFriEnd", "Freitag"],
  ["availSat", "availSatStart", "availSatEnd", "Samstag"],
  ["availSun", "availSunStart", "availSunEnd", "Sonntag"],
] as const;

function validateHelperTimeWindows(value: Record<string, unknown>, ctx: z.RefinementCtx) {
  for (const [availabilityField, startField, endField, label] of HELPER_TIME_WINDOW_FIELDS) {
    const start = value[startField];
    const end = value[endField];
    if (start === undefined && end === undefined) continue;
    const normalizedStart = String(start ?? "").trim();
    const normalizedEnd = String(end ?? "").trim();
    if ((normalizedStart === "") !== (normalizedEnd === "")) {
      ctx.addIssue({
        code: "custom",
        path: [startField],
        message: `${label}: Beginn und Ende müssen gemeinsam gesetzt oder geleert werden`,
      });
      continue;
    }
    if (normalizedStart && toMinutes(normalizedEnd)! <= toMinutes(normalizedStart)!) {
      ctx.addIssue({
        code: "custom",
        path: [endField],
        message: `${label}: Das Ende muss nach dem Beginn liegen`,
      });
    }
  }
}

const helperCreationAvailabilityInput = {
  availMon: ynv.default("vielleicht"),
  availTue: ynv.default("vielleicht"),
  availWed: ynv.default("vielleicht"),
  availThu: ynv.default("vielleicht"),
  availFri: ynv.default("vielleicht"),
  availSat: ynv.default("vielleicht"),
  availSun: ynv.default("vielleicht"),
  availMonStart: availabilityClockTime,
  availMonEnd: availabilityClockTime,
  availTueStart: availabilityClockTime,
  availTueEnd: availabilityClockTime,
  availWedStart: availabilityClockTime,
  availWedEnd: availabilityClockTime,
  availThuStart: availabilityClockTime,
  availThuEnd: availabilityClockTime,
  availFriStart: availabilityClockTime,
  availFriEnd: availabilityClockTime,
  availSatStart: availabilityClockTime,
  availSatEnd: availabilityClockTime,
  availSunStart: availabilityClockTime,
  availSunEnd: availabilityClockTime,
};

const helperUpdateAvailabilityInput = {
  availMon: ynv.optional(),
  availTue: ynv.optional(),
  availWed: ynv.optional(),
  availThu: ynv.optional(),
  availFri: ynv.optional(),
  availSat: ynv.optional(),
  availSun: ynv.optional(),
  availMonStart: availabilityClockTime,
  availMonEnd: availabilityClockTime,
  availTueStart: availabilityClockTime,
  availTueEnd: availabilityClockTime,
  availWedStart: availabilityClockTime,
  availWedEnd: availabilityClockTime,
  availThuStart: availabilityClockTime,
  availThuEnd: availabilityClockTime,
  availFriStart: availabilityClockTime,
  availFriEnd: availabilityClockTime,
  availSatStart: availabilityClockTime,
  availSatEnd: availabilityClockTime,
  availSunStart: availabilityClockTime,
  availSunEnd: availabilityClockTime,
};

const validateShiftTimes = (
  value: { startTime?: string; endTime?: string },
  ctx: z.RefinementCtx
) => {
  if (value.startTime === undefined && value.endTime === undefined) return;
  if (value.startTime === undefined || value.endTime === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["startTime"],
      message: "Beginn und Ende müssen gemeinsam angegeben werden",
    });
    return;
  }
  if ((value.startTime === "") !== (value.endTime === "")) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Beginn und Ende müssen beide leer oder beide gesetzt sein",
    });
    return;
  }
  if (
    value.startTime !== "" &&
    toMinutes(value.endTime)! <= toMinutes(value.startTime)!
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Das Ende muss nach dem Beginn liegen",
    });
  }
};

const createShiftInput = z
  .object({
    day: dayEnum,
    area: z.string().trim().min(1),
    task: z.string().trim().min(1),
    locationId: z.number().int().positive().nullable().optional(),
    startTime: clockTime.default(""),
    endTime: clockTime.default(""),
    allowFlexibleAssignment: z.boolean().default(false),
    manualOkConfirmed: z.boolean().default(false),
    manualDoubleConflictAccepted: z.boolean().default(false),
    needed: z.number().int().min(0).max(20).default(1),
    note: z.string().optional(),
  })
  .superRefine(validateShiftTimes);

const updateShiftInput = z
  .object({
    id: z.number().int().positive(),
    day: dayEnum.optional(),
    area: z.string().trim().min(1).optional(),
    task: z.string().trim().min(1).optional(),
    locationId: z.number().int().positive().nullable().optional(),
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
    allowFlexibleAssignment: z.boolean().optional(),
    manualOkConfirmed: z.boolean().optional(),
    manualDoubleConflictAccepted: z.boolean().optional(),
    needed: z.number().int().min(0).max(20).optional(),
    note: z.string().nullable().optional(),
  })
  .superRefine(validateShiftTimes);

async function requireAdminPassword(
  password: string,
  ctx: { req: any; user: { openId: string } }
) {
  const clientKey = `admin-confirm:${ctx.user.openId}:${getClientKey(ctx.req)}`;
  if (isPasswordLoginBlocked(clientKey)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Zu viele falsche Passwortversuche. Bitte versuchen Sie es in 15 Minuten erneut.",
    });
  }
  const hash = (await db.getSecuritySettings())?.adminPasswordHash;
  if (!hash || !(await verifyPassword(password, hash))) {
    recordFailedPasswordLogin(clientKey);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Administratorpasswort ist nicht korrekt",
    });
  }
  clearPasswordLoginFailures(clientKey);
}

function auditActor(user: {
  id: number;
  name: string | null;
  role: "user" | "admin";
  loginMethod: string | null;
}): db.AuditActor {
  return {
    userId: user.id,
    name:
      user.name ?? (user.role === "admin" ? "Administrator" : "Planungsteam"),
    role: user.role,
    loginMethod: user.loginMethod,
  };
}

async function auditActorWithContact(
  user: Parameters<typeof auditActor>[0],
  responsibleContactId: number
) {
  const contact = await db.getContact(responsibleContactId);
  if (!contact) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Der ausgewählte Ansprechpartner wurde nicht gefunden",
    });
  }
  return {
    ...auditActor(user),
    responsibleContactId: contact.id,
    responsibleContactName: contact.name,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    passwordStatus: publicProcedure.query(async () => {
      const settings = await db.getSecuritySettings();
      return {
        enabled: Boolean(settings?.passwordHash),
        adminEnabled: Boolean(settings?.adminPasswordHash),
        planningTeamLocked: settings?.planningTeamLocked ?? false,
      };
    }),
    passwordLogin: publicProcedure
      .input(z.object({ password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const clientKey = `planning:${getClientKey(ctx.req)}`;
        const settings = await db.getSecuritySettings();

        // 1. Gezielte manuelle Sperre durch Administratoren (bleibt unberührt)
        if (settings?.planningTeamLocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Der Zugang für das Planungsteam wurde durch einen Administrator gesperrt. Bitte wenden Sie sich an die Administration.",
          });
        }

        // 2. Zeitbasierter Rate-Limiter (TTL) mit progressiver Verzögerung (DoS-Schutz)
        const rateLimit = getPlanningTeamRateLimitStatus(clientKey);
        if (rateLimit.isBlocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Zu viele Fehlversuche für diesen Anschluss. Bitte warten Sie ${rateLimit.retryAfterSeconds} Sekunden.`,
          });
        }

        const storedHash = settings?.passwordHash;
        const valid = storedHash
          ? await verifyPassword(input.password, storedHash)
          : false;
        if (!valid) {
          const failedStatus = recordFailedPlanningTeamLogin(clientKey);
          if (failedStatus.isBlocked) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: `Zu viele Fehlversuche. Bitte warten Sie ${failedStatus.retryAfterSeconds} Sekunden, bevor Sie es erneut versuchen.`,
            });
          }
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Passwort ist nicht korrekt",
          });
        }

        clearPlanningTeamFailures(clientKey);
        await db.clearPlanningTeamLoginFailuresIfUnlocked();

        await db.upsertUser({
          openId: SHARED_PASSWORD_OPEN_ID,
          name: "Planungsteam",
          loginMethod: "password",
          role: "user",
          lastSignedIn: new Date(),
        });
        const token = await sdk.createSessionToken(SHARED_PASSWORD_OPEN_ID, {
          name: "Planungsteam",
          expiresInMs: PASSWORD_SESSION_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return { success: true } as const;
      }),
    adminPasswordLogin: publicProcedure
      .input(z.object({ password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const clientKey = `admin:${getClientKey(ctx.req)}`;
        if (isPasswordLoginBlocked(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.",
          });
        }
        const hash = (await db.getSecuritySettings())?.adminPasswordHash;
        if (!hash || !(await verifyPassword(input.password, hash))) {
          recordFailedPasswordLogin(clientKey);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Administratorpasswort ist nicht korrekt",
          });
        }
        clearPasswordLoginFailures(clientKey);
        await db.upsertUser({
          openId: ADMIN_PASSWORD_OPEN_ID,
          name: "Administrator",
          loginMethod: "admin-password",
          role: "admin",
          lastSignedIn: new Date(),
        });
        const token = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
          name: "Administrator",
          expiresInMs: PASSWORD_SESSION_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return { success: true } as const;
      }),
    resetAdminWithKey: publicProcedure
      .input(
        z.object({
          recoveryKey: z.string().min(1, "Recovery-Key darf nicht leer sein").max(200),
          newPassword: passwordInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const clientKey = `admin-recovery:${getClientKey(ctx.req)}`;
        if (isPasswordLoginBlocked(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Zu viele Fehlversuche für den Recovery-Key. Bitte in 15 Minuten erneut versuchen.",
          });
        }
        const configuredKey = ENV.adminRecoveryKey;
        if (!configuredKey || !verifyRecoveryKey(input.recoveryKey, configuredKey)) {
          recordFailedPasswordLogin(clientKey);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Master Recovery Key ist nicht korrekt oder nicht konfiguriert",
          });
        }
        clearPasswordLoginFailures(clientKey);
        clearPasswordLoginFailures(`admin:${getClientKey(ctx.req)}`);

        // Neues Passwort hashen und in der Datenbank speichern (erhöht gleichzeitig adminSessionVersion)
        const newHash = await hashPassword(input.newPassword);
        await db.setAdminPasswordHash(newHash);

        // Admin-Benutzer aktualisieren / erstellen und direkt einloggen
        await db.upsertUser({
          openId: ADMIN_PASSWORD_OPEN_ID,
          name: "Administrator",
          loginMethod: "admin-password",
          role: "admin",
          lastSignedIn: new Date(),
        });
        const token = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
          name: "Administrator",
          expiresInMs: PASSWORD_SESSION_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return { success: true } as const;
      }),
    setPassword: accountAdminProcedure
      .input(
        z.object({
          password: passwordInput,
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        await db.setPasswordHash(await hashPassword(input.password));
        return { success: true } as const;
      }),
    setAdminPassword: accountAdminProcedure
      .input(
        z.object({
          password: passwordInput,
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        await db.setAdminPasswordHash(await hashPassword(input.password));
        return { success: true } as const;
      }),
    unlockPlanningTeamLock: accountAdminProcedure.mutation(async () => {
      await db.unlockPlanningTeamLogin();
      return { success: true } as const;
    }),
    lockPlanningTeam: accountAdminProcedure.mutation(async () => {
      await db.lockPlanningTeamLogin();
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionKey = sessionPresenceKey(ctx.req);
      if (sessionKey) {
        try {
          await db.revokeSessionKey(sessionKey, "logout");
        } catch (error) {
          console.warn("[Auth] Sitzungswiderruf fehlgeschlagen", error);
        }
      }
      try {
        await removeSessionPresence(ctx.req);
      } catch (error) {
        console.warn("[Presence] Sitzung konnte beim Logout nicht entfernt werden", error);
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  presence: router({
    heartbeat: baseProtectedProcedure.mutation(async ({ ctx }) => {
      await safelyRecordPresence(ctx.req, ctx.user);
      return { success: true } as const;
    }),
    status: baseProtectedProcedure.query(() => getOnlinePresenceCounts()),
  }),

  years: router({
    list: scopedProtectedProcedure.query(() => db.listEventYears()),
    create: scopeAdminAuthProcedure
      .input(z.object({ year: eventYearInput }))
      .mutation(async ({ input }) => {
        await db.ensureEventYear(input.year);
        const event = await db.createEvent("MyEifelRide", input.year);
        return { success: true, event } as const;
      }),
    copyPlan: adminProcedure
      .input(
        z.object({
          sourceEventId: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.copyPlanFromEvent(input.sourceEventId);
      }),
  }),

  events: router({
    list: scopedProtectedProcedure.query(() => db.listEvents()),
    current: scopedProtectedProcedure.query(() => db.getEvent()),
    create: scopeAdminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(200),
          activeDays: activeDaysInput,
        })
      )
      .mutation(({ input }) =>
        db.createEvent(input.name, undefined, input.activeDays)
      ),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(2).max(200).optional(),
          startDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Startdatum")
            .nullable()
            .optional(),
          endDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Enddatum")
            .nullable()
            .optional(),
          donationTargetKuchen: z.number().int().min(0).max(10_000).optional(),
          donationTargetSalat: z.number().int().min(0).max(10_000).optional(),
          donationTargetSnack: z.number().int().min(0).max(10_000).optional(),
          donationTargetSonstiges: z
            .number()
            .int()
            .min(0)
            .max(10_000)
            .optional(),
        })
      )
      .mutation(({ input }) =>
        db.updateEventDetails(input.id, {
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          donationTargetKuchen: input.donationTargetKuchen,
          donationTargetSalat: input.donationTargetSalat,
          donationTargetSnack: input.donationTargetSnack,
          donationTargetSonstiges: input.donationTargetSonstiges,
        })
      ),
    remove: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteEvent(input.id);
      }),
    all: scopedProtectedProcedure.query(async () => {
      const years = await db.listEventYears();
      const grouped = await Promise.all(
        years.map(async item => ({
          year: item.year,
          events: await db.listEvents(item.year),
        }))
      );
      return grouped.flatMap(group => group.events);
    }),
  }),

  reset: router({
    area: adminProcedure
      .input(
        z.object({
          area: resetAreaInput,
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        await db.resetArea(input.area, auditActor(ctx.user));
        return { success: true } as const;
      }),
  }),

  contacts: router({
    list: protectedProcedure.query(() => db.listContacts()),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1),
          phone: z.string().trim().max(64).optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.upsertContactByName(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1),
          phone: z.string().max(64).nullable().optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateContact(id, r);
      }),
    remove: adminProcedure
      .input(
        z.object({
          id: z.number(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteContact(input.id, auditActor(ctx.user));
      }),
  }),

  locations: router({
    list: protectedProcedure.query(async () =>
      (await db.listLocations()).map(location => ({
        ...location,
        // Die persistierte Storage-URL bleibt für Backups erhalten. Alle Browser
        // nutzen aber die eigene Same-Origin-Route, damit auch die veröffentlichte
        // Desktop- und Mobile-App keine Sandbox-Storage-Route benötigt.
        logoUrl: locationLogoUrl(location),
      }))
    ),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          latitude: z.number().finite().min(-90).max(90),
          longitude: z.number().finite().min(-180).max(180),
        })
      )
      .mutation(({ input }) => db.createLocation(input)),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(200).optional(),
          latitude: z.number().finite().min(-90).max(90).optional(),
          longitude: z.number().finite().min(-180).max(180).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...value } = input;
        return db.updateLocation(id, value);
      }),
    uploadLogo: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          base64: z.string().min(1).max(4_000_000, "Logo ist größer als 3 MB"),
          mimeType: locationLogoMimeType,
        })
      )
      .mutation(async ({ input }) => {
        const location = await db.getLocation(input.id);
        if (!location) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der ausgewählte Standort wurde nicht gefunden",
          });
        }
        const buffer = decodeLocationLogoBase64(input.base64);
        if (!buffer || !buffer.length || buffer.length > LOCATION_LOGO_MAX_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte ein PNG-, SVG- oder JPEG-Logo bis 3 MB auswählen",
          });
        }
        if (!isValidLocationLogo(buffer, input.mimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Bilddatei passt nicht zum ausgewählten Dateiformat",
          });
        }
        const uploaded = await storagePut(
          `location-logos/events/${currentEventYear()}/${currentEventId()}/${location.id}-${safeExportName(location.name)}.${locationLogoExtension(input.mimeType)}`,
          buffer,
          input.mimeType
        );
        await db.updateLocation(location.id, {
          logoKey: uploaded.key,
          logoUrl: uploaded.url,
        });
        return uploaded;
      }),
    clearLogo: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const location = await db.getLocation(input.id);
        if (!location) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der ausgewählte Standort wurde nicht gefunden",
          });
        }
        await db.updateLocation(location.id, { logoKey: null, logoUrl: null });
        return { success: true } as const;
      }),
    remove: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteLocation(input.id);
      }),
  }),

  gpxTracks: router({
    list: protectedProcedure.query(() => db.listGpxTracks()),
    mapData: protectedProcedure.query(async () => {
      const tracks = await db.listGpxTracks();
      const loaded = await Promise.all(
        tracks.map(async track => {
          try {
            return await loadGpxMapTrack(track);
          } catch (error) {
            console.warn(
              `[GPX] Strecke ${track.id} (${track.name}) konnte nicht für die Karte gelesen werden`,
              error
            );
            return null;
          }
        })
      );
      return loaded.filter((track): track is GpxMapTrack => track !== null);
    }),
    upload: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          base64: z.string().min(1).max(8_500_000, "Die GPX-Datei ist größer als 6 MB"),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Streckenfarbe").default("#2563eb"),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (!buffer.length || buffer.length > 6_000_000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte eine GPX-Datei bis 6 MB auswählen",
          });
        }
        const xml = buffer.toString("utf8");
        if (!/<gpx(?:\s|>)/i.test(xml) || !/<(?:trkpt|rtept)(?:\s|>)/i.test(xml)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Datei enthält keine gültige GPX-Strecke mit Wegpunkten",
          });
        }
        const selectedEvent = await db.getEvent();
        if (!selectedEvent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die ausgewählte Veranstaltung wurde nicht gefunden",
          });
        }
        const uploaded = await storagePut(
          `gpx-tracks/events/${selectedEvent.year}/${selectedEvent.id}/${safeExportName(input.name)}.gpx`,
          buffer,
          "application/gpx+xml"
        );
        const result = await db.createGpxTrack({
          name: input.name,
          fileKey: uploaded.key,
          fileUrl: uploaded.url,
          color: input.color,
        });
        return { ...result, fileUrl: uploaded.url };
      }),
    remove: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteGpxTrack(input.id);
      }),
  }),

  helpers: router({
    list: protectedProcedure.query(() => db.listHelpers()),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          contactId: z.number().nullable().optional(),
          phone: z.string().trim().max(64).optional(),
          note: z.string().trim().max(500).optional(),
          willHelp: yn.default("ja"),
          ...helperCreationAvailabilityInput,
          confirmed: yn.default("nein"),
          companion: z.string().trim().max(500).optional(),
        }).superRefine(validateHelperTimeWindows)
      )
      .mutation(({ input }) => db.upsertHelperByName(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          contactId: z.number().nullable().optional(),
          email: z.string().email().max(320).nullable().optional(),
          phone: z.string().max(64).nullable().optional(),
          note: z.string().nullable().optional(),
          companion: z.string().trim().max(500).nullable().optional(),
          willHelp: yn.optional(),
          ...helperUpdateAvailabilityInput,
          confirmed: yn.optional(),
        }).superRefine(validateHelperTimeWindows)
      )
      .mutation(({ input }) => {
        const { id, ...rest } = input;
        return db.updateHelper(id, rest);
      }),
    remove: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          responsibleContactId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        db.deleteHelper(input.id, {
          allowAssigned: ctx.user.role === "admin",
          actor: await auditActorWithContact(
            ctx.user,
            input.responsibleContactId
          ),
        })
      ),
  }),

  shifts: router({
    list: protectedProcedure.query(() => db.listShifts()),
    create: adminProcedure
      .input(createShiftInput)
      .mutation(async ({ input }) => {
        const selectedEvent = await db.getEvent();
        if (!eventWeekdays(selectedEvent?.activeDays).includes(input.day))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${input.day} ist für diese Veranstaltung nicht aktiviert`,
          });
        return db.createShift(input);
      }),
    update: adminProcedure
      .input(updateShiftInput)
      .mutation(async ({ input }) => {
        if (input.day) {
          const selectedEvent = await db.getEvent();
          if (!eventWeekdays(selectedEvent?.activeDays).includes(input.day))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${input.day} ist für diese Veranstaltung nicht aktiviert`,
            });
        }
        const { id, ...rest } = input;
        try {
          return await db.updateShift(id, rest);
        } catch (error) {
          if (error instanceof ShiftUpdateValidationError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteShift(input.id)),
  }),

  plan: router({
    evaluate: protectedProcedure.query(async () => {
      const [shifts, assignments, helpers] = await Promise.all([
        db.listShifts(),
        db.listAssignments(),
        db.listHelpers(),
      ]);
      return evaluateShifts(shifts, assignments, helpers);
    }),
    clearAssignments: adminProcedure
      .input(
        z.object({
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.clearAssignments();
      }),
    areaContacts: protectedProcedure.query(() => db.listShiftAreaContacts()),
    setAreaContact: adminProcedure
      .input(
        z.object({
          area: z.string().trim().min(1).max(200),
          contactId: z.number().int().positive().nullable(),
        })
      )
      .mutation(({ input }) =>
        db.setShiftAreaContact(input.area, input.contactId)
      ),
    available: protectedProcedure
      .input(
        z.object({
          day: dayEnum,
          startTime: clockTime.optional(),
          endTime: clockTime.optional(),
          allowFlexibleAssignment: z.boolean().optional(),
        }).superRefine(validateShiftTimes)
      )
      .query(async ({ input }) => {
        const hs = await db.listHelpers();
        return hs.filter(h =>
          helperEligibleForShift(h, {
            day: input.day,
            startTime: input.startTime,
            endTime: input.endTime,
            allowFlexibleAssignment: input.allowFlexibleAssignment,
          })
        );
      }),
    assign: adminProcedure
      .input(
        z.object({
          shiftId: z.number().int().positive(),
          helperId: z.number().int().positive(),
          slot: z.number().int().min(0).max(19).default(0),
        })
      )
      .mutation(async ({ input }) => {
        const [shifts, helpers, assignments] = await Promise.all([
          db.listShifts(),
          db.listHelpers(),
          db.listAssignments(),
        ]);
        const shift = shifts.find(item => item.id === input.shiftId);
        const helper = helpers.find(item => item.id === input.helperId);
        if (!shift || !helper)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Schicht oder Helfer wurde nicht gefunden",
          });
        if (input.slot >= shift.needed)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dieser Platz liegt außerhalb des Schichtbedarfs",
          });
        if (!helperEligibleForShift(helper, shift))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der Helfer ist für diese Schichtzeit nicht verfügbar",
          });
        if (
          assignments.some(
            item => item.shiftId === input.shiftId && item.slot === input.slot
          )
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Dieser Platz ist bereits belegt",
          });
        }
        if (
          assignments.some(
            item =>
              item.shiftId === input.shiftId && item.helperId === input.helperId
          )
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Der Helfer ist dieser Schicht bereits zugewiesen",
          });
        }
        try {
          return await db.assignHelper(input);
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Die Zuweisung konnte wegen einer gleichzeitigen Änderung nicht gespeichert werden",
          });
        }
      }),
    unassign: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.unassignHelper(input.id)),
  }),

  help: router({
    guidePdf: baseProtectedProcedure.mutation(async () => {
      try {
        const signedUrl = await storageGetSignedUrl(GUIDE_PDF_KEY);
        const response = await fetch(signedUrl, {
          redirect: "follow",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Storage HTTP ${response.status}`);
        const pdf = await readResponseBodyLimited(
          response,
          GUIDE_PDF_MAX_BYTES
        );
        if (!pdf.length || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
          throw new Error("Ungültige PDF-Datei");
        }
        return {
          filename: GUIDE_PDF_FILENAME,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      } catch (error) {
        console.error(
          "[Help] PDF-Anleitung konnte nicht geladen werden",
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Die PDF-Anleitung konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
        });
      }
    }),
  }),

  pdf: router({
    settings: protectedProcedure.query(async () => {
      const settings = (await db.getAppSettings()) ?? {
        ...DEFAULT_PDF_SETTINGS,
        eventYear: String(currentEventYear()),
      };
      const selectedEvent = await db.getEvent();
      let extraColumns: string[] = [];
      try {
        const parsed = JSON.parse(settings.extraColumns);
        if (Array.isArray(parsed)) {
          extraColumns = parsed.filter(item => typeof item === "string");
        }
      } catch {}
      return {
        ...settings,
        eventYear: String(currentEventYear()),
        eventName: selectedEvent?.name ?? settings.eventName,
        logoKey: selectedEvent?.pdfLogoKey ?? null,
        logoUrl:
          selectedEvent &&
          (selectedEvent.pdfLogoKey || selectedEvent.pdfLogoFallback === "brand")
            ? `/api/pdf/event-image/${selectedEvent.year}/${selectedEvent.id}`
            : null,
        logoFallback: selectedEvent?.pdfLogoFallback ?? "none",
        whatsAppMessageTemplate: settings.whatsAppMessageTemplate ?? null,
        extraColumns,
      };
    }),
    updateSettings: adminProcedure
      .input(pdfSettingsInput)
      .mutation(async ({ input }) => {
        const { extraColumns, ...rest } = input;
        await db.updateAppSettings({
          ...rest,
          extraColumns: JSON.stringify(extraColumns),
        });
        return { success: true } as const;
      }),
    uploadLogo: adminProcedure
      .input(
        z.object({
          base64: z.string().max(4_000_000, "Logo ist größer als 3 MB"),
          mimeType: z.enum(["image/png", "image/jpeg"]),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (!buffer.length || buffer.length > 3_000_000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte ein PNG- oder JPEG-Logo bis 3 MB auswählen",
          });
        }
        const hasValidSignature =
          input.mimeType === "image/png"
            ? buffer.length >= 8 &&
              buffer.subarray(0, 8).equals(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
              )
            : buffer.length >= 3 &&
              buffer[0] === 0xff &&
              buffer[1] === 0xd8 &&
              buffer[2] === 0xff;
        if (!hasValidSignature) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Bilddatei passt nicht zum ausgewählten Dateiformat",
          });
        }
        const selectedEvent = await db.getEvent();
        if (!selectedEvent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die ausgewählte Veranstaltung wurde nicht gefunden",
          });
        }
        const extension = input.mimeType === "image/png" ? "png" : "jpg";
        const uploaded = await storagePut(
          `pdf-logos/events/${selectedEvent.year}/${selectedEvent.id}/pdf-logo.${extension}`,
          buffer,
          input.mimeType
        );
        await db.updateCurrentEventPdfImage({
          pdfLogoKey: uploaded.key,
          pdfLogoUrl: uploaded.url,
        });
        return uploaded;
      }),
    clearLogo: adminProcedure.mutation(async () => {
      await db.updateCurrentEventPdfImage({
        pdfLogoKey: null,
        pdfLogoUrl: null,
      });
      return { success: true } as const;
    }),
    setLogoFallback: adminProcedure
      .input(z.object({ fallback: z.enum(["none", "brand"]) }))
      .mutation(async ({ input }) => {
        await db.updateCurrentEventPdfImage({
          pdfLogoFallback: input.fallback,
        });
        return { success: true } as const;
      }),
    helper: protectedProcedure
      .input(z.object({ helperId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const pdf = await createHelperTaskPdf(input.helperId);
        return {
          filename: `Aufgaben_Helfer_${input.helperId}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    publicShare: protectedProcedure
      .input(z.object({ helperId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const helper = await db.getHelper(input.helperId);
        if (!helper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der Helfer gehört nicht zur aktuell ausgewählten Veranstaltung",
          });
        }
        const shareCode = await db.ensureHelperPdfShareCode(helper.id);
        const path = `/p/${shareCode}`;
        return {
          path,
          url: publicAppUrl(path),
          expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        };
      }),
    allHelpers: protectedProcedure
      .input(
        z.object({ contactId: z.number().int().positive().optional() })
      )
      .query(async ({ input }) => {
      const selectedContact = input.contactId
        ? await db.getContact(input.contactId)
        : undefined;
      if (input.contactId && !selectedContact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Der ausgewählte Ansprechpartner gehört nicht zur aktuellen Veranstaltung",
        });
      }
      const zip = await createAllHelperTaskZip(input.contactId);
      const selectedEvent = await db.getEvent();
      return {
        filename: `Aufgabenuebersichten_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}${selectedContact ? `_${safeExportName(selectedContact.name)}` : ""}.zip`,
        mimeType: "application/zip",
        base64: zip.toString("base64"),
      };
      }),
    blankPlan: protectedProcedure.query(async () => {
      const pdf = await createBlankPlanPdf();
      return {
        filename: "Einsatzplan_Blanko.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    plan: protectedProcedure.input(planPdfInput).mutation(async ({ input }) => {
      const selectedEvent = await db.getEvent();
      const activeDays = eventWeekdays(selectedEvent?.activeDays);
      const invalidDay = input.days?.find(day => !activeDays.includes(day));
      if (invalidDay)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${invalidDay} ist für diese Veranstaltung nicht aktiviert`,
        });
      const pdf = await createPlanPdf(input);
      const eventName = safeExportName(selectedEvent?.name ?? "Veranstaltung");
      return {
        filename:
          input.mode === "blank"
            ? `Einsatzplan_Blanko_${eventName}.pdf`
            : `Einsatzplan_Ausgefuellt_${eventName}.pdf`,
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    materialPacklist: protectedProcedure
      .input(
        z.object({
          materialIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedMaterials = await db.listMaterials();
        const scopedIds = new Set(scopedMaterials.map(material => material.id));
        const invalidId = input.materialIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Mindestens ein Materialartikel gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createMaterialPacklistPdf(input.materialIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Material_Packliste_Gefiltert_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    donationOverview: protectedProcedure
      .input(
        z.object({
          donationIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedDonations = await db.listCakes();
        const scopedIds = new Set(scopedDonations.map(donation => donation.id));
        const invalidId = input.donationIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens eine Spende gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createDonationOverviewPdf(input.donationIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Spendenuebersicht_Gefiltert_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    prepTaskOverview: protectedProcedure
      .input(
        z.object({
          taskIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedTasks = await db.listPrep();
        const scopedIds = new Set(scopedTasks.map(task => task.id));
        const invalidId = input.taskIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens eine Vorbereitungsaufgabe gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createPrepTaskOverviewPdf(input.taskIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Vorbereitung_Aufgabenuebersicht_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    postTaskOverview: protectedProcedure
      .input(
        z.object({
          taskIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedTasks = await db.listPost();
        const scopedIds = new Set(scopedTasks.map(task => task.id));
        const invalidId = input.taskIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens eine Nachbereitungsaufgabe gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createPostTaskOverviewPdf(input.taskIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Nachbereitung_Aufgabenuebersicht_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
  }),

  prep: router({
    list: protectedProcedure.query(() => db.listPrep()),
    create: protectedProcedure
      .input(
        z.object({
          task: z.string().trim().min(1).max(300),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().nullable().optional(),
          note: z.string().max(10_000).optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createPrep({
          ...input,
          status: "offen",
          statusWording: "aufgabe",
          logEntryAuthor: auditActor(ctx.user).name,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          task: z.string().trim().min(1).max(300).optional(),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().nullable().optional(),
          status: statusPrep.optional(),
          statusWording: prepStatusWording.optional(),
          note: z.string().max(10_000).nullable().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...r } = input;
        return db.updatePrep(id, {
          ...r,
          ...(r.logEntry === undefined
            ? {}
            : { logEntryAuthor: auditActor(ctx.user).name }),
        });
      }),
    remove: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          responsibleContactId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        db.deletePrep(input.id, {
          actor: await auditActorWithContact(
            ctx.user,
            input.responsibleContactId
          ),
        })
      ),
  }),
  post: router({
    list: protectedProcedure.query(() => db.listPost()),
    create: protectedProcedure
      .input(
        z.object({
          task: z.string().trim().min(1).max(300),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createPost({
          ...input,
          status: "offen",
          logEntryAuthor: auditActor(ctx.user).name,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          task: z.string().trim().min(1).max(300).optional(),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().nullable().optional(),
          status: statusTask.optional(),
          note: z.string().nullable().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...r } = input;
        return db.updatePost(id, {
          ...r,
          ...(r.logEntry === undefined
            ? {}
            : { logEntryAuthor: auditActor(ctx.user).name }),
        });
      }),
    remove: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          responsibleContactId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        db.deletePost(input.id, {
          actor: await auditActorWithContact(
            ctx.user,
            input.responsibleContactId
          ),
        })
      ),
  }),
  materials: router({
    list: protectedProcedure.query(() => db.listMaterials()),
    create: protectedProcedure
      .input(
        z.object({
          article: z.string().min(1),
          category: z.string().optional(),
          quantity: z.string().optional(),
          unit: z.string().optional(),
          locationId: z.number().nullable().optional(),
          contactId: z.number().nullable().optional(),
          status: materialStatus.default("offen"),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createMaterial(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          article: z.string().optional(),
          category: z.string().optional(),
          quantity: z.string().optional(),
          unit: z.string().optional(),
          locationId: z.number().nullable().optional(),
          contactId: z.number().nullable().optional(),
          status: materialStatus.optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateMaterial(id, r);
      }),
    remove: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          responsibleContactId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        db.deleteMaterial(input.id, {
          actor: await auditActorWithContact(
            ctx.user,
            input.responsibleContactId
          ),
        })
      ),
  }),
  marketing: router({
    list: protectedProcedure.query(() => db.listMarketing()),
    create: protectedProcedure
      .input(
        z.object({
          measure: z.string().min(1),
          channel: z.string().optional(),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createMarketing(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          measure: z.string().optional(),
          channel: z.string().optional(),
          contactId: z.number().nullable().optional(),
          status: statusTask.optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateMarketing(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteMarketing(input.id)),
  }),
  approvals: router({
    list: protectedProcedure.query(() => db.listApprovals()),
    create: protectedProcedure
      .input(
        z.object({
          request: z.string().min(1),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createApproval(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          request: z.string().optional(),
          contactId: z.number().nullable().optional(),
          status: z
            .enum(["offen", "beantragt", "genehmigt", "abgelehnt"])
            .optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateApproval(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteApproval(input.id)),
  }),
  cakes: router({
    list: protectedProcedure.query(() => db.listCakes()),
    create: protectedProcedure
      .input(
        z.object({
          donor: z.string().min(1),
          cake: z.string().optional(),
          donationCategory: z
            .enum(["kuchen", "salat", "snack", "sonstiges"])
            .default("kuchen"),
          locationId: z.number().int().positive().nullable().optional(),
          dropoffDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Abgabedatum")
            .or(z.literal(""))
            .optional(),
          dropoffTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Abgabe-Uhrzeit")
            .or(z.literal(""))
            .optional(),
          vegan: z.boolean().default(false),
          glutenFree: z.boolean().default(false),
          lactoseFree: z.boolean().default(false),
          containsNuts: z.boolean().default(false),
          meat: z.boolean().default(false),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createCake(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          donor: z.string().optional(),
          cake: z.string().optional(),
          donationCategory: z
            .enum(["kuchen", "salat", "snack", "sonstiges"])
            .optional(),
          locationId: z.number().int().positive().nullable().optional(),
          dropoffDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Abgabedatum")
            .or(z.literal(""))
            .optional(),
          dropoffTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Abgabe-Uhrzeit")
            .or(z.literal(""))
            .optional(),
          vegan: z.boolean().optional(),
          glutenFree: z.boolean().optional(),
          lactoseFree: z.boolean().optional(),
          containsNuts: z.boolean().optional(),
          meat: z.boolean().optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateCake(id, r);
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteCake(input.id, auditActor(ctx.user))
      ),
  }),
  finances: router({
    list: protectedProcedure.query(() => db.listFinances()),
    create: protectedProcedure
      .input(
        z.object({
          category: z.string().min(1),
          incomeCents: z.number().int().default(0),
          expenseCents: z.number().int().default(0),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createFinance(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          category: z.string().optional(),
          incomeCents: z.number().int().optional(),
          expenseCents: z.number().int().optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateFinance(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteFinance(input.id)),
  }),

  audit: router({
    deletions: adminProcedure
      .input(
        z
          .object({
            eventYear: eventYearInput.optional(),
            eventId: z.number().int().positive().optional(),
            entityType: z.enum(["helper", "cake", "prep", "post", "material"]).optional(),
            limit: z.number().int().min(1).max(1000).default(500),
          })
          .optional()
      )
      .query(({ input }) => db.listDeletionAuditLogs(input)),
    clear: adminProcedure
      .input(
        z.object({
          eventYear: eventYearInput.optional(),
          eventId: z.number().int().positive().optional(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        await db.clearDeletionAuditLogs({
          eventYear: input.eventYear,
          eventId: input.eventId,
        });
        return { success: true } as const;
      }),
    restore: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        db.restoreDeletionAuditLog(input.id, {
          userId: ctx.user.id,
          name: ctx.user.name ?? "Administrator",
        })
      ),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const [
        shifts,
        assignments,
        helpers,
        prep,
        post,
        contacts,
        donations,
        selectedEvent,
      ] =
        await Promise.all([
          db.listShifts(),
          db.listAssignments(),
          db.listHelpers(),
          db.listPrep(),
          db.listPost(),
          db.listContacts(),
          db.listCakes(),
          db.getEvent(),
        ]);
      const ev = evaluateShifts(shifts, assignments, helpers);
      const besetzt = ev.reduce((s, e) => s + e.besetzt, 0);
      const bedarf = ev.reduce((s, e) => s + e.shift.needed, 0);
      const eingeteilteHelferIds = new Set(
        assignments
          .map(assignment => assignment.helperId)
          .filter((helperId): helperId is number => typeof helperId === "number")
      );
      const eingeteilteHelfer = helpers.filter(helper =>
        eingeteilteHelferIds.has(helper.id)
      );
      const eingeteilteBestaetigteHelfer = eingeteilteHelfer.filter(
        helper => helper.confirmed === "ja"
      ).length;
      const eingeteilteUnbestaetigteHelfer =
        eingeteilteHelfer.length - eingeteilteBestaetigteHelfer;
      const aktiveFestivaltage = eventWeekdays(selectedEvent?.activeDays);
      const helferOhneErstkontakt = helpers.filter(helper =>
        isHelperWithoutFirstContact(helper, aktiveFestivaltage)
      ).length;
      const helferKontaktiert = helpers.length - helferOhneErstkontakt;
      const gueltigeSchichtenJeHelfer = new Map<number, number>();
      const gueltigeSchichtenJeHelferUndTag = new Map<string, number>();
      for (const entry of ev) {
        for (const helper of entry.validHelpers) {
          gueltigeSchichtenJeHelfer.set(
            helper.id,
            (gueltigeSchichtenJeHelfer.get(helper.id) ?? 0) + 1
          );
          const key = `${entry.shift.day}:${helper.id}`;
          gueltigeSchichtenJeHelferUndTag.set(
            key,
            (gueltigeSchichtenJeHelferUndTag.get(key) ?? 0) + 1
          );
        }
      }
      // Die Kennzahl folgt der tatsächlichen Eventkonfiguration statt einem
      // starren Fr/Sa/So-Raster. Dadurch sind auch Ein- und Mehrtagesformate
      // an beliebigen Wochentagen korrekt abgebildet.
      const taeglicheEinsatzbereitschaft = aktiveFestivaltage.map(day => {
        const tagesSchichten = ev.filter(entry => entry.shift.day === day);
        const bedarf = tagesSchichten.reduce(
          (sum, entry) => sum + entry.shift.needed,
          0
        );
        const besetzt = tagesSchichten.reduce(
          (sum, entry) => sum + entry.besetzt,
          0
        );
        const fehlend = Math.max(0, bedarf - besetzt);
        const tagesPotenzial = helpers.reduce(
          (potenzial, helper) => {
            if (!helperActiveOnDay(helper, day)) {
              return potenzial;
            }
            const eingeteilteSchichten =
              gueltigeSchichtenJeHelfer.get(helper.id) ?? 0;
            const schichtenAnDiesemTag =
              gueltigeSchichtenJeHelferUndTag.get(`${day}:${helper.id}`) ?? 0;
            if (eingeteilteSchichten === 0) {
              potenzial.ungenutzteHelferIds.push(helper.id);
            } else if (schichtenAnDiesemTag === 0) {
              potenzial.teilzeitReserveIds.push(helper.id);
            }
            return potenzial;
          },
          {
            ungenutzteHelferIds: [] as number[],
            teilzeitReserveIds: [] as number[],
          }
        );
        return {
          day,
          bedarf,
          besetzt,
          fehlend,
          quote: bedarf === 0 ? 0 : Math.min(100, Math.round((besetzt / bedarf) * 100)),
          ungenutzteHelfer: tagesPotenzial.ungenutzteHelferIds.length,
          teilzeitReserve: tagesPotenzial.teilzeitReserveIds.length,
          ...tagesPotenzial,
        };
      });
      const donationCategories = [
        {
          id: "kuchen",
          label: "Kuchen / Gebäck",
          target: selectedEvent?.donationTargetKuchen ?? 0,
        },
        {
          id: "salat",
          label: "Salat",
          target: selectedEvent?.donationTargetSalat ?? 0,
        },
        {
          id: "snack",
          label: "Dessert",
          target: selectedEvent?.donationTargetSnack ?? 0,
        },
        {
          id: "sonstiges",
          label: "Sonstiges",
          target: selectedEvent?.donationTargetSonstiges ?? 0,
        },
      ] as const;
      const donationCategoryCounts = new Map(
        donationCategories.map(category => [category.id, 0])
      );
      for (const donation of donations) {
        const category =
          (donation.donationCategory as string) === "deftiges"
            ? "sonstiges"
            : donation.donationCategory;
        if (donationCategoryCounts.has(category as (typeof donationCategories)[number]["id"])) {
          donationCategoryCounts.set(
            category as (typeof donationCategories)[number]["id"],
            (donationCategoryCounts.get(category as (typeof donationCategories)[number]["id"]) ?? 0) + 1
          );
        }
      }
      return {
        schichtenGesamt: ev.length,
        offen: ev.filter(e => e.status === "OFFEN").length,
        knapp: ev.filter(e => e.status === "KNAPP").length,
        ok: ev.filter(e => e.status === "OK").length,
        bedarfGesamt: bedarf,
        besetztGesamt: besetzt,
        helferGesamt: helpers.length,
        helferBestaetigt: helpers.filter(h => h.confirmed === "ja").length,
        helferEingeteilt: eingeteilteHelfer.length,
        helferEingeteiltBestaetigt: eingeteilteBestaetigteHelfer,
        helferEingeteiltUnbestaetigt: eingeteilteUnbestaetigteHelfer,
        rueckmeldequote:
          eingeteilteHelfer.length === 0
            ? 0
            : Math.round(
                (eingeteilteBestaetigteHelfer / eingeteilteHelfer.length) * 100
              ),
        helferOhneErstkontakt,
        helferKontaktiert,
        erstkontaktquote:
          helpers.length === 0
            ? 0
            : Math.round((helferKontaktiert / helpers.length) * 100),
        taeglicheEinsatzbereitschaft,
        doppelGesamt: ev.reduce((s, e) => s + e.doppelCount, 0),
        ausfallGesamt: ev.reduce((s, e) => s + e.ausfallCount, 0),
        vorbereitungGesamt: prep.length,
        offeneVorbereitung: prep.filter(p => p.status === "offen").length,
        vorbereitungInBearbeitung: prep.filter(p => p.status === "inArbeit").length,
        vorbereitungErledigt: prep.filter(p => p.status === "erledigt").length,
        abgelehnteVorbereitung: prep.filter(p => p.status === "abgelehnt").length,
        naechsteVorbereitungsfristen: upcomingPreparationDeadlines(prep, contacts),
        offeneNachbereitung: post.filter(p => p.status === "offen").length,
        spenden: {
          gesamt: donations.length,
          kategorien: donationCategories.map(category => ({
            ...category,
            ist: donationCategoryCounts.get(category.id) ?? 0,
          })),
          eigenschaften: {
            vegan: donations.filter(donation => donation.vegan).length,
            glutenFree: donations.filter(donation => donation.glutenFree).length,
            lactoseFree: donations.filter(donation => donation.lactoseFree)
              .length,
            containsNuts: donations.filter(donation => donation.containsNuts)
              .length,
            meat: donations.filter(donation => donation.meat).length,
          },
        },
        verantwortlichkeiten: await (async () => {
          const [materials, marketing, approvals] = await Promise.all([
            db.listMaterials(),
            db.listMarketing(),
            db.listApprovals(),
          ]);
          return contacts.map(contact => {
            const betreuteHelfer = helpers.filter(
              helper => helper.contactId === contact.id
            ).length;
            // Marketing und Genehmigungen sind fachlich Vorbereitungsaufgaben
            // und werden daher nur noch gemeinsam in „Vorb.“ ausgewiesen.
            const vorbereitung =
              prep.filter(task => task.contactId === contact.id).length +
              marketing.filter(item => item.contactId === contact.id).length +
              approvals.filter(item => item.contactId === contact.id).length;
            const nachbereitung = post.filter(
              task => task.contactId === contact.id
            ).length;
            const material = materials.filter(
              item => item.contactId === contact.id
            ).length;

            return {
              name: contact.name,
              betreuteHelfer,
              vorbereitung,
              nachbereitung,
              material,
              gesamt: betreuteHelfer + vorbereitung + nachbereitung + material,
            };
          });
        })(),
        auslastung: helpers
          .map(h => {
            const byDay = Object.fromEntries(
              WEEKDAYS.map(day => [
                day,
                ev.filter(
                  e =>
                    e.shift.day === day &&
                    e.validHelpers.some(v => v.id === h.id)
                ).length,
              ])
            ) as Record<(typeof WEEKDAYS)[number], number>;
            const gesamt = WEEKDAYS.reduce((sum, day) => sum + byDay[day], 0);
            return { id: h.id, name: h.name, byDay, gesamt };
          })
          .sort((left, right) => left.name.localeCompare(right.name, "de")),
      };
    }),
  }),

  projectFile: router({
    save: protectedProcedure.query(async () => {
      const result = await withExcelOperationLimit(() => exportProjectFile());
      return {
        base64: result.buffer.toString("base64"),
        exportedAt: result.exportedAt,
        eventName: result.eventName,
      };
    }),
    preview: adminProcedure
      .input(
        z.object({
          base64: z
            .string()
            .max(14_000_000, "Speicherdatei ist größer als 10 MB"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await withExcelOperationLimit(() =>
          previewProjectFile(input.base64)
        );
        return {
          ...result,
          previewBinding: createPreviewBinding({
            sourceDigest: result.workbookDigest,
            currentDigest: result.currentDigest,
            year: currentEventYear(),
            eventId: currentEventId(),
            operation: "project-file",
            userId: ctx.user.id,
          }),
        };
      }),
    load: scopeAdminAuthProcedure
      .input(
        z.object({
          base64: z
            .string()
            .max(14_000_000, "Speicherdatei ist größer als 10 MB"),
          filename: z.string().trim().min(1).max(255),
          currentDigest: z.string().regex(/^[a-f0-9]{64}$/),
          previewBinding: z.string().min(20).max(2_000),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        verifyPreviewBinding(input.previewBinding, {
          sourceDigest: uploadedFileDigest(input.base64),
          currentDigest: input.currentDigest,
          year: currentEventYear(),
          eventId: currentEventId(),
          operation: "project-file",
          userId: ctx.user.id,
        });
        try {
          return await withExcelOperationLimit(() =>
            loadProjectFile(
              input.base64,
              input.filename,
              input.currentDigest,
              auditActor(ctx.user)
            )
          );
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler bei der Datenwiederherstellung";
          console.error("[Projektdatei-Import] Atomare Übernahme abgebrochen", {
            filename: input.filename,
            year: currentEventYear(),
            eventId: currentEventId(),
            userId: ctx.user.id,
            detail,
            error,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Projektdatei wurde nicht geladen: ${detail}`,
          });
        }
      }),
    restoreLogs: adminProcedure.query(() => listBackupRestoreLogs()),
    restoreLog: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => getBackupRestoreLog(input.id)),
    clearRestoreLogs: scopeAdminAuthProcedure
      .input(z.object({ adminPassword: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.withPlanningWriteLock(() => clearBackupRestoreLogs());
      }),
  }),

  excel: router({
    exportFile: protectedProcedure.query(async () => {
      const result = await withExcelOperationLimit(() => exportProjectExcel());
      return {
        base64: result.buffer.toString("base64"),
        exportedAt: result.exportedAt,
        eventName: result.eventName,
      };
    }),
    previewModule: adminProcedure
      .input(
        z.object({
          area: z.enum(MODULE_IMPORT_AREAS),
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await withExcelOperationLimit(() =>
          previewModuleExcelImport(input.base64, input.area)
        );
        return {
          ...result,
          previewBinding: createPreviewBinding({
            sourceDigest: result.sourceDigest,
            currentDigest: result.currentDigest,
            year: currentEventYear(),
            eventId: currentEventId(),
            operation: `module:${input.area}`,
            userId: ctx.user.id,
          }),
        };
      }),
    applyModule: scopeAdminProcedure
      .input(
        z.object({
          area: z.enum(MODULE_IMPORT_AREAS),
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
          filename: z.string().trim().min(1).max(255),
          currentDigest: z.string().regex(/^[a-f0-9]{64}$/),
          previewBinding: z.string().min(20).max(2_000),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        verifyPreviewBinding(input.previewBinding, {
          sourceDigest: uploadedFileDigest(input.base64),
          currentDigest: input.currentDigest,
          year: currentEventYear(),
          eventId: currentEventId(),
          operation: `module:${input.area}`,
          userId: ctx.user.id,
        });
        try {
          return await withExcelOperationLimit(() =>
            applyModuleExcelImport(
              input.base64,
              input.area,
              input.filename,
              input.currentDigest,
              auditActor(ctx.user)
            )
          );
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler bei der Datenwiederherstellung";
          console.error("[Excel-Modulimport] Atomare Übernahme abgebrochen", {
            area: input.area,
            filename: input.filename,
            year: currentEventYear(),
            eventId: currentEventId(),
            userId: ctx.user.id,
            detail,
            error,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Excel-Import (${input.area}) wurde nicht übernommen: ${detail}`,
          });
        }
      }),
  }),

  notes: router({
    list: scopedReadProcedure
      .input(
        z
          .object({
            sinceId: z.number().int().positive().optional(),
            limit: z.number().int().min(1).max(300).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const sessionKey = sessionPresenceKey(ctx.req);
        const [notes, typing] = await Promise.all([
          db.listTeamNotes({
            sinceId: input?.sinceId,
            limit: input?.limit,
          }),
          db.listActiveTypers({ excludeSessionKey: sessionKey }),
        ]);
        return { notes, typing };
      }),
    typing: protectedProcedure
      .input(
        z.object({
          senderName: z.string().trim().min(2).max(120),
          isTyping: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const sessionKey = sessionPresenceKey(ctx.req);
        if (!sessionKey) return false;
        return db.setTeamNoteTyping({
          sessionKey,
          senderUserId: ctx.user.id > 0 ? ctx.user.id : null,
          senderName: input.senderName,
          senderRole: ctx.user.role,
          isTyping: input.isTyping,
        });
      }),
    send: protectedProcedure
      .input(
        z.object({
          senderName: z.string().trim().min(2).max(120),
          message: z.string().trim().min(1).max(2000),
          important: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const sessionKey = sessionPresenceKey(ctx.req);
        return db.createTeamNote({
          senderUserId: ctx.user.id > 0 ? ctx.user.id : null,
          senderName: input.senderName,
          senderRole: ctx.user.role,
          message: input.message,
          important: input.important,
          sessionKey,
        });
      }),
    clear: adminProcedure
      .input(
        z.object({
          adminPassword: z.string().min(1).max(200),
          scope: z.literal("current_event").default("current_event"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.clearTeamNotes(auditActor(ctx.user), {
          year: currentEventYear(),
          eventId: currentEventId(),
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
