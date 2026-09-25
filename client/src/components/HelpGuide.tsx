import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PERMISSION_MATRIX } from "@shared/permissions";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  DatabaseBackup,
  FileDown,
  FileSpreadsheet,
  Gift,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  MapPinned,
  Map,
  MessageSquareText,
  PackageCheck,
  Route,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";

export type HelpAudience = "all" | "planning" | "admin";

type HelpVisual = {
  label: string;
  title: string;
  icon: LucideIcon;
  items: string[];
};

type HelpCallout = {
  tone: "tip" | "warning" | "security";
  title: string;
  text: string;
};

type HelpTopic = {
  id: string;
  title: string;
  audience: HelpAudience[];
  keywords: string;
  summary: string;
  steps?: string[];
  visual?: HelpVisual;
  callout?: HelpCallout;
  screenshot?: {
    src: string;
    alt: string;
    caption: string;
    display?: "standard" | "mobile";
  };
  showPermissions?: boolean;
  showAzIndex?: boolean;
  workspace?: {
    href: string;
    label: string;
    adminOnly?: boolean;
  };
};

type HelpChapter = {
  id: string;
  number: number;
  title: string;
  keywords: string;
  icon: LucideIcon;
  accent: string;
  topics: HelpTopic[];
};

type AzTerm = {
  label: string;
  audience?: Exclude<HelpAudience, "all">;
};

type AzIndexEntry = readonly [letter: string, terms: readonly AzTerm[]];

export const HELP_AUDIENCE_FILTERS: Array<{
  id: HelpAudience;
  label: string;
  icon: LucideIcon;
  activeClassName: string;
}> = [
  {
    id: "all",
    label: "Für alle",
    icon: Globe2,
    activeClassName: "border-blue-300 bg-blue-50 text-blue-900",
  },
  {
    id: "planning",
    label: "Nur Planungsteam",
    icon: UserRoundCheck,
    activeClassName: "border-amber-300 bg-amber-50 text-amber-950",
  },
  {
    id: "admin",
    label: "Nur Admin-Team",
    icon: KeyRound,
    activeClassName: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
];

export function getHelpAudienceForRole(
  role: "user" | "admin" | null | undefined
): HelpAudience {
  if (role === "admin") return "admin";
  if (role === "user") return "planning";
  return "all";
}

const audienceLabel: Record<HelpAudience, string> = {
  all: "Für alle",
  planning: "Planungsteam",
  admin: "Admin-Team",
};

const audienceClassName: Record<HelpAudience, string> = {
  all: "border-blue-200 bg-blue-50 text-blue-800",
  planning: "border-amber-200 bg-amber-50 text-amber-900",
  admin: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const CALLOUT_STYLE: Record<HelpCallout["tone"], { box: string; icon: LucideIcon }> = {
  tip: {
    box: "border-blue-200 bg-blue-50/80 text-blue-950",
    icon: Lightbulb,
  },
  warning: {
    box: "border-amber-200 bg-amber-50/80 text-amber-950",
    icon: AlertTriangle,
  },
  security: {
    box: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    icon: ShieldCheck,
  },
};

const HELP_CHAPTERS: HelpChapter[] = [
  {
    id: "schnellstart",
    number: 1,
    title: "Schnellstart, Orientierung & PWA-Installation",
    keywords: "anmeldung dashboard pwa app startbildschirm navigation event countdown",
    icon: LayoutDashboard,
    accent: "border-blue-200 bg-blue-50 text-blue-800",
    topics: [
      {
        id: "dashboard-uebersicht",
        title: "1.1 Erste Schritte & Dashboard-Übersicht",
        audience: ["all"],
        keywords: "dashboard veranstaltungsjahr event auswahl kennzahlen prioritaeten",
        summary:
          "Nach der Anmeldung wird zuerst das Veranstaltungsjahr und anschließend die Veranstaltung gewählt. Diese Auswahl legt den gemeinsamen Planungsraum fest: Kennzahlen, Listen, PDFs sowie Sicherungen beziehen sich immer nur auf das aktive Event.",
        steps: [
          "Im Seitenmenü Veranstaltungsjahr und Veranstaltung kontrollieren.",
          "Auf dem Dashboard die wichtigsten offenen Punkte und Kennzahlen prüfen.",
          "Für die Detailarbeit den passenden Bereich über die linke Navigation öffnen.",
        ],
        visual: {
          label: "Dashboard-Ansicht",
          title: "Der Planungsraum ist immer eindeutig",
          icon: LayoutDashboard,
          items: ["Aktives Jahr und Event prüfen", "Prioritäten oben bearbeiten", "Kennzahlen als Überblick nutzen"],
        },
        screenshot: {
          src: "/api/help/images/dashboard?v=20260922",
          alt: "Aktuelles MyCrewMate-Dashboard mit Prioritäten, Fristen und kompaktem Event-Zähler",
          caption: "Das aktuelle Dashboard bündelt Prioritäten, Fristen und Kennzahlen für die gewählte Veranstaltung.",
        },
        workspace: { href: "/", label: "Zum Dashboard" },
      },
      {
        id: "vorfreude-widget",
        title: "1.2 Vorfreude-Widget: Countdown bis zum Eventstart",
        audience: ["all"],
        keywords: "countdown widget vorfreude morgen heute eventstart tage",
        summary:
          "Das Vorfreude-Widget berechnet die verbleibenden Tage bis zum hinterlegten Startdatum automatisch. Einen Tag vorher informiert es mit „morgen“, am Starttag mit „Heute ist das Event!“ und nach dem Event mit einem Abschlussstatus.",
        visual: {
          label: "Live-Zähler",
          title: "Vorfreude im Blick. Das Event im Griff.",
          icon: CalendarDays,
          items: ["Startdatum im Event pflegen", "Tageszahl wird automatisch berechnet", "Morgen- und Heute-Logik sind integriert"],
        },
      },
      {
        id: "pwa-installation",
        title: "1.3 MyCrewMate auf dem Smartphone speichern",
        audience: ["all"],
        keywords: "pwa ios android iphone ipad chrome safari app handy speichern home bildschirm",
        summary:
          "MyCrewMate kann als Progressive Web App (PWA) auf dem Startbildschirm gespeichert werden. Die Anwendung öffnet danach wie eine eigene App; eine zusätzliche Installation aus einem App-Store ist nicht nötig.",
        steps: [
          "Im mobilen Menü „Als App auf Handy speichern“ wählen.",
          "Auf iPhone oder iPad in Safari „Zum Home-Bildschirm“ auswählen.",
          "Auf Android in Chrome „App installieren“ oder „Zum Startbildschirm hinzufügen“ auswählen.",
        ],
        screenshot: {
          src: "/api/help/images/app-speichern",
          alt: "Mobiles Seitenmenü mit dem PWA-Speicherbutton",
          caption: "Der PWA-Button befindet sich im mobilen Seitenmenü unter dem Projektstand.",
          display: "mobile",
        },
      },
      {
        id: "navigation",
        title: "1.4 Navigation & Hauptmenü",
        audience: ["all"],
        keywords: "navigation seitenleiste mobil menue filter schnellzugriff",
        summary:
          "Die Seitenleiste gliedert alle Arbeitsbereiche nach ihrer Funktion. Auf Smartphones öffnet das Menüsymbol die gleiche Navigation. Die Statusanzeige unter der Marke zeigt aktive Sitzungen und öffnet auf Klick eine Erläuterung.",
        visual: {
          label: "Navigation",
          title: "Schnell zum passenden Arbeitsbereich",
          icon: MapPinned,
          items: ["Bereich über die Seitenleiste wählen", "Mobile Navigation im Sheet öffnen", "Online-Status bei Bedarf aufklappen"],
        },
      },
    ],
  },
  {
    id: "stammdaten",
    number: 2,
    title: "Stammdaten & Infrastruktur",
    keywords: "orte standorte gpx karte ansprechpartner rufnummer",
    icon: MapPinned,
    accent: "border-cyan-200 bg-cyan-50 text-cyan-900",
    topics: [
      {
        id: "orte-standorte",
        title: "2.1 Orte & Standorte anlegen & verwalten",
        audience: ["all", "planning"],
        keywords: "orte standorte start ziel parkplatz material standort karte",
        summary:
          "Orte und Standorte schaffen die gemeinsame räumliche Grundlage. Hinterlegen Sie Namen, Anschriften oder Kartenpositionen so, dass Start, Ziel, Materialpunkte und Trefforte eindeutig zugeordnet werden können.",
        steps: [
          "Einen klaren Standortnamen und den Verwendungszweck erfassen.",
          "Adresse oder Kartenposition prüfen und bei Bedarf den Standortlink ergänzen.",
          "Material- und Aufgabenstandorte in den jeweiligen Bereichen verknüpfen.",
        ],
        visual: {
          label: "Standortverwaltung",
          title: "Jeder relevante Ort nur einmal",
          icon: Map,
          items: ["Start und Ziel", "Versorgung und Material", "Treffpunkte und Parkflächen"],
        },
        screenshot: {
          src: "/api/help/images/locations",
          alt: "Aktuelle MyCrewMate-Ansicht Orte und Standorte mit Karten- und Standortverwaltung",
          caption: "Orte & Standorte bündeln die aktuelle Standortverwaltung und die Grundlage für Karten- sowie GPX-Ansichten.",
        },
        workspace: { href: "/orte", label: "Zu Orte & Standorte", adminOnly: true },
      },
      {
        id: "gpx-overlays",
        title: "2.2 GPX-Streckenoverlays auf der Karte",
        audience: ["all", "planning"],
        keywords: "gpx strecke overlay karte route radsport",
        summary:
          "GPX-Overlays ergänzen die Standortkarte um Streckenverläufe. Sie helfen bei der Abstimmung von Streckenposten, Verpflegung, Gefahrenpunkten und Logistik, ohne die eigentliche Aufgabenplanung zu ersetzen.",
        visual: {
          label: "Streckenansicht",
          title: "Route und Infrastruktur gemeinsam betrachten",
          icon: Route,
          items: ["GPX-Datei dem aktiven Event zuordnen", "Karte auf Gefahrenpunkte prüfen", "Standorte entlang der Route abstimmen"],
        },
        workspace: { href: "/orte", label: "Zur Streckenkarte", adminOnly: true },
      },
      {
        id: "ansprechpartner",
        title: "2.3 Ansprechpartner-Verwaltung & Zuordnung",
        audience: ["all", "planning"],
        keywords: "ansprechpartner kontakt telefon zugang zuordnung helfer",
        summary:
          "Ansprechpartner verbinden Personen, Teams und Bereiche. Pflegen Sie Name und Rufnummer vollständig, damit Helfer, Schichten und PDFs die korrekte Kontaktperson anzeigen.",
        callout: {
          tone: "security",
          title: "Zugangsdaten sind administrativ geschützt",
          text: "Einmal-Zugänge, Passwortresets und Eventfreigaben werden ausschließlich im Bereich Schutz & Protokoll durch Administratoren verwaltet.",
        },
        workspace: { href: "/ansprechpartner", label: "Zu Ansprechpartnern", adminOnly: true },
      },
    ],
  },
  {
    id: "helfer-einsatzplan",
    number: 3,
    title: "Helferkartei, Verfügbarkeiten & Einsatzplan",
    keywords: "helfer kartei verfügbarkeit zeitfenster begleitung schichten einsatzplan filter",
    icon: UsersRound,
    accent: "border-violet-200 bg-violet-50 text-violet-900",
    topics: [
      {
        id: "helferkartei",
        title: "3.1 Helferkartei & digitale Helferakte",
        audience: ["planning", "admin"],
        keywords: "helfer name telefon pdf hinweis ansprechpartner bestaetigt",
        summary:
          "Die Helferkartei bündelt Kontakt, Ansprechpartner, Hinweise für die persönliche PDF sowie Rückmeldungen. Sie ist die verlässliche Grundlage für spätere Besetzungen und die Kommunikation mit dem Team.",
        steps: [
          "Helfer erfassen und den passenden Ansprechpartner zuordnen.",
          "Telefonnummer, PDF-Hinweis und Rückmeldung dokumentieren.",
          "Die digitale Helferakte vor der Einteilung auf Vollständigkeit prüfen.",
        ],
        screenshot: {
          src: "/api/help/images/helpers",
          alt: "Helferkartei von MyCrewMate in mobiler Darstellung",
          caption: "Die Helferkartei hält Kontakt, Zuständigkeit und Verfügbarkeit in einer gemeinsamen Akte bereit.",
        },
        workspace: { href: "/helfer", label: "Zur Helferkartei" },
      },
      {
        id: "verfuegbarkeiten",
        title: "3.2 Tagesverfügbarkeiten, Zeitfenster & Begleitungen",
        audience: ["planning", "admin"],
        keywords: "verfuegbarkeit freitag samstag sonntag vielleicht zeitfenster begleitung",
        summary:
          "Für jeden aktiven Veranstaltungstag wird die Verfügbarkeit als Ja, Nein oder Vielleicht dokumentiert. Zeitfenster und Begleitungen machen Einschränkungen sichtbar, bevor eine Schicht zugesagt oder vergeben wird.",
        visual: {
          label: "Verfügbarkeiten",
          title: "Einteilungen nur mit realistischen Angaben planen",
          icon: CalendarDays,
          items: ["Tagesstatus erfassen", "Zeitfenster berücksichtigen", "Begleitungen sichtbar machen"],
        },
        workspace: { href: "/helfer", label: "Verfügbarkeiten bearbeiten" },
      },
      {
        id: "einsatzplan",
        title: "3.3 Einsatzplan & intelligente Belegung",
        audience: ["admin"],
        keywords: "einsatzplan schicht bedarf autofit doppelbelegung konflikt zuweisung",
        summary:
          "Administratoren erstellen Schichten mit Bereich, Zeitfenster und Bedarf. Die Belegungslogik zeigt Unterdeckung, Verfügbarkeiten und mögliche Doppelbelegungen transparent an, damit bewusste Entscheidungen nachvollziehbar bleiben.",
        steps: [
          "Schicht mit Tag, Bereich, Zeit und Mindestbedarf anlegen.",
          "Geeignete Helfer anhand ihrer Verfügbarkeit auswählen.",
          "Offene, knappe und vollständig besetzte Schichten vor dem Event prüfen.",
        ],
        screenshot: {
          src: "/api/help/images/plan",
          alt: "Einsatzplan mit Schichten und Zuständigkeiten",
          caption: "Im Einsatzplan sind Schichtbedarf, Zuweisungen und Konflikthinweise gemeinsam sichtbar.",
        },
        workspace: { href: "/einsatzplan", label: "Zum Einsatzplan", adminOnly: true },
      },
      {
        id: "schnellfilter",
        title: "3.4 Schnellfilter & Ansichten",
        audience: ["all", "planning", "admin"],
        keywords: "meine aufgaben offen unzugewiesen pin filter standardansicht",
        summary:
          "Schnellfilter wie „Meine Aufgaben“ und „Offen / unzugewiesen“ reduzieren Listen auf den aktuell relevanten Arbeitsbestand. Eine angepinnte Standardansicht bleibt pro Sitzungsidentität erhalten und kann jederzeit wieder aufgehoben werden.",
        visual: {
          label: "Persönliche Sicht",
          title: "Aufgaben fokussieren, ohne Daten auszublenden",
          icon: Search,
          items: ["Meine Aufgaben aktivieren", "Standardansicht anpinnen", "Filter bei Bedarf zurücksetzen"],
        },
        workspace: { href: "/vorbereitung", label: "Schnellfilter öffnen" },
      },
    ],
  },
  {
    id: "fachbereiche",
    number: 4,
    title: "Fachbereiche & Detail-Planung",
    keywords: "vorbereitung nachbereitung material spenden finanzen genehmigungen aufgaben",
    icon: ClipboardList,
    accent: "border-orange-200 bg-orange-50 text-orange-900",
    topics: [
      {
        id: "vor-nachbereitung",
        title: "4.1 Vorbereitung & Nachbereitung",
        audience: ["planning", "admin"],
        keywords: "vorbereitung nachbereitung aufgaben checkliste genehmigung frist status",
        summary:
          "Vorbereitung und Nachbereitung halten alle Aufgaben vor und nach dem Festival fest. Verantwortliche, Fristen und Statuswerte sorgen dafür, dass offene Punkte sichtbar bleiben; Genehmigungen und Kommunikationsmaßnahmen werden als Kategorien in der Vorbereitung geführt.",
        visual: {
          label: "Aufgabenplanung",
          title: "Von offen bis erledigt transparent arbeiten",
          icon: ClipboardCheck,
          items: ["Aufgabe und Kategorie anlegen", "Verantwortung und Frist setzen", "Status und Logbuch prüfen"],
        },
        screenshot: {
          src: "/api/help/images/preparation",
          alt: "Aktuelle MyCrewMate-Ansicht Vorbereitung mit Aufgabenfiltern und Aktionsleiste",
          caption: "Vorbereitung und Nachbereitung verwenden die aktuelle kompakte Aufgabenansicht mit Suche, Schnellfiltern und klaren Aktionen.",
        },
        workspace: { href: "/vorbereitung", label: "Zur Vorbereitung" },
      },
      {
        id: "materialverwaltung",
        title: "4.2 Materialverwaltung",
        audience: ["planning", "admin"],
        keywords: "material artikel menge einheit stand ort bestellung status",
        summary:
          "Die Materialverwaltung dokumentiert Artikel, Mengen, Einheiten, Bestellstatus und Standorte. Gleichnamige Artikel dürfen an verschiedenen Ständen geführt werden, sofern ihr Einsatzort eindeutig gepflegt ist.",
        callout: {
          tone: "tip",
          title: "Artikel immer mit Ort denken",
          text: "Bei gleichem Material an mehreren Ausgabepunkten hilft die Kombination aus Artikel und Standort, Beschaffung und Verteilung nachvollziehbar zu halten.",
        },
        visual: {
          label: "Materialliste",
          title: "Mengen und Einsatzorte gemeinsam steuern",
          icon: PackageCheck,
          items: ["Artikel und Menge erfassen", "Standort verknüpfen", "Bestellstatus nachhalten"],
        },
        screenshot: {
          src: "/api/help/images/materials",
          alt: "Aktuelle MyCrewMate-Materialverwaltung mit stabiler Filterleiste",
          caption: "Die Materialverwaltung zeigt die aktuellen Schnellfilter und den kompakten Aktionsbereich für Beschaffung und Logistik.",
        },
        workspace: { href: "/material", label: "Zur Materialverwaltung" },
      },
      {
        id: "spenden",
        title: "4.3 Spenden-Modul",
        audience: ["planning", "admin"],
        keywords: "spenden kuchen salat dessert allergene abgabe sollwert",
        summary:
          "Das Spenden-Modul plant Verpflegungsspenden wie Kuchen, Salate, Desserts und Sonstiges. Kategorie, Allergene, Abgabezeit, Ort und Sollwerte erleichtern die Abstimmung mit Helfern und Sponsoren.",
        visual: {
          label: "Spendenübersicht",
          title: "Verpflegung planbar und transparent sammeln",
          icon: Gift,
          items: ["Kategorie und Spender wählen", "Allergene und Abgabe notieren", "Sollwerte je Kategorie vergleichen"],
        },
        screenshot: {
          src: "/api/help/images/donations",
          alt: "Aktuelle MyCrewMate-Spendenverwaltung mit Sollwerten und Filterleiste",
          caption: "Im Spenden-Modul sind heutige Filter, Sollwerte und Erfassungsaktionen für Verpflegungsspenden zusammengeführt.",
        },
        workspace: { href: "/spenden", label: "Zum Spenden-Modul" },
      },
      {
        id: "finanzen",
        title: "4.4 Finanzen & Budgetierung",
        audience: ["planning", "admin"],
        keywords: "finanzen budget einnahmen ausgaben plan ist sponsoring",
        summary:
          "Finanzen führen Einnahmen und Ausgaben getrennt nach Kostenarten. Plan- und Istwerte schaffen eine belastbare Übersicht für Sponsoring, Beschaffung, Startgelder und Abrechnung.",
        visual: {
          label: "Budgetübersicht",
          title: "Plan- und Istwerte strukturiert vergleichen",
          icon: WalletCards,
          items: ["Kostenart festlegen", "Planwert erfassen", "Istwert nach dem Event ergänzen"],
        },
        screenshot: {
          src: "/api/help/images/finances",
          alt: "Aktuelle MyCrewMate-Finanzen mit Saldo und Tabellenkopf",
          caption: "Die Finanzübersicht zeigt Einnahmen, Ausgaben und Saldo in der heutigen kompakten Tabellenansicht.",
        },
        workspace: { href: "/finanzen", label: "Zu Finanzen", adminOnly: true },
      },
    ],
  },
  {
    id: "kollaboration",
    number: 5,
    title: "Live-Chat, Notizen & Kollaboration",
    keywords: "chat notizen ungelesen nachricht wichtig online status",
    icon: MessageSquareText,
    accent: "border-sky-200 bg-sky-50 text-sky-900",
    topics: [
      {
        id: "live-chat",
        title: "5.1 Team-Live-Chat",
        audience: ["all"],
        keywords: "live chat notiz nachricht autor ungelesen wichtig muten",
        summary:
          "Das schwebende Team-Notiz-Widget ist auf allen Seiten verfügbar. Nachrichten erhalten automatisch den Namen der angemeldeten Sitzungsidentität. Ungelesene Mitteilungen erscheinen am Chat-Button und gelten beim Öffnen als gelesen.",
        steps: [
          "Den Chat unten rechts öffnen und die aktuelle Veranstaltung prüfen.",
          "Nachricht verfassen; wichtige Durchsagen sichtbar kennzeichnen.",
          "Nach dem Lesen das Widget schließen; der persönliche Lesestatus bleibt gespeichert.",
        ],
        screenshot: {
          src: "/api/help/images/chat",
          alt: "Geöffnetes Team-Notiz-Widget von MyCrewMate",
          caption: "Team-Notizen zeigen Autor, Zeitpunkt und wichtige Durchsagen im Kontext der gewählten Veranstaltung.",
        },
      },
      {
        id: "notizen-dashboard",
        title: "5.2 Notiz-Widget & Dashboard-Anheftung",
        audience: ["all"],
        keywords: "notiz widget dashboard anheften chat online status live aktivitaet",
        summary:
          "Aktuelle Teamkommunikation bleibt über das Notiz-Widget erreichbar. Die Online-Anzeige in der Navigation unterscheidet Planungsteam und Administratoren und macht neue Live-Aktivität zeitlich begrenzt sichtbar.",
        visual: {
          label: "Teamstatus",
          title: "Kommunikation dort, wo geplant wird",
          icon: MessageSquareText,
          items: ["Ungelesene Notizen erkennen", "Online-Status bei Bedarf öffnen", "Wichtige Informationen sichtbar teilen"],
        },
      },
    ],
  },
  {
    id: "pdf-versand",
    number: 6,
    title: "PDF-Ausgabe, Versand & Druck",
    keywords: "pdf drucken helfer laufzettel schichtplan material report versand",
    icon: FileDown,
    accent: "border-rose-200 bg-rose-50 text-rose-900",
    topics: [
      {
        id: "helfer-pdf",
        title: "6.1 Personalisierte Helfer-PDFs",
        audience: ["all"],
        keywords: "helfer pdf laufzettel whatsapp teilen download zip",
        summary:
          "Personalisierte Helfer-PDFs fassen individuelle Schichten, Zeiten, Mithelfende, Notizen und Ansprechpartner zusammen. Sie können einzeln oder gesammelt als ZIP erzeugt und danach über die Teilen-Funktion des Geräts verschickt werden.",
        steps: [
          "Helferdaten, Ansprechpartner und Schichten vor dem Export prüfen.",
          "Einzel-PDF in der Helferkartei oder Sammel-PDF in der PDF-Ausgabe erzeugen.",
          "Dokument teilen, ausdrucken oder den persönlichen Link weitergeben.",
        ],
      },
      {
        id: "fachbereich-reports",
        title: "6.2 Fachbereichs-Reports",
        audience: ["all"],
        keywords: "pdf material liste schichtplan spenden uebersicht report checklisten",
        summary:
          "Für Einsatzleitung und Ansprechpartner stehen gefilterte Übersichten bereit. Dazu gehören Einsatzpläne, Materiallisten und Spendenübersichten; Aufgabenlisten können als physische Checkliste mit Abhakfeldern gedruckt werden.",
        visual: {
          label: "PDF-Ausgabe",
          title: "Aus Planung wird ein klarer Laufzettel",
          icon: FileDown,
          items: ["Bereich und Filter wählen", "Vorschau kontrollieren", "PDF herunterladen oder teilen"],
        },
        screenshot: {
          src: "/api/help/images/pdf",
          alt: "PDF-Ausgabe mit Helferübersichten und Einsatzplan",
          caption: "Die PDF-Ausgabe bündelt persönliche Helferunterlagen und gefilterte Arbeitsübersichten.",
        },
        workspace: { href: "/pdf-export", label: "Zur PDF-Ausgabe" },
      },
    ],
  },
  {
    id: "datenverwaltung",
    number: 7,
    title: "Datenverwaltung: Speichern, Laden & Backup-Sicherheit",
    keywords: "json backup sichern laden excel export import vorschau atomar",
    icon: DatabaseBackup,
    accent: "border-indigo-200 bg-indigo-50 text-indigo-900",
    topics: [
      {
        id: "json-backup",
        title: "7.1 Gesamtes Projekt sichern & wiederherstellen",
        audience: ["all", "admin"],
        keywords: "json sichern backup wiederherstellen snapshot atomar projektstand",
        summary:
          "Eine JSON-Sicherung bildet den vollständigen, gewählten Projektstand ab. Beim administrativen Laden wird dieser Stand atomar ersetzt statt mit Altbestand zusammengeführt; dadurch entstehen keine fälschlichen Dubletten aus früheren Daten.",
        callout: {
          tone: "warning",
          title: "Vor einer Wiederherstellung zuerst sichern",
          text: "Erstellen Sie vor jedem Laden eine aktuelle JSON-Sicherung. Das Wiederherstellen ersetzt den vollständigen Stand des aktiven Events.",
        },
        visual: {
          label: "JSON-Snapshot",
          title: "Vollständige Sicherung statt Datenmischung",
          icon: DatabaseBackup,
          items: ["Sicherung herunterladen", "Datei im Ladedialog prüfen", "Admin-Vorschau bewusst übernehmen"],
        },
        screenshot: {
          src: "/api/help/images/data-management",
          alt: "Aktueller MyCrewMate-Dialog zum Speichern eines Projektstands",
          caption: "Der aktuelle Projektstand-Dialog trennt JSON-Sicherung und Excel-Projektübersicht klar voneinander.",
        },
      },
      {
        id: "excel-export",
        title: "7.2 Excel-Export der neun Kern-Module",
        audience: ["all", "planning", "admin"],
        keywords: "excel export neun module standorte ansprechpartner helfer einsatzplan vorbereitung nachbereitung material spenden finanzen",
        summary:
          "Der Excel-Export liefert neun sichtbare Kern-Module: Orte & Standorte, Ansprechpartner, Helfer, Einsatzplan, Vorbereitung, Nachbereitung, Material, Spenden und Finanzen. Er dient als lesbare Übersicht und vorbereitete Importvorlage.",
        visual: {
          label: "Excel-Export",
          title: "Neun aktive Arbeitsbereiche in einer Datei",
          icon: FileSpreadsheet,
          items: ["Aktives Event exportieren", "Tabellenblatt gezielt bearbeiten", "Vor Import auf Überschriften achten"],
        },
      },
      {
        id: "excel-import",
        title: "7.3 Atomarer Modul-Import",
        audience: ["admin"],
        keywords: "excel import atomar einzelbereich vorschau validierung konflikt",
        summary:
          "Beim Excel-Import wird immer genau ein Bereich ausgewählt. Nicht gewählte Tabellenblätter werden vor der Validierung ignoriert. Dadurch können Dubletten oder Fehler in fremden Blättern den gewählten Modulimport nicht blockieren.",
        steps: [
          "Im Ladedialog „Excel-Daten importieren“ wählen.",
          "Genau einen Bereich per Radio-Auswahl festlegen.",
          "Vorschau lesen und nur den geprüften Import bewusst übernehmen.",
        ],
      },
    ],
  },
  {
    id: "schutz-protokoll",
    number: 8,
    title: "Schutz & Protokoll",
    keywords: "sicherheit audit log zugang passwort rollen schreibschutz notfall sperre",
    icon: ShieldCheck,
    accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
    topics: [
      {
        id: "audit-log",
        title: "8.1 Aktivitäten-Protokoll",
        audience: ["admin"],
        keywords: "protokoll audit log loeschung wiederherstellung sicherheit login import",
        summary:
          "Im administrativen Bereich Schutz & Protokoll bündelt das System Sicherheitsereignisse, Aktivitäten, Löschungen sowie Datei- und Importhistorie. Die Tabs schaffen eine klare Trennung zwischen Sicherheit, Änderungen und Datenvorgängen.",
        visual: {
          label: "Audit-Center",
          title: "Sicherheits- und Änderungsverlauf nachvollziehen",
          icon: ShieldCheck,
          items: ["Sicherheit & Logins prüfen", "Löschverlauf nachvollziehen", "Datei- & Importhistorie einsehen"],
        },
        screenshot: {
          src: "/api/help/images/security",
          alt: "Aktuelle MyCrewMate-Ansicht Schutz und Protokoll mit Sicherheits-Akkordeons",
          caption: "Schutz & Protokoll fasst die aktuelle Zugangsverwaltung, Notfall-Sperre und das zentrale Logbuch zusammen.",
        },
        workspace: { href: "/sicherheit", label: "Zu Schutz & Protokoll", adminOnly: true },
      },
      {
        id: "rechte-schreibschutz",
        title: "8.2 Schreibschutz & Rechteverwaltung",
        audience: ["all", "planning", "admin"],
        keywords: "rechte planungsteam administrator schreibschutz zugang passwort notfall stopp",
        summary:
          "Planungsteam und Administratoren arbeiten bewusst mit unterschiedlichen Rechten. Administrativ geschützte Funktionen wie Passwortresets, Einmal-Zugänge, globale Sperre und Wiederherstellungen werden serverseitig geprüft.",
        showPermissions: true,
        callout: {
          tone: "security",
          title: "Keine Sicherheitsprüfung nur im Browser",
          text: "Die maßgeblichen Rollen- und Eventfreigaben werden serverseitig durchgesetzt. Eine sichtbare Schaltfläche allein verleiht keine Berechtigung.",
        },
        workspace: { href: "/sicherheit", label: "Rechteverwaltung öffnen", adminOnly: true },
      },
    ],
  },
  {
    id: "faq-az",
    number: 9,
    title: "A–Z Stichwortregister & FAQ",
    keywords: "faq fragen antworten stichwortregister suche az",
    icon: BookOpenCheck,
    accent: "border-slate-200 bg-slate-50 text-slate-900",
    topics: [
      {
        id: "faq",
        title: "9.1 Häufig gestellte Fragen",
        audience: ["all"],
        keywords: "faq frage antwort zugriff event wechseln hilfe",
        summary:
          "Nutzen Sie die Suche oben, wenn Sie direkt zu einer Funktion gelangen möchten. Die Filter schränken die Inhalte auf allgemein gültige, planungsteamspezifische oder administrative Themen ein.",
        steps: [
          "Passenden Rollenfilter aktivieren.",
          "Stichwort oder Modulname in die Live-Suche eingeben.",
          "Kapitel im Inhaltsverzeichnis auswählen und das passende Thema aufklappen.",
        ],
      },
      {
        id: "az-register",
        title: "9.2 Alphabetisches Stichwortverzeichnis",
        audience: ["all"],
        keywords: "a z register dashboard helfer import material pdf schicht",
        summary:
          "Das Inhaltsverzeichnis und die Live-Suche bilden gemeinsam das Stichwortregister. Begriffe wie Helfer, Einsatzplan, JSON, Excel, Material, PDF, Passwort oder Standort führen direkt zu den passenden Kapiteln.",
        showAzIndex: true,
        visual: {
          label: "Live-Suche",
          title: "Ein Begriff genügt",
          icon: Search,
          items: ["Modulnamen suchen", "Funktionen und Fachbegriffe finden", "Rollenfilter bei Bedarf kombinieren"],
        },
        screenshot: {
          src: "/api/help/images/help-center",
          alt: "Aktuelles MyCrewMate Hilfe-Center mit Suche, Rollenfiltern und Kapitelübersicht",
          caption: "Das aktuelle Hilfe-Center bündelt neun Kapitel, Rollenfilter, Live-Suche und das alphabetische Stichwortregister.",
        },
      },
    ],
  },
];

export const AZ_INDEX: readonly AzIndexEntry[] = [
  ["A", [{ label: "Ansprechpartner", audience: "admin" }, { label: "Anmeldung" }, { label: "Audit-Protokoll", audience: "admin" }]],
  ["B", [{ label: "Backup" }, { label: "Bereich" }, { label: "Bestätigung", audience: "planning" }]],
  ["C", [{ label: "Chat" }, { label: "Countdown" }, { label: "Cooldown" }]],
  ["D", [{ label: "Dashboard" }, { label: "Doppelbelegung", audience: "admin" }, { label: "Download" }]],
  ["E", [{ label: "Einsatzplan", audience: "admin" }, { label: "Excel" }, { label: "Event" }]],
  ["F", [{ label: "Filter" }, { label: "Finanzen", audience: "admin" }, { label: "Freigabe", audience: "admin" }]],
  ["H", [{ label: "Helfer", audience: "planning" }, { label: "Hilfe" }, { label: "Historie", audience: "admin" }]],
  ["I", [{ label: "Import", audience: "admin" }, { label: "Inhaltsverzeichnis" }, { label: "Istwert", audience: "planning" }]],
  ["M", [{ label: "Material", audience: "planning" }, { label: "Meine Aufgaben" }, { label: "Mitteilung" }]],
  ["N", [{ label: "Nachbereitung", audience: "planning" }, { label: "Notfall-Sperre", audience: "admin" }, { label: "Notizen" }]],
  ["P", [{ label: "Passwort", audience: "admin" }, { label: "PDF" }, { label: "Planungsteam" }, { label: "PWA" }]],
  ["S", [{ label: "Schicht", audience: "admin" }, { label: "Sicherheit", audience: "admin" }, { label: "Spenden", audience: "planning" }, { label: "Standort", audience: "admin" }]],
  ["V", [{ label: "Verfügbarkeit", audience: "planning" }, { label: "Veranstaltung" }, { label: "Vorbereitung", audience: "planning" }]],
  ["Z", [{ label: "Zugang", audience: "admin" }, { label: "Zurücksetzen", audience: "admin" }, { label: "Zuweisung", audience: "admin" }]],
];

const matchesAudience = (topic: HelpTopic, filter: HelpAudience) =>
  filter === "all"
    ? topic.audience.includes("all")
    : filter === "admin"
      ? topic.audience.includes("all") ||
        topic.audience.includes("planning") ||
        topic.audience.includes("admin")
      : topic.audience.includes("all") || topic.audience.includes("planning");

export function getVisibleHelpChapters(audience: HelpAudience, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  return HELP_CHAPTERS.map(chapter => {
    const chapterMatches = `${chapter.title} ${chapter.keywords}`
      .toLocaleLowerCase("de-DE")
      .includes(normalizedQuery);
    const topics = chapter.topics.filter(topic => {
      const matchesText = `${topic.title} ${topic.summary} ${topic.keywords} ${(topic.steps ?? []).join(" ")}`
        .toLocaleLowerCase("de-DE")
        .includes(normalizedQuery);
      return matchesAudience(topic, audience) && (!normalizedQuery || chapterMatches || matchesText);
    });
    return { ...chapter, topics };
  }).filter(chapter => chapter.topics.length > 0);
}

const permissionCellColor = (value: string, role: "primaryAdmin" | "coAdmin" | "planner" | "readOnly") => {
  if (value === "Kein Zugriff") return "border-rose-300 bg-rose-50 text-rose-800";
  if (value.includes("keine Änderungen") || value.includes("Keine Änderungen")) {
    return "border-sky-300 bg-sky-50 text-sky-800";
  }
  if (role === "primaryAdmin") return "border-orange-300 bg-orange-50 text-orange-900";
  if (role === "coAdmin") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (role === "readOnly") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-amber-300 bg-amber-50 text-amber-900";
};

function RoleBadge({ audience }: { audience: HelpAudience[] }) {
  const label = audience.map(item => audienceLabel[item]).join(" · ");
  const leadAudience = audience.includes("all") ? "all" : audience[0];
  return (
    <Badge variant="outline" className={cn("shrink-0 whitespace-nowrap", audienceClassName[leadAudience])}>
      {label}
    </Badge>
  );
}

function GuideVisual({ visual }: { visual: HelpVisual }) {
  const Icon = visual.icon;
  return (
    <aside className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {visual.label}
          </p>
          <h4 className="mt-1 text-sm font-semibold text-slate-900">{visual.title}</h4>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-5 text-slate-700 sm:grid-cols-3">
        {visual.items.map(item => (
          <li key={item} className="flex gap-2 rounded-md bg-white px-2.5 py-2 ring-1 ring-slate-100">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function GuideCallout({ callout }: { callout: HelpCallout }) {
  const { box, icon: Icon } = CALLOUT_STYLE[callout.tone];
  return (
    <aside className={cn("flex gap-3 rounded-xl border p-3 text-sm leading-6", box)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <h4 className="font-semibold">{callout.title}</h4>
        <p className="mt-0.5">{callout.text}</p>
      </div>
    </aside>
  );
}

function WorkspaceLink({
  workspace,
  isAdmin,
}: {
  workspace: NonNullable<HelpTopic["workspace"]>;
  isAdmin: boolean;
}) {
  if (workspace.adminOnly && !isAdmin) {
    return (
      <aside className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
        Dieser Arbeitsbereich ist ausschließlich für das Admin-Team freigegeben.
      </aside>
    );
  }

  return (
    <Link
      href={workspace.href}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm transition-[transform,background-color,border-color] duration-150 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      {workspace.label}
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

function PermissionMatrix() {
  const roles = [
    { key: "primaryAdmin" as const, label: "Hauptadmin" },
    { key: "coAdmin" as const, label: "Co-Admin" },
    { key: "planner" as const, label: "Planer" },
    { key: "readOnly" as const, label: "Lesezugriff" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="border-b bg-slate-50 px-3 py-2.5">
        <h4 className="text-sm font-semibold text-slate-900">Berechtigungsmatrix: Rollen im Verein</h4>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">
          Hauptadmin, Co-Admin, Planer und Lesezugriff im direkten Vergleich. Maßgeblich bleibt stets die serverseitige Prüfung der angemeldeten Sitzung.
        </p>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {PERMISSION_MATRIX.map(row => (
          <article key={row.area} className="space-y-2 p-3">
            <h5 className="text-sm font-semibold text-slate-900">{row.area}</h5>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map(role => (
                <div key={role.key}>
                  <p className="text-xs text-slate-500">{role.label}</p>
                  <Badge variant="outline" className={cn("mt-1 whitespace-normal text-left", permissionCellColor(row[role.key], role.key))}>
                    {row[role.key]}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-slate-600">{row.note}</p>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="w-[18%] px-3 py-2.5 font-semibold">Bereich</th>
              <th className="w-[15%] px-3 py-2.5 font-semibold">Hauptadmin</th>
              <th className="w-[15%] px-3 py-2.5 font-semibold">Co-Admin</th>
              <th className="w-[17%] px-3 py-2.5 font-semibold">Planer</th>
              <th className="w-[15%] px-3 py-2.5 font-semibold">Lesezugriff</th>
              <th className="w-[20%] px-3 py-2.5 font-semibold">Erläuterung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PERMISSION_MATRIX.map(row => (
              <tr key={row.area} className="align-top">
                <td className="px-3 py-3 font-medium text-slate-900">{row.area}</td>
                {roles.map(role => (
                  <td key={role.key} className="px-3 py-3">
                    <Badge variant="outline" className={cn("whitespace-normal text-left", permissionCellColor(row[role.key], role.key))}>
                      {row[role.key]}
                    </Badge>
                  </td>
                ))}
                <td className="px-3 py-3 text-xs leading-5 text-slate-600">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AzIndex({
  query,
  onSearchTerm,
}: {
  query: string;
  onSearchTerm: (term: AzTerm) => void;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  const matchingTerms = AZ_INDEX.filter(([letter, terms]) =>
    !normalizedQuery ||
    `${letter} ${terms.map(term => term.label).join(" ")}`
      .toLocaleLowerCase("de-DE")
      .includes(normalizedQuery)
  );

  return (
    <section aria-label="Alphabetisches Stichwortregister">
      <h4 className="text-sm font-semibold text-slate-900">Stichwortregister</h4>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Ein Stichwort antippen, um die Live-Suche sofort auf das passende Thema zu setzen.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {matchingTerms.map(([letter, terms]) => (
          <div key={letter} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-sm leading-5 text-slate-700">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-blue-50 text-xs font-bold text-blue-800">
              {letter}
            </span>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {terms.map(term => (
                <button
                  key={term.label}
                  type="button"
                  onClick={() => onSearchTerm(term)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 transition-[transform,background-color,border-color] duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                >
                  {term.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HelpGuide({
  audience,
  query,
  isAdmin,
  onQuickSearch,
}: {
  audience: HelpAudience;
  query: string;
  isAdmin: boolean;
  onQuickSearch: (
    label: string,
    audience?: Exclude<HelpAudience, "all">
  ) => void;
}) {
  const chapters = useMemo(
    () => getVisibleHelpChapters(audience, query),
    [audience, query]
  );

  if (!chapters.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Kein Hilfethema gefunden</h2>
          <p className="mt-1 text-sm text-slate-600">
            Versuchen Sie einen allgemeineren Begriff oder wechseln Sie den Rollenfilter.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inhaltsverzeichnis</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <nav className="space-y-1" aria-label="Inhaltsverzeichnis der Hilfe">
              {chapters.map(chapter => (
                <a
                  key={chapter.id}
                  href={`#${chapter.id}`}
                  className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {chapter.number}
                  </span>
                  <span>{chapter.title}</span>
                </a>
              ))}
            </nav>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/70 shadow-sm">
          <CardContent className="p-3 text-xs leading-5 text-slate-600">
            <p className="font-semibold text-slate-800">So funktioniert die Filterung</p>
            <p className="mt-1">
              „Für alle“ zeigt gemeinsame Grundlagen. Die beiden Rollenfilter ergänzen jeweils die dafür vorgesehenen Arbeitsschritte.
            </p>
          </CardContent>
        </Card>
      </aside>

      <main className="space-y-5">
        {chapters.map(chapter => {
          const ChapterIcon = chapter.icon;
          return (
            <section key={chapter.id} id={chapter.id} className="scroll-mt-6">
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="border-b bg-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", chapter.accent)}>
                      <ChapterIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Kapitel {chapter.number}
                      </p>
                      <CardTitle className="mt-1 text-lg leading-6 text-slate-950 sm:text-xl">
                        {chapter.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="multiple" className="divide-y divide-slate-100">
                    {chapter.topics.map(topic => (
                      <AccordionItem key={topic.id} value={topic.id} className="border-0">
                        <AccordionTrigger className="px-4 py-4 text-left no-underline hover:bg-slate-50 hover:no-underline sm:px-5">
                          <div className="mr-3 flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                              {topic.title}
                            </span>
                            <RoleBadge audience={topic.audience} />
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-slate-50/40 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                          <div className="space-y-4 border-t border-slate-100 pt-4">
                            <p className="leading-7 text-slate-700">{topic.summary}</p>
                            {topic.steps && (
                              <ol className="grid gap-2">
                                {topic.steps.map((step, index) => (
                                  <li key={step} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-700 text-xs font-bold text-white">
                                      {index + 1}
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {topic.callout && <GuideCallout callout={topic.callout} />}
                            {topic.visual && <GuideVisual visual={topic.visual} />}
                            {topic.screenshot && (
                              <figure
                                className={cn(
                                  "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
                                  topic.screenshot.display === "mobile" &&
                                    "mx-auto max-w-xs"
                                )}
                              >
                                <img
                                  src={topic.screenshot.src}
                                  alt={topic.screenshot.alt}
                                  className={cn(
                                    "h-auto w-full object-contain",
                                    topic.screenshot.display === "mobile" &&
                                      "max-h-64 w-auto mx-auto"
                                  )}
                                  loading="lazy"
                                />
                                <figcaption className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                                  {topic.screenshot.caption}
                                </figcaption>
                              </figure>
                            )}
                            {topic.showPermissions && <PermissionMatrix />}
                            {topic.showAzIndex && (
                              <AzIndex
                                query={query}
                                onSearchTerm={term =>
                                  onQuickSearch(term.label, term.audience)
                                }
                              />
                            )}
                            {topic.workspace && (
                              <WorkspaceLink workspace={topic.workspace} isAdmin={isAdmin} />
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </section>
          );
        })}
      </main>
    </div>
  );
}

export const HELP_CHAPTER_COUNT = HELP_CHAPTERS.length;
