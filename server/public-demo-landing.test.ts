import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

function frontendFiles(directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap(entry => {
      const relative = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? frontendFiles(relative)
        : /\.(tsx?|jsx?)$/.test(entry.name) ? [relative] : [];
    });
}

describe("Abschaltung der öffentlichen Vereinsdemo im Frontend", () => {
  it("löscht die alten Demo-Seiten und lässt historische Pfade nur NotFound anzeigen", () => {
    const app = read("client/src/App.tsx");

    for (const page of ["ClubDemoLanding", "PublicDemoEntry"]) {
      expect(fs.existsSync(path.join(root, `client/src/pages/${page}.tsx`))).toBe(false);
      expect(app).not.toContain(page);
    }
    for (const route of ["vereinsdemo", "demozugang"]) {
      expect(app).toContain(`<Route path="/${route}" component={NotFound} />`);
      expect(app).toContain(`<Route path="/${route}">
        <Suspense fallback={<RouteLoading />}>
          <NotFound />
        </Suspense>
      </Route>`);
    }
    expect(app.indexOf('path="/demozugang"')).toBeLessThan(
      app.indexOf("<Route component={PublicAppRedirect} />")
    );
  });

  it("enthält auf keiner Frontend-Seite oder Komponente Demo-Angebote, Links oder Startaufrufe", () => {
    for (const file of frontendFiles("client/src")) {
      const source = read(file);
      expect(source, file).not.toMatch(/(?:href|to)\s*=\s*["'{][^\n]*\/(?:vereinsdemo|demozugang)/i);
      expect(source, file).not.toMatch(/trpc\.publicDemo|\/api\/public-demo|demo-session-|demotenant/);
      if (file.includes("/pages/") || file.includes("/components/")) {
        expect(source, file).not.toMatch(/Vereinsdemo|isPublicDemoSession|DemoLockedHelperAction/);
      }
    }
  });

  it("entfernt Demo-Lebenszyklus und Sonder-Refresh ohne den Echtaccount-Abgleich zu verändern", () => {
    const app = read("client/src/App.tsx");
    const layout = read("client/src/components/Layout.tsx");
    const context = read("client/src/contexts/YearContext.tsx");

    expect(app).toContain("PLANNING_DATA_SYNC_INTERVAL_MS = 8_000");
    expect(app).toContain("if (!isAuthenticated) return;");
    expect(app).toContain('queryClient.refetchQueries({ type: "active" })');
    expect(layout).toContain("useOnlinePresence()");
    expect(layout).not.toMatch(/finishPublicDemo|endOnPageHide|sendBeacon|pagehide/);
    expect(layout).toContain('data-slot="readonly-access-notice"');
    expect(layout).toContain("myModuleAccess.data");
    expect(context).not.toContain("demotenant");
    expect(context).toContain("synchronizeTenant(nextTenantId)");
    expect(context).toContain('params.get("event")');
    expect(context).toContain('params.get("jahr")');
  });

  it("behält echte Klemmi-Führungen, persönliche Ansichten und Paketgrenzen bei", () => {
    const dashboard = read("client/src/pages/Dashboard.tsx");
    const helpers = read("client/src/pages/Helpers.tsx");
    const guide = read("client/src/components/KlemmiHelperGuide.tsx");
    const locations = read("client/src/pages/Locations.tsx");
    const security = read("client/src/pages/Security.tsx");

    expect(dashboard).toContain("steps={dashboardKlemmiSteps}");
    expect(dashboard).toContain('guideId="dashboard-personal"');
    expect(dashboard).toContain("if (isEventPass)");
    expect(dashboard).not.toMatch(/demoGuide|publicDemoKlemmiSteps|createPublicDemoDashboardKlemmiSteps/);
    expect(helpers).toContain("exportPdf.mutate({ helperId: helper.id })");
    expect(helpers).toContain("openWhatsAppDialog(helper)");
    expect(guide).toContain('playClip("helpers-opening")');
    expect(guide).toContain("getKlemmiFeatureContext");
    expect(locations).toContain('canWriteModule("locations")');
    expect(locations).toContain("canUseMapsGpx");
    expect(security).toContain("if (!isAdmin)");
    expect(security).toContain("<AuditCenter guideFocus={auditGuideFocus} />");
  });

  it("entfernt Demo-Datenschutzhinweise und die sichtbare wie gesprochene Demo-Empfehlung", () => {
    const legal = read("client/src/pages/PublicLegal.tsx");
    const intro = read("client/src/components/FirstLoginKlemmiIntro.tsx");
    const audio = read("client/src/lib/klemmiAudio.ts");

    expect(legal).not.toContain("Vereinsdemo");
    expect(legal).toContain("2.3 Vereinbarter Pilotzugang");
    expect(legal).toContain("5. Rechte betroffener Personen");
    expect(intro).toContain("KLEMMI_CO_ADMIN_TEXT");
    expect(intro).not.toContain("fiktive Vereinsdemo");
    expect(audio).not.toContain("probiere die fiktive Vereinsdemo");
    expect(audio).toContain('"first-login-intro": "20261103-no-demo-v1"');
    expect(audio).toContain('"first-login-co-admin": "20261103-no-demo-v1"');
  });
});
