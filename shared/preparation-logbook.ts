export const MAX_PREPARATION_LOGBOOK_LENGTH = 10_000;

const LOGBOOK_ENTRY_START =
  /(?:^|\r?\n)(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}\s+Uhr\s+\([^\r\n)]+\))?):/g;
const NEXT_LOGBOOK_ENTRY =
  /\r?\n(?=\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}\s+Uhr\s+\([^\r\n)]+\))?:)/;

export function formatPreparationLogbookTimestamp(at = new Date()) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(value => value.type === type)?.value ?? "";

  return `${part("day")}.${part("month")}.${part("year")} ${part("hour")}:${part("minute")} Uhr`;
}

/** Fügt einen neuen Sachstand oben vor den vorhandenen Verlauf ein. */
export function prependPreparationLogbookEntry(
  entry: string | null | undefined,
  existing: string | null | undefined,
  at = new Date(),
  author = "Organisation"
) {
  const normalizedEntry = entry?.trim() ?? "";
  const normalizedExisting = existing?.trim() ?? "";
  if (!normalizedEntry) return normalizedExisting || null;

  const normalizedAuthor = author.trim() || "Organisation";
  const datedEntry = `${formatPreparationLogbookTimestamp(at)} (${normalizedAuthor}): ${normalizedEntry}`;
  const logbook = normalizedExisting
    ? `${datedEntry}\n${normalizedExisting}`
    : datedEntry;

  if (logbook.length > MAX_PREPARATION_LOGBOOK_LENGTH) {
    throw new RangeError("Das Logbuch darf maximal 10.000 Zeichen enthalten");
  }
  return logbook;
}

/** Liefert den aktuellsten Logbucheintrag – auch dann, wenn dieser mehrzeilig ist. */
export function latestPreparationLogbookEntry(
  logbook: string | null | undefined
) {
  const normalizedLogbook = logbook?.trim() ?? "";
  if (!normalizedLogbook) return "";
  const nextEntry = NEXT_LOGBOOK_ENTRY.exec(normalizedLogbook);
  return nextEntry
    ? normalizedLogbook.slice(0, nextEntry.index).trim()
    : normalizedLogbook;
}

export function preparationLogbookEntryCount(
  logbook: string | null | undefined
) {
  const normalizedLogbook = logbook?.trim() ?? "";
  if (!normalizedLogbook) return 0;
  const datedEntries = normalizedLogbook.match(LOGBOOK_ENTRY_START)?.length ?? 0;
  return datedEntries || 1;
}

export function preparationLogbookNeedsDetail(
  logbook: string | null | undefined,
  previewLength = 76
) {
  const latestEntry = latestPreparationLogbookEntry(logbook);
  return (
    preparationLogbookEntryCount(logbook) > 1 ||
    latestEntry.length > previewLength ||
    latestEntry.split(/\r?\n/).length > 2
  );
}

/**
 * Kürzt in einer kompakten mobilen Leseansicht ausschließlich die
 * Rollen-/Namensklammer des bestehenden Zeitstempels. Der gespeicherte
 * Verlauf bleibt unverändert und revisionsfähig.
 */
export function formatPreparationLogbookForMobileDisplay(
  logbook: string | null | undefined
) {
  return (logbook?.trim() ?? "").replace(
    /(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\s+Uhr)\s+\([^\r\n)]+\):/g,
    "$1:"
  );
}
