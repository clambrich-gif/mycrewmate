import { useEffect, useState } from "react";

export type DashboardDetailsLayout = "side-by-side" | "stacked";

/**
 * Entspricht dem Tailwind-Breakpoint `lg` des Dashboard-Bereichs
 * „Zuständigkeiten und Auslastung“. Klemmi beschreibt damit stets die
 * tatsächlich sichtbare Reihenfolge – auch auf kleinen Tablets.
 */
export const DASHBOARD_DETAILS_STACKED_QUERY = "(max-width: 1023px)";

function dashboardDetailsAreStacked() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(DASHBOARD_DETAILS_STACKED_QUERY).matches
  );
}

export function useDashboardDetailsLayout(): DashboardDetailsLayout {
  const [stacked, setStacked] = useState(dashboardDetailsAreStacked);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DASHBOARD_DETAILS_STACKED_QUERY);
    const syncLayout = () => setStacked(mediaQuery.matches);
    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  return stacked ? "stacked" : "side-by-side";
}
