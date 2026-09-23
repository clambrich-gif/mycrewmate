import {
  isMasterAdminHost,
  MASTER_ADMIN_HOST,
  MASTER_ADMIN_ORIGIN,
} from "@shared/platform-admin";

export const MARKETING_HOSTS = new Set([
  "mycrewmate.de",
  "www.mycrewmate.de",
]);

export const APP_ORIGIN = "https://app.mycrewmate.de";
export { MASTER_ADMIN_HOST, MASTER_ADMIN_ORIGIN };

/**
 * Die beiden Hauptdomains zeigen ausschließlich den öffentlichen Produktauftritt.
 * Die geschützte Vereins- und Eventplanung lebt getrennt auf app.mycrewmate.de.
 */
export function isMarketingHost(hostname: string | undefined | null) {
  return MARKETING_HOSTS.has((hostname ?? "").trim().toLowerCase());
}

export function isMarketingSite() {
  return typeof window !== "undefined" && isMarketingHost(window.location.hostname);
}

export function isMasterAdminSite() {
  return typeof window !== "undefined" && isMasterAdminHost(window.location.hostname);
}

/** Baut eine HTTPS-Adresse für die geschützte Anwendung, einschließlich Pfad, Query und Hash. */
export function appUrl(pathname = "/", search = "", hash = "") {
  return new URL(`${pathname}${search}${hash}`, `${APP_ORIGIN}/`).toString();
}

export const APP_LOGIN_URL = appUrl("/login");

export function appUrlForCurrentLocation() {
  if (typeof window === "undefined") return APP_ORIGIN;
  return appUrl(window.location.pathname, window.location.search, window.location.hash);
}
