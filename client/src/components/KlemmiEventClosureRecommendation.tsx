import { KlemmiMascot } from "@/components/KlemmiMascot";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Archive, CalendarCheck2 } from "lucide-react";
import { useState } from "react";

type EventClosureRecommendationItem = {
  id: number;
  name: string;
  year: number;
  endDate: string;
  daysSinceEnd: number;
};

type KlemmiEventClosureRecommendationProps = {
  recommendations: EventClosureRecommendationItem[];
  onCloseEvent: (eventId: number) => void;
  isClosing?: boolean;
};

function formatGermanDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("de-DE");
}

/**
 * Freundliche, nicht blockierende Erinnerungsfläche: Nur Vereinsadmins erhalten
 * sie nach einem eindeutig datierten und bereits beendeten aktiven Event.
 */
export function KlemmiEventClosureRecommendation({
  recommendations,
  onCloseEvent,
  isClosing = false,
}: KlemmiEventClosureRecommendationProps) {
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [target, setTarget] = useState<EventClosureRecommendationItem | null>(null);
  const visibleRecommendations = recommendations.filter(
    recommendation => !dismissedIds.includes(recommendation.id)
  );

  if (!visibleRecommendations.length) return null;

  return (
    <section
      data-slot="klemmi-event-closure-recommendation"
      aria-label="Klemmis Empfehlung zum Veranstaltungsabschluss"
      className="relative overflow-hidden rounded-2xl border border-blue-200 bg-[radial-gradient(circle_at_92%_8%,rgba(191,219,254,0.85),transparent_36%),linear-gradient(135deg,#eff6ff,#f8fbff)] px-4 py-4 pr-24 text-slate-950 shadow-sm sm:px-5 sm:pr-32"
    >
      <div
        className="pointer-events-none absolute -bottom-7 right-1 size-28 sm:-bottom-9 sm:right-5 sm:size-36"
        aria-hidden="true"
      >
        <KlemmiMascot decorative />
      </div>
      <div className="relative max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-bold text-blue-950">
          <CalendarCheck2 className="size-4 text-blue-700" aria-hidden="true" />
          Klemmi hat eine Abschluss-Idee
        </p>
        <p className="mt-1 text-sm leading-5 text-blue-950">
          Diese Veranstaltung ist beendet, aber noch aktiv in der Planung. Du kannst
          sie jetzt sicher als Historie abschließen – alle Daten bleiben erhalten und
          der Platz im aktiven Jahreskontingent wird wieder frei.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibleRecommendations.map(recommendation => (
            <div
              key={recommendation.id}
              className="rounded-xl border border-blue-200 bg-white/80 p-3 shadow-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{recommendation.name}</p>
                <span className="text-xs font-medium text-blue-800">{recommendation.year}</span>
              </div>
              <p className="mt-1 text-xs leading-4 text-slate-600">
                Enddatum: {formatGermanDate(recommendation.endDate)} · seit{" "}
                {recommendation.daysSinceEnd} Tag{recommendation.daysSinceEnd === 1 ? "" : "en"} beendet
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isClosing}
                  onClick={() => setTarget(recommendation)}
                >
                  <Archive className="mr-1.5 size-4" />
                  Als Historie schließen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isClosing}
                  onClick={() =>
                    setDismissedIds(current => [...current, recommendation.id])
                  }
                >
                  Später erinnern
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={Boolean(target)} onOpenChange={open => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>„{target?.name ?? ""}“ als Historie schließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Veranstaltung verschwindet aus der aktiven Tagesplanung und zählt
              nicht mehr zum Jahreskontingent. Helfer, Einsatzplan, Aufgaben und alle
              übrigen Daten bleiben vollständig erhalten. Du kannst sie später wieder
              öffnen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" disabled={isClosing} onClick={() => setTarget(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={!target || isClosing}
              onClick={() => target && onCloseEvent(target.id)}
            >
              <Archive className="mr-2 size-4" />
              Jetzt abschließen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
