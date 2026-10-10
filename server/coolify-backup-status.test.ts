import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPlatformBackupStatus,
  latestSuccessfulBackupAt,
  resetPlatformBackupStatusCacheForTests,
} from "./coolify-backup-status";

afterEach(() => {
  resetPlatformBackupStatusCacheForTests();
});

describe("Coolify-Sicherungsstatus", () => {
  it("wählt den zeitlich letzten ausdrücklich erfolgreichen Datenbanklauf", () => {
    expect(
      latestSuccessfulBackupAt({
        executions: [
          { status: "success", created_at: "2026-10-09T00:00:00.000Z" },
          { status: "failed", created_at: "2026-10-10T00:00:00.000Z" },
          { status: "completed", created_at: "2026-10-10T00:01:12.000Z" },
        ],
      })
    ).toBe("2026-10-10T00:01:12.000Z");
  });

  it("ignoriert unvollständige, fehlgeschlagene und ungültig datierte Ausführungen", () => {
    expect(
      latestSuccessfulBackupAt({
        executions: [
          { status: "failed", created_at: "2026-10-10T00:00:00.000Z" },
          { status: "success", created_at: "kein Datum" },
          { status: "running", created_at: "2026-10-10T00:02:00.000Z" },
        ],
      })
    ).toBeNull();
  });

  it("meldet neutral, wenn kein serverseitiger Lesezugang eingerichtet ist", async () => {
    const result = await getPlatformBackupStatus({ token: "", useCache: false });

    expect(result.database).toEqual({ status: "not_configured", lastSuccessfulAt: null });
    expect(result.sourceCode.strategy).toBe("github_versioned_with_offline_archive");
  });

  it("liest ausschließlich die Ausführungshistorie mit einer serverseitigen Autorisierung", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(_url).toContain("/databases/");
      expect(_url).toContain("/backups/");
      expect(_url).toContain("/executions");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        "Cache-Control": "no-store",
      });
      expect(init?.cache).toBe("no-store");
      return new Response(
        JSON.stringify({
          executions: [{ status: "success", created_at: "2026-10-10T00:00:00.000Z" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await getPlatformBackupStatus({
      token: "test-only-credential",
      fetchImpl: fetchImpl as typeof fetch,
      useCache: false,
    });

    expect(result.database).toEqual({
      status: "ok",
      lastSuccessfulAt: "2026-10-10T00:00:00.000Z",
    });
  });

  it("bezeichnet einen nicht erreichbaren Statusabruf nicht als fehlgeschlagene Sicherung", async () => {
    const fetchImpl = vi.fn(async () => new Response("temporarily unavailable", { status: 503 }));

    const result = await getPlatformBackupStatus({
      token: "test-only-credential",
      fetchImpl: fetchImpl as typeof fetch,
      useCache: false,
    });

    expect(result.database).toEqual({ status: "unavailable", lastSuccessfulAt: null });
  });
});
