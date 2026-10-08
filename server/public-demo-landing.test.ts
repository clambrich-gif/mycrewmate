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
    expect(landing).toContain("Die echte App testen");
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
});
