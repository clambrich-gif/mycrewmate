import {
  PRODUCT_PACKAGE_META,
  requiredUpgradePackageForCapability,
  type ProductCapability,
  type ProductPackageId,
} from "@shared/product-packages";

/**
 * Situative Klemmi-Hinweise für Funktionen innerhalb bereits zugänglicher
 * Bereiche. Die benötigte Paketstufe wird niemals hier gepflegt, sondern
 * immer aus dem zentralen Produktkatalog abgeleitet.
 */
export const KLEMMI_FEATURE_CONTEXTS = {
  planning_team_accesses: {
    capability: "personal_accesses",
    title: "Planungsteam-Zugänge verwalten",
    explanation:
      "Hier verwaltest du persönliche Zugänge, Fachrechte und Veranstaltungsfreigaben für dein Planungsteam.",
    alternative:
      "Im Event Pass bleibt die Planung sicher beim Hauptadministrator; weitere persönliche Planungsteam-Zugänge kommen mit Light hinzu.",
  },
  contact_pdf_overviews: {
    capability: "contacts",
    title: "Ansprechpartner-Übersichten erstellen",
    explanation:
      "Damit erstellst du gegliederte Arbeitsmappen mit Bereichsverantwortung, Schichten und druckbaren Checklisten.",
    alternative:
      "Helfer-PDFs und gefilterte Einsatzpläne bleiben weiterhin direkt nutzbar.",
  },
  custom_pdf_branding: {
    capability: "custom_branding",
    title: "Eigenes Eventlogo auf PDFs verwenden",
    explanation:
      "Hier gestaltest du die PDFs und den Dashboard-Zähler mit einem eigenen Eventlogo.",
    alternative:
      "Bis dahin bleibt das MyCrewMate-Logo automatisch und einheitlich auf allen PDFs eingebunden.",
  },
  whatsapp_templates: {
    capability: "whatsapp_templates",
    title: "WhatsApp-Vorlagen mit Platzhaltern nutzen",
    explanation:
      "Automatische Vorlagen füllen hilfreiche Nachrichtentexte und passende Platzhalter für deine Helfer aus.",
    alternative:
      "Der direkte WhatsApp-Kontakt bleibt verfügbar und öffnet einen leeren Chat für eine frei formulierte Nachricht.",
  },
  donations: {
    capability: "donations",
    title: "Spenden direkt beim Helfer erfassen",
    explanation:
      "Kuchen, Salate, Snacks und weitere Verpflegungsspenden werden damit direkt beim passenden Helfer dokumentiert.",
    alternative:
      "Helfer, Verfügbarkeiten und Einsatzplan bleiben selbstverständlich vollständig nutzbar.",
  },
  personal_helper_pdf: {
    capability: "personal_accesses",
    title: "Persönlichen Helferplan als PDF bereitstellen",
    explanation:
      "Damit erzeugst du persönliche Einsatzplan-PDFs und kannst sie für einzelne Helfer vorbereiten.",
    alternative:
      "Die regulären Helferübersichten und Einsatzplan-PDFs bleiben weiterhin verfügbar.",
  },
  project_backups: {
    capability: "project_backup",
    title: "Projektstände sichern und wiederherstellen",
    explanation:
      "Damit sicherst du den vollständigen Projektstand und stellst ihn nach einer geprüften Vorschau wieder her.",
    alternative:
      "Im Light-Paket bleiben alle Kernbereiche für die laufende Planung direkt verfügbar.",
  },
} as const satisfies Record<
  string,
  {
    capability: ProductCapability;
    title: string;
    explanation: string;
    alternative: string;
  }
>;

export type KlemmiFeatureContextId = keyof typeof KLEMMI_FEATURE_CONTEXTS;

export function getKlemmiFeatureContext(
  contextId: KlemmiFeatureContextId,
  currentPackageId: ProductPackageId
) {
  const context = KLEMMI_FEATURE_CONTEXTS[contextId];
  const targetPackageId = requiredUpgradePackageForCapability(
    currentPackageId,
    context.capability
  );
  const targetPackageName = targetPackageId
    ? PRODUCT_PACKAGE_META[targetPackageId].name
    : null;

  return {
    ...context,
    contextId,
    targetPackageId,
    targetPackageName,
    isLocked: targetPackageId !== null,
    lockedText: targetPackageName
      ? `${context.explanation} Hinweis: Diese Funktion steht ab dem Paket ${targetPackageName} zur Verfügung. ${context.alternative}`
      : context.explanation,
  };
}
