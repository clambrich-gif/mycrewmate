import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  requiredUpgradePackageForCapability,
  type ProductPackageId,
} from "../shared/product-packages";
import { createDashboardKlemmiSteps } from "../client/src/lib/dashboard-klemmi-tour";
import { getSecurityKlemmiSteps } from "../client/src/lib/klemmi-area-tours";

const root = process.cwd();
const source = (relativePath: string) =>
  readFile(path.join(root, relativePath), "utf8");

describe("kontextabhängige Klemmi-Paketgrenzen", () => {
  it("leitet jede Hinweisstufe aus den zentralen, serverseitig genutzten Capabilities ab", () => {
    const expectations: Array<
      [
        ProductPackageId,
        Parameters<typeof requiredUpgradePackageForCapability>[1],
        ProductPackageId,
      ]
    > = [
      ["event_pass", "personal_accesses", "light"],
      ["event_pass", "contacts", "light"],
      ["event_pass", "custom_branding", "pro"],
      ["light", "custom_branding", "pro"],
      ["event_pass", "whatsapp_templates", "pro"],
      ["light", "whatsapp_templates", "pro"],
      ["event_pass", "donations", "pro"],
    ];

    for (const [productPackage, capability, expected] of expectations) {
      expect(
        requiredUpgradePackageForCapability(productPackage, capability)
      ).toBe(expected);
    }
  });

  it("hinterlegt Erklärungen und verfügbare Alternativen zentral", async () => {
    const context = await source("client/src/lib/klemmi-feature-context.ts");
    expect(context).toContain("requiredUpgradePackageForCapability");
    expect(context).toContain("planning_team_accesses");
    expect(context).toContain("contact_pdf_overviews");
    expect(context).toContain("custom_pdf_branding");
    expect(context).toContain("whatsapp_templates");
    expect(context).toContain("Der direkte WhatsApp-Kontakt bleibt verfügbar");
    expect(context).toContain(
      "Helfer-PDFs und gefilterte Einsatzpläne bleiben weiterhin direkt nutzbar"
    );
  });

  it("erklärt PDF- und Sicherheitsgrenzen nur im jeweiligen Paketkontext", async () => {
    const [tours, pdf, security, helperGuide, accessManager] = await Promise.all([
      source("client/src/lib/klemmi-area-tours.ts"),
      source("client/src/pages/PdfExport.tsx"),
      source("client/src/pages/Security.tsx"),
      source("client/src/components/KlemmiUpgradeDialog.tsx"),
      source("client/src/components/PlanningTeamAccessManager.tsx"),
    ]);

    expect(tours).toContain("getPdfKlemmiSteps");
    expect(tours).toContain('currentPackageId === "event_pass"');
    expect(tours).toContain("Ansprechpartner-Übersichten ab Light");
    expect(tours).toContain("PDF-Vorlage mit klaren Paketgrenzen");
    expect(tours).toContain("getSecurityKlemmiSteps");
    expect(tours).toContain("Planungsteam-Zugänge ab Light");
    expect(tours).toContain("EVENT_PASS_ACCESS_STEP_COPY");
    expect(tours).toContain('audioKey: "accesses-filter-locked"');
    expect(tours).toContain('audioKey: "accesses-events-locked"');
    expect(accessManager).toContain('data-klemmi-target="security-accesses-locked"');
    expect(pdf).toContain("getPdfKlemmiSteps({ currentPackageId, canManage })");
    expect(security).toContain("getSecurityKlemmiSteps(currentPackageId)");
    expect(helperGuide).toContain("getKlemmiFeatureContext");
  });

  it("erklärt die Pro-Standortkarte im Event Pass sichtbar und hörbar", async () => {
    const [dashboardTour, dashboard, audio] = await Promise.all([
      source("client/src/lib/dashboard-klemmi-tour.ts"),
      source("client/src/pages/Dashboard.tsx"),
      source("client/src/lib/klemmiAudio.ts"),
    ]);

    expect(dashboardTour).toContain("canUseMapsGpx");
    expect(dashboardTour).toContain('key: "map-locked"');
    expect(dashboardTour).toContain('audioKey: "map-locked"');
    expect(dashboardTour).toContain("allowMissingTarget: true");
    expect(dashboard).toContain("canUseMapsGpx,");
    expect(audio).toContain('"dashboard-map-locked"');
  });

  it("liefert für Event Pass die hörbaren Hinweise statt unsichtbarer Zugangs- und Kartenfelder", () => {
    const mapStep = createDashboardKlemmiSteps({
      hasEventPeriod: true,
      hasPriorityActions: true,
      hasDeadlines: true,
      hasHelpers: true,
      hasAssignments: true,
      hasContacts: true,
      hasMappableLocations: false,
      canUseMapsGpx: false,
      detailsLayout: "stacked",
    }).at(-1);
    expect(mapStep).toMatchObject({
      key: "map-locked",
      audioKey: "map-locked",
      allowMissingTarget: true,
    });

    const accessSteps = getSecurityKlemmiSteps("event_pass");
    const expectedLockedSteps = [
      "accesses-filter",
      "accesses-list",
      "accesses-create",
      "accesses-identity",
      "accesses-rights",
      "accesses-coadmin",
      "accesses-events",
    ];
    for (const key of expectedLockedSteps) {
      expect(accessSteps.find(step => step.key === key)).toMatchObject({
        selector: '[data-klemmi-target="security-accesses-locked"]',
        allowMissingTarget: true,
      });
    }
  });

  it("behält die Einsatzplanung in allen Produktstufen als Kernfunktion frei", async () => {
    const plan = await source("client/src/pages/Plan.tsx");
    expect(plan).toContain("Den Einsatzplan von Anfang bis Ende verstehen");
    expect(plan).not.toContain("Einsatzplan ab Light");
    expect(plan).not.toContain("Einsatzplan ab Pro");
  });
});
