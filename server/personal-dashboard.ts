import { WEEKDAYS, type Weekday } from "@shared/weekdays";

export type PersonalDashboardTaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "rejected";

export type PersonalDashboardTaskScope =
  | "Vorbereitung"
  | "Nachbereitung"
  | "Material"
  | "Marketing"
  | "Genehmigungen";

export type PersonalDashboardTask = {
  id: number;
  scope: PersonalDashboardTaskScope;
  title: string;
  detail: string | null;
  status: PersonalDashboardTaskStatus;
  href: string;
};

export type PersonalDashboardShift = {
  id: number;
  helperId: number;
  day: Weekday;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
};

type ContactTask = {
  id: number;
  contactId: number | null;
};

type HelperTask = ContactTask & {
  helperId: number | null;
};

type PreparationTask = HelperTask & {
  task: string;
  category: string | null;
  dueText: string | null;
  status: "offen" | "inArbeit" | "erledigt" | "abgelehnt";
};

type PostTask = HelperTask & {
  task: string;
  category: string | null;
  dueText: string | null;
  status: "offen" | "inArbeit" | "erledigt";
};

type MaterialTask = ContactTask & {
  article: string;
  category: string | null;
  quantity: string | null;
  unit: string | null;
  status: "offen" | "bestellt" | "geliefert";
};

type MarketingTask = ContactTask & {
  measure: string;
  channel: string | null;
  status: "offen" | "inArbeit" | "erledigt";
};

type ApprovalTask = ContactTask & {
  request: string;
  status: "offen" | "beantragt" | "genehmigt" | "abgelehnt";
};

type Assignment = {
  shiftId: number;
  helperId: number;
};

type Shift = {
  id: number;
  day: Weekday;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
};

export type BuildPersonalDashboardInput = {
  displayName: string;
  ownContactIds: ReadonlySet<number>;
  ownHelperIds: ReadonlySet<number>;
  prep: readonly PreparationTask[];
  post: readonly PostTask[];
  materials: readonly MaterialTask[];
  marketing: readonly MarketingTask[];
  approvals: readonly ApprovalTask[];
  assignments: readonly Assignment[];
  shifts: readonly Shift[];
};

function belongsToCurrentPerson(
  task: HelperTask,
  ownContactIds: ReadonlySet<number>,
  ownHelperIds: ReadonlySet<number>
) {
  return (
    (typeof task.contactId === "number" && ownContactIds.has(task.contactId)) ||
    (typeof task.helperId === "number" && ownHelperIds.has(task.helperId))
  );
}

function belongsToCurrentContact(
  task: ContactTask,
  ownContactIds: ReadonlySet<number>
) {
  return typeof task.contactId === "number" && ownContactIds.has(task.contactId);
}

function compactDetail(...parts: Array<string | null | undefined>) {
  const detail = parts
    .map(part => String(part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return detail || null;
}

function taskStatus(
  status: string
): PersonalDashboardTaskStatus {
  if (status === "erledigt" || status === "geliefert" || status === "genehmigt") {
    return "completed";
  }
  if (status === "abgelehnt") return "rejected";
  if (status === "inArbeit" || status === "bestellt" || status === "beantragt") {
    return "in_progress";
  }
  return "open";
}

function taskStatusRank(status: PersonalDashboardTaskStatus) {
  if (status === "rejected") return 0;
  if (status === "open") return 1;
  if (status === "in_progress") return 2;
  return 3;
}

/**
 * Fasst ausschließlich die Aufgaben zusammen, die einer angemeldeten Person
 * direkt als Ansprechpartner oder unterstützende Person zugeordnet sind.
 * Einsätze bleiben bewusst getrennt: Für Schichten existiert kein individueller
 * Erledigt-Status und sie dürfen den persönlichen Aufgabenfortschritt deshalb
 * nicht künstlich verschlechtern.
 */
export function buildPersonalDashboard(input: BuildPersonalDashboardInput) {
  const tasks: PersonalDashboardTask[] = [
    ...input.prep
      .filter(task =>
        belongsToCurrentPerson(task, input.ownContactIds, input.ownHelperIds)
      )
      .map(task => ({
        id: task.id,
        scope: "Vorbereitung" as const,
        title: task.task,
        detail: compactDetail(task.category, task.dueText),
        status: taskStatus(task.status),
        href: "/vorbereitung?meine=1",
      })),
    ...input.post
      .filter(task =>
        belongsToCurrentPerson(task, input.ownContactIds, input.ownHelperIds)
      )
      .map(task => ({
        id: task.id,
        scope: "Nachbereitung" as const,
        title: task.task,
        detail: compactDetail(task.category, task.dueText),
        status: taskStatus(task.status),
        href: "/nachbereitung?meine=1",
      })),
    ...input.materials
      .filter(task => belongsToCurrentContact(task, input.ownContactIds))
      .map(task => ({
        id: task.id,
        scope: "Material" as const,
        title: task.article,
        detail: compactDetail(task.category, task.quantity, task.unit),
        status: taskStatus(task.status),
        href: "/material?meine=1",
      })),
    ...input.marketing
      .filter(task => belongsToCurrentContact(task, input.ownContactIds))
      .map(task => ({
        id: task.id,
        scope: "Marketing" as const,
        title: task.measure,
        detail: compactDetail(task.channel),
        status: taskStatus(task.status),
        href: "/marketing?meine=1",
      })),
    ...input.approvals
      .filter(task => belongsToCurrentContact(task, input.ownContactIds))
      .map(task => ({
        id: task.id,
        scope: "Genehmigungen" as const,
        title: task.request,
        detail: null,
        status: taskStatus(task.status),
        href: "/genehmigungen?meine=1",
      })),
  ];

  const completed = tasks.filter(task => task.status === "completed").length;
  const open = tasks.filter(task => task.status === "open").length;
  const inProgress = tasks.filter(task => task.status === "in_progress").length;
  const rejected = tasks.filter(task => task.status === "rejected").length;
  const total = tasks.length;
  const allCompleted = total > 0 && completed === total;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  const ownHelperByShift = new Map<number, number>();
  for (const assignment of input.assignments) {
    if (
      input.ownHelperIds.has(assignment.helperId) &&
      !ownHelperByShift.has(assignment.shiftId)
    ) {
      ownHelperByShift.set(assignment.shiftId, assignment.helperId);
    }
  }
  const dayOrder = new Map(WEEKDAYS.map((day, index) => [day, index]));
  const shifts = input.shifts
    .filter(shift => ownHelperByShift.has(shift.id))
    .map(shift => ({
      id: shift.id,
      helperId: ownHelperByShift.get(shift.id)!,
      day: shift.day,
      area: shift.area,
      task: shift.task,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }))
    .sort((left, right) => {
      const dayDifference =
        (dayOrder.get(left.day) ?? Number.MAX_SAFE_INTEGER) -
        (dayOrder.get(right.day) ?? Number.MAX_SAFE_INTEGER);
      if (dayDifference !== 0) return dayDifference;
      return left.startTime.localeCompare(right.startTime, "de");
    });

  return {
    displayName: input.displayName,
    identityLinked:
      input.ownContactIds.size > 0 || input.ownHelperIds.size > 0,
    summary: {
      total,
      completed,
      open,
      inProgress,
      rejected,
      progress,
      allCompleted,
    },
    nextTasks: [...tasks]
      .filter(task => task.status !== "completed")
      .sort((left, right) => {
        const statusDifference = taskStatusRank(left.status) - taskStatusRank(right.status);
        if (statusDifference !== 0) return statusDifference;
        return left.title.localeCompare(right.title, "de");
      })
      .slice(0, 6),
    shifts,
  };
}
