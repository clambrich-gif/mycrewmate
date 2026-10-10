import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("öffentliche Pilot- und Datenschutzhinweise", () => {
  it("beschreibt die aktive Pilotanfrage, Pilotzugänge und die Dreijahresfrist widerspruchsfrei", () => {
    const legal = read("client/src/pages/PublicLegal.tsx");

    expect(legal).toContain("2.1 Anonyme Reichweitenmessung");
    expect(legal).toContain("2.2 Unverbindliche Pilotanfrage");
    expect(legal).toContain("2.3 Vereinbarter Pilotzugang");
    expect(legal).toContain("keine IP-Adressen, Cookies, Gerätekennungen, Browsermerkmale oder Besucherprofile");
    expect(legal).toContain("höchstens zwei Jahre aufbewahrt und anschließend automatisch gelöscht");
    expect(legal).toContain("drei Jahre reaktivierbar");
    expect(legal).toContain("Hetzner Online GmbH");
    expect(legal).toContain("Diese Angaben sind erforderlich");
    expect(legal).toContain("Die Telefonnummer sowie weitere Angaben zum Vorhaben sind freiwillig");
    expect(legal).toContain("aktuelle öffentliche Website mit Pilotanfrage und fiktiver Vereinsdemo");
    expect(legal).not.toContain("tracker- und formularfreien Startauftritt");
    expect(legal).toContain("Wirtschafts-Identifikationsnummer gemäß § 139c AO: DE428034222");
    expect(legal).toContain("spätestens innerhalb von 45 Minuten nach ihrer Anlage automatisch gelöscht");
    expect(legal).toContain("höchstens sieben täglichen Wiederherstellungspunkten");
    expect(legal).toContain("höchstens 14 Tage aufbewahrt");
    expect(legal).toContain("Access-Log-Funktion des Reverse Proxys ist nicht aktiviert");
    expect(legal).toContain("Sicherheits-, Login- und Aktivitätsprotokolle innerhalb der MyCrewMate-Anwendung werden höchstens zwölf Monate gespeichert");
  });
});
