import type { ReactNode } from "react";

type KlemmiActionPanelProps = {
  viewControl?: ReactNode;
  guide: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction: ReactNode;
  layout?: "view-first" | "guide-first";
  className?: string;
};

/**
 * Einheitliche, kompakte Kopf-Aktionsleiste.
 *
 * Desktop: links Ansicht und Klemmi, rechts die Nebenaktionen; die Hauptanlage
 * spannt exakt über die gemeinsame Breite der Nebenaktionen. Mobil: zwei
 * gleich breite, vollständig sichtbare Buttons pro Zeile ohne Überstände.
 */
export function KlemmiActionPanel({
  viewControl,
  guide,
  secondaryActions,
  primaryAction,
  layout = "view-first",
  className = "",
}: KlemmiActionPanelProps) {
  const guideFirst = layout === "guide-first";

  return (
    <div
      data-klemmi-action-panel
      className={`grid w-full max-w-full grid-cols-2 gap-2 sm:w-fit sm:grid-cols-[max-content_auto] ${className}`}
    >
      {viewControl ? (
        <div
          data-klemmi-view-control
          className={
            guideFirst
              ? "col-span-2 hidden min-w-0 sm:col-span-1 sm:col-start-1 sm:row-start-2 sm:block"
              : "hidden sm:col-start-1 sm:row-start-1 sm:block"
          }
        >
          {viewControl}
        </div>
      ) : null}

      {secondaryActions ? (
        <div
          data-klemmi-secondary-actions
          className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-fit sm:grid-flow-col sm:auto-cols-max [&>[data-slot=button]]:min-w-0 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 [&>[data-slot=button]]:text-xs [&>[data-slot=button]>svg]:shrink-0 sm:[&>[data-slot=button]]:w-auto sm:[&>[data-slot=button]]:px-3 sm:[&>[data-slot=button]]:text-sm"
        >
          {secondaryActions}
        </div>
      ) : null}

      <div
        className={
          guideFirst
            ? "min-w-0 sm:col-start-1 sm:row-start-1 [&>[data-klemmi-trigger]]:w-full [&>[data-klemmi-trigger]]:min-w-0 [&>[data-klemmi-trigger]]:justify-center sm:[&>[data-klemmi-trigger]]:w-auto"
            : "min-w-0 sm:col-start-1 sm:row-start-2 [&>[data-klemmi-trigger]]:w-full [&>[data-klemmi-trigger]]:min-w-0 [&>[data-klemmi-trigger]]:justify-center sm:[&>[data-klemmi-trigger]]:w-auto"
        }
      >
        {guide}
      </div>
      <div className="min-w-0 sm:col-start-2 sm:row-start-2 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:min-w-0 [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 [&>[data-slot=button]]:text-sm sm:[&>[data-slot=button]]:px-4">
        {primaryAction}
      </div>
    </div>
  );
}
