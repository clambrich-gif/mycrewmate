import { describe, expect, it } from "vitest";
import {
  DAILY_DASHBOARD_QUOTES,
  dashboardDailyQuote,
  dashboardQuoteIndex,
} from "../client/src/lib/daily-dashboard-quotes";

describe("Dashboard-Tageszitate", () => {
  it("stellt genau 365 eindeutige, lesbare Tageszitate bereit", () => {
    expect(DAILY_DASHBOARD_QUOTES).toHaveLength(365);
    expect(new Set(DAILY_DASHBOARD_QUOTES).size).toBe(365);
    expect(DAILY_DASHBOARD_QUOTES.every(quote => quote.length > 20)).toBe(true);
  });

  it("verschiebt den Spruch am selben Kalendertag in jedem Folgejahr", () => {
    const firstYear = new Date(2026, 5, 20, 12);
    const followingYear = new Date(2027, 5, 20, 12);

    expect(dashboardQuoteIndex(firstYear)).not.toBe(
      dashboardQuoteIndex(followingYear)
    );
    expect(dashboardDailyQuote(firstYear)).not.toBe(
      dashboardDailyQuote(followingYear)
    );
  });

  it("nutzt einen positiven zyklischen Index auch für frühere Jahre", () => {
    const index = dashboardQuoteIndex(new Date(2020, 0, 1, 12));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(365);
  });
});
