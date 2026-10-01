import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getTenantProductEntitlement: vi.fn(),
  getPlanningTeamAccessTenantId: vi.fn(),
  isPlanningTeamAccessPasswordChangeRequired: vi.fn(),
  getPlanningTeamAccessCredentialForCurrentTenant: vi.fn(),
  isPlanningTeamAccessAllowedForEvent: vi.fn(),
  isTenantAdminPasswordChangeRequired: vi.fn(),
  resolveTenantForUser: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { mayReadProtectedEventAsset } from "./event-asset-access";

const asset = { tenantId: "sportverein-muster", year: 2027, eventId: 77 };
const usablePro = {
  tenantId: asset.tenantId,
  packageId: "pro",
  isUsable: true,
  eventId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getTenantProductEntitlement.mockResolvedValue(usablePro);
  dbMocks.resolveTenantForUser.mockResolvedValue({ tenantId: asset.tenantId });
  dbMocks.isTenantAdminPasswordChangeRequired.mockResolvedValue(false);
});

describe("Serverseitiger Assetzugriff", () => {
  it("erlaubt einer bestätigten Vereinsmitgliedschaft das zugehörige PDF-Bild", async () => {
    await expect(
      mayReadProtectedEventAsset(
        { id: 10, openId: "oauth-user-10", role: "user" },
        asset,
        { module: "pdf", capability: "custom_branding" }
      )
    ).resolves.toBe(true);
    expect(dbMocks.resolveTenantForUser).toHaveBeenCalledWith({
      userId: 10,
      userOpenId: "oauth-user-10",
      allowPilotFallback: false,
    });
  });

  it("weist ein nicht nutzbares Paket noch vor jeder Dateiauslieferung ab", async () => {
    dbMocks.getTenantProductEntitlement.mockResolvedValue({
      ...usablePro,
      isUsable: false,
    });

    await expect(
      mayReadProtectedEventAsset(
        { id: 10, openId: "oauth-user-10", role: "user" },
        asset,
        { module: "pdf", capability: "custom_branding" }
      )
    ).resolves.toBe(false);
    expect(dbMocks.resolveTenantForUser).not.toHaveBeenCalled();
  });

  it("bindet den Event Pass serverseitig an genau seine zugewiesene Veranstaltung", async () => {
    dbMocks.getTenantProductEntitlement.mockResolvedValue({
      ...usablePro,
      packageId: "event_pass",
      eventId: 99,
    });

    await expect(
      mayReadProtectedEventAsset(
        { id: 10, openId: "oauth-user-10", role: "user" },
        asset,
        { module: "locations", capability: "maps_gpx" }
      )
    ).resolves.toBe(false);
  });

  it("verlangt für Planungsteamkonten Eventfreigabe und Fachbereichsleserecht", async () => {
    dbMocks.getPlanningTeamAccessTenantId.mockResolvedValue(asset.tenantId);
    dbMocks.isPlanningTeamAccessPasswordChangeRequired.mockResolvedValue(false);
    dbMocks.getPlanningTeamAccessCredentialForCurrentTenant.mockResolvedValue({
      isTenantAdmin: false,
      moduleAccess: { locations: "off" },
      modulePermissions: [],
    });
    dbMocks.isPlanningTeamAccessAllowedForEvent.mockResolvedValue(true);

    await expect(
      mayReadProtectedEventAsset(
        { id: 12, openId: "planning-team-access-42", role: "user" },
        asset,
        { module: "locations", capability: "maps_gpx" }
      )
    ).resolves.toBe(false);
  });

  it("verlangt für Planungsteamkonten die konkrete Veranstaltungsfreigabe", async () => {
    dbMocks.getPlanningTeamAccessTenantId.mockResolvedValue(asset.tenantId);
    dbMocks.isPlanningTeamAccessPasswordChangeRequired.mockResolvedValue(false);
    dbMocks.getPlanningTeamAccessCredentialForCurrentTenant.mockResolvedValue({
      isTenantAdmin: false,
      moduleAccess: { locations: "read" },
      modulePermissions: [],
    });
    dbMocks.isPlanningTeamAccessAllowedForEvent.mockResolvedValue(false);

    await expect(
      mayReadProtectedEventAsset(
        { id: 12, openId: "planning-team-access-42", role: "user" },
        asset,
        { module: "locations", capability: "maps_gpx" }
      )
    ).resolves.toBe(false);
  });

  it("lässt ausschließlich die Plattformadministration mandantenübergreifend prüfen", async () => {
    await expect(
      mayReadProtectedEventAsset(
        { id: 1, openId: "shared-password-admin", role: "admin" },
        asset,
        { module: "pdf", capability: "custom_branding" }
      )
    ).resolves.toBe(true);
    expect(dbMocks.getTenantProductEntitlement).not.toHaveBeenCalled();
  });
});
