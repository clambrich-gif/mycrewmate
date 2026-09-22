const PREVIEW_SESSION_STORAGE_KEY = "manus-cookie";

/**
 * Manus zeigt lokale Projektvorschauen eingebettet an. Manche Browser oder
 * WebViews senden darin HttpOnly-Cookies nicht zuverlässig zurück. Der
 * kurzlebige Fallback liegt deshalb ausschließlich in sessionStorage und wird
 * nur verwendet, wenn das Backend für die interne Vorschau einen Token liefert.
 */
export function getPreviewSessionToken() {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function storePreviewSessionToken(token: string | undefined) {
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREVIEW_SESSION_STORAGE_KEY, token);
  } catch {
    // Die normale Same-Origin-Cookie-Sitzung bleibt ohne sessionStorage nutzbar.
  }
}

export function clearPreviewSessionToken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PREVIEW_SESSION_STORAGE_KEY);
  } catch {
    // Kein zusätzlicher Handlungsbedarf, die serverseitige Cookie-Sitzung wird
    // über die Logout-Mutation weiterhin beendet.
  }
}
