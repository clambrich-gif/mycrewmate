import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { helperPdfLocationLink } from "./pdf";

describe("Light-Orte ohne Live-Karte und GPS-Pflicht", () => {
  it("blendet auf der Orte-Seite im Light-Paket die Kartenhinweise, GPS-Spalten und das Logofeld aus", () => {
    const locationsSource = readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Locations.tsx"),
      "utf8"
    );

    expect(locationsSource).toContain(
      'canUseMapsGpx\n              ? "Zentral gepflegte Orte stehen in Schichten, Vorbereitungen und Material zur Auswahl und erscheinen auf der Live-Standortkarte."'
    );
    expect(locationsSource).toContain(
      '"Zentral gepflegte Orte stehen in Schichten, Vorbereitung und Material zur Auswahl."'
    );
    expect(locationsSource).toContain(
      "canUseMapsGpx ? (\n          <div className=\"hidden grid-cols-[minmax(0,1fr)_120px_120px_auto]"
    );
    expect(locationsSource).toContain(
      '<div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:grid">'
    );
    expect(locationsSource).toContain(
      '{canUseMapsGpx && (\n              <>\n                <div data-klemmi-target="locations-coordinates"'
    );
    expect(locationsSource).toContain(
      'className="h-10 min-w-[140px] border-slate-300 bg-white px-4 font-medium text-slate-800 shadow-sm hover:bg-slate-50 hover:text-slate-950 sm:px-5"'
    );
  });

  it("erlaubt im Router das Anlegen von Orten ohne Koordinaten und sperrt Standortlogos serverseitig mit maps_gpx", () => {
    const routerSource = readFileSync(
      path.resolve(process.cwd(), "server/routers.ts"),
      "utf8"
    );

    expect(routerSource).toContain(
      'latitude: z.number().finite().min(-90).max(90).nullable().optional()'
    );
    expect(routerSource).toContain(
      'longitude: z.number().finite().min(-180).max(180).nullable().optional()'
    );
    expect(routerSource).toContain(
      'uploadLogo: productCapabilityAdminProcedure("maps_gpx")'
    );
    expect(routerSource).toContain(
      'clearLogo: productCapabilityAdminProcedure("maps_gpx")'
    );
  });

  it("erzeugt für Orte ohne Koordinaten keinen fehlerhaften PDF-Kartenlink", () => {
    expect(
      helperPdfLocationLink({
        name: "Viehmarktplatz Mayen",
        latitude: null as unknown as number,
        longitude: null as unknown as number,
      })
    ).toBeNull();

    expect(
      helperPdfLocationLink({
        name: "Viehmarktplatz Mayen",
        latitude: 50.3271,
        longitude: 7.2215,
      })
    ).toEqual({
      label: "Viehmarktplatz Mayen",
      url: "https://www.google.com/maps/search/?api=1&query=50.3271%2C7.2215",
    });
  });
});
