import { divIcon } from "leaflet";
import type {
  CircleMarker as LeafletCircleMarker,
  Marker as LeafletMarker,
} from "leaflet";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { LocationDetailContent } from "./LocationDetailContent";
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
  onFocusedLocationReady,
}: {
  locations: MapLocation[];
  tracks: GpxMapTrack[];
  visibleTrackIds: Set<number>;
  focusLocationId: number | null;
  resetKey: number;
  fullscreen: boolean;
  onFocusedLocationReady?: (locationId: number) => void;
}) {
  const map = useMap();
  const locationViewportKey = locations
    .map(location => `${location.id}:${location.latitude}:${location.longitude}`)
    .join("|");
  const visibleTrackViewportKey = tracks
    .filter(track => visibleTrackIds.has(track.id))
    .map(track => `${track.id}:${track.points.map(point => point.join(",")).join(";")}`)
    .join("|");
  const focusLocationViewportKey =
    focusLocationId === null
      ? null
      : locations
          .filter(location => location.id === focusLocationId)
          .map(location => `${location.id}:${location.latitude}:${location.longitude}`)
          .join("|");

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
      let readyReported = false;
      const reportFocusedLocationReady = () => {
        if (readyReported) return;
        readyReported = true;
        map.invalidateSize({ pan: false, debounceMoveend: true });
        onFocusedLocationReady?.(focused.id);
      };
      map.setView([focused.latitude, focused.longitude], 16, { animate: true });
      map.once("moveend", reportFocusedLocationReady);
      const fallback = window.setTimeout(reportFocusedLocationReady, 360);
      return () => {
        map.off("moveend", reportFocusedLocationReady);
        window.clearTimeout(fallback);
      };
    }
    const points = mapBoundsPoints(locations, tracks, visibleTrackIds);
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 14, animate: true });
    }
  }, [
    focusLocationId,
    focusLocationViewportKey,
    fullscreen,
    locationViewportKey,
    map,
    onFocusedLocationReady,
    resetKey,
    visibleTrackViewportKey,
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

const LocationMarker = memo(function LocationMarker({
  location,
  entries,
  zoom,
  onLocationDetailsOpen,
}: {
  location: MapLocation;
  entries: MapEntry[];
  zoom: number;
  onLocationDetailsOpen: (location: MapLocation) => void;
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

  const markerEvents = {
    click: () => onLocationDetailsOpen(location),
  };

  if (logoIcon)
    return (
      <Marker
        ref={logoMarkerRef}
        position={[location.latitude, location.longitude]}
        icon={logoIcon}
        aria-label={`${location.name}: ${statusText(entries)}`}
        eventHandlers={markerEvents}
      />
    );

  return (
    <CircleMarker
      ref={circleMarkerRef}
      center={[location.latitude, location.longitude]}
      radius={Math.max(9, size / 3.6)}
      pathOptions={{
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
        className: "location-map-marker",
      }}
      aria-label={`${location.name}: ${statusText(entries)}`}
      eventHandlers={markerEvents}
    />
  );
});

export default function LocationMapClient({
  locations,
  entriesByLocation,
  gpxTracks,
  focusLocationId,
  onTileLoadFailure,
  onFocusedLocationReady,
}: {
  locations: MapLocation[];
  entriesByLocation: Map<number, MapEntry[]>;
  gpxTracks: GpxMapTrack[];
  focusLocationId: number | null;
  onTileLoadFailure: () => void;
  onFocusedLocationReady?: (locationId: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [layer, setLayer] = useState<MapLayerKey>("streets");
  // Strecken werden bewusst nicht automatisch eingeblendet: Die Karte bleibt
  // beim Aufruf übersichtlich und Planende wählen gezielt die benötigte Route.
  const [visibleTrackIds, setVisibleTrackIds] = useState<Set<number>>(
    () => new Set()
  );
  const [markerZoom, setMarkerZoom] = useState(12);
  const [resetKey, setResetKey] = useState(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [mapToolbarOpen, setMapToolbarOpen] = useState(true);
  const [trackControlOpen, setTrackControlOpen] = useState(true);
  const fullscreen = nativeFullscreen || cssFullscreen;
  const isMobile = useIsMobile();
  // Es wird ausschließlich die Standort-ID gespeichert. Dadurch bleiben der
  // geöffnete Standort und sein Reiter stabil, während Inhalte im Hintergrund
  // neu geladen werden.
  const [mobileLocationId, setMobileLocationId] = useState<number | null>(null);
  const [desktopLocationId, setDesktopLocationId] = useState<number | null>(null);
  const dismissedMobileFocusRef = useRef(new Set<number>());
  const openedFocusLocationIdRef = useRef<number | null>(null);
  const activeLayer = MAP_LAYERS[layer];
  const detailsForLocation = useCallback(
    (locationId: number | null) => {
      if (locationId === null) return null;
      const location = locations.find(candidate => candidate.id === locationId);
      if (!location) return null;
      return {
        location,
        entries: entriesByLocation.get(locationId) ?? [],
      };
    },
    [entriesByLocation, locations]
  );
  const mobileLocationDetails = detailsForLocation(mobileLocationId);
  const desktopLocationDetails = detailsForLocation(desktopLocationId);
  const mobileNavigationLocations = useMemo(
    () => [...locations].sort((left, right) => left.name.localeCompare(right.name, "de")),
    [locations]
  );
  const mobileLocationIndex = mobileLocationDetails
    ? mobileNavigationLocations.findIndex(
        location => location.id === mobileLocationDetails.location.id
      )
    : -1;
  const previousMobileLocation =
    mobileLocationIndex > 0
      ? mobileNavigationLocations[mobileLocationIndex - 1]
      : null;
  const nextMobileLocation =
    mobileLocationIndex >= 0 && mobileLocationIndex < mobileNavigationLocations.length - 1
      ? mobileNavigationLocations[mobileLocationIndex + 1]
      : null;
  const activeLocationId =
    mobileLocationId ??
    desktopLocationId ??
    focusLocationId;

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === rootRef.current;
      setNativeFullscreen(active);
      if (active) setCssFullscreen(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setMapToolbarOpen(false);
    setTrackControlOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!cssFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [cssFullscreen]);

  useEffect(() => {
    if (!cssFullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCssFullscreen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [cssFullscreen]);

  useEffect(() => {
    if (focusLocationId !== null && !dismissedMobileFocusRef.current.has(focusLocationId)) {
      dismissedMobileFocusRef.current.clear();
    }
  }, [focusLocationId]);

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
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }
    if (document.fullscreenElement === rootRef.current) {
      await document.exitFullscreen?.();
      return;
    }

    // iOS Safari bietet für beliebige DIV-Container keine native Fullscreen-API.
    // In diesem Fall übernimmt das CSS-Overlay denselben sichtbaren Vollbildmodus.
    if (!document.fullscreenEnabled || !rootRef.current.requestFullscreen) {
      setCssFullscreen(true);
      return;
    }

    try {
      await rootRef.current.requestFullscreen();
      window.setTimeout(() => {
        if (document.fullscreenElement !== rootRef.current) setCssFullscreen(true);
      }, 180);
    } catch {
      setCssFullscreen(true);
    }
  };

  const closeMobileDetails = useCallback(() => {
    if (focusLocationId !== null) dismissedMobileFocusRef.current.add(focusLocationId);
    if (mobileLocationId !== null) dismissedMobileFocusRef.current.add(mobileLocationId);
    setMobileLocationId(null);
  }, [focusLocationId, mobileLocationId]);

  const openMobileDetails = useCallback((
    location: MapLocation,
    source: "marker" | "focus"
  ) => {
    if (!isMobile) return;
    if (source === "focus" && dismissedMobileFocusRef.current.has(location.id)) return;
    if (source === "marker") dismissedMobileFocusRef.current.delete(location.id);
    setMobileLocationId(location.id);
  }, [isMobile]);

  const openLocationDetails = useCallback((
    location: MapLocation,
    source: "marker" | "focus"
  ) => {
    if (isMobile) {
      openMobileDetails(location, source);
      return;
    }
    setDesktopLocationId(location.id);
  }, [isMobile, openMobileDetails]);

  const closeDesktopDetails = useCallback(() => {
    setDesktopLocationId(null);
  }, []);

  const navigateMobileLocation = useCallback((location: MapLocation | null) => {
    if (!location) return;
    dismissedMobileFocusRef.current.delete(location.id);
    setMobileLocationId(location.id);
  }, []);

  useEffect(() => {
    if (focusLocationId === null) {
      openedFocusLocationIdRef.current = null;
      return;
    }
    if (openedFocusLocationIdRef.current === focusLocationId) return;

    const location = locations.find(candidate => candidate.id === focusLocationId);
    if (!location) return;

    // Ein Link zu einem Standort öffnet dessen Details genau einmal. Spätere
    // Datenabgleiche verändern weder die Auswahl noch den aktiven Detailreiter.
    openedFocusLocationIdRef.current = focusLocationId;
    openLocationDetails(location, "focus");
  }, [focusLocationId, locations, openLocationDetails]);

  return (
    <div
      ref={rootRef}
      data-map-shell={fullscreen ? "fullscreen" : "embedded"}
      data-map-fullscreen-mode={
        cssFullscreen ? "css-fallback" : nativeFullscreen ? "native" : "embedded"
      }
      className={
        fullscreen
          ? `fixed inset-0 z-[2000] h-[100vh] w-screen max-h-none max-w-none overflow-hidden bg-white${
              cssFullscreen ? " mobile-fullscreen" : ""
            }`
          : "relative z-0 isolate"
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
          focusLocationId={activeLocationId}
          resetKey={resetKey}
          fullscreen={fullscreen}
          onFocusedLocationReady={onFocusedLocationReady}
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
            zoom={markerZoom}
            onLocationDetailsOpen={location =>
              openLocationDetails(location, "marker")
            }
          />
        ))}
      </MapContainer>

      <div className="absolute right-3 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-1">
        {isMobile && !mapToolbarOpen ? (
          <button
            type="button"
            data-map-layer-toggle="top-right"
            onClick={() => setMapToolbarOpen(true)}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-slate-300 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Kartensteuerung einblenden"
            title="Kartensteuerung einblenden"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        {(!isMobile || mapToolbarOpen) && (
          <div
            data-map-layer-switcher="top-right"
            className="flex max-w-full flex-wrap justify-end gap-1 rounded-md border border-slate-300 bg-white/95 p-1 shadow-md backdrop-blur-sm"
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
            {isMobile && (
              <button
                type="button"
                onClick={() => setMapToolbarOpen(false)}
                className="inline-flex min-h-9 items-center rounded px-2 text-slate-700 hover:bg-slate-100"
                aria-label="Kartensteuerung ausblenden"
                title="Kartensteuerung ausblenden"
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {desktopLocationDetails && !isMobile ? (
        <aside
          data-location-desktop-panel="true"
          aria-label={`Standortdetails für ${desktopLocationDetails.location.name}`}
          className="absolute bottom-3 right-3 top-16 z-[1100] flex w-[min(25rem,calc(100%-1.5rem))] max-h-[80vh] overflow-hidden rounded-xl border border-slate-200 bg-white/97 shadow-xl backdrop-blur-sm"
        >
          <div className="min-h-0 w-full overflow-y-auto overscroll-contain p-4">
            <LocationDetailContent
              location={desktopLocationDetails.location}
              entries={desktopLocationDetails.entries}
              statusText={statusText(desktopLocationDetails.entries)}
              onClose={closeDesktopDetails}
            />
          </div>
        </aside>
      ) : null}

      {gpxTracks.length ? (
        <section
          data-gpx-layer-control="bottom-left"
          className="absolute bottom-7 left-3 z-[1000] max-w-[min(20rem,calc(100%-1.5rem))] overflow-hidden rounded-md border border-slate-300 bg-white/90 shadow-md backdrop-blur-sm"
          aria-label="GPX-Streckensteuerung"
        >
          <button
            type="button"
            data-gpx-layer-toggle="bottom-left"
            onClick={() => setTrackControlOpen(open => !open)}
            className="flex min-h-10 w-full items-center justify-between gap-3 px-3 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            aria-expanded={trackControlOpen}
          >
            <span>Strecken einblenden</span>
            <ChevronDown className={`size-4 transition-transform ${trackControlOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {trackControlOpen && (
            <div className="space-y-1 border-t border-slate-200 p-2">
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
          )}
        </section>
      ) : null}

      <Sheet
        open={Boolean(mobileLocationDetails)}
        onOpenChange={open => {
          if (!open) closeMobileDetails();
        }}
      >
        <SheetContent
          side="bottom"
          data-location-mobile-sheet="true"
          overlayClassName="z-30 bg-slate-950/45"
          className="z-[31] max-h-[70vh] min-h-0 gap-0 overflow-hidden rounded-t-2xl border-slate-200 p-0 pb-[env(safe-area-inset-bottom)]"
          showClose={false}
        >
          {mobileLocationDetails && (
            <>
              <SheetHeader className="relative shrink-0 border-b border-slate-100 px-5 pb-3 pt-5 pr-16 text-left">
                <SheetTitle>{mobileLocationDetails.location.name}</SheetTitle>
                <SheetDescription>
                  Standortdetails und direkte Filteraktionen
                </SheetDescription>
                <button
                  type="button"
                  onClick={closeMobileDetails}
                  data-location-mobile-sheet-close="true"
                  className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  aria-label="Standortdetails schließen"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
                {mobileNavigationLocations.length > 1 ? (
                  <div
                    className="mt-3 flex items-center justify-between gap-2"
                    aria-label="Zwischen Festivalstandorten wechseln"
                    data-location-mobile-navigation="true"
                  >
                    <button
                      type="button"
                      onClick={() => navigateMobileLocation(previousMobileLocation)}
                      disabled={!previousMobileLocation}
                      data-location-mobile-previous="true"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={
                        previousMobileLocation
                          ? `Vorheriger Standort: ${previousMobileLocation.name}`
                          : "Kein vorheriger Standort"
                      }
                    >
                      <ChevronLeft className="size-5" aria-hidden="true" />
                      <span className="sr-only">Vorheriger Standort</span>
                    </button>
                    <span
                      className="text-center text-xs font-medium text-slate-500"
                      aria-live="polite"
                    >
                      Standort {mobileLocationIndex + 1} von {mobileNavigationLocations.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigateMobileLocation(nextMobileLocation)}
                      disabled={!nextMobileLocation}
                      data-location-mobile-next="true"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={
                        nextMobileLocation
                          ? `Nächster Standort: ${nextMobileLocation.name}`
                          : "Kein nächster Standort"
                      }
                    >
                      <ChevronRight className="size-5" aria-hidden="true" />
                      <span className="sr-only">Nächster Standort</span>
                    </button>
                  </div>
                ) : null}
              </SheetHeader>
              <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 pt-4">
                <LocationDetailContent
                  location={mobileLocationDetails.location}
                  entries={mobileLocationDetails.entries}
                  statusText={statusText(mobileLocationDetails.entries)}
                  mobile
                  showHeading={false}
                  onClose={closeMobileDetails}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
