import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { browserBrandingForHostname } from "../client/src/lib/browser-branding";

describe("Browserkennung für Homepage, Vereins-App und Master-Portal", () => {
  it("kennzeichnet das Master-Portal mit Admin-Titel und rotem Sicherheits-Favicon", () => {
    expect(browserBrandingForHostname("admin.mycrewmate.de")).toEqual({
      title: "MyCrewMate · Admin",
      faviconHref: "/icons/mycrewmate-admin-192.png",
      appleTouchIconHref: "/icons/mycrewmate-admin-192.png",
      appleWebAppTitle: "MyCrewMate Admin",
    });
  });

  it("kennzeichnet die öffentliche Homepage ohne Funktionszusatz", () => {
    expect(browserBrandingForHostname("www.mycrewmate.de")).toMatchObject({
      title: "MyCrewMate",
      faviconHref: "/icons/mycrewmate-pwa-192.png",
    });
    expect(browserBrandingForHostname("mycrewmate.de").title).toBe("MyCrewMate");
  });

  it("kennzeichnet die Vereins-App mit Helferplanung und dem normalen Markenicon", () => {
    expect(browserBrandingForHostname("app.mycrewmate.de")).toEqual({
      title: "MyCrewMate · Helferplanung",
      faviconHref: "/icons/mycrewmate-pwa-192.png",
      appleTouchIconHref: "/icons/mycrewmate-pwa-192.png",
      appleWebAppTitle: "MyCrewMate Helferplanung",
    });
  });

  it("stellt die Markenerkennung beim Start der React-Anwendung her", () => {
    const app = readFileSync(path.resolve(__dirname, "../client/src/App.tsx"), "utf8");
    const html = readFileSync(path.resolve(__dirname, "../client/index.html"), "utf8");
    const serviceWorker = readFileSync(
      path.resolve(__dirname, "../client/public/service-worker.js"),
      "utf8"
    );

    expect(app).toContain("applyBrowserBranding()");
    expect(html).toContain("<title>MyCrewMate</title>");
    expect(html).toContain('href="/icons/mycrewmate-pwa-192.png"');
    expect(serviceWorker).toContain('"/icons/mycrewmate-admin-192.png"');
    expect(existsSync(path.resolve(__dirname, "../client/public/icons/mycrewmate-admin-192.png"))).toBe(true);
    expect(existsSync(path.resolve(__dirname, "../client/public/icons/mycrewmate-admin-512.png"))).toBe(true);
  });
});
