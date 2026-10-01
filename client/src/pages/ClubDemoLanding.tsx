import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Flag,
  MapPinned,
  Megaphone,
  MessageCircleMore,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

type DemoSource =
  | "cycling_event"
  | "club_event"
  | "recommendation"
  | "online"
  | "other";

const sourceOptions: Array<{
  id: DemoSource;
  title: string;
  detail: string;
}> = [
  {
    id: "cycling_event",
    title: "Radsportveranstaltung",
    detail: "z. B. RTF, Marathon, Rennen oder Gravel-Event",
  },
  {
    id: "club_event",
    title: "Vereins- oder Festveranstaltung",
    detail: "z. B. Kirmes, Schützenfest, Feuerwehr oder Sportfest",
  },
  {
    id: "recommendation",
    title: "Empfehlung aus dem Verein",
    detail: "Die Karte wurde mir persönlich weitergegeben",
  },
  {
    id: "online",
    title: "Online entdeckt",
    detail: "Website, Social Media oder Suche",
  },
  {
    id: "other",
    title: "Anderer Ort",
    detail: "Ich möchte den Auslageort nicht näher angeben",
  },
];

const planningPhases = [
  {
    number: "01",
    title: "Früh planen",
    text: "Genehmigungen, Strecken, Standorte, Material und Verantwortlichkeiten rechtzeitig zusammenbringen.",
    icon: MapPinned,
  },
  {
    number: "02",
    title: "Menschen verbinden",
    text: "Ansprechpartner koordinieren Helfer, Verfügbarkeiten und Rückmeldungen in einem klaren Ablauf.",
    icon: UsersRound,
  },
  {
    number: "03",
    title: "Sicher durchführen",
    text: "Schichten, Informationen und offene Punkte bleiben für das Team sichtbar – bis zur Nachbereitung.",
    icon: ClipboardCheck,
  },
];

const demoModules = [
  {
    title: "Vorbereitung & Genehmigungen",
    text: "Aufgaben, Fristen und zuständige Personen für die Monate vor dem Event.",
    icon: CalendarDays,
  },
  {
    title: "Helfer & Ansprechpartner",
    text: "Wer fragt nach, wer kann wann helfen und welche Rückmeldung liegt vor?",
    icon: UsersRound,
  },
  {
    title: "Einsatzplan & Kommunikation",
    text: "Schichten besetzen, Pläne weitergeben und das Orga-Team auf demselben Stand halten.",
    icon: MessageCircleMore,
  },
  {
    title: "Material, Orte & Sicherheit",
    text: "Versorgungsstationen, Ausrüstung, Schutzbereiche und wichtige Informationen gebündelt steuern.",
    icon: PackageCheck,
  },
];

export default function ClubDemoLanding() {
  const [source, setSource] = useState<DemoSource | null>(null);
  const [sourceRecorded, setSourceRecorded] = useState(false);
  const recordSource = trpc.publicDemo.recordSource.useMutation();

  const selectedSource = useMemo(
    () => sourceOptions.find(option => option.id === source) ?? null,
    [source]
  );
  const continueToDemo = async () => {
    if (sourceRecorded) return;
    if (!source) return;
    try {
      await recordSource.mutateAsync({ source });
    } catch {
      // Die Vereinsdemo bleibt erreichbar, auch falls die optionale Auswertung
      // vorübergehend nicht verfügbar ist. Es werden dabei keine Eingaben erneut versucht.
    } finally {
      setSourceRecorded(true);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0" aria-label="MyCrewMate – zur Startseite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-8 w-auto sm:h-9" />
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 sm:text-sm">
            <span className="hidden sm:inline">Vereinsdemo</span>
            <span className="size-1.5 rounded-full bg-orange-400" aria-hidden="true" />
            <span>unverbindlich</span>
          </div>
        </div>
      </header>

      {!sourceRecorded && (
        <section className="border-b border-orange-200 bg-orange-50/70">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:px-8">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-orange-700">
                <ScanLine className="size-4" aria-hidden="true" /> Willkommen bei MyCrewMate
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Schön, dass ihr euch für gute Vereinsplanung interessiert.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Damit wir die Auslageorte unserer Checkkarten grob verstehen: Wo habt ihr die Karte entdeckt? Die Angabe ist freiwillig. Wir speichern nur die ausgewählte Kategorie für maximal 30 Tage – ohne Namen, Kontaktdaten oder Freitext.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {sourceOptions.map(option => {
                  const active = source === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSource(option.id)}
                      className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${active ? "border-blue-600 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-300"}`}
                      aria-pressed={active}
                    >
                      <span className="block text-sm font-black text-slate-950">{option.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600">{option.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-slate-950">{selectedSource ? selectedSource.title : "Auslageort auswählen"}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Details zur Verarbeitung stehen im <a href="/datenschutz" className="font-semibold text-blue-700 underline underline-offset-2">Datenschutzhinweis</a>.
              </p>
              <Button
                type="button"
                disabled={!source || recordSource.isPending}
                onClick={() => void continueToDemo()}
                className="mt-5 h-11 w-full rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 disabled:opacity-45"
              >
                {recordSource.isPending ? "Öffne Vereinsdemo …" : "Vereinsdemo ansehen"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <button
                type="button"
                onClick={() => setSourceRecorded(true)}
                className="mx-auto mt-3 block text-xs font-semibold text-slate-500 underline-offset-2 hover:text-blue-700 hover:underline"
              >
                Ohne Angabe fortfahren
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">MyCrewMate für Vereine & Veranstalter</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Gemeinsam planen.<br />Entspannt veranstalten.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              MyCrewMate bringt die Vorbereitung, die Menschen und den Veranstaltungstag in einen verständlichen gemeinsamen Ablauf – von der ersten Genehmigung bis zum letzten Abbau.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="mailto:info@mycrewmate.de?subject=Unverbindliche%20Vereinsdemo%20MyCrewMate">
                <Button type="button" className="h-12 rounded-xl bg-orange-500 px-5 font-bold text-white hover:bg-orange-600">
                  Unverbindliche Demo anfragen <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </a>
              <Link href="/#pakete" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25">
                Pakete ansehen <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">Beispiel: Radsportfestival</p>
            <div className="mt-4 space-y-3">
              {[
                "Streckenfreigabe und Standorte sichern",
                "Verpflegung und Material einplanen",
                "Helfer über Ansprechpartner koordinieren",
                "Einsatzplan und Rückmeldungen zusammenführen",
              ].map(item => (
                <div key={item} className="flex gap-3 text-sm leading-5 text-slate-100"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />{item}</div>
              ))}
            </div>
            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-300">Nicht nur für Radsport: Auch Kirmes, Schützenfest, Feuerwehr, Sportverein und Mehrtagesveranstaltung profitieren von derselben klaren Struktur.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Die Planungslogik</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Ein Ablauf, den jedes Orga-Team versteht.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Nicht noch eine lose Liste. Sondern eine verständliche Struktur, die sich mit der Veranstaltung entwickelt.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {planningPhases.map(phase => {
            const Icon = phase.icon;
            return (
              <article key={phase.number} className="relative overflow-hidden border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)]">
                <span className="absolute right-5 top-4 text-5xl font-black tracking-tighter text-slate-100" aria-hidden="true">{phase.number}</span>
                <span className="flex size-11 items-center justify-center bg-orange-50 text-orange-600"><Icon className="size-5" aria-hidden="true" /></span>
                <h3 className="mt-5 text-xl font-black text-slate-950">{phase.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{phase.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(24rem,1.15fr)] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Was die Vereinsdemo zeigt</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Vom ersten To-do bis zum gemeinsamen Überblick.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">In einer persönlichen Demo schauen wir auf eure echte Veranstaltungswelt. Ihr entscheidet, ob ihr zunächst schlank startet oder eine umfassende Orga-Struktur aufbaut.</p>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
              <p><strong className="text-slate-950">Ohne Druck, ohne Kaufabschluss:</strong> Die Demo dient dem Kennenlernen. Für ein individuelles Gespräch schreibt ihr direkt an <a className="font-bold text-blue-700 underline underline-offset-2" href="mailto:info@mycrewmate.de">info@mycrewmate.de</a>.</p>
            </div>
          </div>
          <div className="grid gap-px border border-slate-200 bg-slate-200 sm:grid-cols-2">
            {demoModules.map(module => {
              const Icon = module.icon;
              return (
                <article key={module.title} className="bg-slate-50 p-5 transition-colors hover:bg-white">
                  <Icon className="size-5 text-blue-700" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-black text-slate-950">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{module.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="overflow-hidden bg-gradient-to-r from-blue-700 via-blue-700 to-slate-950 px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-200">Der nächste Schritt</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Schaut gemeinsam auf eure nächste Veranstaltung.</h2>
              <p className="mt-3 max-w-2xl leading-7 text-blue-100">Ihr bringt euren Ablauf mit. MyCrewMate zeigt, wie Verantwortlichkeiten, Helfer und Vorbereitung zusammenfinden.</p>
            </div>
            <a href="mailto:info@mycrewmate.de?subject=Unverbindliche%20Vereinsdemo%20MyCrewMate">
              <Button type="button" className="h-12 rounded-xl bg-orange-500 px-5 font-bold text-white hover:bg-orange-600">
                Demo anfragen <ExternalLink className="size-4" aria-hidden="true" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><img src={WORDMARK} alt="MyCrewMate" className="h-6 w-auto" /><span>© 2026 MyCrewMate</span></div>
          <div className="flex items-center gap-4 text-xs font-semibold"><a className="hover:text-blue-700" href="/impressum">Impressum</a><a className="hover:text-blue-700" href="/datenschutz">Datenschutz</a></div>
        </div>
      </footer>
    </main>
  );
}
