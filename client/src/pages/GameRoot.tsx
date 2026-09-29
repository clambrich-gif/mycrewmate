import React, { useState } from "react";
import {
  GAME_SCENARIOS,
  GameScenarioId,
  HelperCard,
  ShiftSlot,
  EventCrisis
} from "../game/gameData";
import {
  SCHUETZENFEST_HELPERS,
  SCHUETZENFEST_SHIFTS,
  SCHUETZENFEST_CRISES
} from "../game/questData";
import {
  Beer,
  Tent,
  Bike,
  Sparkles,
  ShieldCheck,
  Trophy,
  Users,
  Clock,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Volume2,
  VolumeX,
  ExternalLink,
  ChevronRight,
  Heart,
  CheckCircle2,
  Calendar,
  Zap
} from "lucide-react";

type GamePhase = "scenario_select" | "story_intro" | "puzzle" | "event_day" | "report";

export default function GameRoot() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<GameScenarioId>("schuetzenfest");
  const [phase, setPhase] = useState<GamePhase>("scenario_select");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Spielzustand
  const [helpers, setHelpers] = useState<HelperCard[]>(SCHUETZENFEST_HELPERS);
  const [shifts, setShifts] = useState<ShiftSlot[]>(SCHUETZENFEST_SHIFTS);
  const [stressLevel, setStressLevel] = useState(25);
  const [satisfactionLevel, setSatisfactionLevel] = useState(70);
  const [budget, setBudget] = useState(2500);
  const [currentCrisisIndex, setCurrentCrisisIndex] = useState(0);
  const [crisisDecisions, setCrisisDecisions] = useState<string[]>([]);
  const [klemmiMessage, setKlemmiMessage] = useState<string>(
    "Willkommen bei CrewMate Tycoon! Wähle ein Szenario und teste deine Planungsfähigkeiten."
  );

  const scenario = GAME_SCENARIOS[selectedScenarioId];

  // Helper zu Schicht zuweisen
  const assignHelper = (helperId: string, shiftId: string) => {
    const helper = helpers.find((h) => h.id === helperId);
    const shift = shifts.find((s) => s.id === shiftId);

    if (!helper || !shift) return;

    // Zeitprüfung
    const helperStart = parseInt(helper.availableFrom.split(":")[0]);
    const helperEnd = parseInt(helper.availableTo.split(":")[0]);
    const shiftStart = parseInt(shift.timeWindow.split("–")[0].trim().split(":")[0]);
    const shiftEnd = parseInt(shift.timeWindow.split("–")[1].trim().split(":")[0]);

    if (helperStart > shiftStart || helperEnd < shiftEnd) {
      setKlemmiMessage(
        `Achtung! ${helper.name} ist nur von ${helper.availableFrom} bis ${helper.availableTo} da. Die Schicht geht aber von ${shift.timeWindow}! Das gibt Stress im Team!`
      );
      setStressLevel((prev) => Math.min(100, prev + 12));
    } else {
      setKlemmiMessage(
        `Perfekt! ${helper.name} passt zeitlich ideal in die Schicht '${shift.title}'.`
      );
      setSatisfactionLevel((prev) => Math.min(100, prev + 8));
      setStressLevel((prev) => Math.max(0, prev - 5));
    }

    // Skill-Prüfung
    if (shift.requiredSkill && !helper.skills.includes(shift.requiredSkill)) {
      setKlemmiMessage(
        `Hinweis: Für '${shift.title}' wird eigentlich die Fähigkeit '${shift.requiredSkill}' gebraucht. ${helper.name} muss sich erst einarbeiten!`
      );
      setStressLevel((prev) => Math.min(100, prev + 5));
    }

    // Zuweisung aktualisieren
    setShifts((prevShifts) =>
      prevShifts.map((s) => {
        if (s.id === shiftId) {
          if (s.assignedHelperIds.includes(helperId)) return s;
          return { ...s, assignedHelperIds: [...s.assignedHelperIds, helperId] };
        }
        return {
          ...s,
          assignedHelperIds: s.assignedHelperIds.filter((id: string) => id !== helperId)
        };
      })
    );

    setHelpers((prevHelpers) =>
      prevHelpers.map((h) =>
        h.id === helperId ? { ...h, assignedShiftId: shiftId } : h
      )
    );
  };

  const removeHelperFromShift = (helperId: string, shiftId: string) => {
    setShifts((prevShifts) =>
      prevShifts.map((s) =>
        s.id === shiftId
          ? { ...s, assignedHelperIds: s.assignedHelperIds.filter((id: string) => id !== helperId) }
          : s
      )
    );
    setHelpers((prevHelpers) =>
      prevHelpers.map((h) =>
        h.id === helperId ? { ...h, assignedShiftId: null } : h
      )
    );
    setKlemmiMessage("Helfer wieder freigegeben. Schicht ist jetzt wieder unbesetzt.");
  };

  const isPuzzleComplete = shifts.every(
    (s) => s.assignedHelperIds.length >= s.requiredHelpers
  );

  const handleCrisisChoice = (optionIndex: number) => {
    const crisis = SCHUETZENFEST_CRISES[currentCrisisIndex];
    const option = crisis.options[optionIndex];

    setStressLevel((prev) => Math.max(0, Math.min(100, prev + option.impactStress)));
    setBudget((prev) => prev + option.impactBudget);
    setSatisfactionLevel((prev) =>
      Math.max(0, Math.min(100, prev + option.impactSatisfaction))
    );
    setCrisisDecisions((prev) => [...prev, `${crisis.title}: ${option.label}`]);
    setKlemmiMessage(option.klemmiFeedback);

    if (currentCrisisIndex + 1 < SCHUETZENFEST_CRISES.length) {
      setCurrentCrisisIndex((prev) => prev + 1);
    } else {
      setTimeout(() => setPhase("report"), 1200);
    }
  };

  const resetGame = () => {
    setHelpers(SCHUETZENFEST_HELPERS);
    setShifts(SCHUETZENFEST_SHIFTS);
    setStressLevel(25);
    setSatisfactionLevel(70);
    setBudget(2500);
    setCurrentCrisisIndex(0);
    setCrisisDecisions([]);
    setPhase("scenario_select");
    setKlemmiMessage("Auf ein Neues! Wähle deine nächste Herausforderung.");
  };

  return (
    <div className="game-world min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Obere Navigationsleiste des Spiels */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-orange-500/20">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-lg">
                  CrewMate Tycoon
                </span>
                <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20">
                  Game Edition
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Das interaktive Ehrenamt-Abenteuer von MyCrewMate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {phase !== "scenario_select" && (
              <div className="hidden md:flex items-center gap-6 bg-slate-950 px-4 py-1.5 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400">Zufriedenheit:</span>
                  <span className="font-bold text-emerald-300">{satisfactionLevel}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-400">Team-Stress:</span>
                  <span className="font-bold text-amber-300">{stressLevel}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Kasse:</span>
                  <span className="font-bold text-slate-200">{budget} €</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg border border-slate-800 bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title={soundEnabled ? "Audio stumm" : "Audio an"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={resetGame}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold hover:bg-slate-700 transition flex items-center gap-1.5 text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Neu starten</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hauptspielbereich */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col">
        {/* Klemmi Mentor-Banner */}
        <div className="game-world__klemmi mb-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />
            <div className="game-world__mascot w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <span className="text-3xl">📋</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-orange-400 text-sm">
                Klemmi · Dein Orga-Coach
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                Mentor-Tipp
              </span>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed font-medium">
              "{klemmiMessage}"
            </p>
          </div>
        </div>

        {/* PHASE 1: SZENARIEN-AUSWAHL */}
        {phase === "scenario_select" && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-orange-400 font-semibold text-xs tracking-widest uppercase">
                Schritt 1 von 3
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-white mt-2 tracking-tight">
                Wähle deine Vereins-Quest
              </h1>
              <p className="text-slate-400 text-sm md:text-base mt-3">
                Jedes Fest hat seine eigenen Gesetze. Wähle eine Herausforderung und erlebe,
                wie smarte Planung aus Chaos ein unvergessliches Festival macht.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {(Object.keys(GAME_SCENARIOS) as GameScenarioId[]).map((id) => {
                const item = GAME_SCENARIOS[id];
                const isSelected = selectedScenarioId === id;
                const isPlayable = id === "schuetzenfest";
                return (
                  <div
                    key={id}
                    onClick={() => setSelectedScenarioId(id)}
                    className={`cursor-pointer rounded-2xl border transition-all p-6 relative flex flex-col justify-between ${
                      isSelected
                        ? "border-orange-500 bg-slate-900 shadow-2xl shadow-orange-500/10 ring-2 ring-orange-500/20 translate-y--1"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {item.badge}
                        </span>
                        <span className="text-xs text-orange-400 font-medium">
                          {item.difficulty}
                        </span>
                      </div>

                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                        {id === "schuetzenfest" && <Beer className="w-6 h-6 text-orange-400" />}
                        {id === "kirmes" && <Tent className="w-6 h-6 text-amber-400" />}
                        {id === "radsport" && <Bike className="w-6 h-6 text-sky-400" />}
                      </div>

                      <h3 className="text-xl font-bold text-white tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 mb-4">{item.subtitle}</p>
                      <p className="text-sm text-slate-300 leading-relaxed mb-4">
                        {item.tagline}
                      </p>

                      <div className="space-y-2 mb-6">
                        {item.featuresHighlight.map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlayable) {
                          setSelectedScenarioId(id);
                          setPhase("story_intro");
                          setKlemmiMessage(item.klemmiWelcome);
                        } else {
                          setSelectedScenarioId(id);
                          setKlemmiMessage(
                            `Die Spielwelt '${item.title}' ist in der Kampagnen-Roadmap fest eingeplant. Heute kannst du bereits das vollständige Schützenfest-Abenteuer spielen.`
                          );
                        }
                      }}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                        isPlayable && isSelected
                          ? "bg-orange-500 hover:bg-orange-400 text-slate-950 shadow-lg shadow-orange-500/20"
                          : isPlayable
                            ? "bg-slate-800 hover:bg-slate-700 text-white"
                            : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      }`}
                    >
                      <span>{isPlayable ? "Szenario spielen" : "Spielwelt vormerken"}</span>
                      {isPlayable ? <ArrowRight className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 2: STORY INTRO */}
        {phase === "story_intro" && (
          <div className="max-w-3xl mx-auto flex-1 flex flex-col justify-center">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-3 text-orange-400 mb-4">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs uppercase font-bold tracking-widest">
                  Prolog · {scenario.title}
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white mb-6">
                "Alles vorbereitet? Nicht ganz..."
              </h2>

              <div className="space-y-4 mb-8">
                {scenario.storyIntro.map((paragraph: string, index: number) => (
                  <p key={index} className="text-slate-300 text-base leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 mb-8 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Deine Mission in Level 1</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Besetze alle 4 kritischen Schichten mit den passenden Helfern, ohne dass
                    Zeitfenster kollidieren. Achte auf Fähigkeiten und Zufriedenheit!
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setPhase("scenario_select")}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  ← Anderes Szenario wählen
                </button>
                <button
                  onClick={() => setPhase("puzzle")}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 transition"
                >
                  <span>Zum Einsatzplan-Puzzle</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3: PUZZLE (EINSATZPLAN) */}
        {phase === "puzzle" && (
          <div className="flex-1 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs uppercase tracking-wider text-orange-400 font-bold">
                  Level 1 · Einsatzplan-Puzzle
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Schichten zuweisen: Wer macht was?
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Weise Helfer den Schichten zu. Achte auf Verfügbarkeiten (Uhrzeiten) und Spezialwissen!
                </p>
              </div>

              <button
                disabled={!isPuzzleComplete}
                onClick={() => setPhase("event_day")}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition ${
                  isPuzzleComplete
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                }`}
              >
                <span>Event starten (Schichten vollständig)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid lg:grid-cols-12 gap-6 flex-1">
              {/* Helfer-Pool */}
              <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-400" />
                    <h3 className="font-bold text-white text-sm">Verfügbare Vereinshelfer</h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    {helpers.filter((h) => !h.assignedShiftId).length} frei
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {helpers.map((helper) => {
                    const isAssigned = !!helper.assignedShiftId;
                    return (
                      <div
                        key={helper.id}
                        className={`p-3.5 rounded-xl border transition ${
                          isAssigned
                            ? "border-slate-800 bg-slate-950/40 opacity-50"
                            : "border-slate-800 bg-slate-950 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{helper.avatarIcon}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">
                                  {helper.name}
                                </span>
                                {helper.bringsVehicle && (
                                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300" title="Bringt Anhänger/Auto mit">
                                    🚗
                                  </span>
                                )}
                                {helper.bringsCompanion && (
                                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300" title="Bringt Begleitung mit">
                                    👪
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">{helper.role}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 font-medium">
                            <Clock className="w-3 h-3" />
                            <span>
                              {helper.availableFrom}–{helper.availableTo}
                            </span>
                          </div>
                        </div>

                        {helper.notes && (
                          <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                            💡 {helper.notes}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-1.5">
                            {helper.skills.map((skill: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>

                          {/* Schicht-Dropdown-Zuweisung */}
                          {!isAssigned ? (
                            <select
                              onChange={(e) => {
                                if (e.target.value) assignHelper(helper.id, e.target.value);
                              }}
                              defaultValue=""
                              className="bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs py-1 px-2 rounded-lg cursor-pointer transition border-0 outline-none"
                            >
                              <option value="" disabled>
                                + Schicht zuweisen
                              </option>
                              {shifts.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.title} ({s.timeWindow})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-medium">
                              ✓ Eingeteilt
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Schichten-Raster */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Tages-Einsatzplan: Schützenfest-Samstag</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    Bedarf: {shifts.reduce((acc, s) => acc + s.requiredHelpers, 0)} Helfer-Slots
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {shifts.map((shift) => {
                    const isFull = shift.assignedHelperIds.length >= shift.requiredHelpers;
                    return (
                      <div
                        key={shift.id}
                        className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                          isFull
                            ? "border-emerald-500/50 bg-slate-900/90 shadow-lg shadow-emerald-500/5"
                            : "border-slate-800 bg-slate-900/60"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {shift.area}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isFull
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {shift.assignedHelperIds.length} von {shift.requiredHelpers} besetzt
                            </span>
                          </div>

                          <h4 className="font-bold text-white text-base leading-tight mb-1">
                            {shift.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-orange-400 font-medium mb-3">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{shift.timeWindow}</span>
                          </div>

                          {shift.requiredSkill && (
                            <div className="inline-block text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded mb-3">
                              Fähigkeit: <strong className="text-orange-300">{shift.requiredSkill}</strong>
                            </div>
                          )}

                          {/* Zugeordnete Helfer */}
                          <div className="space-y-1.5 mt-2">
                            {shift.assignedHelperIds.map((helperId: string) => {
                              const helper = helpers.find((h) => h.id === helperId);
                              if (!helper) return null;
                              return (
                                <div
                                  key={helper.id}
                                  className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{helper.avatarIcon}</span>
                                    <span className="font-semibold text-white">{helper.name}</span>
                                  </div>
                                  <button
                                    onClick={() => removeHelperFromShift(helper.id, shift.id)}
                                    className="text-slate-400 hover:text-red-400 transition text-[11px]"
                                    title="Aus Schicht entfernen"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {!isFull && (
                          <p className="text-[11px] text-amber-400/90 mt-4 flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Noch {shift.requiredHelpers - shift.assignedHelperIds.length} Helfer benötigt!
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 4: EVENT-TAG (KRISEN & ENTSCHEIDUNGEN) */}
        {phase === "event_day" && (
          <div className="max-w-2xl mx-auto flex-1 flex flex-col justify-center">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Echtzeit-Ereignis {currentCrisisIndex + 1} von {SCHUETZENFEST_CRISES.length}
                </span>
                <span className="text-xs text-slate-400">15:30 Uhr · Festbetrieb</span>
              </div>

              <h2 className="text-2xl font-black text-white mb-3">
                {SCHUETZENFEST_CRISES[currentCrisisIndex].title}
              </h2>

              <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6">
                {SCHUETZENFEST_CRISES[currentCrisisIndex].description}
              </p>

              <div className="space-y-3 mb-6">
                {SCHUETZENFEST_CRISES[currentCrisisIndex].options.map((opt: EventCrisis["options"][number], idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleCrisisChoice(idx)}
                    className="w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-orange-500/50 hover:bg-slate-950 transition flex items-start gap-3 group"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-800 group-hover:bg-orange-500 group-hover:text-slate-950 text-slate-400 font-bold text-xs flex items-center justify-center shrink-0 transition mt-0.5">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm group-hover:text-orange-400 transition">
                        {opt.label}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.actionDescription}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 5: ABSCHLUSSBERICHT & TRANSFER */}
        {phase === "report" && (
          <div className="max-w-3xl mx-auto flex-1 flex flex-col justify-center">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
                <Trophy className="w-8 h-8" />
              </div>

              <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                Festival erfolgreich durchgeführt!
              </span>
              <h2 className="text-3xl font-black text-white mt-1 mb-3">
                Dein Abschluss-Festivalbericht
              </h2>
              <p className="text-slate-300 text-sm max-w-lg mx-auto mb-8">
                Herzlichen Glückwunsch! Du hast das Fest durch geschickte Helfer-Zuweisung und
                kühles Krisenmanagement sicher ins Ziel gebracht.
              </p>

              {/* Ergebnis-Dashboard */}
              <div className="grid grid-cols-3 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 mb-8">
                <div>
                  <span className="text-xs text-slate-400">Helfer-Zufriedenheit</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {satisfactionLevel}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Team-Stresslevel</span>
                  <p className="text-2xl font-black text-amber-400 mt-1">
                    {stressLevel}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Kassenbestand</span>
                  <p className="text-2xl font-black text-slate-200 mt-1">
                    {budget} €
                  </p>
                </div>
              </div>

              {/* Auszeichnungen */}
              <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-800 mb-8 text-left">
                <h4 className="text-xs uppercase tracking-wider font-bold text-orange-400 mb-2">
                  Deine Entscheidungen im Rückblick:
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {crisisDecisions.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Transfer-Brücke zu MyCrewMate */}
              <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border border-orange-500/30 rounded-2xl p-6 text-left mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Planst du bald ein echtes Vereinsfest?
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Was im Spiel Spaß macht, ist in der Realität oft anstrengend: WhatsApp-Listen,
                      fehlende Kuchenspenden, unklare Schichten. <strong>MyCrewMate</strong> nimmt deinem
                      Verein genau diesen Stress ab – mit transparentem Helferplan, Vorlagen und Klemmi als digitalem Guide.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="https://mycrewmate.de"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition"
                >
                  <span>MyCrewMate kennenlernen</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={resetGame}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
                >
                  Nächstes Szenario spielen
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fußzeile */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 MyCrewMate · CrewMate Tycoon ist das offizielle Spiel zur Event- & Vereinssoftware
          </span>
          <div className="flex items-center gap-4">
            <a href="https://mycrewmate.de" className="hover:text-slate-300 transition">
              Hauptseite
            </a>
            <a href="https://app.mycrewmate.de" className="hover:text-slate-300 transition">
              App-Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
