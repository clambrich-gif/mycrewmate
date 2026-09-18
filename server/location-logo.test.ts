import { describe, expect, it } from "vitest";
import {
  locationLogoDimensions,
  MAX_LOCATION_LOGO_DIMENSION,
} from "../client/src/lib/location-logo";

describe("locationLogoDimensions", () => {
  it("behält kleine Logos unverändert", () => {
    expect(locationLogoDimensions(320, 180)).toEqual({ width: 320, height: 180 });
  });

  it("skaliert breite Rasterlogos auf maximal 800 Pixel", () => {
    expect(locationLogoDimensions(2400, 1200)).toEqual({
      width: MAX_LOCATION_LOGO_DIMENSION,
      height: 400,
    });
  });

  it("skaliert hohe Rasterlogos proportional", () => {
    expect(locationLogoDimensions(900, 1800)).toEqual({ width: 400, height: 800 });
  });

  it("weist ungültige Bildabmessungen zurück", () => {
    expect(() => locationLogoDimensions(0, 200)).toThrow("ungültig");
  });
});
