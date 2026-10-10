const COOLIFY_API_BASE_URL = "https://coolify.mycrewmate.de/api/v1";
const DATABASE_UUID = "jyzj7mj8g0cct3ruvaaq6fck";
const SCHEDULED_BACKUP_UUID = "rfczyg6r2sx8bmvmwphmfj9g";
const STATUS_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

export type DatabaseBackupStatus = {
  status: "ok" | "unavailable" | "not_configured";
  lastSuccessfulAt: string | null;
};

export type PlatformBackupStatus = {
  database: DatabaseBackupStatus;
  sourceCode: {
    strategy: "github_versioned_with_offline_archive";
  };
};

type CoolifyFetch = typeof fetch;

type CoolifyStatusOptions = {
  /** Ausschließlich für isolierte Tests; im Betrieb wird nur die Serverumgebung verwendet. */
  token?: string | undefined;
  fetchImpl?: CoolifyFetch;
  useCache?: boolean;
};

type CachedStatus = {
  expiresAt: number;
  value: PlatformBackupStatus;
};

let cachedStatus: CachedStatus | null = null;

function unavailableStatus(): PlatformBackupStatus {
  return {
    database: {
      status: "unavailable",
      lastSuccessfulAt: null,
    },
    sourceCode: {
      strategy: "github_versioned_with_offline_archive",
    },
  };
}

function notConfiguredStatus(): PlatformBackupStatus {
  return {
    database: {
      status: "not_configured",
      lastSuccessfulAt: null,
    },
    sourceCode: {
      strategy: "github_versioned_with_offline_archive",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessfulExecution(status: unknown) {
  if (typeof status !== "string") return false;
  return new Set([
    "success",
    "successful",
    "completed",
    "complete",
    "finished",
    "done",
  ]).has(status.trim().toLocaleLowerCase("en-US"));
}

/**
 * Coolify liefert die Ausführungshistorie als { executions: [...] }. Nur ein
 * explizit erfolgreicher Lauf darf als letzter Sicherungsstand angezeigt werden.
 */
export function latestSuccessfulBackupAt(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.executions)) return null;

  let latestTimestamp: number | null = null;
  for (const execution of payload.executions) {
    if (!isRecord(execution) || !isSuccessfulExecution(execution.status)) continue;
    if (typeof execution.created_at !== "string") continue;

    const timestamp = Date.parse(execution.created_at);
    if (!Number.isFinite(timestamp)) continue;
    if (latestTimestamp === null || timestamp > latestTimestamp) latestTimestamp = timestamp;
  }

  return latestTimestamp === null ? null : new Date(latestTimestamp).toISOString();
}

function backupExecutionsUrl() {
  return `${COOLIFY_API_BASE_URL}/databases/${DATABASE_UUID}/backups/${SCHEDULED_BACKUP_UUID}/executions`;
}

/**
 * Liest ausschließlich die Coolify-Ausführungshistorie der MySQL-Sicherung.
 * Zugangsdaten, Infrastruktur-IDs und Rohantworten verlassen den Server nie.
 */
export async function getPlatformBackupStatus(
  options: CoolifyStatusOptions = {}
): Promise<PlatformBackupStatus> {
  const token = options.token ?? process.env.COOLIFY_BACKUP_STATUS_API_TOKEN;
  if (!token) return notConfiguredStatus();

  const useCache = options.useCache ?? options.fetchImpl === undefined;
  const now = Date.now();
  if (useCache && cachedStatus && cachedStatus.expiresAt > now) {
    return cachedStatus.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await (options.fetchImpl ?? fetch)(backupExecutionsUrl(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return unavailableStatus();

    const lastSuccessfulAt = latestSuccessfulBackupAt(await response.json());
    const value: PlatformBackupStatus = lastSuccessfulAt
      ? {
          database: { status: "ok", lastSuccessfulAt },
          sourceCode: { strategy: "github_versioned_with_offline_archive" },
        }
      : unavailableStatus();

    if (useCache) {
      cachedStatus = { value, expiresAt: Date.now() + STATUS_CACHE_TTL_MS };
    }
    return value;
  } catch {
    // Ein Abrufproblem sagt nichts über den Erfolg der Sicherung selbst aus.
    return unavailableStatus();
  } finally {
    clearTimeout(timeout);
  }
}

/** Nur für isolierte Unit-Tests; kein Bestandteil der Laufzeitoberfläche. */
export function resetPlatformBackupStatusCacheForTests() {
  cachedStatus = null;
}
