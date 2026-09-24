import { isMarketingHost } from "./site-host";
import { isMasterAdminHost } from "@shared/platform-admin";

export type BrowserBranding = {
  title: string;
  faviconHref: string;
  appleTouchIconHref: string;
  appleWebAppTitle: string;
};

const NORMAL_ICON = "/icons/mycrewmate-pwa-192.png";
const ADMIN_ICON = "/icons/mycrewmate-admin-192.png";

/**
 * Trennt die Browserkennung der öffentlichen Website, der Vereins-App und des
 * geschützten Master-Admin-Portals. Die rote Admin-Umrandung ist absichtlich
 * nur auf admin.mycrewmate.de sichtbar, damit risikoreiche Verwaltungsaktionen
 * schon am Browser-Tab eindeutig erkennbar sind.
 */
export function browserBrandingForHostname(hostname: string | undefined | null): BrowserBranding {
  const normalizedHostname = (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");

  if (isMasterAdminHost(normalizedHostname)) {
    return {
      title: "MyCrewMate · Admin",
      faviconHref: ADMIN_ICON,
      appleTouchIconHref: ADMIN_ICON,
      appleWebAppTitle: "MyCrewMate Admin",
    };
  }

  if (isMarketingHost(normalizedHostname)) {
    return {
      title: "MyCrewMate",
      faviconHref: NORMAL_ICON,
      appleTouchIconHref: NORMAL_ICON,
      appleWebAppTitle: "MyCrewMate",
    };
  }

  return {
    title: "MyCrewMate · Helferplanung",
    faviconHref: NORMAL_ICON,
    appleTouchIconHref: NORMAL_ICON,
    appleWebAppTitle: "MyCrewMate Helferplanung",
  };
}

function replaceIconLink(rel: string, href: string, type?: string) {
  const selector = `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
}

/** Wendet die zur aktuell geöffneten Subdomain passende Browserkennung an. */
export function applyBrowserBranding() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const branding = browserBrandingForHostname(window.location.hostname);
  document.title = branding.title;
  replaceIconLink("icon", branding.faviconHref, "image/png");
  replaceIconLink("apple-touch-icon", branding.appleTouchIconHref, "image/png");

  let appleTitle = document.head.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]'
  );
  if (!appleTitle) {
    appleTitle = document.createElement("meta");
    appleTitle.name = "apple-mobile-web-app-title";
    document.head.appendChild(appleTitle);
  }
  appleTitle.content = branding.appleWebAppTitle;
}
