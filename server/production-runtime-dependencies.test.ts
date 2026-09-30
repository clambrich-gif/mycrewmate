import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("Produktions-Laufzeitabhängigkeiten", () => {
  it("lädt Vite nur im Entwicklungsmodus dynamisch", () => {
    const viteIntegration = source("server/_core/vite.ts");

    expect(viteIntegration).not.toContain('from "vite"');
    expect(viteIntegration).toContain('await Promise.all([import("vite")');
    expect(viteIntegration).toContain(
      'const viteConfigPath = "../../vite.config"'
    );
    expect(viteIntegration).toContain("import(viteConfigPath)");
  });

  it("startet das Container-Image ohne pnpm oder Drizzle Kit und begrenzt nur den Build-Heap", () => {
    const dockerfile = source("Dockerfile");

    expect(dockerfile).toContain("ENV NODE_OPTIONS=--max-old-space-size=512");
    expect(dockerfile).toContain("RUN pnpm build && pnpm prune --prod");
    expect(dockerfile).toContain(
      'CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]'
    );
    expect(dockerfile).toContain(
      "COPY --from=build /app/server/assets ./server/assets"
    );
    expect(dockerfile).not.toContain("drizzle-kit/bin.cjs");
    expect(source("package.json")).toContain("server/_core/migrate.ts");
  });

  it("liefert 30 vorproduzierte Klemmi-Zufallseinstiege aus dem Produktimage aus", () => {
    const audioCatalog = source("client/src/lib/klemmiAudio.ts");
    const voiceHook = source("client/src/hooks/useKlemmiVoice.ts");
    const route = source("server/klemmi-asset-routes.ts");
    const ids = [...audioCatalog.matchAll(/^\s*"(opening-[a-z-]+)":/gm)].map(match => match[1]);

    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
    expect(audioCatalog).toContain("KLEMMI_OPENING_AUDIO_IDS");
    expect(voiceHook).toContain("chooseOpeningClip");
    expect(voiceHook).toContain("lastOpeningClipRef");
    expect(voiceHook).toContain("playOpening");
    expect(route).toContain('"/api/klemmi/audio/:clipId"');
    for (const id of ids) {
      expect(fs.existsSync(path.join(projectRoot, "server", "assets", "klemmi-voice", `${id}.mp3`))).toBe(true);
    }
  });

  it("liefert die festen Clips der ausführlichen Klemmi-Führungen aus dem Produktimage aus", () => {
    const clipIds = [
      "helpers-contact", "helpers-details",
      "contacts-intro", "contacts-name", "contacts-details", "contacts-save", "contacts-complete",
      "donations-intro", "donations-donor", "donations-item", "donations-traits", "donations-save", "donations-complete",
      "finances-intro", "finances-category", "finances-values", "finances-balance", "finances-complete",
      "pdf-intro", "pdf-helpers", "pdf-plan", "pdf-config", "pdf-complete",
      "security-intro", "security-password", "security-accesses-overview", "security-accesses-filter", "security-accesses-list",
      "security-accesses-create", "security-accesses-identity", "security-accesses-rights", "security-accesses-coadmin", "security-accesses-events",
      "security-emergency", "security-audit-logins", "security-audit-activity", "security-audit-files", "security-danger", "security-complete",
      "help-intro", "help-search", "help-filters", "help-chapters", "help-complete",
      "plan-time-window",
    ];

    for (const id of clipIds) {
      expect(fs.existsSync(path.join(projectRoot, "server", "assets", "klemmi-voice", `${id}.mp3`))).toBe(true);
    }
  });
});
