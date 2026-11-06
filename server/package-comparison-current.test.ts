import {
  createElement,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PRODUCT_PACKAGE_ENTITLEMENTS,
  PRODUCT_PACKAGE_IDS,
  productAllowsCapability,
  type ProductCapability,
  type ProductPackageId,
} from "../shared/product-packages";

// Rendering bleibt rein: keine Authentifizierung, API, Datenbank oder Audio.
vi.mock("@/hooks/useKlemmiVoice", () => ({
  useKlemmiVoice: () => ({
    cancel: vi.fn(),
    isSpeaking: false,
    muted: true,
    speak: vi.fn(),
  }),
}));
vi.mock("@/components/KlemmiMascot", () => ({
  KlemmiMascot: () => null,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    size: _size,
    variant: _variant,
    ...props
  }: {
    asChild?: boolean;
    children: ReactNode;
    size?: string;
    variant?: string;
  }) =>
    asChild
      ? cloneElement(children as ReactElement, props)
      : createElement("button", props, children),
}));

import {
  PACKAGE_COMPARISON_ROWS,
  PackageComparisonSection,
} from "../client/src/components/PackageComparisonSection";

const existingCapabilities = [
  "Veranstaltungsumfang",
  "Helfer & Schichten",
  "Persönliche Teamzugänge",
  "Vorbereitung & Nachbereitung",
  "Ansprechpartner & Orte",
  "Materialplanung",
  "Spenden & Finanzen",
  "Karte, GPS & GPX-Strecken",
  "Chat, WhatsApp-Vorlagen & PDF",
  "Schutz, Protokolle & Rechte",
];

const addedCapabilities = [
  {
    label: "Belege, Rechnungen & Dokumente",
    capability: "document_attachments",
  },
  { label: "JSON-Sicherung", capability: "event_backup" },
  { label: "Excel-Import & -Export", capability: "excel" },
  { label: "Optionale Altersanzeige bei Helfern", capability: "helper_age" },
  {
    label: "Team-Notizen per E-Mail / WhatsApp weitergeben",
    capability: "team_note_forwarding",
  },
] satisfies Array<{ label: string; capability: ProductCapability }>;

function rowFor(capability: string) {
  const row = PACKAGE_COMPARISON_ROWS.find(
    row => row.capability === capability
  );
  if (!row) throw new Error(`Vergleichszeile fehlt: ${capability}`);
  return row;
}

function textOf(markup: string) {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function renderComparison(currentPackageId?: ProductPackageId) {
  return renderToStaticMarkup(
    createElement(PackageComparisonSection, {
      sectionId: currentPackageId ? undefined : "vergleich",
      currentPackageId,
      embedded: Boolean(currentPackageId),
    })
  );
}

describe("aktueller Paketvergleich: tatsächliche Grenzen und Funktionen", () => {
  it("behält die bisherigen zehn Zeilen und ergänzt exakt fünf eindeutige Zeilen", () => {
    const labels = PACKAGE_COMPARISON_ROWS.map(row => row.capability);
    expect(labels).toHaveLength(15);
    expect(new Set(labels).size).toBe(15);
    expect(labels).toEqual(
      expect.arrayContaining([
        ...existingCapabilities,
        ...addedCapabilities.map(row => row.label),
      ])
    );
  });

  it.each(addedCapabilities.filter(row => row.capability !== "event_backup"))(
    "zeigt $label ausschließlich gemäß der gemeinsamen Capability-Matrix",
    ({ label, capability }) => {
      const row = rowFor(label);
      for (const packageId of PRODUCT_PACKAGE_IDS) {
        const allowed = productAllowsCapability(packageId, capability);
        expect(allowed).toBe(packageId === "pro" || packageId === "enterprise");
        expect(row[packageId].state).toBe(allowed ? "included" : "notIncluded");
      }
    }
  );

  it("bietet JSON in allen Paketen an und unterscheidet Event- und Projektstand-Labels", () => {
    const row = rowFor("JSON-Sicherung");
    for (const packageId of PRODUCT_PACKAGE_IDS) {
      const canBackup =
        productAllowsCapability(packageId, "event_backup") ||
        productAllowsCapability(packageId, "project_backup");
      expect(canBackup).toBe(true);
      expect(row[packageId].state).not.toBe("notIncluded");
      expect(row[packageId].label).toContain("JSON");
      expect(row[packageId].label).toMatch(/Gewähltes|gewählten/);
      expect(row[packageId].label).not.toMatch(
        /Gesamtprojekt|alle Veranstaltungen/
      );
    }
    expect(row.event_pass).toEqual({
      state: "limited",
      label: "Gewähltes Event (JSON)",
    });
    expect(row.light).toEqual({
      state: "limited",
      label: "Gewähltes Haupt-Event (JSON)",
    });
    expect(row.pro).toEqual({
      state: "included",
      label: "Projektstand des gewählten Events (JSON)",
    });
    expect(row.enterprise).toEqual(row.pro);
    expect(row.description).toBe(
      "Planungsdaten der aktuell gewählten Veranstaltung sichern."
    );
    expect(productAllowsCapability("event_pass", "project_backup")).toBe(false);
    expect(productAllowsCapability("light", "project_backup")).toBe(false);
    expect(productAllowsCapability("pro", "project_backup")).toBe(true);
    expect(productAllowsCapability("enterprise", "project_backup")).toBe(true);
  });

  it("nennt die exakten Event-, Helfer- und persönlichen Zugangslimits", () => {
    const events = rowFor("Veranstaltungsumfang");
    const helpers = rowFor("Helfer & Schichten");
    const accesses = rowFor("Persönliche Teamzugänge");
    for (const packageId of PRODUCT_PACKAGE_IDS) {
      const limits = PRODUCT_PACKAGE_ENTITLEMENTS[packageId];
      for (const [row, limit] of [
        [events, limits.maxEventsPerYear],
        [helpers, limits.maxHelpersPerEvent],
        [accesses, limits.maxPersonalPlanningAccesses],
      ] as const) {
        if (limit === null) {
          expect(row[packageId]).toEqual({
            state: "included",
            label: "Unbegrenzt",
          });
        } else if (limit === 0) {
          expect(row[packageId]).toEqual({ state: "notIncluded" });
        } else {
          expect(row[packageId].state).toBe("limited");
          expect(row[packageId].label?.match(/\d+/g)).toEqual([String(limit)]);
        }
      }
    }
    expect(events.event_pass.label).toBe("1 Event");
    expect(events.light.label).toBe("1 Haupt-Event / Veranstaltungsjahr");
    expect(events.pro.label).toBe("bis 5 Events / Veranstaltungsjahr");
    expect(helpers.event_pass.label).toBe("bis 50 Helfer");
    expect(helpers.light.label).toBe("bis 150 Helfer");
    expect(helpers.pro.label).toBe("bis 350 Helfer / Event");
    expect(accesses.pro.label).toBe("bis 14 Planungszugänge + Co-Admins");
    expect(accesses.description).toContain("Co-Admins nicht zu den 14");
  });

  it("bildet Ansprechpartner und Orte mit den Light-Limits und unbegrenztem Pro korrekt ab", () => {
    const row = rowFor("Ansprechpartner & Orte");
    for (const packageId of PRODUCT_PACKAGE_IDS) {
      const limits = PRODUCT_PACKAGE_ENTITLEMENTS[packageId];
      const allowed =
        productAllowsCapability(packageId, "contacts") &&
        productAllowsCapability(packageId, "locations");
      if (!allowed) {
        expect(row[packageId].state).toBe("notIncluded");
      } else if (
        limits.maxContactsPerEvent === null &&
        limits.maxLocationsPerEvent === null
      ) {
        expect(row[packageId]).toEqual({
          state: "included",
          label: "Unbegrenzt",
        });
      } else {
        expect(row[packageId]).toEqual({
          state: "limited",
          label: `${limits.maxContactsPerEvent} Ansprechpartner · ${limits.maxLocationsPerEvent} Orte`,
        });
      }
    }
    expect(row.light.label).toBe("50 Ansprechpartner · 25 Orte");
  });

  it("erhält die tatsächlichen Funktionsabstufungen der bestehenden Planungszeilen", () => {
    const mappings: Array<{
      label: string;
      capabilities: ProductCapability[];
    }> = [
      {
        label: "Vorbereitung & Nachbereitung",
        capabilities: ["preparation", "postprocessing"],
      },
      { label: "Materialplanung", capabilities: ["materials"] },
      { label: "Spenden & Finanzen", capabilities: ["donations", "finances"] },
      { label: "Karte, GPS & GPX-Strecken", capabilities: ["maps_gpx"] },
      {
        label: "Chat, WhatsApp-Vorlagen & PDF",
        capabilities: ["chat", "whatsapp_templates", "pdf"],
      },
    ];
    for (const { label, capabilities } of mappings) {
      const row = rowFor(label);
      for (const packageId of PRODUCT_PACKAGE_IDS) {
        const allowed = capabilities.map(capability =>
          productAllowsCapability(packageId, capability)
        );
        const expectedState = allowed.every(Boolean)
          ? "included"
          : allowed.some(Boolean)
            ? "limited"
            : "notIncluded";
        expect(row[packageId].state).toBe(expectedState);
      }
    }
    expect(rowFor("Vorbereitung & Nachbereitung").event_pass.label).toBe(
      "Vorbereitung"
    );
  });

  it("kennzeichnet Enterprise-Kernfunktionen als enthalten statt als individuelle Sonderleistung", () => {
    for (const row of PACKAGE_COMPARISON_ROWS) {
      expect(row.enterprise.state).toBe("included");
      expect(row.enterprise.label ?? "Enthalten").not.toMatch(
        /nach Bedarf|Vereinbarung|^individuell$|erweiterbar|Sonderprozesse/i
      );
    }
  });
});

describe("aktueller Paketvergleich: reine öffentliche und eingebettete Darstellung", () => {
  it("rendert alle 15 Zeilen mit vier Paketspalten und verständlichem Ausschluss", () => {
    const markup = renderComparison();
    const body = markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    const renderedRows = body.match(/<tr\b[\s\S]*?<\/tr>/g) ?? [];
    expect(renderedRows).toHaveLength(15);
    expect(body.match(/data-package-comparison-cell=/g)).toHaveLength(60);
    for (const [index, row] of PACKAGE_COMPARISON_ROWS.entries()) {
      const rowMarkup = renderedRows[index];
      expect(textOf(rowMarkup)).toContain(row.capability);
      if (row.description) expect(textOf(rowMarkup)).toContain(row.description);
      const cells = rowMarkup.match(/<td\b[\s\S]*?<\/td>/g) ?? [];
      expect(cells).toHaveLength(4);
      for (const [packageIndex, packageId] of PRODUCT_PACKAGE_IDS.entries()) {
        const cell = row[packageId];
        expect(cells[packageIndex]).toContain(
          `data-package-comparison-cell="${packageId}"`
        );
        expect(textOf(cells[packageIndex])).toBe(
          cell.state === "notIncluded"
            ? "Nicht enthalten"
            : (cell.label ?? "Enthalten")
        );
      }
    }
  });

  it("erhält horizontalen Scrollbereich, Tastaturbedienbarkeit und öffentliche Wiederverwendung", () => {
    const markup = renderComparison();
    expect(markup).toContain('id="vergleich"');
    expect(markup).toMatch(/class="[^"]*overflow-x-auto/);
    expect(markup).toContain('role="region"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-describedby="comparison-swipe-hint"');
    expect(markup).toContain('id="comparison-swipe-hint"');
    expect(markup).toContain("min-w-[940px]");
    expect(markup).toContain(
      'aria-label="Tarifvergleich: mit den Pfeiltasten horizontal durch die Pakete navigieren"'
    );
    expect(textOf(markup)).toContain(
      "Auf dem Smartphone nach links und rechts wischen"
    );
    expect(markup).not.toContain("data-klemmi-package-tip");
    expect(markup).not.toContain("data-upgrade-request");
  });

  it.each(PRODUCT_PACKAGE_IDS)(
    "nutzt dieselben 15 Zeilen in der eingebetteten %s-Ansicht",
    packageId => {
      const markup = renderComparison(packageId);
      expect(markup.match(/data-package-comparison-cell=/g)).toHaveLength(60);
      expect(markup).toContain(`data-package-comparison-header="${packageId}"`);
      expect(markup).toContain("ring-orange-500");
      expect(markup).toContain("py-8 sm:py-10");
      for (const row of addedCapabilities)
        expect(textOf(markup)).toContain(row.label);
    }
  );

  it("grenzt Dateisicherung, bewusste Weitergabe und Enterprise-Zusatzleistungen im Footer ab", () => {
    const markup = renderComparison();
    const footer = markup.match(
      /<div[^>]*data-package-comparison-notes[^>]*>([\s\S]*?)<\/div>/
    )?.[1];
    expect(footer).toBeDefined();
    const text = textOf(footer!);
    expect(text).toContain(
      "JSON und Excel sichern Planungsdaten, nicht die hochgeladenen Dateien. Finanzbelege lassen sich getrennt als ZIP sichern."
    );
    expect(text).toContain("nur nach eigener Aktion");
    expect(text).toContain("E-Mails werden bewusst ausgelöst");
    expect(text).toContain("WhatsApp bereitet einzelne Chats vor");
    expect(text).toContain(
      "du sendest dort selbst, kein automatischer WhatsApp-Versand"
    );
    expect(text).not.toMatch(
      /WhatsApp (sendet|versendet) automatisch|automatisch (gesendet|versendet)|automatischer Massenversand/i
    );
    expect(text).toContain(
      "Enterprise enthält die aufgeführten Kernfunktionen"
    );
    expect(text).toContain("gesondert nach Vereinbarung");
    expect(text).toContain(
      "individuelle Entwicklungsleistungen sind nicht pauschal enthalten"
    );
    expect(rowFor("Belege, Rechnungen & Dokumente").description).toContain(
      "Vor-/Nachbereitung und Finanzen"
    );
    expect(rowFor("Belege, Rechnungen & Dokumente").description).toContain(
      "persönlicher Berechtigung"
    );
    expect(
      rowFor("Team-Notizen per E-Mail / WhatsApp weitergeben").description
    ).toContain("Administratoren");
  });
});
