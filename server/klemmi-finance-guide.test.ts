import { createElement, type ComponentProps } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KlemmiSurfaceGuide } from "../client/src/components/KlemmiSurfaceGuide";
import {
  isKlemmiAudioId,
  KLEMMI_AUDIO_SCRIPTS,
} from "../client/src/lib/klemmiAudio";

type GuideProps = ComponentProps<typeof KlemmiSurfaceGuide>;

const state = vi.hoisted(() => ({
  canRead: true,
  canWrite: false,
  packageId: "pro",
  authLoading: false,
  rightsLoading: false,
  captureGuide: vi.fn(),
  listQuery: vi.fn(),
  receiptsQuery: vi.fn(),
  payersQuery: vi.fn(),
  mutate: vi.fn(),
  categoryDialog: vi.fn(),
  notebookDialog: vi.fn(),
  receiptsDialog: vi.fn(),
  rows: [
    {
      id: 42,
      category: "Synthetische Finanzkategorie",
      income: 4500,
      expense: 1200,
      note: "Synthetische Notiz",
    },
  ],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ loading: state.authLoading }),
}));
vi.mock("@/contexts/YearContext", () => ({
  useEventYear: () => ({ year: 2026, eventId: 10 }),
}));
vi.mock("@/hooks/useTenantAdministration", () => ({
  useTenantAdministration: () => ({
    isTenantAdmin: false,
    canReadModule: () => state.canRead,
    canWriteModule: () => state.canWrite,
    moduleAccess: { isLoading: state.rightsLoading },
    administrativeContext: { isLoading: state.rightsLoading },
  }),
}));
vi.mock("@/components/KlemmiSurfaceGuide", () => ({
  KlemmiSurfaceGuide: (props: GuideProps) => {
    state.captureGuide(props);
    return null;
  },
}));
vi.mock("@/components/ResetAreaButton", () => ({
  ResetAreaButton: () => null,
}));
vi.mock("@/components/FinanceCategoryDialog", () => ({
  FinanceCategoryDialog: (props: unknown) => {
    state.categoryDialog(props);
    return null;
  },
}));
vi.mock("@/components/FinanceNotebookDialog", () => ({
  FinanceNotebookDialog: (props: unknown) => {
    state.notebookDialog(props);
    return null;
  },
}));
vi.mock("@/components/FinanceReceiptsDialog", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/components/FinanceReceiptsDialog")>();
  return {
    ...actual,
    FinanceReceiptsDialog: (props: unknown) => {
      state.receiptsDialog(props);
      return null;
    },
  };
});
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutateAsync: state.mutate }) };
  return {
    trpc: {
      useUtils: () => ({
        finances: { list: { invalidate: vi.fn() } },
        dashboard: { invalidate: vi.fn() },
      }),
      tenantProduct: {
        current: { useQuery: () => ({ data: { packageId: state.packageId } }) },
      },
      finances: {
        list: {
          useQuery: (input: unknown, options: unknown) => {
            state.listQuery(input, options);
            return {
              data: state.rows,
              isLoading: false,
              isFetching: false,
              error: null,
            };
          },
        },
        remove: mutation,
        exportReceipts: mutation,
        receipts: { useQuery: state.receiptsQuery },
        payers: { useQuery: state.payersQuery },
      },
    },
  };
});

import Finances from "../client/src/pages/Finances";

const EXPECTED_FINANCE_SCRIPTS = {
  "finances-intro":
    "Finanzen einfach im Blick behalten. Hier siehst du Einnahmen und Ausgaben pro Kategorie. Der Saldo wird automatisch berechnet. Ich zeige dir die Übersicht und die passenden Dialoge, ohne Daten zu verändern.",
  "finances-category":
    "Neue Kategorie im Dialog. Über Neue Kategorie öffnest du das Eingabefenster. Dort trägst du die Kategorie, Einnahmen, Ausgaben und bei Bedarf eine erste Notiz ein. Erst Speichern übernimmt deine Angaben. Bestehende Kategorien änderst du über Bearbeiten.",
  "finances-notebook":
    "Absprachen im Notizbuch festhalten. Über Notizbuch öffnest du den Verlauf einer Kategorie. Neue Einträge werden mit Datum, Uhrzeit und deinem Namen ergänzt. Bisherige Notizen bleiben erhalten. So bleiben wichtige Absprachen nachvollziehbar.",
  "finances-notebook-read":
    "Notizen zur Kategorie ansehen. Über Notizbuch öffnest du den bisherigen Verlauf. Mit deinem Lesezugriff kannst du die Notizen ansehen, aber keine neuen Einträge ergänzen oder Finanzwerte ändern.",
  "finances-receipts":
    "Belege und Dokumente gibt es ab Pro. Je nach Berechtigung kannst du sie hochladen, anschauen oder bearbeiten.",
  "finances-balance":
    "Den Saldo gemeinsam prüfen. Ganz unten werden Einnahmen und Ausgaben aller Kategorien zusammengefasst. Die Differenz zeigt den aktuellen finanziellen Stand. Rechnungsbelege bleiben davon getrennt.",
  "finances-complete":
    "Finanzen im Überblick! Du kennst jetzt die Kategorien, das Notizbuch, die getrennten Rechnungsbelege und den Saldo. Es wurden keine Daten verändert.",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  state.canRead = true;
  state.canWrite = false;
  state.packageId = "pro";
  state.authLoading = false;
  state.rightsLoading = false;
  state.rows = [
    {
      id: 42,
      category: "Synthetische Finanzkategorie",
      income: 4500,
      expense: 1200,
      note: "Synthetische Notiz",
    },
  ];
});

function renderGuide() {
  const html = renderToStaticMarkup(createElement(Finances));
  expect(state.captureGuide).toHaveBeenCalledOnce();
  const guide = state.captureGuide.mock.calls[0][0] as GuideProps;
  return { html, guide };
}

function expectExplanationOnly(guide: GuideProps) {
  expect(guide.successSignal).toBeNull();
  for (const prop of [
    "onStepAction",
    "onStepChange",
    "onOpenChange",
    "autoStart",
  ] as const)
    expect(guide[prop]).toBeUndefined();
  for (const step of guide.steps) {
    expect(step.waitsForSuccess).not.toBe(true);
    expect(step.advancesOnSignal).not.toBe(true);
    expect(step.completeOnSuccess).not.toBe(true);
  }
  expect(state.categoryDialog).not.toHaveBeenCalled();
  expect(state.notebookDialog).not.toHaveBeenCalled();
  expect(state.receiptsDialog).not.toHaveBeenCalled();
  expect(state.receiptsQuery).not.toHaveBeenCalled();
  expect(state.payersQuery).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
}

describe("Klemmi finance guide (synthetic fixtures only)", () => {
  it.each([
    { canWrite: false, empty: false },
    { canWrite: false, empty: true },
    { canWrite: true, empty: false },
    { canWrite: true, empty: true },
  ])(
    "uses the active audio contract for canWrite=$canWrite, empty=$empty",
    ({ canWrite, empty }) => {
      state.canWrite = canWrite;
      if (empty) state.rows = [];
      const { html, guide } = renderGuide();
      expect(guide.guideId).toBe("finances");
      expect(guide.audioGuideId).toBe("finances");
      expect(guide.voiceMuted).toBeUndefined();
      expect(guide.introText).toBe(KLEMMI_AUDIO_SCRIPTS["finances-intro"]);
      expect(guide.completionText).toBe(
        KLEMMI_AUDIO_SCRIPTS["finances-complete"]
      );
      expect(guide.steps.map(step => step.key)).toEqual(
        canWrite
          ? ["intro", "dialog", "notebook", "receipts", "balance"]
          : ["intro", "notebook", "receipts", "balance"]
      );
      const ids = guide.steps.map(
        step => `${guide.audioGuideId}-${step.audioKey ?? step.key}`
      );
      expect(ids).toEqual([
        "finances-intro",
        ...(canWrite ? ["finances-category"] : []),
        canWrite ? "finances-notebook" : "finances-notebook-read",
        "finances-receipts",
        "finances-balance",
      ]);
      for (const [index, id] of ids.entries()) {
        expect(guide.steps[index].text).toBe(
          (KLEMMI_AUDIO_SCRIPTS as Record<string, string>)[id]
        );
      }
      expect(
        isKlemmiAudioId(
          `${guide.audioGuideId}-${guide.completionAudioKey ?? "complete"}`
        )
      ).toBe(true);
      expect(guide.steps.find(step => step.key === "receipts")?.selector).toBe(
        canWrite && !empty
          ? '[data-klemmi-target="finances-receipts"]'
          : '[data-klemmi-target="finances-values"]'
      );
      const receiptButtons =
        html.match(
          /<button\b[^>]*data-klemmi-target="finances-receipts"[^>]*>/g
        ) ?? [];
      // Both responsive renderings expose the same writer-only action anchor.
      expect(receiptButtons).toHaveLength(canWrite && !empty ? 2 : 0);
      expect(html).toContain('data-klemmi-target="finances-values"');
      expect(html).toContain('data-klemmi-target="finances-balance"');
      expect(state.listQuery).toHaveBeenCalledWith(undefined, {
        enabled: true,
        retry: false,
      });
      expectExplanationOnly(guide);
    }
  );

  it("explains receipt restrictions to read-only users without exposing receipt controls", () => {
    const { html, guide } = renderGuide();
    expectExplanationOnly(guide);
    const notebook = guide.steps.find(step => step.key === "notebook");
    expect(notebook?.audioKey).toBe("notebook-read");
    expect(notebook?.text).toContain(
      "keine neuen Einträge ergänzen oder Finanzwerte ändern"
    );
    const receipts = guide.steps.find(step => step.key === "receipts");
    expect(receipts?.text).toBe(EXPECTED_FINANCE_SCRIPTS["finances-receipts"]);
    expect(receipts?.text).not.toMatch(/Schreibrecht|ZIP|heruntergeladen/);
    expect(html).toContain("Notizbuch");
    expect(html).not.toContain("Belege");
    expect(html).not.toContain("Neue Kategorie");
    expect(html).not.toContain("Bearbeiten");
    expectExplanationOnly(guide);
  });

  it("explains the category dialog, appended notebook history and separate ZIP backup to writers", () => {
    state.canWrite = true;
    const { html, guide } = renderGuide();
    expectExplanationOnly(guide);
    expect(guide.steps.find(step => step.key === "dialog")).toMatchObject({
      audioKey: "category",
      selector: '[data-klemmi-target="finances-category"]',
      text: EXPECTED_FINANCE_SCRIPTS["finances-category"],
    });
    expect(guide.steps.find(step => step.key === "notebook")).toMatchObject({
      audioKey: "notebook",
      text: EXPECTED_FINANCE_SCRIPTS["finances-notebook"],
      action: "Belege erklären",
    });
    expect(guide.steps.find(step => step.key === "receipts")?.text).toBe(
      EXPECTED_FINANCE_SCRIPTS["finances-receipts"]
    );
    expect(html).toContain("Belege sichern (ZIP)");
    expect(html).not.toContain("Löschen");
    expectExplanationOnly(guide);
  });

  it.each([false, true])(
    "never mounts the guide without finance read permission (rightsLoading=%s)",
    rightsLoading => {
      state.canRead = false;
      state.rightsLoading = rightsLoading;
      const html = renderToStaticMarkup(createElement(Finances));
      expect(html).toContain(
        rightsLoading ? "Finanzen werden geladen" : "keinen Zugriff"
      );
      expect(state.captureGuide).not.toHaveBeenCalled();
      expect(state.listQuery).toHaveBeenCalledWith(undefined, {
        enabled: false,
        retry: false,
      });
      expect(state.mutate).not.toHaveBeenCalled();
    }
  );

  it("keeps all seven active finance scripts verbatim in the shared audio catalog", () => {
    for (const [id, script] of Object.entries(EXPECTED_FINANCE_SCRIPTS)) {
      expect.soft(isKlemmiAudioId(id), id).toBe(true);
      expect
        .soft((KLEMMI_AUDIO_SCRIPTS as Record<string, string>)[id], id)
        .toBe(script);
    }
  });

  it.each(["event_pass", "light", "pro", "enterprise"])(
    "keeps the short receipt guide explanation-only for %s, with a real locked writer anchor below Pro",
    packageId => {
      state.packageId = packageId;
      state.canWrite = true;
      const { html, guide } = renderGuide();
      const receiptStep = guide.steps.find(step => step.key === "receipts");
      expect(receiptStep?.text).toBe(EXPECTED_FINANCE_SCRIPTS["finances-receipts"]);
      expect(receiptStep?.text).toBe(KLEMMI_AUDIO_SCRIPTS["preparation-documents"]);
      expect(receiptStep?.text).toBe(KLEMMI_AUDIO_SCRIPTS["postprocessing-documents"]);
      expect(receiptStep?.selector).toBe('[data-klemmi-target="finances-receipts"]');
      const buttons = html.match(/<button\b[^>]*data-klemmi-target="finances-receipts"[^>]*>/g) ?? [];
      expect(buttons).toHaveLength(2);
      for (const button of buttons)
        expect(button).toContain(`aria-disabled="${packageId === "event_pass" || packageId === "light"}"`);
      expect(html.includes("Belege sichern (ZIP)")).toBe(packageId === "pro" || packageId === "enterprise");
      expectExplanationOnly(guide);
    }
  );
});
