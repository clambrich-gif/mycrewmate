import { useEffect, useState } from "react";
import type { DashboardView } from "@/components/DashboardViewToggle";

const STORAGE_KEY = "mycrewmate_dashboard_view";

/**
 * Die Dashboard-Darstellung ist bewusst eine persönliche, lokale Browserwahl.
 * Es werden keine Vereins- oder Planungsdaten gespeichert oder verändert.
 */
export function useDashboardView(defaultView: DashboardView = "details") {
  const [view, setView] = useState<DashboardView>(() => {
    if (typeof window === "undefined") return defaultView;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "overview" || stored === "details" ? stored : defaultView;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, view);
    }
  }, [view]);

  return [view, setView] as const;
}
