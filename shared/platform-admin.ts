export const MASTER_ADMIN_HOST = "admin.mycrewmate.de";
export const MASTER_ADMIN_ORIGIN = `https://${MASTER_ADMIN_HOST}`;

function normalizeHostname(hostname: string | undefined | null) {
  return (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/** Die spätere öffentliche Master-Domain für die Plattformverwaltung. */
export function isMasterAdminHost(hostname: string | undefined | null) {
  return normalizeHostname(hostname) === MASTER_ADMIN_HOST;
}

/**
 * Die Vorschau darf das Master-Portal testen, ohne die spätere öffentliche
 * Master-Domain vorab zu konfigurieren. Diese Hosts werden serverseitig nur
 * außerhalb der Produktion akzeptiert.
 */
export function isMasterAdminPreviewHost(hostname: string | undefined | null) {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".manus.computer") ||
    normalized.endsWith(".manus.space")
  );
}

export function isMasterAdminRequestHost(
  hostname: string | undefined | null,
  environment: string | undefined
) {
  return (
    isMasterAdminHost(hostname) ||
    (environment !== "production" && isMasterAdminPreviewHost(hostname))
  );
}
