import type { Express, NextFunction, Request, Response } from "express";

export const CANONICAL_MARKETING_ORIGIN = "https://www.mycrewmate.de";
export const MARKETING_PAGE_TITLE =
  "MyCrewMate · Vereins- und Eventplanung mit Helferplanung";
export const MARKETING_PAGE_DESCRIPTION =
  "MyCrewMate ist die Software für Vereins- und Eventplanung: Helferplanung, Einsatzpläne, Aufgaben, Schichten und Kommunikation für Vereinsfeste, Sportveranstaltungen und ehrenamtliche Teams.";
export const MARKETING_OG_IMAGE = `${CANONICAL_MARKETING_ORIGIN}/landing/festival.jpg`;
/**
 * Nur bei wesentlichen öffentlichen Inhalts- oder Metadatenänderungen anpassen.
 * Suchmaschinen können damit erkennen, wann die kanonische Startseite zuletzt
 * substanziell aktualisiert wurde.
 */
export const MARKETING_SITEMAP_LAST_MODIFIED = "2026-10-10";
/** Öffentlicher Eigentumsnachweis von Bing; kein Besucherdaten- oder Trackingtag. */
export const BING_WEBMASTER_VERIFICATION_CONTENT = "84ECCF4B66C434F1AD1130AFD84681C6";

const MARKETING_HOSTS = new Set(["mycrewmate.de", "www.mycrewmate.de"]);

type PublicPageMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  robots: "index,follow" | "noindex,follow" | "noindex,nofollow";
};

export type PublicSiteMetadata = PublicPageMetadata & {
  canonicalUrl: string | null;
  isMarketingPage: boolean;
};

const PUBLIC_MARKETING_PAGES: Record<string, PublicPageMetadata> = {
  "/": {
    title: MARKETING_PAGE_TITLE,
    description: MARKETING_PAGE_DESCRIPTION,
    canonicalPath: "/",
    robots: "index,follow",
  },
  "/vereinsdemo": {
    title: "Vereinsdemo · MyCrewMate",
    description:
      "Erleben Sie MyCrewMate in einer datensparsamen Musterdemo für die Vereins- und Eventplanung.",
    canonicalPath: "/vereinsdemo",
    robots: "noindex,follow",
  },
  "/impressum": {
    title: "Impressum · MyCrewMate",
    description: "Impressum der MyCrewMate-Plattform für Vereins- und Eventplanung.",
    canonicalPath: "/impressum",
    robots: "noindex,follow",
  },
  "/datenschutz": {
    title: "Datenschutz · MyCrewMate",
    description: "Datenschutzhinweise für die öffentliche MyCrewMate-Website.",
    canonicalPath: "/datenschutz",
    robots: "noindex,follow",
  },
  "/agb": {
    title: "AGB · MyCrewMate",
    description: "Allgemeine Geschäftsbedingungen für MyCrewMate.",
    canonicalPath: "/agb",
    robots: "noindex,follow",
  },
  "/avv": {
    title: "Vereinbarung zur Auftragsverarbeitung · MyCrewMate",
    description:
      "Vereinbarung zur Auftragsverarbeitung für MyCrewMate als digitale Vereins- und Eventplanung.",
    canonicalPath: "/avv",
    robots: "noindex,follow",
  },
};

function normalizeHostname(hostname: string | undefined | null) {
  return (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function normalizePathname(pathname: string | undefined | null) {
  const value = (pathname ?? "/").trim() || "/";
  const withoutQuery = value.split("?")[0]?.split("#")[0] || "/";
  if (withoutQuery === "/") return "/";
  return withoutQuery.replace(/\/+$/, "") || "/";
}

export function isMarketingHostname(hostname: string | undefined | null) {
  return MARKETING_HOSTS.has(normalizeHostname(hostname));
}

/**
 * Liefert ausschließlich für klar definierte, öffentliche Seiten indexierbare
 * Metadaten. Alle geschützten Hosts sowie unbekannte Pfade bleiben noindex.
 */
export function publicSiteMetadataFor(
  hostname: string | undefined | null,
  pathname: string | undefined | null
): PublicSiteMetadata {
  const normalizedPath = normalizePathname(pathname);
  const publicPage = isMarketingHostname(hostname)
    ? PUBLIC_MARKETING_PAGES[normalizedPath]
    : undefined;

  if (publicPage) {
    return {
      ...publicPage,
      canonicalUrl: new URL(
        publicPage.canonicalPath,
        `${CANONICAL_MARKETING_ORIGIN}/`
      ).toString(),
      isMarketingPage: true,
    };
  }

  return {
    title: "MyCrewMate · Helferplanung",
    description: "Geschützter Bereich von MyCrewMate.",
    canonicalPath: normalizedPath,
    canonicalUrl: null,
    robots: "noindex,nofollow",
    isMarketingPage: false,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/\"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function marketingStructuredDataBlock(metadata: PublicSiteMetadata) {
  if (!metadata.isMarketingPage || metadata.canonicalPath !== "/") return null;

  // Die Angaben beschreiben ausschließlich die sichtbar angebotene Plattform.
  // Keine Bewertungen, Preise oder Eigenschaften werden für Suchergebnisse
  // behauptet, die auf der Startseite nicht klar erklärt sind.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${CANONICAL_MARKETING_ORIGIN}/#organization`,
        name: "MyCrewMate",
        url: `${CANONICAL_MARKETING_ORIGIN}/`,
        logo: `${CANONICAL_MARKETING_ORIGIN}/icons/mycrewmate-pwa-192.png`,
        description: MARKETING_PAGE_DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${CANONICAL_MARKETING_ORIGIN}/#software`,
        name: "MyCrewMate",
        url: `${CANONICAL_MARKETING_ORIGIN}/`,
        applicationCategory: "Event management application",
        operatingSystem: "Web browser",
        description: MARKETING_PAGE_DESCRIPTION,
        provider: { "@id": `${CANONICAL_MARKETING_ORIGIN}/#organization` },
      },
    ],
  };

  // JSON-LD wird als Text in den HTML-Kopf eingefügt. Das Escaping verhindert,
  // dass ein künftiger Textwert ein Script-Tag vorzeitig schließen könnte.
  const safeJson = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${safeJson}</script>`;
}

function marketingVerificationTags(metadata: PublicSiteMetadata) {
  if (!metadata.isMarketingPage || metadata.canonicalPath !== "/") return [];

  // Diese Tags beweisen ausschließlich die Inhaberschaft der öffentlichen
  // Startseite. Sie laden keine Fremdskripte und erfassen keine Besucher.
  return [
    `<meta name="msvalidate.01" content="${escapeHtml(BING_WEBMASTER_VERIFICATION_CONTENT)}" />`,
  ];
}

export function renderPublicMetadataBlock(metadata: PublicSiteMetadata) {
  const tags = [
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `<meta name="robots" content="${metadata.robots}" />`,
  ];

  if (metadata.canonicalUrl) {
    const canonicalUrl = escapeHtml(metadata.canonicalUrl);
    tags.push(
      `<link rel="canonical" href="${canonicalUrl}" />`,
      `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
      `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
      '<meta property="og:type" content="website" />',
      `<meta property="og:url" content="${canonicalUrl}" />`,
      `<meta property="og:image" content="${MARKETING_OG_IMAGE}" />`,
      '<meta property="og:image:width" content="1280" />',
      '<meta property="og:image:height" content="720" />',
      '<meta property="og:image:alt" content="Ehrenamtliches Team bei der Planung eines Vereinsfests mit MyCrewMate" />',
      '<meta property="og:locale" content="de_DE" />',
      '<meta property="og:site_name" content="MyCrewMate" />',
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
      `<meta name="twitter:image" content="${MARKETING_OG_IMAGE}" />`
    );
  }

  const structuredData = marketingStructuredDataBlock(metadata);
  if (structuredData) tags.push(structuredData);
  tags.push(...marketingVerificationTags(metadata));

  return [
    "<!-- public-metadata:start -->",
    ...tags,
    "<!-- public-metadata:end -->",
  ].join("\n    ");
}

/** Ersetzt die feste Ausgangskennzeichnung mit host- und pfadgenauen Metadaten. */
export function applyPublicSiteMetadata(
  html: string,
  hostname: string | undefined | null,
  pathname: string | undefined | null
) {
  const metadata = publicSiteMetadataFor(hostname, pathname);
  const title = `<title>${escapeHtml(metadata.title)}</title>`;
  const metadataBlock = renderPublicMetadataBlock(metadata);

  return html
    .replace(/<title>[\s\S]*?<\/title>/, title)
    .replace(
      /<!-- public-metadata:start -->[\s\S]*?<!-- public-metadata:end -->/,
      metadataBlock
    );
}

export function robotsTxtFor(hostname: string | undefined | null) {
  if (!isMarketingHostname(hostname)) {
    return "User-agent: *\nDisallow: /\n";
  }

  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /_staging/",
    `Sitemap: ${CANONICAL_MARKETING_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${CANONICAL_MARKETING_ORIGIN}/</loc>`,
    `    <lastmod>${MARKETING_SITEMAP_LAST_MODIFIED}</lastmod>`,
    "  </url>",
    "</urlset>",
    "",
  ].join("\n");
}

/** Technische Crawler-Dateien sind selbst keine indexierbaren Inhaltsseiten. */
export function shouldApplySearchRobotsHeader(pathname: string | undefined | null) {
  const normalizedPath = normalizePathname(pathname);
  return normalizedPath !== "/robots.txt" && normalizedPath !== "/sitemap.xml";
}

export function registerPublicSearchRoutes(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const metadata = publicSiteMetadataFor(req.hostname, req.path);
    if (shouldApplySearchRobotsHeader(req.path) && metadata.robots.startsWith("noindex")) {
      res.set("X-Robots-Tag", metadata.robots);
    }
    next();
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(robotsTxtFor(req.hostname));
  });

  app.get("/sitemap.xml", (req, res) => {
    if (!isMarketingHostname(req.hostname)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.type("application/xml").send(sitemapXml());
  });
}
