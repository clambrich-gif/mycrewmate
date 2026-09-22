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
  Check,
  ChevronRight,
  CircleCheckBig,
  ClipboardCheck,
  CreditCard,
  Gem,
  HeartHandshake,
  LayoutDashboard,
  MapPinned,
  Route,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

type OfferId = "light" | "pro" | "enterprise";

type Offer = {
  id: OfferId;
  name: string;
  eyebrow: string;
  price: number;
  audience: string;
  description: string;
  highlights: string[];
  detailTitle: string;
  detailText: string;
  accent: string;
  buttonClass: string;
  icon: LucideIcon;
  featured?: boolean;
};

const OFFERS: Offer[] = [
  {
    id: "light",
    name: "Light",
    eyebrow: "Der klare Start",
    price: 149,
    audience: "Für kleine Vereine & überschaubare Events",
    description: "Alles Wesentliche für einen sauberen Plan – einfach starten, gemeinsam organisieren.",
    highlights: [
      "Ein gemeinsamer Teamzugang",
      "Helfer- & Schichtplanung",
      "Orte, Material & PDF-Listen",
      "Unbegrenzte Helfer im Muster",
    ],
    detailTitle: "Weniger Abstimmung. Mehr Überblick.",
    detailText:
      "Light bündelt die Grundlagen an einem aufgeräumten Ort: Helfer erfassen, Schichten planen und Listen ausgeben. Ideal, wenn ein Verein den ersten Schritt aus der Zettelwirtschaft machen möchte.",
    accent: "border-slate-200 bg-white",
    buttonClass: "bg-slate-900 text-white hover:bg-slate-800",
    icon: ClipboardCheck,
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "Die beliebteste Wahl",
    price: 299,
    audience: "Für aktive Teams, die gemeinsam mehr bewegen",
    description: "Die volle Planungstiefe für Veranstaltungen, bei denen Übersicht und Kommunikation zählen.",
    highlights: [
      "Personalisierte Teamzugänge",
      "GPX-Strecken & Standortkarte",
      "Live-Chat, Material & Spenden",
      "PDF-Ausgabe & Rollenübersicht",
    ],
    detailTitle: "Planen, das sich leicht anfühlt.",
    detailText:
      "Pro bringt Helfer, Schichten, Strecken, Material und die Kommunikation des Orga-Teams in einen gemeinsamen Arbeitsbereich. Damit bleibt bei der Planung mehr Raum für das, was Freude macht: ein gelungenes Event.",
    accent: "border-blue-500 bg-gradient-to-b from-blue-50 to-white shadow-[0_24px_60px_-26px_rgba(37,99,235,0.45)]",
    buttonClass: "bg-blue-600 text-white hover:bg-blue-700",
    icon: Sparkles,
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    eyebrow: "Für eure eigene Lösung",
    price: 449,
    audience: "Für Großevents, Verbände & individuelle Abläufe",
    description: "Der Rahmen für Teams, die MyCrewMate auf ihren Verein zuschneiden lassen möchten.",
    highlights: [
      "Mehrere Veranstaltungen im Blick",
      "Erweiterte Schutz- & Protokollfunktionen",
      "Priorisierte Begleitung im Muster",
      "Individuelle Erweiterungen nach Absprache",
    ],
    detailTitle: "Euer Ablauf. Eure Oberfläche.",
    detailText:
      "Enterprise ist für Vereine gedacht, die über den Standard hinausgehen möchten: zusätzliche Spendenarten, angepasste Nachbereitungen oder eine Oberfläche, die den eigenen Ablauf exakt aufnimmt. Umfang und Umsetzung werden transparent gemeinsam vereinbart.",
    accent: "border-orange-200 bg-gradient-to-b from-orange-50 to-white",
    buttonClass: "bg-orange-500 text-white hover:bg-orange-600",
    icon: Gem,
  },
];

const PRODUCT_POINTS = [
  { icon: UsersRound, title: "Einfach gemeinsam", text: "Alle sehen, was wichtig ist – ohne komplizierte Einführung." },
  { icon: MapPinned, title: "Draußen im Einsatz", text: "Standorte und Strecken dort griffbereit, wo sie gebraucht werden." },
  { icon: ShieldCheck, title: "Klar organisiert", text: "Rollen, Zugänge und Protokolle bleiben nachvollziehbar." },
];

function scrollToPackages() {
  document.getElementById("pakete")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function OfferCard({
  offer,
  onDetails,
  onAdd,
}: {
  offer: Offer;
  onDetails: (offer: Offer) => void;
  onAdd: (offer: Offer) => void;
}) {
  const Icon = offer.icon;

  return (
    <article
      className={cn(
        "relative flex min-h-full flex-col rounded-[1.4rem] border p-6 text-slate-950 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-7",
        offer.accent,
        offer.featured && "lg:-mt-4 lg:mb-[-1rem]"
      )}
      data-offer-card={offer.id}
    >
      {offer.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-600 px-4 py-1 text-xs font-bold tracking-wide text-white shadow-sm">
          BELIEBTESTE WAHL
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{offer.eyebrow}</p>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{offer.name}</h3>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-blue-700 shadow-sm ring-1 ring-slate-200/70">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">{offer.audience}</p>
      <p className="mt-3 min-h-12 text-base font-semibold leading-6 text-slate-900">{offer.description}</p>
      <div className="mt-7 border-y border-slate-200/80 py-4">
        <span className="text-4xl font-black tracking-tight text-slate-950">{offer.price} €</span>
        <span className="ml-2 text-sm font-semibold text-slate-500">pro Jahr*</span>
      </div>
      <ul className="mt-5 space-y-3 text-sm text-slate-700">
        {offer.highlights.map(highlight => (
          <li key={highlight} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
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
          variant="ghost"
          className="w-full rounded-xl text-slate-600 hover:bg-white/80 hover:text-blue-700"
          onClick={() => onDetails(offer)}
        >
          Paketdetails ansehen <ChevronRight className="size-4" aria-hidden="true" />
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
    <main className="min-h-screen overflow-x-hidden bg-[#fbfcff] text-slate-950">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
        Musterdemo · Preise, Warenkorb und Checkout sind fiktiv – es wird keine Bestellung ausgelöst.
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#start" className="shrink-0" aria-label="MyCrewMate Angebotsdemo – zum Anfang">
            <img src={WORDMARK} alt="MyCrewMate" className="h-8 w-auto sm:h-9" />
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex" aria-label="Seitennavigation">
            <a className="transition-colors hover:text-blue-700" href="#so-einfach">
              Vorteile
            </a>
            <a className="transition-colors hover:text-blue-700" href="#pakete">
              Pakete
            </a>
            <a className="transition-colors hover:text-blue-700" href="#vertrauen">
              Auf einen Blick
            </a>
          </nav>
          <Button type="button" className="rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700" onClick={scrollToPackages}>
            Pakete ansehen <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <section id="start" className="relative isolate overflow-hidden border-b border-slate-200/70">
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
              Planen, das <span className="text-blue-600">Freude</span> macht.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              MyCrewMate bringt Helfer, Schichten, Material und Strecken in einen klaren gemeinsamen Ablauf. Weniger Abstimmung. Mehr Vorfreude aufs Event.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button type="button" size="lg" className="rounded-xl bg-orange-500 px-6 text-white shadow-lg shadow-orange-200 hover:bg-orange-600" onClick={scrollToPackages}>
                Angebot entdecken <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <a href="#so-einfach" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700">
                So einfach funktioniert&apos;s
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2"><CircleCheckBig className="size-4 text-emerald-600" /> Sofort im Browser</span>
              <span className="inline-flex items-center gap-2"><CircleCheckBig className="size-4 text-emerald-600" /> Für Handy, Tablet & PC</span>
              <span className="inline-flex items-center gap-2"><CircleCheckBig className="size-4 text-emerald-600" /> Klar statt kompliziert</span>
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
                  <img src={WORDMARK} alt="" aria-hidden="true" className="h-auto w-full" />
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className={cn("h-2 rounded-full", index === 0 ? "bg-blue-500" : "bg-slate-200")} />
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">Heute priorisieren</p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Alles im Griff.</h2>
                    </div>
                    <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">Nur noch 261 Tage</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                      <span className="text-xl font-black text-red-700">3</span>
                      <p className="mt-1 text-[11px] font-bold leading-4 text-slate-700">offene Schichten</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <span className="text-xl font-black text-blue-700">12</span>
                      <p className="mt-1 text-[11px] font-bold leading-4 text-slate-700">Helfer bereit</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-700"><span>Streckenposten Nord</span><span className="text-emerald-600">besetzt</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-500 to-orange-400" /></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950 p-3 text-white"><Route className="size-4 text-orange-300" /><span className="text-xs font-semibold">Strecken, Teams und Einsatzorte – verbunden.</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="so-einfach" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Weniger Reibung. Mehr Teamgeist.</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Eine Oberfläche, die mitdenkt.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Nicht mehr Funktionen um ihrer selbst willen. Sondern genau die Klarheit, die ein Verein vor dem Event braucht.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PRODUCT_POINTS.map(point => {
            const Icon = point.icon;
            return (
              <article key={point.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" aria-hidden="true" /></span>
                <h3 className="mt-5 text-lg font-black text-slate-950">{point.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{point.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="pakete" className="scroll-mt-20 border-y border-slate-200 bg-slate-50/80 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Fiktive Musterangebote</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Wählt, was zu eurem Team passt.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Ein klarer Jahrespreis. Keine versteckten Schritte. Und immer ein gemeinsamer Plan, auf den sich euer Team verlassen kann.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-3 lg:items-stretch">
            {OFFERS.map(offer => <OfferCard key={offer.id} offer={offer} onDetails={setDetailsOffer} onAdd={addToCart} />)}
          </div>
          <p className="mt-7 text-center text-xs text-slate-500">* Fiktive Preisdarstellung dieser Musterdemo. Umfang, Preis und Bedingungen werden in einem echten Angebot verbindlich abgestimmt.</p>
        </div>
      </section>

      <section id="vertrauen" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.65fr)] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">Einfach anfangen</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Wenn Planung leicht wird, bleibt mehr Zeit fürs Miteinander.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">Vom ersten Helfer bis zum letzten Abbau: MyCrewMate bündelt die Arbeit, damit sich das Orga-Team auf ein starkes Erlebnis konzentrieren kann.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><LayoutDashboard className="size-5 text-blue-300" /><p className="mt-3 text-sm font-bold">Klarer Überblick</p><p className="mt-1 text-xs leading-5 text-slate-300">Schritte, Kennzahlen und Zuständigkeiten auf einen Blick.</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><CreditCard className="size-5 text-orange-300" /><p className="mt-3 text-sm font-bold">Transparent gedacht</p><p className="mt-1 text-xs leading-5 text-slate-300">Diese Seite zeigt eine unverbindliche Produkt- und Kaufdemo.</p></div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><img src={WORDMARK} alt="MyCrewMate" className="h-6 w-auto" /><span>© 2026 MyCrewMate · Angebotsdemo</span></div>
          <p className="max-w-xl text-xs leading-5 sm:text-right">Lokale Musterseite: kein Live-Angebot, keine Zahlungsabwicklung und keine Datenübertragung.</p>
        </div>
      </footer>

      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-xl shadow-slate-900/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
        onClick={() => setCartOpen(true)}
        aria-label={cartOffer ? `${cartOffer.name} im simulierten Warenkorb ansehen` : "Simulierten Warenkorb öffnen"}
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        Warenkorb {cartOffer ? "· 1" : "· 0"}
      </button>

      <Dialog open={detailsOffer !== null} onOpenChange={open => !open && setDetailsOffer(null)}>
        <DialogContent className="max-w-xl rounded-2xl">
          {detailsOffer && (
            <>
              <DialogHeader>
                <DialogTitle>{detailsOffer.name}: {detailsOffer.detailTitle}</DialogTitle>
                <DialogDescription>{detailsOffer.audience}</DialogDescription>
              </DialogHeader>
              <p className="leading-7 text-slate-700">{detailsOffer.detailText}</p>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-900">{detailsOffer.price} € pro Jahr*</p><p className="mt-1 text-xs leading-5 text-slate-500">Fiktiver Musterpreis dieser lokalen Demo.</p></div>
              <DialogFooter>
                <Button type="button" className={cn("rounded-xl", detailsOffer.buttonClass)} onClick={() => { addToCart(detailsOffer); setDetailsOffer(null); }}>
                  <ShoppingBag className="size-4" aria-hidden="true" /> Simuliert in den Warenkorb
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Simulierter Warenkorb</DialogTitle>
            <DialogDescription>Dies ist eine Demo. Es wird keine Bestellung gespeichert oder übertragen.</DialogDescription>
          </DialogHeader>
          {cartOffer ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4"><div><p className="font-black text-slate-950">MyCrewMate {cartOffer.name}</p><p className="mt-1 text-sm text-slate-600">{cartOffer.audience}</p></div><strong className="text-xl text-slate-950">{cartOffer.price} €</strong></div>
              <p className="mt-3 text-xs text-slate-500">Fiktiver Jahrespreis · kein Zahlungsprozess</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><ShoppingBag className="mx-auto size-6 text-slate-400" /><p className="mt-3 font-bold text-slate-700">Noch kein Paket ausgewählt.</p><p className="mt-1 text-sm text-slate-500">Wähle eines der drei Musterangebote aus.</p></div>
          )}
          <DialogFooter className="sm:justify-between">
            {cartOffer && <Button type="button" variant="ghost" className="text-slate-600" onClick={() => setCartOffer(null)}>Warenkorb leeren</Button>}
            {cartOffer && <Button type="button" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={openCheckout}>Muster-Checkout öffnen <ArrowRight className="size-4" /></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          {checkoutComplete ? (
            <div className="py-6 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CircleCheckBig className="size-7" /></span><DialogTitle className="mt-5">Musteranfrage simuliert</DialogTitle><DialogDescription className="mt-3 block leading-6">In einer echten Angebotsseite würde jetzt eine unverbindliche Anfrage entstehen. In dieser lokalen Demo wurden keine Daten gespeichert oder versendet.</DialogDescription></div>
          ) : (
            <form onSubmit={event => { event.preventDefault(); setCheckoutComplete(true); }}>
              <DialogHeader><DialogTitle>Fiktiver Muster-Checkout</DialogTitle><DialogDescription>Nur zur Veranschaulichung des späteren Ablaufs. Keine Eingabe wird übertragen.</DialogDescription></DialogHeader>
              <div className="mt-5 grid gap-3">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Vereinsname<input required placeholder="z. B. Radsportverein Musterstadt" className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Ansprechpartner<input required placeholder="Name" className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">E-Mail<input required type="email" placeholder="verein@beispiel.de" className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Muster-Zahlungsart<select className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option>Rechnung (Muster)</option><option>SEPA-Lastschrift (Muster)</option><option>PayPal (Muster)</option></select></label>
              </div>
              <DialogFooter className="mt-6"><Button type="submit" className="rounded-xl bg-orange-500 text-white hover:bg-orange-600">Musteranfrage simulieren <ArrowRight className="size-4" /></Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
