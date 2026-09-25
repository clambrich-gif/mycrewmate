import { cn } from "@/lib/utils";
import { parsePreparationLogbookEntries } from "@shared/preparation-logbook";

type TaskLogbookHistoryProps = {
  logbook: string | null | undefined;
  className?: string;
  emptyMessage?: string;
};

/**
 * Einheitliche Leseansicht für Aufgaben-Logbücher in Listen- und Kachelansicht.
 * Der gespeicherte Verlauf bleibt unverändert; lediglich seine Darstellung wird
 * in klar getrennte, nachvollziehbare Einträge gegliedert.
 */
export function TaskLogbookHistory({
  logbook,
  className,
  emptyMessage = "Noch kein Logbucheintrag vorhanden.",
}: TaskLogbookHistoryProps) {
  const entries = parsePreparationLogbookEntries(logbook);

  if (!entries.length) {
    return <p className="text-sm leading-5 text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div
      data-slot="task-logbook-history"
      aria-label="Logbuch – Verlauf"
      className={cn(
        "max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60",
        className
      )}
    >
      {entries.map((entry, index) => (
        <article
          key={`${entry.raw}-${index}`}
          className="space-y-1.5 px-3 py-2.5 first:bg-blue-50/65"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="font-bold tracking-tight text-blue-950">
              {entry.timestampLabel}
            </p>
            <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-semibold text-blue-800">
              {entry.author ? `von ${entry.author}` : "Autor nicht hinterlegt"}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">
            {entry.text || "Kein weiterer Beschreibungstext hinterlegt."}
          </p>
        </article>
      ))}
    </div>
  );
}
