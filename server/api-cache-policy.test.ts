import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Cache-Schutz für veranstaltungsabhängige API-Daten", () => {
  it("erzwingt im Browser eine frische API-Antwort pro Veranstaltungswechsel", () => {
    const client = source("client/src/main.tsx");

    expect(client).toContain('cache: "no-store"');
    expect(client).toContain('"x-event-year"');
    expect(client).toContain('"x-event-id"');
  });

  it("verbietet auch Browser- und Proxy-Zwischenspeicher für tRPC-Antworten", () => {
    const server = source("server/_core/index.ts");

    expect(server).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(server).toContain(
      'Vary: "Cookie, Authorization, X-Tenant-Id, X-Planning-Tenant-Id, X-Event-Year, X-Event-Id"'
    );
  });
});
