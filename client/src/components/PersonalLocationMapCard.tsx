import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import type { MapEntry, MapLocation } from "./LocationMapCard";

const LocationMapClient = lazy(() => import("./LocationMapClient"));

type PersonalLocation = MapLocation & { entries: MapEntry[] };

/**
 * Zeigt ausschließlich Orte mit einer persönlichen Zuständigkeit. Der Marker
 * wird grün, wenn alle dazugehörigen Aufgaben abgeschlossen bzw. besetzt sind.
 */
export function PersonalLocationMapCard({
  locations,
}: {
  locations: PersonalLocation[];
}) {
  const [tileLoadFailed, setTileLoadFailed] = useState(false);
  const entriesByLocation = useMemo(
    () => new Map(locations.map(location => [location.id, location.entries])),
    [locations]
  );
  const markTileLoadFailed = useCallback(() => setTileLoadFailed(true), []);

  return (
    <Card className="overflow-hidden border-blue-200 bg-white py-4 text-slate-950 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <MapPin className="size-5 text-blue-700" aria-hidden="true" />
          Meine Standorte
        </CardTitle>
        <span className="text-xs text-slate-600">
          Nur meine Zuständigkeiten · Grün: alles erledigt oder besetzt
        </span>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Sobald eine deiner Aufgaben oder Schichten einem Ort zugeordnet ist,
            erscheint dieser Standort hier auf der Karte.
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <Suspense
              fallback={
                <div
                  className="h-[300px] animate-pulse bg-slate-100 sm:h-[380px]"
                  aria-label="Persönliche Standortkarte wird geladen"
                />
              }
            >
              <LocationMapClient
                locations={locations}
                entriesByLocation={entriesByLocation}
                gpxTracks={[]}
                focusLocationId={null}
                onTileLoadFailure={markTileLoadFailed}
              />
            </Suspense>
            {tileLoadFailed && (
              <div className="pointer-events-none absolute inset-x-2 bottom-8 rounded bg-white/95 px-2 py-1 text-center text-xs text-slate-700 shadow-sm">
                Der Kartenhintergrund konnte nicht geladen werden. Die persönlichen Standortmarkierungen bleiben verfügbar.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
