import { KlemmiMascot } from "@/components/KlemmiMascot";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/site-host";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Layers3,
  Map,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

function demoEntryUrl(token: string) {
  const query = `?token=${encodeURIComponent(token)}`;
  const host = window.location.hostname;
  const isProjectPreview =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".manus.computer") ||
    host.endsWith(".manus.space");
  return isProjectPreview
    ? `${window.location.origin}/api/public-demo/access${query}`
    : appUrl("/api/public-demo/access", query);
}

type DemoPackageId = "event_pass" | "light" | "pro";

type DemoPackage = {
  id: DemoPackageId;
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  stats: string[];
  accent: string;
  icon: typeof Bike;
};

const DEMO_PACKAGES: DemoPackage[] = [
  {
    id: "event_pass",
    name: "Event Pass",
    eyebrow: "Ein einzelner Tag",
    title: "Eine kompakte Veranstaltung ausprobieren",
    description:
      "Starte direkt in die echte App mit einem fiktiven Sommerfest, 30 Helfern, offenen Schichten und einer klaren To-do-Liste.",
    stats: ["30 Musterhelfer", "1 Veranstaltungstag", "Einsatzplan & Vorbereitung"],
    accent: "border-orange-200 bg-orange-50/70 text-orange-950",
    icon: Clock3,
  },
  {
    id: "light",
    name: "Light",
    eyebrow: "Ein Vereinswochenende",
    title: "Eine vollständige Vereinsplanung erleben",
    description:
      "Eine echte Musterumgebung mit einem dreitägigen Familienfest, 50 Helfern, fünf Ansprechpartnern, Material und Aufgaben.",
    stats: ["50 Musterhelfer", "5 Ansprechpartner", "Aufgaben, Material & Orte"],
    accent: "border-sky-200 bg-sky-50/70 text-sky-950",
    icon: UsersRound,
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "Radsportfestival",
    title: "Die große Mehrtagesplanung durchspielen",
    description:
      "Die fiktive EifelRide-Demo zeigt die echte App mit 150 Helfern, zehn Ansprechpartnern, Logistik, Standorten und GPX-Strecken.",
    stats: ["150 Musterhelfer", "10 Ansprechpartner", "Karte, Standorte & GPX"],
    accent: "border-blue-200 bg-blue-50/70 text-blue-950",
    icon: Bike,
  },
];

function StartDemoButton({ item }: { item: DemoPackage }) {
  const startDemo = trpc.publicDemo.start.useMutation({
    onSuccess: result => {
      window.location.assign(demoEntryUrl(result.handoffToken));
    },
    onError: error => {
      toast.error(error.message || "Die Demo konnte gerade nicht vorbereitet werden.");
    },
  });

  return (
    <Button
      type="button"
      className="mt-6 w-full rounded-xl bg-slate-950 text-white hover:bg-blue-700"
      onClick={() => startDemo.mutate({ packageId: item.id })}
      disabled={startDemo.isPending}
    >
      {startDemo.isPending ? "Demo wird vorbereitet …" : `${item.name} öffnen`}
      {!startDemo.isPending && <ArrowRight className="size-4" aria-hidden="true" />}
    </Button>
  );
}

export default function ClubDemoLanding() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="https://mycrewmate.de/" className="shrink-0" aria-label="MyCrewMate – zur Hauptwebsite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-7 w-auto sm:h-8" />
          </a>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Vereinsdemo · nur fiktive Daten
          </span>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:py-14">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">MyCrewMate Vereinsdemo</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Die echte App fiktiv durchklicken – ohne Zugang für euren Verein.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Wähle eine bereits gefüllte Musterumgebung. Danach öffnet sich die normale MyCrewMate-App: Du kannst erfundene Helfer anlegen, Schichten ändern, Aufgaben abhaken und – bei Pro – Karte und GPX-Strecken ansehen.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Das ist eine Übungsdemo, kein Testzugang für euren eigenen Verein. Alle Personen, Vereine, Kontakte und Strecken sind erfunden. Deine Eingaben liegen nur in einem eigenen, temporären Demo-Bereich und werden beim Verlassen der Demo sowie spätestens nach kurzer Zeit gelöscht.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <KlemmiMascot className="size-16 shrink-0" imageClassName="object-contain" decorative />
            <p className="text-sm leading-5 text-orange-950">
              <strong>Hallo, ich bin Klemmi.</strong>
              <br />In der App zeige ich dir den nächsten sinnvollen Schritt.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">Vereinsdemo · fiktiv üben</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">So sieht MyCrewMate mit Beispieldaten aus.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Du klickst dich sofort durch ein erfundenes Event. Die Demo ist ideal, um Dashboard, Helferlisten, Einsatzplan, Karte und GPX-Strecken kennenzulernen – ohne eigene Daten einzutragen oder zu speichern.
            </p>
          </article>
          <article className="rounded-3xl border border-orange-200 bg-orange-50/70 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-800">Pilotprogramm · eigener Verein</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Mit eurem echten Anlass wirklich planen.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Im Pilotprogramm richtet MyCrewMate nach persönlicher Abstimmung einen kostenlosen, zeitlich vereinbarten Zugang für euren Verein ein. Erst dort plant ihr mit eurem eigenen Team und euren echten Daten – ohne automatische Verlängerung.
            </p>
            <a href="/pilot" className="mt-5 inline-block">
              <Button type="button" className="rounded-xl bg-orange-500 text-white hover:bg-orange-600">
                Eigenen Verein im Pilotprogramm testen <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </a>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {DEMO_PACKAGES.map(item => {
            const Icon = item.icon;
            return (
              <article key={item.id} className={`flex flex-col rounded-3xl border p-6 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.45)] ${item.accent}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{item.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight">{item.name}</h2>
                  </div>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-black leading-6">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 opacity-80">{item.description}</p>
                <ul className="mt-5 space-y-2 text-sm font-semibold">
                  {item.stats.map(stat => (
                    <li key={stat} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      {stat}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <StartDemoButton item={item} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <article className="rounded-3xl border border-violet-200 bg-white p-6 shadow-[0_18px_44px_-34px_rgba(76,29,149,0.45)] sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Enterprise · für Verbände und große Vereine</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Mehrere Untervereine. Eigene Planungen. Ein gemeinsamer Rahmen.</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Enterprise ist die passende Lösung, wenn ein Verband, ein Dachverein oder ein großer Mehrspartenverein mehrere eigenständig planende Vereine zusammenbringt. Jeder Bereich behält seine eigenen Helfer, Veranstaltungen und Zugänge – der Verband erhält eine passende, abgestimmte Gesamtlösung.
              </p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 text-sm leading-6 text-violet-950">
              <Layers3 className="mb-3 size-5" aria-hidden="true" />
              <strong>Beispiel:</strong> Vier Untervereine planen selbstständig, nutzen gemeinsame Standards und können dort zusammenarbeiten, wo es sinnvoll ist.
            </div>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {[
              ["Getrennt und sicher", "Jeder Unterverein sieht nur die eigene Planung und das eigene Team."],
              ["Gemeinsam, wenn gewünscht", "Vorlagen, Termine, Standards und individuelle Lösungen lassen sich abgestimmt organisieren."],
              ["Passend eingerichtet", "Rechte, Workflows und Dokumente werden auf Verband und Untervereine zugeschnitten."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl bg-slate-50 p-4">
                <h3 className="font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-7 text-sm sm:grid-cols-3 sm:px-6">
          <div className="flex gap-3"><DatabaseZap className="mt-0.5 size-5 shrink-0 text-blue-700" /><p><strong>Eigene Datenbasis</strong><br /><span className="text-slate-600">Jede gestartete Demo erhält einen eigenen, fiktiven Mandanten.</span></p></div>
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-700" /><p><strong>Keine Echtdaten</strong><br /><span className="text-slate-600">Bitte teste nur mit erfundenen Namen und Kontakten.</span></p></div>
          <div className="flex gap-3"><Map className="mt-0.5 size-5 shrink-0 text-blue-700" /><p><strong>Pro mit Kartenansicht</strong><br /><span className="text-slate-600">Standorte und GPX-Routen sind in der echten Ortsansicht hinterlegt.</span></p></div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Die Vereinsdemo enthält ausschließlich fiktive Musterdaten. Temporäre Demo-Eingaben werden automatisch entfernt.</p>
          <div className="flex shrink-0 gap-4 font-semibold"><a className="hover:text-blue-700" href="/impressum">Impressum</a><a className="hover:text-blue-700" href="/datenschutz">Datenschutz</a></div>
        </div>
      </footer>
    </main>
  );
}
