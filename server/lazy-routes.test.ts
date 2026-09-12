import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  routeLoaders,
  type LazyRoutePath,
} from "../client/src/lib/route-loaders";

const expectedRoutes = [
  "/",
  "/ansprechpartner",
  "/helfer",
  "/einsatzplan",
  "/vorbereitung",
  "/nachbereitung",
  "/material",
  "/marketing",
  "/genehmigungen",
  "/kuchen",
  "/finanzen",
  "/pdf-export",
  "/excel",
  "/berechtigungen",
  "/sicherheit",
  "/hilfe",
] satisfies LazyRoutePath[];

describe("Lazy Routes", () => {
  it("deckt jede navigierbare Fachroute mit einem dynamischen Loader ab", () => {
    expect(Object.keys(routeLoaders)).toEqual(expectedRoutes);
  });

  it("hält die Fachseiten aus dem statischen App-Entry heraus", () => {
    const appSource = readFileSync(
      new URL("../client/src/App.tsx", import.meta.url),
      "utf8"
    );
    expect(appSource).not.toMatch(
      /import\s+.+\s+from\s+["'](?:@\/pages|\.\/pages)/
    );
    expect(appSource).toContain("lazy(routeLoaders");
    expect(appSource).toContain("<Suspense");
  });

  it("lädt jedes Routemodul mit gültigem Default-Export", async () => {
    const modules = await Promise.all(
      expectedRoutes.map(path => routeLoaders[path]())
    );

    for (const module of modules) {
      expect(module.default).toBeTypeOf("function");
    }
  });
});
