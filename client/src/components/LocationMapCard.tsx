import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MapPin } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "wouter";

const LocationMapClient = lazy(() => import("./LocationMapClient"));

export type MapLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
};

export type MapEntry = {
  section: "preparation" | "shifts" | "materials";
  label: string;
  status: string;
  critical: boolean;
  severity: "critical" | "warning" | "complete" | "neutral";
  href?: string;
  actionLabel?: string;
};

export function LocationMapCard() {
  const [searchParams] = useSearchParams();
  const focusLocationId = Number(searchParams.get("location")) || null;
  const scrollToMap = searchParams.get("scroll") === "map";
  const mapScrollTargetRef = useRef<HTMLDivElement | null>(null);
  const consumedScrollFocusRef = useRef<string | null>(null);
  const { data: rawLocations = [] } = trpc.locations.list.useQuery();
  const { data: evaluations = [] } = trpc.plan.evaluate.useQuery();
  const { data: preparation = [] } = trpc.prep.list.useQuery();
  const { data: materials = [] } = trpc.materials.list.useQuery();
  const { data: gpxTracks = [] } = trpc.gpxTracks.mapData.useQuery();
  const [tileLoadFailed, setTileLoadFailed] = useState(false);
  const markTileLoadFailed = useCallback(() => setTileLoadFailed(true), []);

  useEffect(() => {
    if (!scrollToMap || focusLocationId === null) {
      consumedScrollFocusRef.current = null;
    }
  }, [focusLocationId, scrollToMap]);

  const scrollFocusedLocationIntoView = useCallback(
    (loadedLocationId: number) => {
      const scrollKey = `${focusLocationId}:${loadedLocationId}`;
      if (
        !scrollToMap ||
        focusLocationId !== loadedLocationId ||
        consumedScrollFocusRef.current === scrollKey
      ) {
        return;
      }

      consumedScrollFocusRef.current = scrollKey;
      window.requestAnimationFrame(() => {
        mapScrollTargetRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      });
    },
    [focusLocationId, scrollToMap]
  );

  const locations = useMemo(
    () =>
      (rawLocations as MapLocation[]).filter(
        location =>
          Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
      ),
    [rawLocations]
  );

  const entriesByLocation = useMemo(() => {
    const entries = new Map<number, MapEntry[]>();
    const add = (locationId: number | null | undefined, entry: MapEntry) => {
      if (!locationId) return;
      const current = entries.get(locationId) ?? [];
      current.push(entry);
      entries.set(locationId, current);
    };
    for (const evaluation of evaluations) {
      const shift = evaluation.shift as {
        locationId?: number | null;
        day: string;
        area: string;
        task: string;
      };
      add(shift.locationId, {
        section: "shifts",
        label: `${shift.day} · ${shift.area}: ${shift.task}`,
        status: evaluation.status,
        critical: evaluation.status === "OFFEN",
        severity:
          evaluation.status === "OFFEN"
            ? "critical"
            : evaluation.status === "KNAPP"
              ? "warning"
              : "complete",
        href: `/einsatzplan?location=${shift.locationId}`,
        actionLabel: "Einsatzplan filtern",
      });
    }
    for (const task of preparation as Array<{
      locationId?: number | null;
      category: string;
      task: string;
      status: string;
    }>) {
      add(task.locationId, {
        section: "preparation",
        label: `${task.category || "Vorbereitung"}: ${task.task}`,
        status: task.status === "erledigt" ? "ERLEDIGT" : task.status.toUpperCase(),
        critical: task.status === "offen" || task.status === "abgelehnt",
        severity:
          task.status === "offen" || task.status === "abgelehnt"
            ? "critical"
            : task.status === "inArbeit"
              ? "warning"
              : "complete",
        href: `/vorbereitung?location=${task.locationId}`,
        actionLabel: "Vorbereitung filtern",
      });
    }
    for (const material of materials as Array<{
      locationId?: number | null;
      article: string;
      quantity: string;
      unit: string;
      status: "offen" | "bestellt" | "geliefert";
    }>) {
      const status = material.status ?? "offen";
      add(material.locationId, {
        section: "materials",
        label: `Material: ${material.article}`,
        status:
          status === "geliefert"
            ? "GELIEFERT"
            : status === "bestellt"
              ? "BESTELLT"
              : "OFFEN",
        critical: status === "offen",
        severity:
          status === "offen"
            ? "critical"
            : status === "bestellt"
              ? "warning"
              : "complete",
        href: `/material?location=${material.locationId}`,
        actionLabel: "Material öffnen",
      });
    }
    return entries;
  }, [evaluations, materials, preparation]);

  return (
    <div
      ref={mapScrollTargetRef}
      id="live-standortkarte"
      data-map-scroll-target="true"
      className="scroll-mt-4"
    >
      <Card
        data-dashboard-section="Live-Standortkarte"
        className="overflow-hidden border-blue-200 bg-white shadow-sm"
      >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <MapPin className="size-5 text-blue-700" aria-hidden="true" />
          Live-Standortkarte
        </CardTitle>
        <span className="text-xs text-slate-600 sm:text-sm">
          Rot: offen · Gelb: in Arbeit, zeitlich knapp oder bestellt · Grün: geprüft / geliefert · Marker öffnen zum Filtern
        </span>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
        {!locations.length ? (
          <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-600">
            Noch keine Orte hinterlegt. Orte &amp; Standorte öffnen, um die Karte zu aktivieren.
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <Suspense
              fallback={
                <div
                  className="h-[360px] animate-pulse bg-slate-100 sm:h-[440px] lg:h-[560px]"
                  aria-label="Standortkarte wird geladen"
                />
              }
            >
              <LocationMapClient
                locations={locations}
                entriesByLocation={entriesByLocation}
                gpxTracks={gpxTracks}
                focusLocationId={focusLocationId}
                onTileLoadFailure={markTileLoadFailed}
                onFocusedLocationReady={scrollFocusedLocationIntoView}
              />
            </Suspense>
            {tileLoadFailed && (
              <div className="pointer-events-none absolute inset-x-2 bottom-8 rounded bg-white/95 px-2 py-1 text-center text-xs text-slate-700 shadow-sm">
                Der Kartenhintergrund konnte nicht geladen werden. Die Standortmarkierungen bleiben verfügbar.
              </div>
            )}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
