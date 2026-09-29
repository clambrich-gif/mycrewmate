import React, { useEffect, useMemo, useRef, useState } from "react";
import "../game/festival-scene.css";
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Heart,
  Home,
  Music2,
  Package,
  Pause,
  Route,
  RotateCcw,
  Send,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { FestivalScene } from "@/components/FestivalScene";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import { GAME_SCENARIOS, type EventCrisis, type GameScenarioId, type HelperCard, type PlanningTask, type ShiftSlot } from "@/game/gameData";
import { RADSPORT_CRISES, RADSPORT_HELPERS, RADSPORT_PLANNING_TASKS, RADSPORT_SHIFTS } from "@/game/questData";

const FESTIVAL_MUSIC = "/api/game/festival-music";
type GamePhase = "scenario_select" | "story_intro" | "preparation" | "helper_outreach" | "puzzle" | "event_day" | "report";
type AdvisorLevel = "guide" | "success" | "warning";

const PHASES: Array<{ id: Exclude<GamePhase, "scenario_select" | "story_intro" | "report">; number: string; label: string }> = [
  { id: "preparation", number: "01", label: "Vorbereitung" },
  { id: "helper_outreach", number: "02", label: "Helferabfrage" },
  { id: "puzzle", number: "03", label: "Einsatzplan" },
  { id: "event_day", number: "04", label: "Veranstaltung" },
];

function clockHour(value: string) {
  return Number(value.split(":")[0]);
}

function isTimeCompatible(helper: HelperCard, shift: ShiftSlot) {
  const [start, end] = shift.timeWindow.split("–").map(item => clockHour(item.trim()));
  return clockHour(helper.availableFrom) <= start && clockHour(helper.availableTo) >= end;
}

export default function GameRoot() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<GameScenarioId>("radsport");
  const [phase, setPhase] = useState<GamePhase>("scenario_select");
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [outreachStarted, setOutreachStarted] = useState(false);
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [helpers, setHelpers] = useState<HelperCard[]>(RADSPORT_HELPERS);
  const [shifts, setShifts] = useState<ShiftSlot[]>(RADSPORT_SHIFTS);
  const [stressLevel, setStressLevel] = useState(18);
  const [satisfactionLevel, setSatisfactionLevel] = useState(72);
  const [budget, setBudget] = useState(18000);
  const [currentCrisisIndex, setCurrentCrisisIndex] = useState(0);
  const [crisisDecisions, setCrisisDecisions] = useState<string[]>([]);
  const [klemmiMessage, setKlemmiMessage] = useState("Hallo! Wir bauen heute keinen Notfallplan. Wir bauen eine Veranstaltung, die Monate vorher sicher vorbereitet ist.");
  const [klemmiSpeaking, setKlemmiSpeaking] = useState(true);
  const [advisorLevel, setAdvisorLevel] = useState<AdvisorLevel>("guide");
  const [advisorTarget, setAdvisorTarget] = useState<string>("Planungsweg");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = GAME_SCENARIOS[selectedScenarioId];
  const selectedHelper = helpers.find(helper => helper.id === selectedHelperId);
  const availableHelpers = helpers.filter(helper => !helper.assignedShiftId);
  const isPreparationComplete = RADSPORT_PLANNING_TASKS.every(task => completedTaskIds.includes(task.id));
  const isPuzzleComplete = shifts.every(shift => shift.assignedHelperIds.length >= shift.requiredHelpers);
  const assignedCount = shifts.reduce((sum, shift) => sum + shift.assignedHelperIds.length, 0);
  const requiredCount = shifts.reduce((sum, shift) => sum + shift.requiredHelpers, 0);
  const recommendedStationId = useMemo(() => {
    if (!selectedHelperId) return null;
    const helper = helpers.find(item => item.id === selectedHelperId);
    if (!helper) return null;
    return shifts.find(shift =>
      shift.assignedHelperIds.length < shift.requiredHelpers &&
      isTimeCompatible(helper, shift) &&
      (!shift.requiredSkill || helper.skills.includes(shift.requiredSkill))
    )?.id ?? null;
  }, [helpers, selectedHelperId, shifts]);

  useEffect(() => () => { if (speechTimer.current) clearTimeout(speechTimer.current); }, []);

  const say = (message: string, level: AdvisorLevel = "guide", target = "Planungsweg") => {
    setKlemmiMessage(message);
    setAdvisorLevel(level);
    setAdvisorTarget(target);
    setKlemmiSpeaking(true);
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setKlemmiSpeaking(false), 3600);
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
      say("Die Musik ist pausiert. Die Planung bleibt natürlich gespeichert.");
      return;
    }
    try {
      audio.volume = 0.12;
      await audio.play();
      setMusicPlaying(true);
      say("Eine dezente Runde Musik ist an. Jetzt schauen wir auf die Planung, nicht auf hektische Effekte.");
    } catch {
      say("Tippe noch einmal auf das Musik-Symbol. Manche Browser erlauben den Start erst nach einem zweiten Klick.");
    }
  };

  const startScenario = () => {
    setSelectedScenarioId("radsport");
    setPhase("story_intro");
    say("Sechs Monate bis zum Festival. Erst sichern wir Strecke, Orte und Material. Erst danach füllen wir den Einsatzplan.", "guide", "Sechs-Monate-Plan");
  };

  const resetGame = () => {
    setPhase("scenario_select");
    setCompletedTaskIds([]);
    setOutreachStarted(false);
    setSelectedHelperId(null);
    setHelpers(RADSPORT_HELPERS);
    setShifts(RADSPORT_SHIFTS);
    setStressLevel(18);
    setSatisfactionLevel(72);
    setBudget(18000);
    setCurrentCrisisIndex(0);
    setCrisisDecisions([]);
    say("Neustart. Die gleiche Veranstaltung – diesmal mit einem neuen Planungsweg.", "guide", "Neustart");
  };

  const completeTask = (task: PlanningTask) => {
    if (completedTaskIds.includes(task.id)) return;
    setCompletedTaskIds(previous => [...previous, task.id]);
    setStressLevel(value => Math.max(0, value - 3));
    setSatisfactionLevel(value => Math.min(100, value + 4));
    say(`${task.result}. Genau so entsteht Sicherheit: Eine klare Aufgabe, ein fester Termin und eine Person, die sie übernimmt.`, "success", task.title);
  };

  const startOutreach = () => {
    setOutreachStarted(true);
    setSatisfactionLevel(value => Math.min(100, value + 5));
    say("Die Ansprechpartner fragen jetzt gezielt ab: Wer kann wann, wer bringt Material mit und wer hat besondere Kenntnisse? Daraus wird dein Helferpool.", "success", "Helferabfrage");
  };

  const startAssignment = () => {
    setPhase("puzzle");
    say("Jetzt füllt das Organisationsteam die echten Schichten. Achte auf die Zeitfenster direkt an jeder Station – nicht nur darauf, wer grundsätzlich helfen möchte.", "guide", "Schichtplanung");
  };

  const selectHelper = (helper: HelperCard) => {
    setSelectedHelperId(helper.id);
    const currentShift = shifts.find(shift => shift.id === helper.assignedShiftId);
    if (currentShift) {
      say(`${helper.name} ist aktuell bei „${currentShift.area}" eingeteilt. Du kannst die Person bei Bedarf umsetzen.`, "guide", currentShift.area);
      return;
    }
    const recommended = shifts.find(item => item.id === recommendedStationId);
    say(recommended ? `${helper.name} passt besonders gut zu „${recommended.area}" von ${recommended.timeWindow}. Die Station ist im Spielfeld grün markiert.` : `${helper.name} kann von ${helper.availableFrom} bis ${helper.availableTo}. Prüfe Zeitfenster und Aufgabe, bevor du eine Station auswählst.`, "guide", recommended?.area ?? helper.name);
  };

  const assignHelper = (shiftId: string) => {
    const helper = helpers.find(item => item.id === selectedHelperId);
    const shift = shifts.find(item => item.id === shiftId);
    if (!helper || !shift) return;
    const validTime = isTimeCompatible(helper, shift);
    const matchingSkill = !shift.requiredSkill || helper.skills.includes(shift.requiredSkill);
    const isAlreadyAssignedHere = shift.assignedHelperIds.includes(helper.id);
    if (!isAlreadyAssignedHere && shift.assignedHelperIds.length >= shift.requiredHelpers) {
      say(`${shift.area} ist bereits vollständig besetzt. Lass dort niemanden zusätzlich stehen – wähle eine noch offene Station.`, "warning", shift.area);
      return;
    }
    if (!validTime) {
      say(`Zeitkonflikt: ${helper.name} kann nur bis ${helper.availableTo}; diese Schicht läuft jedoch ${shift.timeWindow}. Suche eine Schicht innerhalb des Zeitfensters.`, "warning", `${helper.name} · ${shift.timeWindow}`);
      return;
    }
    if (!matchingSkill) {
      say(`Aufgabenhinweis: Für ${shift.area} brauchst du die Fähigkeit „${shift.requiredSkill}". ${helper.name} passt zeitlich, aber nicht fachlich optimal.`, "warning", shift.area);
      return;
    }
    setShifts(previous => previous.map(item => ({ ...item, assignedHelperIds: item.id === shiftId ? [...item.assignedHelperIds.filter(id => id !== helper.id), helper.id] : item.assignedHelperIds.filter(id => id !== helper.id) })));
    setHelpers(previous => previous.map(item => item.id === helper.id ? { ...item, assignedShiftId: shiftId } : item));
    setSelectedHelperId(null);
    setSatisfactionLevel(value => Math.min(100, value + 6));
    say(`Passt. ${helper.name} ist für ${shift.area} von ${shift.timeWindow} eingeplant. Die Figur zieht sichtbar auf ihre Station.`, "success", shift.area);
  };

  const removeHelper = (helperId: string, shiftId: string) => {
    setShifts(previous => previous.map(shift => shift.id === shiftId ? { ...shift, assignedHelperIds: shift.assignedHelperIds.filter(id => id !== helperId) } : shift));
    setHelpers(previous => previous.map(helper => helper.id === helperId ? { ...helper, assignedShiftId: null } : helper));
    setSelectedHelperId(null);
    say("Die Person ist wieder im Helferpool. Jetzt kann sie einer passenderen Zeit oder Aufgabe zugeordnet werden.", "guide", "Helferpool");
  };

  const startEvent = () => {
    setPhase("event_day");
    say("Startschuss. Deine Monate Vorbereitung zeigen jetzt Wirkung – und trotzdem kann es am Eventtag Situationen geben, die einen guten Plan B brauchen.", "guide", "Veranstaltungstag");
  };

  const chooseCrisis = (optionIndex: number) => {
    const crisis = RADSPORT_CRISES[currentCrisisIndex];
    const option = crisis.options[optionIndex];
    setStressLevel(value => Math.max(0, Math.min(100, value + option.impactStress)));
    setBudget(value => value + option.impactBudget);
    setSatisfactionLevel(value => Math.max(0, Math.min(100, value + option.impactSatisfaction)));
    setCrisisDecisions(previous => [...previous, `${crisis.title}: ${option.label}`]);
    say(option.klemmiFeedback, option.impactStress > 8 ? "warning" : "success", crisis.title);
    if (currentCrisisIndex + 1 < RADSPORT_CRISES.length) setCurrentCrisisIndex(value => value + 1);
    else window.setTimeout(() => { setPhase("report"); say("Geschafft. Nicht die Krise hat dein Festival gerettet, sondern die Vorbereitung vor dem Startschuss.", "success", "Abschlussbericht"); }, 900);
  };

  const currentStage = phase === "story_intro" ? 0 : PHASES.findIndex(item => item.id === phase);
  const sceneLabel = phase === "event_day" || phase === "report" ? "Radsportfestival · Sonntag · Veranstaltungstag" : "Radsportfestival · 183 Tage bis zum Start";

  return (
    <div className="game-world game-world--light min-h-screen font-sans text-slate-900 selection:bg-orange-200">
      <audio ref={audioRef} src={FESTIVAL_MUSIC} loop preload="metadata" />
      <header className="game-header sticky top-0 z-40 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><div className="game-header__mark"><Bike className="size-5" /></div><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-lg font-black tracking-tight text-slate-900">CrewMate Tycoon</span><span className="hidden rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:inline">Planungs-Simulator</span></div><p className="hidden text-xs text-slate-500 sm:block">Radsportfestival · Vorbereitung vor dem Veranstaltungstag</p></div></div>
          <div className="flex items-center gap-2 sm:gap-3">{phase !== "scenario_select" && <div className="hidden items-center gap-4 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm lg:flex"><Metric icon={<Heart className="size-3.5 text-rose-500" />} label="Team" value={`${satisfactionLevel}%`} /><Metric icon={<Zap className="size-3.5 text-amber-500" />} label="Risiko" value={`${stressLevel}%`} /><Metric icon={<span className="text-xs">€</span>} label="Budget" value={`${budget.toLocaleString("de-DE")} €`} /></div>}<button onClick={toggleMusic} className={`game-icon-button ${musicPlaying ? "game-icon-button--active" : ""}`} title={musicPlaying ? "Musik pausieren" : "Musik starten"}>{musicPlaying ? <Pause className="size-4" /> : <Music2 className="size-4" />}</button><button onClick={resetGame} className="game-reset-button"><RotateCcw className="size-3.5" /><span className="hidden sm:inline">Neustart</span></button></div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 md:px-6 md:py-7">
        {phase !== "scenario_select" && phase !== "story_intro" && phase !== "report" && <nav className="game-phase-nav" aria-label="Planungsfortschritt">{PHASES.map((item, index) => <div key={item.id} className={`game-phase-nav__item ${index < currentStage || item.id === phase ? "game-phase-nav__item--done" : ""} ${item.id === phase ? "game-phase-nav__item--current" : ""}`}><span>{index < currentStage ? <CheckCircle2 className="size-4" /> : item.number}</span><b>{item.label}</b></div>)}</nav>}

        {phase !== "scenario_select" && <KlemmiAdvisor message={klemmiMessage} level={advisorLevel} target={advisorTarget} speaking={klemmiSpeaking} />}

        {phase === "scenario_select" && <section className="game-select mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center"><div className="mx-auto mb-7 max-w-2xl text-center md:mb-10"><span className="game-eyebrow">Interaktive Vereinsplanung</span><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Das Festival beginnt nicht erst am Startschuss.</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">Ein Planungs-Simulator für komplexe Vereinsveranstaltungen: erst Genehmigungen, Stationen und Material. Dann Helferabfrage und Schichten. Erst am Ende kommt der Eventtag.</p></div><div className="grid gap-5 md:grid-cols-3">{(Object.keys(GAME_SCENARIOS) as GameScenarioId[]).map(id => { const item = GAME_SCENARIOS[id]; const playable = id === "radsport"; const selected = selectedScenarioId === id; return <article key={id} onClick={() => setSelectedScenarioId(id)} className={`game-scenario-card ${selected ? "game-scenario-card--selected" : ""} ${!playable ? "game-scenario-card--future" : ""}`}><div className="mb-5 flex items-center justify-between"><span className="game-scenario-card__badge">{item.badge}</span><span className="text-xs font-bold text-orange-600">{item.difficulty}</span></div><div className="game-scenario-card__icon">{id === "radsport" ? <Bike /> : id === "kirmes" ? <Home /> : <Users />}</div><h2>{item.title}</h2><p className="game-scenario-card__subtitle">{item.subtitle}</p><p className="game-scenario-card__tagline">{item.tagline}</p><ul>{item.featuresHighlight.map(feature => <li key={feature}><CheckCircle2 className="size-3.5" />{feature}</li>)}</ul><button onClick={event => { event.stopPropagation(); playable ? startScenario() : say(`„${item.title}" ist als nächste Spielwelt vorgemerkt. Die heutige Vorschau konzentriert sich auf die vollständige Radsport-Planung.`); }} className={`game-scenario-card__button ${playable ? "game-scenario-card__button--play" : ""}`}>{playable ? <>Planung starten <ArrowRight className="size-4" /></> : <>Spielwelt vormerken</>}</button></article>; })}</div></section>}

        {phase === "story_intro" && <section className="game-story-layout"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="story_intro" sceneLabel={sceneLabel} /><div className="game-story-panel"><span className="game-eyebrow">Prolog · 6 Monate vor dem Festival</span><h1>Die eigentliche Arbeit beginnt weit vor dem Rennen.</h1>{scenario.storyIntro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<div className="game-mission"><ClipboardCheck className="size-5" /><div><b>Deine Mission</b><span>Baue eine durchgängige Planung: Strecke und Genehmigungen, Orte, Material und Helfer – daraus entsteht erst später ein belastbarer Einsatzplan.</span></div></div><div className="flex flex-wrap gap-3"><button onClick={() => setPhase("preparation")} className="game-primary-button">Planung öffnen <ArrowRight className="size-4" /></button><button onClick={() => setPhase("scenario_select")} className="game-secondary-button">Szenario wechseln</button></div></div></section>}

        {phase === "preparation" && <section className="game-planning-layout"><div className="game-planning-layout__scene"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="preparation" sceneLabel={sceneLabel} /><div className="game-scene-objective"><span>Planungsstand</span><b>{completedTaskIds.length}/4 Schlüsselaufgaben gesichert</b></div></div><aside className="game-board game-board--preparation"><div className="game-board__header"><div><span className="game-eyebrow">Monate vor dem Event</span><h1>Fundament organisieren</h1></div><span className="game-board__counter"><ClipboardCheck className="size-3.5" />183 Tage</span></div><p className="game-board__intro">Diese Aufgaben sind keine Nebenquests: Sie legen fest, ob die Veranstaltung später sicher, versorgt und besetzbar ist. Klicke sie der Reihe nach an.</p><div className="game-task-list">{RADSPORT_PLANNING_TASKS.map(task => <button key={task.id} onClick={() => completeTask(task)} className={`game-task-card ${completedTaskIds.includes(task.id) ? "game-task-card--done" : ""}`}><TaskIcon icon={task.icon} /><span><b>{task.title}</b><small>{task.area} · {task.deadline}</small><em>{completedTaskIds.includes(task.id) ? task.result : task.detail}</em></span>{completedTaskIds.includes(task.id) ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}</button>)}</div><button disabled={!isPreparationComplete} onClick={() => setPhase("helper_outreach")} className="game-start-event">{isPreparationComplete ? <>Helferabfrage vorbereiten <ArrowRight className="size-4" /></> : <>Noch {4 - completedTaskIds.length} Vorbereitungsschritte sichern</>}</button></aside></section>}

        {phase === "helper_outreach" && <section className="game-planning-layout"><div className="game-planning-layout__scene"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="helper_outreach" sceneLabel={sceneLabel} /><div className="game-scene-objective"><span>Helferkoordination</span><b>{outreachStarted ? "Rückmeldungen werden gebündelt" : "Ansprechpartner aktivieren"}</b></div></div><aside className="game-board game-board--outreach"><div className="game-board__header"><div><span className="game-eyebrow">Jetzt Menschen erreichen</span><h1>Helferabfrage bündeln</h1></div><span className="game-board__counter"><Users className="size-3.5" />5 Kontakte</span></div><p className="game-board__intro">Nicht alle 300 Mitglieder werden direkt disponiert. Ansprechpartner sammeln Verfügbarkeiten, Hinweise und Materialzusagen aus ihren Bereichen.</p><div className="game-contact-flow"><ContactRow initials="ME" name="Maria · VP & Material" state={outreachStarted ? "16 Rückmeldungen" : "bereit"} /><ContactRow initials="JB" name="Jonas · Strecke Nord" state={outreachStarted ? "12 Rückmeldungen" : "bereit"} /><ContactRow initials="LR" name="Lea · Anmeldung" state={outreachStarted ? "9 Rückmeldungen" : "bereit"} /><ContactRow initials="DN" name="David · Sicherheit" state={outreachStarted ? "6 Rückmeldungen" : "bereit"} /></div>{!outreachStarted ? <button onClick={startOutreach} className="game-primary-button w-full">Abfrage an Ansprechpartner senden <Send className="size-4" /></button> : <><div className="game-outreach-summary"><b>43 Rückmeldungen</b><span>18 ganztägig · 11 mit Zeitfenster · 5 Materialzusagen</span></div><button onClick={startAssignment} className="game-start-event">Einsatzplan füllen <ArrowRight className="size-4" /></button></>}</aside></section>}

        {phase === "puzzle" && <section className="game-play-layout"><div className="game-play-layout__scene"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={selectedHelperId} onSelectStation={assignHelper} recommendedStationId={recommendedStationId} phase="puzzle" sceneLabel={sceneLabel} /><div className="game-scene-objective"><span>Einsatzplan · Sonntag</span><b>{isPuzzleComplete ? "Alle kritischen Stationen besetzt" : `${assignedCount} von ${requiredCount} Positionen besetzt`}</b></div></div><aside className="game-board"><div className="game-board__header"><div><span className="game-eyebrow">Einsatzplan</span><h1>{selectedHelper ? "Station auswählen" : "Helfer zuweisen"}</h1></div><span className="game-board__counter"><Users className="size-3.5" />{availableHelpers.length} frei</span></div><p className="game-board__intro">{selectedHelper ? <><b>{selectedHelper.name}</b> kann {selectedHelper.availableFrom}–{selectedHelper.availableTo}. Klemmi markiert die fachlich und zeitlich passende Station direkt auf der Karte.</> : "Wähle zuerst eine Person. Danach zeigt dir Klemmi die passende offene Station. Zeitfenster und benötigte Fähigkeit werden vor jeder Zuweisung geprüft."}</p><ShiftPlanningPreview shifts={shifts} helpers={helpers} selectedHelperId={selectedHelperId} recommendedStationId={recommendedStationId} onRemoveHelper={removeHelper} /><div className="game-helper-list">{helpers.map(helper => { const shift = shifts.find(item => item.id === helper.assignedShiftId); return <button key={helper.id} onClick={() => selectHelper(helper)} className={`game-helper-card ${helper.id === selectedHelperId ? "game-helper-card--selected" : ""} ${helper.assignedShiftId ? "game-helper-card--assigned" : ""}`}><span className="game-helper-card__avatar">{helper.initials}</span><span className="min-w-0 flex-1 text-left"><b>{helper.name}</b><small>{helper.role} · {helper.availableFrom}–{helper.availableTo}</small>{shift && <em>→ {shift.area}</em>}</span><span className="game-helper-card__skills">{helper.skills.slice(0, 2).join(" · ")}</span></button>; })}</div><button disabled={!isPuzzleComplete} onClick={startEvent} className="game-start-event">{isPuzzleComplete ? <>Veranstaltung starten <ArrowRight className="size-4" /></> : <>Noch {requiredCount - assignedCount} Positionen besetzen</>}</button></aside></section>}

        {phase === "event_day" && <section className="game-play-layout game-play-layout--event"><div className="game-play-layout__scene"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="event_day" rainActive={currentCrisisIndex === 0} sceneLabel={sceneLabel} /></div><aside className="game-crisis-panel"><div className="game-crisis-panel__top"><span><ShieldCheck className="size-3.5" />Ereignis {currentCrisisIndex + 1}/{RADSPORT_CRISES.length}</span><small>{currentCrisisIndex === 0 ? "11:20 Uhr · VP 2" : "13:45 Uhr · VP 1"}</small></div><div className="game-crisis-panel__title"><AlertTriangle className="size-6" /><h1>{RADSPORT_CRISES[currentCrisisIndex].title}</h1></div><p>{RADSPORT_CRISES[currentCrisisIndex].description}</p><div className="game-crisis-options">{RADSPORT_CRISES[currentCrisisIndex].options.map((option: EventCrisis["options"][number], index) => <button key={option.label} onClick={() => chooseCrisis(index)}><span>{index + 1}</span><div><b>{option.label}</b><small>{option.actionDescription}</small></div><ArrowRight className="size-4" /></button>)}</div></aside></section>}

        {phase === "report" && <section className="game-report-layout"><FestivalScene helpers={helpers} shifts={shifts} selectedHelperId={null} onSelectStation={() => undefined} phase="report" sceneLabel={sceneLabel} /><div className="game-report-card"><div className="game-report-card__trophy"><Bike className="size-7" /></div><span className="game-eyebrow">Festival erfolgreich vorbereitet</span><h1>Der Erfolg begann Monate zuvor.</h1><p>Du hast erst Genehmigungen, Orte, Material und Helferkoordination aufgebaut. Dadurch wurde der Einsatzplan belastbar – und die beiden Situationen am Eventtag waren beherrschbar.</p><div className="game-report-metrics"><Metric icon={<Heart className="size-4 text-rose-500" />} label="Team" value={`${satisfactionLevel}%`} /><Metric icon={<Zap className="size-4 text-amber-500" />} label="Risiko" value={`${stressLevel}%`} /><Metric icon={<span>€</span>} label="Budget" value={`${budget.toLocaleString("de-DE")} €`} /></div><ul>{crisisDecisions.map(decision => <li key={decision}><CheckCircle2 className="size-4" />{decision}</li>)}</ul><div className="flex flex-wrap justify-center gap-3"><a href="https://mycrewmate.de" className="game-primary-button">MyCrewMate kennenlernen <ExternalLink className="size-4" /></a><button onClick={resetGame} className="game-secondary-button">Planung erneut spielen</button></div></div></section>}
      </main>
      <footer className="game-footer"><span>© 2026 MyCrewMate · CrewMate Tycoon</span><span>Interaktives Training für Vereins- & Eventplanung</span></footer>
    </div>
  );
}

function TaskIcon({ icon }: { icon: PlanningTask["icon"] }) {
  const iconProps = { className: "size-4" };
  if (icon === "route") return <Route {...iconProps} />;
  if (icon === "home") return <Home {...iconProps} />;
  if (icon === "package") return <Package {...iconProps} />;
  return <Users {...iconProps} />;
}

function ContactRow({ initials, name, state }: { initials: string; name: string; state: string }) {
  return <div className="game-contact-row"><span>{initials}</span><b>{name}</b><small>{state}</small></div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <span className="game-metric">{icon}<small>{label}</small><b>{value}</b></span>;
}

function KlemmiAdvisor({ message, level, target, speaking }: { message: string; level: AdvisorLevel; target: string; speaking: boolean }) {
  const isWarning = level === "warning";
  const isSuccess = level === "success";
  const label = isWarning ? "Klemmi erkennt einen Planungsfehler" : isSuccess ? "Klemmi bestätigt den nächsten Schritt" : "Klemmi begleitet deine Planung";

  return (
    <section className={`game-advisor game-advisor--${level}`} aria-live="polite" aria-label={label}>
      <div className="game-advisor__mascot"><KlemmiMascot isSpeaking={speaking} decorative /></div>
      <div className="game-advisor__content">
        <div className="game-advisor__meta"><span>{isWarning ? <AlertTriangle className="size-3.5" /> : isSuccess ? <CheckCircle2 className="size-3.5" /> : <ClipboardCheck className="size-3.5" />} Klemmi · Planungsberater</span><small>Bezug: {target}</small></div>
        <p>{message}</p>
      </div>
      <span className="game-advisor__status">{isWarning ? "Prüfen" : isSuccess ? "Passt" : "Tipp"}</span>
    </section>
  );
}

function ShiftPlanningPreview({
  shifts,
  helpers,
  selectedHelperId,
  recommendedStationId,
  onRemoveHelper,
}: {
  shifts: ShiftSlot[];
  helpers: HelperCard[];
  selectedHelperId: string | null;
  recommendedStationId: string | null;
  onRemoveHelper: (helperId: string, shiftId: string) => void;
}) {
  const selectedHelper = helpers.find(helper => helper.id === selectedHelperId);

  return (
    <section className="game-shift-preview" aria-label="Schichtplanung Vorschau">
      <div className="game-shift-preview__header"><div><span>Schichtplanung · Vorschau</span><b>Sonntag, 06:30–16:30 Uhr</b></div><small>{selectedHelper ? `${selectedHelper.name} ausgewählt` : "Zeitfenster zuerst prüfen"}</small></div>
      <div className="game-shift-preview__grid">{shifts.map(shift => {
        const full = shift.assignedHelperIds.length >= shift.requiredHelpers;
        const recommended = shift.id === recommendedStationId;
        const selectedCanHelp = selectedHelper ? isTimeCompatible(selectedHelper, shift) && (!shift.requiredSkill || selectedHelper.skills.includes(shift.requiredSkill)) : null;
        return <div key={shift.id} className={`game-shift-preview__slot ${full ? "game-shift-preview__slot--full" : ""} ${recommended ? "game-shift-preview__slot--recommended" : ""} ${selectedCanHelp === false ? "game-shift-preview__slot--conflict" : ""}`}>
          <div><b>{shift.area}</b><time>{shift.timeWindow}</time></div>
          <small>{shift.requiredSkill ? `Benötigt: ${shift.requiredSkill}` : "Allgemeine Unterstützung"}</small>
          <span className="game-shift-preview__occupancy">{shift.assignedHelperIds.length}/{shift.requiredHelpers} besetzt</span>
          {recommended && <em>Klemmi empfiehlt</em>}
          {selectedCanHelp === false && <em>passt nicht</em>}
          <div className="game-shift-preview__people">{shift.assignedHelperIds.map(id => { const helper = helpers.find(item => item.id === id); return helper ? <button key={id} title={`${helper.name} freigeben`} onClick={() => onRemoveHelper(helper.id, shift.id)}>{helper.initials}</button> : null; })}</div>
        </div>;
      })}</div>
    </section>
  );
}
