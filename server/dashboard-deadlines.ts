export type PreparationDeadlineSource = {
  id: number;
  task: string;
  category: string | null;
  dueText: string;
  contactId: number | null;
  status: "offen" | "inArbeit" | "erledigt" | "abgelehnt";
};

export type DeadlineContactSource = {
  id: number;
  name: string;
};

export type DashboardDeadline = {
  taskId: number;
  task: string;
  category: string | null;
  contactName: string | null;
  dueText: string;
  dueIso: string;
  daysUntil: number;
  status: PreparationDeadlineSource["status"];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Accepts the two date formats used by Vorbereitung. Freitext-Fristen (for
 * example "Ende März") deliberately return null so they remain valid data but
 * are not presented as a false chronological deadline.
 */
export function parsePreparationDeadline(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const germanMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(trimmed);
  const match = isoMatch ?? germanMatch;
  if (!match) return null;

  const isIso = Boolean(isoMatch);
  const rawYear = Number(isIso ? match[1] : match[3]);
  const year = !isIso && rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = Number(match[2]);
  const day = Number(isIso ? match[3] : match[1]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    timestamp,
    iso: `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    display: `${day.toString().padStart(2, "0")}.${month
      .toString()
      .padStart(2, "0")}.${year.toString().padStart(4, "0")}`,
  };
}

function utcStartOfDay(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function upcomingPreparationDeadlines(
  tasks: PreparationDeadlineSource[],
  contacts: DeadlineContactSource[],
  options: { now?: Date; limit?: number } = {}
): DashboardDeadline[] {
  const today = utcStartOfDay(options.now ?? new Date());
  const limit = options.limit ?? 4;
  const contactById = new Map(contacts.map(contact => [contact.id, contact.name]));

  return tasks
    .filter(task => task.status !== "erledigt")
    .flatMap(task => {
      const due = parsePreparationDeadline(task.dueText);
      if (!due) return [];
      return [
        {
          taskId: task.id,
          task: task.task,
          category: task.category?.trim() || null,
          contactName:
            task.contactId === null
              ? null
              : (contactById.get(task.contactId) ?? null),
          dueText: due.display,
          dueIso: due.iso,
          daysUntil: Math.round((due.timestamp - today) / DAY_MS),
          status: task.status,
        },
      ];
    })
    .sort((left, right) => {
      const dateDifference = left.daysUntil - right.daysUntil;
      return dateDifference !== 0 ? dateDifference : left.task.localeCompare(right.task, "de");
    })
    .slice(0, Math.max(1, limit));
}

export function deadlineTimingLabel(daysUntil: number) {
  if (daysUntil < 0) {
    return daysUntil === -1
      ? "1 Tag überfällig"
      : `${Math.abs(daysUntil)} Tage überfällig`;
  }
  if (daysUntil === 0) return "Heute fällig";
  if (daysUntil === 1) return "Morgen fällig";
  return `In ${daysUntil} Tagen`;
}

export function deadlineTone(
  deadline: Pick<DashboardDeadline, "daysUntil" | "status">
): "red" | "orange" | "blue" {
  if (deadline.status === "abgelehnt" || deadline.daysUntil < 0) return "red";
  if (deadline.daysUntil <= 14) return "orange";
  return "blue";
}
