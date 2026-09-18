import { MapPin } from "lucide-react";

type LocationReference = {
  id: number;
  name: string;
};

type LocationMapLinkProps = {
  locationId: number | null | undefined;
  locations: LocationReference[];
  className?: string;
};

/**
 * Verknüpft einen bereits zugeordneten Standort mit seiner fokussierten
 * Dashboard-Karte. Über die ID bleibt die Navigation stabil, angezeigt wird
 * aber stets der für Planende verständliche Ortsname.
 */
export function LocationMapLink({
  locationId,
  locations,
  className = "",
}: LocationMapLinkProps) {
  const location = locations.find(candidate => candidate.id === locationId);
  if (!location) return null;

  return (
    <a
      href={`/?location=${location.id}`}
      className={`inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${className}`}
      aria-label={`${location.name} auf der Live-Standortkarte anzeigen`}
      title={`${location.name} auf der Live-Standortkarte anzeigen`}
    >
      <MapPin className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{location.name}</span>
    </a>
  );
}
