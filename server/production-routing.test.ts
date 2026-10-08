import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Produktionsrouting für App, Landingpage und Master-Portal", () => {
  const appSource = readFileSync(
    path.resolve(__dirname, "../client/src/App.tsx"),
    "utf8"
  );
  const portalSource = readFileSync(
    path.resolve(__dirname, "../client/src/pages/MasterAdminPortal.tsx"),
    "utf8"
  );
  const viteSource = readFileSync(
    path.resolve(__dirname, "../server/_core/vite.ts"),
    "utf8"
  );

  it("rendert das Master-Portal nur über den dedizierten Master-Host", () => {
    const regularRouterSource = appSource.slice(appSource.indexOf("function Router()"));
    expect(appSource).toContain("function MasterAdminRouter()");
    expect(appSource).toContain("masterAdminSite ? (");
    expect(appSource).toContain("<MasterAdminRouter />");
    expect(regularRouterSource).not.toContain('<Route path="/" component={MasterAdminPortal} />');
  });

  it("hält die lokale Master-Vorschau hinter einem expliziten Demo-Parameter", () => {
    expect(portalSource).toContain('get("demo") === "true"');
  });

  it("belässt die Vereinsanwendung am Root des App-Hosts", () => {
    expect(appSource).toContain('<Route path="/" component={Dashboard} />');
  });

  it("behält beim serverseitigen HTML-Fallback den vollständigen öffentlichen Pfad für Canonicals", () => {
    expect(viteSource).toContain("req.hostname, req.originalUrl");
    expect(viteSource).not.toContain("req.hostname, req.path");
  });
});
