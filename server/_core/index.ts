import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerBrandAssetRoutes } from "../brand-asset-routes";
import { registerKlemmiAssetRoutes } from "../klemmi-asset-routes";
import { appRouter } from "../routers";
import { registerHelpImageRoutes } from "../help-image-routes";
import { registerHelpTrainingVideoRoutes } from "../help-training-video-routes";
import { registerEventPdfImageRoutes } from "../event-pdf-image-routes";
import { registerPublicHelperPdfRoutes } from "../public-helper-pdf-routes";
import { registerLocationLogoRoutes } from "../location-logo-routes";
import { registerMarketingVideoRoutes } from "../marketing-video-routes";
import { registerTenantLogoRoutes } from "../tenant-logo-routes";
import { registerGameAssetRoutes } from "../game-asset-routes";
import { handleTeamNotesCleanupHeartbeat } from "../chat-cleanup-heartbeat";
import { handleProductExpiryReminderHeartbeat } from "../product-expiry-heartbeat";
import {
  canonicalMarketingRedirectUrl,
  shouldRedirectProtectiveMarketingDomain,
} from "../marketing-domain-redirect";
import { registerLocalStorageRoutes } from "../storage";
import { backfillTenantContractAcceptanceSnapshots } from "../db";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function assertProductionConfiguration() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = ["DATABASE_URL", "JWT_SECRET"].filter(
    name => !process.env[name]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `MyCrewMate kann nicht sicher starten: fehlende Umgebungsvariable(n) ${missing.join(", ")}`
    );
  }
}

async function startServer() {
  assertProductionConfiguration();

  // Die Containerstart-Migration ergänzt ältere, bereits hash-gesicherte
  // Vertragsannahmen einmalig um ihren originalen Wortlaut. Unbekannte
  // Prüfsummen werden bewusst nicht überschrieben.
  try {
    const updatedContractSnapshots =
      await backfillTenantContractAcceptanceSnapshots();
    if (updatedContractSnapshots > 0) {
      console.info(
        `[Vertragsnachweise] ${updatedContractSnapshots} historische Dokumentschnappschüsse ergänzt.`
      );
    }
  } catch (error) {
    console.error(
      "[Vertragsnachweise] Historische Dokumentschnappschüsse konnten beim Start nicht ergänzt werden.",
      error
    );
  }

  const app = express();
  // Coolify terminiert HTTPS vor dem Container und übergibt X-Forwarded-Proto.
  // Das Vertrauen in genau einen vorgeschalteten Proxy ist für sichere Cookies nötig.
  app.set("trust proxy", 1);
  const server = createServer(app);

  // Die reservierten Landesdomains sind ausschließlich Schutzdomains. Sie
  // liefern daher nie eine eigene Kopie der Website aus, sondern führen mit
  // Pfad und Query dauerhaft auf die deutsche Hauptdomain zurück.
  app.use((req, res, next) => {
    if (!shouldRedirectProtectiveMarketingDomain(req.method, req.hostname)) {
      next();
      return;
    }

    const destination = canonicalMarketingRedirectUrl(req.hostname, req.originalUrl);
    if (!destination) {
      next();
      return;
    }

    res.redirect(308, destination);
  });

  // Einheitliche Browser-Schutzvorgaben. Die Kartenkacheln sind die einzigen
  // bewusst zugelassenen fremden Bildquellen; Anwendungs- und API-Daten bleiben
  // auf der eigenen Origin.
  app.use((_req, res, next) => {
    res.set({
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    if (process.env.NODE_ENV === "production") {
      res.set({
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.tile.opentopomap.org",
          "media-src 'self' https://files.manuscdn.com",
          "connect-src 'self'",
        ].join("; "),
      });
    }
    next();
  });

  // Projekt- und Excel-Dateien plus Base64-/JSON-Overhead; größere Requests werden früh abgewiesen.
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  registerBrandAssetRoutes(app);
  registerKlemmiAssetRoutes(app);
  registerHelpImageRoutes(app);
  registerHelpTrainingVideoRoutes(app);
  registerEventPdfImageRoutes(app);
  registerPublicHelperPdfRoutes(app);
  registerLocationLogoRoutes(app);
  registerTenantLogoRoutes(app);
  registerGameAssetRoutes(app);
  registerLocalStorageRoutes(app);
  registerMarketingVideoRoutes(app);
  app.post("/api/scheduled/team-notes-cleanup", handleTeamNotesCleanupHeartbeat);
  app.post("/api/scheduled/product-expiry-reminders", handleProductExpiryReminderHeartbeat);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Development uses Vite; production serves the immutable build artefact.
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT muss eine gültige TCP-Portnummer sein");
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`MyCrewMate läuft auf http://0.0.0.0:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[Startup] MyCrewMate konnte nicht gestartet werden", error);
  process.exitCode = 1;
});
