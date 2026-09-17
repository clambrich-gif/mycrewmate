import { Clock3 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function StatusBadge({
  status,
  timeUndercoverage = false,
  manuallyConfirmed = false,
  doubleConflictAccepted = false,
}: {
  status: string;
  timeUndercoverage?: boolean;
  manuallyConfirmed?: boolean;
  doubleConflictAccepted?: boolean;
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
  const base = map[status] ?? { cls: "badge-neutral", label: status };
  const hasManualConfirmation = manuallyConfirmed || doubleConflictAccepted;
  const m =
    status === "OK" && hasManualConfirmation
      ? { ...base, label: "OK ✓" }
      : base;
  const badge = (
    <span
      className={`badge inline-flex items-center gap-1 ${m.cls}`}
      data-slot={
        timeUndercoverage && !manuallyConfirmed
          ? "shift-status-time-undercoverage"
          : undefined
      }
    >
      {m.label}
      {timeUndercoverage && !manuallyConfirmed && (
        <Clock3 className="size-3" aria-hidden="true" />
      )}
    </span>
  );

  const hasUnconfirmedTimeUndercoverage =
    timeUndercoverage && !manuallyConfirmed;
  if (!hasUnconfirmedTimeUndercoverage && !hasManualConfirmation) return badge;

  const tooltipLabel = doubleConflictAccepted
    ? manuallyConfirmed
      ? "Manuell bestätigt (zeitliche Abweichung und Doppelbelegung akzeptiert)"
      : "Manuell bestätigt (Doppelbelegung akzeptiert)"
    : "Manuell als vollständig geprüft freigegeben.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={
            hasUnconfirmedTimeUndercoverage
              ? "Zeitliche Unterdeckung der Schicht"
              : tooltipLabel
          }
        >
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {hasUnconfirmedTimeUndercoverage
          ? "Zeitliche Unterdeckung: Mindestens ein Helfer deckt die Schichtzeit nicht vollständig ab."
          : tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
