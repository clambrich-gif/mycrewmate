import { describe, expect, it } from "vitest";
import { effectiveViewMode } from "../client/src/hooks/useViewMode";

describe("Smartphone-Kachelmodus", () => {
  it("erzwingt mobil die Kachelansicht und bewahrt die Desktop-Präferenz", () => {
    expect(effectiveViewMode("liste", true)).toBe("kacheln");
    expect(effectiveViewMode("kacheln", true)).toBe("kacheln");
    expect(effectiveViewMode("liste", false)).toBe("liste");
    expect(effectiveViewMode("kacheln", false)).toBe("kacheln");
  });
});
