export const MAX_PREPARATION_LOGBOOK_LENGTH = 10_000;

const LOGBOOK_ENTRY_START =
  /(?:^|\r?\n)(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}\s+Uhr)?(?:\s+\([^\r\n)]+\))?):/g;
const NEXT_LOGBOOK_ENTRY =
  /\r?\n(?=\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}\s+Uhr)?(?:\s+\([^\r\n)]+\))?:)/;
const LOGBOOK_ENTRY_HEADER =
  /^(\d{2}\.\d{2}\.\d{4})(?:\s+(\d{2}:\d{2})\s+Uhr)?(?:\s+\(([^\r\n)]+)\))?:\s*([\s\S]*)$/;

export type ParsedLogbookEntry = {
  raw: string;
  date: string | null;
  time: string | null;
  author: string | null;
  text: string;
  timestampLabel: string;
};

type TaskLogbookState = {
  task: string;
  category: string;
  dueText: string;
  locationId: number | null;
  contactId: number | null;
  status: string;
  statusWording?: string | null;
};

type TaskLogbookPatch = Partial<TaskLogbookState>;

export type TaskLogbookReferenceLabels = {
  contacts?: ReadonlyMap<number, string>;
  locations?: ReadonlyMap<number, string>;
};

function hasOwn(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function asReferenceId(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function referenceLabel(
  value: unknown,
  labels: ReadonlyMap<number, string> | undefined,
  emptyLabel: string
) {
  const id = asReferenceId(value);
  if (!id) return emptyLabel;
  return labels?.get(id) ?? emptyLabel;
}

function plainLabel(value: string | null | undefined, emptyLabel: string) {
  return value?.trim() || emptyLabel;
}

function taskStatusLabel(
  kind: "preparation" | "postprocessing",
  status: string,
  wording?: string | null
) {
  if (kind === "preparation") {
    if (status === "inArbeit")
      return wording === "genehmigung" ? "Beantragt" : "In Arbeit";
    if (status === "erledigt")
      return wording === "genehmigung" ? "Genehmigt" : "Erledigt";
    if (status === "abgelehnt") return "Abgelehnt";
  }

  if (status === "inArbeit") return "In Arbeit";
  if (status === "erledigt") return "Erledigt";
  return "Offen";
}

/**
 * Formuliert eine kurze, menschenlesbare Zusammenfassung aller fachlichen
 * Änderungen einer Aufgabe. Nicht geänderte Felder werden nicht protokolliert.
 */
export function describeTaskLogbookChanges(
  kind: "preparation" | "postprocessing",
  previous: TaskLogbookState,
  patch: TaskLogbookPatch,
  labels: TaskLogbookReferenceLabels = {}
) {
  const changes: string[] = [];

  if (hasOwn(patch, "task") && patch.task !== previous.task) {
    changes.push(
      `Aufgabe geändert: „${plainLabel(previous.task, "ohne Bezeichnung")}“ → „${plainLabel(patch.task, "ohne Bezeichnung")}“`
    );
  }

  if (hasOwn(patch, "category") && patch.category !== previous.category) {
    changes.push(
      `Kategorie geändert: ${plainLabel(previous.category, "ohne Kategorie")} → ${plainLabel(patch.category, "ohne Kategorie")}`
    );
  }

  if (hasOwn(patch, "dueText") && patch.dueText !== previous.dueText) {
    changes.push(
      `Frist geändert: ${plainLabel(previous.dueText, "ohne Frist")} → ${plainLabel(patch.dueText, "ohne Frist")}`
    );
  }

  if (hasOwn(patch, "contactId") && patch.contactId !== previous.contactId) {
    changes.push(
      `Verantwortlicher geändert: ${referenceLabel(previous.contactId, labels.contacts, "nicht zugeordnet")} → ${referenceLabel(patch.contactId, labels.contacts, "nicht zugeordnet")}`
    );
  }

  if (hasOwn(patch, "locationId") && patch.locationId !== previous.locationId) {
    changes.push(
      `Standort geändert: ${referenceLabel(previous.locationId, labels.locations, "nicht zugeordnet")} → ${referenceLabel(patch.locationId, labels.locations, "nicht zugeordnet")}`
    );
  }

  if (hasOwn(patch, "status") || hasOwn(patch, "statusWording")) {
    const beforeStatus = taskStatusLabel(
      kind,
      previous.status,
      previous.statusWording
    );
    const afterStatus = taskStatusLabel(
      kind,
      patch.status ?? previous.status,
      patch.statusWording ?? previous.statusWording
    );
    if (beforeStatus !== afterStatus)
      changes.push(`Status geändert: ${beforeStatus} → ${afterStatus}`);
  }

  return changes.length ? changes.join(" · ") : null;
}

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

/**
 * Teilt einen gespeicherten Verlauf in visuell getrennte Einträge auf. Alte
 * Verläufe ohne Uhrzeit oder Autor bleiben lesbar und werden transparent als
 * nicht vollständig dokumentiert gekennzeichnet.
 */
export function parsePreparationLogbookEntries(
  logbook: string | null | undefined
): ParsedLogbookEntry[] {
  const normalizedLogbook = logbook?.trim() ?? "";
  if (!normalizedLogbook) return [];

  return normalizedLogbook
    .split(NEXT_LOGBOOK_ENTRY)
    .map(raw => raw.trim())
    .filter(Boolean)
    .map(raw => {
      const match = raw.match(LOGBOOK_ENTRY_HEADER);
      if (!match) {
        return {
          raw,
          date: null,
          time: null,
          author: null,
          text: raw,
          timestampLabel: "Ohne Zeitangabe",
        };
      }

      const [, date, time, author, text] = match;
      return {
        raw,
        date,
        time: time || null,
        author: author?.trim() || null,
        text: text.trim(),
        timestampLabel: time ? `${date} · ${time} Uhr` : date,
      };
    });
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
