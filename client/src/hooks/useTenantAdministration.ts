import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * Liefert die serverbestätigte Verwaltungsrolle für die aktuelle Vereinsansicht.
 * Co-Admins bleiben technisch persönliche Planungsteamkonten, erhalten hier aber
 * ihre effektiven Vereinsrechte für Navigation und Oberflächenfunktionen.
 */
export function useTenantAdministration() {
  const { user, isAuthenticated } = useAuth();
  const administrativeContext =
    trpc.planningTeamAccesses.administrativeContext.useQuery(undefined, {
      // Technische Hauptadministratoren besitzen weiterhin die etablierte
      // `admin`-Sitzungsrolle. Nur persönliche Planungsteamzugänge benötigen
      // die ergänzende serverseitige Co-Admin-Auflösung.
      enabled: isAuthenticated && user?.role === "user",
      retry: 1,
      staleTime: 30_000,
    });

  const isCoAdmin =
    user?.role === "user" &&
    administrativeContext.data?.isDelegatedTenantAdmin === true;
  const isTenantAdmin =
    user?.role === "admin" ||
    administrativeContext.data?.isTenantAdmin === true;
  const isPrimaryTenantAdmin =
    !isCoAdmin &&
    (user?.role === "admin" ||
      administrativeContext.data?.isPrimaryTenantAdmin === true);

  return {
    isTenantAdmin,
    isPrimaryTenantAdmin,
    isCoAdmin,
    administrativeContext,
  };
}

export function tenantRoleLabel(input: {
  isTenantAdmin: boolean;
  isPrimaryTenantAdmin: boolean;
  isCoAdmin: boolean;
}) {
  if (input.isCoAdmin) return "Co-Admin";
  if (input.isPrimaryTenantAdmin) return "Hauptadministrator";
  if (input.isTenantAdmin) return "Administrator";
  return "Planungsteam";
}
