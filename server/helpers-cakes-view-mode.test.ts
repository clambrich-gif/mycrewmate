import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

async function loadSource(path: string) {
  return readFile(new URL(path, root), "utf8");
}

describe("Helfer und Spenden: optionale Kachel- und Listenansicht", () => {
  it("bietet in Helpers.tsx den Umschalter auf Kacheln an und behält alle bisherigen Helferfunktionen bei", async () => {
    const helpersSource = await loadSource("client/src/pages/Helpers.tsx");

    // Umschalter und Hook vorhanden
    expect(helpersSource).toContain('useViewMode("helpers", "liste")');
    expect(helpersSource).toContain("<ViewModeToggle");

    // Beide Modi vorhanden
    expect(helpersSource).toContain('viewMode === "liste" ?');
    expect(helpersSource).toContain('data-slot="helpers-cards-view"');

    // Volle Funktionserhaltung in Kacheln
    expect(helpersSource).toContain("CakeDonationAction");
    expect(helpersSource).toContain("Aufgabenplan per WhatsApp an Helfer senden");
    expect(helpersSource).toContain("Einsatz-PDF herunterladen");
    expect(helpersSource).toContain("DayAvailabilityControl");
    expect(helpersSource).toContain("setDeleteTarget");
  });

  it("erfasst eine zugesagte Spende direkt innerhalb der Helferanlage mit allen bisherigen Kuchenmerkmalen", async () => {
    const helpersSource = await loadSource("client/src/pages/Helpers.tsx");
    const routerSource = await loadSource("server/routers.ts");
    const dbSource = await loadSource("server/db.ts");

    expect(helpersSource).toContain('data-slot="new-helper-donation-form"');
    expect(helpersSource).toContain("newHelperDonationCategories");
    expect(helpersSource).toContain("newHelperDonationTraits");
    expect(helpersSource).toContain("vegan");
    expect(helpersSource).toContain("glutenFree");
    expect(helpersSource).toContain("lactoseFree");
    expect(helpersSource).toContain("containsNuts");
    expect(helpersSource).toContain("meat");
    expect(helpersSource).toContain("createWithDonation.mutate");

    expect(routerSource).toContain("createWithDonation: protectedProcedure");
    expect(routerSource).toContain('requireModuleWritePermission(permissions, "helpers")');
    expect(routerSource).toContain('requireModuleWritePermission(permissions, "donations")');
    expect(routerSource).toContain("db.createHelperWithDonation(input)");
    expect(dbSource).toContain("export async function createHelperWithDonation");
    expect(dbSource).toContain("return database.transaction(async tx =>");
  });

  it("bietet in Cakes.tsx den Umschalter auf Kacheln an und behält alle Spenden- und Allergie-Eigenschaften bei", async () => {
    const cakesSource = await loadSource("client/src/pages/Cakes.tsx");

    // Umschalter und Hook vorhanden
    expect(cakesSource).toContain('useViewMode("donations", "liste")');
    expect(cakesSource).toContain("<ViewModeToggle");

    // Beide Modi vorhanden
    expect(cakesSource).toContain('viewMode === "liste" ?');
    expect(cakesSource).toContain('data-slot="donations-cards-view"');

    // Volle Funktions- und Eigenschaftserhaltung in Kacheln
    expect(cakesSource).toContain("CategoryBadge");
    expect(cakesSource).toContain("TraitTags");
    expect(cakesSource).toContain("formatDropoffTime");
    expect(cakesSource).toContain("openEdit");
    expect(cakesSource).toContain("setDeleteTarget");
  });

  it("speichert die Wahl des Nutzers lokal im Browser", async () => {
    const hookSource = await loadSource("client/src/hooks/useViewMode.ts");
    expect(hookSource).toContain("mycrewmate_view_mode_");
    expect(hookSource).toContain("window.localStorage.getItem");
    expect(hookSource).toContain("window.localStorage.setItem");
  });
});
