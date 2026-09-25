import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/ViewModeToggle";

export function useViewMode(storageKey: string, defaultMode: ViewMode = "liste") {
  const fullKey = `mycrewmate_view_mode_${storageKey}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = window.localStorage.getItem(fullKey);
    return stored === "kacheln" || stored === "liste" ? stored : defaultMode;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(fullKey, mode);
    }
  }, [fullKey, mode]);

  return [mode, setMode] as const;
}
