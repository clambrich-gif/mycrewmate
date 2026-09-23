import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isMasterAdminHost,
  isMasterAdminRequestHost,
  MASTER_ADMIN_HOST,
} from "../shared/platform-admin";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Master-Admin-Portal", () => {
  it("akzeptiert im Produktionsbetrieb ausschließlich die Master-Domain", () => {
    expect(MASTER_ADMIN_HOST).toBe("admin.mycrewmate.de");
    expect(isMasterAdminHost("admin.mycrewmate.de")).toBe(true);
    expect(isMasterAdminHost("app.mycrewmate.de")).toBe(false);
    expect(isMasterAdminHost("mycrewmate.de")).toBe(false);
    expect(isMasterAdminRequestHost("admin.mycrewmate.de", "production")).toBe(true);
    expect(isMasterAdminRequestHost("app.mycrewmate.de", "production")).toBe(false);
    expect(
      isMasterAdminRequestHost("3000-preview.manus.computer", "production")
    ).toBe(false);
  });

  it("erlaubt die Master-Vorschau nur außerhalb der Produktion", () => {
    expect(
      isMasterAdminRequestHost("3000-preview.manus.computer", "development")
    ).toBe(true);
    expect(isMasterAdminRequestHost("localhost", "test")).toBe(true);
  });

  it("schützt die Plattformübersicht durch Master-Identität und Hostprüfung", () => {
    const routers = source("server/routers.ts");
    expect(routers).toContain("const masterAdminProcedure");
    expect(routers).toContain("isMasterAdminRequestHost");
    expect(routers).toContain("ctx.user.openId === ADMIN_PASSWORD_OPEN_ID");
    expect(routers).toContain("platformAdmin: router");
    expect(routers).toContain("tenantOverview: masterAdminProcedure");
  });

  it("trennt die Master-Oberfläche von der Vereinsnavigation", () => {
    const app = source("client/src/App.tsx");
    const page = source("client/src/pages/MasterAdminPortal.tsx");
    expect(app).toContain("isMasterAdminSite");
    expect(app).toContain("MasterAdminRouter");
    expect(app).toContain('path="/master-admin"');
    expect(page).toContain("platformAdmin.tenantOverview.useQuery");
    expect(page).toContain("Lesende Übersicht");
    expect(page).toContain("Keine öffentliche Registrierung, kein Checkout und keine Zahlungsanbindung.");
  });
});
