import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("öffentliche Pilot- und Datenschutzhinweise", () => {
  it("beschreibt die aktive Pilotanfrage, Pilotzugänge und die Dreijahresfrist widerspruchsfrei", () => {
    const legal = read("client/src/pages/PublicLegal.tsx");

    expect(legal).toContain("2.1 Unverbindliche Pilotanfrage");
    expect(legal).toContain("2.2 Vereinbarter Pilotzugang");
    expect(legal).toContain("drei Jahre reaktivierbar");
    expect(legal).toContain("Hetzner Online GmbH");
    expect(legal).toContain("Diese Angaben sind erforderlich");
    expect(legal).toContain("Die Telefonnummer sowie weitere Angaben zum Vorhaben sind freiwillig");
    expect(legal).toContain("aktuelle öffentliche Website mit Pilotanfrage und fiktiver Vereinsdemo");
    expect(legal).not.toContain("tracker- und formularfreien Startauftritt");
  });
});
