import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EDITABLE_PLANNING_MODULES,
  FULL_PLANNER_PERMISSIONS,
  mayReadPlanningModule,
  mayWritePlanningModule,
  normalizePlanningModules,
  type PlanningModule,
  type PlanningModuleAccess,
} from "@shared/tenant-permissions";
import { visibleNavigationItemsWithPermissions } from "../client/src/lib/nav";

describe("Vereins- und Bereichsrechte-Modell", () => {
  it("erlaubt Admins und Vollberechtigten alle Module", () => {
    for (const mod of EDITABLE_PLANNING_MODULES) {
      expect(mayReadPlanningModule(FULL_PLANNER_PERMISSIONS, mod)).toBe(true);
      expect(mayWritePlanningModule(FULL_PLANNER_PERMISSIONS, mod)).toBe(true);
    }
  });

  it("erlaubt bei 'read_all' nur lesenden Zugriff auf Fachbereiche", () => {
    const permissions: PlanningModule[] = ["read_all"];
    for (const mod of EDITABLE_PLANNING_MODULES) {
      expect(mayReadPlanningModule(permissions, mod)).toBe(true);
      expect(mayWritePlanningModule(permissions, mod)).toBe(false);
    }
  });

  it("begrenzt Schreibrechte strikt auf die zugewiesenen Module", () => {
    const permissions: PlanningModule[] = ["helpers", "donations"];
    expect(mayWritePlanningModule(permissions, "helpers")).toBe(true);
    expect(mayWritePlanningModule(permissions, "donations")).toBe(true);
    expect(mayWritePlanningModule(permissions, "schedule")).toBe(false);
    expect(mayWritePlanningModule(permissions, "materials")).toBe(false);
  });

  it("blendet im Menü nicht autorisierte Bereiche für das Planungsteam aus", () => {
    const permissions: PlanningModule[] = ["helpers"];
    const items = visibleNavigationItemsWithPermissions("user", permissions);
    const hrefs = items.map(i => i.href);

    expect(hrefs).toContain("/helfer");
    expect(hrefs).toContain("/"); // Dashboard bleibt sichtbar
    expect(hrefs).not.toContain("/material");
    expect(hrefs).not.toContain("/spenden");
    expect(hrefs).not.toContain("/vorbereitung");
  });

  it("zeigt dem Administrator immer alle administrativen Menüpunkte an", () => {
    const items = visibleNavigationItemsWithPermissions("admin", null);
    const hrefs = items.map(i => i.href);

    expect(hrefs).toContain("/sicherheit");
    expect(hrefs).toContain("/finanzen");
    expect(hrefs).toContain("/ansprechpartner");
    expect(hrefs).toContain("/helfer");
  });

  it("verankert E-Mail und Modulrechte im Router und Datenbankschema", () => {
    const schemaSource = readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    const routerSource = readFileSync(
      path.resolve(__dirname, "./routers.ts"),
      "utf8"
    );

    expect(schemaSource).toContain('email: varchar("email", { length: 320 })');
    expect(schemaSource).toContain('modulePermissions: json("modulePermissions")');
    expect(routerSource).toContain("function moduleWriteProcedure(");
    expect(routerSource).toContain("function moduleReadProcedure(");
    expect(routerSource).toContain("myPermissions: scopedProtectedProcedure.query(");
  });
  it("behandelt ein leeres Rechtearray als reinen Lesezugriff ohne jegliche Schreibrechte", () => {
    const emptyPermissions: PlanningModule[] = [];
    for (const mod of EDITABLE_PLANNING_MODULES) {
      expect(mayReadPlanningModule(emptyPermissions, mod)).toBe(true);
      expect(mayWritePlanningModule(emptyPermissions, mod)).toBe(false);
    }
  });

  it("verwehrt einem Benutzer mit leerem Rechtearray jegliche Schreibmutationen im Router", async () => {
    const { appRouter } = await import("./routers");
    const db = await import("./db");
    const { vi } = await import("vitest");

    vi.spyOn(db, "getEvent").mockResolvedValue({
      id: 10,
      year: 2027,
      name: "MyEifelRide 2027",
    } as any);
    vi.spyOn(db, "withPlanningWriteLock").mockImplementation(async (cb: any) => cb());
    vi.spyOn(db, "getPlanningTeamAccessCredentialForCurrentTenant").mockResolvedValue({
      id: 999,
      isTenantAdmin: false,
      modulePermissions: [],
    } as any);
    vi.spyOn(db, "isPlanningTeamAccessAllowedForEvent").mockResolvedValue(true);
    vi.spyOn(db, "isPlanningTeamAccessPasswordChangeRequired").mockResolvedValue(false);

    const caller = appRouter.createCaller({
      user: {
        id: 999,
        openId: "planning-team-access-999",
        role: "user",
        name: "Reiner Leser",
        email: "leser@verein.invalid",
        sessionVersion: 1,
        avatarUrl: null,
        accountBlocked: false,
        lastSignedIn: new Date(),
      },
      req: {
        headers: { "x-event-year": "2027", "x-event-id": "10", "x-tenant-id": "test-tenant" },
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res: { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() } as any,
    });

    // Versuch Vorbereitung anzulegen muss scheitern
    await expect(
      caller.prep.create({ task: "Nicht erlaubt" })
    ).rejects.toThrow("Lesezugriff aktiv: Sie können diesen Bereich ansehen, aber keine Daten ändern.");

    // Versuch Material anzulegen muss scheitern
    await expect(
      caller.materials.create({ item: "Nicht erlaubt" })
    ).rejects.toThrow("Lesezugriff aktiv: Sie können diesen Bereich ansehen, aber keine Daten ändern.");

    // Versuch Nachbereitung anzulegen muss scheitern
    await expect(
      caller.post.create({ task: "Nicht erlaubt" })
    ).rejects.toThrow("Lesezugriff aktiv: Sie können diesen Bereich ansehen, aber keine Daten ändern.");

    // Versuch Helfer anzulegen muss scheitern
    await expect(
      caller.helpers.create({ name: "Nicht erlaubt" })
    ).rejects.toThrow("Lesezugriff aktiv: Sie können diesen Bereich ansehen, aber keine Daten ändern.");
  });

  it("schaltet Fachbereiche dreistufig (off, read, write) und prüft Lese- und Schreibrechte", () => {
    const access: PlanningModuleAccess = {
      helpers: "read",
      preparation: "write",
      materials: "off",
    };

    expect(mayReadPlanningModule(access, "helpers")).toBe(true);
    expect(mayWritePlanningModule(access, "helpers")).toBe(false);

    expect(mayReadPlanningModule(access, "preparation")).toBe(true);
    expect(mayWritePlanningModule(access, "preparation")).toBe(true);

    expect(mayReadPlanningModule(access, "materials")).toBe(false);
    expect(mayWritePlanningModule(access, "materials")).toBe(false);
  });
});
