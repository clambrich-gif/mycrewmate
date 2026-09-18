import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import { useEffect, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
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

function statusText(entries: MapEntry[]) {
  if (!entries.length) return "Noch keine Aufgaben zugeordnet";
  return entries.some(entry => entry.critical)
    ? "Handlungsbedarf"
    : "Vollständig geprüft";
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
      map.setView([locations[0].latitude, locations[0].longitude], 14, {
        animate: true,
      });
      return;
    }
    map.fitBounds(
      locations.map(location => [location.latitude, location.longitude] as [number, number]),
      { padding: [28, 28], maxZoom: 14, animate: true }
    );
  }, [focusLocationId, locations, map]);

  return null;
}

function LocationMarker({
  location,
  entries,
  focused,
}: {
  location: MapLocation;
  entries: MapEntry[];
  focused: boolean;
}) {
  const markerRef = useRef<LeafletCircleMarker | null>(null);
  const critical = entries.some(entry => entry.critical);
  const color = entries.length
    ? critical
      ? MAP_MARKER_COLORS.critical
      : MAP_MARKER_COLORS.complete
    : MAP_MARKER_COLORS.neutral;

  useEffect(() => {
    if (!focused) return;
    const timeout = window.setTimeout(() => markerRef.current?.openPopup(), 120);
    return () => window.clearTimeout(timeout);
  }, [focused]);

  return (
    <CircleMarker
      ref={markerRef}
      center={[location.latitude, location.longitude]}
      radius={10}
      pathOptions={{
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }}
      aria-label={`${location.name}: ${statusText(entries)}`}
    >
      <Popup>
        <div className="min-w-52 text-slate-900">
          <strong className="block text-sm">{location.name}</strong>
          <p className="mt-1 text-xs text-slate-600">{statusText(entries)}</p>
          {entries.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.label}-${index}`}
                  className={entry.critical ? "text-red-700" : "text-emerald-700"}
                >
                  <span aria-hidden="true">● </span>
                  {entry.label} – {entry.status}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function LocationMapClient({
  locations,
  entriesByLocation,
  focusLocationId,
  onTileLoadFailure,
}: {
  locations: MapLocation[];
  entriesByLocation: Map<number, MapEntry[]>;
  focusLocationId: number | null;
  onTileLoadFailure: () => void;
}) {
  return (
    <MapContainer
      center={[locations[0].latitude, locations[0].longitude]}
      zoom={12}
      scrollWheelZoom={false}
      className="h-64 w-full sm:h-72"
      aria-label="Live-Standortkarte mit Festival-Standorten"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: onTileLoadFailure }}
      />
      <MapViewport locations={locations} focusLocationId={focusLocationId} />
      {locations.map(location => (
        <LocationMarker
          key={location.id}
          location={location}
          entries={entriesByLocation.get(location.id) ?? []}
          focused={focusLocationId === location.id}
        />
      ))}
    </MapContainer>
  );
}
