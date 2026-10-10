/**
 * Ausschließlich anonyme, zusammengefasste Aufrufarten der öffentlichen Seiten.
 * Es gibt absichtlich keine Besucher-, Geräte-, IP- oder Sitzungskennung.
 */
export const PUBLIC_REACH_METRIC_KEYS = [
  "home_page_view",
  "pilot_page_view",
  "pilot_inquiry_view",
  "club_demo_page_view",
  "club_demo_started",
  "pilot_video_started",
] as const;

export type PublicReachMetricKey = (typeof PUBLIC_REACH_METRIC_KEYS)[number];

export type PublicReachMetricSummary = {
  metric: PublicReachMetricKey;
  total: number;
  last30Days: number;
  firstRecordedOn: string | null;
  lastRecordedOn: string | null;
};
