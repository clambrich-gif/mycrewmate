import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("öffentliche Vereinsdemo", () => {
  it("führt von der schlanken Auswahl in einen echten temporären App-Zugang", () => {
    const app = read("client/src/App.tsx");
    const landing = read("client/src/pages/ClubDemoLanding.tsx");
    const entry = read("client/src/pages/PublicDemoEntry.tsx");
    const server = read("server/_core/index.ts");

    expect(app).toContain('path="/vereinsdemo"');
    expect(app).toContain('path="/demozugang"');
    expect(landing).toContain("Die echte App fiktiv durchklicken");
    expect(landing).toContain("Vereinsdemo · fiktiv üben");
    expect(landing).toContain("Pilotprogramm · eigener Verein");
    expect(landing).toContain("Eigenen Verein im Pilotprogramm testen");
    expect(landing).toContain('href="/pilot"');
    expect(landing).toContain("Enterprise · für Verbände und große Vereine");
    expect(landing).not.toContain("Ultimate · für Verbände und große Vereine");
    expect(landing).toContain("trpc.publicDemo.start.useMutation");
    expect(landing).toContain("/api/public-demo/access");
    expect(entry).toContain("window.location.replace");
    expect(server).toContain('app.get("/api/public-demo/access", handlePublicDemoAccess)');
  });

  it("isoliert und löscht die fiktiven Daten wieder", () => {
    const router = read("server/routers.ts");
    const demo = read("server/public-demo.ts");
    const cleanup = read("server/public-demo-cleanup.ts");

    expect(router).toContain("publicDemo: router");
    expect(demo).toContain("createPublicDemoSession");
    expect(demo).toContain("deletePublicDemoTenant");
    expect(demo).toContain("acceptCurrentTenantContractDocuments");
    expect(cleanup).toContain("handlePublicDemoAccess");
    expect(cleanup).toContain("handlePublicDemoEnd");
    expect(cleanup).toContain("handlePublicDemoCleanupHeartbeat");
  });

  it("liefert die Pro-Demo mit Eventlogo und detaillierten Radsportstrecken", () => {
    const demo = read("server/public-demo.ts");
    const router = read("server/routers.ts");
    const map = read("client/src/components/LocationMapClient.tsx");

    expect(fs.existsSync(path.join(root, "server/assets/eifelride-demo-logo.webp"))).toBe(true);
    expect(demo).toContain("Eifel Marathon · 128 km · 2.340 hm");
    expect(demo).toContain("68 % Schotter");
    expect(demo).toContain("pdfLogoKey: eventLogo?.key");
    expect(demo).toContain("Zeitnahme · Eifelhöhen");
    expect(router).toContain("parseGpxSummary");
    expect(map).toContain("track.summary");
  });

  it("reduziert Dauerlast und sperrt Außenaktionen in der Demo", () => {
    const app = read("client/src/App.tsx");
    const layout = read("client/src/components/Layout.tsx");
    const security = read("client/src/pages/Security.tsx");
    const permissions = read("client/src/pages/Permissions.tsx");
    const locations = read("client/src/pages/Locations.tsx");
    const router = read("server/routers.ts");
    const demo = read("server/public-demo.ts");

    expect(app).toContain("if (!isAuthenticated || isPublicDemoSession) return;");
    expect(layout).toContain('href="https://mycrewmate.de"');
    expect(layout).toContain('item.href !== "/pdf-export"');
    expect(layout).toContain("useOnlinePresence(!isPublicDemoSession)");
    expect(security).toContain("<AuditCenter readOnly showFileHistory={false} />");
    expect(permissions).toContain("readOnly = false");
    expect(locations).toContain("canManage && !isPublicDemoSession");
    expect(router).toContain("rejectPublicDemoExternalAction");
    expect(router).toContain("if (!isPublicDemoOpenId(ctx.user.openId))");
    expect(demo).toContain("getProDemoAssets");
    expect(demo).toContain("PUBLIC_DEMO_STATIC_ASSET_PREFIX");
  });

  it("begrenzt Demos browserbezogen und nicht mehr über gemeinsam genutzte IP-Adressen", () => {
    const layout = read("client/src/components/Layout.tsx");
    const router = read("server/routers.ts");
    const demo = read("server/public-demo.ts");

    expect(router).toContain("PUBLIC_DEMO_VISITOR_COOKIE");
    expect(router).toContain("getPublicDemoVisitorKey");
    expect(router).toContain("getActivePublicDemoCount");
    expect(router).toContain("PUBLIC_DEMO_CONCURRENT_LIMIT");
    expect(demo).toContain("PUBLIC_DEMO_CONCURRENT_LIMIT = 20");
    expect(layout).toContain("navigator.sendBeacon");
  });
});
