import { describe, expect, it } from "vitest";
import {
  materialStatusLabel,
  materialStatusText,
  normalizeMaterialStatus,
} from "../shared/material-status";

describe("Material-Status-Normalisierung und Labels", () => {
  it("normalisiert historische Ja/True-Werte auf 'geliefert'", () => {
    expect(normalizeMaterialStatus("ja")).toBe("geliefert");
    expect(normalizeMaterialStatus("Ja")).toBe("geliefert");
    expect(normalizeMaterialStatus("JA")).toBe("geliefert");
    expect(normalizeMaterialStatus(true)).toBe("geliefert");
    expect(normalizeMaterialStatus("true")).toBe("geliefert");
    expect(normalizeMaterialStatus("geliefert")).toBe("geliefert");
    expect(normalizeMaterialStatus("Geliefert")).toBe("geliefert");
  });

  it("normalisiert historische Nein/False/Leer-Werte auf 'offen'", () => {
    expect(normalizeMaterialStatus("nein")).toBe("offen");
    expect(normalizeMaterialStatus("Nein")).toBe("offen");
    expect(normalizeMaterialStatus(false)).toBe("offen");
    expect(normalizeMaterialStatus("false")).toBe("offen");
    expect(normalizeMaterialStatus("")).toBe("offen");
    expect(normalizeMaterialStatus(null)).toBe("offen");
    expect(normalizeMaterialStatus(undefined)).toBe("offen");
    expect(normalizeMaterialStatus("offen")).toBe("offen");
    expect(normalizeMaterialStatus("Offen")).toBe("offen");
  });

  it("akzeptiert den Status 'bestellt'", () => {
    expect(normalizeMaterialStatus("bestellt")).toBe("bestellt");
    expect(normalizeMaterialStatus("Bestellt")).toBe("bestellt");
    expect(normalizeMaterialStatus("BESTELLT")).toBe("bestellt");
  });

  it("liefert korrekte visuelle Ampel-Labels", () => {
    expect(materialStatusLabel("offen")).toBe("🔴 Offen");
    expect(materialStatusLabel("bestellt")).toBe("🟡 Bestellt");
    expect(materialStatusLabel("geliefert")).toBe("🟢 Geliefert");
    expect(materialStatusLabel("ja")).toBe("🟢 Geliefert");
    expect(materialStatusLabel("nein")).toBe("🔴 Offen");
    expect(materialStatusText("offen")).toBe("Offen");
    expect(materialStatusText("bestellt")).toBe("Bestellt");
    expect(materialStatusText("geliefert")).toBe("Geliefert");
  });
});
