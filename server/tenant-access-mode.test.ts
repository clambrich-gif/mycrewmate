import { describe, expect, it } from "vitest";
import {
  tenantAccessModeFromState,
  tenantCreationSetupForAccessMode,
} from "../shared/tenant-access-mode";

describe("vereinfachte Vereinszugänge", () => {
  it("übersetzt jede sichtbare Auswahl in sichere interne Werte", () => {
    expect(tenantCreationSetupForAccessMode("pilot")).toMatchObject({
      tenantStatus: "pilot",
      packageStatus: "test",
      planName: "Pilotzugang",
    });
    expect(tenantCreationSetupForAccessMode("test")).toMatchObject({
      tenantStatus: "sample",
      packageStatus: "test",
      planName: "Testzugang",
    });
    expect(tenantCreationSetupForAccessMode("active")).toMatchObject({
      tenantStatus: "active",
      packageStatus: "active",
    });
    expect(tenantCreationSetupForAccessMode("paused")).toMatchObject({
      tenantStatus: "sample",
      packageStatus: "paused",
    });
    expect(tenantCreationSetupForAccessMode("expired")).toMatchObject({
      tenantStatus: "sample",
      packageStatus: "expired",
    });
  });

  it("zeigt einen bestehenden Pilotverein nur einmal als Pilotzugang an", () => {
    expect(
      tenantAccessModeFromState({ tenantStatus: "pilot", packageStatus: "test" })
    ).toBe("pilot");
  });

  it("ändert bestehende Pilotvereine ohne Produktzeile nicht und behandelt sie als Pilotzugang", () => {
    expect(
      tenantAccessModeFromState({ tenantStatus: "pilot", packageStatus: null })
    ).toBe("pilot");
  });

  it("blockiert pausierte und abgelaufene Zugänge unabhängig vom sonstigen Vereinsstatus", () => {
    expect(
      tenantAccessModeFromState({ tenantStatus: "active", packageStatus: "paused" })
    ).toBe("paused");
    expect(
      tenantAccessModeFromState({ tenantStatus: "active", packageStatus: "expired" })
    ).toBe("expired");
  });
});
