/**
 * Kanonische, veröffentlichte Adresse von MyCrewMate.
 *
 * Externe Empfänger öffnen PDF-Freigaben außerhalb der aktuell angemeldeten
 * Browser-Sitzung. Daher dürfen Messenger-Links nie aus einem temporären
 * Entwicklungs-, Vorschau- oder früheren Manus-Host aufgebaut werden.
 */
const DEFAULT_PUBLIC_APP_ORIGIN = "https://app.mycrewmate.de";

function normalizePublicOrigin(value: string | undefined) {
  const candidate = value?.trim() || DEFAULT_PUBLIC_APP_ORIGIN;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") throw new Error("HTTPS erforderlich");
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_APP_ORIGIN;
  }
}

/**
 * Kann bei einem späteren Domainwechsel per PUBLIC_APP_ORIGIN überschrieben
 * werden; ohne Konfiguration bleibt die offizielle MyCrewMate-Domain aktiv.
 */
export const PUBLIC_APP_ORIGIN = normalizePublicOrigin(
  process.env.PUBLIC_APP_ORIGIN
);

export function publicAppUrl(path: string) {
  return new URL(path, `${PUBLIC_APP_ORIGIN}/`).toString();
}
