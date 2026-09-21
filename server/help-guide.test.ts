import { describe, expect, it } from "vitest";
import { getVisibleHelpChapters } from "@/components/HelpGuide";

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
  });

  it("filtert Themen über die Live-Suche", () => {
    const chapters = getVisibleHelpChapters("admin", "Excel");
    const topicIds = chapters.flatMap(chapter => chapter.topics.map(topic => topic.id));

    expect(topicIds).toContain("excel-export");
    expect(topicIds).toContain("excel-import");
    expect(topicIds).not.toContain("live-chat");
  });
});
