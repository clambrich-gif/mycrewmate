import type { ReactNode } from "react";

type KlemmiActionPanelProps = {
  viewControl?: ReactNode;
  guide: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction: ReactNode;
  className?: string;
};

/**
 * Einheitliche, kompakte Kopf-Aktionsleiste.
 *
 * Desktop: Oben liegen Ansicht und Nebenaktionen nebeneinander; darunter
 * Klemmi und die Hauptanlage. Die Controls behalten ihre natürliche Breite.
 * Schmale Mobilgeräte wechseln kontrolliert in eine Spalte, damit keine
 * Schaltfläche abgeschnitten oder zu klein wird.
 */
export function KlemmiActionPanel({
  viewControl,
  guide,
  secondaryActions,
  primaryAction,
  className = "",
}: KlemmiActionPanelProps) {
  return (
    <div
      data-klemmi-action-panel
      className={`grid w-fit max-w-full grid-cols-1 gap-x-2 gap-y-2 min-[440px]:grid-cols-[max-content_minmax(0,1fr)] ${className}`}
    >
      {viewControl ? (
        <div className="min-w-0 min-[440px]:col-start-1 min-[440px]:row-start-1">
          {viewControl}
        </div>
      ) : null}
      {secondaryActions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 min-[440px]:col-start-2 min-[440px]:row-start-1">
          {secondaryActions}
        </div>
      ) : null}
      <div className="min-w-0 min-[440px]:col-start-1 min-[440px]:row-start-2">{guide}</div>
      <div className="flex min-w-0 items-start min-[440px]:col-start-2 min-[440px]:row-start-2">
        {primaryAction}
      </div>
    </div>
  );
}
