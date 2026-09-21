import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/PageTitle";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  FileDown,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ROLE_STYLE = {
  alle: "border-sky-300 bg-sky-50 text-sky-900",
  planung: "border-amber-300 bg-amber-50 text-amber-950",
  admin: "border-emerald-300 bg-emerald-50 text-emerald-950",
} as const;

const ROLE_LABEL = {
  alle: "Für beide Rollen",
  planung: "Planungsteam",
  admin: "Nur Administratoren",
} as const;

const ROLE_FILTER_LABEL = {
  alle: "Alle Kapitel",
  planung: "Nur Planungsteam",
  admin: "Nur Administratoren",
} as const;

const ROLE_FILTER_STYLE = {
  alle: "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100",
  planung: "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100",
  admin: "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
} as const;

const PLANNING_TEAM_FLOW = [
  {
    icon: MessageCircle,
    title: "1. Kontakt aufnehmen",
    description: "Ansprechpartner, Telefonnummer und offene Fragen klären.",
  },
  {
    icon: Smartphone,
    title: "2. Verfügbarkeit erfassen",
    description: "Tage, Einschränkungen und PDF-Hinweis eintragen.",
  },
  {
    icon: Clock3,
    title: "3. Einteilung abwarten",
    description: "Den fertigen Plan lesen und mit Filtern prüfen.",
  },
  {
    icon: Send,
    title: "4. Helferplan senden",
    description: "Persönlichen PDF-Link per WhatsApp weitergeben.",
  },
  {
    icon: MessageCircle,
    title: "5. Rückmeldung abwarten",
    description: "Fragen, Zusagen oder Absagen transparent klären.",
  },
  {
    icon: CheckCircle2,
    title: "6. Bestätigung setzen",
    description: "Nach verbindlicher Zusage den Schalter auf Ja stellen.",
  },
] as const;

type HelpSection = {
  id: string;
  title: string;
  role: keyof typeof ROLE_STYLE;
  keywords: string;
  summary: string;
  steps?: string[];
  image?: { src: string; alt: string; caption: string };
};

const SECTIONS: HelpSection[] = [
  {
    id: "start",
    title: "Schnellstart und Orientierung",
    role: "alle",
    keywords:
      "anmelden start dashboard jahr veranstaltung navigation mobil logo pwa app speichern smartphone sechs schritte",
    summary:
      "Nach der Anmeldung wählen Sie oben links zuerst Veranstaltungsjahr und Veranstaltung. Diese Auswahl ist der Planungsraum: Listen, Kennzahlen, Exporte und Imports beziehen sich immer ausschließlich auf das ausgewählte Event. Auf dem Smartphone öffnen Sie die Navigation über das Menüsymbol; über „Als App auf Handy speichern“ lässt sich die Helferplanung als Progressive Web App auf den Startbildschirm legen.",
    steps: [
      "Jahr und Veranstaltung kontrollieren, bevor Daten gelesen, geändert, importiert oder exportiert werden.",
      "Ansprechpartner anlegen und ihre Rufnummern vollständig pflegen.",
      "Helfer erfassen, Ansprechpartner zuordnen und die Verfügbarkeiten für jeden aktiven Veranstaltungstag eintragen.",
      "Schichten, Bereiche, Zeiten und Helferbedarf im Einsatzplan vorbereiten und die Besetzung prüfen.",
      "Persönliche Einteilungen als PDF ausgeben, verteilen und Rückmeldungen im Feld „Bestätigt?“ dokumentieren.",
      "Den Projektstand regelmäßig sichern und nach dem Event offene Aufgaben, Material, Finanzen und Nachbereitung abschließen.",
    ],
    image: {
      src: "/api/help/images/dashboard",
      alt: "Aktuelles Dashboard von MyCrewMate für MyEifelRide 2027",
      caption:
        "Dashboard mit Veranstaltungswahl, drei Kennzahlenbereichen und direktem Zugang zu allen Arbeitsmodulen.",
    },
  },
  {
    id: "app-auf-handy",
    title: "MyCrewMate als App auf dem Handy speichern",
    role: "alle",
    keywords:
      "app handy speichern smartphone pwa progressive web app startbildschirm homescreen iphone ipad ios android chrome safari browserleiste menü",
    summary:
      "Auf Smartphones und Tablets lässt sich MyCrewMate als Progressive Web App (PWA) auf dem Startbildschirm speichern. Sie erhält dort ein eigenes App-Symbol und öffnet sich anschließend wie eine eigene App – ohne die übliche Browserleiste. Es ist keine zusätzliche Installation aus einem App-Store notwendig; Anmeldung und Datenzugriff bleiben dabei unverändert geschützt.",
    steps: [
      "Auf dem Smartphone das Seitenmenü über das Menüsymbol oben links öffnen. Der blau hervorgehobene Button „Als App auf Handy speichern“ befindet sich unter „Projektstand“.",
      "Auf iPhone oder iPad den Button antippen. In Safari unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben) tippen und anschließend „Zum Home-Bildschirm“ auswählen.",
      "Auf Android den Button antippen. In Chrome oben rechts die drei Punkte öffnen und „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen. Wenn der Installationsdialog erscheint, kann „App jetzt installieren“ direkt verwendet werden.",
      "Danach das neue MyCrewMate-Symbol auf dem Startbildschirm antippen. Die Helferplanung startet im eigenständigen App-Fenster; für die Nutzung ist weiterhin eine Internetverbindung erforderlich.",
    ],
    image: {
      src: "/api/help/images/app-speichern",
      alt: "Mobiles Seitenmenü mit dem Button Als App auf Handy speichern",
      caption:
        "Im mobilen Seitenmenü: Der hervorgehobene Button „Als App auf Handy speichern“ öffnet die passende Anleitung für iPhone/iPad und Android.",
    },
  },
  {
    id: "rollen",
    title: "Rollen und Passwortschutz",
    role: "alle",
    keywords:
      "rollen rechte berechtigung planungsteam administrator admin passwort ändern re-authentifizierung altes passwort zugangsschutz",
    summary:
      "Die Rollen sind bewusst getrennt. Das Planungsteam arbeitet im geschützten Lesemodus für die Gesamtstruktur und pflegt Helfer- sowie Kuchendaten. Administratoren haben den Vollzugriff auf Veranstaltungen, Schichten, Importe, Wiederherstellungen, Exporte, Zugänge und sensible Löschungen. Ein Administratorpasswort kann nur nach Eingabe des aktuellen Administratorpassworts geändert werden; diese erneute Bestätigung schützt vor unbeabsichtigten oder unbefugten Änderungen.",
    steps: [
      "Planungsteam: Helfer- und Kuchendaten pflegen, Verfügbarkeiten und Rückmeldungen erfassen sowie Einteilungen und Hilfen lesen.",
      "Administratoren: zusätzlich Schichten und Zuweisungen bearbeiten, Projekte laden, Excel-Importe freigeben, Veranstaltungen konfigurieren und Zugangsschutz verwalten.",
      "Passwörter und Wiederherstellungen niemals in Gruppen teilen. Bei einem Passwortwechsel ist immer das bisherige Administratorpasswort erforderlich.",
    ],
  },
  {
    id: "helfer",
    title: "Helferkartei und Verfügbarkeiten",
    role: "planung",
    keywords:
      "helfer helferkartei verfügbar helfer helfen bestätigt ansprechpartner telefon hinweis pdf ampelsystem grün rot gelb vielleicht mobil teilen whatsapp share einteilung",
    summary:
      "In der Helferkartei werden Name, Ansprechpartner, Rufnummer, Hinweis für PDF und Tagesverfügbarkeiten zusammengeführt. Das Ampelsystem bedeutet: Grün/Ja ist verfügbar oder bestätigt, Rot/Nein ist nicht verfügbar oder nicht bestätigt, Gelb/? ist unklar und verlangt eine Rückfrage. Der PDF-Hinweis erscheint in der persönlichen Einteilung. Für die Übermittlung kann die erzeugte Einzel-PDF anschließend über das Teilen-Menü des Geräts, zum Beispiel per WhatsApp oder E-Mail, weitergegeben werden.",
    steps: [
      "Helfer anlegen oder per aktueller Excel-Datei importieren und einen Ansprechpartner auswählen.",
      "Für jeden aktiven Veranstaltungstag „Ja“, „Nein“ oder „?“ setzen. Nur die zur Veranstaltung aktivierten Tage werden angezeigt.",
      "Telefonnummer und Hinweis für PDF eintragen; auf Mobilgeräten liegen die Felder übersichtlich in einer zweispaltigen Kartenansicht.",
      "Nach Versand der Einteilung die verbindliche Rückmeldung im Schalter „Bestätigt?“ dokumentieren.",
    ],
    image: {
      src: "/api/help/images/helpers",
      alt: "Mobile Helferkartei mit Ansprechpartner und PDF-Hinweis",
      caption:
        "Mobile Helferkarte: Ansprechpartner, Kontaktfelder und der PDF-Hinweis bleiben auch auf schmalen Bildschirmen gut bedienbar.",
    },
  },
  {
    id: "einsatzplan",
    title: "Einsatzplan und intelligente Belegung",
    role: "admin",
    keywords:
      "einsatzplan schicht neue schicht bereich aufgabe zeit bedarf bemerkung zuweisen ansprechpartner doppelt orange ausfall rot filter tag",
    summary:
      "Administratoren erstellen Schichten mit Tag, Bereich, Aufgabe, Beginn, Ende, Bedarf und Bemerkung. Jeder Bereich kann einen Ansprechpartner erhalten. Die Anwendung prüft Belegung und Verfügbarkeit: Orange markiert mögliche Doppelbelegungen, Rot kennzeichnet Ausfälle. Beide Hinweise bleiben sichtbar, damit die Einsatzleitung bewusst entscheiden und korrigieren kann. Das Planungsteam kann den Plan lesen und nach Tag, Bereich, Status oder Helfern filtern.",
    steps: [
      "Neue Schicht erfassen und nur einen für die Veranstaltung aktiven Wochentag auswählen.",
      "Bereichsansprechpartner, Zeitfenster, Helferbedarf und Bemerkung festlegen.",
      "Helfer zuordnen; gelb markierte Namen im Auswahlmenü sind zum betreffenden Zeitpunkt bereits anderweitig eingeteilt, bleiben aber bewusst wählbar.",
      "Status OFFEN, KNAPP oder OK sowie orange Doppelbelegungen und rote Ausfälle vor Beginn jeder Schicht prüfen.",
    ],
    image: {
      src: "/api/help/images/plan",
      alt: "Einsatzplan mit Schichten und Bereichsansprechpartnern",
      caption:
        "Einsatzplan mit Bereichsansprechpartnern, Filtern, Schichtzeilen und den Statushinweisen zur Belegung.",
    },
  },
  {
    id: "chat",
    title: "Live-Chat und Notiz-Widget",
    role: "alle",
    keywords:
      "chat notiz nachricht dringend wichtig warnton pulsieren tippt gerade 24 stunden ansprechpartner ungelesen",
    summary:
      "Das schwebende Notiz-Widget rechts unten ist auf allen Seiten verfügbar. Nachrichten werden im kurzen Intervall aktualisiert. Wichtige Durchsagen erhalten eine Signalfarbe und können bei aktivem Ton einen Warnton sowie ein pulsierendes Symbol auslösen. Der Hinweis „… tippt gerade“ zeigt eine aktuelle Eingabe anderer Teilnehmer. Neue Nachrichten werden höchstens 24 Stunden aufbewahrt; Administratoren können den Verlauf für die gewählte Veranstaltung bereinigen.",
    steps: [
      "Widget öffnen und beim ersten Einsatz den eigenen Ansprechpartner oder einen freien Namen auswählen.",
      "Nachricht schreiben; bei dringenden Informationen vor dem Senden „Wichtig“ aktivieren.",
      "Für Ruhephasen den sichtbaren Stummschalter nutzen. Der Verlauf wird danach automatisch zeitbegrenzt bereinigt.",
    ],
    image: {
      src: "/api/help/images/chat",
      alt: "Geöffnetes Live-Chat-Widget von MyCrewMate",
      caption:
        "Geöffnetes Notiz-Widget mit Namenszuordnung vor der ersten Nachricht und zentralen Steuerungen im Kopfbereich.",
    },
  },
  {
    id: "fachbereiche",
    title: "Fachbereiche und Aufgaben",
    role: "alle",
    keywords:
      "vorbereitung nachbereitung material kommunikation marketing genehmigungen finanzen kuchen aufgaben verantwortlich status offen in arbeit erledigt",
    summary:
      "Vorbereitung und Nachbereitung strukturieren die To-dos vor und nach der Veranstaltung. Kommunikationsmaßnahmen, Anträge und Genehmigungsfristen werden als Kategorien direkt in der Vorbereitung erfasst. Material hält Artikel, Mengen und Bestellstatus fest, Finanzen zeigen Einnahmen und Ausgaben, und Kuchen dokumentiert Spender sowie Abgabezeiten. Die Statuswerte „offen“, „in Arbeit“ und „erledigt“ helfen, den Arbeitsstand für alle transparent zu halten.",
  },
  {
    id: "import",
    title: "Import, Wiederherstellung und Datensicherheit",
    role: "admin",
    keywords:
      "excel import vorschau spalten leerzeichen anti data drop json speichern laden projektdatei restore wiederherstellung sicherung löschprotokoll id zeit iso ansprechpartner helfer",
    summary:
      "„Speichern“ erzeugt eine JSON-Projektdatei des aktuell gewählten Events. Beim administrativen Laden wird der Zielbereich erst in einer Vorschau geprüft und dann vollständig und atomar wiederhergestellt. Die Excel-Projektübersicht dient als Lesekopie; ein Excel-Import erfolgt jeweils im passenden Modul und zeigt vor der Übernahme neue, geänderte und gelöschte Zeilen. Überschriften werden bereinigt, technische IDs gegen Jahr und Event geprüft und Zeitwerte wie Excel- oder ISO-Uhrzeiten vereinheitlicht. So verhindern Vorschau, Scope-Prüfung und die Behandlung leerer Spalten Datenverluste.",
    steps: [
      "Vor jeder Wiederherstellung zunächst eine aktuelle JSON-Sicherung speichern.",
      "Im jeweiligen Modul „Excel importieren“ wählen und die Vorschau nach neuen Daten, Änderungen oder Löschungen kontrollieren.",
      "Nur als Administrator die geprüfte Vorschau freigeben. Bei einer zwischenzeitlichen Änderung muss die Vorschau erneut erstellt werden.",
      "Sensible Löschungen und Ladevorgänge im Löschprotokoll nachvollziehen; einzelne protokollierte Helfer- oder Kuchenlöschungen können wiederhergestellt werden.",
    ],
  },
  {
    id: "pdf",
    title: "PDF-Ausgabe und Versand",
    role: "alle",
    keywords:
      "pdf ausgabe einzeleinteilung helfer aufgabenübersicht ansprechpartner rufnummer notiz zip blanko gefüllt gesamtübersicht download teilen whatsapp email logo",
    summary:
      "Die persönliche Helfer-PDF enthält Aufgaben, Zeiten, Mithelfende, Schichtnotizen sowie Namen und Rufnummern der Ansprechpartner. Sie kann in der Helferkartei pro Person oder gesammelt als ZIP in der PDF-Ausgabe erzeugt werden. Zusätzlich lassen sich Blanko- und gefüllte Einsatzpläne nach Tagen, Bereichen, Status und Ansprechpartnern filtern. Ein für das aktuelle Event hinterlegtes PDF-Bild erscheint ausschließlich in dessen Dokumenten.",
    steps: [
      "Vor der Ausgabe Helfer, Ansprechpartner, Rufnummer, Verfügbarkeit und zugewiesene Schichten prüfen.",
      "Einzel-PDF über das Symbol in der Helferkartei oder alle Einteilungen als ZIP in der PDF-Ausgabe erzeugen.",
      "Für die Einsatzleitung bei Bedarf eine gefilterte Gesamtübersicht oder einen frei ausfüllbaren Blanko-Plan herunterladen.",
      "Die erzeugte Einzel-PDF über die Freigabefunktion des Geräts per Messenger, E-Mail oder Ausdruck weitergeben und anschließend die Rückmeldung dokumentieren.",
    ],
    image: {
      src: "/api/help/images/pdf",
      alt: "Aktuelle PDF-Ausgabe mit Helferübersicht und Einsatzplanfiltern",
      caption:
        "PDF-Ausgabe mit Sammel-Download der Helfereinteilungen und Filtern für Blanko- oder gefüllte Einsatzpläne.",
    },
  },
];

const INDEX_TERMS = [
  ["A", "Ansprechpartner, Anmeldung, Administrator, App speichern"],
  ["B", "Bemerkung, Bestätigung, Bereich, Berechtigungen"],
  ["C", "Chat, Cookie, Cooldown"],
  ["D", "Dashboard, Doppelbelegung, Download"],
  ["E", "Einsatzplan, Excel, Export"],
  ["F", "Fachbereiche, Filter, Finanzen"],
  ["H", "Helfer, Helfereinteilung, Hilfe"],
  ["I", "Import, Inhaltsverzeichnis, ISO-Zeit"],
  ["J", "Jahr, Ja/Nein"],
  ["L", "Live-Chat, Löschen, Löschprotokoll"],
  ["M", "Mobilansicht, Material"],
  ["N", "Nachbereitung, Notiz-Widget"],
  ["P", "Passwort, PDF, Planungsteam, PWA"],
  ["R", "Restore, Rollen, Rückgängig"],
  ["S", "Sicherung, Schicht, Suche, Status"],
  ["V", "Veranstaltung, Verfügbarkeit, Vorschau"],
  ["W", "Wichtig, Warnton"],
  ["Z", "Zugangsschutz, Zuweisung"],
] as const;

function RoleBadge({ role }: { role: keyof typeof ROLE_STYLE }) {
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-normal", ROLE_STYLE[role])}
    >
      {role === "planung" ? (
        <Users className="mr-1 h-3.5 w-3.5" />
      ) : role === "admin" ? (
        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
      ) : (
        <UserRoundCog className="mr-1 h-3.5 w-3.5" />
      )}
      {ROLE_LABEL[role]}
    </Badge>
  );
}

export default function Help() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<keyof typeof ROLE_STYLE>("alle");
  const { user } = useAuth();
  const guidePdf = trpc.help.guidePdf.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("PDF-Handbuch wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  const filteredSections = useMemo(
    () =>
      SECTIONS.filter(section => {
        const matchesRole =
          roleFilter === "alle" ||
          section.role === "alle" ||
          section.role === roleFilter;
        const matchesQuery = `${section.title} ${section.summary} ${section.keywords} ${(section.steps ?? []).join(" ")}`
          .toLocaleLowerCase("de-DE")
          .includes(normalizedQuery);
        return matchesRole && matchesQuery;
      }),
    [normalizedQuery, roleFilter]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,520px)] lg:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <BookOpen className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Hilfe von A bis Z
            </span>
          </div>
          <PageTitle icon="help">Anleitung zu MyCrewMate</PageTitle>
          <p className="max-w-3xl text-muted-foreground">
            Schnelle Hilfe für Planungsteam und Administratoren – mit
            Rollenhinweisen, Arbeitsschritten, Bildern und einer vollständigen
            PDF-Anleitung.
          </p>
        </div>
        <div className="min-w-0 space-y-3">
          {user?.role === "user" && (
            <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                  <CheckCircle2 className="h-5 w-5 text-amber-700" />
                  Dein Ablauf in 6 Schritten
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-3 pt-1 sm:grid-cols-2 sm:p-4 sm:pt-1">
                {PLANNING_TEAM_FLOW.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="flex min-w-0 gap-2 rounded-lg border border-amber-200 bg-white/80 p-2.5"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{title}</p>
                      <p className="text-xs leading-5 text-slate-600">{description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={guidePdf.isPending}
            onClick={() => guidePdf.mutate()}
          >
            <Download className="h-4 w-4" />
            {guidePdf.isPending
              ? "PDF wird vorbereitet …"
              : "PDF-Handbuch herunterladen"}
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="bg-white pl-9 dark:bg-slate-950"
              placeholder="A–Z-Suche: z. B. Helfer, PDF, Bestätigung oder Excel"
              aria-label="Hilfe durchsuchen"
            />
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Hilfekapitel nach Rolle filtern"
          >
            {(Object.keys(ROLE_FILTER_LABEL) as Array<keyof typeof ROLE_STYLE>).map(
              role => {
                const active = roleFilter === role;
                const Icon =
                  role === "planung"
                    ? Users
                    : role === "admin"
                      ? ShieldCheck
                      : UserRoundCog;
                return (
                  <Button
                    key={role}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setRoleFilter(role)}
                    className={cn(
                      "min-h-11 gap-1.5 border text-sm transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.97] md:min-h-9",
                      ROLE_FILTER_STYLE[role],
                      active && "ring-2 ring-offset-1 shadow-sm"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {ROLE_FILTER_LABEL[role]}
                  </Button>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Inhaltsverzeichnis</CardTitle>
            </CardHeader>
            <CardContent>
              <nav
                className="space-y-1"
                aria-label="Inhaltsverzeichnis der Hilfe"
              >
                {(normalizedQuery ? filteredSections : SECTIONS).map(
                  section => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="flex min-h-11 items-center rounded-md px-2 py-1.5 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:min-h-0 md:text-sm"
                    >
                      {SECTIONS.findIndex(item => item.id === section.id) + 1}.{" "}
                      {section.title}
                    </a>
                  )
                )}
                <a
                  href="#az"
                  className="flex min-h-11 items-center rounded-md px-2 py-1.5 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:min-h-0 md:text-sm"
                >
                  A–Z-Stichwortregister
                </a>
              </nav>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rollenhinweis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Blau:</strong> für beide Rollen relevant.
              </p>
              <p>
                <strong>Gelb:</strong> operative Aufgaben des Planungsteams.
              </p>
              <p>
                <strong>Grün:</strong> nur für Administratoren relevant.
              </p>
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-5">
          {filteredSections.map((section, sectionIndex) => (
            <Card
              key={section.id}
              id={section.id}
              className="scroll-mt-6 shadow-sm"
            >
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-xl">
                    {SECTIONS.findIndex(item => item.id === section.id) + 1}.{" "}
                    {section.title}
                  </CardTitle>
                  <RoleBadge role={section.role} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="leading-7 text-muted-foreground">
                  {section.summary}
                </p>
                {section.steps && (
                  <ol className="space-y-3">
                    {section.steps.map((step, index) => (
                      <li
                        key={step}
                        className="flex gap-3 rounded-lg border bg-muted/20 p-3"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                          {section.id === "helferablauf" ? (
                            index + 1
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </span>
                        <span className="pt-0.5 leading-6">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {section.image && (
                  <figure className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    <img
                      src={section.image.src}
                      alt={section.image.alt}
                      className="h-auto w-full object-contain"
                      loading={sectionIndex === 0 ? "eager" : "lazy"}
                    />
                    <figcaption className="border-t bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
                      {section.image.caption}
                    </figcaption>
                  </figure>
                )}
              </CardContent>
            </Card>
          ))}

          {!filteredSections.length && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <h2 className="font-semibold">Kein Hilfethema gefunden</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Versuchen Sie einen allgemeineren Begriff, ändern Sie den
                  Rollenfilter oder löschen Sie die Suche.
                </p>
              </CardContent>
            </Card>
          )}

          <Card id="az" className="scroll-mt-6 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileDown className="h-5 w-5" /> A–Z-Stichwortregister
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INDEX_TERMS.map(([letter, terms]) => (
                <div key={letter} className="rounded-lg border p-3">
                  <div className="mb-1 text-lg font-bold text-primary">
                    {letter}
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground">
                    {terms}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
