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
  canUseMapsGpx: true,
  canUseDonations: true,
  currentPackageId: "pro",
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

  it("lässt im Light-Paket gesperrte Spenden weg und erklärt die Karte als Pro-Erweiterung", () => {
    const steps = createDashboardKlemmiSteps({
      ...populatedDashboard,
      canUseMapsGpx: false,
      canUseDonations: false,
      currentPackageId: "light",
      detailsLayout: "side-by-side",
    });

    expect(steps.find(step => step.key === "helpers-active")?.text).not.toContain(
      "Verpflegungsspenden"
    );
    expect(steps.find(step => step.key === "map-locked")).toMatchObject({
      audioKey: "map-locked-light",
      allowMissingTarget: true,
    });
  });
});
