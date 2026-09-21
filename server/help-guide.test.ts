import { describe, expect, it } from "vitest";
import {
  AZ_INDEX,
  getHelpAudienceForRole,
  getVisibleHelpChapters,
} from "@/components/HelpGuide";

describe("Hilfe-Center: Rollenfilter und Live-Suche", () => {
  it("zeigt im Standardfilter ausschließlich allgemein gültige Themen", () => {
    const chapters = getVisibleHelpChapters("all", "");
    const topicIds = chapters.flatMap(chapter => chapter.topics.map(topic => topic.id));

    expect(chapters).toHaveLength(8);
    expect(topicIds).toContain("dashboard-uebersicht");
    expect(topicIds).toContain("live-chat");
    expect(topicIds).not.toContain("einsatzplan");
    expect(topicIds).not.toContain("audit-log");
  });

  it("ergänzt den Planungsteamfilter um operative Themen", () => {
    const topicIds = getVisibleHelpChapters("planning", "")
      .flatMap(chapter => chapter.topics.map(topic => topic.id));

    expect(topicIds).toContain("helferkartei");
    expect(topicIds).toContain("materialverwaltung");
    expect(topicIds).toContain("dashboard-uebersicht");
    expect(topicIds).not.toContain("einsatzplan");
    expect(topicIds).not.toContain("audit-log");
  });

  it("ergänzt den Adminfilter um sicherheits- und importbezogene Themen", () => {
    const topicIds = getVisibleHelpChapters("admin", "")
      .flatMap(chapter => chapter.topics.map(topic => topic.id));

    expect(topicIds).toContain("einsatzplan");
    expect(topicIds).toContain("excel-import");
    expect(topicIds).toContain("audit-log");
    expect(topicIds).toContain("live-chat");
    expect(topicIds).toContain("helferkartei");
    expect(topicIds).toContain("materialverwaltung");
  });

  it("filtert Themen über die Live-Suche", () => {
    const chapters = getVisibleHelpChapters("admin", "Excel");
    const topicIds = chapters.flatMap(chapter => chapter.topics.map(topic => topic.id));

    expect(topicIds).toContain("excel-export");
    expect(topicIds).toContain("excel-import");
    expect(topicIds).not.toContain("live-chat");
  });

  it("wählt den passenden Rollenfilter für die aktuelle Anmeldung vor", () => {
    expect(getHelpAudienceForRole("user")).toBe("planning");
    expect(getHelpAudienceForRole("admin")).toBe("admin");
    expect(getHelpAudienceForRole(null)).toBe("all");
  });

  it("stellt A-Z-Schnellsuchen mit passenden Rollenhinweisen bereit", () => {
    const eTerms = AZ_INDEX.find(([letter]) => letter === "E")?.[1] ?? [];
    const material = AZ_INDEX.find(([letter]) => letter === "M")?.[1]
      .find(term => term.label === "Material");

    expect(eTerms.map(term => term.label)).toContain("Einsatzplan");
    expect(eTerms.find(term => term.label === "Einsatzplan")?.audience).toBe("admin");
    expect(material?.audience).toBe("planning");
  });
});
