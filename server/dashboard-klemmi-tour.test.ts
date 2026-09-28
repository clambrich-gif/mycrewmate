import { describe, expect, it } from "vitest";
import { createDashboardKlemmiSteps } from "../client/src/lib/dashboard-klemmi-tour";

const populatedDashboard = {
  hasEventPeriod: true,
  hasPriorityActions: true,
  hasDeadlines: true,
  hasHelpers: true,
  hasAssignments: true,
  hasContacts: true,
  hasMappableLocations: true,
} as const;

function detailsStep(detailsLayout: "side-by-side" | "stacked") {
  const step = createDashboardKlemmiSteps({ ...populatedDashboard, detailsLayout }).find(
    candidate => candidate.key === "details-active"
  );
  if (!step) throw new Error("Der Dashboard-Detail-Schritt fehlt.");
  return step;
}

describe("Dashboard-Klemmi-Tour", () => {
  it("beschreibt nebeneinanderstehende Details für breite Bildschirme", () => {
    const step = detailsStep("side-by-side");

    expect(step.audioKey).toBe("details-active");
    expect(step.text).toContain("Links siehst du Verantwortlichkeiten");
    expect(step.text).toContain("Rechts zeigt die Helferauslastung");
  });

  it("beschreibt gestapelte Details für Mobilgeräte und kleine Tablets", () => {
    const step = detailsStep("stacked");

    expect(step.audioKey).toBe("details-active-stacked");
    expect(step.text).toContain("Oben siehst du Verantwortlichkeiten");
    expect(step.text).toContain("Darunter zeigt die Helferauslastung");
    expect(step.text).not.toContain("Links siehst du Verantwortlichkeiten");
    expect(step.text).not.toContain("Rechts zeigt die Helferauslastung");
  });
});
