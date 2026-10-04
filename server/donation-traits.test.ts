import { describe, expect, it } from "vitest";
import { renderDonationOverviewPdf } from "./pdf";
import { parseProjectFile, exportProjectFile } from "./project-file";
import type { Cake } from "../drizzle/schema";

describe("erweiterte Spendenkennzeichnungen", () => {
  it("PDF-Spendenübersicht formatiert alle acht Kennzeichnungen korrekt", async () => {
    const sampleDonation: Cake = {
      id: 99,
      year: 2026,
      eventId: 1,
      donor: "Erika Muster",
      cake: "Festtagskuchen",
      donationCategory: "kuchen",
      locationId: null,
      dropoffDate: "2026-06-20",
      dropoffTime: "10:30",
      legacyDropoffText: "",
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      containsNuts: true,
      sugarFree: true,
      containsAlcohol: true,
      meat: false,
      note: "Mit Dinkel & Stevia",
      sortOrder: 1,
    };

    const pdfBuffer = await renderDonationOverviewPdf(
      {
        cakes: [sampleDonation],
        locations: [],
        settings: {
          id: 1,
          year: 2026,
          activeEventId: 1,
          eventName: "Testfest",
          pdfLogoKey: null,
          pdfLogoUrl: null,
          pdfLogoFallback: "brand",
        } as any,
      } as any,
      [99]
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(500);
  });

  it("Projektdatei-Export und -Import behält alle acht Kennzeichnungen verlustfrei bei", () => {
    const documentData = {
      metadata: {
        format: "RSC-HELFERPLANUNG-PROJEKTDATEI",
        version: 18,
        eventId: 1,
        eventName: "Radsportfestival",
        year: 2026,
        activeDays: ["Freitag", "Samstag", "Sonntag"],
        pdfLogoKey: null,
        pdfLogoUrl: null,
        pdfLogoFallback: "brand",
        startDate: "2026-06-19",
        endDate: "2026-06-21",
        donationTargetKuchen: 10,
        donationTargetSalat: 5,
        donationTargetSnack: 5,
        donationTargetSonstiges: 2,
        exportedAt: new Date().toISOString(),
      },
      contacts: [],
      helpers: [],
      shifts: [],
      prep: [],
      post: [],
      materials: [],
      marketing: [],
      approvals: [],
      locations: [],
      finances: [],
      cakes: [
        {
          sourceId: 50,
          donor: "Samira Beispiel",
          cake: "Nussecken",
          donationCategory: "kuchen",
          locationSourceId: null,
          locationName: "",
          dropoffDate: "2026-06-20",
          dropoffTime: "14:00",
          legacyDropoffText: "",
          vegan: true,
          vegetarian: true,
          glutenFree: false,
          lactoseFree: true,
          containsNuts: true,
          sugarFree: false,
          containsAlcohol: true,
          meat: false,
          note: "Mit Haselnüssen und Rum",
          sortOrder: 0,
        },
      ],
      warnings: [],
    };

    const parsed = parseProjectFile(
      Buffer.from(JSON.stringify(documentData), "utf-8").toString("base64")
    );
    expect(parsed.document.cakes[0]).toMatchObject({
      donor: "Samira Beispiel",
      cake: "Nussecken",
      vegetarian: true,
      containsNuts: true,
      containsAlcohol: true,
    });
  });
});
