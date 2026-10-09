import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Container-Grundbild", () => {
  it("bezieht Build und Laufzeit aus dem rate-limit-freien öffentlichen Node-Spiegel", () => {
    const dockerfile = readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf8");

    expect(dockerfile).toContain(
      "ARG NODE_BASE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim"
    );
    expect(dockerfile.match(/FROM \$\{NODE_BASE_IMAGE\}/g)).toHaveLength(2);
    expect(dockerfile).not.toContain("FROM node:22-bookworm-slim");
  });
});
