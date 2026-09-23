import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Punkt 3: Sicherheits- und Berechtigungs-Hardening", () => {
  const routers = source("server/routers.ts");
  const passwordAuth = source("server/password-auth.ts");
  const publicPdfRoutes = source("server/public-helper-pdf-routes.ts");
  const locationLogoRoutes = source("server/location-logo-routes.ts");
  const nav = source("client/src/lib/nav.ts");

  it("schützt kritische administrative Mutationen mit adminProcedure", () => {
    // Schichten, Berechtigungen, Wiederherstellung, Backups, Events
    expect(routers).toContain("moduleWriteProcedure(\"schedule\")");
    expect(routers).toContain("preview: adminProcedure");
    expect(routers).toContain("restoreLogs: adminProcedure");
    expect(routers).toContain("previewModule: adminProcedure");
  });

  it("schützt die PDF-Konfiguration und das individuelle Event-Bild mit adminProcedure", () => {
    expect(routers).toContain("updateSettings: adminProcedure");
    expect(routers).toContain("uploadLogo: adminProcedure");
    expect(routers).toContain("clearLogo: adminProcedure");
    expect(routers).not.toContain("setLogoFallback: adminProcedure");
  });

  it("beschränkt die Zugangsschutz-Navigation streng auf Administratoren", () => {
    expect(nav).toContain('href: "/sicherheit"');
    expect(nav).toContain("adminOnly: true");
  });

  it("setzt im öffentlichen Helfer-PDF-Endpunkt strikte Sicherheits-Header", () => {
    expect(publicPdfRoutes).toContain('"X-Content-Type-Options": "nosniff"');
    expect(publicPdfRoutes).toContain('"X-Robots-Tag": "noindex, nofollow, noarchive"');
    expect(publicPdfRoutes).toContain('"Cross-Origin-Resource-Policy": "cross-origin"');
    expect(publicPdfRoutes).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("setzt im Standortlogo-Endpunkt Authentifizierung und Same-Origin-Schutz durch", () => {
    expect(locationLogoRoutes).toContain("authenticateRequest(req)");
    expect(locationLogoRoutes).toContain('"Cross-Origin-Resource-Policy": "same-origin"');
    expect(locationLogoRoutes).toContain('"X-Content-Type-Options": "nosniff"');
    expect(locationLogoRoutes).toContain('Vary: "Cookie, Authorization"');
  });

  it("verhindert DoS-Angriffe auf das Planungsteam durch IP-spezifischen Cooldown", () => {
    expect(passwordAuth).toContain("PLANNING_TEAM_MAX_ATTEMPTS = 5");
    expect(passwordAuth).toContain("getPlanningTeamCooldownMs");
    expect(passwordAuth).toContain("getPlanningTeamRateLimitStatus");
    expect(passwordAuth).toContain("recordFailedPlanningTeamLogin");
  });
});
