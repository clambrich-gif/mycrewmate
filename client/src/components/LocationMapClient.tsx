import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { MapEntry, MapLocation } from "./LocationMapCard";
import "leaflet/dist/leaflet.css";

const MAP_MARKER_COLORS = {
  critical: "#dc2626",
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
type GpxTrack = { id: number; name: string; fileUrl: string; color: string };
type TrackPoints = { id: number; name: string; color: string; points: [number, number][] };

function statusText(entries: MapEntry[]) {
  if (!entries.length) return "Noch keine Aufgaben zugeordnet";
  return entries.some(entry => entry.critical)
    ? "Handlungsbedarf"
    : "Vollständig geprüft";
}

function parseGpxPoints(xml: string): [number, number][] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("GPX-Datei konnte nicht gelesen werden");
  return Array.from(document.querySelectorAll("trkpt, rtept"))
    .map(point => [Number(point.getAttribute("lat")), Number(point.getAttribute("lon"))] as [number, number])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
}

function MapViewport({
  locations,
  focusLocationId,
}: {
  locations: MapLocation[];
  focusLocationId: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    const focused = locations.find(location => location.id === focusLocationId);
    if (focused) {
      map.setView([focused.latitude, focused.longitude], 16, { animate: true });
      return;
    }
    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 14, { animate: true });
      return;
    }
    map.fitBounds(
      locations.map(location => [location.latitude, location.longitude] as [number, number]),
      { padding: [36, 36], maxZoom: 14, animate: true }
    );
  }, [focusLocationId, locations, map]);
  return null;
}

function GpxOverlays({ tracks }: { tracks: GpxTrack[] }) {
  const [loadedTracks, setLoadedTracks] = useState<TrackPoints[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all(
      tracks.map(async track => {
        const response = await fetch(track.fileUrl);
        if (!response.ok) throw new Error(`GPX ${response.status}`);
        const points = parseGpxPoints(await response.text());
        return { id: track.id, name: track.name, color: track.color, points };
      })
    )
      .then(parsed => {
        if (live) setLoadedTracks(parsed.filter(track => track.points.length >= 2));
      })
      .catch(error => {
        console.warn("[Karte] GPX-Strecke konnte nicht geladen werden", error);
        if (live) setLoadedTracks([]);
      });
    return () => { live = false; };
  }, [tracks]);

  return <>{loadedTracks.map(track => (
    <Polyline key={track.id} positions={track.points} pathOptions={{ color: track.color, weight: 4, opacity: 0.9 }}>
      <Popup><strong>{track.name}</strong><br /><span className="text-xs">GPX-Strecke</span></Popup>
    </Polyline>
  ))}</>;
}

function LocationMarker({ location, entries, focused }: { location: MapLocation; entries: MapEntry[]; focused: boolean }) {
  const markerRef = useRef<LeafletCircleMarker | null>(null);
  const critical = entries.some(entry => entry.critical);
  const color = entries.length ? critical ? MAP_MARKER_COLORS.critical : MAP_MARKER_COLORS.complete : MAP_MARKER_COLORS.neutral;
  useEffect(() => {
    if (!focused) return;
    const timeout = window.setTimeout(() => markerRef.current?.openPopup(), 120);
    return () => window.clearTimeout(timeout);
  }, [focused]);
  return (
    <CircleMarker ref={markerRef} center={[location.latitude, location.longitude]} radius={11} pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }} aria-label={`${location.name}: ${statusText(entries)}`}>
      <Popup>
        <div className="min-w-56 text-slate-900">
          <strong className="block text-sm">{location.name}</strong>
          <p className="mt-1 text-xs text-slate-600">{statusText(entries)}</p>
          {entries.length ? <ul className="mt-2 space-y-2 text-sm">{entries.map((entry, index) => (
            <li key={`${entry.label}-${index}`} className={entry.critical ? "text-red-700" : "text-emerald-700"}>
              <span aria-hidden="true">● </span><span className="font-medium">{entry.label}</span><span className="text-xs"> – {entry.status}</span>
              {entry.href && entry.actionLabel && <a href={entry.href} className="ml-3 inline-block text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">{entry.actionLabel}</a>}
            </li>
          ))}</ul> : null}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function LocationMapClient({ locations, entriesByLocation, gpxTracks, focusLocationId, onTileLoadFailure }: { locations: MapLocation[]; entriesByLocation: Map<number, MapEntry[]>; gpxTracks: GpxTrack[]; focusLocationId: number | null; onTileLoadFailure: () => void }) {
  const [layer, setLayer] = useState<MapLayerKey>("streets");
  const activeLayer = MAP_LAYERS[layer];
  return (
    <div className="relative">
      <MapContainer center={[locations[0].latitude, locations[0].longitude]} zoom={12} scrollWheelZoom={false} className="h-[360px] w-full sm:h-[440px] lg:h-[560px]" aria-label="Live-Standortkarte mit Festival-Standorten und GPX-Strecken">
        <TileLayer key={layer} attribution={activeLayer.attribution} url={activeLayer.url} eventHandlers={{ tileerror: onTileLoadFailure }} />
        <MapViewport locations={locations} focusLocationId={focusLocationId} />
        <GpxOverlays tracks={gpxTracks} />
        {locations.map(location => <LocationMarker key={location.id} location={location} entries={entriesByLocation.get(location.id) ?? []} focused={focusLocationId === location.id} />)}
      </MapContainer>
      <div
        data-map-layer-switcher="top-right"
        className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-md"
      >
        {(Object.keys(MAP_LAYERS) as MapLayerKey[]).map(key => <button key={key} type="button" onClick={() => setLayer(key)} className={`min-h-9 px-3 text-xs font-semibold transition-colors ${layer === key ? "bg-blue-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`} aria-pressed={layer === key}>{MAP_LAYERS[key].label}</button>)}
      </div>
    </div>
  );
}
