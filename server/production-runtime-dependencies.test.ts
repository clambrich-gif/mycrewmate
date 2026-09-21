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
    expect(dockerfile).not.toContain("drizzle-kit/bin.cjs");
    expect(source("package.json")).toContain("server/_core/migrate.ts");
  });
});
