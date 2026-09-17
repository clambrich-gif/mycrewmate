import { Clock3 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function StatusBadge({
  status,
  timeUndercoverage = false,
}: {
  status: string;
  timeUndercoverage?: boolean;
}) {
  const map: Record<string, { cls: string; label: string }> = {
    OK: { cls: "badge-ok", label: "OK" },
    erledigt: { cls: "badge-ok", label: "erledigt" },
    genehmigt: { cls: "badge-ok", label: "genehmigt" },
    ja: { cls: "badge-ok", label: "Ja" },
    KNAPP: { cls: "badge-warn", label: "KNAPP" },
    inArbeit: { cls: "badge-warn", label: "in Arbeit" },
    beantragt: { cls: "badge-warn", label: "beantragt" },
    vielleicht: { cls: "badge-warn", label: "Vielleicht" },
    OFFEN: { cls: "badge-err", label: "OFFEN" },
    offen: { cls: "badge-err", label: "offen" },
    abgelehnt: { cls: "badge-err", label: "abgelehnt" },
    nein: { cls: "badge-err", label: "Nein" },
  };
  const m = map[status] ?? { cls: "badge-neutral", label: status };
  const badge = (
    <span
      className={`badge inline-flex items-center gap-1 ${m.cls}`}
      data-slot={timeUndercoverage ? "shift-status-time-undercoverage" : undefined}
    >
      {m.label}
      {timeUndercoverage && <Clock3 className="size-3" aria-hidden="true" />}
    </span>
  );

  if (!timeUndercoverage) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label="Zeitliche Unterdeckung der Schicht">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        Zeitliche Unterdeckung: Mindestens ein Helfer deckt die Schichtzeit
        nicht vollständig ab.
      </TooltipContent>
    </Tooltip>
  );
}
