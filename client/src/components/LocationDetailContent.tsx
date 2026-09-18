import { Button } from "@/components/ui/button";
import type { MapEntry, MapLocation } from "./LocationMapCard";

type LocationDetailContentProps = {
  location: MapLocation;
  entries: MapEntry[];
  statusText: string;
  entryClassName: (severity: MapEntry["severity"]) => string;
  mobile?: boolean;
  showHeading?: boolean;
  onClose?: () => void;
};

/** Gemeinsame Standortdetails für Leaflet-Popup und mobiles Bottom-Sheet. */
export function LocationDetailContent({
  location,
  entries,
  statusText,
  entryClassName,
  mobile = false,
  showHeading = true,
  onClose,
}: LocationDetailContentProps) {
  return (
    <div
      data-location-detail-content={mobile ? "mobile-sheet" : "desktop-popup"}
      className={mobile ? "min-w-0 text-slate-900" : "min-w-56 text-slate-900"}
    >
      {showHeading && (
        <div className="pr-8">
          <strong className="block text-base leading-6">{location.name}</strong>
          <p className="mt-1 text-sm text-slate-600">{statusText}</p>
        </div>
      )}
      {!showHeading && <p className="text-sm text-slate-600">{statusText}</p>}
      {entries.length ? (
        <ul className="mt-3 space-y-3 text-sm">
          {entries.map((entry, index) => (
            <li
              key={`${entry.label}-${index}`}
              className={entryClassName(entry.severity)}
            >
              <div className="flex gap-1.5">
                <span aria-hidden="true" className="mt-0.5">●</span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{entry.label}</span>
                  <span className="text-xs"> – {entry.status}</span>
                  {entry.href && entry.actionLabel ? (
                    <a
                      href={entry.href}
                      onClick={onClose}
                      className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {entry.actionLabel}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Keine Aufgaben oder Materialien hinterlegt.</p>
      )}
      {mobile && (
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="mt-4 min-h-11 w-full"
        >
          Karte weiter nutzen
        </Button>
      )}
    </div>
  );
}
