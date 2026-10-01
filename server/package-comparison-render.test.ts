import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PackageComparisonSection } from "../client/src/components/PackageComparisonSection";

describe("Paketvergleich: Upgrade-Anfrage und Klemmi-Tipp", () => {
  it("rendert für Light einen kompakten Klemmi-Tipp und eine unverbindliche Pro-Anfrage", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PackageComparisonSection, {
        currentPackageId: "light",
        embedded: true,
      })
    );

    expect(markup).toContain('data-klemmi-package-tip="true"');
    expect(markup).toContain("Der nächste sinnvolle Schritt: Pro");
    expect(markup).toContain(
      "Chat, Spenden, Finanzen, Live-Karten und individuelle WhatsApp-Vorlagen"
    );
    expect(markup).toContain('data-upgrade-request="pro"');
    expect(markup).toContain("Upgrade zu Pro anfragen");
    expect(markup).toContain("mailto:info@mycrewmate.de");
    expect(markup).toContain("keine automatische Buchung");
    expect(markup).toContain('data-klemmi-package-tip-audio="light"');
    expect(markup).toContain("Klemmi vorlesen");
    expect(markup).toContain("motion-safe:hover:-translate-y-0.5");
    expect(markup).toContain("motion-safe:group-hover:-translate-y-1");
  });

  it("zeigt in der öffentlichen Vergleichsübersicht keine Anfragesektion", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PackageComparisonSection, { sectionId: "vergleich" })
    );

    expect(markup).not.toContain("data-klemmi-package-tip");
    expect(markup).not.toContain("data-upgrade-request");
  });
});
