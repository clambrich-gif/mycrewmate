import { KlemmiMascot } from "@/components/KlemmiMascot";
import { Button } from "@/components/ui/button";
import { isMarketingSite } from "@/lib/site-host";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Handshake,
  HeartHandshake,
  LoaderCircle,
  Mail,
  MapPinned,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * NICHT ALS HAUPTSEITE AKTIV / NUR UNTER /pilot VORSCHAUFÄHIG
 *
 * Entwurf für die öffentliche MyCrewMate-Startseite während der Pilotphase.
 * Erst nach inhaltlicher Freigabe, juristischer Prüfung der Pilotbedingungen
 * und Anbindung des Anfrageformulars soll diese Seite OfferDemo.tsx ersetzen.
 */

const WORDMARK = "/brand/mycrewmate-wordmark.png";

type PilotPackage = {
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  accent: string;
  iconClass: string;
};

const PILOT_PACKAGES: PilotPackage[] = [
  {
    name: "Event Pass",
    eyebrow: "Ein einzelner Anlass",
    title: "Für das Fest, das gut gelingen soll.",
    description:
      "Für Weihnachtsfeier, Helferfest, Rennen, Turnier oder einen einzelnen Veranstaltungstag.",
    features: ["Helfer und Schichten", "Aufgaben und Vorbereitung", "Klarer Ablauf für einen Anlass"],
    icon: CalendarDays,
    accent: "border-orange-200 bg-orange-50/60",
    iconClass: "bg-orange-100 text-orange-700",
  },
  {
    name: "Light",
    eyebrow: "Die jährliche Hauptveranstaltung",
    title: "Für Vereine mit einem festen Ablauf.",
    description:
      "Für ein wiederkehrendes Vereinsfest und ein kleines Planungsteam, das jedes Jahr leichter starten möchte.",
    features: ["Persönliche Zugänge", "Helfer, Material und Orte", "Vor- und Nachbereitung"],
    icon: UsersRound,
    accent: "border-sky-200 bg-sky-50/60",
    iconClass: "bg-sky-100 text-sky-700",
  },
  {
    name: "Pro",
    eyebrow: "Mehrere Tage, viele Bereiche",
    title: "Für das große Team hinter dem Event.",
    description:
      "Für Radsportfeste, Mehrtagesevents und Vereine mit vielen Helfern, Standorten und Abstimmungen.",
    features: ["Rollen und Teamkommunikation", "Karte, Standorte und GPX", "Material, Spenden und Finanzen"],
    icon: MapPinned,
    accent: "border-blue-200 bg-blue-50/60",
    iconClass: "bg-blue-100 text-blue-700",
  },
  {
    name: "Enterprise",
    eyebrow: "Verbände und Untervereine",
    title: "Für gemeinsame Strukturen mit eigenen Teams.",
    description:
      "Für Verbände, Dachvereine und große Vereine mit mehreren eigenständig planenden Bereichen.",
    features: ["Getrennte Vereinsbereiche", "Gemeinsame Standards", "Individuelle Einrichtung"],
    icon: ShieldCheck,
    accent: "border-violet-200 bg-violet-50/60",
    iconClass: "bg-violet-100 text-violet-700",
  },
];

const PILOT_STEPS = [
  {
    number: "01",
    title: "Unverbindlich anfragen",
    text: "Ihr beschreibt kurz euren Anlass, den gewünschten Zeitraum und euer Team.",
  },
  {
    number: "02",
    title: "Gemeinsam abstimmen",
    text: "Wir klären Paket, Laufzeit, Ansprechpartner und einen sinnvollen Starttermin.",
  },
  {
    number: "03",
    title: "Kostenlos testen",
    text: "Ihr plant mit eurem echten Team. Die Nutzung endet zum vereinbarten Termin – ohne automatische Verlängerung.",
  },
];

const PILOT_FAQS = [
  {
    question: "Was bedeutet kostenlos?",
    answer:
      "Im vereinbarten Pilotzeitraum entstehen keine Lizenzkosten. Es werden keine Zahlungsdaten abgefragt und keine Rechnung ausgelöst.",
  },
  {
    question: "Wie lange kann unser Verein testen?",
    answer:
      "Das stimmen wir passend zu eurem Anlass ab. Für eine Weihnachtsfeier kann es ein kurzer Zeitraum sein; bei einem großen Event kann die Nutzung auch das vereinbarte Veranstaltungsjahr 2027 begleiten.",
  },
  {
    question: "Müssen wir danach weitermachen?",
    answer:
      "Nein. Die Pilotnutzung endet zum vereinbarten Termin. Eine kostenpflichtige Nutzung entsteht nur, wenn ihr euch danach aktiv dafür entscheidet.",
  },
];

function PilotRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitInquiry = trpc.pilotInquiry.submit.useMutation({
    onSuccess: result => {
      setConfirmationSent(result.confirmationSent);
      setSubmitted(true);
    },
    onError: error => setFormError(error.message),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInquiry.isPending) return;
    setFormError(null);
    const values = new FormData(event.currentTarget);
    if (values.get("eligibility") !== "on") {
      setFormError("Bitte bestätige den ehrenamtlichen Bezug eurer Veranstaltung.");
      return;
    }
    if (values.get("privacy") !== "on") {
      setFormError("Bitte bestätige die Datenschutzhinweise.");
      return;
    }
    submitInquiry.mutate({
      club: String(values.get("club") ?? "").trim(),
      contact: String(values.get("contact") ?? "").trim(),
      email: String(values.get("email") ?? "").trim(),
      phone: String(values.get("phone") ?? "").trim(),
      organizationType: String(values.get("organizationType") ?? "").trim(),
      occasion: String(values.get("occasion") ?? "").trim(),
      start: String(values.get("start") ?? ""),
      note: String(values.get("note") ?? "").trim(),
      eligibility: true,
      privacy: true,
      website: String(values.get("website") ?? ""),
    });
  }

  if (submitted) {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-left"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="size-7 text-emerald-700" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">
          Pilot-Anfrage eingegangen
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Wir prüfen eure Anfrage persönlich und melden uns, wenn Anlass,
          Organisation und ehrenamtlicher Bezug zum Pilotprogramm passen.
        </p>
        {confirmationSent ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
            Eine Bestätigung wurde an eure angegebene E-Mail-Adresse gesendet.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Die Anfrage ist bei uns eingegangen. Falls keine Bestätigung in eurem
            Postfach erscheint, melden wir uns telefonisch oder per E-Mail.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-5 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
          onClick={() => setSubmitted(false)}
        >
          Formular erneut ansehen
        </Button>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <section
        aria-labelledby="pilot-datenhinweis"
        className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-5 text-slate-700"
      >
        <h3 id="pilot-datenhinweis" className="font-black text-slate-950">
          Kurz zum Umgang mit euren Angaben
        </h3>
        <dl className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-[8rem_1fr]">
          <dt className="font-bold text-slate-800">Pflichtangaben</dt>
          <dd>Name der Organisation, Organisationsform, Ansprechperson, E-Mail, Anlass und Wunschmonat – ohne diese Angaben können wir die Anfrage nicht bearbeiten.</dd>
          <dt className="font-bold text-slate-800">Freiwillig</dt>
          <dd>Telefonnummer für einen Rückruf sowie weitere Angaben zum Vorhaben.</dd>
          <dt className="font-bold text-slate-800">Zweck</dt>
          <dd>Persönliche Antwort, Abstimmung eines möglichen Pilotzeitraums und nachvollziehbare Bearbeitung der Anfrage.</dd>
          <dt className="font-bold text-slate-800">Speicherdauer</dt>
          <dd>Bis zur dokumentierten Entscheidung; danach drei Jahre. Ein vorzeitiger Löschwunsch ist jederzeit möglich.</dd>
        </dl>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Die Checkbox unten bestätigt nur, dass ihr die Datenschutzhinweise gelesen habt. Sie ist keine Werbeeinwilligung.
        </p>
      </section>

      <section
        aria-labelledby="pilot-zielgruppe"
        className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-6 text-slate-700"
      >
        <h3 id="pilot-zielgruppe" className="font-black text-slate-950">
          Für wen ist der Pilot gedacht?
        </h3>
        <p className="mt-2">
          Für Vereine und Verbände, ehrenamtliche Initiativen oder Organisationsteams sowie Gemeinden und kommunale Veranstalter mit ehrenamtlich getragenen Veranstaltungen. Ein möglicher Pilotzugang wird ausschließlich mit einer benannten Organisation abgestimmt – nicht mit Privatpersonen.
        </p>
        <p className="mt-2 font-semibold text-slate-800">
          Nicht vorgesehen sind private Feiern, Firmenveranstaltungen und gewerbliche Eventdienstleistungen.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Jede Anfrage wird einzeln geprüft. Eine Anfrage begründet keinen Anspruch auf Teilnahme, Freischaltung oder ein bestimmtes Paket.
        </p>
      </section>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Art der anfragenden Organisation
        <select
          required
          name="organizationType"
          defaultValue=""
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="" disabled>
            Organisationsform auswählen
          </option>
          <option>Verein oder Verband</option>
          <option>Ehrenamtliches Organisationsteam oder Initiative</option>
          <option>Gemeinde oder kommunaler Veranstalter</option>
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Name des Vereins, der Initiative oder der Gemeinde
        <input
          required
          name="club"
          autoComplete="organization"
          maxLength={160}
          placeholder="z. B. Radsportverein Musterstadt e. V."
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Ansprechperson
        <input
          required
          name="contact"
          autoComplete="name"
          maxLength={120}
          placeholder="Vor- und Nachname"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        E-Mail-Adresse
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          maxLength={320}
          placeholder="vorstand@verein.de"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Telefonnummer für eine persönliche Rückfrage <span className="font-normal text-slate-500">(optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={60}
          pattern="[0-9+()\-./\s]{6,}"
          placeholder="z. B. 02651 123456 oder +49 171 1234567"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
        <span className="text-xs font-normal leading-5 text-slate-500">
          Nur wenn ihr einen persönlichen Rückruf wünscht.
        </span>
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Wofür möchtet ihr testen?
        <select
          required
          name="occasion"
          defaultValue=""
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="" disabled>
            Anlass auswählen
          </option>
          <option>Einzelnes Fest oder Weihnachtsfeier</option>
          <option>Turnier, Rennen oder Sportevent</option>
          <option>Wiederkehrende Jahresveranstaltung</option>
          <option>Mehrtagesveranstaltung</option>
          <option>Verband oder mehrere Untervereine</option>
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Gewünschter Start
        <input
          required
          name="start"
          type="month"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-slate-800">
        Was möchtet ihr organisieren? <span className="font-normal text-slate-500">(optional)</span>
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          placeholder="Zum Beispiel: RTF-Wochenende mit 120 Helfern, Start/Ziel und drei Strecken."
          className="resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
        <span className="text-xs font-normal leading-5 text-slate-500">
          Bitte keine Gesundheitsdaten, personenbezogenen Daten Dritter oder anderen vertraulichen Angaben eintragen.
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm leading-5 text-slate-700">
        <input required type="checkbox" name="eligibility" className="mt-0.5 size-4 accent-emerald-700" />
        <span>
          Ich frage im Namen der genannten Organisation für eine ehrenamtlich getragene Veranstaltung an. Mir ist bekannt, dass MyCrewMate nicht für private Feiern, Firmenveranstaltungen oder gewerbliche Eventdienstleistungen vorgesehen ist und ein möglicher Pilotzugang nur mit der genannten Organisation vereinbart wird.
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">
        <input required type="checkbox" name="privacy" className="mt-0.5 size-4 accent-blue-600" />
        <span>
          Die Pflichtangaben verwenden wir ausschließlich, um diese Pilot-Anfrage zu beantworten. Ich habe die <a className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900" href="/datenschutz" target="_blank" rel="noreferrer">Datenschutzhinweise zur Pilot-Anfrage</a> gelesen.
        </span>
      </label>

      <label className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        Bitte dieses Feld leer lassen
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      {formError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-800" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={submitInquiry.isPending}
        className="w-full rounded-xl bg-orange-700 text-white shadow-lg shadow-orange-200 hover:bg-orange-800 disabled:cursor-wait disabled:opacity-80"
      >
        {submitInquiry.isPending ? (
          <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Anfrage wird gesendet …</>
        ) : (
          <>Pilot kostenlos anfragen <ArrowRight className="size-4" aria-hidden="true" /></>
        )}
      </Button>
      <p className="text-xs leading-5 text-slate-500">
        Eure Anfrage geht direkt an das MyCrewMate-Pilotteam. Wir bestätigen den Eingang zusätzlich per E-Mail.
      </p>
    </form>
  );
}

export default function PilotHomepageDraft() {
  const priceOverviewHref = isMarketingSite() ? "/#pakete" : "/angebot-demo#pakete";

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <a
        href="#inhalt"
        className="sr-only z-50 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Zum Inhalt springen
      </a>

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        Pilotanfragen bis 31.12.2026 · Auf dieser Seite wird keine Bestellung ausgelöst.
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <a href="https://mycrewmate.de/" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="MyCrewMate – zur Hauptwebsite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-auto w-36 sm:w-40" />
          </a>
          <nav className="hidden items-center gap-5 text-sm font-bold text-slate-600 lg:flex" aria-label="Seitennavigation">
            <a className="rounded-md hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" href="#so-hilft-es">
              So hilft es
            </a>
            <a className="rounded-md hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" href="#pilot">
              Pilotprogramm
            </a>
            <a className="rounded-md hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" href="#pakete">
              Passende Umgebung
            </a>
            <a className="rounded-md hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" href="#fragen">
              Fragen
            </a>
          </nav>
          <a href="#pilot-anfrage" className="shrink-0">
            <Button className="rounded-xl bg-orange-700 px-4 text-white hover:bg-orange-800">
              Pilot anfragen <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </a>
        </div>
      </header>

      <section id="start" className="relative isolate overflow-hidden border-b border-slate-200/70">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-100 via-white to-orange-100/80" />
        <div className="absolute -left-28 top-20 -z-10 size-96 rounded-full bg-blue-200/35 blur-3xl" />
        <div className="absolute -right-20 bottom-4 -z-10 size-96 rounded-full bg-orange-200/45 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:px-8 lg:py-24">
          <div id="inhalt">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-800 shadow-sm">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Pilotanfragen bis 31.12.2026
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
              Vereins- und Eventplanung, die <span className="text-blue-600">Freude</span> macht.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
              Bis zum regulären Produktstart am 01.01.2027 suchen wir Vereine,
              Verbände, ehrenamtliche Initiativen und Gemeinden mit einem
              ehrenamtlich getragenen Anlass. Gemeinsam prüfen wir, ob
              MyCrewMate und eine passende Pilotumgebung zu eurem Vorhaben passen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#pilot-anfrage">
                <Button
                  type="button"
                  size="lg"
                  className="rounded-xl bg-orange-700 px-6 text-white shadow-lg shadow-orange-200 hover:bg-orange-800"
                >
                  Pilot kostenlos anfragen <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </a>
              <a href="/vereinsdemo">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="rounded-xl border-slate-300 bg-white/80 px-5 text-slate-700 hover:border-blue-300 hover:bg-white hover:text-blue-700"
                >
                  Fiktive Vereinsdemo ausprobieren
                </Button>
              </a>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Unverbindliche Anfrage · Persönliche Rückmeldung · Kein Kauf auf dieser Seite
            </p>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-slate-700">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> Kostenfrei im vereinbarten Zeitraum
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> Keine Zahlungsdaten
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> Keine automatische Verlängerung
              </span>
            </div>
          </div>

          <aside className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2rem] bg-orange-400/15 blur-2xl" />
            <div className="relative rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.45)]">
              <div className="flex items-start gap-4">
                <KlemmiMascot decorative className="size-20 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Klemmi sagt</p>
                  <p className="mt-2 text-lg font-black leading-6 tracking-tight text-slate-950">
                    Wir starten nicht mit Software. Wir starten mit eurem echten Anlass.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">
                <p className="flex gap-2"><Handshake className="mt-1 size-4 shrink-0 text-orange-700" aria-hidden="true" />Wir stimmen Paket und Zeitraum gemeinsam ab.</p>
                <p className="flex gap-2"><Clock3 className="mt-1 size-4 shrink-0 text-orange-700" aria-hidden="true" />Ihr testet so lange, wie es zu eurem Anlass passt.</p>
                <p className="flex gap-2"><ShieldCheck className="mt-1 size-4 shrink-0 text-orange-700" aria-hidden="true" />Danach entscheidet ihr in Ruhe, ob ihr weitermachen möchtet.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="so-hilft-es" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Für euren Verein</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Nicht erst nach dem Event merken, was gefehlt hat.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            MyCrewMate bringt Helfer, Aufgaben, Schichten, Orte und wichtige Hinweise in einen gemeinsamen Ablauf. So bleibt das Wissen im Verein – auch wenn Teams wechseln.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            [UsersRound, "Alle wissen, was zu tun ist.", "Helfer, Verantwortungen und offene Schichten bleiben für das Team sichtbar."],
            [CalendarDays, "Der Ablauf wird einfacher.", "Vorbereitung, Eventtag und Abbau werden nicht mehr in verschiedenen Listen gesucht."],
            [ShieldCheck, "Der Verein behält den Überblick.", "Zugänge, Rollen und wichtige Änderungen lassen sich nachvollziehbar organisieren."],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as LucideIcon;
            return (
              <article key={String(title)} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <FeatureIcon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{String(title)}</h3>
                <p className="mt-2 leading-7 text-slate-600">{String(text)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="pilot" className="border-y border-slate-200 bg-slate-950 py-16 text-white lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-300">So läuft der Pilot</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">
                Ein echter Test. Kein verstecktes Abo.
              </h2>
              <p className="mt-4 max-w-md text-lg leading-8 text-slate-300">
                Wir suchen keine Klicks, sondern ehrenamtlich getragene Organisationen, die MyCrewMate im Alltag ausprobieren und mitgestalten möchten.
              </p>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {PILOT_STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <span className="text-sm font-black tracking-[0.16em] text-orange-300">{step.number}</span>
                  <h3 className="mt-6 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-8 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-4 text-sm leading-6 text-emerald-50 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <p><strong>Bei Annahme für den Pilotzeitraum:</strong> Keine Lizenzkosten, keine Zahlungsdaten, keine Rechnung und keine automatische Verlängerung.</p>
            <a href="#pilot-anfrage" className="mt-3 inline-flex shrink-0 items-center gap-1 font-bold text-white underline underline-offset-4 sm:mt-0">
              Pilot anfragen <ChevronRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="pakete" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Passende Pilotumgebung</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Nicht jedes Event braucht dieselbe Planung.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Wir wählen die Umgebung nicht nach einem Verkaufsgespräch, sondern danach, was euren Verein im nächsten Event wirklich entlastet.
            </p>
          </div>
          <div className="max-w-xs text-sm leading-6 text-slate-500">
            <p>Im Pilot klären wir Umfang, Laufzeit und Zugang gemeinsam. Preise oder ein Kauf werden auf dieser Seite nicht ausgelöst.</p>
            <a
              href={priceOverviewHref}
              className="mt-3 inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 hover:underline"
            >
              Reguläre Preise ab 01.01.2027 ansehen
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PILOT_PACKAGES.map((pilotPackage) => {
            const Icon = pilotPackage.icon;
            return (
              <article key={pilotPackage.name} className={`flex min-h-full flex-col rounded-2xl border p-6 ${pilotPackage.accent}`}>
                <span className={`inline-flex size-11 items-center justify-center rounded-xl ${pilotPackage.iconClass}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{pilotPackage.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{pilotPackage.name}</h3>
                <p className="mt-3 text-lg font-bold leading-6 text-slate-800">{pilotPackage.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{pilotPackage.description}</p>
                <ul className="mt-5 space-y-2 text-sm leading-5 text-slate-700">
                  {pilotPackage.features.map((feature) => (
                    <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>
                  ))}
                </ul>
                <a href="#pilot-anfrage" className="mt-7 inline-flex items-center gap-1 text-sm font-black text-blue-700 hover:text-blue-900">
                  Passenden Pilotzugang anfragen <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-blue-100 bg-blue-50/70 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Pilotvorteil</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Gute Tests sollen sich für den Verein lohnen.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              Wenn ihr MyCrewMate nach dem vereinbarten Pilotzeitraum weiter nutzen möchtet, gilt der Pilotvorteil von <strong>50 %</strong> für das erste kostenpflichtige Veranstaltungsjahr von <strong>Light</strong> oder <strong>Pro</strong>.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Das entspricht bei den regulären Endpreisen ab 01.01.2027: Light 149 € → 74,50 € und Pro 299 € → 149,50 €. Der Vorteil gilt einmalig je teilnehmendem Verein für einen unmittelbar an den vereinbarten Piloten anschließenden, kostenpflichtigen Jahreszugang. Event Pass und Enterprise sind ausgeschlossen; eine Kombination mit anderen Rabatten ist nicht möglich. Paket, Zeitraum und Vorteil werden vor Pilotende in Textform, zum Beispiel per E-Mail, bestätigt. Es gibt keine automatische Verlängerung.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><HeartHandshake className="size-5" aria-hidden="true" /></span>
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-950">Erst erleben. Dann entscheiden.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Der Pilot ist keine versteckte Vertragsverlängerung. Er gibt eurem Verein eine echte Entscheidungsgrundlage.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fragen" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Häufige Fragen</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Klar, bevor ihr startet.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">Was zum Pilot zählt und was danach passiert, erklären wir ohne Kleingedrucktes.</p>
          </div>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {PILOT_FAQS.map((faq) => (
              <details key={faq.question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black text-slate-950 marker:hidden">
                  {faq.question}
                  <CircleHelp className="size-5 shrink-0 text-blue-600 transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 max-w-2xl leading-7 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="pilot-anfrage" className="border-t border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Pilot kostenlos anfragen</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Erzählt uns von eurem nächsten Anlass.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Ihr braucht noch nicht alles vorbereitet zu haben. Organisation, Ansprechperson, Kontaktmöglichkeit, Anlass und ein Wunschzeitraum reichen für den ersten Schritt.
            </p>
            <p className="mt-6 flex gap-2 text-sm leading-6 text-slate-600"><Mail className="mt-1 size-4 shrink-0 text-blue-700" aria-hidden="true" />Die Anfrage wird persönlich geprüft und beantwortet. Es gibt keinen automatisierten Verkaufsabschluss und keinen Anspruch auf einen Pilotzugang.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_55px_-35px_rgba(15,23,42,0.35)] sm:p-7">
            <PilotRequestForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 MyCrewMate.de · Pilotprogramm für ehrenamtlich getragene Veranstaltungen.</p>
          <div className="flex gap-4 font-semibold"><a className="hover:text-blue-700" href="/impressum">Impressum</a><a className="hover:text-blue-700" href="/datenschutz">Datenschutz</a></div>
        </div>
      </footer>
    </main>
  );
}
