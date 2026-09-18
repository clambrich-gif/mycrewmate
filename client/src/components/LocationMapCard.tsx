import { MapView } from "@/components/Map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "wouter";

type MapLocation = { id: number; name: string; latitude: number; longitude: number };

type MapEntry = { label: string; status: string; critical: boolean };

function popupContent(location: MapLocation, entries: MapEntry[]) {
  const root = document.createElement("div");
  root.className = "min-w-[190px] p-1 text-slate-900";
  const title = document.createElement("strong");
  title.textContent = location.name;
  root.append(title);
  const list = document.createElement("ul");
  list.className = "mt-2 space-y-1 text-sm";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.textContent = `${entry.critical ? "●" : "●"} ${entry.label} – ${entry.status}`;
    item.style.color = entry.critical ? "#b91c1c" : "#047857";
    list.append(item);
  }
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "Noch keine Aufgaben zugeordnet";
    item.style.color = "#64748b";
    list.append(item);
  }
  root.append(list);
  return root;
}

export function LocationMapCard() {
  const [searchParams] = useSearchParams();
  const focusLocationId = Number(searchParams.get("location")) || null;
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const { data: evaluations = [] } = trpc.plan.evaluate.useQuery();
  const { data: preparation = [] } = trpc.prep.list.useQuery();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);

  const entriesByLocation = useMemo(() => {
    const entries = new Map<number, MapEntry[]>();
    const add = (locationId: number | null | undefined, entry: MapEntry) => {
      if (!locationId) return;
      const current = entries.get(locationId) ?? [];
      current.push(entry);
      entries.set(locationId, current);
    };
    for (const evaluation of evaluations) {
      const shift = evaluation.shift as { locationId?: number | null; day: string; area: string; task: string };
      add(shift.locationId, {
        label: `${shift.day} · ${shift.area}: ${shift.task}`,
        status: evaluation.status,
        critical: evaluation.status === "OFFEN" || evaluation.status === "KNAPP",
      });
    }
    for (const task of preparation as Array<{ locationId?: number | null; category: string; task: string; status: string }>) {
      add(task.locationId, {
        label: `${task.category || "Vorbereitung"}: ${task.task}`,
        status: task.status === "erledigt" ? "ERLEDIGT" : task.status.toUpperCase(),
        critical: task.status !== "erledigt",
      });
    }
    return entries;
  }, [evaluations, preparation]);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [];
    infoWindow.current ??= new window.google.maps.InfoWindow();
    const bounds = new window.google.maps.LatLngBounds();
    const validLocations = locations.filter(
      (location: MapLocation) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ) as MapLocation[];
    for (const location of validLocations) {
      const entries = entriesByLocation.get(location.id) ?? [];
      const critical = entries.some(entry => entry.critical);
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: location.latitude, lng: location.longitude },
        title: `${location.name}: ${critical ? "Handlungsbedarf" : "geprüft"}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: critical ? "#dc2626" : "#16a34a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 9,
        },
      });
      marker.addListener("click", () => {
        infoWindow.current?.setContent(popupContent(location, entries));
        infoWindow.current?.open({ map, anchor: marker });
      });
      markers.current.push(marker);
      bounds.extend(marker.getPosition()!);
      if (focusLocationId === location.id) {
        map.setCenter({ lat: location.latitude, lng: location.longitude });
        map.setZoom(16);
        infoWindow.current.setContent(popupContent(location, entries));
        infoWindow.current.open({ map, anchor: marker });
      }
    }
    if (!focusLocationId && validLocations.length > 1) map.fitBounds(bounds, 40);
    else if (!focusLocationId && validLocations.length === 1) {
      map.setCenter({ lat: validLocations[0].latitude, lng: validLocations[0].longitude });
      map.setZoom(14);
    }
    return () => markers.current.forEach(marker => marker.setMap(null));
  }, [map, locations, entriesByLocation, focusLocationId]);

  return (
    <Card data-dashboard-section="Live-Standortkarte" className="h-full overflow-hidden border-blue-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 p-3 pb-2 sm:p-4 sm:pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <MapPin className="size-5 text-blue-700" aria-hidden="true" />
          Live-Standortkarte
        </CardTitle>
        <span className="text-xs text-slate-600">Rot: Handlungsbedarf · Grün: geprüft</span>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        {locations.length === 0 ? (
          <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-600">
            Noch keine Orte hinterlegt. Orte & Standorte öffnen, um die Karte zu aktivieren.
          </div>
        ) : (
          <MapView
            className="h-64 overflow-hidden rounded-lg border border-slate-200 sm:h-72"
            initialCenter={{ lat: locations[0].latitude, lng: locations[0].longitude }}
            initialZoom={12}
            onMapReady={setMap}
          />
        )}
      </CardContent>
    </Card>
  );
}
