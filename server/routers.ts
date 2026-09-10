import { COOKIE_NAME } from "@shared/const";
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
import {
  evaluateShifts,
  helperActiveOnDay,
  toMinutes,
  type Day,
} from "./logic";
import { importExcel, exportExcel } from "./excel";
import { applyPlanImport, previewExcelImport } from "./import-preview";
import { sdk } from "./_core/sdk";
import {
  ADMIN_PASSWORD_OPEN_ID,
  clearPasswordLoginFailures,
  getClientKey,
  hashPassword,
  isPasswordLoginBlocked,
  PASSWORD_SESSION_MS,
  recordFailedPasswordLogin,
  SHARED_PASSWORD_OPEN_ID,
  verifyPassword,
} from "./password-auth";
import {
  createAllHelperTaskZip,
  createBlankPlanPdf,
  createHelperTaskPdf,
  createPlanPdf,
  DEFAULT_PDF_SETTINGS,
} from "./pdf";
import {
  currentEventYear,
  requestedEventYear,
  withEventYear,
} from "./year-context";

const protectedProcedure = baseProtectedProcedure.use(({ ctx, next }) =>
  withEventYear(requestedEventYear(ctx.req), () => next())
);

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

const yn = z.enum(["ja", "nein"]);
const ynv = z.enum(["ja", "nein", "vielleicht"]);
const dayEnum = z.enum(["Freitag", "Samstag", "Sonntag"]);
const statusTask = z.enum(["offen", "inArbeit", "erledigt"]);
const passwordInput = z.string().min(10).max(200);
const eventYearInput = z.number().int().min(2020).max(2100);
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
  extraColumns: z.array(z.string().trim().min(1).max(50)).max(5),
  blankRowsPerShift: z.number().int().min(0).max(20),
});
const planPdfInput = z.object({
  mode: z.enum(["blank", "filled"]),
  days: z.array(dayEnum).max(3).optional(),
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

async function requireAdminPassword(password: string) {
  const hash = (await db.getSecuritySettings())?.adminPasswordHash;
  if (!hash || !(await verifyPassword(password, hash))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Administratorpasswort ist nicht korrekt",
    });
  }
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
      };
    }),
    passwordLogin: publicProcedure
      .input(z.object({ password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const clientKey = getClientKey(ctx.req);
        if (isPasswordLoginBlocked(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.",
          });
        }
        const storedHash = (await db.getSecuritySettings())?.passwordHash;
        const valid = storedHash
          ? await verifyPassword(input.password, storedHash)
          : false;
        if (!valid) {
          recordFailedPasswordLogin(clientKey);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Passwort ist nicht korrekt",
          });
        }
        clearPasswordLoginFailures(clientKey);
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
    setPassword: adminProcedure
      .input(z.object({ password: passwordInput }))
      .mutation(async ({ input }) => {
        await db.setPasswordHash(await hashPassword(input.password));
        return { success: true } as const;
      }),
    setAdminPassword: adminProcedure
      .input(z.object({ password: passwordInput }))
      .mutation(async ({ input }) => {
        await db.setAdminPasswordHash(await hashPassword(input.password));
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  years: router({
    list: protectedProcedure.query(async () => {
      await db.ensureEventYear();
      return db.listEventYears();
    }),
    create: adminProcedure
      .input(z.object({ year: eventYearInput }))
      .mutation(async ({ input }) => {
        await db.ensureEventYear(input.year);
        return { success: true } as const;
      }),
    copyPlan: adminProcedure
      .input(
        z.object({
          sourceYear: eventYearInput,
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input }) => {
        await requireAdminPassword(input.adminPassword);
        return db.copyPlanFromYear(input.sourceYear);
      }),
  }),

  reset: router({
    area: adminProcedure
      .input(
        z.object({
          area: resetAreaInput,
          adminPassword: z.string().min(1).max(200),
          responsibleContactId: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword);
        const deletesHelpers = input.area === "helpers" || input.area === "all";
        if (deletesHelpers && !input.responsibleContactId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Bitte wählen Sie den verantwortlichen Ansprechpartner für die Helferlöschung aus",
          });
        }
        const actor = input.responsibleContactId
          ? await auditActorWithContact(ctx.user, input.responsibleContactId)
          : auditActor(ctx.user);
        await db.resetArea(input.area, actor);
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
      .mutation(async ({ input }) => {
        await requireAdminPassword(input.adminPassword);
        return db.deleteContact(input.id);
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
      .mutation(({ input }) => db.createShift(input)),
    update: adminProcedure.input(updateShiftInput).mutation(({ input }) => {
      const { id, ...rest } = input;
      return db.updateShift(id, rest);
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

  pdf: router({
    settings: protectedProcedure.query(async () => {
      const settings = (await db.getAppSettings()) ?? {
        ...DEFAULT_PDF_SETTINGS,
        eventYear: String(currentEventYear()),
      };
      settings.eventYear = String(currentEventYear());
      let extraColumns: string[] = [];
      try {
        const parsed = JSON.parse(settings.extraColumns);
        if (Array.isArray(parsed)) {
          extraColumns = parsed.filter(item => typeof item === "string");
        }
      } catch {}
      return { ...settings, extraColumns };
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
    allHelpers: protectedProcedure.query(async () => {
      const zip = await createAllHelperTaskZip();
      return {
        filename: "Aufgabenuebersichten_MyEifelRide.zip",
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
      const pdf = await createPlanPdf(input);
      return {
        filename:
          input.mode === "blank"
            ? "Einsatzplan_Blanko.pdf"
            : "Einsatzplan_Ausgefuellt.pdf",
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
          task: z.string().min(1),
          dueText: z.string().max(200).optional(),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createPrep(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          task: z.string().optional(),
          dueText: z.string().max(200).optional(),
          contactId: z.number().nullable().optional(),
          status: statusTask.optional(),
          note: z.string().nullable().optional(),
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
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input }) => {
        await requireAdminPassword(input.adminPassword);
        await db.clearDeletionAuditLogs(input.eventYear);
        return { success: true } as const;
      }),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const [shifts, assignments, helpers, prep, post, contacts] =
        await Promise.all([
          db.listShifts(),
          db.listAssignments(),
          db.listHelpers(),
          db.listPrep(),
          db.listPost(),
          db.listContacts(),
        ]);
      const ev = evaluateShifts(shifts, assignments, helpers);
      const besetzt = ev.reduce((s, e) => s + e.besetzt, 0);
      const bedarf = ev.reduce((s, e) => s + e.shift.needed, 0);
      return {
        schichtenGesamt: ev.length,
        offen: ev.filter(e => e.status === "OFFEN").length,
        knapp: ev.filter(e => e.status === "KNAPP").length,
        ok: ev.filter(e => e.status === "OK").length,
        bedarfGesamt: bedarf,
        besetztGesamt: besetzt,
        helferGesamt: helpers.length,
        helferBestaetigt: helpers.filter(h => h.confirmed === "ja").length,
        doppelGesamt: ev.reduce((s, e) => s + e.doppelCount, 0),
        ausfallGesamt: ev.reduce((s, e) => s + e.ausfallCount, 0),
        offeneVorbereitung: prep.filter(p => p.status === "offen").length,
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
            const fr = ev.filter(
              e =>
                e.shift.day === "Freitag" &&
                e.validHelpers.some(v => v.id === h.id)
            ).length;
            const sa = ev.filter(
              e =>
                e.shift.day === "Samstag" &&
                e.validHelpers.some(v => v.id === h.id)
            ).length;
            const so = ev.filter(
              e =>
                e.shift.day === "Sonntag" &&
                e.validHelpers.some(v => v.id === h.id)
            ).length;
            return { name: h.name, fr, sa, so, gesamt: fr + sa + so };
          })
          .filter(x => x.gesamt > 0),
      };
    }),
  }),

  excel: router({
    previewFile: adminProcedure
      .input(
        z.object({
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
        })
      )
      .mutation(({ input }) => previewExcelImport(input.base64)),
    applyFile: adminProcedure
      .input(
        z.object({
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
          selectedShiftKeys: z.array(z.string().max(100)).max(1000),
          selectedAssignmentKeys: z.array(z.string().max(140)).max(20000),
          helperDecisions: z
            .array(
              z.object({
                key: z.string().max(300),
                target: z.string().max(320),
              })
            )
            .max(5000),
        })
      )
      .mutation(async ({ input }) => {
        const preview = await previewExcelImport(input.base64);
        const targets = new Map(
          input.helperDecisions.map(item => [item.key, item.target])
        );
        const selectedShifts = new Set(input.selectedShiftKeys);
        const selectedAssignments = new Set(input.selectedAssignmentKeys);
        const activeHelperKeys = new Set(
          preview.shifts
            .filter(
              shift =>
                shift.status !== "conflict" &&
                (shift.status === "unchanged" || selectedShifts.has(shift.key))
            )
            .flatMap(shift =>
              shift.assignments
                .filter(
                  assignment =>
                    assignment.helperKey &&
                    selectedAssignments.has(assignment.key)
                )
                .map(assignment => assignment.helperKey!)
            )
        );
        const skipHelperKeys = preview.helperSuggestions
          .filter(item => {
            const target = targets.get(item.key);
            const allowedTargets = new Set([
              "new",
              item.defaultTarget,
              ...item.candidates.map(candidate => candidate.key),
            ]);
            return (
              !activeHelperKeys.has(item.key) ||
              !target ||
              target === "skip" ||
              !allowedTargets.has(target) ||
              target.startsWith("system:")
            );
          })
          .map(item => item.key);
        const general = await importExcel(input.base64, { skipHelperKeys });
        const plan = await applyPlanImport(input.base64, input);
        return { general, plan };
      }),
    exportFile: protectedProcedure.query(async () => {
      const buf = await exportExcel();
      return { base64: buf.toString("base64") };
    }),
  }),
});

export type AppRouter = typeof appRouter;
