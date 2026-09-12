import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileDown,
  PlayCircle,
  Search,
  ShieldCheck,
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
      "anmelden start dashboard jahr veranstaltung navigation mobil logo",
    summary:
      "Nach der Anmeldung wählen Sie links zuerst Veranstaltungsjahr und Veranstaltung. Alle Listen, Auswertungen und Exporte beziehen sich ausschließlich auf diese Auswahl. Auf dem Smartphone öffnen Sie dieselbe Navigation über das Menüsymbol oben links.",
    image: {
      src: "/manus-storage/dashboard_78912d62.png",
      alt: "Dashboard der RSC Helferplanung",
      caption:
        "Dashboard mit Veranstaltungswahl, Kennzahlen, festem RSC-Logo und Hilfe-Reiter.",
    },
  },
  {
    id: "helferablauf",
    title: "Helfereinteilung in sechs Schritten",
    role: "alle",
    keywords:
      "ablauf helfer eintragen kontakt freitag samstag sonntag bemerkung warten einsatzplan pdf senden bestätigen ja nein",
    summary:
      "Dieser Ablauf ist die verbindliche Reihenfolge für die Betreuung eines Helfers. Das Planungsteam übernimmt vor allem Erfassung und Rückmeldung. Administratoren bauen zusätzlich den Einsatzplan und teilen Helfer ein.",
    steps: [
      "Helfer in der Helferübersicht eintragen.",
      "Mit dem Helfer Kontakt aufnehmen und die Verfügbarkeit für alle aktiven Veranstaltungstage sowie sonstige Bemerkungen klären und erfassen.",
      "Warten, bis der Einsatzplan durch das Administratorenteam fertiggestellt ist.",
      "Die persönliche PDF-Helfereinteilung erzeugen und dem Helfer übergeben oder zusenden.",
      "Die Rückmeldung des Helfers abwarten und prüfen, ob die Einteilung in Ordnung ist.",
      "In der Helferübersicht das Feld „Bestätigt?“ abschließend auf Ja oder Nein setzen.",
    ],
    image: {
      src: "/manus-storage/helpers_02bc01e0.png",
      alt: "Helferübersicht mit Verfügbarkeit und Bestätigung",
      caption:
        "Helferübersicht: Ansprechpartner, Verfügbarkeit, Bemerkung und Bestätigung werden an einer Stelle gepflegt.",
    },
  },
  {
    id: "einsatzplan",
    title: "Einsatzplan aufbauen und Helfer einteilen",
    role: "admin",
    keywords:
      "einsatzplan schicht neue schicht bereich aufgabe zeit bedarf bemerkung zuweisen doppelbelegung ausfall",
    summary:
      "Nur Administratoren legen Schichten an, pflegen Bereichsansprechpartner und weisen Helfer zu. Planungsteam-Mitglieder können den Plan ansehen und filtern, aber nicht verändern. Für das Planungsteam ist der Bearbeitungsteil dieses Kapitels daher nicht erforderlich.",
    steps: [
      "Über „Neue Schicht“ einen Wochentag von Montag bis Sonntag sowie Bereich, Aufgabe, Zeit, Bedarf und Bemerkung erfassen.",
      "Jedem Einsatzbereich einen Ansprechpartner zuordnen.",
      "Nur aktive Helfer auswählen. Für jeden aktiven Veranstaltungstag gilt die in der Helferkartei gepflegte Tagesverfügbarkeit.",
      "Gelb markierte Namen im Auswahlmenü sind am selben Tag zur gewählten Einsatzzeit bereits in einer anderen Schicht eingeteilt. Die Auswahl bleibt bewusst möglich.",
      "Status OFFEN, KNAPP oder OK sowie Warnungen zu Ausfällen und Doppelbelegungen kontrollieren.",
    ],
    image: {
      src: "/manus-storage/plan_69081e27.png",
      alt: "Einsatzplan mit Schichten und Helferzuweisungen",
      caption:
        "Einsatzplan: Administratoren bearbeiten Schichten und Zuweisungen; das Planungsteam liest und filtert.",
    },
  },
  {
    id: "pdf",
    title: "Persönliche Helfer-PDF erzeugen und versenden",
    role: "alle",
    keywords:
      "pdf aufgabenübersicht einzelner helfer zip alle drucken senden logo rufnummer ansprechpartner",
    summary:
      "Die persönliche PDF enthält die Aufgaben, Zeiten, Mithelfer, Bemerkungen sowie Name und Rufnummer des Ansprechpartners. Sie kann direkt beim Helfer einzeln oder im Bereich PDF-Ausgabe gesammelt erzeugt werden.",
    steps: [
      "Vor der Ausgabe kontrollieren, ob Helfer, Ansprechpartner und Einsatzzuweisungen vollständig sind.",
      "In der Helferübersicht das PDF-Symbol beim gewünschten Helfer wählen oder unter PDF-Ausgabe alle PDFs als ZIP erzeugen.",
      "PDF an den Helfer senden und erst nach dessen Rückmeldung den Bestätigungsstatus pflegen.",
    ],
    image: {
      src: "/manus-storage/pdf_ada1281e.png",
      alt: "Seite PDF-Ausgabe",
      caption:
        "PDF-Ausgabe für einzelne Helfer, alle Helfer und gefilterte Einsatzpläne.",
    },
  },
  {
    id: "rollen",
    title: "Rollen: Planungsteam und Administratoren",
    role: "alle",
    keywords:
      "rollen rechte berechtigung planungsteam admin administrator zugriff irrelevant verantwortlich",
    summary:
      "Gelb markierte Anleitungen betreffen das Planungsteam. Grün markierte Anleitungen sind ausschließlich für Administratoren relevant. Kapitel mit blauem Hinweis gelten für beide Rollen.",
    steps: [
      "Planungsteam: Ansprechpartner und Helfer pflegen, Verfügbarkeiten und Bestätigungen erfassen, operative Listen bearbeiten, PDFs erzeugen, Projektdateien speichern, Excel-Übersichten exportieren sowie den Einsatzplan ansehen und filtern.",
      "Administratoren: zusätzlich Veranstaltungen verwalten, Einsatzplan bearbeiten, Helfer zuweisen, Projektdateien laden, Excel-Module importieren, Zugänge und PDF-Konfiguration verwalten sowie sensible Lösch- und Resetvorgänge ausführen.",
      "Für das Planungsteam irrelevant: Schichten verändern, Helfer im Einsatzplan zuweisen, Veranstaltungen löschen, Passwörter verwalten und Löschprotokolle administrieren.",
    ],
    image: {
      src: "/manus-storage/roles_c966c02d.png",
      alt: "Berechtigungsmatrix für Planungsteam und Administratoren",
      caption:
        "Die Berechtigungsmatrix zeigt jederzeit, welche Rolle einen Bereich nur lesen oder vollständig bearbeiten darf.",
    },
  },
  {
    id: "excel",
    title: "Projektdatei speichern/laden und Excel-Module importieren",
    role: "alle",
    keywords:
      "json projektdatei speichern laden excel import export modul wiederherstellung prüfung vorschau filter löschung neue helfer schicht zuordnung dublette planungsteam administrator protokoll",
    summary:
      "Die globalen Schaltflächen „Speichern“ und „Laden“ liegen links unter der Veranstaltungsauswahl. „Speichern“ erzeugt eine kompakte JSON-Projektdatei mit dem vollständigen Stand der gewählten Veranstaltung; beide Rollen dürfen sie sichern. Nur Administratoren dürfen eine Projektdatei nach Vorschau und Passwortfreigabe laden. Beim Laden werden die aktuellen Planungsdaten der Veranstaltung innerhalb einer Transaktion vollständig zurückgesetzt und anschließend aus der Datei neu aufgebaut. Excel dient nur noch der Übersicht: Die Gesamtdatei wird unter „Excel-Projektübersicht“ erzeugt. Ein Import erfolgt im jeweiligen Bereich über „Excel importieren“ aus einer aktuellen .xlsx-Datei und verändert ausschließlich dieses Modul samt zwingender direkter Bezüge. Die Vorschau lässt sich nach neuen Daten, Änderungen oder Löschungen filtern; der Filter ändert nur die Anzeige, bestätigt werden immer alle erkannten Änderungen des Bereichs. Bei reinen Umbenennungen muss die ausgeblendete ID-Spalte des Projekt-Exports erhalten bleiben. Doppelbelegungen und ungültige Dateien werden blockiert und jeder Ladevorgang wird protokolliert.",
  },
  {
    id: "veranstaltungen",
    title: "Jahre und Veranstaltungen verwalten",
    role: "admin",
    keywords:
      "jahr veranstaltung anlegen umbenennen löschen plus regler übernehmen vorjahr",
    summary:
      "Administratoren können pro Jahr mehrere Veranstaltungen anlegen und dabei die aktiven Wochentage Montag bis Sonntag auswählen. Diese Auswahl steuert Helferverfügbarkeiten, Schichtdialoge und Tagesfilter. Eine Planübernahme wird vollständig abgebrochen, wenn die Quelle Schichten an nicht aktiven Zieltagen enthält. Über das Regler-Symbol lassen sich Veranstaltungen umbenennen oder nach Passwortbestätigung löschen. Die letzte Veranstaltung eines Jahres bleibt geschützt. Für das Planungsteam ist dieses Kapitel nicht erforderlich; es wählt nur Jahr und Veranstaltung aus.",
  },
  {
    id: "sicherheit",
    title: "Löschen, Rückgängig und Zugangsschutz",
    role: "admin",
    keywords:
      "löschen zurücksetzen rückgängig protokoll passwort zugang sicherheit adminpasswort",
    summary:
      "Sensible Löschungen, Resets, Passwörter und Protokollfunktionen sind administrativ geschützt. Einzelne protokollierte Helfer- und Kuchenlöschungen können im Bereich Rollen & Protokoll wiederhergestellt werden.",
    steps: [
      "Beim passwortbestätigten Löschen eines Ansprechpartners wird dessen eigener gleichnamiger Helfereintrag automatisch mitgelöscht. Andere von dieser Person betreute Helfer bleiben bestehen und werden nur ohne Ansprechpartner weitergeführt.",
    ],
  },
];

const INDEX_TERMS = [
  ["A", "Ansprechpartner, Anmeldung, Administrator"],
  ["B", "Bemerkung, Bestätigung, Berechtigungen"],
  ["D", "Dashboard, Doppelbelegung"],
  ["E", "Einsatzplan, Excel, Export"],
  ["F", "Freitag, Filter"],
  ["H", "Helfer, Helfereinteilung, Hilfe"],
  ["I", "Import, Inhaltsverzeichnis"],
  ["J", "Jahr, Ja/Nein"],
  ["L", "Logo, Löschen, Löschprotokoll"],
  ["M", "Mobilansicht, Montag, Material, Marketing"],
  ["P", "PDF, Planungsteam, Passwort"],
  ["R", "Rollen, Rückgängig"],
  ["S", "Samstag, Schicht, Sonntag, Suche, sieben Wochentage"],
  ["V", "Veranstaltung, Verfügbarkeit"],
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
  const { user } = useAuth();
  const helpVideo =
    user?.role === "admin"
      ? {
          src: "/manus-storage/RSC-Helferplanung-Erklaervideo-Administratoren_48a1d1ca.mp4",
          poster:
            "/manus-storage/RSC-Helferplanung-Poster-Administratoren_483a22df.jpg",
          label: "Video-Anleitung für Administratoren",
        }
      : user?.role === "user"
        ? {
            src: "/manus-storage/RSC-Helferplanung-Erklaervideo-Planungsteam_3101461c.mp4",
            poster:
              "/manus-storage/RSC-Helferplanung-Poster-Planungsteam_a962d33a.jpg",
            label: "Video-Anleitung für das Planungsteam",
          }
        : null;
  const guidePdf = trpc.help.guidePdf.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("PDF-Anleitung wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  const filteredSections = useMemo(
    () =>
      SECTIONS.filter(section =>
        `${section.title} ${section.summary} ${section.keywords} ${(section.steps ?? []).join(" ")}`
          .toLocaleLowerCase("de-DE")
          .includes(normalizedQuery)
      ),
    [normalizedQuery]
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
          <h1 className="text-2xl font-bold">
            Anleitung zur RSC Helferplanung
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Schnelle Hilfe für Planungsteam und Administratoren – mit
            Rollenhinweisen, Arbeitsschritten, Bildern und einer vollständigen
            PDF-Anleitung.
          </p>
        </div>
        <div className="min-w-0 space-y-3">
          {helpVideo && (
            <Card className="overflow-hidden border-primary/20 shadow-sm">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  Video-Anleitung
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <video
                  key={helpVideo.src}
                  controls
                  playsInline
                  preload="metadata"
                  poster={helpVideo.poster}
                  className="aspect-video w-full max-w-full rounded-lg bg-slate-950 object-contain shadow-inner"
                  aria-label={helpVideo.label}
                >
                  <source src={helpVideo.src} type="video/mp4" />
                  Ihr Browser unterstützt die Videowiedergabe nicht.
                </video>
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
              : "PDF-Anleitung herunterladen"}
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
          <div className="flex flex-wrap gap-2">
            <RoleBadge role="alle" />
            <RoleBadge role="planung" />
            <RoleBadge role="admin" />
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
                      className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      {SECTIONS.findIndex(item => item.id === section.id) + 1}.{" "}
                      {section.title}
                    </a>
                  )
                )}
                <a
                  href="#az"
                  className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
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
                  Versuchen Sie einen allgemeineren Begriff oder löschen Sie die
                  Suche.
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
