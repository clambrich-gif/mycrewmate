import type { ReactNode } from "react";

type KlemmiActionPanelProps = {
  viewControl?: ReactNode;
  guide: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction: ReactNode;
  className?: string;
};

/**
 * Einheitliche Kopf-Aktionsleiste: Ansichtsumschalter links und die Klemmi-
 * Kachel rechts mit Anleitung, optionalen Nebenaktionen und der Hauptanlage.
 */
export function KlemmiActionPanel({
  viewControl,
  guide,
  secondaryActions,
  primaryAction,
  className = "",
}: KlemmiActionPanelProps) {
  return (
    <div className={`flex w-full flex-col gap-2 sm:flex-row sm:items-start ${className}`}>
      {viewControl ? <div className="shrink-0">{viewControl}</div> : null}
      <div
        data-klemmi-action-panel
        className="w-full rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:w-[14rem]"
      >
        <div className="space-y-2">
          {guide}
          {secondaryActions ? (
            <div className="grid grid-cols-1 gap-2 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:whitespace-nowrap [&>[data-slot=button]]:px-2 [&>[data-slot=button]]:text-sm">
              {secondaryActions}
            </div>
          ) : null}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
