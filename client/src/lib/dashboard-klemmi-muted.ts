const STORAGE_KEY = "mycrewmate:klemmi-muted";
export const KLEMMI_MUTE_EVENT = "mycrewmate:klemmi-muted";

/**
 * Der Sprachschalter gilt für die gesamte laufende Browser-Sitzung. Alle
 * Klemmi-Führungen, Inaktivitäts-Hinweise und Begrüßungen lesen denselben Wert.
 * Die sichtbaren Führungen bleiben bewusst unverändert verfügbar.
 */
export function getKlemmiMuted() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === "true";
}

export function setKlemmiMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, String(muted));
  window.dispatchEvent(new CustomEvent(KLEMMI_MUTE_EVENT, { detail: muted }));
}

/** @deprecated Kompatibilitätsalias für den bisherigen Dashboard-Schalter. */
export const DASHBOARD_KLEMMI_MUTE_EVENT = KLEMMI_MUTE_EVENT;
/** @deprecated Kompatibilitätsalias für den bisherigen Dashboard-Schalter. */
export const getDashboardKlemmiMuted = getKlemmiMuted;
/** @deprecated Kompatibilitätsalias für den bisherigen Dashboard-Schalter. */
export const setDashboardKlemmiMuted = setKlemmiMuted;
