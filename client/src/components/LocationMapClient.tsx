import { divIcon } from "leaflet";
import type {
  CircleMarker as LeafletCircleMarker,
  Marker as LeafletMarker,
} from "leaflet";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { MapEntry, MapLocation } from "./LocationMapCard";
import "leaflet/dist/leaflet.css";

const MAP_MARKER_COLORS = {
  critical: "#dc2626",
  warning: "#eab308",
  complete: "#16a34a",
  neutral: "#64748b",
} as const;

const MAP_LAYERS = {
  streets: {
    label: "Karte",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
  },
  satellite: {
    label: "Satellit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  terrain: {
    label: "Gelände",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Kartendaten: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartenstil: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
} as const;

type MapLayerKey = keyof typeof MAP_LAYERS;
export type GpxMapTrack = {
  id: number;
  name: string;
  color: string;
  points: Array<[number, number]>;
};

function markerSeverity(entries: MapEntry[]) {
  if (entries.some(entry => entry.severity === "critical")) return "critical";
  if (entries.some(entry => entry.severity === "warning")) return "warning";
  if (entries.some(entry => entry.severity === "complete")) return "complete";
  return "neutral";
}

function statusText(entries: MapEntry[]) {
  if (!entries.length) return "Noch keine Aufgaben zugeordnet";
  const severity = markerSeverity(entries);
  if (severity === "critical") return "Handlungsbedarf";
  if (severity === "warning") return "In Arbeit oder zeitlich knapp";
  return severity === "complete" ? "Vollständig geprüft" : "Information hinterlegt";
}

function mapBoundsPoints(
  locations: MapLocation[],
  tracks: GpxMapTrack[],
  visibleTrackIds: Set<number>
) {
  return [
    ...locations.map(location => [location.latitude, location.longitude] as [number, number]),
    ...tracks
      .filter(track => visibleTrackIds.has(track.id))
      .flatMap(track => track.points),
  ];
}

function MapViewport({
  locations,
  tracks,
  visibleTrackIds,
  focusLocationId,
  resetKey,
  fullscreen,
}: {
  locations: MapLocation[];
  tracks: GpxMapTrack[];
  visibleTrackIds: Set<number>;
  focusLocationId: number | null;
  resetKey: number;
  fullscreen: boolean;
}) {
  const map = useMap();

  useLayoutEffect(() => {
    // Der Browser verschiebt das Element beim Wechsel in die Fullscreen-Top-Layer
    // erst nach dem fullscreenchange-Event. Zwei Frames plus ein kurzer Fallback
    // stellen sicher, dass Leaflet seine Kacheln erst nach den finalen Viewportmaßen
    // berechnet – sonst bleibt die frühere eingebettete Kartenhöhe sichtbar.
    const invalidate = () =>
      map.invalidateSize({ pan: false, debounceMoveend: true });
    invalidate();
    const frame = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(invalidate)
    );
    const fallback = window.setTimeout(invalidate, 180);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [fullscreen, map]);

  useEffect(() => {
    const focused = locations.find(location => location.id === focusLocationId);
    if (focused) {
      map.setView([focused.latitude, focused.longitude], 16, { animate: true });
      return;
    }
    const points = mapBoundsPoints(locations, tracks, visibleTrackIds);
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 14, animate: true });
    }
  }, [
    focusLocationId,
    fullscreen,
    locations,
    map,
    resetKey,
    tracks,
    visibleTrackIds,
  ]);

  return null;
}

function MapZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => onZoomChange(map.getZoom()), [map, onZoomChange]);
  useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) });
  return null;
}

function markerSizeForZoom(zoom: number) {
  return Math.min(52, Math.max(36, 40 + (zoom - 12) * 2));
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>'"]/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function markerEntryClass(severity: MapEntry["severity"]) {
  if (severity === "critical") return "text-red-700";
  if (severity === "warning") return "text-amber-700";
  return severity === "complete" ? "text-emerald-700" : "text-slate-700";
}

function LocationMarker({
  location,
  entries,
  focused,
  zoom,
}: {
  location: MapLocation;
  entries: MapEntry[];
  focused: boolean;
  zoom: number;
}) {
  const circleMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const logoMarkerRef = useRef<LeafletMarker | null>(null);
  const severity = markerSeverity(entries);
  const color = MAP_MARKER_COLORS[severity];
  const size = markerSizeForZoom(zoom);
  const markerRef = location.logoUrl ? logoMarkerRef : circleMarkerRef;

  const logoIcon = useMemo(() => {
    if (!location.logoUrl) return null;
    const safeUrl = escapeHtmlAttribute(location.logoUrl);
    return divIcon({
      className: "location-logo-marker",
      html: `<span class="location-logo-marker__frame" style="--location-marker-color:${color};width:${size}px;height:${size}px"><img data-location-marker-logo="true" src="${safeUrl}" alt="" style="display:block;width:100%;height:100%;object-fit:cover" /></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }, [color, location.logoUrl, size]);

  useEffect(() => {
    if (!focused) return;
    const timeout = window.setTimeout(() => markerRef.current?.openPopup(), 120);
    return () => window.clearTimeout(timeout);
  }, [focused, markerRef]);

  const popup = (
    <Popup>
      <div className="min-w-56 text-slate-900">
        <strong className="block text-sm">{location.name}</strong>
        <p className="mt-1 text-xs text-slate-600">{statusText(entries)}</p>
        {entries.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {entries.map((entry, index) => (
              <li key={`${entry.label}-${index}`} className={markerEntryClass(entry.severity)}>
                <span aria-hidden="true">● </span>
                <span className="font-medium">{entry.label}</span>
                <span className="text-xs"> – {entry.status}</span>
                {entry.href && entry.actionLabel ? (
                  <a
                    href={entry.href}
                    className="ml-3 inline-block text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                  >
                    {entry.actionLabel}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Popup>
  );

  if (logoIcon)
    return (
      <Marker
        ref={logoMarkerRef}
        position={[location.latitude, location.longitude]}
        icon={logoIcon}
        aria-label={`${location.name}: ${statusText(entries)}`}
      >
        {popup}
      </Marker>
    );

  return (
    <CircleMarker
      ref={circleMarkerRef}
      center={[location.latitude, location.longitude]}
      radius={Math.max(9, size / 3.6)}
      pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }}
      aria-label={`${location.name}: ${statusText(entries)}`}
    >
      {popup}
    </CircleMarker>
  );
}

export default function LocationMapClient({
  locations,
  entriesByLocation,
  gpxTracks,
  focusLocationId,
  onTileLoadFailure,
}: {
  locations: MapLocation[];
  entriesByLocation: Map<number, MapEntry[]>;
  gpxTracks: GpxMapTrack[];
  focusLocationId: number | null;
  onTileLoadFailure: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const visibleTracksInitialized = useRef(false);
  const [layer, setLayer] = useState<MapLayerKey>("streets");
  const [visibleTrackIds, setVisibleTrackIds] = useState<Set<number>>(
    () => new Set(gpxTracks.map(track => track.id))
  );
  const [markerZoom, setMarkerZoom] = useState(12);
  const [resetKey, setResetKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const activeLayer = MAP_LAYERS[layer];

  useEffect(() => {
    if (!gpxTracks.length) return;
    setVisibleTrackIds(previous => {
      const available = new Set(gpxTracks.map(track => track.id));
      const retained = new Set(Array.from(previous).filter(id => available.has(id)));
      if (!visibleTracksInitialized.current) {
        visibleTracksInitialized.current = true;
        gpxTracks.forEach(track => retained.add(track.id));
      }
      return retained;
    });
  }, [gpxTracks]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const visibleTracks = useMemo(
    () => gpxTracks.filter(track => visibleTrackIds.has(track.id)),
    [gpxTracks, visibleTrackIds]
  );

  const toggleTrack = (trackId: number) => {
    setVisibleTrackIds(previous => {
      const next = new Set(previous);
      next.has(trackId) ? next.delete(trackId) : next.add(trackId);
      return next;
    });
  };

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement === rootRef.current) {
      await document.exitFullscreen?.();
    } else {
      await rootRef.current.requestFullscreen?.();
    }
  };

  return (
    <div
      ref={rootRef}
      data-map-shell={fullscreen ? "fullscreen" : "embedded"}
      className={
        fullscreen
          ? "fixed inset-0 z-[2000] h-[100vh] w-screen max-h-none max-w-none overflow-hidden bg-white"
          : "relative"
      }
    >
      <MapContainer
        center={[locations[0].latitude, locations[0].longitude]}
        zoom={12}
        scrollWheelZoom={false}
        data-map-container={fullscreen ? "fullscreen" : "embedded"}
        className={
          fullscreen
            ? "h-[100vh] min-h-[100vh] w-[100vw] max-h-none max-w-none"
            : "h-[360px] w-full sm:h-[440px] lg:h-[560px]"
        }
        aria-label="Live-Standortkarte mit Festival-Standorten und GPX-Strecken"
      >
        <TileLayer
          key={layer}
          attribution={activeLayer.attribution}
          url={activeLayer.url}
          eventHandlers={{ tileerror: onTileLoadFailure }}
        />
        <MapViewport
          locations={locations}
          tracks={gpxTracks}
          visibleTrackIds={visibleTrackIds}
          focusLocationId={focusLocationId}
          resetKey={resetKey}
          fullscreen={fullscreen}
        />
        <MapZoomReporter onZoomChange={setMarkerZoom} />
        {visibleTracks.map(track => (
          <Polyline
            key={track.id}
            positions={track.points}
            pathOptions={{ color: track.color, weight: 4, opacity: 0.92 }}
          >
            <Popup>
              <strong>{track.name}</strong>
              <br />
              <span className="text-xs">GPX-Strecke · {track.points.length.toLocaleString("de-DE")} Punkte</span>
            </Popup>
          </Polyline>
        ))}
        {locations.map(location => (
          <LocationMarker
            key={location.id}
            location={location}
            entries={entriesByLocation.get(location.id) ?? []}
            focused={focusLocationId === location.id}
            zoom={markerZoom}
          />
        ))}
      </MapContainer>

      <div
        data-map-layer-switcher="top-right"
        className="absolute right-3 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1 rounded-md border border-slate-300 bg-white/95 p-1 shadow-md backdrop-blur-sm"
      >
        {(Object.keys(MAP_LAYERS) as MapLayerKey[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`min-h-9 rounded px-3 text-xs font-semibold transition-colors ${
              layer === key
                ? "bg-blue-700 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            aria-pressed={layer === key}
          >
            {MAP_LAYERS[key].label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setResetKey(value => value + 1)}
          className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          title="Ansicht auf alle sichtbaren Standorte und Strecken zurücksetzen"
          aria-label="Kartenansicht zurücksetzen"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex min-h-9 items-center rounded px-2 text-slate-700 hover:bg-slate-100"
          title={fullscreen ? "Vollbild verlassen" : "Karte im Vollbild öffnen"}
          aria-label={fullscreen ? "Vollbild verlassen" : "Karte im Vollbild öffnen"}
        >
          {fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
        </button>
      </div>

      {gpxTracks.length ? (
        <fieldset
          data-gpx-layer-control="bottom-left"
          className="absolute bottom-7 left-3 z-[1000] max-w-[min(20rem,calc(100%-1.5rem))] rounded-md border border-slate-300 bg-white/90 p-2 shadow-md backdrop-blur-sm"
        >
          <legend className="px-1 text-xs font-semibold text-slate-700">Strecken einblenden</legend>
          <div className="space-y-1">
            {gpxTracks.map(track => (
              <label key={track.id} className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 text-xs text-slate-800 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={visibleTrackIds.has(track.id)}
                  onChange={() => toggleTrack(track.id)}
                  className="size-4 accent-blue-700"
                />
                <span className="size-2.5 shrink-0 rounded-full border border-white shadow-sm" style={{ backgroundColor: track.color }} aria-hidden="true" />
                <span className="truncate">{track.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
