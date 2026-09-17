import { COOKIE_NAME } from "@shared/const";
import {
  eventWeekdays,
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
  createHelperTaskPdf,
  createPlanPdf,
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
      throw new Error("PDF-Datei überschreitet die Größenbegrenzung");
    }
  }
  if (!response.body) throw new Error("PDF-Datei hat keinen Inhalt");

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel("PDF-Datei überschreitet die Größenbegrenzung");
        throw new Error("PDF-Datei überschreitet die Größenbegrenzung");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
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
    startTime: clockTime.default(""),
    endTime: clockTime.default(""),
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
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
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
          name: z.string().trim().min(2).max(200),
        })
      )
      .mutation(({ input }) => db.updateEventName(input.id, input.name)),
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

  helpers: router({
    list: protectedProcedure.query(() => db.listHelpers()),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          contactId: z.number().nullable().optional(),
          willHelp: yn.default("ja"),
          availMon: ynv.default("vielleicht"),
          availTue: ynv.default("vielleicht"),
          availWed: ynv.default("vielleicht"),
          availThu: ynv.default("vielleicht"),
          availFri: ynv.default("vielleicht"),
          availSat: ynv.default("vielleicht"),
          availSun: ynv.default("vielleicht"),
          confirmed: yn.default("nein"),
        })
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
          willHelp: yn.optional(),
          availMon: ynv.optional(),
          availTue: ynv.optional(),
          availWed: ynv.optional(),
          availThu: ynv.optional(),
          availFri: ynv.optional(),
          availSat: ynv.optional(),
          availSun: ynv.optional(),
          confirmed: yn.optional(),
        })
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
      .input(z.object({ day: dayEnum }))
      .query(async ({ input }) => {
        const hs = await db.listHelpers();
        return hs.filter(h => helperActiveOnDay(h, input.day as Day));
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
        if (!helperActiveOnDay(helper, shift.day as Day))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der Helfer ist an diesem Tag nicht verfügbar",
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
    updateSettings: protectedProcedure
      .input(pdfSettingsInput)
      .mutation(async ({ input }) => {
        const { extraColumns, ...rest } = input;
        await db.updateAppSettings({
          ...rest,
          extraColumns: JSON.stringify(extraColumns),
        });
        return { success: true } as const;
      }),
    uploadLogo: protectedProcedure
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
    clearLogo: protectedProcedure.mutation(async () => {
      await db.updateCurrentEventPdfImage({
        pdfLogoKey: null,
        pdfLogoUrl: null,
      });
      return { success: true } as const;
    }),
    setLogoFallback: protectedProcedure
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
  }),

  prep: router({
    list: protectedProcedure.query(() => db.listPrep()),
    create: protectedProcedure
      .input(
        z.object({
          task: z.string().trim().min(1).max(300),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          contactId: z.number().nullable().optional(),
          note: z.string().max(10_000).optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(({ input }) =>
        db.createPrep({
          ...input,
          status: "offen",
          statusWording: "aufgabe",
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          task: z.string().trim().min(1).max(300).optional(),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          contactId: z.number().nullable().optional(),
          status: statusPrep.optional(),
          statusWording: prepStatusWording.optional(),
          note: z.string().max(10_000).nullable().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updatePrep(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deletePrep(input.id)),
  }),
  post: router({
    list: protectedProcedure.query(() => db.listPost()),
    create: protectedProcedure
      .input(
        z.object({
          task: z.string().min(1),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createPost(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          task: z.string().optional(),
          contactId: z.number().nullable().optional(),
          status: statusTask.optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updatePost(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deletePost(input.id)),
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
          contactId: z.number().nullable().optional(),
          ordered: yn.default("nein"),
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
          contactId: z.number().nullable().optional(),
          ordered: yn.optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateMaterial(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteMaterial(input.id)),
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
          dropoffTime: z.string().optional(),
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
          dropoffTime: z.string().optional(),
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
            entityType: z.enum(["helper", "cake"]).optional(),
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
      const [shifts, assignments, helpers, prep, post, contacts, selectedEvent] =
        await Promise.all([
          db.listShifts(),
          db.listAssignments(),
          db.listHelpers(),
          db.listPrep(),
          db.listPost(),
          db.listContacts(),
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
      const taeglicheEinsatzbereitschaft = (
        ["Freitag", "Samstag", "Sonntag"] as const
      ).map(day => {
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
        return {
          day,
          bedarf,
          besetzt,
          fehlend,
          quote: bedarf === 0 ? 0 : Math.min(100, Math.round((besetzt / bedarf) * 100)),
        };
      });
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
        verantwortlichkeiten: await (async () => {
          const [materials, marketing, approvals] = await Promise.all([
            db.listMaterials(),
            db.listMarketing(),
            db.listApprovals(),
          ]);
          return contacts.map(c => ({
            name: c.name,
            betreuteHelfer: helpers.filter(h => h.contactId === c.id).length,
            vorbereitung: prep.filter(t => t.contactId === c.id).length,
            nachbereitung: post.filter(t => t.contactId === c.id).length,
            material: materials.filter(m => m.contactId === c.id).length,
            marketing: marketing.filter(m => m.contactId === c.id).length,
            genehmigungen: approvals.filter(a => a.contactId === c.id).length,
            gesamt:
              helpers.filter(h => h.contactId === c.id).length +
              prep.filter(t => t.contactId === c.id).length +
              post.filter(t => t.contactId === c.id).length +
              materials.filter(m => m.contactId === c.id).length +
              marketing.filter(m => m.contactId === c.id).length +
              approvals.filter(a => a.contactId === c.id).length,
          }));
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
            return { name: h.name, byDay, gesamt };
          })
          .filter(x => x.gesamt > 0),
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
        return withExcelOperationLimit(() =>
          loadProjectFile(
            input.base64,
            input.filename,
            input.currentDigest,
            auditActor(ctx.user)
          )
        );
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
