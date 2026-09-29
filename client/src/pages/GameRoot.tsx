import React, { useEffect, useRef, useState } from "react";
import "../game/festival-scene.css";
import {
  AlertTriangle,
  ArrowRight,
  Beer,
  Bike,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  ExternalLink,
  Heart,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Tent,
  Trophy,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import { FestivalScene } from "@/components/FestivalScene";
import {
  GAME_SCENARIOS,
  type EventCrisis,
  type GameScenarioId,
  type HelperCard,
  type ShiftSlot,
} from "@/game/gameData";
import {
  SCHUETZENFEST_CRISES,
  SCHUETZENFEST_HELPERS,
  SCHUETZENFEST_SHIFTS,
} from "@/game/questData";

const FESTIVAL_BACKGROUND = "/api/game/festival-scene";
const FESTIVAL_MUSIC = "/api/game/festival-music";

type GamePhase = "scenario_select" | "story_intro" | "puzzle" | "event_day" | "report";

function clockHour(value: string) {
  return Number(value.split(":")[0]);
}

function isTimeCompatible(helper: HelperCard, shift: ShiftSlot) {
  const [start, end] = shift.timeWindow.split("–").map((item) => clockHour(item.trim()));
  return clockHour(helper.availableFrom) <= start && clockHour(helper.availableTo) >= end;
}

export default function GameRoot() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<GameScenarioId>("schuetzenfest");
  const [phase, setPhase] = useState<GamePhase>("scenario_select");
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [helpers, setHelpers] = useState<HelperCard[]>(SCHUETZENFEST_HELPERS);
  const [shifts, setShifts] = useState<ShiftSlot[]>(SCHUETZENFEST_SHIFTS);
  const [stressLevel, setStressLevel] = useState(25);
  const [satisfactionLevel, setSatisfactionLevel] = useState(70);
  const [budget, setBudget] = useState(2500);
  const [currentCrisisIndex, setCurrentCrisisIndex] = useState(0);
  const [crisisDecisions, setCrisisDecisions] = useState<string[]>([]);
  const [klemmiMessage, setKlemmiMessage] = useState(
    "Hallo! Ich bin Klemmi. Such dir eine Quest aus – dann bauen wir gemeinsam aus einem leeren Platz ein richtig gutes Fest."
  );
  const [klemmiSpeaking, setKlemmiSpeaking] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = GAME_SCENARIOS[selectedScenarioId];
  const selectedHelper = helpers.find((helper) => helper.id === selectedHelperId);
  const isPuzzleComplete = shifts.every((shift) => shift.assignedHelperIds.length >= shift.requiredHelpers);
  const availableHelpers = helpers.filter((helper) => !helper.assignedShiftId);

  useEffect(() => () => {
    if (speechTimer.current) clearTimeout(speechTimer.current);
  }, []);

  const say = (message: string) => {
    setKlemmiMessage(message);
    setKlemmiSpeaking(true);
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setKlemmiSpeaking(false), 2600);
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
      say("Musikpause. Ich halte natürlich trotzdem die Augen auf dem Festplatz offen.");
      return;
    }
    try {
      audio.volume = 0.22;
      await audio.play();
      setMusicPlaying(true);
      say("So, die Festplatzmusik läuft ganz dezent. Jetzt kann die Geschichte losgehen!");
    } catch {
      say("Einmal auf den Musikknopf tippen – dann darf dein Browser die Festplatzmusik abspielen.");
    }
  };

  const startScenario = async () => {
    setSelectedScenarioId("schuetzenfest");
    setPhase("story_intro");
    say("Servus! Der Festplatz ist noch leer – aber nicht mehr lange. Ich zeige dir gleich, wie deine Helfer wirklich an ihre Stationen laufen.");
    if (!musicPlaying) await toggleMusic();
  };

  const resetGame = () => {
    setHelpers(SCHUETZENFEST_HELPERS);
    setShifts(SCHUETZENFEST_SHIFTS);
    setStressLevel(25);
    setSatisfactionLevel(70);
    setBudget(2500);
    setCurrentCrisisIndex(0);
    setCrisisDecisions([]);
    setSelectedHelperId(null);
    setPhase("scenario_select");
    say("Auf ein Neues! Such dir deine nächste Vereins-Quest aus.");
  };

  const assignHelper = (shiftId: string) => {
    const helper = helpers.find((item) => item.id === selectedHelperId);
    const shift = shifts.find((item) => item.id === shiftId);
    if (!helper || !shift) return;

    const validTime = isTimeCompatible(helper, shift);
    const matchingSkill = !shift.requiredSkill || helper.skills.includes(shift.requiredSkill);

    setShifts((previous) => previous.map((item) => ({
      ...item,
      assignedHelperIds: item.id === shiftId
        ? [...item.assignedHelperIds.filter((id) => id !== helper.id), helper.id]
        : item.assignedHelperIds.filter((id) => id !== helper.id),
    })));
    setHelpers((previous) => previous.map((item) => (
      item.id === helper.id ? { ...item, assignedShiftId: shiftId } : item
    )));
    setSelectedHelperId(null);

    if (!validTime) {
      setStressLevel((value) => Math.min(100, value + 12));
      say(`Moment mal: ${helper.name} kann nur von ${helper.availableFrom} bis ${helper.availableTo}. Für ${shift.title} wird das knapp – aber du kannst später noch umplanen.`);
    } else if (!matchingSkill) {
      setStressLevel((value) => Math.min(100, value + 5));
      say(`${helper.name} läuft zur Station ${shift.area}. Die Zeit passt, aber bei der Aufgabe braucht das Team eine gute Einweisung.`);
    } else {
      setSatisfactionLevel((value) => Math.min(100, value + 8));
      setStressLevel((value) => Math.max(0, value - 4));
      say(`Super! ${helper.name} läuft direkt zu ${shift.area}. Schau auf den Festplatz – jetzt ist die Station wirklich besetzt.`);
    }
  };

  const selectHelper = (helper: HelperCard) => {
    if (helper.assignedShiftId) {
      setSelectedHelperId(helper.id);
      say(`${helper.name} ist gerade bei ${shifts.find((shift) => shift.id === helper.assignedShiftId)?.area}. Du kannst die Figur auf einen anderen Stand umsetzen.`);
      return;
    }
    setSelectedHelperId(helper.id);
    say(`${helper.name} steht bereit. Klicke jetzt auf dem Festplatz auf den Stand, zu dem ${helper.name.split(" ")[0]} laufen soll.`);
  };

  const removeHelper = (helperId: string, shiftId: string) => {
    setShifts((previous) => previous.map((shift) => (
      shift.id === shiftId
        ? { ...shift, assignedHelperIds: shift.assignedHelperIds.filter((id) => id !== helperId) }
        : shift
    )));
    setHelpers((previous) => previous.map((helper) => (
      helper.id === helperId ? { ...helper, assignedShiftId: null } : helper
    )));
    setSelectedHelperId(null);
    say("Helfer wieder am Treffpunkt. Wähle die Figur an und gib ihr eine neue Aufgabe.");
  };

  const startEvent = () => {
    setPhase("event_day");
    say("Der Bürgermeister öffnet das Fest! Alles sieht gut aus … aber auf einem echten Fest kommt immer etwas dazwischen.");
  };

  const chooseCrisis = (optionIndex: number) => {
    const crisis = SCHUETZENFEST_CRISES[currentCrisisIndex];
    const option = crisis.options[optionIndex];
    setStressLevel((value) => Math.max(0, Math.min(100, value + option.impactStress)));
    setBudget((value) => value + option.impactBudget);
    setSatisfactionLevel((value) => Math.max(0, Math.min(100, value + option.impactSatisfaction)));
    setCrisisDecisions((previous) => [...previous, `${crisis.title}: ${option.label}`]);
    say(option.klemmiFeedback);

    if (currentCrisisIndex + 1 < SCHUETZENFEST_CRISES.length) {
      setCurrentCrisisIndex((value) => value + 1);
    } else {
      window.setTimeout(() => {
        setPhase("report");
        say("Geschafft! Der Regen ist durch, der Bierwagen läuft und du hast dein erstes Fest sicher ins Ziel gebracht.");
      }, 900);
    }
  };

  return (
    <div className="game-world game-world--light min-h-screen font-sans text-slate-900 selection:bg-orange-200">
      <audio ref={audioRef} src={FESTIVAL_MUSIC} loop preload="metadata" />

      <header className="game-header sticky top-0 z-40 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="game-header__mark"><Trophy className="size-5" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-lg font-black tracking-tight text-slate-900">CrewMate Tycoon</span>
                <span className="hidden rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 sm:inline">Game Edition</span>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">Dein interaktives Ehrenamt-Abenteuer</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {phase !== "scenario_select" && (
              <div className="hidden items-center gap-4 rounded-2xl border border-orange-100 bg-white/85 px-3 py-2 shadow-sm lg:flex">
                <Metric icon={<Heart className="size-3.5 text-rose-500" />} label="Team" value={`${satisfactionLevel}%`} />
                <Metric icon={<Zap className="size-3.5 text-amber-500" />} label="Stress" value={`${stressLevel}%`} />
                <Metric icon={<span className="text-xs">€</span>} label="Kasse" value={`${budget} €`} />
              </div>
            )}
            <button onClick={toggleMusic} className={`game-icon-button ${musicPlaying ? "game-icon-button--active" : ""}`} title={musicPlaying ? "Musik pausieren" : "Musik starten"}>
              {musicPlaying ? <Pause className="size-4" /> : <Music2 className="size-4" />}
            </button>
            <button onClick={resetGame} className="game-reset-button"><RotateCcw className="size-3.5" /><span className="hidden sm:inline">Neu starten</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 md:px-6 md:py-7">
        {phase === "scenario_select" && (
          <section className="game-select mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
            <div className="mx-auto mb-7 max-w-2xl text-center md:mb-10">
              <span className="game-eyebrow">Wähle deine Vereins-Quest</span>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Vom leeren Platz zum guten Fest.</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">Keine Tabellen-Simulation: Du siehst den Festplatz, gibst Helfern echte Aufgaben und meisterst, was am Eventtag passiert.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {(Object.keys(GAME_SCENARIOS) as GameScenarioId[]).map((id) => {
                const item = GAME_SCENARIOS[id];
                const playable = id === "schuetzenfest";
                const selected = selectedScenarioId === id;
                return (
                  <article key={id} onClick={() => setSelectedScenarioId(id)} className={`game-scenario-card ${selected ? "game-scenario-card--selected" : ""}`}>
                    <div className="mb-5 flex items-center justify-between"><span className="game-scenario-card__badge">{item.badge}</span><span className="text-xs font-bold text-orange-600">{item.difficulty}</span></div>
                    <div className="game-scenario-card__icon">{id === "schuetzenfest" ? <Beer /> : id === "kirmes" ? <Tent /> : <Bike />}</div>
                    <h2>{item.title}</h2><p className="game-scenario-card__subtitle">{item.subtitle}</p><p className="game-scenario-card__tagline">{item.tagline}</p>
                    <ul>{item.featuresHighlight.map((feature) => <li key={feature}><CheckCircle2 className="size-3.5" />{feature}</li>)}</ul>
                    <button onClick={(event) => { event.stopPropagation(); playable ? startScenario() : say(`Die Welt '${item.title}' wartet schon im Kampagnenplan. Heute erlebst du die erste komplette Quest auf dem Schützenfest.`); }} className={`game-scenario-card__button ${playable ? "game-scenario-card__button--play" : ""}`}>{playable ? <>Quest spielen <ArrowRight className="size-4" /></> : <>Spielwelt vormerken <ChevronRight className="size-4" /></>}</button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {phase === "story_intro" && (
          <section className="game-story-layout">
            <FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="story_intro" klemmiMessage={klemmiMessage} klemmiSpeaking={klemmiSpeaking} backgroundUrl={FESTIVAL_BACKGROUND} />
            <div className="game-story-panel">
              <span className="game-eyebrow">Prolog · Schützenfest im Grünen</span>
              <h1>Alles vorbereitet? Nicht ganz.</h1>
              {scenario.storyIntro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <div className="game-mission"><AlertTriangle className="size-5" /><div><b>Deine Mission</b><span>Besetze alle vier Stationen. Auf dem Festplatz siehst du anschließend sofort, wohin jede Figur läuft.</span></div></div>
              <div className="flex flex-wrap gap-3"><button onClick={() => setPhase("puzzle")} className="game-primary-button">Festplatz planen <ArrowRight className="size-4" /></button><button onClick={() => setPhase("scenario_select")} className="game-secondary-button">Andere Quest</button></div>
            </div>
          </section>
        )}

        {phase === "puzzle" && (
          <section className="game-play-layout">
            <div className="game-play-layout__scene">
              <FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={selectedHelperId} onSelectStation={assignHelper} phase="puzzle" klemmiMessage={klemmiMessage} klemmiSpeaking={klemmiSpeaking} backgroundUrl={FESTIVAL_BACKGROUND} />
              <div className="game-scene-objective"><span>Level 1 · Helfer bewegen</span><b>{isPuzzleComplete ? "Alle Stationen sind bereit!" : `${shifts.reduce((total, shift) => total + shift.assignedHelperIds.length, 0)} von ${shifts.reduce((total, shift) => total + shift.requiredHelpers, 0)} Helfern unterwegs`}</b></div>
            </div>
            <aside className="game-board">
              <div className="game-board__header"><div><span className="game-eyebrow">Deine Aufgaben</span><h1>{selectedHelper ? "Station auswählen" : "Helfer auswählen"}</h1></div><span className="game-board__counter"><Users className="size-3.5" />{availableHelpers.length} frei</span></div>
              <p className="game-board__intro">{selectedHelper ? <><b>{selectedHelper.name}</b> wartet auf deine Anweisung. Klicke danach links direkt auf einen Stand.</> : "Wähle zuerst eine Figur. Danach wird sie sichtbar zum Festzelt, Bierwagen oder Kuchenstand geschickt."}</p>
              <div className="game-helper-list">
                {helpers.map((helper) => {
                  const active = helper.id === selectedHelperId;
                  const shift = shifts.find((item) => item.id === helper.assignedShiftId);
                  return <button key={helper.id} onClick={() => selectHelper(helper)} className={`game-helper-card ${active ? "game-helper-card--selected" : ""} ${helper.assignedShiftId ? "game-helper-card--assigned" : ""}`}>
                    <span className="game-helper-card__avatar">{helper.avatarIcon}</span><span className="min-w-0 flex-1 text-left"><b>{helper.name}</b><small>{helper.role} · {helper.availableFrom}–{helper.availableTo}</small>{shift && <em>→ {shift.area}</em>}</span><span className="game-helper-card__skills">{helper.skills.slice(0, 2).join(" · ")}</span>
                  </button>;
                })}
              </div>
              <div className="game-board__shifts">
                {shifts.map((shift) => <div key={shift.id} className={`game-board-shift ${shift.assignedHelperIds.length >= shift.requiredHelpers ? "game-board-shift--full" : ""}`}><span>{shift.area}</span><b>{shift.assignedHelperIds.length}/{shift.requiredHelpers}</b><div>{shift.assignedHelperIds.map((id) => { const helper = helpers.find((item) => item.id === id); return helper ? <button key={id} title={`${helper.name} wieder freigeben`} onClick={() => removeHelper(helper.id, shift.id)}>{helper.avatarIcon}</button> : null; })}</div></div>)}
              </div>
              <button disabled={!isPuzzleComplete} onClick={startEvent} className="game-start-event">{isPuzzleComplete ? <>Fest eröffnen <ArrowRight className="size-4" /></> : <>Noch {shifts.reduce((total, shift) => total + Math.max(0, shift.requiredHelpers - shift.assignedHelperIds.length), 0)} Plätze besetzen</>}</button>
            </aside>
          </section>
        )}

        {phase === "event_day" && (
          <section className="game-play-layout game-play-layout--event">
            <div className="game-play-layout__scene"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="event_day" rainActive={currentCrisisIndex === 1} klemmiMessage={klemmiMessage} klemmiSpeaking={klemmiSpeaking} backgroundUrl={FESTIVAL_BACKGROUND} /></div>
            <aside className="game-crisis-panel"><div className="game-crisis-panel__top"><span><Waves className="size-3.5" />Echtzeit-Ereignis {currentCrisisIndex + 1}/{SCHUETZENFEST_CRISES.length}</span><small>{currentCrisisIndex === 1 ? "16:10 Uhr · Regenfront" : "15:30 Uhr · Festbetrieb"}</small></div><div className="game-crisis-panel__title"><AlertTriangle className="size-6" /><h1>{SCHUETZENFEST_CRISES[currentCrisisIndex].title}</h1></div><p>{SCHUETZENFEST_CRISES[currentCrisisIndex].description}</p><div className="game-crisis-options">{SCHUETZENFEST_CRISES[currentCrisisIndex].options.map((option: EventCrisis["options"][number], index) => <button key={option.label} onClick={() => chooseCrisis(index)}><span>{index + 1}</span><div><b>{option.label}</b><small>{option.actionDescription}</small></div><ChevronRight className="size-4" /></button>)}</div></aside>
          </section>
        )}

        {phase === "report" && (
          <section className="game-report-layout"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="report" klemmiMessage={klemmiMessage} klemmiSpeaking={klemmiSpeaking} backgroundUrl={FESTIVAL_BACKGROUND} /><div className="game-report-card"><div className="game-report-card__trophy"><Trophy className="size-7" /></div><span className="game-eyebrow">Festival erfolgreich durchgeführt</span><h1>Dein Festplatz lebt.</h1><p>Du hast Helfer sichtbar an Stationen bewegt, zwei Ereignisse gelöst und das Schützenfest sicher ins Ziel gebracht.</p><div className="game-report-metrics"><Metric icon={<Heart className="size-4 text-rose-500" />} label="Team" value={`${satisfactionLevel}%`} /><Metric icon={<Zap className="size-4 text-amber-500" />} label="Stress" value={`${stressLevel}%`} /><Metric icon={<span>€</span>} label="Kasse" value={`${budget} €`} /></div><ul>{crisisDecisions.map((decision) => <li key={decision}><CheckCircle2 className="size-4" />{decision}</li>)}</ul><div className="flex flex-wrap justify-center gap-3"><a href="https://mycrewmate.de" className="game-primary-button">MyCrewMate kennenlernen <ExternalLink className="size-4" /></a><button onClick={resetGame} className="game-secondary-button">Nächste Quest wählen</button></div></div></section>
        )}
      </main>

      <footer className="game-footer"><span>© 2026 MyCrewMate · CrewMate Tycoon</span><span>Interaktives Training für Vereins- & Eventplanung</span></footer>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <span className="game-metric">{icon}<small>{label}</small><b>{value}</b></span>;
}
