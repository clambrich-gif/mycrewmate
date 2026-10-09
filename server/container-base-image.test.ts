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

  it("bezieht auch das BuildKit-Bauwerkzeug ohne Docker-Hub-Abhängigkeit", () => {
    const workflow = readFileSync(
      path.resolve(process.cwd(), ".github/workflows/publish-container.yml"),
      "utf8"
    );

    expect(workflow).toContain("uses: docker/setup-buildx-action@v3");
    expect(workflow).toContain("driver-opts:");
    expect(workflow).toContain(
      "image=public.ecr.aws/vend/moby/buildkit:buildx-stable-1"
    );
  });
});
