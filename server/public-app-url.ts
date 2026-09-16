/**
 * Kanonische, veröffentlichte Adresse der RSC Helferplanung.
 *
 * Externe Empfänger öffnen PDF-Freigaben außerhalb der aktuell angemeldeten
 * Browser-Sitzung. Daher dürfen Messenger-Links nie aus einem temporären
 * Entwicklungs- oder Vorschau-Host aufgebaut werden.
 */
const DEFAULT_PUBLIC_APP_ORIGIN = "https://eifelride-jq8ejdus.manus.space";

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
 * werden; ohne Konfiguration bleibt die veröffentlichte Manus-Domain aktiv.
 */
export const PUBLIC_APP_ORIGIN = normalizePublicOrigin(
  process.env.PUBLIC_APP_ORIGIN
);

export function publicAppUrl(path: string) {
  return new URL(path, `${PUBLIC_APP_ORIGIN}/`).toString();
}
