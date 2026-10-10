import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { germanCalendarDay } from "./db";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("anonyme öffentliche Reichweite", () => {
  it("ordnet Tageswerte der deutschen Kalenderzeit zu", () => {
    expect(germanCalendarDay(new Date("2026-10-09T22:30:00.000Z"))).toBe("2026-10-10");
    expect(germanCalendarDay(new Date("2026-01-09T23:30:00.000Z"))).toBe("2026-01-10");
  });

  it("speichert ausschließlich Tagesaggregate ohne Besucherkennung", () => {
    const schema = read("drizzle/schema.ts");
    const db = read("server/db.ts");

    expect(schema).toContain('"public_reach_metrics"');
    expect(schema).toContain('metricDay: date("metricDay", { mode: "string" }).notNull()');
    expect(schema).toContain("uniqueIndex(\"public_reach_metrics_metric_day_unique\")");
    expect(schema).not.toContain("publicReachMetrics = mysqlTable(\n  \"public_reach_metrics\",\n  {\n    ipAddress");
    expect(schema).not.toContain("publicReachMetrics = mysqlTable(\n  \"public_reach_metrics\",\n  {\n    visitorId");
    expect(db).toContain("recordAnonymousPublicReachMetric");
    expect(db).toContain("onDuplicateKeyUpdate");
    expect(db).toContain("PUBLIC_REACH_METRIC_RETENTION_YEARS = 2");
    expect(db).toContain("cleanupExpiredAnonymousPublicReachMetrics");
  });

  it("hält den öffentlichen Zähler klein und die Masterauswertung geschützt", () => {
    const clientMetric = read("client/src/components/PublicReachMetric.tsx");
    const router = read("server/routers.ts");
    const demo = read("client/src/pages/ClubDemoLanding.tsx");

    expect(clientMetric).toContain("mycrewmate.de");
    expect(clientMetric).toContain("Lokale Entwicklung, Vorschauen und Tests beeinflussen");
    expect(clientMetric).toContain("Cookies noch IP-Adressen, Gerätekennungen oder Besucherprofile");
    expect(router).toContain("publicReach: router");
    expect(router).toContain("record: publicProcedure");
    expect(router).toContain("publicReach: masterAdminProcedure.query");
    expect(router).toContain('recordAnonymousPublicReachMetric("club_demo_started")');
    expect(demo).toContain('metric="club_demo_page_view"');
  });
});
