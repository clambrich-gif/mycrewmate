import { CloudRain, MapPin, Sparkles, TentTree, Waves } from "lucide-react";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import type { HelperCard, ShiftSlot } from "@/game/gameData";

const STATIONS: Record<string, { label: string; className: string }> = {
  s1: { label: "Start & Anmeldung", className: "festival-station--tent" },
  s2: { label: "Verpflegungspunkt 1", className: "festival-station--cake" },
  s3: { label: "Streckenposten Nord", className: "festival-station--beer" },
  s4: { label: "Sicherheit & Funk", className: "festival-station--entry" },
};

function helperPosition(helper: HelperCard, helpers: HelperCard[], shifts: ShiftSlot[]) {
  const poolIndex = helpers.filter(item => !item.assignedShiftId).findIndex(item => item.id === helper.id);
  if (!helper.assignedShiftId) return { left: `${8 + (poolIndex % 4) * 12}%`, top: `${74 + Math.floor(poolIndex / 4) * 11}%`, destination: "pool" };
  const shift = shifts.find(item => item.id === helper.assignedShiftId);
  const position = shift?.assignedHelperIds.indexOf(helper.id) ?? 0;
  const stationPositions: Record<string, { left: string; top: string }> = {
    s1: { left: `${28 + position * 9}%`, top: "47%" },
    s2: { left: `${70 + position * 8}%`, top: "46%" },
    s3: { left: `${17 + position * 8}%`, top: "62%" },
    s4: { left: `${77 + position * 7}%`, top: "65%" },
  };
  return { ...(stationPositions[helper.assignedShiftId] ?? stationPositions.s1), destination: helper.assignedShiftId };
}

type SimulatorPhase = "story_intro" | "preparation" | "helper_outreach" | "puzzle" | "event_day" | "report";

type FestivalSceneProps = {
  helpers: HelperCard[];
  shifts: ShiftSlot[];
  selectedHelperId: string | null;
  onSelectStation: (shiftId: string) => void;
  phase: SimulatorPhase;
  rainActive?: boolean;
  klemmiMessage: string;
  klemmiSpeaking: boolean;
  sceneLabel: string;
};

export function FestivalScene({ helpers, shifts, selectedHelperId, onSelectStation, phase, rainActive = false, klemmiMessage, klemmiSpeaking, sceneLabel }: FestivalSceneProps) {
  const selectedHelper = helpers.find(helper => helper.id === selectedHelperId);
  const isInteractive = phase === "puzzle" && !!selectedHelper;
  const showStations = phase === "puzzle" || phase === "event_day" || phase === "report";
  const showHelperTokens = showStations;
  const isEventDay = phase === "event_day" || phase === "report";

  return (
    <section className={`festival-scene ${isEventDay ? "festival-scene--event" : "festival-scene--planning"} ${rainActive ? "festival-scene--rain" : ""} ${isInteractive ? "festival-scene--assignment" : ""}`} aria-label="Animierte 2D-Radsportfestival-Planungswelt">
      <div className="cycling-scene__sky" aria-hidden="true"><i className="cycling-sun" /><i className="cycling-cloud cycling-cloud--one" /><i className="cycling-cloud cycling-cloud--two" /></div>
      <div className="cycling-scene__mountain cycling-scene__mountain--far" aria-hidden="true" />
      <div className="cycling-scene__mountain cycling-scene__mountain--near" aria-hidden="true" />
      <div className="cycling-scene__ground" aria-hidden="true" />
      <div className="cycling-scene__route" aria-hidden="true"><i /><i /><i /></div>
      <div className="cycling-scene__road" aria-hidden="true" />
      <div className="cycling-scene__trees cycling-scene__trees--left" aria-hidden="true" />
      <div className="cycling-scene__trees cycling-scene__trees--right" aria-hidden="true" />

      <div className="cycling-object cycling-object--eventbase"><span className="cycling-object__flag" /><span className="cycling-object__roof" /><span className="cycling-object__label">Eventbasis</span></div>
      <div className="cycling-object cycling-object--routeboard"><span className="cycling-object__map" /><span className="cycling-object__label">Streckenkarte</span></div>
      <div className="cycling-object cycling-object--material"><span className="cycling-object__crates" /><span className="cycling-object__label">Materiallager</span></div>
      <div className="cycling-object cycling-object--shelter"><span className="cycling-object__roof" /><span className="cycling-object__label">VP-Schutzhütte</span></div>
      {isEventDay && <><div className="cycling-rider cycling-rider--one" /><div className="cycling-rider cycling-rider--two" /><div className="cycling-rider cycling-rider--three" /></>}

      {rainActive && <div className="festival-rain" aria-label="Regen zieht über die Verpflegungsstation">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ left: `${(index * 17) % 100}%`, animationDelay: `${-(index % 9) / 10}s` }} />)}<div className="festival-rain__label"><CloudRain className="size-3.5" /> Wetterwarnung</div></div>}
      <div className="festival-scene__caption"><MapPin className="size-3.5" /><span>{sceneLabel}</span></div>
      <div className="festival-scene__pool-label"><span aria-hidden="true">●●</span><span>Helferpool</span></div>

      {showStations && shifts.map(shift => {
        const station = STATIONS[shift.id];
        const full = shift.assignedHelperIds.length >= shift.requiredHelpers;
        return <button type="button" key={shift.id} onClick={() => isInteractive && onSelectStation(shift.id)} className={`festival-station ${station.className} ${full ? "festival-station--full" : ""} ${isInteractive ? "festival-station--target" : ""}`} aria-label={`${station.label}, ${shift.timeWindow}: ${shift.assignedHelperIds.length} von ${shift.requiredHelpers} besetzt${isInteractive ? ", zum Zuweisen auswählen" : ""}`}><span className="festival-station__copy"><b>{station.label}</b><small>{shift.timeWindow}</small></span><span className={`festival-station__count ${full ? "festival-station__count--full" : ""}`}>{shift.assignedHelperIds.length}/{shift.requiredHelpers}</span></button>;
      })}

      {showHelperTokens && helpers.map(helper => {
        const position = helperPosition(helper, helpers, shifts);
        const selected = helper.id === selectedHelperId;
        return <div key={helper.id} className={`festival-helper ${helper.assignedShiftId ? "festival-helper--walking" : "festival-helper--waiting"} ${selected ? "festival-helper--selected" : ""}`} data-destination={position.destination} style={{ left: position.left, top: position.top }} title={`${helper.name}${helper.assignedShiftId ? " ist eingeteilt" : " ist noch frei"}`}><span className="festival-helper__shadow" /><span className="festival-helper__avatar">{helper.initials}</span><span className="festival-helper__name">{helper.name.split(" ")[0]}</span></div>;
      })}

      <div className="festival-klemmi" aria-live="polite"><div className="festival-klemmi__bubble"><span className="festival-klemmi__name"><Sparkles className="size-3" /> Klemmi erklärt</span><p>{klemmiMessage}</p></div><KlemmiMascot className="festival-klemmi__mascot" isSpeaking={klemmiSpeaking} decorative /></div>
      {selectedHelper && phase === "puzzle" && <div className="festival-scene__assignment-hint"><TentTree className="size-4" /><span><b>{selectedHelper.name}</b> ausgewählt. Wähle jetzt eine Station mit passendem Zeitfenster.</span></div>}
      {phase === "event_day" && !rainActive && <div className="festival-scene__live-chip"><Waves className="size-3.5" /> Veranstaltungstag läuft</div>}
    </section>
  );
}
