import { PackageComparisonSection } from "@/components/PackageComparisonSection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bike,
  BrainCircuit,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleCheckBig,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Flame,
  Gem,
  HandHeart,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  Medal,
  MessageCircle,
  Music2,
  Play,
  Route,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { APP_LOGIN_URL } from "@/lib/site-host";
import { useState } from "react";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

type OfferId = "event-pass" | "light" | "pro" | "enterprise";
type OfferBenefit = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type Offer = {
  id: OfferId;
  name: string;
  eyebrow: string;
  price: number;
  pricePrefix?: string;
  priceUnit: string;
  audience: string;
  description: string;
  highlights: string[];
  notIncluded?: string[];
  detailTitle: string;
  detailText: string;
  detailBenefits: OfferBenefit[];
  included: string[];
  nextStep: string;
  accent: string;
  buttonClass: string;
  icon: LucideIcon;
  ribbonLabel?: string;
  ribbonClass?: string;
  futureOptions?: string[];
};

const PACKAGE_VIDEO_COPY: Record<
  OfferId,
  { title: string; description: string; src: string }
> = {
  "event-pass": {
    title: "Event Pass in 25 Sekunden",
    description:
      "Ein einzelnes Fest übersichtlich planen – ohne Dauerbindung und mit freier Entscheidung im nächsten Jahr.",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/PKmsMbELZprppNFR.mp4",
  },
  light: {
    title: "Light in 28 Sekunden",
    description:
      "Der verlässliche Jahresablauf für das wiederkehrende Vereinsevent und ein kleines festes Planungsteam.",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/PQUFaMfISRAHgnwl.mp4",
  },
  pro: {
    title: "Pro in 32 Sekunden",
    description:
      "Die volle Planungstiefe für Vereine mit aktiven Teams, mehreren Veranstaltungen und klaren Abläufen.",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/vLWHhFIQuWYvcwZG.mp4",
  },
  enterprise: {
    title: "Enterprise in 30 Sekunden",
    description:
      "Individuelle Organisationsprozesse, mehrere Teams und persönliche Begleitung in einer passenden Lösung.",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663150240576/ydXImTPvhUpAuTRC.mp4",
  },
};

type TargetGroup = {
  id: string;
  title: string;
  eyebrow: string;
  image: string;
  imageAlt: string;
  icon: LucideIcon;
  teaser: string;
  detailTitle: string;
  detailText: string;
  highlights: string[];
};

const OFFERS: Offer[] = [
  {
    id: "event-pass",
    name: "Event Pass",
    eyebrow: "Die flexible Einzelveranstaltung",
    price: 69,
    priceUnit: "einmalig pro Veranstaltung*",
    audience: "Für ein konkretes Fest, Rennen oder Vereinswochenende",
    description:
      "Ein klarer Plan für eine Veranstaltung – einmalig, unkompliziert und ohne Dauerbindung.",
    highlights: [
      "1 gemeinsamer Orga- und Massenzugang",
      "Bis 50 Helfer, Vorbereitung und Schichten",
      "Standard-PDF-Listen & Hilfebereich",
      "Jedes Jahr frei neu entscheiden",
    ],
    notIncluded: [
      "Kein Live-Chat",
      "Keine persönlichen Zugänge",
      "Kein Material, keine Standorte, keine Spenden",
    ],
    detailTitle: "Ein Event. Ein Preis. Frei entscheiden.",
    detailText:
      "Der Event Pass bringt genau die Dinge zusammen, die ein einzelnes Fest braucht: Helfer, Verfügbarkeiten, Schichten, Vorbereitung und klare Listen. Das Orga-Team plant über einen gemeinsamen Zugang und bleibt bewusst bei einer überschaubaren Oberfläche.",
    detailBenefits: [
      {
        icon: Sparkles,
        title: "Sofort losplanen",
        text: "Helfer und Schichten sind in wenigen Minuten angelegt – ohne langes Einrichten.",
      },
      {
        icon: UsersRound,
        title: "Einfach gemeinsam",
        text: "Ein Zugang für den Festausschuss, ohne persönliche Konten verwalten zu müssen.",
      },
      {
        icon: FileText,
        title: "Am Ende klar",
        text: "Standard-PDF-Listen geben dem Team vor Ort den nötigen Überblick.",
      },
    ],
    included: [
      "Eine konkrete Veranstaltung mit Vorbereitung, Eventtag und Abschluss",
      "Gemeinsamer Orga- und Massenzugang für das Organisationsteam",
      "Bis zu 50 Helfer-Datensätze als einfache Planeinträge",
      "Tagesverfügbarkeiten, Schichten und kompakte Aufgabenübersicht",
      "Standard-PDF-Listen, Hilfebereich und Schulungsvideo",
      "Grundschutz mit Notfallsperrung sowie System- und Sicherheitsprotokoll",
    ],
    nextStep:
      "Wenn persönliche Zugänge, Materialplanung oder weitere Teamarbeit nötig werden, bleiben die angelegten Daten beim Wechsel zu Light oder Pro erhalten.",
    accent:
      "border-orange-400 bg-gradient-to-b from-orange-50 via-white to-white shadow-[0_24px_60px_-26px_rgba(249,115,22,0.38)]",
    buttonClass: "bg-orange-500 text-white hover:bg-orange-600",
    icon: CalendarCheck2,
    ribbonLabel: "FLEXIBEL · JEDES JAHR NEU",
    ribbonClass: "bg-orange-500",
  },
  {
    id: "light",
    name: "Light",
    eyebrow: "Der feste Jahresablauf",
    price: 149,
    priceUnit: "für ein Veranstaltungsjahr*",
    audience: "Für Vereine mit einer regelmäßigen Hauptveranstaltung",
    description:
      "Der klare digitale Ablauf für euer jährliches Event und ein kleines festes Planungsteam.",
    highlights: [
      "Bis 150 Helfer & 5 persönliche Zugänge",
      "Helfer, Schichten, Vor- & Nachbereitung",
      "Ansprechpartner, Orte, Material & PDF",
      "Jedes Jahr frei neu entscheiden",
    ],
    detailTitle: "Weniger Abstimmung. Mehr Überblick.",
    detailText:
      "Light macht aus einem wiederkehrenden Event einen verlässlichen Ablauf. Persönliche Zugänge schaffen klare Zuständigkeiten, während Helfer, Schichten, Orte, Material und Listen an einem Ort bleiben. So startet das Orga-Team im nächsten Jahr nicht wieder bei null.",
    detailBenefits: [
      {
        icon: UsersRound,
        title: "Zuständigkeit statt Zuruf",
        text: "Bis zu fünf Personen arbeiten mit eigenen Zugängen und klarer Verantwortung.",
      },
      {
        icon: ClipboardList,
        title: "Alles am richtigen Ort",
        text: "Helfer, Aufgaben, Material und Listen gehören sichtbar zusammen.",
      },
      {
        icon: CalendarCheck2,
        title: "Wiederkehrend entspannt",
        text: "Der bewährte Ablauf bleibt sichtbar, auch wenn das Team sich verändert.",
      },
    ],
    included: [
      "Eine jährliche Hauptveranstaltung mit Vorbereitung, Eventtag und Nachbereitung",
      "Bis zu 150 Helfer-Datensätze und bis zu fünf persönliche Teamzugänge",
      "Ansprechpartner, Helfer-, Verfügbarkeits- und Schichtplanung",
      "Vorbereitung, Nachbereitung, einfache Orte und Materialplanung",
      "Standard-PDFs, persönliche Helfer-PDFs und eine WhatsApp-Standardaktion",
      "Sichere Aktivierungslinks, Rollen- und Sicherheitsprotokolle",
    ],
    nextStep:
      "Wer mehrere Events, Live-Chat, Spenden, GPS-Strecken oder eine vollständige Vereinsplanung braucht, wächst ohne Neueingabe in Pro weiter.",
    accent:
      "border-slate-200 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.20)]",
    buttonClass: "bg-slate-900 text-white hover:bg-slate-800",
    icon: ClipboardCheck,
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "Die beliebteste Wahl",
    price: 299,
    priceUnit: "für ein Veranstaltungsjahr*",
    audience: "Für Vereine mit regelmäßigen Veranstaltungen und aktiven Teams",
    description:
      "Die volle Planungstiefe für Teams, bei denen Übersicht, Kommunikation und Sicherheit zählen.",
    highlights: [
      "Bis 5 Veranstaltungen pro Jahr",
      "Persönliche Zugänge, Rollen & Live-Chat",
      "GPS/GPX, Material, Spenden & Finanzen",
      "WhatsApp, PDF, Excel & Protokolle",
    ],
    detailTitle: "Planen, das sich leicht anfühlt.",
    detailText:
      "Pro verbindet alles, was ein aktives Orga-Team wirklich braucht: persönliche Zugänge, Helfer, Schichten, Karten, Strecken, Material, Spenden, Kommunikation und sichere Protokolle. Jedes Teammitglied sieht nur die Bereiche, die zu seiner Aufgabe passen – und alle arbeiten am selben aktuellen Stand.",
    detailBenefits: [
      {
        icon: MessageCircle,
        title: "Ein Team, ein Stand",
        text: "Live-Chat, persönliche Zugänge und automatische Aktualisierung halten die Planung gemeinsam aktuell.",
      },
      {
        icon: MapPinned,
        title: "Auch draußen im Griff",
        text: "GPX-Strecken, Standorte und mobile Ansichten verbinden Karte, Posten und Material.",
      },
      {
        icon: Target,
        title: "Von Anfang bis Abbau",
        text: "Spenden, Finanzen, Genehmigungen und Nachbereitung bleiben nachvollziehbar verbunden.",
      },
    ],
    included: [
      "Bis zu fünf Veranstaltungen pro Jahr und bis zu 350 Helfer je Veranstaltung",
      "Hauptadmin, Co-Admins und bis zu 14 weitere persönliche Planungsteam-Zugänge",
      "Alle Kernmodule: Ansprechpartner, Helfer, Einsatzplan, Vorbereitung, Nachbereitung, Material, Spenden und Finanzen",
      "Orte, Standorte, GPS-Punkte, Kartenansicht sowie GPX-Strecken",
      "Live-Chat, persönliche Helfer-PDFs und zwei eventbezogene WhatsApp-Vorlagen",
      "Marketing, Genehmigungen, Sicherheitsplanung sowie vollständiger Excel-Import/-Export",
    ],
    nextStep:
      "Für mehrere Organisationen, besondere Freigaben oder individuelle Oberflächen kann Pro auf Enterprise erweitert werden – ohne die bestehende Planung zu verlieren.",
    accent:
      "border-blue-500 bg-gradient-to-b from-blue-50 to-white shadow-[0_24px_60px_-26px_rgba(37,99,235,0.45)]",
    buttonClass: "bg-blue-600 text-white hover:bg-blue-700",
    icon: Sparkles,
    ribbonLabel: "UNSERE BELIEBTESTE WAHL",
    ribbonClass: "bg-blue-600",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    eyebrow: "Für eure eigene Lösung",
    price: 449,
    pricePrefix: "ab",
    priceUnit: "für ein Veranstaltungsjahr*",
    audience: "Für Großevents, Verbände & individuelle Abläufe",
    description:
      "Der Rahmen für Teams, die MyCrewMate an ihren echten Ablauf anpassen lassen möchten.",
    highlights: [
      "Pro-Funktionsumfang plus Konfiguration",
      "Mehrveranstaltungs- & Verbandslösungen",
      "Persönliche Einführung & Begleitung",
      "Sonderprozesse, Support & KI vorbereitbar",
    ],
    detailTitle: "Euer Ablauf. Eure Oberfläche.",
    detailText:
      "Enterprise beginnt dort, wo Standardsoftware aufhört. Gemeinsam übersetzen wir eure Abläufe in eine sichere, verständliche MyCrewMate-Lösung: mit passenden Feldern, individuellen Vorlagen, besonderen Freigabeschritten und persönlicher Begleitung.",
    detailBenefits: [
      {
        icon: Wrench,
        title: "Passt zu euch",
        text: "Zusätzliche Felder, Spendenarten oder Nachbereitungen werden an euren Ablauf angepasst.",
      },
      {
        icon: HandHeart,
        title: "Begleitet statt allein",
        text: "Das Kernteam startet mit klarer Einführung und abgestimmter Unterstützung.",
      },
      {
        icon: BrainCircuit,
        title: "Bereit für den nächsten Schritt",
        text: "Erweiterungen wie Live-Unterstützung oder KI werden nur dort ergänzt, wo sie echten Nutzen schaffen.",
      },
    ],
    included: [
      "Voller Pro-Funktionsumfang mit Mengen und mehreren Veranstaltungen nach Vereinbarung",
      "Individuelle Oberflächen-, Feld- und Prozessanpassungen nach abgestimmtem Leistungsumfang",
      "Eigene PDF- und Organisationsvorlagen sowie begleitete Datenübernahme aus Excel-Listen",
      "Erweitertes Onboarding und priorisierte Support-Begleitung im vereinbarten Rahmen",
      "Mehrveranstaltungs- und Verbandslösungen auf Grundlage der Mandantentrennung",
      "Individuelle Enterprise-Entitlements für vereinbarte Sonderprozesse",
    ],
    nextStep:
      "Die Jahreslizenz startet ab 449 €. Individuelle Entwicklungen und Sonderintegrationen werden vorab transparent nach Umfang angeboten – so bleibt der Nutzen klar und die Lösung dauerhaft wartbar.",
    futureOptions: [
      "Live-Unterstützung mit Zustimmung – geplant, ohne Bildschirm- oder Passwortübertragung",
      "KI-Planungshilfe für Checklisten, Besetzungslücken und Kommunikationsentwürfe – geplant, immer mit menschlicher Freigabe",
    ],
    accent:
      "border-orange-200 bg-gradient-to-b from-orange-50 to-white shadow-[0_24px_60px_-30px_rgba(249,115,22,0.30)]",
    buttonClass: "bg-orange-500 text-white hover:bg-orange-600",
    icon: Gem,
  },
];

const PRODUCT_POINTS: OfferBenefit[] = [
  {
    icon: UsersRound,
    title: "Ein gemeinsamer Stand",
    text: "Alle arbeiten mit aktuellen Informationen statt mit alten Listen, Screenshots und Zurufen.",
  },
  {
    icon: Target,
    title: "Die richtigen Menschen am richtigen Ort",
    text: "Verfügbarkeiten, Schichten und Hinweise bleiben nachvollziehbar verbunden.",
  },
  {
    icon: ShieldCheck,
    title: "Sicher organisiert",
    text: "Persönliche Zugänge, Rollen und Protokolle schaffen Klarheit für das ganze Team.",
  },
  {
    icon: Sparkles,
    title: "Wächst mit dem Verein",
    text: "Vom einzelnen Fest bis zur individuellen Verbandslösung: Die Planung bleibt vertraut.",
  },
];

const TARGET_GROUPS: TargetGroup[] = [
  {
    id: "cycling",
    title: "Radsport & Ausdauer",
    eyebrow: "Strecke, Posten, Verpflegung",
    image: "/landing/cycling.jpg",
    imageAlt:
      "Originales MyCrewMate-Motiv mit Radsportteam an einem organisierten Eventstützpunkt",
    icon: Bike,
    teaser:
      "Routen, Verpflegungsstellen, Streckenposten und Rückkehrbereich in einem Ablauf.",
    detailTitle:
      "Für Radsportveranstaltungen, bei denen draußen alles zusammenkommen muss.",
    detailText:
      "Ob RTF, Gravelrunde, Marathon, Jedermannrennen oder Vereinsausfahrt: MyCrewMate verbindet Helferplanung, Einsatzpläne, GPS-/GPX-Strecken, Stationen, Material und Rückkehrbereich in einer klaren Radsportveranstaltungsplanung.",
    highlights: [
      "GPX-Strecken und Stationen im Blick",
      "Verpflegungspunkte und Streckenposten organisieren",
      "Helfer direkt nach Verfügbarkeit besetzen",
    ],
  },
  {
    id: "festival",
    title: "Kirmes & Stadtfest",
    eyebrow: "Viele Hände, ein Ablauf",
    image: "/landing/festival.jpg",
    imageAlt:
      "Originales MyCrewMate-Motiv mit ehrenamtlichem Team bei der Vorbereitung eines Sommerfests",
    icon: Landmark,
    teaser:
      "Ausschank, Einlass, Aufbau, Kuchen und Abbau klar verteilt statt über Chatgruppen verstreut.",
    detailTitle: "Für Feste, bei denen jede Schicht zählt.",
    detailText:
      "Kirmes, Stadtfest oder Vereinsjubiläum leben von vielen kleinen Aufgaben. MyCrewMate bringt Helfer, Schichten, Material, Spenden, Zuständigkeiten und Listen in einen gemeinsamen Rhythmus.",
    highlights: [
      "Schichten für Ausschank, Einlass und Aufbau",
      "Kuchen- und Sachspenden übersichtlich erfassen",
      "Aktuelle PDF-Listen für den Eventtag",
    ],
  },
  {
    id: "tradition",
    title: "Schützen & Tradition",
    eyebrow: "Bewährtes sicher weitergeben",
    image: "/landing/tradition.jpg",
    imageAlt:
      "Originales MyCrewMate-Motiv mit ehrenamtlicher Vorbereitung eines Traditionsfests",
    icon: Medal,
    teaser:
      "Wiederkehrende Abläufe, Verantwortungen und Nachbereitung bleiben für das nächste Team sichtbar.",
    detailTitle:
      "Für Vereine mit festen Abläufen und viel ehrenamtlichem Wissen.",
    detailText:
      "Bei Traditions- und Schützenfesten soll Erfahrung nicht in einzelnen Köpfen verschwinden. MyCrewMate dokumentiert Aufgaben, Zuständigkeiten, Material und den bewährten Ablauf für das nächste Jahr.",
    highlights: [
      "Vorbereitung und Nachbereitung nachvollziehbar",
      "Klare Rollen für das Planungsteam",
      "Wissen bleibt über den Festtag hinaus erhalten",
    ],
  },
  {
    id: "fire-service",
    title: "Feuerwehr & Einsatzfeste",
    eyebrow: "Sicher, klar, gemeinsam",
    image: "/landing/fire-service.jpg",
    imageAlt:
      "Originales MyCrewMate-Motiv mit ehrenamtlichem Team bei der Vorbereitung eines Feuerwehrfests",
    icon: Flame,
    teaser:
      "Sicherheitsbewusstsein, Aufteilung, Material und Teamkommunikation – ohne den Überblick zu verlieren.",
    detailTitle: "Für Teams, die Verantwortung und Gemeinschaft verbinden.",
    detailText:
      "Ein Feuerwehrfest oder Tag der offenen Tür braucht klare Abläufe, gut sichtbare Zuständigkeiten und sichere Informationen. MyCrewMate bündelt Planung, Helfer, Material und nachvollziehbare Protokolle.",
    highlights: [
      "Aufbau, Sicherheitsbereiche und Schichten",
      "Material und Verantwortlichkeiten im Überblick",
      "Persönliche Zugänge und nachvollziehbare Änderungen",
    ],
  },
  {
    id: "clubs",
    title: "Sport, Musik & Jugend",
    eyebrow: "Vom Turnier bis zum Konzert",
    image: "/landing/club-sports.jpg",
    imageAlt:
      "Originales MyCrewMate-Motiv mit Vereins- und Jugendteam bei der Vorbereitung einer Gemeinschaftsveranstaltung",
    icon: Music2,
    teaser:
      "Turniere, Konzerte, Jugendtage und Vereinsfeste so planen, dass alle gern mitmachen.",
    detailTitle: "Für Vereine, die Menschen zusammenbringen.",
    detailText:
      "Wenn Sport, Musik, Jugend- oder Kulturverein eine Veranstaltung organisiert, ist der gemeinsame Ablauf wichtiger als komplizierte Software. MyCrewMate schafft einen klaren Plan für Menschen, Aufgaben und den Eventtag.",
    highlights: [
      "Einfach auch auf Smartphone und Tablet nutzbar",
      "Helfer, Aufgaben und Nachrichten an einem Ort",
      "Vom ersten Aufbau bis zum letzten Abbau verbunden",
    ],
  },
];

function scrollToPackages() {
  document
    .getElementById("pakete")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function OfferCard({
  offer,
  onDetails,
  onAdd,
  onVideo,
}: {
  offer: Offer;
  onDetails: (offer: Offer) => void;
  onAdd: (offer: Offer) => void;
  onVideo: (offer: Offer) => void;
}) {
  const Icon = offer.icon;
  const video = PACKAGE_VIDEO_COPY[offer.id];

  return (
    <article
      className={cn(
        "relative flex min-h-full flex-col overflow-hidden rounded-[1.4rem] border p-6 text-slate-950 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-7",
        offer.accent,
        offer.ribbonLabel && "pt-14 sm:pt-[4.25rem] lg:-mt-4 lg:mb-[-1rem]"
      )}
      data-offer-card={offer.id}
    >
      {offer.ribbonLabel && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex min-h-10 items-center justify-center px-4 py-2 text-center text-xs font-bold tracking-[0.14em] text-white shadow-sm",
            offer.ribbonClass ?? "bg-slate-900"
          )}
        >
          {offer.ribbonLabel}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600">
            {offer.eyebrow}
          </p>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {offer.name}
          </h3>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-blue-700 shadow-sm ring-1 ring-slate-200/70">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">{offer.audience}</p>
      <p className="mt-3 min-h-12 text-base font-semibold leading-6 text-slate-900">
        {offer.description}
      </p>
      <div className="mt-7 border-y border-slate-200/80 py-4">
        <span className="text-4xl font-black tracking-tight text-slate-950">
          {offer.pricePrefix ? `${offer.pricePrefix} ` : ""}
          {offer.price} €
        </span>
        <span className="ml-2 text-sm font-semibold text-slate-500">
          {offer.priceUnit}
        </span>
      </div>
      <ul className="mt-5 space-y-3 text-sm text-slate-700">
        {offer.highlights.map(highlight => (
          <li key={highlight} className="flex gap-2.5">
            <Check
              className="mt-0.5 size-4 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
      {offer.notIncluded && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600">
            Bewusst schlank
          </p>
          <p className="mt-1.5 text-sm leading-5 text-slate-700">
            {offer.notIncluded.join(" · ")}
          </p>
        </div>
      )}
      <div className="mt-auto grid gap-2 pt-7">
        <Button
          type="button"
          className={cn("w-full rounded-xl", offer.buttonClass)}
          onClick={() => onAdd(offer)}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          Simuliert in den Warenkorb
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl border-slate-300 bg-white/90 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          onClick={() => onVideo(offer)}
          aria-label={`${video.title} ansehen`}
        >
          <Play className="size-4" aria-hidden="true" /> Kurzvideo ansehen
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-xl text-slate-600 hover:bg-white/80 hover:text-blue-700"
          onClick={() => onDetails(offer)}
        >
          Paketdetails ansehen{" "}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

export default function OfferDemo() {
  const [detailsOffer, setDetailsOffer] = useState<Offer | null>(null);
  const [cartOffer, setCartOffer] = useState<Offer | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [inquiryClubName, setInquiryClubName] = useState("");
  const [inquiryContactName, setInquiryContactName] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryNote, setInquiryNote] = useState("");
  const [promoVideoOpen, setPromoVideoOpen] = useState(false);
  const [packageVideoOffer, setPackageVideoOffer] = useState<Offer | null>(
    null
  );
  const [selectedTargetGroup, setSelectedTargetGroup] =
    useState<TargetGroup | null>(null);
  const DetailIcon = detailsOffer?.icon ?? Sparkles;
  const TargetGroupIcon = selectedTargetGroup?.icon ?? UsersRound;

  const addToCart = (offer: Offer) => {
    setCartOffer(offer);
    setCheckoutComplete(false);
    setCartOpen(true);
  };

  const openCheckout = () => {
    setCartOpen(false);
    setCheckoutComplete(false);
    setCheckoutOpen(true);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen overflow-x-hidden bg-[#fbfcff] text-slate-950"
    >
      <a className="skip-to-content" href="#start">
        Zum Inhalt springen
      </a>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        Musterdemo · Preise, Warenkorb und Checkout sind fiktiv – es wird keine
        Bestellung ausgelöst.
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#start"
            className="shrink-0 rounded-md focus-visible:outline-none"
            aria-label="MyCrewMate Angebotsdemo – zum Anfang"
          >
            <img
              src={WORDMARK}
              alt="MyCrewMate"
              className="h-8 w-auto sm:h-9"
            />
          </a>
          <nav
            className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex"
            aria-label="Seitennavigation"
          >
            <a
              className="rounded-md transition-colors hover:text-blue-700 focus-visible:outline-none"
              href="#so-einfach"
            >
              Vorteile
            </a>
            <a
              className="rounded-md transition-colors hover:text-blue-700 focus-visible:outline-none"
              href="#pakete"
            >
              Pakete
            </a>
            <a
              className="rounded-md transition-colors hover:text-blue-700 focus-visible:outline-none"
              href="#vergleich"
            >
              Vergleichen
            </a>
            <a
              className="rounded-md transition-colors hover:text-blue-700 focus-visible:outline-none"
              href="#zielgruppen"
            >
              Für wen?
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a href={APP_LOGIN_URL}>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-300 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                Zum Login
              </Button>
            </a>
            <Button
              type="button"
              className="hidden rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700 sm:inline-flex"
              onClick={scrollToPackages}
            >
              Pakete ansehen{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <section
        id="start"
        className="relative isolate overflow-hidden border-b border-slate-200/70"
      >
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-100 via-white to-orange-100/80" />
        <div className="absolute -left-28 top-24 -z-10 size-80 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -right-20 bottom-0 -z-10 size-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_31rem] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-800 shadow-sm">
              <HeartHandshake className="size-3.5" aria-hidden="true" />
              Für Vereine, die mehr vorhaben
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
              Vereins- und Eventplanung, die <span className="text-blue-600">Freude</span> macht.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              MyCrewMate ist die Software für Vereins- und Eventplanung:
              Helferplanung, Aufgaben, Schichten und Einsatzpläne an einem Ort –
              vom ersten Helfer bis zum letzten Abbau.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                className="rounded-xl bg-orange-500 px-6 text-white shadow-lg shadow-orange-200 hover:bg-orange-600"
                onClick={scrollToPackages}
              >
                Angebot entdecken{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-xl border-slate-300 bg-white/80 px-5 text-slate-700 hover:border-blue-300 hover:bg-white hover:text-blue-700"
                onClick={() => setPromoVideoOpen(true)}
              >
                <Play className="size-4" aria-hidden="true" />
                So einfach funktioniert&apos;s
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <CircleCheckBig className="size-4 text-emerald-600" /> Sofort im
                Browser
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleCheckBig className="size-4 text-emerald-600" /> Für
                Handy, Tablet & PC
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleCheckBig className="size-4 text-emerald-600" /> Klar
                statt kompliziert
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-4 rounded-[2rem] bg-blue-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.48)]">
              <div className="flex h-8 items-center gap-1.5 rounded-t-xl bg-slate-950 px-3">
                <span className="size-2 rounded-full bg-red-400" />
                <span className="size-2 rounded-full bg-amber-300" />
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="ml-3 h-4 flex-1 rounded-full bg-white/10" />
              </div>
              <div className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-3 p-3 sm:p-4">
                <div className="space-y-3 rounded-xl bg-slate-50 p-2.5">
                  <img
                    src={WORDMARK}
                    alt=""
                    aria-hidden="true"
                    className="h-auto w-full"
                  />
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 rounded-full",
                        index === 0 ? "bg-blue-500" : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">
                        Heute priorisieren
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                        Alles im Griff.
                      </h2>
                    </div>
                    <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">
                      Nur noch 261 Tage
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                      <span className="text-xl font-black text-red-700">3</span>
                      <p className="mt-1 text-sm font-bold leading-5 text-slate-800">
                        offene Schichten
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <span className="text-xl font-black text-blue-700">
                        12
                      </span>
                      <p className="mt-1 text-sm font-bold leading-5 text-slate-800">
                        Helfer bereit
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                      <span>Streckenposten Nord</span>
                      <span className="text-emerald-600">besetzt</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-500 to-orange-400" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950 p-3 text-white">
                    <Route className="size-4 text-orange-300" />
                    <span className="text-xs font-semibold">
                      Strecken, Teams und Einsatzorte – verbunden.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="event-pass"
        className="border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-sky-50"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-orange-800 shadow-sm">
              <CalendarCheck2 className="size-3.5" aria-hidden="true" />
              Neu: Einmalpaket
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Ein Event. Ein Preis.{" "}
              <span className="text-orange-600">Frei entscheiden.</span>
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Der Event Pass ist für Vereine, die eine einzelne Veranstaltung
              unkompliziert organisieren möchten: bis 50 Helfer, Schichten,
              Vorbereitung und klare PDF-Listen – bewusst ohne Dauerbindung.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-emerald-600" aria-hidden="true" />{" "}
                1 gemeinsamer Orga- und Massenzugang
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-emerald-600" aria-hidden="true" />{" "}
                Schichten und Vorbereitung im Blick
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-emerald-600" aria-hidden="true" />{" "}
                Jedes Jahr frei neu entscheiden
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-orange-200 bg-white p-6 text-center shadow-[0_20px_45px_-28px_rgba(249,115,22,0.65)] sm:min-w-72">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">
              Einmalig pro Veranstaltung
            </p>
            <p className="mt-2 text-5xl font-black tracking-tight text-slate-950">
              69 €
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-500">
              Für Helfer, Schichten, Vorbereitung und klare Listen – jederzeit
              erneut wählbar.
            </p>
            <Button
              type="button"
              className="mt-5 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => setDetailsOffer(OFFERS[0])}
            >
              Einmalpaket ansehen{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      <section
        id="so-einfach"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
            Weniger Reibung. Mehr Teamgeist.
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Helferplanung und Einsatzpläne – ohne Excel-Chaos.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Für Vereinsfeste, Sportveranstaltungen und ehrenamtliche Teams:
            Genau die Klarheit, die ein Verein vor, während und nach dem Event
            braucht – ohne verstreute Listen, alte Screenshots und Zurufe.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_POINTS.map(point => {
            const Icon = point.icon;
            return (
              <article
                key={point.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-950">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {point.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="pakete"
        className="scroll-mt-20 border-y border-slate-200 bg-slate-50/80 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
              Fiktive Musterangebote
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Wählt, was zu eurem Team passt.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Einfach starten, gemeinsam organisieren, vollständig steuern oder
              individuell wachsen: Jedes Paket schafft den passenden nächsten
              Schritt – ohne automatische Verlängerung.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-7xl gap-5 lg:grid-cols-4 lg:items-stretch">
            {OFFERS.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onDetails={setDetailsOffer}
                onAdd={addToCart}
                onVideo={setPackageVideoOffer}
              />
            ))}
          </div>
          <p className="mt-7 text-center text-sm text-slate-600">
            * Fiktive Preisdarstellung dieser Musterdemo. Die Nutzung wird nicht
            automatisch verlängert; Umfang, Kontingente, Preis und Bedingungen
            werden für jedes Veranstaltungsjahr transparent abgestimmt.
          </p>
        </div>
      </section>

      <PackageComparisonSection sectionId="vergleich" />

      <section
        id="zielgruppen"
        className="scroll-mt-20 border-y border-slate-200 bg-slate-50/70 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
              Für wen ist MyCrewMate?
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Für Vereine, die Veranstaltungen organisieren und Menschen zusammenbringen.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Ob Radsportverein, Musikverein, Feuerwehr oder Sportverein:
              MyCrewMate bringt Helfer, Aufgaben und den Einsatzplan in einen
              verständlichen Ablauf.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TARGET_GROUPS.map(group => {
              const Icon = group.icon;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedTargetGroup(group)}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                  data-target-group={group.id}
                >
                  <div className="relative aspect-[16/8] overflow-hidden bg-slate-100">
                    <img
                      src={group.image}
                      alt={group.imageAlt}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-slate-950/5 to-transparent" />
                    <span className="absolute bottom-4 left-4 flex size-10 items-center justify-center rounded-xl bg-white/95 text-blue-700 shadow-sm">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-sm font-bold uppercase tracking-[0.1em] text-orange-700">
                      {group.eyebrow}
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                      {group.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {group.teaser}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">
                      Mehr erfahren{" "}
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm leading-6 text-slate-600">
            Die Bilder in diesem Bereich sind eigens für MyCrewMate erzeugte,
            illustrative Website-Motive. Sie zeigen keine realen Vereine,
            Veranstaltungen oder Marken.
          </p>
        </div>
      </section>

      <section
        id="vertrauen"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.65fr)] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">
                Einfach anfangen
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                Wenn Planung leicht wird, bleibt mehr Zeit fürs Miteinander.
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                Vom ersten Helfer bis zum letzten Abbau: MyCrewMate bündelt die
                Arbeit, damit sich das Orga-Team auf ein starkes Erlebnis
                konzentrieren kann.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <LayoutDashboard className="size-5 text-blue-300" />
                <p className="mt-3 text-sm font-bold">Klarer Überblick</p>
                <p className="mt-1 text-sm leading-5 text-slate-200">
                  Schritte, Kennzahlen und Zuständigkeiten auf einen Blick.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <LifeBuoy className="size-5 text-orange-300" />
                <p className="mt-3 text-sm font-bold">Passend begleitet</p>
                <p className="mt-1 text-sm leading-5 text-slate-200">
                  Vom selbstständigen Event Pass bis zur individuellen
                  Enterprise-Lösung.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={WORDMARK} alt="MyCrewMate" className="h-6 w-auto" />
            <span>© 2026 MyCrewMate · Angebotsdemo</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-5 sm:justify-end">
            <p className="max-w-xl">
              Öffentliche Musterdemo: kein Live-Angebot, keine
              Zahlungsabwicklung und keine Datenübertragung.
            </p>
            <a
              className="rounded-sm font-semibold text-slate-700 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none"
              href="/impressum"
            >
              Impressum
            </a>
            <a
              className="rounded-sm font-semibold text-slate-700 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none"
              href="/datenschutz"
            >
              Datenschutz
            </a>
          </div>
        </div>
      </footer>

      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-xl shadow-slate-900/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
        onClick={() => setCartOpen(true)}
        aria-label={
          cartOffer
            ? `${cartOffer.name} im simulierten Warenkorb ansehen`
            : "Simulierten Warenkorb öffnen"
        }
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        Warenkorb {cartOffer ? "· 1" : "· 0"}
      </button>

      <Dialog open={promoVideoOpen} onOpenChange={setPromoVideoOpen}>
        <DialogContent className="max-w-5xl overflow-hidden border-slate-700 !gap-0 !bg-slate-950 !p-0 !text-white">
          <DialogHeader className="sr-only">
            <DialogTitle>MyCrewMate im Überblick</DialogTitle>
            <DialogDescription>
              Werbefilm zur Vereins- und Eventplanung mit MyCrewMate.
            </DialogDescription>
          </DialogHeader>
          <video
            className="aspect-video w-full bg-black"
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label="Werbefilm: MyCrewMate im Überblick"
          >
            <source src="/api/marketing/promo-video" type="video/mp4" />
            Ihr Browser unterstützt keine HTML5-Videowiedergabe.
          </video>
        </DialogContent>
      </Dialog>

      <Dialog
        open={packageVideoOffer !== null}
        onOpenChange={open => !open && setPackageVideoOffer(null)}
      >
        <DialogContent className="max-w-5xl overflow-hidden border-slate-700 !gap-0 !bg-slate-950 !p-0 !text-white">
          {packageVideoOffer && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {PACKAGE_VIDEO_COPY[packageVideoOffer.id].title}
                </DialogTitle>
                <DialogDescription>
                  {PACKAGE_VIDEO_COPY[packageVideoOffer.id].description}
                </DialogDescription>
              </DialogHeader>
              <video
                key={packageVideoOffer.id}
                className="aspect-video w-full bg-black"
                controls
                autoPlay
                playsInline
                preload="metadata"
                aria-label={PACKAGE_VIDEO_COPY[packageVideoOffer.id].title}
              >
                <source
                  src={PACKAGE_VIDEO_COPY[packageVideoOffer.id].src}
                  type="video/mp4"
                />
                Ihr Browser unterstützt keine HTML5-Videowiedergabe.
              </video>
              <div className="border-t border-white/10 bg-slate-950 px-5 py-4 sm:px-6">
                <p className="text-sm font-bold text-white">
                  {PACKAGE_VIDEO_COPY[packageVideoOffer.id].title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {PACKAGE_VIDEO_COPY[packageVideoOffer.id].description}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailsOffer !== null}
        onOpenChange={open => !open && setDetailsOffer(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl">
          {detailsOffer && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl",
                      detailsOffer.id === "enterprise"
                        ? "bg-orange-50 text-orange-700"
                        : detailsOffer.id === "pro"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                    )}
                  >
                    <DetailIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <DialogTitle>
                      {detailsOffer.name}: {detailsOffer.detailTitle}
                    </DialogTitle>
                    <DialogDescription>
                      {detailsOffer.audience}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <p className="mt-2 leading-7 text-slate-700">
                {detailsOffer.detailText}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {detailsOffer.detailBenefits.map(benefit => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={benefit.title}
                      className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4"
                    >
                      <Icon
                        className="size-5 text-blue-700"
                        aria-hidden="true"
                      />
                      <h3 className="mt-3 text-sm font-black text-slate-950">
                        {benefit.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {benefit.text}
                      </p>
                    </div>
                  );
                })}
              </div>

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                  Das ist enthalten
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {detailsOffer.included.map(item => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-sm leading-6 text-slate-700"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              {detailsOffer.notIncluded && (
                <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Bewusst schlank gehalten
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {detailsOffer.notIncluded.join(" · ")}
                  </p>
                </section>
              )}

              {detailsOffer.futureOptions && (
                <section className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-800">
                    Geplante Enterprise-Ausbauoptionen
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {detailsOffer.futureOptions.map(option => (
                      <li key={option} className="flex gap-2">
                        <Sparkles
                          className="mt-1 size-4 shrink-0 text-orange-600"
                          aria-hidden="true"
                        />
                        {option}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-300">
                  Der nächste sinnvolle Schritt
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {detailsOffer.nextStep}
                </p>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">
                  {detailsOffer.pricePrefix
                    ? `${detailsOffer.pricePrefix} `
                    : ""}
                  {detailsOffer.price} € {detailsOffer.priceUnit}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Fiktiver Musterpreis dieser lokalen Demo.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setPackageVideoOffer(detailsOffer)}
                >
                  <Play className="size-4" aria-hidden="true" /> Kurzvideo ansehen
                </Button>
                <Button
                  type="button"
                  className={cn("rounded-xl", detailsOffer.buttonClass)}
                  onClick={() => {
                    addToCart(detailsOffer);
                    setDetailsOffer(null);
                  }}
                >
                  <ShoppingBag className="size-4" aria-hidden="true" />{" "}
                  Simuliert in den Warenkorb
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedTargetGroup !== null}
        onOpenChange={open => !open && setSelectedTargetGroup(null)}
      >
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl p-0">
          {selectedTargetGroup && (
            <>
              <div className="relative h-52 overflow-hidden bg-slate-100 sm:h-64">
                <img
                  src={selectedTargetGroup.image}
                  alt={selectedTargetGroup.imageAlt}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 to-transparent" />
                <div className="absolute bottom-5 left-6 right-6 text-white">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/95 text-blue-700">
                    <TargetGroupIcon className="size-5" aria-hidden="true" />
                  </span>
                  <DialogTitle className="mt-3 text-2xl text-white">
                    {selectedTargetGroup.title}
                  </DialogTitle>
                </div>
              </div>
              <div className="p-6 pt-5">
                <DialogDescription className="text-sm font-bold text-blue-700">
                  {selectedTargetGroup.detailTitle}
                </DialogDescription>
                <p className="mt-3 leading-7 text-slate-700">
                  {selectedTargetGroup.detailText}
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-3">
                  {selectedTargetGroup.highlights.map(highlight => (
                    <li
                      key={highlight}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold leading-5 text-slate-700"
                    >
                      <Check
                        className="mr-1.5 inline size-3.5 text-emerald-600"
                        aria-hidden="true"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Simulierter Warenkorb</DialogTitle>
            <DialogDescription>
              Dies ist eine Demo. Es wird keine Bestellung gespeichert oder
              übertragen.
            </DialogDescription>
          </DialogHeader>
          {cartOffer ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-black text-slate-950">
                    MyCrewMate {cartOffer.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {cartOffer.audience}
                  </p>
                </div>
                <strong className="text-xl text-slate-950">
                  {cartOffer.price} €
                </strong>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Fiktiver {cartOffer.priceUnit.replace("*", "")} · kein
                Zahlungsprozess
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <ShoppingBag className="mx-auto size-6 text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">
                Noch kein Paket ausgewählt.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Wähle eines der vier Musterangebote aus.
              </p>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            {cartOffer && (
              <Button
                type="button"
                variant="ghost"
                className="text-slate-600"
                onClick={() => setCartOffer(null)}
              >
                Warenkorb leeren
              </Button>
            )}
            {cartOffer && (
              <Button
                type="button"
                className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                onClick={openCheckout}
              >
                Muster-Checkout öffnen <ArrowRight className="size-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          {checkoutComplete ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CircleCheckBig className="size-7" />
              </span>
              <DialogTitle className="mt-5">
                Anfrage vorbereitet
              </DialogTitle>
              <DialogDescription className="mt-3 block leading-6">
                Vielen Dank! Ihre Angaben wurden vorstrukturiert. Sie können die Anfrage jetzt direkt per E-Mail an das MyCrewMate-Team senden oder wir melden uns zur Freischaltung.
              </DialogDescription>
              <div className="mt-5 flex justify-center gap-2">
                <a
                  href={`mailto:info@mycrewmate.de?subject=${encodeURIComponent(
                    `Testzugang/Anfrage: MyCrewMate ${cartOffer?.name ?? "Paket"} für ${inquiryClubName}`
                  )}&body=${encodeURIComponent(
                    `Hallo MyCrewMate-Team,\n\nwir interessieren uns unverbindlich für das Paket MyCrewMate ${cartOffer?.name ?? "Interesse"}.\n\nVerein: ${inquiryClubName}\nAnsprechpartner: ${inquiryContactName}\nE-Mail: ${inquiryEmail}\nNotiz: ${inquiryNote || "Keine"}\n\nBitte sendet uns die nächsten Schritte zur Freischaltung zu.\n\nViele Grüße\n${inquiryContactName}`
                  )}`}
                >
                  <Button type="button" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                    Anfrage per E-Mail absenden
                  </Button>
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setCheckoutComplete(false);
                    setCartOffer(null);
                  }}
                >
                  Schließen
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={event => {
                event.preventDefault();
                setCheckoutComplete(true);
              }}
            >
              <DialogHeader>
                <DialogTitle>Unverbindliche Test- &amp; Paket-Anfrage</DialogTitle>
                <DialogDescription>
                  Geben Sie Ihren Verein an. Sie erhalten vor jeder Freischaltung die Vertragsunterlagen zur Prüfung.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 grid gap-3">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Vereinsname
                  <input
                    required
                    placeholder="z. B. Radsportverein Musterstadt"
                    value={inquiryClubName}
                    onChange={event => setInquiryClubName(event.target.value)}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Ansprechpartner
                  <input
                    required
                    placeholder="Name"
                    value={inquiryContactName}
                    onChange={event => setInquiryContactName(event.target.value)}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  E-Mail
                  <input
                    required
                    type="email"
                    placeholder="verein@beispiel.de"
                    value={inquiryEmail}
                    onChange={event => setInquiryEmail(event.target.value)}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Hinweis oder Wunschveranstaltung (optional)
                  <input
                    placeholder="z. B. Sommerturnier 2027 mit 120 Helfern"
                    value={inquiryNote}
                    onChange={event => setInquiryNote(event.target.value)}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="submit"
                  className="rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                >
                  Anfrage prüfen &amp; absenden <ArrowRight className="size-4" />
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
