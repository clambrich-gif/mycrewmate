import { describe, expect, it } from "vitest";
import {
  CANONICAL_MARKETING_ORIGIN,
  MARKETING_PAGE_DESCRIPTION,
  MARKETING_PAGE_TITLE,
  applyPublicSiteMetadata,
  publicSiteMetadataFor,
  robotsTxtFor,
  sitemapXml,
} from "./public-site-metadata";

const htmlShell = `<!doctype html>
<html lang="de">
  <head>
    <title>MyCrewMate</title>
    <!-- public-metadata:start -->
    <meta name="description" content="Ausgangstext" />
    <!-- public-metadata:end -->
  </head>
  <body></body>
</html>`;

describe("öffentliche MyCrewMate-Metadaten", () => {
  it("beschreibt die Startseite eindeutig als Vereins- und Helferplanungssoftware", () => {
    expect(MARKETING_PAGE_TITLE).toContain("Vereins- und Eventplanung");
    expect(MARKETING_PAGE_TITLE).toContain("Helferplanung");
    expect(MARKETING_PAGE_DESCRIPTION).toContain("Einsatzpläne");
    expect(MARKETING_PAGE_DESCRIPTION).toContain("Vereinsfeste");
    expect(MARKETING_PAGE_DESCRIPTION).toContain("Sportveranstaltungen");
  });

  it("liefert für die kanonische Startseite eindeutige, indexierbare Metadaten", () => {
    const metadata = publicSiteMetadataFor("www.mycrewmate.de", "/?quelle=mail");

    expect(metadata).toMatchObject({
      title: MARKETING_PAGE_TITLE,
      description: MARKETING_PAGE_DESCRIPTION,
      canonicalUrl: `${CANONICAL_MARKETING_ORIGIN}/`,
      robots: "index,follow",
      isMarketingPage: true,
    });
  });

  it("hält Rechtstexte kanonisch, aber aus den Suchergebnissen heraus", () => {
    const metadata = publicSiteMetadataFor("mycrewmate.de", "/impressum/");

    expect(metadata).toMatchObject({
      canonicalUrl: `${CANONICAL_MARKETING_ORIGIN}/impressum`,
      robots: "noindex,follow",
      isMarketingPage: true,
    });
  });

  it("schließt geschützte Hosts und unbekannte Pfade von der Indexierung aus", () => {
    expect(publicSiteMetadataFor("app.mycrewmate.de", "/dashboard")).toMatchObject({
      canonicalUrl: null,
      robots: "noindex,nofollow",
      isMarketingPage: false,
    });
    expect(publicSiteMetadataFor("www.mycrewmate.de", "/helfer")).toMatchObject({
      canonicalUrl: null,
      robots: "noindex,nofollow",
      isMarketingPage: false,
    });
  });

  it("setzt Linkvorschau, Canonical und Titel bereits im ausgelieferten HTML", () => {
    const html = applyPublicSiteMetadata(htmlShell, "mycrewmate.de", "/");

    expect(html).toContain(`<title>${MARKETING_PAGE_TITLE}</title>`);
    expect(html).toContain(
      `<link rel="canonical" href="${CANONICAL_MARKETING_ORIGIN}/" />`
    );
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain("Ausgangstext");
  });

  it("stellt nur auf der Marketingdomain einen öffentlichen Crawler-Einstieg bereit", () => {
    expect(robotsTxtFor("www.mycrewmate.de")).toContain(
      `Sitemap: ${CANONICAL_MARKETING_ORIGIN}/sitemap.xml`
    );
    expect(robotsTxtFor("app.mycrewmate.de")).toBe("User-agent: *\nDisallow: /\n");
    expect(sitemapXml()).toContain(`<loc>${CANONICAL_MARKETING_ORIGIN}/</loc>`);
    expect(sitemapXml()).not.toContain("mycrewmate.at");
  });
});
