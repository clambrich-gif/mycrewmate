import type { Request } from "express";
import { productAllowsCapability, type ProductCapability } from "../shared/product-packages";
import { mayReadPlanningModule, type EditablePlanningModule } from "../shared/tenant-permissions";
import { sdk, type AuthenticatedUser } from "./_core/sdk";
import * as db from "./db";
import {
  ADMIN_PASSWORD_OPEN_ID,
  isTenantAdminPasswordOpenId,
  planningTeamAccessIdFromOpenId,
  SHARED_PASSWORD_OPEN_ID,
} from "./password-auth";

export type ProtectedEventAsset = {
  tenantId: string;
  year: number;
  eventId: number;
};

export type AssetRouteUser = Pick<
  AuthenticatedUser,
  "id" | "openId" | "role"
> & {
  isCron?: boolean;
};

/**
 * Prüft einen direkten Assetabruf mit derselben serverseitigen Quelle wie die
 * Planungs-API: Vereinsbindung, Veranstaltungsfreigabe, Fachbereichsrecht und
 * Paketrecht. Browser-Header oder erratene URLs können diese Prüfung nicht
 * beeinflussen.
 */
export async function mayReadProtectedEventAsset(
  user: AssetRouteUser,
  asset: ProtectedEventAsset,
  options: {
    module: EditablePlanningModule;
    capability: ProductCapability;
  }
): Promise<boolean> {
  // Ausschließlich der Plattformadministrator darf mandantenübergreifend prüfen.
  if (user.role === "admin" && user.openId === ADMIN_PASSWORD_OPEN_ID) return true;
  if (user.isCron || user.openId === SHARED_PASSWORD_OPEN_ID) return false;

  const entitlement = await db.getTenantProductEntitlement(asset.tenantId);
  if (!entitlement.isUsable || !productAllowsCapability(entitlement.packageId, options.capability)) {
    return false;
  }
  if (entitlement.packageId === "event_pass" && entitlement.eventId !== asset.eventId) {
    return false;
  }

  const planningAccessId = planningTeamAccessIdFromOpenId(user.openId);
  if (planningAccessId !== null) {
    const tenantId = await db.getPlanningTeamAccessTenantId(planningAccessId);
    if (tenantId !== asset.tenantId) return false;
    if (await db.isPlanningTeamAccessPasswordChangeRequired(planningAccessId)) return false;

    const access = await db.getPlanningTeamAccessCredentialForCurrentTenant(
      planningAccessId,
      asset.tenantId
    );
    if (!access) return false;
    if (!access.isTenantAdmin) {
      if (!(await db.isPlanningTeamAccessAllowedForEvent(
        planningAccessId,
        asset.eventId,
        asset.tenantId
      ))) {
        return false;
      }
      const moduleAccess = access.moduleAccess ?? access.modulePermissions;
      if (!mayReadPlanningModule(moduleAccess, options.module)) return false;
    }
    return true;
  }

  if (
    isTenantAdminPasswordOpenId(user.openId) &&
    (await db.isTenantAdminPasswordChangeRequired(user.id))
  ) {
    return false;
  }

  const membership = await db.resolveTenantForUser({
    userId: user.id,
    userOpenId: user.openId,
    allowPilotFallback: false,
  });
  return membership?.tenantId === asset.tenantId;
}

export const defaultEventAssetAccessDependencies = {
  authenticateRequest: (req: Request) => sdk.authenticateRequest(req),
  mayReadEventAsset: mayReadProtectedEventAsset,
};
