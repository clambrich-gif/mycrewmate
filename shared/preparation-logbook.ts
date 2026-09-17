export const MAX_PREPARATION_LOGBOOK_LENGTH = 10_000;

const LOGBOOK_ENTRY_START = /(?:^|\r?\n)(\d{2}\.\d{2}\.\d{4}):/g;
const NEXT_LOGBOOK_ENTRY = /\r?\n(?=\d{2}\.\d{2}\.\d{4}:)/;

export function formatPreparationLogbookDate(at = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(at);
}

/** Fügt einen neuen Sachstand oben vor den vorhandenen Verlauf ein. */
export function prependPreparationLogbookEntry(
  entry: string | null | undefined,
  existing: string | null | undefined,
  at = new Date()
) {
  const normalizedEntry = entry?.trim() ?? "";
  const normalizedExisting = existing?.trim() ?? "";
  if (!normalizedEntry) return normalizedExisting || null;

  const datedEntry = `${formatPreparationLogbookDate(at)}: ${normalizedEntry}`;
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
