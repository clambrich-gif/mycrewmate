import { CloudRain, MapPin, Sparkles, Sun, TentTree, Waves } from "lucide-react";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import type { HelperCard, ShiftSlot } from "@/game/gameData";

const STATIONS: Record<string, { label: string; subtitle: string; icon: string; className: string }> = {
  s1: { label: "Festzelt", subtitle: "Aufbau & Tische", icon: "⛺", className: "festival-station--tent" },
  s2: { label: "Kuchentheke", subtitle: "Kaffee & Kuchen", icon: "🍰", className: "festival-station--cake" },
  s3: { label: "Bierwagen", subtitle: "Ausschank", icon: "🍺", className: "festival-station--beer" },
  s4: { label: "Eingang", subtitle: "Einlass & Hilfe", icon: "🛟", className: "festival-station--entry" },
};

function helperPosition(helper: HelperCard, helpers: HelperCard[], shifts: ShiftSlot[]) {
  const poolIndex = helpers.filter((item) => !item.assignedShiftId).findIndex((item) => item.id === helper.id);
  if (!helper.assignedShiftId) {
    return { left: `${9 + (poolIndex % 4) * 11}%`, top: `${73 + Math.floor(poolIndex / 4) * 11}%`, destination: "pool" };
  }

  const shift = shifts.find((item) => item.id === helper.assignedShiftId);
  const position = shift?.assignedHelperIds.indexOf(helper.id) ?? 0;
  const stationPositions: Record<string, { left: string; top: string }> = {
    s1: { left: `${27 + position * 9}%`, top: "42%" },
    s2: { left: `${67 + position * 9}%`, top: "43%" },
    s3: { left: `${17 + position * 9}%`, top: "62%" },
    s4: { left: `${76 + position * 8}%`, top: "66%" },
  };
  return { ...(stationPositions[helper.assignedShiftId] ?? stationPositions.s1), destination: helper.assignedShiftId };
}

type FestivalSceneProps = {
  helpers: HelperCard[];
  shifts: ShiftSlot[];
  selectedHelperId: string | null;
  onSelectStation: (shiftId: string) => void;
  phase: "story_intro" | "puzzle" | "event_day" | "report";
  rainActive?: boolean;
  klemmiMessage: string;
  klemmiSpeaking: boolean;
  backgroundUrl?: string;
};

export function FestivalScene({
  helpers,
  shifts,
  selectedHelperId,
  onSelectStation,
  phase,
  rainActive = false,
  klemmiMessage,
  klemmiSpeaking,
  backgroundUrl,
}: FestivalSceneProps) {
  const selectedHelper = helpers.find((helper) => helper.id === selectedHelperId);
  const isInteractive = phase === "puzzle" && !!selectedHelper;

  return (
    <section
      className={`festival-scene ${rainActive ? "festival-scene--rain" : ""}`}
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
      aria-label="Animierter Festplatz des Schützenfestes"
    >
      <div className="festival-scene__sky" aria-hidden="true">
        <Sun className="festival-sun" />
        <span className="festival-cloud festival-cloud--one" />
        <span className="festival-cloud festival-cloud--two" />
        <span className="festival-bunting festival-bunting--one" />
        <span className="festival-bunting festival-bunting--two" />
      </div>

      <div className="festival-scene__landscape" aria-hidden="true">
        <span className="festival-tree festival-tree--left" />
        <span className="festival-tree festival-tree--right" />
        <span className="festival-path" />
      </div>

      {rainActive && (
        <div className="festival-rain" aria-label="Regen zieht über den Festplatz">
          {Array.from({ length: 36 }, (_, index) => <i key={index} />)}
          <div className="festival-rain__label"><CloudRain className="size-3.5" /> Unwetterböe</div>
        </div>
      )}

      <div className="festival-scene__caption">
        <MapPin className="size-3.5" />
        <span>Schützenfestplatz · Samstag</span>
      </div>

      <div className="festival-scene__pool-label">
        <UsersIcon />
        <span>Helfer treffen ein</span>
      </div>

      {shifts.map((shift) => {
        const station = STATIONS[shift.id];
        const full = shift.assignedHelperIds.length >= shift.requiredHelpers;
        return (
          <button
            type="button"
            key={shift.id}
            onClick={() => isInteractive && onSelectStation(shift.id)}
            className={`festival-station ${station.className} ${full ? "festival-station--full" : ""} ${isInteractive ? "festival-station--target" : ""}`}
            aria-label={`${station.label}: ${shift.assignedHelperIds.length} von ${shift.requiredHelpers} besetzt${isInteractive ? ", zum Zuweisen auswählen" : ""}`}
          >
            <span className="festival-station__icon">{station.icon}</span>
            <span className="festival-station__copy">
              <b>{station.label}</b>
              <small>{station.subtitle}</small>
            </span>
            <span className={`festival-station__count ${full ? "festival-station__count--full" : ""}`}>
              {shift.assignedHelperIds.length}/{shift.requiredHelpers}
            </span>
          </button>
        );
      })}

      {helpers.map((helper) => {
        const position = helperPosition(helper, helpers, shifts);
        const selected = helper.id === selectedHelperId;
        return (
          <div
            key={helper.id}
            className={`festival-helper ${helper.assignedShiftId ? "festival-helper--walking" : "festival-helper--waiting"} ${selected ? "festival-helper--selected" : ""}`}
            data-destination={position.destination}
            style={{ left: position.left, top: position.top }}
            title={`${helper.name}${helper.assignedShiftId ? " ist eingeteilt" : " wartet auf eine Aufgabe"}`}
          >
            <span className="festival-helper__shadow" />
            <span className="festival-helper__avatar">{helper.avatarIcon}</span>
            <span className="festival-helper__name">{helper.name.split(" ")[0]}</span>
          </div>
        );
      })}

      <div className="festival-klemmi" aria-live="polite">
        <div className="festival-klemmi__bubble">
          <span className="festival-klemmi__name"><Sparkles className="size-3" /> Klemmi</span>
          <p>{klemmiMessage}</p>
        </div>
        <KlemmiMascot className="festival-klemmi__mascot" isSpeaking={klemmiSpeaking} decorative />
      </div>

      {selectedHelper && phase === "puzzle" && (
        <div className="festival-scene__assignment-hint">
          <TentTree className="size-4" />
          <span><b>{selectedHelper.name}</b> ist bereit. Klicke auf einen Stand auf dem Festplatz.</span>
        </div>
      )}

      {phase === "event_day" && !rainActive && (
        <div className="festival-scene__live-chip"><Waves className="size-3.5" /> Festbetrieb läuft</div>
      )}
    </section>
  );
}

function UsersIcon() {
  return <span aria-hidden="true">🧑‍🤝‍🧑</span>;
}
