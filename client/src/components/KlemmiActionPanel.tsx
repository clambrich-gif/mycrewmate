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
 * Oben liegen Ansicht und Nebenaktionen nebeneinander; darunter Klemmi und
 * die Hauptanlage. Das Raster bleibt auch auf dem Smartphone so kompakt wie
 * möglich nebeneinander und bricht erst bei echtem Platzmangel kontrolliert.
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
      className={`flex w-full max-w-full flex-col gap-2 sm:grid sm:w-fit sm:grid-cols-[max-content_minmax(0,1fr)] ${className}`}
    >
      {viewControl ? (
        <div className="hidden sm:block sm:col-start-1 sm:row-start-1">
          {viewControl}
        </div>
      ) : null}
      {secondaryActions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:min-w-0 sm:gap-2 sm:col-start-2 sm:row-start-1 [&>[data-slot=button]]:min-w-0 [&>[data-slot=button]]:flex-1 [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 sm:[&>[data-slot=button]]:flex-none sm:[&>[data-slot=button]]:w-auto">
          {secondaryActions}
        </div>
      ) : null}
      <div className="flex w-full items-center gap-2 sm:contents">
        <div className="min-w-0 flex-1 sm:flex-none sm:col-start-1 sm:row-start-2 [&>[data-klemmi-trigger]]:w-full [&>[data-klemmi-trigger]]:justify-center sm:[&>[data-klemmi-trigger]]:w-auto">{guide}</div>
        <div className="flex min-w-0 flex-1 items-center sm:flex-none sm:col-start-2 sm:row-start-2 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 sm:[&>[data-slot=button]]:w-auto">
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
