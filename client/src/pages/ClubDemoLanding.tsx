import { KlemmiMascot } from "@/components/KlemmiMascot";
import { PublicReachPageView } from "@/components/PublicReachMetric";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const WORDMARK = "/brand/mycrewmate-wordmark.png";
const PUBLIC_DEMO_GUIDE_SESSION_KEY = "mycrewmate:public-demo-guide";
const PUBLIC_DEMO_GUIDE_COOKIE = "mycrewmate_public_demo_guide";

function demoEntryUrl(token: string, startGuide = false) {
  const query = `?token=${encodeURIComponent(token)}${startGuide ? "&guide=1" : ""}`;
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
  purpose: string;
  description: string;
  stats: string[];
  guideHighlights: string[];
  accent: string;
  icon: typeof Bike;
};

const DEMO_PACKAGES: DemoPackage[] = [
  {
    id: "event_pass",
    name: "Event Pass",
    eyebrow: "Ein einzelner Tag",
    title: "Eine kompakte Veranstaltung ausprobieren",
    purpose:
      "Für ein einzelnes Fest, einen Arbeitseinsatz, ein Turnier oder eine Feier mit einem überschaubaren Helferteam.",
    description:
      "Starte direkt in die echte App mit einem fiktiven Sommerfest, 30 Helfern, offenen Schichten und einer klaren To-do-Liste.",
    stats: ["30 Musterhelfer", "1 Veranstaltungstag", "Einsatzplan & Vorbereitung"],
    guideHighlights: [
      "Das Dashboard mit den wichtigsten offenen Punkten ansehen.",
      "Im Einsatzplan erkennen, welche Schichten noch Helfer brauchen.",
      "Einen Musterhelfer oder eine Aufgabe testweise verändern.",
    ],
    accent: "border-orange-200 bg-orange-50/70 text-orange-950",
    icon: Clock3,
  },
  {
    id: "light",
    name: "Light",
    eyebrow: "Ein Vereinswochenende",
    title: "Eine vollständige Vereinsplanung erleben",
    purpose:
      "Für Vereine, die eine größere Veranstaltung oder ein mehrtägiges Fest mit mehreren Bereichen planen.",
    description:
      "Eine echte Musterumgebung mit einem dreitägigen Familienfest, 50 Helfern, fünf Ansprechpartnern, Material und Aufgaben.",
    stats: ["50 Musterhelfer", "5 Ansprechpartner", "Aufgaben, Material & Orte"],
    guideHighlights: [
      "Das Dashboard als gemeinsamen Überblick für das Vereinswochenende ansehen.",
      "Helfer, Aufgaben, Material und Verantwortlichkeiten zusammen entdecken.",
      "Im Einsatzplan nach offenen oder knapp besetzten Schichten filtern.",
    ],
    accent: "border-sky-200 bg-sky-50/70 text-sky-950",
    icon: UsersRound,
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "Radsportfestival",
    title: "Die große Mehrtagesplanung durchspielen",
    purpose:
      "Für große Veranstaltungen mit vielen Helfern, mehreren Standorten, Strecken, Material und vielen Ansprechpartnern.",
    description:
      "Die fiktive EifelRide-Demo zeigt die echte App mit 150 Helfern, zehn Ansprechpartnern, Logistik, Standorten und GPX-Strecken.",
    stats: ["150 Musterhelfer", "10 Ansprechpartner", "Karte, Standorte & GPX"],
    guideHighlights: [
      "Die wichtigsten offenen Punkte im Dashboard des Radsportfestivals prüfen.",
      "Mehrere Tage, Schichten und Helferzuordnungen im Einsatzplan kennenlernen.",
      "Unter Orte & Standorte die Karte und die hinterlegte GPX-Strecke ansehen.",
    ],
    accent: "border-blue-200 bg-blue-50/70 text-blue-950",
    icon: Bike,
  },
];

function DemoStartDialog({
  item,
  onOpenChange,
}: {
  item: DemoPackage | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [showTestIdeas, setShowTestIdeas] = useState(false);
  const startGuideRef = useRef(false);
  const startDemo = trpc.publicDemo.start.useMutation({
    onSuccess: result => {
      window.location.assign(demoEntryUrl(result.handoffToken, startGuideRef.current));
    },
    onError: error => {
      toast.error(error.message || "Die Demo konnte gerade nicht vorbereitet werden.");
    },
  });

  const close = () => {
    if (startDemo.isPending) return;
    setShowTestIdeas(false);
    onOpenChange(false);
  };

  const start = (startGuide: boolean) => {
    if (!item) return;
    try {
      // In lokalen Vorschauen liegen Startseite und App auf demselben Host.
      // Der kurze Cookie-Merker überbrückt dort einen vollständigen Seitenwechsel,
      // während der Server für die echte App-Domain weiterhin guide=1 übergibt.
      document.cookie = startGuide
        ? `${PUBLIC_DEMO_GUIDE_COOKIE}=1; Path=/; Max-Age=300; SameSite=Lax`
        : `${PUBLIC_DEMO_GUIDE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      // Die URL-Übergabe bleibt auch bei gesperrten Cookies funktionsfähig.
    }
    try {
      if (startGuide) {
        window.sessionStorage.setItem(PUBLIC_DEMO_GUIDE_SESSION_KEY, "1");
      } else {
        window.sessionStorage.removeItem(PUBLIC_DEMO_GUIDE_SESSION_KEY);
      }
    } catch {
      // Der Cookie- und URL-Weg bleibt auch bei gesperrtem Webspeicher nutzbar.
    }
    startGuideRef.current = startGuide;
    startDemo.mutate({ packageId: item.id });
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={open => !open && close()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-xl bg-white text-slate-950 sm:max-w-xl">
        {item && (
          <>
            <DialogHeader>
              <div className="mb-2 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                  <Sparkles className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Vereinsdemo · {item.name}</p>
                  <DialogTitle className="mt-1 text-xl">Willkommen in der Vereinsdemo</DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-sm leading-6 text-slate-600">
                {item.purpose}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1 text-sm leading-6 text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-950">Was dich erwartet</p>
                <p className="mt-1.5">
                  Du öffnest die normale MyCrewMate-App mit vollständig fiktiven Beispieldaten. Du darfst dich frei umsehen und Dinge ausprobieren. Beim Verlassen wird alles wieder zurückgesetzt.
                </p>
              </div>

              {showTestIdeas && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                  <p className="font-bold text-blue-950">Das kannst du in dieser Demo ausprobieren</p>
                  <ul className="mt-2.5 space-y-2 text-blue-950">
                    {item.guideHighlights.map(highlight => (
                      <li key={highlight} className="flex gap-2">
                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-blue-700" aria-hidden="true" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-col sm:items-stretch sm:space-x-0">
              <p className="w-full text-center text-xs leading-5 text-slate-600">
                Mit dem Klemmi-Rundgang öffnet sich nach dem Laden zuerst eine große Einführung. Dort startest du die Stimme bewusst selbst.
              </p>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  className="min-h-11 bg-blue-700 text-white hover:bg-blue-800"
                  onClick={() => start(true)}
                  disabled={startDemo.isPending}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {startDemo.isPending ? "Demo wird vorbereitet …" : "Mit Klemmi-Rundgang starten"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  onClick={() => start(false)}
                  disabled={startDemo.isPending}
                >
                  <PlayCircle className="size-4" aria-hidden="true" />
                  Ohne Erklärung selbst ausprobieren
                </Button>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-700 hover:bg-slate-100"
                  onClick={() => setShowTestIdeas(current => !current)}
                  disabled={startDemo.isPending}
                >
                  {showTestIdeas ? "Testideen ausblenden" : "Was kann ich hier testen?"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:bg-slate-100"
                  onClick={close}
                  disabled={startDemo.isPending}
                >
                  <X className="size-4" aria-hidden="true" />
                  Noch nicht öffnen
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ClubDemoLanding() {
  const [selectedDemo, setSelectedDemo] = useState<DemoPackage | null>(null);

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <PublicReachPageView metric="club_demo_page_view" />
      <DemoStartDialog item={selectedDemo} onOpenChange={open => !open && setSelectedDemo(null)} />
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
              Wähle eine bereits gefüllte Musterumgebung. Vor dem Öffnen erklären wir dir in wenigen Sätzen, welches Beispiel zu eurem Anlass passt und was du dort ausprobieren kannst.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Das ist eine Übungsdemo, kein Testzugang für euren eigenen Verein. Alle Personen, Vereine, Kontakte und Strecken sind erfunden. Deine Eingaben liegen nur in einem eigenen, temporären Demo-Bereich und werden beim Verlassen der Demo sowie spätestens innerhalb von rund 45 Minuten gelöscht. Technische Sicherungskopien rotieren nach höchstens sieben täglichen Wiederherstellungspunkten und werden nie genutzt, um eine Vereinsdemo erneut zu öffnen.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <KlemmiMascot className="size-16 shrink-0" imageClassName="object-contain" decorative />
            <p className="text-sm leading-5 text-orange-950">
              <strong>Hallo, ich bin Klemmi.</strong>
              <br />Wähle „Mit Klemmi-Rundgang starten“. Nach dem Laden siehst du zuerst eine große Einführung und entscheidest bewusst, ob ich mit Ton loslegen soll.
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
              <Button type="button" className="rounded-xl bg-orange-700 text-white hover:bg-orange-800">
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
                <p className="mt-3 text-sm font-semibold leading-6 opacity-90">{item.purpose}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{item.description}</p>
                <ul className="mt-5 space-y-2 text-sm font-semibold">
                  {item.stats.map(stat => (
                    <li key={stat} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      {stat}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Button
                    type="button"
                    className="w-full rounded-xl bg-slate-950 text-white hover:bg-blue-700"
                    onClick={() => setSelectedDemo(item)}
                  >
                    {item.name} auswählen
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                  <p className="mt-2 text-center text-xs font-medium opacity-75">Erst kurz orientieren, dann die Demo öffnen.</p>
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
          <p>Die Vereinsdemo enthält ausschließlich fiktive Musterdaten. Temporäre Demo-Eingaben werden beim Verlassen, spätestens innerhalb von rund 45 Minuten, automatisch entfernt. Technische Sicherungskopien rotieren höchstens sieben Tage und reaktivieren keine Demo.</p>
          <div className="flex shrink-0 gap-4 font-semibold"><a className="hover:text-blue-700" href="/impressum">Impressum</a><a className="hover:text-blue-700" href="/datenschutz">Datenschutz</a></div>
        </div>
      </footer>
    </main>
  );
}
