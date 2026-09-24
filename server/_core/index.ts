import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerBrandAssetRoutes } from "../brand-asset-routes";
import { appRouter } from "../routers";
import { registerHelpImageRoutes } from "../help-image-routes";
import { registerHelpTrainingVideoRoutes } from "../help-training-video-routes";
import { registerEventPdfImageRoutes } from "../event-pdf-image-routes";
import { registerPublicHelperPdfRoutes } from "../public-helper-pdf-routes";
import { registerLocationLogoRoutes } from "../location-logo-routes";
import { registerMarketingVideoRoutes } from "../marketing-video-routes";
import { registerTenantLogoRoutes } from "../tenant-logo-routes";
import { handleTeamNotesCleanupHeartbeat } from "../chat-cleanup-heartbeat";
import { registerLocalStorageRoutes } from "../storage";
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

  const app = express();
  // Coolify terminiert HTTPS vor dem Container und übergibt X-Forwarded-Proto.
  // Das Vertrauen in genau einen vorgeschalteten Proxy ist für sichere Cookies nötig.
  app.set("trust proxy", 1);
  const server = createServer(app);

  // Projekt- und Excel-Dateien plus Base64-/JSON-Overhead; größere Requests werden früh abgewiesen.
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  registerBrandAssetRoutes(app);
  registerHelpImageRoutes(app);
  registerHelpTrainingVideoRoutes(app);
  registerEventPdfImageRoutes(app);
  registerPublicHelperPdfRoutes(app);
  registerLocationLogoRoutes(app);
  registerTenantLogoRoutes(app);
  registerLocalStorageRoutes(app);
  registerMarketingVideoRoutes(app);
  app.post("/api/scheduled/team-notes-cleanup", handleTeamNotesCleanupHeartbeat);

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
