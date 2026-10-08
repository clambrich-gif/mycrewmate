import { KlemmiMascot } from "@/components/KlemmiMascot";
import { Button } from "@/components/ui/button";
import {
  Bike,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  Flag,
  LayoutDashboard,
  Map,
  MapPin,
  PackageCheck,
  Plus,
  RotateCcw,
  Route,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

type DemoMode = "event" | "light" | "pro" | "ultimate";
type DemoArea = "dashboard" | "helpers" | "plan" | "map";

type DemoPackage = {
  id: DemoMode;
  name: string;
  label: string;
  description: string;
  eventName?: string;
  period?: string;
  helperCount?: number;
  plannerCount?: number;
  dayCount?: string;
  openSlots?: number;
  accent: string;
};

type DemoHelper = {
  id: string;
  name: string;
  status: "Eingeplant" | "Verfügbar" | "Rückmeldung offen" | "Neu angelegt";
  area: string;
};

type DemoSlot = {
  id: string;
  title: string;
  when: string;
  where: string;
  assignedTo: string;
};

const DEMO_PACKAGES: DemoPackage[] = [
  {
    id: "event",
    name: "Event Pass",
    label: "Ein einzelnes Fest ausprobieren",
    description:
      "Ein kompakter Veranstaltungstag mit 30 fiktiven Helfern, Schichten und einer übersichtlichen To-do-Liste.",
    eventName: "Sommerfest am Sportplatz",
    period: "Samstag, 14. Juni 2027",
    helperCount: 30,
    plannerCount: 1,
    dayCount: "1 Tag",
    openSlots: 3,
    accent: "border-orange-300 bg-orange-50 text-orange-900",
  },
  {
    id: "light",
    name: "Light",
    label: "Ein wiederkehrendes Vereinswochenende",
    description:
      "Ein Muster-Event über zwei Tage mit 50 fiktiven Helfern und fünf Ansprechpartnern im Planungsteam.",
    eventName: "Frühlingscup des TSV Hohenfels",
    period: "17.–18. April 2027",
    helperCount: 50,
    plannerCount: 5,
    dayCount: "2 Tage",
    openSlots: 5,
    accent: "border-sky-300 bg-sky-50 text-sky-950",
  },
  {
    id: "pro",
    name: "Pro",
    label: "Ein großes Radsportfestival erleben",
    description:
      "Ein dreitägiges, fiktives Radsportfestival: 150 Helfer, zehn Ansprechpartner, Standorte, Material und GPX-Strecken.",
    eventName: "EifelRide Radsportfestival 2027",
    period: "3.–5. September 2027",
    helperCount: 150,
    plannerCount: 10,
    dayCount: "3 Tage",
    openSlots: 12,
    accent: "border-blue-400 bg-blue-50 text-blue-950",
  },
  {
    id: "ultimate",
    name: "Ultimate",
    label: "Die Verbandslösung verstehen",
    description:
      "Eine Erläuterung für große Vereine, Verbände und Organisationen mit mehreren selbstständig planenden Untervereinen.",
    accent: "border-violet-300 bg-violet-50 text-violet-950",
  },
];

const FIRST_NAMES = [
  "Anna",
  "Ben",
  "Clara",
  "David",
  "Elena",
  "Finn",
  "Greta",
  "Hannes",
  "Ina",
  "Jonas",
  "Klara",
  "Lukas",
  "Mara",
  "Noah",
  "Olivia",
  "Paul",
  "Romy",
  "Simon",
  "Tanja",
  "Uwe",
];

const LAST_NAMES = [
  "Becker",
  "Hoffmann",
  "Klein",
  "Müller",
  "Neumann",
  "Richter",
  "Schneider",
  "Vogt",
  "Weber",
  "Zimmermann",
];

function createHelpers(count: number, mode: DemoMode): DemoHelper[] {
  const areaByMode =
    mode === "pro"
      ? ["Start/Ziel", "Strecke Nord", "Verpflegung", "Expo", "Fahrerlager"]
      : mode === "light"
        ? ["Aufbau", "Turnierleitung", "Catering", "Einlass"]
        : ["Aufbau", "Ausschank", "Kasse", "Abbau"];
  const states: DemoHelper["status"][] = [
    "Eingeplant",
    "Verfügbar",
    "Rückmeldung offen",
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `demo-helper-${mode}-${index + 1}`,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}`,
    status: states[index % states.length],
    area: areaByMode[index % areaByMode.length],
  }));
}

function createSlots(mode: DemoMode): DemoSlot[] {
  if (mode === "pro") {
    return [
      { id: "pro-1", title: "Startnummernausgabe", when: "Freitag · 15:00–19:00", where: "Festivalzentrale", assignedTo: "Anna Becker" },
      { id: "pro-2", title: "Streckenposten Runde Nord", when: "Samstag · 07:30–12:30", where: "Kreuzung K 49", assignedTo: "Ben Hoffmann" },
      { id: "pro-3", title: "Verpflegungspunkt 2", when: "Samstag · 08:00–14:00", where: "Bergstation", assignedTo: "Clara Klein" },
      { id: "pro-4", title: "Kinderparcours", when: "Samstag · 10:00–16:00", where: "Expo-Platz", assignedTo: "" },
      { id: "pro-5", title: "Gravel-Start", when: "Sonntag · 08:30–11:30", where: "Start/Ziel", assignedTo: "Elena Neumann" },
      { id: "pro-6", title: "Rückgabe & Abbau", when: "Sonntag · 16:00–19:00", where: "Materiallager", assignedTo: "" },
    ];
  }

  if (mode === "light") {
    return [
      { id: "light-1", title: "Aufbau Sportplatz", when: "Freitag · 17:00–20:00", where: "Sportplatz", assignedTo: "Anna Becker" },
      { id: "light-2", title: "Turnierleitung", when: "Samstag · 08:00–14:00", where: "Hauptfeld", assignedTo: "Ben Hoffmann" },
      { id: "light-3", title: "Catering Vormittag", when: "Samstag · 09:00–13:00", where: "Vereinsheim", assignedTo: "" },
      { id: "light-4", title: "Einlass Sonntag", when: "Sonntag · 09:00–13:00", where: "Haupteingang", assignedTo: "David Müller" },
      { id: "light-5", title: "Abbau", when: "Sonntag · 16:00–18:30", where: "Sportplatz", assignedTo: "" },
    ];
  }

  return [
    { id: "event-1", title: "Aufbau Pavillons", when: "Samstag · 08:00–10:00", where: "Sportplatz", assignedTo: "Anna Becker" },
    { id: "event-2", title: "Kasse", when: "Samstag · 11:00–17:00", where: "Eingang", assignedTo: "" },
    { id: "event-3", title: "Ausschank", when: "Samstag · 12:00–18:00", where: "Getränkewagen", assignedTo: "Clara Klein" },
    { id: "event-4", title: "Abbau", when: "Samstag · 18:00–20:00", where: "Sportplatz", assignedTo: "" },
  ];
}

function statusClass(status: DemoHelper["status"]) {
  if (status === "Eingeplant") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "Verfügbar") return "bg-blue-50 text-blue-800 ring-blue-200";
  if (status === "Neu angelegt") return "bg-orange-50 text-orange-800 ring-orange-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function getInitialDemoMode(): DemoMode {
  if (typeof window === "undefined") return "event";
  const mode = new URLSearchParams(window.location.search).get("demo");
  return mode === "light" || mode === "pro" || mode === "ultimate" ? mode : "event";
}

function getInitialDemoArea(mode: DemoMode): DemoArea {
  if (typeof window === "undefined" || mode === "ultimate") return "dashboard";
  const area = new URLSearchParams(window.location.search).get("bereich");
  if (area === "helpers" || area === "plan") return area;
  if (area === "map" && mode === "pro") return "map";
  return "dashboard";
}

function MetricCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "orange" | "emerald" | "slate";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <strong className="text-3xl font-black tracking-tight text-slate-950">{value}</strong>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{detail}</span>
      </div>
    </article>
  );
}

function DemoMap({ selectedRoute, onSelectRoute }: { selectedRoute: string; onSelectRoute: (route: string) => void }) {
  const routes = [
    { id: "Marathon 125 km", color: "#f97316", length: "125 km · 2.050 hm" },
    { id: "RTF 75 km", color: "#2563eb", length: "75 km · 980 hm" },
    { id: "Gravel 58 km", color: "#059669", length: "58 km · 1.180 hm" },
  ];
  const current = routes.find(route => route.id === selectedRoute) ?? routes[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#dfead8] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-emerald-900/10 bg-white/80 px-4 py-3 backdrop-blur-sm">
          <div>
            <p className="text-sm font-black text-slate-950">Karte & GPX-Strecken</p>
            <p className="text-xs text-slate-600">Fiktive Kartendarstellung für die Pro-Demo</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">3 GPX-Dateien</span>
        </div>
        <div className="relative h-[26rem] overflow-hidden bg-[#dce8d4]">
          <div className="absolute inset-0 opacity-65" style={{ backgroundImage: "radial-gradient(#87a77e 1px, transparent 1px), linear-gradient(128deg, transparent 45%, rgba(255,255,255,.72) 46%, rgba(255,255,255,.72) 48%, transparent 49%), linear-gradient(30deg, transparent 61%, rgba(255,255,255,.58) 62%, rgba(255,255,255,.58) 64%, transparent 65%)", backgroundSize: "18px 18px, 100% 100%, 100% 100%" }} />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 420" aria-label="Fiktive Streckenkarte des EifelRide Radsportfestivals" role="img">
            <path d="M95 306 C158 235 115 160 238 126 S398 94 418 185 S569 258 675 175 S723 64 606 82" fill="none" stroke="#f97316" strokeWidth="9" strokeLinecap="round" opacity={selectedRoute === "Marathon 125 km" ? 1 : 0.25} />
            <path d="M94 306 C188 294 214 225 312 231 S420 298 522 267 S636 235 676 175" fill="none" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" opacity={selectedRoute === "RTF 75 km" ? 1 : 0.25} />
            <path d="M95 306 C182 353 274 337 333 290 S424 193 485 191 S560 135 606 82" fill="none" stroke="#059669" strokeWidth="8" strokeLinecap="round" opacity={selectedRoute === "Gravel 58 km" ? 1 : 0.25} />
          </svg>
          {[
            { label: "Start/Ziel", left: "12%", top: "69%", kind: "H" },
            { label: "VP 1", left: "37%", top: "48%", kind: "V" },
            { label: "VP 2", left: "65%", top: "50%", kind: "V" },
            { label: "Expo", left: "74%", top: "18%", kind: "E" },
            { label: "Material", left: "57%", top: "75%", kind: "M" },
          ].map(marker => (
            <div key={marker.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: marker.left, top: marker.top }}>
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-slate-950 text-[10px] font-black text-white shadow-lg">{marker.kind}</span>
              <span className="mt-1 block whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 shadow-sm">{marker.label}</span>
            </div>
          ))}
          <div className="absolute bottom-4 left-4 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
            Aktive Strecke: <span style={{ color: current.color }} className="font-black">{current.id}</span>
          </div>
        </div>
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-950">Hochgeladene GPX-Strecken</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Klicke auf eine Route, um sie in der fiktiven Karte hervorzuheben.</p>
        <div className="mt-4 space-y-2">
          {routes.map(route => (
            <button key={route.id} type="button" onClick={() => onSelectRoute(route.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedRoute === route.id ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50"}`}>
              <span className="flex items-center gap-2 text-sm font-black"><Route className="size-4" style={{ color: selectedRoute === route.id ? "#fdba74" : route.color }} />{route.id}</span>
              <span className={`mt-1 block text-xs ${selectedRoute === route.id ? "text-slate-300" : "text-slate-500"}`}>{route.length}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <strong className="text-slate-900">6 Standorte</strong> sind als Start/Ziel, Verpflegung, Expo, Material oder Sicherheit hinterlegt.
        </div>
      </aside>
    </div>
  );
}

function UltimateOverview() {
  return (
    <section className="rounded-3xl border border-violet-200 bg-white p-5 shadow-[0_18px_45px_-32px_rgba(76,29,149,0.42)] sm:p-8">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Ultimate · für Verbände und große Vereine</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Mehrere Vereine. Eigene Planungen. Ein gemeinsamer Rahmen.</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">Ultimate ist keine größere Helferliste. Es ist die Lösung, wenn ein Verband, ein Dachverein oder ein großer Mehrspartenverein mehrere selbstständig planende Einheiten sauber zusammenbringen möchte.</p>
        </div>
        <div className="rounded-2xl bg-violet-50 p-5">
          <p className="text-sm font-black text-violet-950">Was bleibt getrennt?</p>
          <p className="mt-2 text-sm leading-6 text-violet-900">Jeder Unterverein plant seine Events, Helfer und internen Zuständigkeiten eigenständig.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Mehrere Bereiche", "Vier Untervereine oder Sparten arbeiten mit eigenen Daten, Teams und Veranstaltungen – ohne Einblick in fremde Planungen."],
          ["Gemeinsame Leitplanken", "Verbandstermine, Vorlagen, Standards und abgestimmte Informationen sind zentral erreichbar, wenn sie geteilt werden sollen."],
          ["Passende Einführung", "Felder, Rechte, PDF-Vorlagen und Prozesse werden auf die Organisation abgestimmt statt umgekehrt."],
        ].map(([title, text]) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
      <div className="mt-7 rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
        <p className="text-sm font-black text-violet-950">Beispiel: Radsportverband Mittelrhein</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["RC Ahrtal", "RSV Hunsrück", "RV Mosel", "Jugend-Radsport"].map((club, index) => (
            <div key={club} className="rounded-xl border border-white bg-white p-3 text-sm font-bold text-slate-800 shadow-sm">
              <span className="mb-2 inline-flex size-6 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-800">{index + 1}</span>
              <p>{club}</p>
              <p className="mt-1 text-xs font-normal text-slate-500">eigene Planung · eigener Zugang</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ClubDemoLanding() {
  const [activeMode, setActiveMode] = useState<DemoMode>(() => getInitialDemoMode());
  const [activeArea, setActiveArea] = useState<DemoArea>(() => getInitialDemoArea(getInitialDemoMode()));
  const [helpers, setHelpers] = useState<DemoHelper[]>(() => {
    const mode = getInitialDemoMode();
    const product = DEMO_PACKAGES.find(item => item.id === mode);
    return createHelpers(product?.helperCount ?? 0, mode);
  });
  const [slots, setSlots] = useState<DemoSlot[]>(() => createSlots(getInitialDemoMode()));
  const [newHelperName, setNewHelperName] = useState("");
  const [notice, setNotice] = useState("Willkommen in der Testumgebung. Hier ist alles fiktiv.");
  const [selectedRoute, setSelectedRoute] = useState("Marathon 125 km");

  const activePackage = DEMO_PACKAGES.find(item => item.id === activeMode) ?? DEMO_PACKAGES[0];
  const isUltimate = activeMode === "ultimate";
  const openSlots = slots.filter(slot => !slot.assignedTo).length;
  const assignedHelpers = helpers.filter(helper => helper.status === "Eingeplant").length;

  const loadDemo = (mode: DemoMode, message?: string) => {
    setActiveMode(mode);
    setActiveArea("dashboard");
    setNewHelperName("");
    setSelectedRoute("Marathon 125 km");
    if (mode !== "ultimate") {
      const product = DEMO_PACKAGES.find(item => item.id === mode)!;
      setHelpers(createHelpers(product.helperCount ?? 0, mode));
      setSlots(createSlots(mode));
    }
    setNotice(message ?? `${DEMO_PACKAGES.find(item => item.id === mode)?.name}-Demo geladen. Alle Beispiele sind fiktiv.`);
  };

  const resetDemo = () => loadDemo(activeMode, "Die Testdaten wurden zurückgesetzt.");

  const addHelper = () => {
    const name = newHelperName.trim();
    if (!name) {
      setNotice("Bitte gib einen Namen für den fiktiven Testhelfer ein.");
      return;
    }
    setHelpers(current => [
      { id: `test-helper-${Date.now()}`, name, status: "Neu angelegt", area: "Noch nicht zugeordnet" },
      ...current,
    ]);
    setNewHelperName("");
    setNotice(`${name} wurde nur für diese Demo angelegt und wird nicht gespeichert.`);
  };

  const assignSlot = (slotId: string, assignedTo: string) => {
    setSlots(current => current.map(slot => (slot.id === slotId ? { ...slot, assignedTo } : slot)));
    setNotice(assignedTo ? `${assignedTo} wurde in der Demo eingeteilt.` : "Die Schicht ist in der Demo wieder offen.");
  };

  const navigation = [
    { id: "dashboard" as const, label: "Übersicht", icon: LayoutDashboard, enabled: true },
    { id: "helpers" as const, label: "Helfer", icon: UsersRound, enabled: true },
    { id: "plan" as const, label: "Einsatzplan", icon: ClipboardList, enabled: true },
    { id: "map" as const, label: "Karte & GPX", icon: Map, enabled: activeMode === "pro" },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0" aria-label="MyCrewMate – zur Startseite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-7 w-auto sm:h-8" />
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Vereinsdemo · nur fiktive Daten
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center lg:px-8 lg:py-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">MyCrewMate Vereinsdemo</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Einfach ausprobieren. Nichts kaputtmachen.</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">Wähle eine fiktive Musterumgebung und probiere Dashboard, Helfer und Einsatzplan selbst aus. Was du hier änderst, bleibt nur in diesem Browser und wird beim Verlassen der Seite zurückgesetzt.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <KlemmiMascot className="size-16 shrink-0" imageClassName="object-contain" decorative />
            <p className="text-sm leading-5 text-orange-950"><strong>Hallo, ich bin Klemmi.</strong><br />Ich begleite dich durch die fiktiven Beispiele.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Demo auswählen">
          {DEMO_PACKAGES.map(item => {
            const selected = item.id === activeMode;
            return (
              <button key={item.id} type="button" onClick={() => loadDemo(item.id)} className={`rounded-2xl border p-4 text-left transition duration-200 ${selected ? `${item.accent} shadow-md ring-1 ring-current/10` : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-black">{item.name}</span>
                  {selected && <span className="flex size-5 items-center justify-center rounded-full bg-current/10"><Check className="size-3.5" /></span>}
                </div>
                <p className="mt-2 text-sm font-semibold leading-5">{item.label}</p>
                <p className="mt-2 text-xs leading-5 opacity-75">{item.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {isUltimate ? (
          <UltimateOverview />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_54px_-38px_rgba(15,23,42,0.38)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {activeMode === "pro" ? <img src={WORDMARK} alt="Fiktives Veranstaltungslogo" className="h-7 w-auto rounded bg-white px-1.5 py-1 shadow-sm" /> : <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><CalendarDays className="size-5" /></span>}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{activePackage.eventName}</p>
                  <p className="text-xs text-slate-500">{activePackage.period} · {activePackage.dayCount} · {activePackage.plannerCount} Ansprechpartner</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">Fiktive Daten</span>
                <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white text-slate-700" onClick={resetDemo}><RotateCcw className="size-3.5" /> Demo zurücksetzen</Button>
              </div>
            </div>

            <div className="grid min-h-[36rem] lg:grid-cols-[13.5rem_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
                <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Bereiche der fiktiven Demo">
                  {navigation.map(item => {
                    const Icon = item.icon;
                    const selected = activeArea === item.id;
                    return (
                      <button key={item.id} type="button" disabled={!item.enabled} onClick={() => setActiveArea(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${selected ? "bg-slate-950 text-white shadow-sm" : item.enabled ? "text-slate-700 hover:bg-white hover:text-blue-700" : "cursor-not-allowed text-slate-400"}`}>
                        <Icon className="size-4" /> {item.label}{!item.enabled && <span className="ml-auto text-[10px] font-bold">Pro</span>}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-5 hidden rounded-2xl border border-orange-200 bg-orange-50 p-3 lg:block">
                  <div className="flex gap-2">
                    <KlemmiMascot className="size-12 shrink-0" decorative />
                    <p className="pt-1 text-xs leading-5 text-orange-950"><strong>Klemmi-Hinweis:</strong><br />{openSlots > 0 ? `${openSlots} Schichten sind noch offen.` : "Alle sichtbaren Schichten sind besetzt."}</p>
                  </div>
                </div>
              </aside>

              <div className="min-w-0 p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 sm:flex-row sm:items-center">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><ShieldCheck className="size-3.5" /></span>
                  <span>{notice}</span>
                </div>

                {activeArea === "dashboard" && (
                  <section>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Übersicht</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Was heute wichtig ist.</h2>
                      </div>
                      <p className="text-sm text-slate-500">Beispielansicht für {activePackage.name}</p>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Helfer" value={helpers.length} detail="fiktiv" tone="blue" />
                      <MetricCard label="Eingeplant" value={assignedHelpers} detail="sichtbar" tone="emerald" />
                      <MetricCard label="Offene Schichten" value={openSlots} detail={openSlots ? "prüfen" : "bereit"} tone="orange" />
                      <MetricCard label="Planungsteam" value={activePackage.plannerCount ?? 0} detail="Ansprechpartner" tone="slate" />
                    </div>
                    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">Nächste wichtige Punkte</p>
                            <p className="mt-1 text-xs text-slate-500">Fiktive Aufgaben aus der Musterveranstaltung</p>
                          </div>
                          <ClipboardList className="size-5 text-blue-700" />
                        </div>
                        <div className="mt-4 space-y-3">
                          {[
                            ["Helfer für offene Schichten anfragen", openSlots ? "heute" : "erledigt", openSlots ? "orange" : "emerald"],
                            [activeMode === "pro" ? "Streckenposten Nord bestätigen" : "Materialliste prüfen", "diese Woche", "blue"],
                            [activeMode === "pro" ? "Sanitätskonzept mit Standortplan abgleichen" : "Ablauf mit Team abstimmen", "in 8 Tagen", "slate"],
                          ].map(([title, due, tone]) => (
                            <div key={title} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                              <span className="text-sm font-semibold text-slate-800">{title}</span>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${tone === "orange" ? "bg-orange-100 text-orange-800" : tone === "emerald" ? "bg-emerald-100 text-emerald-800" : tone === "blue" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"}`}>{due}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                      <article className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <KlemmiMascot className="size-16 shrink-0" decorative />
                          <div>
                            <p className="text-sm font-black text-slate-950">Klemmi zeigt dir den nächsten Schritt</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{openSlots > 0 ? "Öffne den Einsatzplan und teile testweise einen Helfer ein. Alles bleibt nur in dieser Demo." : "Sehr gut: Die sichtbaren Schichten sind besetzt. Prüfe als Nächstes die Helferliste."}</p>
                            <Button type="button" size="sm" className="mt-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => setActiveArea(openSlots > 0 ? "plan" : "helpers")}>{openSlots > 0 ? "Einsatzplan öffnen" : "Helfer ansehen"}</Button>
                          </div>
                        </div>
                      </article>
                    </div>
                    {activeMode === "pro" && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-950"><span className="font-black">Pro-Muster:</span> Drei Veranstaltungstage, 6 Standorte, 3 GPX-Strecken, Materiallogistik und zehn Ansprechpartner laufen im selben fiktiven Festivalplan zusammen.</div>}
                  </section>
                )}

                {activeArea === "helpers" && (
                  <section>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Helfer</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Fiktive Helferliste ausprobieren.</h2>
                        <p className="mt-2 text-sm text-slate-600">Lege einen Testhelfer an – die Eingabe wird nirgends gespeichert.</p>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <input value={newHelperName} onChange={event => setNewHelperName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addHelper(); }} placeholder="z. B. Alex Beispiel" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-48" aria-label="Name des fiktiven Testhelfers" />
                        <Button type="button" onClick={addHelper} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Plus className="size-4" /> Hinzufügen</Button>
                      </div>
                    </div>
                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="grid grid-cols-[minmax(9rem,1fr)_8.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500 sm:grid-cols-[minmax(10rem,1fr)_9rem_9rem]">
                        <span>Name</span><span className="hidden sm:block">Bereich</span><span>Status</span>
                      </div>
                      {helpers.slice(0, 12).map(helper => (
                        <div key={helper.id} className="grid grid-cols-[minmax(9rem,1fr)_8.5rem] gap-3 border-b border-slate-100 px-4 py-3 text-sm sm:grid-cols-[minmax(10rem,1fr)_9rem_9rem]">
                          <span className="font-bold text-slate-800">{helper.name}</span>
                          <span className="hidden truncate text-slate-500 sm:block">{helper.area}</span>
                          <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ring-1 ${statusClass(helper.status)}`}>{helper.status}</span>
                        </div>
                      ))}
                      {helpers.length > 12 && <div className="px-4 py-3 text-sm text-slate-500">… und {helpers.length - 12} weitere fiktive Helfer in dieser Musterliste.</div>}
                    </div>
                  </section>
                )}

                {activeArea === "plan" && (
                  <section>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Einsatzplan</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Schichten testweise ändern.</h2>
                        <p className="mt-2 text-sm text-slate-600">Wähle einen Namen aus. Die Änderung gilt nur, solange diese Seite geöffnet ist.</p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1.5 text-sm font-bold ${openSlots ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>{openSlots ? `${openSlots} offen` : "Alle sichtbar besetzt"}</span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {slots.map(slot => (
                        <article key={slot.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h3 className="text-base font-black text-slate-950">{slot.title}</h3>
                              {!slot.assignedTo && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">offen</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{slot.when}</span><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{slot.where}</span></div>
                          </div>
                          <label className="sr-only" htmlFor={`slot-${slot.id}`}>Helfer für {slot.title}</label>
                          <select id={`slot-${slot.id}`} value={slot.assignedTo} onChange={event => assignSlot(slot.id, event.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${slot.assignedTo ? "border-slate-300 bg-white text-slate-800" : "border-orange-300 bg-orange-50 text-orange-900"}`}>
                            <option value="">Noch offen</option>
                            {helpers.slice(0, 40).map(helper => <option key={helper.id} value={helper.name}>{helper.name}</option>)}
                          </select>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {activeArea === "map" && <DemoMap selectedRoute={selectedRoute} onSelectRoute={setSelectedRoute} />}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p><strong className="text-slate-700">Hinweis:</strong> Diese Vereinsdemo nutzt ausschließlich fiktive Vereins-, Helfer-, Standort- und Streckendaten. Änderungen werden nicht gespeichert.</p>
          <div className="flex shrink-0 gap-4 font-semibold"><a className="hover:text-blue-700" href="/impressum">Impressum</a><a className="hover:text-blue-700" href="/datenschutz">Datenschutz</a></div>
        </div>
      </footer>
    </main>
  );
}
