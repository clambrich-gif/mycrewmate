import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MapPin } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "wouter";

const LocationMapClient = lazy(() => import("./LocationMapClient"));

export type MapLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

export type MapEntry = {
  label: string;
  status: string;
  critical: boolean;
};

export function LocationMapCard() {
  const [searchParams] = useSearchParams();
  const focusLocationId = Number(searchParams.get("location")) || null;
  const { data: rawLocations = [] } = trpc.locations.list.useQuery();
  const { data: evaluations = [] } = trpc.plan.evaluate.useQuery();
  const { data: preparation = [] } = trpc.prep.list.useQuery();
  const [tileLoadFailed, setTileLoadFailed] = useState(false);

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
        label: `${shift.day} · ${shift.area}: ${shift.task}`,
        status: evaluation.status,
        critical: evaluation.status === "OFFEN" || evaluation.status === "KNAPP",
      });
    }
    for (const task of preparation as Array<{
      locationId?: number | null;
      category: string;
      task: string;
      status: string;
    }>) {
      add(task.locationId, {
        label: `${task.category || "Vorbereitung"}: ${task.task}`,
        status: task.status === "erledigt" ? "ERLEDIGT" : task.status.toUpperCase(),
        critical: task.status !== "erledigt",
      });
    }
    return entries;
  }, [evaluations, preparation]);

  return (
    <Card
      data-dashboard-section="Live-Standortkarte"
      className="h-full overflow-hidden border-blue-200 bg-white shadow-sm"
    >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 p-3 pb-2 sm:p-4 sm:pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <MapPin className="size-5 text-blue-700" aria-hidden="true" />
          Live-Standortkarte
        </CardTitle>
        <span className="text-xs text-slate-600">
          Rot: Handlungsbedarf · Grün: geprüft
        </span>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        {!locations.length ? (
          <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-600">
            Noch keine Orte hinterlegt. Orte &amp; Standorte öffnen, um die Karte zu aktivieren.
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-slate-200">
            <Suspense
              fallback={
                <div className="h-64 animate-pulse bg-slate-100 sm:h-72" aria-label="Standortkarte wird geladen" />
              }
            >
              <LocationMapClient
                locations={locations}
                entriesByLocation={entriesByLocation}
                focusLocationId={focusLocationId}
                onTileLoadFailure={() => setTileLoadFailed(true)}
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
  );
}
