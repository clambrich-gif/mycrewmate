export const PROTECTIVE_MARKETING_DOMAINS = new Set([
  "mycrewmate.at",
  "www.mycrewmate.at",
  "mycrewmate.eu",
  "www.mycrewmate.eu",
  "mycrewmate.ch",
  "www.mycrewmate.ch",
]);

export const CANONICAL_MARKETING_ORIGIN = "https://www.mycrewmate.de";

function normalizedHost(hostname: string | undefined | null) {
  return (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Liefert ausschließlich für die reservierten Landesdomains eine feste,
 * pfaderhaltende Zieladresse auf der deutschen Hauptdomain. Die Zieladresse
 * wird nie aus einem Request-Host zusammengesetzt.
 */
export function canonicalMarketingRedirectUrl(
  hostname: string | undefined | null,
  originalUrl: string | undefined | null
) {
  if (!PROTECTIVE_MARKETING_DOMAINS.has(normalizedHost(hostname))) {
    return null;
  }

  const pathAndQuery = originalUrl?.startsWith("/") ? originalUrl : "/";
  return new URL(pathAndQuery, CANONICAL_MARKETING_ORIGIN).toString();
}

export function shouldRedirectProtectiveMarketingDomain(
  method: string | undefined | null,
  hostname: string | undefined | null
) {
  return (
    (method === "GET" || method === "HEAD") &&
    PROTECTIVE_MARKETING_DOMAINS.has(normalizedHost(hostname))
  );
}
