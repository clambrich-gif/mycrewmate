const STORAGE_KEY = "mycrewmate:klemmi-dashboard-muted";
export const DASHBOARD_KLEMMI_MUTE_EVENT = "mycrewmate:dashboard-klemmi-muted";

/** Der Dashboard-Schalter gilt für die laufende Browser-Sitzung. */
export function getDashboardKlemmiMuted() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === "true";
}

export function setDashboardKlemmiMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, String(muted));
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_KLEMMI_MUTE_EVENT, { detail: muted })
  );
}
