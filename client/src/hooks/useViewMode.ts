import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/ViewModeToggle";

/** Entspricht dem Tailwind-Breakpoint `md`: Smartphones erhalten immer Kacheln. */
export const MOBILE_VIEW_MODE_QUERY = "(max-width: 767px)";

function isMobileViewMode() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_VIEW_MODE_QUERY).matches
  );
}

export function useMobileViewMode() {
  const [mobile, setMobile] = useState(isMobileViewMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_MODE_QUERY);
    const updateMobileState = () => setMobile(mediaQuery.matches);
    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);
    return () => mediaQuery.removeEventListener("change", updateMobileState);
  }, []);

  return mobile;
}

export function effectiveViewMode(mode: ViewMode, mobile: boolean): ViewMode {
  return mobile ? "kacheln" : mode;
}

export function useViewMode(storageKey: string, defaultMode: ViewMode = "liste") {
  const fullKey = `mycrewmate_view_mode_${storageKey}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = window.localStorage.getItem(fullKey);
    return stored === "kacheln" || stored === "liste" ? stored : defaultMode;
  });
  const mobile = useMobileViewMode();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(fullKey, mode);
    }
  }, [fullKey, mode]);

  // Die Desktop-Präferenz bleibt gespeichert und wird beim Wechsel auf einen
  // größeren Bildschirm wiederhergestellt. Mobil wird sie nur überlagert.
  return [effectiveViewMode(mode, mobile), setMode] as const;
}
