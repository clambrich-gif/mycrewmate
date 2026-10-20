import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  requiredUpgradePackageForCapability,
  type ProductPackageId,
} from "../shared/product-packages";
import {
  createDashboardKlemmiSteps,
  createPublicDemoDashboardKlemmiSteps,
} from "../client/src/lib/dashboard-klemmi-tour";
import { getHelperGuideSteps } from "../client/src/components/KlemmiHelperGuide";
import {
  getPdfKlemmiSteps,
  getSecurityKlemmiSteps,
} from "../client/src/lib/klemmi-area-tours";
import {
  KLEMMI_CONTACTS_AUDIO_IDS,
  KLEMMI_CONTACTS_VOICE_PROFILE,
  KLEMMI_DONATIONS_AUDIO_IDS,
  KLEMMI_DONATIONS_VOICE_PROFILE,
  KLEMMI_HELPERS_AUDIO_IDS,
  KLEMMI_HELPERS_VOICE_PROFILE,
  KLEMMI_MATERIALS_AUDIO_IDS,
  KLEMMI_MATERIALS_VOICE_PROFILE,
  KLEMMI_POSTPROCESSING_AUDIO_IDS,
  KLEMMI_POSTPROCESSING_VOICE_PROFILE,
  KLEMMI_PLAN_AUDIO_IDS,
  KLEMMI_PLAN_VOICE_PROFILE,
  KLEMMI_PREPARATION_AUDIO_IDS,
  KLEMMI_PREPARATION_VOICE_PROFILE,
  KLEMMI_PUBLIC_DEMO_AUDIO_IDS,
  KLEMMI_PUBLIC_DEMO_VOICE_PROFILE,
  KLEMMI_AUDIO_VOICE_MANIFEST,
  KLEMMI_VOICE_PROFILE,
  klemmiAudioUrl,
} from "../client/src/lib/klemmiAudio";
import {
  createKlemmiSpeechRequest,
  KLEMMI_VOICE_PRODUCTION_CONFIG,
} from "../shared/klemmi-voice-production";
import { getKlemmiLocationGuideCopy } from "../client/src/lib/klemmi-location-guide";

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
    expect(dashboardTour).toContain('"map-locked-light" : "map-locked"');
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
      canUseChat: false,
      canUseDonations: false,
      currentPackageId: "event_pass",
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
    expect(accessSteps.find(step => step.key === "audit-files")).toMatchObject({
      title: "JSON-Sicherung im Event Pass verstehen",
      audioKey: "audit-files-event-pass",
    });

    const proAuditStep = getSecurityKlemmiSteps("pro").find(
      step => step.key === "audit-files"
    );
    expect(proAuditStep?.text).toContain("ab Pro – Excel-Module");
  });

  it("erklärt den Light-Umfang ohne unpassende Light-Upgrades", () => {
    const lightPdfSteps = getPdfKlemmiSteps({
      currentPackageId: "light",
      canManage: true,
    });
    expect(lightPdfSteps.some(step => step.key === "contacts-locked")).toBe(false);
    expect(lightPdfSteps.find(step => step.key === "config-light")).toMatchObject({
      audioKey: "config-light",
      title: "PDF-Vorlage im Light-Paket pflegen",
    });

    const lightSecuritySteps = getSecurityKlemmiSteps("light");
    expect(lightSecuritySteps.find(step => step.key === "accesses-list")).not.toMatchObject({
      selector: '[data-klemmi-target="security-accesses-locked"]',
    });
    expect(lightSecuritySteps.find(step => step.key === "audit-files")).toMatchObject({
      title: "Datei- und Import-Historie ab Pro",
      audioKey: "audit-files-light",
    });

    const lightDashboardSteps = createDashboardKlemmiSteps({
      hasEventPeriod: true,
      hasPriorityActions: true,
      hasDeadlines: true,
      hasHelpers: true,
      hasAssignments: true,
      hasContacts: true,
      hasMappableLocations: false,
      canUseMapsGpx: false,
      canUseChat: false,
      canUseDonations: false,
      currentPackageId: "light",
      detailsLayout: "side-by-side",
    });
    expect(lightDashboardSteps.find(step => step.key === "helpers-active")?.text).not.toContain(
      "Verpflegungsspenden"
    );
    expect(lightDashboardSteps.find(step => step.key === "map-locked")).toMatchObject({
      audioKey: "map-locked-light",
    });
  });

  it("erklärt Spenden und WhatsApp-Vorlagen im Helferbereich paketgenau", () => {
    for (const packageId of ["event_pass", "light"] as const) {
      const steps = getHelperGuideSteps(packageId);
      expect(steps.find(step => step.key === "donation")).toMatchObject({ title: "Spenden ab Pro verwalten", audioKey: "donation-locked" });
      expect(steps.find(step => step.key === "action-whatsapp")).toMatchObject({ title: "Direkt schreiben – Vorlagen ab Pro", audioKey: "action-whatsapp-locked" });
      expect(steps.find(step => step.key === "action-donation")).toMatchObject({ title: "Geschenk: Spenden ab Pro", audioKey: "action-donation-locked" });
    }
    const eventPassSteps = getHelperGuideSteps("event_pass");
    expect(eventPassSteps.find(step => step.key === "contact")).toMatchObject({ title: "Fest dem Hauptadministrator zugeordnet", audioKey: "contact-event-pass" });
    expect(eventPassSteps.find(step => step.key === "save")).toMatchObject({ title: "Helfer speichern – dann kann das Team planen", audioKey: "save-locked" });
    const proSteps = getHelperGuideSteps("pro");
    expect(proSteps.find(step => step.key === "donation")?.title).toBe("Spende direkt mit erfassen");
    expect(proSteps.find(step => step.key === "action-whatsapp")?.title).toBe("Nach vollständiger Planung per WhatsApp anfragen");
    const publicDemoSteps = getHelperGuideSteps("pro", true);
    expect(publicDemoSteps.find(step => step.key === "action-whatsapp")).toMatchObject({
      title: "WhatsApp in der Demo sichtbar, aber gesperrt",
      audioKey: "action-whatsapp-demo",
    });
    expect(publicDemoSteps.find(step => step.key === "action-pdf")).toMatchObject({
      title: "Persönliche PDF in der Demo sichtbar, aber gesperrt",
      audioKey: "action-pdf-demo",
    });
    expect(proSteps.find(step => step.key === "action-cancellation")).toMatchObject({
      title: "Bei Absage auf Nein stellen – nicht löschen",
      audioKey: "action-cancellation",
    });
  });

  it("erklärt Orte in Plan, Vorbereitung und Nachbereitung paketgenau", () => {
    for (const area of ["plan", "preparation", "postprocessing"] as const) {
      const eventPass = getKlemmiLocationGuideCopy(area, "event_pass");
      expect(eventPass.audioKey).toContain("event-pass");
      expect(eventPass.text).toContain("Event Pass");
      expect(eventPass.text).toContain("Karte");

      const light = getKlemmiLocationGuideCopy(area, "light");
      expect(light.audioKey).toContain("light");
      expect(light.text).toContain("ab Pro");

      for (const packageId of ["pro", "enterprise"] as const) {
        const premium = getKlemmiLocationGuideCopy(area, packageId);
        expect(premium.audioKey).toContain("pro");
        expect(premium.text).toContain("Pro und Enterprise");
      }
    }
  });

  it("ordnet Einsatzplan, Helfer-, Vereinsdemo-, Ansprechpartner-, Vor-, Nachbereitung, Material und Spenden verbindlich der Klemmi-Stimme zu", async () => {
    expect(KLEMMI_VOICE_PROFILE.voice).toBe("Achird");
    expect(KLEMMI_VOICE_PRODUCTION_CONFIG).toMatchObject({
      profileVersion: "2.0",
      voiceName: "Klemmi-Stimme",
      languageCode: "de-DE",
      style: "high pitch, bright, playful, animated",
      candidateCount: 3,
      primaryReference: {
        id: "klemmi-wetterbericht-referenz-b-plus-extrem-v1",
        fileName: "klemmi-wetterbericht-referenz-b-plus-extrem.wav",
      },
    });
    expect(KLEMMI_PLAN_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_PUBLIC_DEMO_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_CONTACTS_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_HELPERS_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_PREPARATION_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_POSTPROCESSING_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_MATERIALS_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_DONATIONS_VOICE_PROFILE.voice).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.voiceName
    );
    expect(KLEMMI_PLAN_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_PUBLIC_DEMO_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_CONTACTS_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_HELPERS_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_PREPARATION_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_POSTPROCESSING_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_MATERIALS_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(KLEMMI_DONATIONS_VOICE_PROFILE.generationStyle).toBe(
      KLEMMI_VOICE_PRODUCTION_CONFIG.style
    );
    expect(Object.keys(KLEMMI_AUDIO_VOICE_MANIFEST).length).toBeGreaterThan(0);
    expect(KLEMMI_PLAN_AUDIO_IDS.length).toBeGreaterThan(0);
    expect(KLEMMI_PLAN_AUDIO_IDS).toEqual(
      expect.arrayContaining(["plan-opening", "plan-shift-success"])
    );
    expect(KLEMMI_PUBLIC_DEMO_AUDIO_IDS.length).toBeGreaterThan(20);
    expect(KLEMMI_CONTACTS_AUDIO_IDS).toHaveLength(9);
    expect(KLEMMI_HELPERS_AUDIO_IDS).toHaveLength(23);
    expect(KLEMMI_PREPARATION_AUDIO_IDS).toHaveLength(12);
    expect(KLEMMI_POSTPROCESSING_AUDIO_IDS).toHaveLength(12);
    expect(KLEMMI_MATERIALS_AUDIO_IDS).toEqual([
      "materials-intro",
      "materials-name",
      "materials-details",
      "materials-responsible",
      "materials-save",
      "materials-complete",
    ]);
    expect(KLEMMI_DONATIONS_AUDIO_IDS).toEqual([
      "donations-opening",
      "donations-intro",
      "donations-donor",
      "donations-item",
      "donations-traits",
      "donations-save",
      "donations-overview",
      "donations-filters",
      "donations-outputs",
      "donations-complete",
      "donations-overview-save",
      "donations-overview-summary",
    ]);
    expect(klemmiAudioUrl("materials-intro")).toBe(
      "/api/klemmi/audio/materials-intro?v=20261020-klemmi-stimme-v2-material-intro-a-v1"
    );
    expect(klemmiAudioUrl("materials-name")).toBe(
      "/api/klemmi/audio/materials-name?v=20261020-klemmi-stimme-v2-material-name-c-v1"
    );
    expect(klemmiAudioUrl("materials-details")).toBe(
      "/api/klemmi/audio/materials-details?v=20261020-klemmi-stimme-v2-material-details-c-v1"
    );
    expect(klemmiAudioUrl("materials-responsible")).toBe(
      "/api/klemmi/audio/materials-responsible?v=20261020-klemmi-stimme-v2-material-responsible-c-v1"
    );
    expect(klemmiAudioUrl("materials-save")).toBe(
      "/api/klemmi/audio/materials-save?v=20261020-klemmi-stimme-v2-material-save-c-v1"
    );
    expect(klemmiAudioUrl("materials-complete")).toBe(
      "/api/klemmi/audio/materials-complete?v=20261020-klemmi-stimme-v2-material-complete-a-v1"
    );
    for (const [id, candidate] of [
      ["donations-opening", "c"],
      ["donations-intro", "c"],
      ["donations-donor", "c"],
      ["donations-item", "b"],
      ["donations-traits", "b"],
      ["donations-save", "a"],
      ["donations-overview", "a"],
      ["donations-filters", "a"],
      ["donations-outputs", "b"],
      ["donations-complete", "b"],
      ["donations-overview-save", "c"],
      ["donations-overview-summary", "b"],
    ] as const) {
      expect(klemmiAudioUrl(id)).toBe(
        `/api/klemmi/audio/${id}?v=20261020-klemmi-stimme-v2-${id}-${candidate}-v1`
      );
    }
    expect(
      KLEMMI_PLAN_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    for (const id of KLEMMI_PLAN_AUDIO_IDS) {
      const asset = await readFile(
        path.join(root, "server/assets/klemmi-voice", `${id}.mp3`)
      );
      expect(asset.byteLength).toBeGreaterThan(0);
    }
    expect(
      KLEMMI_PUBLIC_DEMO_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    expect(
      KLEMMI_CONTACTS_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    expect(
      KLEMMI_HELPERS_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    expect(
      KLEMMI_PREPARATION_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    expect(
      KLEMMI_POSTPROCESSING_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    expect(
      KLEMMI_MATERIALS_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    expect(
      KLEMMI_DONATIONS_AUDIO_IDS.every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id].voice === "Klemmi-Stimme"
      )
    ).toBe(true);
    for (const id of KLEMMI_PUBLIC_DEMO_AUDIO_IDS) {
      const asset = await readFile(
        path.join(root, "server/assets/klemmi-voice", `${id}.mp3`)
      );
      expect(asset.byteLength).toBeGreaterThan(0);
    }
    for (const id of KLEMMI_CONTACTS_AUDIO_IDS) {
      const asset = await readFile(
        path.join(root, "server/assets/klemmi-voice", `${id}.mp3`)
      );
      expect(asset.byteLength).toBeGreaterThan(0);
    }
    for (const id of KLEMMI_HELPERS_AUDIO_IDS) {
      const asset = await readFile(
        path.join(root, "server/assets/klemmi-voice", `${id}.mp3`)
      );
      expect(asset.byteLength).toBeGreaterThan(0);
    }
    for (const id of [
      ...KLEMMI_PREPARATION_AUDIO_IDS,
      ...KLEMMI_POSTPROCESSING_AUDIO_IDS,
      ...KLEMMI_MATERIALS_AUDIO_IDS,
      ...KLEMMI_DONATIONS_AUDIO_IDS,
    ]) {
      const asset = await readFile(
        path.join(root, "server/assets/klemmi-voice", `${id}.mp3`)
      );
      expect(asset.byteLength).toBeGreaterThan(0);
    }

    const publicDemoAudioIds = new Set<string>();
    const publicDemoAudioIdSet = new Set<string>(KLEMMI_PUBLIC_DEMO_AUDIO_IDS);
    const contactsAudioIdSet = new Set<string>(KLEMMI_CONTACTS_AUDIO_IDS);
    const helpersAudioIdSet = new Set<string>(KLEMMI_HELPERS_AUDIO_IDS);
    const donationsAudioIdSet = new Set<string>(KLEMMI_DONATIONS_AUDIO_IDS);
    for (const packageId of ["event_pass", "light", "pro"] as const) {
      for (const step of createPublicDemoDashboardKlemmiSteps({
        hasEventPeriod: true,
        hasPriorityActions: true,
        hasHelpers: true,
        canUseMapsGpx: packageId === "pro",
        canUseDonations: packageId === "pro",
        currentPackageId: packageId,
      })) {
        publicDemoAudioIds.add(`dashboard-${step.audioKey ?? step.key}`);
      }
      for (const step of getHelperGuideSteps(packageId, true)) {
        publicDemoAudioIds.add(`helpers-${step.audioKey ?? step.key}`);
      }
    }
    publicDemoAudioIds.add("public-demo-opening");
    expect(
      [...publicDemoAudioIds].every(id => publicDemoAudioIdSet.has(id))
    ).toBe(true);

    const realHelpersAudioIds = new Set<string>(["helpers-opening"]);
    for (const packageId of ["event_pass", "light", "pro", "enterprise"] as const) {
      for (const step of getHelperGuideSteps(packageId)) {
        realHelpersAudioIds.add(`helpers-${step.audioKey ?? step.key}`);
      }
    }
    expect(
      [...realHelpersAudioIds].every(id => helpersAudioIdSet.has(id))
    ).toBe(true);
    expect(
      [...realHelpersAudioIds].every(
        id => KLEMMI_AUDIO_VOICE_MANIFEST[id as keyof typeof KLEMMI_AUDIO_VOICE_MANIFEST].voice === "Klemmi-Stimme"
      )
    ).toBe(true);

    expect(
      Object.entries(KLEMMI_AUDIO_VOICE_MANIFEST)
        .filter(
          ([id]) =>
            !id.startsWith("plan-") &&
            !publicDemoAudioIdSet.has(id) &&
            !contactsAudioIdSet.has(id) &&
            !helpersAudioIdSet.has(id) &&
            !donationsAudioIdSet.has(id) &&
            !KLEMMI_PREPARATION_AUDIO_IDS.includes(id as keyof typeof KLEMMI_AUDIO_VOICE_MANIFEST) &&
            !KLEMMI_POSTPROCESSING_AUDIO_IDS.includes(id as keyof typeof KLEMMI_AUDIO_VOICE_MANIFEST) &&
            !KLEMMI_MATERIALS_AUDIO_IDS.includes(id as keyof typeof KLEMMI_AUDIO_VOICE_MANIFEST)
        )
        .every(([, entry]) => entry.voice === "Achird")
    ).toBe(true);
  });

  it("baut künftige Klemmi-Stimmen-Aufträge stets mit der verbindlichen hellen Stilvorgabe", () => {
    expect(createKlemmiSpeechRequest("  Hallo, ich bin Klemmi.  ")).toEqual({
      voice_name: KLEMMI_VOICE_PRODUCTION_CONFIG.providerVoiceName,
      language_code: "de-DE",
      turns: [
        {
          text: "Hallo, ich bin Klemmi.",
          style: "high pitch, bright, playful, animated",
        },
      ],
    });
    expect(() => createKlemmiSpeechRequest(" ")).toThrow(
      "Klemmi-Sprechtext darf nicht leer sein."
    );
  });

  it("behält die Einsatzplanung in allen Produktstufen als Kernfunktion frei", async () => {
    const plan = await source("client/src/pages/Plan.tsx");
    expect(plan).toContain("Den Einsatzplan von Anfang bis Ende verstehen");
    expect(plan).not.toContain("Einsatzplan ab Light");
    expect(plan).not.toContain("Einsatzplan ab Pro");
  });
});
