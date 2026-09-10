import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
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

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

const yn = z.enum(["ja", "nein"]);
const ynv = z.enum(["ja", "nein", "vielleicht"]);
const dayEnum = z.enum(["Freitag", "Samstag", "Sonntag"]);
const statusTask = z.enum(["offen", "inArbeit", "erledigt"]);
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  contacts: router({
    list: protectedProcedure.query(() => db.listContacts()),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), note: z.string().optional() }))
      .mutation(({ input }) => db.createContact(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateContact(id, r);
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteContact(input.id)),
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
      .mutation(({ input }) => db.createHelper(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          contactId: z.number().nullable().optional(),
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
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteHelper(input.id)),
  }),

  shifts: router({
    list: protectedProcedure.query(() => db.listShifts()),
    create: protectedProcedure
      .input(createShiftInput)
      .mutation(({ input }) => db.createShift(input)),
    update: protectedProcedure.input(updateShiftInput).mutation(({ input }) => {
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
    available: protectedProcedure
      .input(z.object({ day: dayEnum }))
      .query(async ({ input }) => {
        const hs = await db.listHelpers();
        return hs.filter(h => helperActiveOnDay(h, input.day as Day));
      }),
    assign: protectedProcedure
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
    unassign: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.unassignHelper(input.id)),
  }),

  prep: router({
    list: protectedProcedure.query(() => db.listPrep()),
    create: protectedProcedure
      .input(
        z.object({
          task: z.string().min(1),
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
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCake(input.id)),
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
    importFile: adminProcedure
      .input(z.object({ base64: z.string() }))
      .mutation(({ input }) => importExcel(input.base64)),
    exportFile: protectedProcedure.query(async () => {
      const buf = await exportExcel();
      return { base64: buf.toString("base64") };
    }),
  }),
});

export type AppRouter = typeof appRouter;
