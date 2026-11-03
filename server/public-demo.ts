import type { Express } from "express";

/** Reservierte technische Identitäten der endgültig stillgelegten Vereinsdemo.
 * Nur Sperrlogik bleibt bestehen; es gibt keine Anlage-, Seed- oder Loginfunktion.
 */
export function isPublicDemoOpenId(value: string | null | undefined) {
  return Boolean(value?.startsWith("tenant-admin:demo-session-"));
}

export function isPublicDemoTenantId(value: string | null | undefined) {
  return Boolean(value?.startsWith("mycrewmate-demo-"));
}

/** Alte Lesezeichen und API-URLs dürfen weder SPA noch neue Sitzungen öffnen. */
export function registerRetiredPublicDemoRoutes(app: Express) {
  app.use((req, res, next) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path).replace(/\/+$/, "").toLowerCase();
    } catch {
      next();
      return;
    }
    const retired =
      /^\/(vereinsdemo|demozugang)(\/|$)/.test(pathname) ||
      /^\/api\/public-demo(\/|$)/.test(pathname) ||
      pathname === "/api/scheduled/public-demo-cleanup";
    if (!retired) {
      next();
      return;
    }
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex,nofollow" });
    res.status(410).type("text/plain").send("Diese Seite ist nicht mehr verfügbar.");
  });
}
