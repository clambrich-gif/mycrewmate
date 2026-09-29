import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Klemmi-Abschluss-Empfehlung", () => {
  it("ist eine bestätigte Empfehlung statt eines automatischen Datenverlusts", () => {
    const component = source("client/src/components/KlemmiEventClosureRecommendation.tsx");

    expect(component).toContain('data-slot="klemmi-event-closure-recommendation"');
    expect(component).toContain("Klemmi hat eine Abschluss-Idee");
    expect(component).toContain("Später erinnern");
    expect(component).toContain("übrigen Daten bleiben vollständig erhalten");
    expect(component).toContain("Jetzt abschließen");
    expect(component).toContain("onCloseEvent(target.id)");
  });

  it("zeigt die Empfehlung ausschließlich im Vereinsadmin-Dashboard und bestätigt Abschluss serverseitig", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("trpc.events.closureRecommendations.useQuery");
    expect(dashboard).toContain("enabled: isTenantAdmin");
    expect(dashboard).toContain("trpc.events.close.useMutation");
    expect(dashboard).toContain("utils.events.closureRecommendations.invalidate()");
    expect(dashboard).toContain("<KlemmiEventClosureRecommendation");
  });
});
