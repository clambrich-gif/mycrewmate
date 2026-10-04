import type { Archiver } from "archiver";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { materialStatusText } from "../shared/material-status";
import type {
  AppSettings,
  Assignment,
  Cake,
  Contact,
  Helper,
  Location,
  Material,
  PostTask,
  PrepTask,
  Shift,
  ShiftAreaContact,
} from "../drizzle/schema";
import * as db from "./db";
import { DAYS, evaluateShifts, toMinutes, type Day } from "./logic";
import { currentEventYear } from "./year-context";
import { storageRead } from "./storage";
import { resolveEventPdfLogoKey } from "./event-pdf-image";
import { helperAvailabilityWindow } from "../shared/weekdays";
import { latestPreparationLogbookEntry } from "../shared/preparation-logbook";
import { productAllowsCapability } from "../shared/product-packages";
import { loadBrandAsset } from "./brand-asset-routes";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver") as {
  ZipArchive: new (options: { zlib: { level: number } }) => Archiver;
};

export const DEFAULT_PDF_SETTINGS = {
  id: 1,
  eventName: "MyEifelRide",
  eventYear: "2026",
  helperPdfTitle: "Aufgabenübersicht",
  blankPlanTitle: "Einsatzplan – Blanko",
  contactLabel: "Ansprechpartner",
  footerText: "",
  whatsAppHelperRequestTemplate: null,
  whatsAppMessageTemplate: null,
  tenantLogoKey: null,
  tenantLogoUrl: null,
  logoKey: null,
  logoUrl: null,
  extraColumns: "[]",
  blankRowsPerShift: 0,
  updatedAt: new Date(0),
} satisfies AppSettings;

type PlanningData = {
  helpers: Helper[];
  contacts: Contact[];
  cakes?: Cake[];
  shifts: Shift[];
  assignments: Assignment[];
  areaContacts?: ShiftAreaContact[];
  materials?: Material[];
  locations?: Location[];
  prepTasks?: PrepTask[];
  postTasks?: PostTask[];
  settings: AppSettings;
  logoBuffer?: Buffer;
  /** Ohne individuelles Eventlogo wird die breite MyCrewMate-Wortmarke verwendet. */
  usesMyCrewMateWordmark?: boolean;
};

type PdfColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 42;
const contentWidth = pageWidth - margin * 2;
const MYCREWMATE_ACCESS_URL = "https://app.mycrewmate.de";
const MYCREWMATE_PDF_TAGLINE = "Gemeinsam planen. Entspannt veranstalten.";
const MYCREWMATE_PDF_FOOTER = `MyCrewMate · ${MYCREWMATE_PDF_TAGLINE}`;
// In der persönlichen Aufgabenübersicht etwas kompakter als die allgemeinen
// PDF-Kopfzeilen: sichtbar, aber mit mehr Raum für die eigentlichen Einsätze.
const CUSTOM_EVENT_LOGO_COMPACT_SIZE = 78;
const CUSTOM_EVENT_LOGO_STANDARD_SIZE = 128;
const helperPdfTypography = {
  title: 18,
  helperName: 14,
  event: 10,
  meta: 8,
  day: 11,
  time: 10,
  task: 11,
  detail: 9,
  summaryTitle: 12,
  summaryEntry: 9,
} as const;

/** Ein Zugangsblatt enthält nur beim initialen Erstellen bzw. Zurücksetzen einen Klartextcode. */
export type PlanningTeamAccessSheet = {
  accessId: number;
  contactName: string;
  events: Array<{ year: number; name: string }>;
  initialPassword?: string;
};

/**
 * Das feste Breitenbudget hält die vollständige Materialtabelle innerhalb
 * der A4-Hochformatseite. Die Summe muss immer genau contentWidth ergeben.
 */
export const MATERIAL_PACKLIST_PORTRAIT_COLUMNS = [
  { key: "article", label: "Artikel", width: 120 },
  { key: "category", label: "Kategorie", width: 78 },
  { key: "quantity", label: "Menge", width: 55, align: "center" },
  { key: "location", label: "Ort", width: 65 },
  { key: "status", label: "Stand", width: 55, align: "center" },
  { key: "contact", label: "Ansprechpartner", width: 138.28 },
] as const satisfies readonly PdfColumn[];

export const MATERIAL_PACKLIST_PORTRAIT_WIDTH =
  MATERIAL_PACKLIST_PORTRAIT_COLUMNS.reduce(
    (sum, column) => sum + column.width,
    0
  );
const colors = {
  ink: "#172033",
  muted: "#5f6877",
  line: "#d9dee7",
  header: "#eef3f8",
  accent: "#155e75",
};

/** Einheitliche, neutrale Infoboxen ausschließlich für persönliche Helfer-PDFs. */
export const helperPdfPastels = {
  timeBackground: "#F9FAFB",
  timeBorder: "#E5E7EB",
  timeText: "#1F2937",
  shiftNoteBackground: "#F9FAFB",
  shiftNoteText: "#1F2937",
  helperNoteBackground: "#F9FAFB",
  helperNoteText: "#1F2937",
} as const;

const helperPdfDesign = {
  ink: "#1F2937",
  muted: "#4B5563",
  accent: "#1E3A8A",
  line: "#E5E7EB",
  box: "#F9FAFB",
} as const;

const helperPdfLocationStyle = {
  iconSize: 8,
  iconTextGap: 3,
  taskGap: 9,
  fontSize: 9,
} as const;

const helperPdfMargin = 36;
const helperPdfContentWidth = pageWidth - helperPdfMargin * 2;
const helperPdfBottom = pageHeight - 48;

function collectPdf(
  build: (doc: PDFKit.PDFDocument) => void,
  layout: "portrait" | "landscape" = "portrait"
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout,
      margin,
      bufferPages: true,
      info: { Creator: "MyCrewMate" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      const current = index - range.start + 1;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7).fillColor(colors.muted);
      doc.text(MYCREWMATE_PDF_FOOTER, 0, doc.page.height - 36, {
        align: "center",
        width: doc.page.width,
        lineBreak: false,
      });
      doc.text(`Seite ${current} von ${range.count}`, 0, doc.page.height - 22, {
        align: "center",
        width: doc.page.width,
        lineBreak: false,
      });
    }
    doc.end();
  });
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Helfer"
  );
}

/**
 * Erzeugt eine persönliche WBT-Teilnahmebestätigung ohne Speicherung der
 * Teilnehmerangaben. Sie dokumentiert ausschließlich den simulierten
 * Trainingsdurchlauf und stellt keine amtliche Qualifikation dar.
 */
export function renderWbtCompletionCertificatePdf(input: {
  participantName: string;
  trackTitle: string;
  completedAt?: Date;
}) {
  const completedAt = input.completedAt ?? new Date();
  const formattedDate = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
  }).format(completedAt);

  return collectPdf(doc => {
    doc.fillColor("#155e75").font("Helvetica-Bold").fontSize(12);
    doc.text("MyCrewMate Lernwerkstatt", { align: "center", width: contentWidth });
    doc.moveDown(2.6);
    doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(28);
    doc.text("Teilnahmebestätigung", { align: "center", width: contentWidth });
    doc.moveDown(0.8);
    doc.fillColor(colors.muted).font("Helvetica").fontSize(11);
    doc.text("für das interaktive Web-Based-Training", {
      align: "center",
      width: contentWidth,
    });
    doc.moveDown(2.2);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(12);
    doc.text("Hiermit wird bestätigt, dass", {
      align: "center",
      width: contentWidth,
    });
    doc.moveDown(0.7);
    doc.fillColor("#1d4ed8").font("Helvetica-Bold").fontSize(22);
    doc.text(input.participantName, { align: "center", width: contentWidth });
    doc.moveDown(1.3);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(12);
    doc.text("den folgenden simulierten Trainingspfad vollständig durchlaufen hat:", {
      align: "center",
      width: contentWidth,
    });
    doc.moveDown(0.7);
    doc.fillColor("#155e75").font("Helvetica-Bold").fontSize(16);
    doc.text(input.trackTitle, { align: "center", width: contentWidth });
    doc.moveDown(2.3);
    doc.fillColor(colors.muted).font("Helvetica").fontSize(10);
    doc.text(`Abgeschlossen am ${formattedDate}`, { align: "center", width: contentWidth });
    doc.moveDown(2.7);
    doc.strokeColor("#93c5fd").lineWidth(1.2).moveTo(margin + 72, doc.y).lineTo(pageWidth - margin - 72, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor(colors.muted).font("Helvetica").fontSize(8.5);
    doc.text(
      "Diese Bestätigung dokumentiert ausschließlich die Teilnahme an einer datenfreien Schulungssimulation. Sie ist kein amtlicher Befähigungs- oder Prüfungsnachweis.",
      { align: "center", width: contentWidth, lineGap: 2 }
    );
  });
}

type ClubPrivacyTemplateSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const CLUB_PRIVACY_TEMPLATE_SECTIONS: ClubPrivacyTemplateSection[] = [
  {
    title: "1. Wofür nutzen wir deine Daten?",
    paragraphs: [
      "Wir planen, organisieren und begleiten mit den angegebenen Daten unsere Vereins- und Veranstaltungsarbeit. Dazu gehören insbesondere die Helferkoordination, die Besetzung von Schichten, die Abstimmung von Aufgaben sowie die Vorbereitung, Durchführung und Nachbereitung der Veranstaltung.",
    ],
  },
  {
    title: "2. Welche Daten verarbeiten wir?",
    paragraphs: [
      "Je nach Rolle und freiwilliger Angabe verarbeiten wir nur Daten, die für die konkrete Helfer- und Einsatzplanung erforderlich sind.",
      "Bitte trage keine Angaben zu Gesundheit, Familie, Religion, politischen Ansichten oder anderen besonders sensiblen persönlichen Umständen in Freitextfelder ein, sofern der Verein dafür nicht ausdrücklich einen dokumentierten Grund und Schutzweg bereitstellt.",
    ],
    bullets: [
      "Name und Kontaktmöglichkeiten, Ansprechpartner-Zuordnung, Zuständigkeiten und Schichtzuordnungen",
      "Rückmeldungen zur Verfügbarkeit sowie aufgabenbezogene Hinweise, zum Beispiel „PKW mit Anhängerkupplung verfügbar“",
      "bei freiwilligen Verpflegungsspenden: Art, Übergabeort und -zeit sowie Zutaten- oder Allergenhinweise zur sicheren Ausgabe",
      "technische Angaben zu Zugängen, Berechtigungen und sicherheitsrelevanten Vorgängen",
    ],
  },
  {
    title: "3. Persönliche Einsatzübersicht als geschützter Link",
    paragraphs: [
      "Auf Wunsch kann der Verein einen persönlichen Einsatzplan als geschützten Link senden. Der Link ist sieben Tage gültig und wird nur zusammen mit einem getrennten Zugangscode geöffnet. Der Verein kann den Link jederzeit sofort widerrufen; danach ist er auch mit dem richtigen Zugangscode nicht mehr nutzbar.",
      "In der Basisansicht stehen nur Name, eigene Einsätze, Tag, Uhrzeit, Aufgabe, Ort, eigene Hinweise, eigene Verpflegungsspenden und die verantwortliche Ansprechperson. Eine Telefonnummer der Ansprechperson erscheint nur bei deren freiwilliger Freigabe.",
      "Die bewusst wählbare Ansicht mit Mithelfenden ergänzt die Namen der Personen derselben Schicht und ausschließlich aufgabenrelevante Informationen. Verfügbarkeiten anderer Personen, weitere Einsätze anderer Helfer sowie nicht erforderliche private Angaben werden nicht ausgegeben.",
    ],
  },
  {
    title: "4. Freiwillige Kommunikation über WhatsApp",
    paragraphs: [
      "Der Verein kann nach einem bewussten Klick eine vorbereitete Nachricht in WhatsApp öffnen. Die Nutzung ist freiwillig; eine Kontaktaufnahme über einen anderen Weg bleibt möglich. Bei Nutzung von WhatsApp werden Zielrufnummer und vorbereiteter Nachrichtentext an WhatsApp übergeben.",
    ],
  },
  {
    title: "5. Freiwillige Telefonnummernfreigabe für Ansprechpartner",
    paragraphs: [
      "Ansprechpartner entscheiden selbst, ob ihre Telefonnummer in persönlichen Einsatzübersichten ihrer zugeordneten Helfer angezeigt wird. Ohne Freigabe erscheint nur der Name der Ansprechperson.",
      "Option: [ ] Telefonnummer in persönlichen Einsatzübersichten anzeigen    [ ] Telefonnummer nicht anzeigen",
      "Name: ______________________________    Datum / Unterschrift oder dokumentierte Bestätigung: ______________________________",
    ],
  },
  {
    title: "6. Rechtsgrundlage, Speicherdauer und Rechte",
    paragraphs: [
      "Die konkrete Rechtsgrundlage legt der Verein als Verantwortlicher fest, etwa Mitgliedschaft oder Teilnahmevereinbarung, rechtliche Verpflichtung, berechtigtes Interesse an einer geordneten Durchführung oder – bei wirklich freiwilligen Zusatzfunktionen – eine Einwilligung.",
      "Planungsdaten werden für [FRIST DES VEREINS] aufbewahrt. In MyCrewMate ist für abgeschlossene Veranstaltungen eine reguläre Frist von drei Jahren vorgesehen, soweit keine frühere Löschung erfolgt und keine längere gesetzliche Pflicht besteht.",
      "Für Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit oder Widerspruch wende dich bitte an den genannten Datenschutzkontakt des Vereins. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.",
    ],
  },
];

/** Erzeugt ein ausfüllbares Vereinsmuster für die Information von Helfern und Ansprechpartnern. */
export function renderClubPrivacyNoticeTemplatePdf() {
  return collectPdf(doc => {
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(19);
    doc.text("Datenschutzhinweis für Helferinnen, Helfer und Ansprechpartner", {
      width: contentWidth,
    });
    doc.moveDown(0.5);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
    doc.text(
      "Ausfüllbares Vereinsmuster · vor Nutzung mit den tatsächlichen Abläufen, Kontakten und Fristen des Vereins ergänzen · Stand 01.10.2026",
      { width: contentWidth }
    );
    doc.moveDown(1.2);
    doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(10.5);
    doc.text("Verein / Veranstalter: [NAME DES VEREINS]");
    doc.text("Veranstaltung / Projekt: [NAME DER VERANSTALTUNG]");
    doc.text("Verantwortliche Person: [NAME, FUNKTION, KONTAKT]");
    doc.text("Datenschutzkontakt des Vereins: [E-MAIL / POSTANSCHRIFT]");
    doc.text("Stand: [DATUM]");
    doc.moveDown(1.1);

    for (const section of CLUB_PRIVACY_TEMPLATE_SECTIONS) {
      if (doc.y > pageHeight - 150) {
        doc.addPage();
        doc.x = margin;
        doc.y = margin;
      }
      doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(12);
      doc.text(section.title, { width: contentWidth });
      doc.moveDown(0.35);
      doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
      for (const paragraph of section.paragraphs) {
        doc.text(paragraph, { width: contentWidth, lineGap: 2 });
        doc.moveDown(0.45);
      }
      for (const bullet of section.bullets ?? []) {
        doc.text(`• ${bullet}`, margin + 8, doc.y, {
          width: contentWidth - 8,
          lineGap: 2,
          indent: 0,
        });
        doc.moveDown(0.25);
      }
      doc.moveDown(0.65);
    }

    if (doc.y > pageHeight - 135) {
      doc.addPage();
      doc.x = margin;
      doc.y = margin;
    }
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(12);
    doc.text("Interne Vereins-Checkliste vor dem Einsatz", {
      width: contentWidth,
    });
    doc.moveDown(0.4);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
    [
      "Verantwortliche Person und Datenschutzkontakt ausgefüllt",
      "Tatsächlich genutzte Kommunikationswege beschrieben",
      "Teamansicht nur eingesetzt, wenn Mithelfende für die Zusammenarbeit erforderlich sind",
      "Ansprechpartner haben über die freiwillige Telefonnummernfreigabe entschieden",
      "WhatsApp als freiwilliger Kommunikationsweg kenntlich gemacht",
      "Lösch- bzw. Aufbewahrungsfrist des Vereins festgelegt",
      "AVV mit MyCrewMate und Unterauftragsverarbeiteranlage geprüft",
    ].forEach(item => {
      doc.text(`[ ]  ${item}`, { width: contentWidth, lineGap: 2 });
      doc.moveDown(0.25);
    });
  });
}

function renderGovernanceTemplatePdf(
  title: string,
  subtitle: string,
  sections: Array<{ title: string; lines: string[] }>
) {
  return collectPdf(doc => {
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(19);
    doc.text(title, { width: contentWidth });
    doc.moveDown(0.5);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
    doc.text(subtitle, { width: contentWidth, lineGap: 2 });
    doc.moveDown(1.1);
    for (const section of sections) {
      if (doc.y > pageHeight - 140) {
        doc.addPage();
        doc.x = margin;
        doc.y = margin;
      }
      doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(11.5);
      doc.text(section.title, { width: contentWidth });
      doc.moveDown(0.3);
      doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
      for (const line of section.lines) {
        doc.text(`[ ]  ${line}`, { width: contentWidth, lineGap: 2 });
        doc.moveDown(0.35);
      }
      doc.moveDown(0.55);
    }
  });
}

/** Ausfüllbare interne Vorlage für Auskunfts-, Lösch- und Berichtigungsanfragen. */
export function renderDataSubjectRequestTemplatePdf() {
  return renderGovernanceTemplatePdf(
    "Bearbeitung einer Datenschutzanfrage",
    "Interne Vereins- und MyCrewMate-Vorlage · Erfasst nur die für die Bearbeitung erforderlichen Angaben. Anfragen unverzüglich dokumentieren und innerhalb eines Monats beantworten, soweit keine rechtlich zulässige Verlängerung begründet wird.",
    [
      {
        title: "1. Eingang",
        lines: [
          "Anfrage eingegangen am: ____________________",
          "Anfragende Person / Kontaktweg: ____________________",
          "Art: [ ] Auskunft  [ ] Berichtigung  [ ] Löschung  [ ] Einschränkung  [ ] Widerspruch  [ ] Datenübertragbarkeit",
          "Identität angemessen geprüft (ohne unnötige Ausweiskopie): ____________________",
        ],
      },
      {
        title: "2. Zuständigkeit und Recherche",
        lines: [
          "Verantwortlicher Verein / zuständige Person: ____________________",
          "Betroffene MyCrewMate-Bereiche und Event(s): ____________________",
          "Auftragsverarbeiter informiert, soweit erforderlich: ____________________",
          "Gesetzliche Aufbewahrungspflicht oder dokumentierte Ausnahme geprüft: ____________________",
        ],
      },
      {
        title: "3. Antwort und Abschluss",
        lines: [
          "Antwortdatum / gewählter sicherer Übermittlungsweg: ____________________",
          "Ergebnis bzw. Begründung einer Einschränkung: ____________________",
          "Frist eingehalten oder Verlängerung begründet: ____________________",
          "Abschluss geprüft durch: ____________________",
        ],
      },
    ]
  );
}

/** Ausfüllbare Erstmaßnahmenvorlage für den Umgang mit Datenschutzvorfällen. */
export function renderPrivacyIncidentTemplatePdf() {
  return renderGovernanceTemplatePdf(
    "Erstprotokoll Datenschutzvorfall",
    "Interne Vereins- und MyCrewMate-Vorlage · Bei Verdacht zuerst Zugang begrenzen, Beweise sichern und den Vorgang bewerten. Ersetzt keine rechtliche Beratung; Melde- und Benachrichtigungspflichten sind unverzüglich im Einzelfall zu prüfen.",
    [
      {
        title: "1. Sofortmaßnahmen",
        lines: [
          "Vorfall festgestellt am / durch: ____________________",
          "Betroffene Systeme, Links oder Zugänge: ____________________",
          "Zugriff gesperrt / Link widerrufen / Passwort zurückgesetzt: ____________________",
          "Keine personenbezogenen Details in ungeschützte Chat- oder E-Mail-Verteiler geschrieben",
        ],
      },
      {
        title: "2. Bewertung",
        lines: [
          "Welche Datenkategorien und ungefähr wie viele Personen könnten betroffen sein? ____________________",
          "Unbefugter Empfänger oder Verlustweg bekannt? ____________________",
          "Risiko für die betroffenen Personen bewertet durch: ____________________",
          "Datenschutzkontakt des Vereins und MyCrewMate informiert, soweit erforderlich",
        ],
      },
      {
        title: "3. Nachweis und Abschluss",
        lines: [
          "Entscheidung zur Meldung an die Aufsichtsbehörde dokumentiert (Frist bei Bedarf prüfen)",
          "Entscheidung zur Benachrichtigung Betroffener dokumentiert",
          "Abhilfemaßnahmen, Test und Abschlussdatum: ____________________",
        ],
      },
    ]
  );
}

export type TenantContractReceiptPdfInput = {
  tenantName: string;
  recipientName: string;
  packageName: string;
  acceptedAt: Date;
  documents: Array<{
    title: string;
    version: string;
    hash: string;
  }>;
};

export type TenantAcceptedContractDocumentsPdfInput = Omit<
  TenantContractReceiptPdfInput,
  "documents"
> & {
  documents: Array<{
    title: string;
    version: string;
    hash: string;
    /** Unveränderlicher Wortlaut der elektronisch bestätigten Fassung. */
    content: string;
  }>;
};

function contractAcceptedAtLabel(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function ensureContractDocumentSpace(doc: PDFKit.PDFDocument, required: number) {
  if (doc.y + required <= pageHeight - 60) return;
  doc.addPage();
  doc.x = margin;
  doc.y = margin;
}

function renderAcceptedContractContent(
  doc: PDFKit.PDFDocument,
  content: string
) {
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      doc.moveDown(0.42);
      continue;
    }
    if (line.startsWith("# ")) {
      ensureContractDocumentSpace(doc, 48);
      doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(16);
      doc.text(line.slice(2), { width: contentWidth, lineGap: 2 });
      doc.moveDown(0.55);
      continue;
    }
    if (line.startsWith("## ")) {
      ensureContractDocumentSpace(doc, 38);
      doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(11.5);
      doc.text(line.slice(3), { width: contentWidth, lineGap: 2 });
      doc.moveDown(0.28);
      continue;
    }
    ensureContractDocumentSpace(doc, 28);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.4);
    doc.text(line, { width: contentWidth, lineGap: 2 });
    doc.moveDown(0.34);
  }
}

/**
 * Lesbarer Nachweis über die versioniert gespeicherte elektronische Annahme.
 * Er enthält bewusst keine Passwörter, Sicherheitscodes oder MFA-Geheimnisse.
 */
export function renderTenantContractReceiptPdf(input: TenantContractReceiptPdfInput) {
  const acceptedAt = contractAcceptedAtLabel(input.acceptedAt);
  return collectPdf(doc => {
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(19);
    doc.text("Digitaler Vertragsnachweis", { width: contentWidth });
    doc.moveDown(0.45);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
    doc.text(
      "Nachweis über die elektronische Annahme der aktuellen MyCrewMate-Vertragsunterlagen. Bitte zusammen mit dieser Bestätigungs-E-Mail aufbewahren.",
      { width: contentWidth, lineGap: 2 }
    );
    doc.moveDown(1.1);

    const fields = [
      ["Verein", input.tenantName],
      ["Bestätigt durch", input.recipientName],
      ["Zeitpunkt der Annahme", acceptedAt],
      ["Zugeordnetes Paket", input.packageName],
    ];
    for (const [label, value] of fields) {
      doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(9);
      doc.text(label, { width: 160, continued: true });
      doc.fillColor(colors.ink).font("Helvetica").text(`  ${value}`, {
        width: contentWidth - 160,
      });
      doc.moveDown(0.35);
    }

    doc.moveDown(0.55);
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(12);
    doc.text("Elektronisch bestätigte Unterlagen", { width: contentWidth });
    doc.moveDown(0.4);
    for (const document of input.documents) {
      doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(10);
      doc.text(`${document.title} · Version ${document.version}`, { width: contentWidth });
      doc.fillColor(colors.muted).font("Helvetica").fontSize(8.5);
      doc.text(`Dokument-Prüfsumme (SHA-256): ${document.hash}`, {
        width: contentWidth,
        lineGap: 1,
      });
      doc.moveDown(0.65);
    }

    doc.moveDown(0.35);
    doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(11);
    doc.text("Einordnung", { width: contentWidth });
    doc.moveDown(0.3);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
    doc.text(
      "Die Annahme wurde in MyCrewMate mit Zeitpunkt, Verein, bestätigender Person, Dokumentversion und Prüfsumme gespeichert. Dieser Nachweis enthält keine Passwörter, Sicherheitscodes oder sonstigen Zugangsdaten. Er ersetzt keine Rechtsberatung oder qualifizierte elektronische Signatur.",
      { width: contentWidth, lineGap: 2 }
    );
  });
}

/**
 * Gibt dem Verein die vollständigen Originalwortlaute seiner elektronisch
 * bestätigten AGB, AVV und Datenschutzhinweise aus. Die Dokument-Prüfsumme
 * macht nachvollziehbar, dass der gespeicherte Wortlaut unverändert ist.
 */
export function renderTenantAcceptedContractDocumentsPdf(
  input: TenantAcceptedContractDocumentsPdfInput
) {
  const acceptedAt = contractAcceptedAtLabel(input.acceptedAt);
  return collectPdf(doc => {
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(19);
    doc.text("Meine bestätigten Vertragsunterlagen", { width: contentWidth });
    doc.moveDown(0.45);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9.5);
    doc.text(
      "Vollständige Wortlaute der genau bei der elektronischen Annahme gültigen MyCrewMate-Unterlagen. Die Prüfsumme je Dokument dient der Integritätskontrolle.",
      { width: contentWidth, lineGap: 2 }
    );
    doc.moveDown(1);
    for (const [label, value] of [
      ["Verein", input.tenantName],
      ["Bestätigt durch", input.recipientName],
      ["Zeitpunkt der Annahme", acceptedAt],
      ["Zugeordnetes Paket", input.packageName],
    ]) {
      doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(9);
      doc.text(label, { width: 160, continued: true });
      doc.fillColor(colors.ink).font("Helvetica").text(`  ${value}`, {
        width: contentWidth - 160,
      });
      doc.moveDown(0.34);
    }

    for (const document of input.documents) {
      doc.addPage();
      doc.x = margin;
      doc.y = margin;
      doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(13);
      doc.text(`${document.title} · Version ${document.version}`, {
        width: contentWidth,
      });
      doc.moveDown(0.22);
      doc.fillColor(colors.muted).font("Helvetica").fontSize(8);
      doc.text(`Dokument-Prüfsumme (SHA-256): ${document.hash}`, {
        width: contentWidth,
        lineGap: 1,
      });
      doc.moveDown(0.8);
      renderAcceptedContractContent(doc, document.content);
    }
  });
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(shift: Shift) {
  if (!shift.startTime || !shift.endTime) return "keine feste Uhrzeit";
  return `${shift.startTime}–${shift.endTime}`;
}

/** Persönliche Helferübersichten bezeichnen zeitlose Schichten eindeutig als Ganztags-Einsatz. */
export function helperPdfTimeLabel(
  shift: Pick<Shift, "startTime" | "endTime">
) {
  return shift.startTime && shift.endTime
    ? `${shift.startTime}–${shift.endTime}`
    : "Ganztags";
}

/** Zweizeilige Zeitkennzeichnung für PDF-Einsatzpläne mit flexibler Belegung. */
export function planPdfTimeLabel(shift: Shift) {
  const time = formatTime(shift);
  return shift.allowFlexibleAssignment ? `${time}\n(flexibel)` : time;
}

/** Kompakte Kennzeichnung für persönliche Helfer-PDFs bei begrenzter Tagesverfügbarkeit. */
export function helperTimeBadgeLabel(helper: Helper, day: Day) {
  const window = helperAvailabilityWindow(helper, day);
  return window ? `Zeitfenster: ${window.start}–${window.end} Uhr` : null;
}

/** Erklärt ausschließlich bei hinterlegter Zeiteinschränkung den Ursprung des Tageszeitfensters. */
export function helperAvailabilityHeadingLabel(helper: Helper, day: Day) {
  const timeWindow = helperTimeBadgeLabel(helper, day);
  return timeWindow
    ? `${timeWindow.replace("Zeitfenster: ", "")} (Vom Helfer mitgeteilter Verfügbarkeitszeitraum)`
    : null;
}

/**
 * Die persönliche Aufgabenübersicht führt Aufgabe, optionalen Bereich und
 * Bemerkung in einer Tabellenzelle. Vor einer Bemerkung bleibt bewusst eine
 * freie Textzeile: Sie schafft einen klaren Abstand, ohne selbst als Inhalt
 * oder spätere Hervorhebung der Bemerkung gerendert zu werden.
 */
export function helperTaskCellText(
  shift: Pick<Shift, "task" | "area" | "note">
) {
  const { primaryText, noteText } = helperTaskCellParts(shift);
  return noteText ? `${primaryText}\n\n${noteText}` : primaryText;
}

/** Trennt den neutralen Aufgabeninhalt von einer bedingt markierten Bemerkung. */
export function helperTaskCellParts(
  shift: Pick<Shift, "task" | "area" | "note">
) {
  const lines = [shift.task];
  if (shift.area && shift.area !== "Allgemein") lines.push(shift.area);
  const note = shift.note?.trim();
  return {
    primaryText: lines.join("\n"),
    noteText: note ? `Bemerkung: ${note}` : null,
  };
}

function helperCakeDonorKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

/** Wählt die per Namen zugeordneten Verpflegungsspenden für die persönliche Helferübersicht. */
export function selectHelperCakes(
  cakes: Cake[] | undefined,
  helperName: string
) {
  const helperKey = helperCakeDonorKey(helperName);
  return (cakes ?? [])
    .filter(cake => helperCakeDonorKey(cake.donor) === helperKey)
    .sort(
      (left, right) =>
        (left.dropoffDate || "9999-12-31").localeCompare(
          right.dropoffDate || "9999-12-31"
        ) ||
        (left.dropoffTime || "99:99").localeCompare(
          right.dropoffTime || "99:99"
        ) ||
        left.sortOrder - right.sortOrder ||
        left.id - right.id
    );
}

function cakeWeekdayLabel(date: string) {
  const value = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
  }).format(new Date(`${date}T12:00:00`));
  return value.endsWith(".") ? value : `${value}.`;
}

/** Formatiert eine Spende samt optionaler Abgabezeit und Standort kompakt für die PDF-Zusammenfassung. */
export function helperCakeSummaryLine(
  cake: Cake,
  locationById: Map<number, Location>
) {
  const details: string[] = [];
  if (cake.dropoffDate) {
    const dateLabel = cakeWeekdayLabel(cake.dropoffDate);
    details.push(
      cake.dropoffTime ? `${dateLabel}, ${cake.dropoffTime} Uhr` : dateLabel
    );
  } else if (cake.dropoffTime) {
    details.push(`${cake.dropoffTime} Uhr`);
  } else if (cake.legacyDropoffText.trim()) {
    details.push(cake.legacyDropoffText.trim());
  }
  const location = cake.locationId
    ? locationById.get(cake.locationId)?.name.trim()
    : "";
  if (location) details.push(location);

  const donationName = cake.cake.trim() || "Spende";
  return details.length
    ? `${donationName} (${details.join(" – ")})`
    : donationName;
}

function ensureHelperPdfSpace(doc: PDFKit.PDFDocument, required: number) {
  if (doc.y + required <= helperPdfBottom) return;
  doc.addPage();
  doc.x = helperPdfMargin;
  doc.y = helperPdfMargin;
}

function drawCompactHelperHeader(
  doc: PDFKit.PDFDocument,
  settings: AppSettings,
  helperName: string,
  logoBuffer?: Buffer,
  usesMyCrewMateWordmark = false
) {
  const top = helperPdfMargin;
  const logoWidth = usesMyCrewMateWordmark
    ? 172
    : CUSTOM_EVENT_LOGO_COMPACT_SIZE;
  const logoHeight = usesMyCrewMateWordmark
    ? 52
    : CUSTOM_EVENT_LOGO_COMPACT_SIZE;
  const textWidth = logoBuffer
    ? helperPdfContentWidth - logoWidth - 14
    : helperPdfContentWidth;
  doc.x = helperPdfMargin;
  doc.y = top;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, doc.page.width - helperPdfMargin - logoWidth, top, {
        fit: [logoWidth, logoHeight],
      });
    } catch {
      // Ein beschädigtes Logo darf den operativen PDF-Export nicht blockieren.
    }
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.title)
    .fillColor(helperPdfDesign.ink)
    .text(settings.helperPdfTitle, {
      width: textWidth,
      lineBreak: false,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.helperName)
    .fillColor(helperPdfDesign.accent)
    .text(helperName, {
      width: textWidth,
      lineBreak: false,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.event)
    .fillColor(helperPdfDesign.ink)
    .text(`${settings.eventName} ${settings.eventYear}`.trim(), {
      width: textWidth,
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(helperPdfTypography.meta)
    .fillColor(helperPdfDesign.muted)
    .text(`Stand: ${formatDate()} · Persönliche Helferübersicht`, {
      width: textWidth,
      lineBreak: false,
    });
  if (usesMyCrewMateWordmark && logoBuffer) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.4)
      .fillColor(helperPdfDesign.accent)
      .text(
        MYCREWMATE_PDF_TAGLINE,
        doc.page.width - helperPdfMargin - logoWidth,
        top + 43,
        { width: logoWidth, align: "center", lineBreak: false }
      );
  }
  // Die Trennlinie beginnt erst unter dem gesamten Logo. Gerade bei einem
  // größeren individuellen Eventlogo darf keine Linie durch die Marke laufen.
  const logoSafeHeaderHeight = usesMyCrewMateWordmark
    ? 67
    : logoBuffer
      ? logoHeight + 8
      : 50;
  const lineY = Math.max(doc.y + 6, top + logoSafeHeaderHeight);
  doc
    .moveTo(helperPdfMargin, lineY)
    .lineTo(doc.page.width - helperPdfMargin, lineY)
    .strokeColor(helperPdfDesign.line)
    .lineWidth(0.7)
    .stroke();
  doc.x = helperPdfMargin;
  doc.y = lineY + 10;
}

function drawCompactHelperDayHeading(
  doc: PDFKit.PDFDocument,
  helper: Helper,
  day: Day
) {
  ensureHelperPdfSpace(doc, 24);
  const y = doc.y;
  const availabilityHeading = helperAvailabilityHeadingLabel(helper, day);
  doc
    .moveTo(helperPdfMargin, y + 14)
    .lineTo(doc.page.width - helperPdfMargin, y + 14)
    .strokeColor(helperPdfDesign.line)
    .lineWidth(0.6)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.day)
    .fillColor(helperPdfDesign.accent)
    .text(day, helperPdfMargin, y, { continued: Boolean(availabilityHeading) });
  if (availabilityHeading) {
    doc
      .font("Helvetica")
      .fontSize(helperPdfTypography.detail)
      .fillColor(helperPdfDesign.muted)
      .text(`  ${availabilityHeading}`);
  }
  doc.x = helperPdfMargin;
  doc.y = y + 21;
}

export function helperPdfLocationLink(
  location: Pick<Location, "name" | "latitude" | "longitude"> | null | undefined
) {
  const name = location?.name.trim();
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  if (
    !location ||
    !name ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  )
    return null;

  return {
    label: name,
    url: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=18/${latitude}/${longitude}`,
  };
}

function compactShiftInfo(
  shift: Shift,
  team: string,
  location?: Location | null
) {
  const area = shift.area?.trim();
  const task = shift.task.trim() || "Aufgabe";
  const taskLine = area && area !== "Allgemein" ? `${task} · ${area}` : task;
  const infoLines = [`Mithelfer: ${team || "–"}`];
  if (shift.note?.trim())
    infoLines.push(`Schicht-Bemerkung: ${shift.note.trim()}`);
  return {
    taskLine,
    locationLink: helperPdfLocationLink(location),
    infoText: infoLines.join("\n"),
  };
}

function compactShiftTaskLayout(
  doc: PDFKit.PDFDocument,
  taskLine: string,
  locationLink: ReturnType<typeof helperPdfLocationLink>,
  bodyWidth: number
) {
  const taskTextHeight = doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.task)
    .heightOfString(taskLine, { width: bodyWidth, lineGap: 0.5 });
  const taskTextWidth = doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.task)
    .widthOfString(taskLine);
  if (!locationLink) {
    return {
      taskTextHeight,
      taskHeight: taskTextHeight,
      inlineLocation: false,
      locationTextWidth: 0,
    };
  }

  const locationTextWidth = doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfLocationStyle.fontSize)
    .widthOfString(locationLink.label);
  const taskFitsInline =
    taskTextWidth +
      helperPdfLocationStyle.taskGap +
      helperPdfLocationStyle.iconSize +
      helperPdfLocationStyle.iconTextGap +
      locationTextWidth <=
      bodyWidth && taskTextWidth <= bodyWidth;
  if (taskFitsInline) {
    return {
      taskTextHeight,
      taskHeight: taskTextHeight,
      inlineLocation: true,
      locationTextWidth,
    };
  }

  const locationHeight = doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.detail)
    .heightOfString(locationLink.label, { width: bodyWidth, lineGap: 0.5 });
  return {
    taskTextHeight,
    taskHeight: taskTextHeight + locationHeight + 2,
    inlineLocation: false,
    locationTextWidth,
  };
}

function drawCompactHelperLocationPin(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number
) {
  const size = helperPdfLocationStyle.iconSize;
  const centerX = x + size / 2;
  const centerY = y + size * 0.36;
  doc
    .save()
    .circle(centerX, centerY, size * 0.28)
    .strokeColor(helperPdfDesign.accent)
    .lineWidth(0.85)
    .stroke()
    .moveTo(centerX - size * 0.2, centerY + size * 0.18)
    .lineTo(centerX, y + size)
    .lineTo(centerX + size * 0.2, centerY + size * 0.18)
    .stroke()
    .restore();
}

function drawCompactHelperLocationLink(
  doc: PDFKit.PDFDocument,
  locationLink: NonNullable<ReturnType<typeof helperPdfLocationLink>>,
  x: number,
  y: number,
  textWidth: number
) {
  const iconSize = helperPdfLocationStyle.iconSize;
  const textX = x + iconSize + helperPdfLocationStyle.iconTextGap;
  drawCompactHelperLocationPin(doc, x, y + 2);
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfLocationStyle.fontSize)
    .fillColor(helperPdfDesign.accent)
    .text(locationLink.label, textX, y, {
      width: textWidth,
      lineBreak: false,
    });
  doc.link(
    x,
    y,
    iconSize + helperPdfLocationStyle.iconTextGap + textWidth,
    helperPdfLocationStyle.fontSize + 3,
    locationLink.url
  );
}

function compactShiftBlockHeight(
  doc: PDFKit.PDFDocument,
  shift: Shift,
  team: string,
  location?: Location | null
) {
  const { taskLine, locationLink, infoText } = compactShiftInfo(
    shift,
    team,
    location
  );
  const timeWidth = 76;
  const bodyX = helperPdfMargin + timeWidth + 12;
  const bodyWidth = helperPdfContentWidth - timeWidth - 12;
  const { taskHeight } = compactShiftTaskLayout(
    doc,
    taskLine,
    locationLink,
    bodyWidth
  );
  const timeHeight = doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.time)
    .heightOfString(helperPdfTimeLabel(shift), {
      width: timeWidth,
      lineGap: 0.5,
    });
  const bodyHeight = Math.max(taskHeight, timeHeight, 13);
  const infoHeight = doc
    .font("Helvetica")
    .fontSize(helperPdfTypography.detail)
    .heightOfString(infoText, { width: bodyWidth - 16, lineGap: 1 });
  void bodyX;
  return 6 + bodyHeight + 7 + infoHeight + 14;
}

function drawCompactHelperShiftBlock(
  doc: PDFKit.PDFDocument,
  shift: Shift,
  team: string,
  location?: Location | null
) {
  const height = compactShiftBlockHeight(doc, shift, team, location);
  ensureHelperPdfSpace(doc, height + 4);
  const y = doc.y;
  const timeWidth = 76;
  const bodyX = helperPdfMargin + timeWidth + 12;
  const bodyWidth = helperPdfContentWidth - timeWidth - 12;
  const { taskLine, locationLink, infoText } = compactShiftInfo(
    shift,
    team,
    location
  );
  const taskLayout = compactShiftTaskLayout(
    doc,
    taskLine,
    locationLink,
    bodyWidth
  );
  const { taskHeight } = taskLayout;
  const timeHeight = doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.time)
    .heightOfString(helperPdfTimeLabel(shift), {
      width: timeWidth,
      lineGap: 0.5,
    });
  const bodyHeight = Math.max(taskHeight, timeHeight, 13);
  const infoY = y + 6 + bodyHeight + 6;
  const infoHeight = doc
    .font("Helvetica")
    .fontSize(helperPdfTypography.detail)
    .heightOfString(infoText, { width: bodyWidth - 16, lineGap: 1 });

  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.time)
    .fillColor(helperPdfDesign.ink)
    .text(helperPdfTimeLabel(shift), helperPdfMargin, y + 5, {
      width: timeWidth,
      lineGap: 0.5,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.task)
    .fillColor(helperPdfDesign.ink);
  if (locationLink && taskLayout.inlineLocation) {
    doc.text(taskLine, bodyX, y + 5, { lineBreak: false });
    drawCompactHelperLocationLink(
      doc,
      locationLink,
      bodyX + doc.widthOfString(taskLine) + helperPdfLocationStyle.taskGap,
      y + 6,
      taskLayout.locationTextWidth
    );
  } else {
    doc.text(taskLine, bodyX, y + 5, { width: bodyWidth, lineGap: 0.5 });
    if (locationLink) {
      drawCompactHelperLocationLink(
        doc,
        locationLink,
        bodyX,
        y + 7 + taskLayout.taskTextHeight,
        taskLayout.locationTextWidth
      );
    }
  }
  doc
    .roundedRect(bodyX, infoY, bodyWidth, infoHeight + 11, 3)
    .fillAndStroke(helperPdfDesign.box, helperPdfDesign.line);
  doc
    .font("Helvetica")
    .fontSize(helperPdfTypography.detail)
    .fillColor(helperPdfDesign.muted)
    .text(infoText, bodyX + 8, infoY + 5, {
      width: bodyWidth - 16,
      lineGap: 1,
    });
  doc.x = helperPdfMargin;
  doc.y = y + height + 4;
}

type HelperSummaryEntry = { label: string; value: string };

/** Baut die feste Reihenfolge der kompakten persönlichen PDF-Zusammenfassung. */
export function buildHelperSummaryEntries(input: {
  taskCount: number;
  daySummary: string;
  helperNote?: string | null;
  cakeLines?: string[];
  contactLabel: string;
  contactName?: string | null;
  contactPhone?: string | null;
  footerText?: string | null;
}): HelperSummaryEntry[] {
  const entries: HelperSummaryEntry[] = [
    {
      label: "Einteilung",
      value: `${input.taskCount} ${input.taskCount === 1 ? "Aufgabe" : "Aufgaben"}${input.daySummary ? ` · ${input.daySummary}` : ""}`,
    },
  ];
  if (input.helperNote?.trim())
    entries.push({
      label: "Hinweise",
      value: input.helperNote.trim(),
    });
  const cakeLines = input.cakeLines ?? [];
  if (cakeLines.length > 0)
    entries.push({
      label: cakeLines.length === 1 ? "Spende" : "Spenden",
      value: cakeLines.join(" · "),
    });
  entries.push({
    label: input.contactLabel,
    value: input.contactName?.trim() || "nicht zugeordnet",
  });
  if (input.contactPhone?.trim()) {
    entries.push({
      label: "Rufnummer",
      value: input.contactPhone.trim(),
    });
  }
  if (input.footerText?.trim())
    entries.push({ label: "Hinweis", value: input.footerText.trim() });
  return entries;
}

function compactSummaryHeight(
  doc: PDFKit.PDFDocument,
  entries: HelperSummaryEntry[]
) {
  const labelWidth = 132;
  const valueWidth = helperPdfContentWidth - labelWidth - 28;
  const rows = entries.map(entry => {
    const valueHeight = doc
      .font("Helvetica")
      .fontSize(helperPdfTypography.summaryEntry)
      .heightOfString(entry.value, { width: valueWidth, lineGap: 1 });
    return Math.max(13, valueHeight) + 6;
  });
  return 23 + 16 + rows.reduce((sum, height) => sum + height, 0) + 10;
}

function drawCompactHelperSummary(
  doc: PDFKit.PDFDocument,
  entries: HelperSummaryEntry[]
) {
  const height = compactSummaryHeight(doc, entries);
  ensureHelperPdfSpace(doc, height);
  const y = doc.y;
  const labelWidth = 132;
  const contentX = helperPdfMargin + 10;
  const valueX = contentX + labelWidth;
  const valueWidth = helperPdfContentWidth - labelWidth - 28;
  doc
    .font("Helvetica-Bold")
    .fontSize(helperPdfTypography.summaryTitle)
    .fillColor(helperPdfDesign.accent)
    .text("Zusammenfassung", helperPdfMargin, y);
  const boxY = y + 18;
  const boxHeight = height - 23;
  doc
    .roundedRect(helperPdfMargin, boxY, helperPdfContentWidth, boxHeight, 4)
    .fillAndStroke(helperPdfDesign.box, helperPdfDesign.line);
  let rowY = boxY + 8;
  for (const entry of entries) {
    const valueHeight = doc
      .font("Helvetica")
      .fontSize(helperPdfTypography.summaryEntry)
      .heightOfString(entry.value, { width: valueWidth, lineGap: 1 });
    const rowHeight = Math.max(13, valueHeight) + 6;
    doc
      .font("Helvetica-Bold")
      .fontSize(helperPdfTypography.summaryEntry)
      .fillColor(helperPdfDesign.ink)
      .text(`${entry.label}:`, contentX, rowY, {
        width: labelWidth - 8,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(helperPdfTypography.summaryEntry)
      .fillColor(helperPdfDesign.ink)
      .text(entry.value, valueX, rowY, { width: valueWidth, lineGap: 1 });
    rowY += rowHeight;
  }
  doc.x = helperPdfMargin;
  doc.y = y + height;
}

function sortShifts(a: Shift, b: Shift) {
  const dayOrder = DAYS.indexOf(a.day as Day) - DAYS.indexOf(b.day as Day);
  if (dayOrder !== 0) return dayOrder;
  const timeOrder =
    (toMinutes(a.startTime) ?? -1) - (toMinutes(b.startTime) ?? -1);
  if (timeOrder !== 0) return timeOrder;
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

function parseExtraColumns(settings: AppSettings) {
  try {
    const parsed = JSON.parse(settings.extraColumns);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  settings: AppSettings,
  title: string,
  subtitle?: string,
  logoBuffer?: Buffer,
  usesMyCrewMateWordmark = false
) {
  const headerTop = doc.y;
  const logoWidth = usesMyCrewMateWordmark
    ? 172
    : CUSTOM_EVENT_LOGO_STANDARD_SIZE;
  const logoHeight = usesMyCrewMateWordmark
    ? 52
    : CUSTOM_EVENT_LOGO_STANDARD_SIZE;
  const logoTextReserve = usesMyCrewMateWordmark ? 192 : 148;
  if (logoBuffer) {
    try {
      doc.image(
        logoBuffer,
        doc.page.width - doc.page.margins.right - logoWidth,
        headerTop,
        {
          fit: [logoWidth, logoHeight],
          align: "right",
        }
      );
    } catch {
      // Ein beschädigtes Logo darf den operativen PDF-Export nicht blockieren.
    }
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(colors.ink)
    .text(title, {
      width: logoBuffer ? contentWidth - logoTextReserve : contentWidth,
    });
  doc.moveDown(0.36);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(colors.ink)
    .text(`${settings.eventName} ${settings.eventYear}`.trim(), {
      width: logoBuffer ? contentWidth - logoTextReserve : contentWidth,
    });
  doc.moveDown(0.18);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(colors.muted)
    .text(subtitle ?? `Stand: ${formatDate()} (aus Helferplanung)`, {
      width: logoBuffer ? contentWidth - logoTextReserve : contentWidth,
    });
  if (usesMyCrewMateWordmark && logoBuffer) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.4)
      .fillColor(colors.accent)
      .text(
        MYCREWMATE_PDF_TAGLINE,
        doc.page.width - doc.page.margins.right - logoWidth,
        headerTop + 43,
        { width: logoWidth, align: "center", lineBreak: false }
      );
  }
  if (logoBuffer)
    doc.y = Math.max(
      doc.y,
      headerTop +
        (usesMyCrewMateWordmark ? 67 : CUSTOM_EVENT_LOGO_STANDARD_SIZE + 14)
    );
  doc.moveDown(0.55);
  doc
    .strokeColor(colors.line)
    .lineWidth(0.7)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(1);
}

function drawPlanningTeamAccessSheetHeader(
  doc: PDFKit.PDFDocument,
  wordmarkBuffer?: Buffer
) {
  const headerTop = doc.y;
  const wordmarkWidth = 188;
  if (wordmarkBuffer) {
    try {
      doc.image(wordmarkBuffer, margin, headerTop, {
        fit: [wordmarkWidth, 56],
      });
    } catch {
      // Ein fehlendes Markenbild darf die sichere Zugangsausgabe nicht blockieren.
    }
  }
  if (wordmarkBuffer) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.4)
      .fillColor(colors.accent)
      .text(MYCREWMATE_PDF_TAGLINE, margin, headerTop + 43, {
        width: wordmarkWidth,
        align: "center",
        lineBreak: false,
      });
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(colors.ink)
    .text("Zugangsblatt", margin, headerTop + 4, {
      align: "right",
      width: contentWidth,
      lineBreak: false,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(colors.accent)
    .text("PLANUNGSTEAM", margin, headerTop + 28, {
      align: "right",
      width: contentWidth,
      lineBreak: false,
    });
  if (!wordmarkBuffer) {
    doc
      .font("Helvetica-Bold")
      .fontSize(19)
      .fillColor(colors.ink)
      .text("MyCrewMate", margin, headerTop + 4);
  }
  doc.y = headerTop + 72;
  doc
    .strokeColor(colors.line)
    .lineWidth(0.8)
    .moveTo(margin, doc.y)
    .lineTo(pageWidth - margin, doc.y)
    .stroke();
  doc.moveDown(1.45);
}

function drawPlanningTeamAccessSheetBox(
  doc: PDFKit.PDFDocument,
  title: string,
  lines: Array<{ label: string; value: string }>,
  options: { highlight?: boolean } = {}
) {
  const labelWidth = 138;
  const valueWidth = contentWidth - labelWidth - 32;
  const rowHeights = lines.map(line => {
    const valueHeight = doc
      .font("Helvetica")
      .fontSize(10.5)
      .heightOfString(line.value, { width: valueWidth, lineGap: 2 });
    return Math.max(24, valueHeight + 12);
  });
  const boxHeight =
    42 + rowHeights.reduce((sum, height) => sum + height, 0) + 10;
  const y = doc.y;
  doc
    .roundedRect(margin, y, contentWidth, boxHeight, 6)
    .fillAndStroke(
      options.highlight ? "#FEF2F2" : "#F8FAFC",
      options.highlight ? "#FCA5A5" : colors.line
    );
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(options.highlight ? "#991B1B" : colors.accent)
    .text(title, margin + 14, y + 13, { lineBreak: false });
  let rowY = y + 34;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (index > 0) {
      doc
        .strokeColor(options.highlight ? "#FECACA" : colors.line)
        .lineWidth(0.5)
        .moveTo(margin + 14, rowY - 5)
        .lineTo(pageWidth - margin - 14, rowY - 5)
        .stroke();
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(colors.muted)
      .text(line.label, margin + 14, rowY + 2, {
        width: labelWidth - 12,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(colors.ink)
      .text(line.value, margin + labelWidth, rowY, {
        width: valueWidth,
        lineGap: 2,
      });
    rowY += rowHeights[index];
  }
  doc.x = margin;
  doc.y = y + boxHeight;
}

/** Erzeugt ein DIN-A4-Zugangsblatt je Ansprechpartner; Klartextcodes bleiben optional und einmalig. */
export function renderPlanningTeamAccessSheetsPdf(
  sheets: PlanningTeamAccessSheet[],
  wordmarkBuffer?: Buffer
) {
  if (sheets.length === 0) {
    throw new Error(
      "Es sind keine Ansprechpartner-Zugänge für den Druck vorhanden"
    );
  }
  return collectPdf(doc => {
    sheets.forEach((sheet, index) => {
      if (index > 0) doc.addPage();
      drawPlanningTeamAccessSheetHeader(doc, wordmarkBuffer);
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(colors.ink)
        .text(sheet.contactName, margin, doc.y);
      doc.moveDown(0.35);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(colors.muted)
        .text(
          "Persönlicher Planungsteam-Zugang · Bitte vertraulich behandeln."
        );
      doc.moveDown(1);

      drawPlanningTeamAccessSheetBox(doc, "Zugang", [
        { label: "Zugangs-URL", value: MYCREWMATE_ACCESS_URL },
        { label: "Rolle", value: "Planungsteam" },
      ]);
      doc.moveDown(0.9);

      if (sheet.initialPassword) {
        drawPlanningTeamAccessSheetBox(
          doc,
          "Einmalig ausgegebener Zugangscode",
          [{ label: "Passwort", value: sheet.initialPassword }],
          { highlight: true }
        );
        doc.moveDown(0.9);
      } else {
        drawPlanningTeamAccessSheetBox(doc, "Passwort", [
          {
            label: "Hinweis",
            value:
              "Passwort bereits vergeben / Aus Sicherheitsgründen nicht erneut abrufbar. Bei Verlust bitte Passwort über den Administrator zurücksetzen lassen.",
          },
        ]);
        doc.moveDown(0.9);
      }

      drawPlanningTeamAccessSheetBox(doc, "Freigegebene Veranstaltungen", [
        {
          label: "Freigaben",
          value:
            sheet.events.length > 0
              ? sheet.events
                  .map(event => `• ${event.year} · ${event.name}`)
                  .join("\n")
              : "Keine Veranstaltungen freigegeben.",
        },
      ]);
      doc.moveDown(1.1);
      const noticeY = doc.y;
      doc
        .roundedRect(margin, noticeY, contentWidth, 62, 6)
        .fillAndStroke("#FFF7ED", "#FED7AA");
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#9A3412")
        .text("Sicherheitshinweis", margin + 14, noticeY + 11, {
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(colors.ink)
        .text(
          "Dieses Zugangsblatt ist vertraulich. Den Zugangscode nicht weitergeben, nicht digital speichern und nach der Erstausgabe sicher verwahren.",
          margin + 14,
          noticeY + 27,
          { width: contentWidth - 28, lineGap: 1 }
        );
    });
  });
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  required: number,
  repeat?: () => void
) {
  const bottom = doc.page.height - doc.page.margins.bottom - 22;
  if (doc.y + required <= bottom) return;
  doc.addPage();
  if (repeat) repeat();
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  x: number
) {
  const y = doc.y;
  const height = 26;
  doc
    .rect(
      x,
      y,
      columns.reduce((sum, column) => sum + column.width, 0),
      height
    )
    .fillAndStroke(colors.header, colors.line);
  let cursor = x;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink);
  for (const column of columns) {
    doc.text(column.label, cursor + 5, y + 8, {
      width: column.width - 10,
      align: column.align ?? "left",
      lineBreak: false,
    });
    cursor += column.width;
    doc
      .moveTo(cursor, y)
      .lineTo(cursor, y + height)
      .strokeColor(colors.line)
      .stroke();
  }
  doc.x = x;
  doc.y = y + height;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  values: Record<string, string>,
  x: number,
  options: {
    minimumHeight?: number;
    highlightedTaskNote?: string | null;
  } = {}
) {
  doc.font("Helvetica").fontSize(9);
  const heights = columns.map(column =>
    doc.heightOfString(values[column.key] ?? "", {
      width: column.width - 10,
      lineGap: 1,
    })
  );
  const height = Math.max(
    options.minimumHeight ?? 27,
    Math.max(...heights) + 14
  );
  ensureSpace(doc, height + 5, () => drawTableHeader(doc, columns, x));
  const y = doc.y;
  const width = columns.reduce((sum, column) => sum + column.width, 0);
  doc
    .rect(x, y, width, height)
    .strokeColor(colors.line)
    .lineWidth(0.6)
    .stroke();
  let cursor = x;
  for (const column of columns) {
    const columnValue = values[column.key] ?? "";
    const isHighlightedTaskNote =
      column.key === "task" && Boolean(options.highlightedTaskNote);
    const highlightedTaskNote = isHighlightedTaskNote
      ? options.highlightedTaskNote!
      : null;
    const primaryTaskText = isHighlightedTaskNote
      ? columnValue
          .slice(0, Math.max(0, columnValue.lastIndexOf(highlightedTaskNote!)))
          .replace(/\n+$/, "")
      : columnValue;
    doc.fillColor(colors.ink).text(primaryTaskText, cursor + 5, y + 7, {
      width: column.width - 10,
      height: height - 10,
      align: column.align ?? "left",
      lineGap: 1,
    });
    if (highlightedTaskNote) {
      const noteY =
        y +
        7 +
        doc.heightOfString(primaryTaskText, {
          width: column.width - 10,
          lineGap: 1,
        }) +
        4;
      const noteHeight = doc.heightOfString(highlightedTaskNote, {
        width: column.width - 14,
        lineGap: 1,
      });
      doc
        .roundedRect(cursor + 4, noteY - 1, column.width - 8, noteHeight + 4, 2)
        .fill(helperPdfPastels.shiftNoteBackground);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(helperPdfPastels.shiftNoteText)
        .text(highlightedTaskNote, cursor + 5, noteY + 2, {
          width: column.width - 10,
          height: height - (noteY - y) - 5,
          lineGap: 1,
        });
    }
    cursor += column.width;
    doc
      .moveTo(cursor, y)
      .lineTo(cursor, y + height)
      .strokeColor(colors.line)
      .stroke();
  }
  doc.x = x;
  doc.y = y + height;
}

export function renderHelperTaskPdf(data: PlanningData, helperId: number) {
  const helper = data.helpers.find(item => item.id === helperId);
  if (!helper) throw new Error("Helfer wurde nicht gefunden");
  const contact = data.contacts.find(item => item.id === helper.contactId);
  const shiftById = new Map(data.shifts.map(shift => [shift.id, shift]));
  const helperById = new Map(data.helpers.map(item => [item.id, item]));
  const assignmentsByShift = new Map<number, Assignment[]>();
  for (const assignment of data.assignments) {
    if (!assignmentsByShift.has(assignment.shiftId))
      assignmentsByShift.set(assignment.shiftId, []);
    assignmentsByShift.get(assignment.shiftId)!.push(assignment);
  }
  const helperShifts = data.assignments
    .filter(assignment => assignment.helperId === helperId)
    .map(assignment => shiftById.get(assignment.shiftId))
    .filter((shift): shift is Shift => Boolean(shift))
    .sort(sortShifts);
  const helperCakes = selectHelperCakes(data.cakes, helper.name);
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );
  const helperCakeLines = helperCakes.map(cake =>
    helperCakeSummaryLine(cake, locationById)
  );

  return collectPdf(doc => {
    drawCompactHelperHeader(
      doc,
      data.settings,
      helper.name,
      data.logoBuffer,
      data.usesMyCrewMateWordmark
    );

    if (helperShifts.length === 0) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor(helperPdfDesign.muted)
        .text("Keine Aufgaben in der Helfereinteilung gefunden.");
      doc.moveDown(1);
    } else {
      for (const day of DAYS) {
        const dayShifts = helperShifts.filter(shift => shift.day === day);
        if (dayShifts.length === 0) continue;
        drawCompactHelperDayHeading(doc, helper, day);
        for (const shift of dayShifts) {
          const team = (assignmentsByShift.get(shift.id) ?? [])
            .filter(assignment => assignment.helperId !== helperId)
            .map(assignment => helperById.get(assignment.helperId)?.name)
            .filter((name): name is string => Boolean(name))
            .join(", ");
          drawCompactHelperShiftBlock(
            doc,
            shift,
            team,
            shift.locationId
              ? (locationById.get(shift.locationId) ?? null)
              : null
          );
        }
      }
    }

    const daySummary = DAYS.map(day => {
      const dayShifts = helperShifts.filter(shift => shift.day === day);
      if (dayShifts.length === 0) return null;
      return `${day}: ${dayShifts.map(shift => shift.task).join(", ")}`;
    })
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    const summaryEntries = buildHelperSummaryEntries({
      taskCount: helperShifts.length,
      daySummary,
      helperNote: helper.note,
      cakeLines: helperCakeLines,
      contactLabel: data.settings.contactLabel,
      contactName: contact?.name,
      contactPhone: contact?.sharePhoneInHelperPlan ? contact?.phone : null,
      footerText: data.settings.footerText,
    });
    const summaryHeight = compactSummaryHeight(doc, summaryEntries);
    const bottomAnchoredSummaryY = helperPdfBottom - summaryHeight - 10;
    doc.y = Math.max(doc.y + 6, bottomAnchoredSummaryY);
    drawCompactHelperSummary(doc, summaryEntries);
  });
}

/**
 * Reduzierte Datenansicht für persönlich freigegebene Helferlinks. Sie enthält
 * bewusst keine Mithelfenden, Hinweise oder Spenden anderer Personen,
 * Verfügbarkeiten oder Schichtbemerkungen. Eigene Hinweise und eigene
 * Verpflegungsspenden des Empfängers dürfen erscheinen. Die ausführliche
 * Übersicht bleibt ausschließlich für angemeldete, berechtigte Personen bestimmt.
 */
export type PublicHelperTaskEntry = {
  day: Day;
  time: string;
  task: string;
  locationLink: ReturnType<typeof helperPdfLocationLink>;
};

export function selectPublicHelperTaskEntries(
  data: PlanningData,
  helperId: number
) {
  const helper = data.helpers.find(item => item.id === helperId);
  if (!helper) throw new Error("Helfer wurde nicht gefunden");
  const shiftById = new Map(data.shifts.map(shift => [shift.id, shift]));
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );

  return data.assignments
    .filter(assignment => assignment.helperId === helperId)
    .map(assignment => shiftById.get(assignment.shiftId))
    .filter((shift): shift is Shift => Boolean(shift))
    .sort(sortShifts)
    .map(shift => ({
      day: shift.day as Day,
      time: helperPdfTimeLabel(shift),
      task: shift.task.trim() || "Aufgabe",
      locationLink: shift.locationId
        ? helperPdfLocationLink(locationById.get(shift.locationId) ?? null)
        : null,
    }));
}

export type PublicHelperOwnDetails = {
  helperNote: string | null;
  cakeLines: string[];
};

/** Wählt ausschließlich Angaben, die der Empfänger selbst für seinen Einsatz hinterlegt hat. */
export function selectPublicHelperOwnDetails(
  data: PlanningData,
  helperId: number
): PublicHelperOwnDetails {
  const helper = data.helpers.find(item => item.id === helperId);
  if (!helper) throw new Error("Helfer wurde nicht gefunden");
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );
  return {
    helperNote: helper.note?.trim() || null,
    cakeLines: selectHelperCakes(data.cakes, helper.name).map(cake =>
      helperCakeSummaryLine(cake, locationById)
    ),
  };
}

function drawPublicHelperHeader(
  doc: PDFKit.PDFDocument,
  settings: AppSettings,
  helperName: string,
  contact?: Contact
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(helperPdfDesign.ink)
    .text("Persönliche Einsatzübersicht", helperPdfMargin, helperPdfMargin, {
      width: helperPdfContentWidth,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(helperPdfDesign.accent)
    .text(helperName, { width: helperPdfContentWidth });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(helperPdfDesign.ink)
    .text(`${settings.eventName} ${settings.eventYear}`.trim(), {
      width: helperPdfContentWidth,
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(helperPdfDesign.muted)
    .text(
      `Eigene Einsätze · ${contact?.name?.trim() ? `${settings.contactLabel}: ${contact.name.trim()}` : "bei Fragen an die Einsatzleitung"} · Stand: ${formatDate()}`,
      {
        width: helperPdfContentWidth,
      }
    );
  const lineY = doc.y + 8;
  doc
    .moveTo(helperPdfMargin, lineY)
    .lineTo(doc.page.width - helperPdfMargin, lineY)
    .strokeColor(helperPdfDesign.line)
    .lineWidth(0.7)
    .stroke();
  doc.x = helperPdfMargin;
  doc.y = lineY + 14;
}

function drawPublicHelperTaskEntry(
  doc: PDFKit.PDFDocument,
  entry: PublicHelperTaskEntry
) {
  const locationLabel = entry.locationLink?.label ?? null;
  const taskHeight = doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .heightOfString(entry.task, {
      width: helperPdfContentWidth - 82,
      lineGap: 1,
    });
  const locationHeight = locationLabel
    ? doc
        .font("Helvetica")
        .fontSize(9)
        .heightOfString(locationLabel, {
          width: helperPdfContentWidth - 82,
          lineGap: 1,
        })
    : 0;
  const height = Math.max(50, taskHeight + locationHeight + 28);
  ensureHelperPdfSpace(doc, height + 10);
  const top = doc.y;
  doc
    .roundedRect(helperPdfMargin, top, helperPdfContentWidth, height, 7)
    .fillAndStroke("#F8FAFC", helperPdfDesign.line);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(helperPdfDesign.accent)
    .text(entry.day, helperPdfMargin + 12, top + 11, { width: 64 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(helperPdfDesign.muted)
    .text(entry.time, helperPdfMargin + 12, top + 27, { width: 64 });
  const contentX = helperPdfMargin + 86;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(helperPdfDesign.ink)
    .text(entry.task, contentX, top + 11, {
      width: helperPdfContentWidth - 98,
      lineGap: 1,
    });
  if (locationLabel) {
    const locationY = top + 16 + taskHeight;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(helperPdfDesign.accent)
      .text(`⌖ ${locationLabel}`, contentX, locationY, {
        width: helperPdfContentWidth - 98,
        lineGap: 1,
      });
    if (entry.locationLink) {
      doc.link(
        contentX,
        locationY,
        helperPdfContentWidth - 98,
        locationHeight + 12,
        entry.locationLink.url
      );
    }
  }
  doc.x = helperPdfMargin;
  doc.y = top + height + 8;
}

function drawPublicHelperOwnDetails(
  doc: PDFKit.PDFDocument,
  details: PublicHelperOwnDetails
) {
  const entries: HelperSummaryEntry[] = [];
  if (details.helperNote) {
    entries.push({ label: "Eigene Hinweise", value: details.helperNote });
  }
  if (details.cakeLines.length > 0) {
    entries.push({
      label: details.cakeLines.length === 1 ? "Eigene Spende" : "Eigene Spenden",
      value: details.cakeLines.join(" · "),
    });
  }
  if (!entries.length) return;

  const labelWidth = 108;
  const valueWidth = helperPdfContentWidth - labelWidth - 28;
  const rowHeights = entries.map(entry => {
    const valueHeight = doc
      .font("Helvetica")
      .fontSize(9)
      .heightOfString(entry.value, { width: valueWidth, lineGap: 1 });
    return Math.max(14, valueHeight) + 7;
  });
  const height = 29 + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) + 8;
  ensureHelperPdfSpace(doc, height + 8);
  const top = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(helperPdfDesign.accent)
    .text("Eigene Angaben", helperPdfMargin, top);
  const boxY = top + 17;
  doc
    .roundedRect(helperPdfMargin, boxY, helperPdfContentWidth, height - 17, 5)
    .fillAndStroke("#F8FAFC", helperPdfDesign.line);
  let rowY = boxY + 8;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(helperPdfDesign.ink)
      .text(`${entry.label}:`, helperPdfMargin + 10, rowY, {
        width: labelWidth - 8,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(helperPdfDesign.ink)
      .text(entry.value, helperPdfMargin + 10 + labelWidth, rowY, {
        width: valueWidth,
        lineGap: 1,
      });
    rowY += rowHeights[index];
  }
  doc.x = helperPdfMargin;
  doc.y = top + height + 6;
}

export function renderPublicHelperTaskPdf(
  data: PlanningData,
  helperId: number
) {
  const helper = data.helpers.find(item => item.id === helperId);
  if (!helper) throw new Error("Helfer wurde nicht gefunden");
  const contact = data.contacts.find(item => item.id === helper.contactId);
  const entries = selectPublicHelperTaskEntries(data, helperId);
  const ownDetails = selectPublicHelperOwnDetails(data, helperId);

  return collectPdf(doc => {
    drawPublicHelperHeader(doc, data.settings, helper.name, contact);
    if (!entries.length) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor(helperPdfDesign.muted)
        .text("Derzeit sind keine eigenen Einsätze eingetragen.");
    } else {
      for (const entry of entries) drawPublicHelperTaskEntry(doc, entry);
    }
    drawPublicHelperOwnDetails(doc, ownDetails);
    ensureHelperPdfSpace(doc, 44);
    doc
      .moveTo(helperPdfMargin, doc.y + 4)
      .lineTo(doc.page.width - helperPdfMargin, doc.y + 4)
      .strokeColor(helperPdfDesign.line)
      .lineWidth(0.6)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(helperPdfDesign.muted)
      .text(
        contact?.sharePhoneInHelperPlan && contact.phone
          ? `Bei Rückfragen: ${contact.name} · ${contact.phone}`
          : "Bei Rückfragen wenden Sie sich bitte an die Einsatzleitung.",
        helperPdfMargin,
        doc.y + 13,
        { width: helperPdfContentWidth }
      );
  });
}

export type PlanPdfOptions = {
  mode: "blank" | "filled";
  days?: Day[];
  areas?: string[];
  statuses?: Array<"OFFEN" | "KNAPP" | "OK">;
  contactIds?: number[];
  includeUnassignedContact?: boolean;
};

export function selectPlanEvaluations(
  data: PlanningData,
  options: PlanPdfOptions
) {
  const selectedDays = new Set(options.days ?? []);
  const selectedAreas = new Set(options.areas ?? []);
  const selectedStatuses = new Set(options.statuses ?? []);
  const selectedContacts = new Set(options.contactIds ?? []);
  const hasContactFilter =
    options.contactIds !== undefined ||
    options.includeUnassignedContact !== undefined;
  const areaContactByArea = new Map(
    (data.areaContacts ?? []).map(item => [item.area, item.contactId])
  );
  return evaluateShifts(data.shifts, data.assignments, data.helpers)
    .filter(item => {
      const contactId = areaContactByArea.get(item.shift.area) ?? null;
      const contactMatches =
        contactId === null
          ? options.includeUnassignedContact === true
          : selectedContacts.has(contactId);
      return (
        (!selectedDays.size || selectedDays.has(item.shift.day as Day)) &&
        (!selectedAreas.size || selectedAreas.has(item.shift.area)) &&
        (!selectedStatuses.size || selectedStatuses.has(item.status)) &&
        (!hasContactFilter || contactMatches)
      );
    })
    .sort((left, right) => sortShifts(left.shift, right.shift));
}

export function renderPlanPdf(
  data: PlanningData,
  options: PlanPdfOptions = { mode: "blank" }
) {
  const extraColumns =
    options.mode === "blank" ? parseExtraColumns(data.settings) : [];
  const contactById = new Map(
    data.contacts.map(contact => [contact.id, contact])
  );
  const areaContactByArea = new Map(
    (data.areaContacts ?? []).map(item => [item.area, item.contactId])
  );
  const helperById = new Map(data.helpers.map(helper => [helper.id, helper]));
  const assignmentsByShift = new Map<number, Assignment[]>();
  for (const assignment of data.assignments) {
    if (!assignmentsByShift.has(assignment.shiftId))
      assignmentsByShift.set(assignment.shiftId, []);
    assignmentsByShift.get(assignment.shiftId)!.push(assignment);
  }
  const evaluations = selectPlanEvaluations(data, options);

  return collectPdf(doc => {
    const landscapeWidth = doc.page.width - margin * 2;
    drawDocumentHeader(
      doc,
      data.settings,
      options.mode === "blank"
        ? data.settings.blankPlanTitle
        : `${data.settings.eventName} – ausgefüllter Einsatzplan`,
      `Stand: ${formatDate()} · ${options.mode === "blank" ? "frei ausfüllbare Planung" : "aktuelle Helfereinteilung"}`,
      data.logoBuffer,
      data.usesMyCrewMateWordmark
    );
    const fixedColumns: PdfColumn[] = [
      { key: "day", label: "Tag", width: 48 },
      { key: "area", label: "Bereich", width: 76 },
      { key: "task", label: "Aufgabe", width: 104 },
      { key: "time", label: "Zeit", width: 62 },
      { key: "status", label: "Status", width: 48 },
      { key: "contact", label: data.settings.contactLabel, width: 92 },
      { key: "note", label: "Bemerkung", width: 92 },
      { key: "helper", label: "Helfer / Name", width: 104 },
    ];
    const fixedWidth = fixedColumns.reduce(
      (sum, column) => sum + column.width,
      0
    );
    const availableExtraWidth = Math.max(0, landscapeWidth - fixedWidth);
    const columns = [
      ...fixedColumns,
      ...extraColumns.map((label, index) => ({
        key: `extra-${index}`,
        label,
        width: availableExtraWidth / extraColumns.length,
      })),
    ];
    if (extraColumns.length === 0)
      columns[columns.length - 1].width += availableExtraWidth;

    drawTableHeader(doc, columns, margin);
    if (evaluations.length === 0) {
      for (
        let index = 0;
        index < Math.max(8, data.settings.blankRowsPerShift);
        index++
      ) {
        drawTableRow(doc, columns, {}, margin, { minimumHeight: 31 });
      }
    } else {
      for (const evaluation of evaluations) {
        const shift = evaluation.shift;
        const areaContactId = areaContactByArea.get(shift.area) ?? null;
        const areaContact = areaContactId
          ? contactById.get(areaContactId)
          : undefined;
        const shiftAssignments = (assignmentsByShift.get(shift.id) ?? []).sort(
          (left, right) => left.slot - right.slot
        );
        const assignmentBySlot = new Map(
          shiftAssignments.map(assignment => [assignment.slot, assignment])
        );
        const rowCount = Math.max(
          1,
          shift.needed,
          options.mode === "blank" ? data.settings.blankRowsPerShift : 0
        );
        for (let row = 0; row < rowCount; row++) {
          const assignment = assignmentBySlot.get(row);
          const helper = assignment
            ? helperById.get(assignment.helperId)
            : undefined;
          const extraValues = Object.fromEntries(
            extraColumns.map((_, index) => [`extra-${index}`, ""])
          );
          drawTableRow(
            doc,
            columns,
            {
              day: row === 0 ? shift.day : "",
              area: row === 0 ? shift.area : "",
              task: row === 0 ? shift.task : "",
              time: row === 0 ? planPdfTimeLabel(shift) : "",
              status: row === 0 ? evaluation.status : "",
              contact:
                row === 0 ? (areaContact?.name ?? "nicht zugeordnet") : "",
              note: row === 0 ? (shift.note?.trim() ?? "") : "",
              helper:
                options.mode === "filled"
                  ? (helper?.name ?? (row < shift.needed ? "offen" : ""))
                  : "",
              ...extraValues,
            },
            margin,
            { minimumHeight: 28 }
          );
        }
      }
    }
    if (data.settings.footerText) {
      doc.moveDown(0.6);
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(colors.muted)
        .text(data.settings.footerText);
    }
  }, "landscape");
}

export function renderBlankPlanPdf(data: PlanningData) {
  return renderPlanPdf(data, { mode: "blank" });
}

/** Auswahl der Inhaltsblöcke einer Ansprechpartner-Übersicht. */
export type ContactOverviewPdfOptions = {
  includeShifts: boolean;
  includePreparation: boolean;
  includePostProcessing: boolean;
  includeMaterials: boolean;
};

export const CONTACT_CHECKLIST_MARKER = "[ ]";

type ContactOverviewRows = {
  shifts: Array<{
    shift: Shift;
    responsibility: string;
    status: "OFFEN" | "KNAPP" | "OK";
    helpers: string;
  }>;
  prepTasks: PrepTask[];
  postTasks: PostTask[];
  materials: Material[];
};

/**
 * Bündelt alle operativen Inhalte eines Ansprechpartners. Bereichsverantwortung
 * wird über die Zuordnung der Einsatzplanbereiche ermittelt; zusätzlich werden
 * eigene Schichten berücksichtigt, wenn der Ansprechpartner selbst als Helfer
 * eingeteilt ist.
 */
export function selectContactOverviewRows(
  data: PlanningData,
  contactId: number
): ContactOverviewRows {
  const responsibleAreas = new Set(
    (data.areaContacts ?? [])
      .filter(item => item.contactId === contactId)
      .map(item => item.area)
  );
  const ownHelperIds = new Set(
    data.helpers
      .filter(helper => helper.contactId === contactId)
      .map(helper => helper.id)
  );
  const ownShiftIds = new Set(
    data.assignments
      .filter(assignment => ownHelperIds.has(assignment.helperId))
      .map(assignment => assignment.shiftId)
  );
  const helperById = new Map(data.helpers.map(helper => [helper.id, helper]));
  const assignmentsByShift = new Map<number, Assignment[]>();
  for (const assignment of data.assignments) {
    if (!assignmentsByShift.has(assignment.shiftId))
      assignmentsByShift.set(assignment.shiftId, []);
    assignmentsByShift.get(assignment.shiftId)!.push(assignment);
  }
  const statusByShiftId = new Map(
    evaluateShifts(data.shifts, data.assignments, data.helpers).map(item => [
      item.shift.id,
      item.status,
    ])
  );

  return {
    shifts: data.shifts
      .filter(
        shift => responsibleAreas.has(shift.area) || ownShiftIds.has(shift.id)
      )
      .sort(sortShifts)
      .map(shift => {
        const responsibility = [
          responsibleAreas.has(shift.area) ? "Bereichsverantwortung" : null,
          ownShiftIds.has(shift.id) ? "eigene Schicht" : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join(" · ");
        const helpers = (assignmentsByShift.get(shift.id) ?? [])
          .sort((left, right) => left.slot - right.slot)
          .map(assignment => helperById.get(assignment.helperId)?.name)
          .filter((name): name is string => Boolean(name))
          .join(", ");
        return {
          shift,
          responsibility,
          status: statusByShiftId.get(shift.id) ?? "OFFEN",
          helpers: helpers || "offen",
        };
      }),
    prepTasks: (data.prepTasks ?? [])
      .filter(task => task.contactId === contactId)
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category, "de") ||
          left.sortOrder - right.sortOrder ||
          left.id - right.id
      ),
    postTasks: (data.postTasks ?? [])
      .filter(task => task.contactId === contactId)
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category, "de") ||
          left.sortOrder - right.sortOrder ||
          left.id - right.id
      ),
    materials: (data.materials ?? [])
      .filter(material => material.contactId === contactId)
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category, "de") ||
          left.article.localeCompare(right.article, "de") ||
          left.sortOrder - right.sortOrder ||
          left.id - right.id
      ),
  };
}

function drawContactOverviewSection(
  doc: PDFKit.PDFDocument,
  title: string,
  description: string
) {
  ensureSpace(doc, 44);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(colors.accent).text(title);
  doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted).text(description);
  doc.moveDown(0.55);
}

/**
 * Erstellt die persönliche Arbeitsmappe eines Ansprechpartners. Die
 * Planinformationen bleiben als Tabelle lesbar; für operative Aufgaben wird
 * bewusst ein gedrucktes "[ ]" pro Zeile erzeugt, damit die PDF auch als
 * Papier-Checkliste nutzbar ist.
 */
export function renderContactOverviewPdf(
  data: PlanningData,
  contactId: number,
  options: ContactOverviewPdfOptions
) {
  const contact = data.contacts.find(item => item.id === contactId);
  if (!contact) throw new Error("Ansprechpartner wurde nicht gefunden");
  const rows = selectContactOverviewRows(data, contactId);
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );

  return collectPdf(doc => {
    const landscapeWidth = doc.page.width - margin * 2;
    drawDocumentHeader(
      doc,
      data.settings,
      `Ansprechpartner-Übersicht – ${contact.name}`,
      [
        contact.phone?.trim() ? `Rufnummer: ${contact.phone.trim()}` : null,
        `Stand: ${formatDate()}`,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · "),
      data.logoBuffer,
      data.usesMyCrewMateWordmark
    );

    if (options.includeShifts) {
      drawContactOverviewSection(
        doc,
        "Einsatzplan & Schichten",
        "Bereichsverantwortung und eigene Schichten in tabellarischer Übersicht."
      );
      const columns: PdfColumn[] = [
        { key: "day", label: "Tag", width: 56 },
        { key: "time", label: "Zeit", width: 64 },
        { key: "area", label: "Bereich", width: 88 },
        { key: "task", label: "Aufgabe", width: 176 },
        { key: "responsibility", label: "Zuordnung", width: 112 },
        { key: "status", label: "Status", width: 56, align: "center" },
        {
          key: "helpers",
          label: "Eingeteilte Helfer",
          width: landscapeWidth - 552,
        },
      ];
      drawTableHeader(doc, columns, margin);
      if (rows.shifts.length === 0) {
        drawTableRow(
          doc,
          columns,
          {
            task: "Keine Bereichsverantwortung oder eigenen Schichten vorhanden.",
          },
          margin,
          { minimumHeight: 32 }
        );
      }
      for (const item of rows.shifts) {
        drawTableRow(
          doc,
          columns,
          {
            day: item.shift.day,
            time: item.shift.allowFlexibleAssignment
              ? `${helperPdfTimeLabel(item.shift)}\n(flexibel)`
              : helperPdfTimeLabel(item.shift),
            area: item.shift.area,
            task: item.shift.note?.trim()
              ? `${item.shift.task}\nBemerkung: ${item.shift.note.trim()}`
              : item.shift.task,
            responsibility: item.responsibility,
            status: item.status,
            helpers: item.helpers,
          },
          margin,
          { minimumHeight: 30 }
        );
      }
    }

    const checklistColumns: PdfColumn[] = [
      { key: "check", label: "", width: 30, align: "center" },
      { key: "category", label: "Bereich", width: 88 },
      { key: "task", label: "Aufgabe / Artikel", width: 188 },
      { key: "location", label: "Ort", width: 88 },
      { key: "due", label: "Frist / Menge", width: 82 },
      { key: "status", label: "Status", width: 70, align: "center" },
      { key: "note", label: "Hinweis", width: landscapeWidth - 546 },
    ];

    if (options.includePreparation) {
      drawContactOverviewSection(
        doc,
        "Vorbereitung",
        "Zum Ausdrucken: Die Kästchen links können vor Ort oder im Team abgehakt werden."
      );
      drawTableHeader(doc, checklistColumns, margin);
      if (rows.prepTasks.length === 0) {
        drawTableRow(
          doc,
          checklistColumns,
          { task: "Keine Vorbereitungsaufgaben zugeordnet." },
          margin,
          { minimumHeight: 32 }
        );
      }
      for (const task of rows.prepTasks) {
        drawTableRow(
          doc,
          checklistColumns,
          {
            check: CONTACT_CHECKLIST_MARKER,
            category: task.category || "–",
            task: task.task,
            location: task.locationId
              ? (locationById.get(task.locationId)?.name ?? "–")
              : "–",
            due: task.dueText.trim() || "–",
            status: taskOverviewStatusLabel(task, "prep"),
            note: latestPreparationLogbookEntry(task.note) || "–",
          },
          margin,
          { minimumHeight: 30 }
        );
      }
    }

    if (options.includePostProcessing) {
      drawContactOverviewSection(
        doc,
        "Nachbereitung",
        "Zum Ausdrucken: Die Kästchen links können vor Ort oder im Team abgehakt werden."
      );
      drawTableHeader(doc, checklistColumns, margin);
      if (rows.postTasks.length === 0) {
        drawTableRow(
          doc,
          checklistColumns,
          { task: "Keine Nachbereitungsaufgaben zugeordnet." },
          margin,
          { minimumHeight: 32 }
        );
      }
      for (const task of rows.postTasks) {
        drawTableRow(
          doc,
          checklistColumns,
          {
            check: CONTACT_CHECKLIST_MARKER,
            category: task.category || "–",
            task: task.task,
            location: task.locationId
              ? (locationById.get(task.locationId)?.name ?? "–")
              : "–",
            due: task.dueText.trim() || "–",
            status: taskOverviewStatusLabel(task, "post"),
            note: task.note?.trim() || "–",
          },
          margin,
          { minimumHeight: 30 }
        );
      }
    }

    if (options.includeMaterials) {
      drawContactOverviewSection(
        doc,
        "Material",
        "Zum Ausdrucken: Die Kästchen links dienen als Material- und Abnahme-Checkliste."
      );
      drawTableHeader(doc, checklistColumns, margin);
      if (rows.materials.length === 0) {
        drawTableRow(
          doc,
          checklistColumns,
          { task: "Keine Materialartikel zugeordnet." },
          margin,
          { minimumHeight: 32 }
        );
      }
      for (const material of rows.materials) {
        drawTableRow(
          doc,
          checklistColumns,
          {
            check: CONTACT_CHECKLIST_MARKER,
            category: material.category || "–",
            task: material.article,
            location: material.locationId
              ? (locationById.get(material.locationId)?.name ?? "–")
              : "–",
            due:
              [material.quantity, material.unit].filter(Boolean).join(" ") ||
              "–",
            status: materialStatusText(material.status),
            note: material.note?.trim() || "–",
          },
          margin,
          { minimumHeight: 30 }
        );
      }
    }
  }, "landscape");
}

/** Wählt ausschließlich die in der aktuellen Tabellenansicht sichtbaren Artikel aus. */
export function selectMaterialPacklistMaterials(
  materials: Material[] | undefined,
  materialIds: number[]
) {
  const selectedIds = new Set(materialIds);
  return (materials ?? [])
    .filter(material => selectedIds.has(material.id))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category, "de") ||
        left.article.localeCompare(right.article, "de") ||
        left.sortOrder - right.sortOrder
    );
}

/** Erstellt eine operative Packliste für die aktuell sichtbare Materialauswahl. */
export function renderMaterialPacklistPdf(
  data: PlanningData,
  materialIds: number[]
) {
  const contactById = new Map(
    data.contacts.map(contact => [contact.id, contact])
  );
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );
  const selectedMaterials = selectMaterialPacklistMaterials(
    data.materials,
    materialIds
  );

  return collectPdf(doc => {
    drawDocumentHeader(
      doc,
      data.settings,
      "Material-Packliste – Gefilterte Ansicht",
      `Aktuelle Tabellenansicht · Stand: ${formatDate()}`,
      data.logoBuffer,
      data.usesMyCrewMateWordmark
    );
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(colors.muted)
      .text(
        "Diese Liste enthält genau die aktuell gefilterten Materialartikel. Vor Ort bitte Menge, Zustand und Vollständigkeit prüfen."
      );
    doc.moveDown(1);

    const columns: PdfColumn[] = MATERIAL_PACKLIST_PORTRAIT_COLUMNS.map(
      column =>
        column.key === "contact"
          ? { ...column, label: data.settings.contactLabel }
          : { ...column }
    );
    drawTableHeader(doc, columns, margin);
    if (selectedMaterials.length === 0) {
      drawTableRow(
        doc,
        columns,
        {
          article:
            "Für die aktuelle Filterauswahl sind keine Artikel sichtbar.",
        },
        margin,
        { minimumHeight: 34 }
      );
    } else {
      for (const material of selectedMaterials) {
        const quantity = [material.quantity, material.unit]
          .filter(Boolean)
          .join(" ");
        drawTableRow(
          doc,
          columns,
          {
            article: material.note?.trim()
              ? `${material.article}\nNotiz: ${material.note.trim()}`
              : material.article,
            category: material.category || "–",
            quantity: quantity || "–",
            location: material.locationId
              ? (locationById.get(material.locationId)?.name ?? "–")
              : "–",
            status: materialStatusText(material.status),
            contact: material.contactId
              ? (contactById.get(material.contactId)?.name ?? "–")
              : "–",
          },
          margin
        );
      }
    }
    doc.moveDown(1.2);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(colors.ink)
      .text("Abnahme vor Ort");
    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(colors.ink)
      .text(
        "Geprüft von: ______________________________    Datum / Uhrzeit: ______________________________"
      );
  });
}

/** Wählt ausschließlich die in der aktuellen Spendenansicht sichtbaren Zeilen aus. */
export function selectDonationOverviewRows(
  donations: Cake[] | undefined,
  donationIds: number[]
) {
  const selectedIds = new Set(donationIds);
  return (donations ?? [])
    .filter(donation => selectedIds.has(donation.id))
    .sort(
      (left, right) =>
        (left.dropoffDate || "9999-12-31").localeCompare(
          right.dropoffDate || "9999-12-31"
        ) ||
        (left.dropoffTime || "99:99").localeCompare(
          right.dropoffTime || "99:99"
        ) ||
        left.donor.localeCompare(right.donor, "de") ||
        left.cake.localeCompare(right.cake, "de") ||
        left.id - right.id
    );
}

export function donationCategoryLabel(category: Cake["donationCategory"]) {
  if (category === "salat") return "Salat";
  if (category === "snack") return "Dessert";
  if (category === "sonstiges") return "Sonstiges";
  return "Kuchen / Gebäck";
}

function donationTraitText(donation: Cake) {
  const labels = [
    donation.vegan ? "Vegan" : null,
    donation.vegetarian ? "Vegetarisch" : null,
    donation.glutenFree ? "Glutenfrei" : null,
    donation.lactoseFree ? "Laktosefrei" : null,
    donation.containsNuts ? "Enthält Nüsse" : null,
    donation.sugarFree ? "Zuckerfrei" : null,
    donation.containsAlcohol ? "Enthält Alkohol" : null,
    donation.meat ? "Fleischhaltig" : null,
  ].filter((label): label is string => Boolean(label));
  const note = donation.note?.trim();
  return (
    [labels.join(", "), note ? `Hinweis: ${note}` : ""]
      .filter(Boolean)
      .join("\n") || "–"
  );
}

function donationDropoffText(donation: Cake) {
  if (donation.dropoffDate) {
    const weekday = cakeWeekdayLabel(donation.dropoffDate);
    return donation.dropoffTime
      ? `${weekday}, ${donation.dropoffTime} Uhr`
      : weekday;
  }
  if (donation.dropoffTime) return `${donation.dropoffTime} Uhr`;
  return donation.legacyDropoffText.trim() || "–";
}

/** Erstellt eine operative Übersicht der aktuell gefilterten Verpflegungsspenden. */
export function renderDonationOverviewPdf(
  data: PlanningData,
  donationIds: number[]
) {
  const selectedDonations = selectDonationOverviewRows(data.cakes, donationIds);
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );

  return collectPdf(doc => {
    const landscapeWidth = doc.page.width - margin * 2;
    drawDocumentHeader(
      doc,
      data.settings,
      "Spendenübersicht – Gefilterte Ansicht",
      `Aktuelle Tabellenansicht · Stand: ${formatDate()}`,
      data.logoBuffer,
      data.usesMyCrewMateWordmark
    );
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(colors.muted)
      .text(
        "Diese Übersicht enthält genau die aktuell gefilterten Verpflegungsspenden einschließlich ihrer Eigenschaften, Hinweise und Abgabeinformationen."
      );
    doc.moveDown(1);

    const fixedColumns: PdfColumn[] = [
      { key: "donor", label: "Spender", width: 112 },
      { key: "donation", label: "Spende", width: 106 },
      { key: "category", label: "Kategorie", width: 82 },
      { key: "traits", label: "Eigenschaften & Hinweise", width: 210 },
      { key: "location", label: "Ort", width: 128 },
    ];
    const fixedWidth = fixedColumns.reduce(
      (sum, column) => sum + column.width,
      0
    );
    const columns: PdfColumn[] = [
      ...fixedColumns,
      {
        key: "dropoff",
        label: "Abgabezeit",
        width: landscapeWidth - fixedWidth,
      },
    ];
    drawTableHeader(doc, columns, margin);

    if (selectedDonations.length === 0) {
      drawTableRow(
        doc,
        columns,
        {
          donation:
            "Für die aktuelle Filterauswahl sind keine Spenden sichtbar.",
        },
        margin,
        { minimumHeight: 34 }
      );
      return;
    }

    for (const donation of selectedDonations) {
      drawTableRow(
        doc,
        columns,
        {
          donor: donation.donor,
          donation: donation.cake.trim() || "–",
          category: donationCategoryLabel(donation.donationCategory),
          traits: donationTraitText(donation),
          location: donation.locationId
            ? (locationById.get(donation.locationId)?.name ?? "–")
            : "–",
          dropoff: donationDropoffText(donation),
        },
        margin,
        { minimumHeight: 30 }
      );
    }
  }, "landscape");
}

type TaskOverviewRow = Pick<
  PostTask,
  | "id"
  | "category"
  | "task"
  | "dueText"
  | "locationId"
  | "contactId"
  | "note"
  | "sortOrder"
> & {
  status: PrepTask["status"];
  statusWording?: PrepTask["statusWording"];
};
type TaskOverviewKind = "prep" | "post";

/** Wählt ausschließlich die Aufgaben aus, die in der gefilterten Tabellenansicht sichtbar sind. */
export function selectTaskOverviewRows(
  tasks: TaskOverviewRow[] | undefined,
  taskIds: number[]
) {
  const selectedIds = new Set(taskIds);
  return (tasks ?? [])
    .filter(task => selectedIds.has(task.id))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category, "de") ||
        left.sortOrder - right.sortOrder ||
        left.id - right.id
    );
}

function taskOverviewStatusLabel(
  task: TaskOverviewRow,
  kind: TaskOverviewKind
) {
  if (task.status === "offen") return "Offen";
  if (task.status === "inArbeit") {
    return kind === "prep" && task.statusWording === "genehmigung"
      ? "Beantragt"
      : "In Arbeit";
  }
  if (task.status === "erledigt") {
    return kind === "prep" && task.statusWording === "genehmigung"
      ? "Genehmigt"
      : "Erledigt";
  }
  return "Abgelehnt";
}

function renderTaskOverviewPdf(
  data: PlanningData,
  taskIds: number[],
  kind: TaskOverviewKind
) {
  const selectedTasks = selectTaskOverviewRows(
    kind === "prep" ? data.prepTasks : data.postTasks,
    taskIds
  );
  const contactById = new Map(
    data.contacts.map(contact => [contact.id, contact])
  );
  const locationById = new Map(
    (data.locations ?? []).map(location => [location.id, location])
  );
  const title =
    kind === "prep"
      ? "Vorbereitung – Aufgabenübersicht"
      : "Nachbereitung – Aufgabenübersicht";

  return collectPdf(doc => {
    const landscapeWidth = doc.page.width - margin * 2;
    drawDocumentHeader(
      doc,
      data.settings,
      title,
      `Gefilterte Ansicht · Stand: ${formatDate()}`,
      data.logoBuffer,
      data.usesMyCrewMateWordmark
    );
    const fixedColumns: PdfColumn[] = [
      { key: "category", label: "Bereich", width: 74 },
      { key: "task", label: "Aufgabe", width: 154 },
      { key: "location", label: "Ort", width: 72 },
      { key: "contact", label: data.settings.contactLabel, width: 118 },
      { key: "due", label: "Frist", width: 68 },
      { key: "status", label: "Status", width: 70 },
    ];
    const fixedWidth = fixedColumns.reduce(
      (sum, column) => sum + column.width,
      0
    );
    const columns: PdfColumn[] = [
      ...fixedColumns,
      {
        key: "logbook",
        label: "Aktueller Logbuchstand",
        width: landscapeWidth - fixedWidth,
      },
    ];
    drawTableHeader(doc, columns, margin);

    if (selectedTasks.length === 0) {
      drawTableRow(
        doc,
        columns,
        {
          task: "Für die aktuelle Filterauswahl sind keine Aufgaben sichtbar.",
        },
        margin,
        { minimumHeight: 34 }
      );
      return;
    }

    for (const task of selectedTasks) {
      drawTableRow(
        doc,
        columns,
        {
          category: task.category || "–",
          task: task.task,
          location: task.locationId
            ? (locationById.get(task.locationId)?.name ?? "–")
            : "–",
          contact: task.contactId
            ? (contactById.get(task.contactId)?.name ?? "–")
            : "–",
          due: task.dueText.trim() || "–",
          status: taskOverviewStatusLabel(task, kind),
          logbook: latestPreparationLogbookEntry(task.note) || "–",
        },
        margin,
        { minimumHeight: 30 }
      );
    }
  }, "landscape");
}

/** Erzeugt die Download-PDF exakt aus der aktuellen Filterauswahl der Vorbereitung. */
export function renderPreparationTaskOverviewPdf(
  data: PlanningData,
  taskIds: number[]
) {
  return renderTaskOverviewPdf(data, taskIds, "prep");
}

/** Erzeugt die Download-PDF exakt aus der aktuellen Filterauswahl der Nachbereitung. */
export function renderPostTaskOverviewPdf(
  data: PlanningData,
  taskIds: number[]
) {
  return renderTaskOverviewPdf(data, taskIds, "post");
}

/**
 * Ohne ein lesbares individuelles Eventlogo bleibt die sichtbare Absendermarke
 * für jedes Paket einheitlich MyCrewMate. Pro und Enterprise behalten ihr
 * individuelles Logo ausschließlich dann, wenn es tatsächlich vorhanden ist.
 */
export function shouldUseMyCrewMateWordmark(input: {
  allowsCustomBranding: boolean;
  hasCustomEventLogo: boolean;
}) {
  return !input.allowsCustomBranding || !input.hasCustomEventLogo;
}

async function loadPlanningData(): Promise<PlanningData> {
  const [
    helpers,
    contacts,
    cakes,
    shifts,
    assignments,
    areaContacts,
    materials,
    locations,
    prepTasks,
    postTasks,
    settings,
    selectedEvent,
  ] = await Promise.all([
    db.listHelpers(),
    db.listContacts(),
    db.listCakes(),
    db.listShifts(),
    db.listAssignments(),
    db.listShiftAreaContacts(),
    db.listMaterials(),
    db.listLocations(),
    db.listPrep(),
    db.listPost(),
    db.getAppSettings(),
    db.getEvent(),
  ]);
  const product = await db.getCurrentTenantProductEntitlement();
  const allowsCustomBranding = productAllowsCapability(
    product.packageId,
    "custom_branding"
  );
  const resolvedSettings = {
    ...(settings ?? DEFAULT_PDF_SETTINGS),
    eventName: selectedEvent?.name ?? settings?.eventName ?? "Veranstaltung",
    eventYear: String(currentEventYear()),
    logoKey: allowsCustomBranding ? (selectedEvent?.pdfLogoKey ?? null) : null,
    logoUrl: allowsCustomBranding ? (selectedEvent?.pdfLogoUrl ?? null) : null,
  };
  let logoBuffer: Buffer | undefined;
  const logoStorageKey =
    allowsCustomBranding && selectedEvent
      ? resolveEventPdfLogoKey(selectedEvent)
      : null;
  if (logoStorageKey) {
    try {
      logoBuffer = await storageRead(logoStorageKey);
    } catch (error) {
      console.warn("[PDF] Logo konnte nicht geladen werden:", error);
    }
  }
  const usesMyCrewMateWordmark = shouldUseMyCrewMateWordmark({
    allowsCustomBranding,
    hasCustomEventLogo: Boolean(logoBuffer),
  });
  if (usesMyCrewMateWordmark) {
    // Event Pass und Light sowie logo-freie Pro-/Enterprise-Exporte nutzen die
    // MyCrewMate-Wortmarke als einheitliche, sichtbare Absendermarke.
    logoBuffer = await loadMyCrewMateWordmarkBuffer();
  }
  return {
    helpers,
    contacts,
    cakes,
    shifts,
    assignments,
    areaContacts,
    materials,
    locations,
    prepTasks,
    postTasks,
    settings: resolvedSettings,
    logoBuffer,
    usesMyCrewMateWordmark,
  };
}

export async function createHelperTaskPdf(helperId: number) {
  return renderHelperTaskPdf(await loadPlanningData(), helperId);
}

/**
 * Erzeugt eine persönliche Ansicht für externe Freigabelinks. Die Teamansicht
 * wird ausschließlich nach erfolgreicher Codeprüfung durch den geschützten
 * Sieben-Tage-Abruf verwendet.
 */
export async function createPublicHelperTaskPdf(
  helperId: number,
  viewMode: "minimal" | "team" = "minimal"
) {
  const data = await loadPlanningData();
  return viewMode === "team"
    ? renderHelperTaskPdf(data, helperId)
    : renderPublicHelperTaskPdf(data, helperId);
}

export async function createBlankPlanPdf() {
  return renderBlankPlanPdf(await loadPlanningData());
}

export async function createPlanPdf(options: PlanPdfOptions) {
  return renderPlanPdf(await loadPlanningData(), options);
}

export async function createContactOverviewPdf(
  contactId: number,
  options: ContactOverviewPdfOptions
) {
  return renderContactOverviewPdf(await loadPlanningData(), contactId, options);
}

export async function createMaterialPacklistPdf(materialIds: number[]) {
  return renderMaterialPacklistPdf(await loadPlanningData(), materialIds);
}

export async function createDonationOverviewPdf(donationIds: number[]) {
  return renderDonationOverviewPdf(await loadPlanningData(), donationIds);
}

export async function createPrepTaskOverviewPdf(taskIds: number[]) {
  return renderPreparationTaskOverviewPdf(await loadPlanningData(), taskIds);
}

export async function createPostTaskOverviewPdf(taskIds: number[]) {
  return renderPostTaskOverviewPdf(await loadPlanningData(), taskIds);
}

async function loadMyCrewMateWordmarkBuffer() {
  try {
    return await loadBrandAsset("wordmark");
  } catch (error) {
    console.warn("[PDF] MyCrewMate-Logo konnte nicht geladen werden:", error);
    return undefined;
  }
}

/** Lädt das offizielle Markenlogo und erzeugt die vertraulichen Zugangsblätter. */
export async function createPlanningTeamAccessSheetsPdf(
  sheets: PlanningTeamAccessSheet[]
) {
  return renderPlanningTeamAccessSheetsPdf(
    sheets,
    await loadMyCrewMateWordmarkBuffer()
  );
}

/** Beschränkt Helfer-PDFs bei Bedarf auf einen einzelnen Ansprechpartner. */
export function selectHelpersForContact(helpers: Helper[], contactId?: number) {
  return contactId === undefined
    ? helpers
    : helpers.filter(helper => helper.contactId === contactId);
}

export function renderAllHelperTaskZip(data: PlanningData, contactId?: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const output: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("data", (chunk: Buffer | Uint8Array) =>
      output.push(Buffer.from(chunk))
    );
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(output)));

    void (async () => {
      const selectedHelpers = selectHelpersForContact(data.helpers, contactId);
      if (selectedHelpers.length === 0) {
        archive.append(
          contactId === undefined
            ? "Es sind noch keine Helfer angelegt. Nach dem Anlegen oder Excel-Import enthält dieses Archiv je Helfer eine PDF-Datei.\n"
            : "Für diesen Ansprechpartner sind noch keine Helfer zugeordnet.\n",
          { name: "HINWEIS.txt" }
        );
      }
      for (const helper of selectedHelpers) {
        const contact = data.contacts.find(
          item => item.id === helper.contactId
        );
        const folder = safeFilename(contact?.name ?? "Ohne_Ansprechpartner");
        const filename = `Aufgaben_${safeFilename(helper.name)}.pdf`;
        const pdf = await renderHelperTaskPdf(data, helper.id);
        archive.append(pdf, { name: `${folder}/${filename}` });
      }
      await archive.finalize();
    })().catch(reject);
  });
}

export async function createAllHelperTaskZip(contactId?: number) {
  return renderAllHelperTaskZip(await loadPlanningData(), contactId);
}

/** Bündelt die Arbeitsmappen der ausgewählten Ansprechpartner in einer ZIP-Datei. */
export function renderContactOverviewZip(
  data: PlanningData,
  contactIds: number[],
  options: ContactOverviewPdfOptions
) {
  return new Promise<Buffer>((resolve, reject) => {
    const output: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("data", (chunk: Buffer | Uint8Array) =>
      output.push(Buffer.from(chunk))
    );
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(output)));

    void (async () => {
      const selectedIds = new Set(contactIds);
      const selectedContacts = data.contacts.filter(contact =>
        selectedIds.has(contact.id)
      );
      if (selectedContacts.length === 0) {
        archive.append(
          "Für die aktuelle Auswahl wurden keine Ansprechpartner gefunden.\n",
          { name: "HINWEIS.txt" }
        );
      }
      for (const contact of selectedContacts) {
        const pdf = await renderContactOverviewPdf(data, contact.id, options);
        archive.append(pdf, {
          name: `Ansprechpartner_${safeFilename(contact.name)}.pdf`,
        });
      }
      await archive.finalize();
    })().catch(reject);
  });
}

export async function createContactOverviewZip(
  contactIds: number[],
  options: ContactOverviewPdfOptions
) {
  return renderContactOverviewZip(
    await loadPlanningData(),
    contactIds,
    options
  );
}
