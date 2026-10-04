import {
  isHelperWithoutFirstContact,
  type AvailabilityField,
  type Weekday,
  WEEKDAYS,
} from "@shared/weekdays";

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

export type PersonalDashboardHelper = {
  id: number;
  name: string;
  assignedShifts: number;
  firstContactOpen: boolean;
  feedbackOpen: boolean;
  status: "first_contact_open" | "feedback_open" | "confirmed";
};

export type PersonalDashboardLocationEntry = {
  section: "preparation" | "shifts" | "materials";
  label: string;
  status: string;
  critical: boolean;
  severity: "critical" | "warning" | "complete";
  href: string;
  actionLabel: string;
};

export type PersonalDashboardLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  entries: PersonalDashboardLocationEntry[];
};

type ContactTask = {
  id: number;
  contactId: number | null;
  locationId?: number | null;
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
  locationId?: number | null;
  needed?: number;
};

type ResponsibleHelper = {
  id: number;
  name: string;
  contactId: number | null;
  willHelp: "ja" | "nein";
  confirmed: "ja" | "nein";
} & Partial<Record<AvailabilityField, "ja" | "nein" | "vielleicht">>;

export type BuildPersonalDashboardInput = {
  displayName: string;
  ownContactIds: ReadonlySet<number>;
  ownHelperIds: ReadonlySet<number>;
  activeDays: readonly Weekday[];
  prep: readonly PreparationTask[];
  post: readonly PostTask[];
  materials: readonly MaterialTask[];
  marketing: readonly MarketingTask[];
  approvals: readonly ApprovalTask[];
  assignments: readonly Assignment[];
  shifts: readonly Shift[];
  helpers: readonly ResponsibleHelper[];
  shiftAreaContacts: readonly { area: string; contactId: number | null }[];
  locations: readonly {
    id: number;
    name: string;
    latitude: number | null;
    longitude: number | null;
    logoUrl: string | null;
  }[];
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

function taskStatus(status: string): PersonalDashboardTaskStatus {
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

function mapSeverity(status: PersonalDashboardTaskStatus) {
  if (status === "completed") return "complete" as const;
  if (status === "in_progress") return "warning" as const;
  return "critical" as const;
}

/**
 * Fasst ausschließlich die Aufgaben zusammen, die einer angemeldeten Person
 * direkt als Ansprechpartner oder unterstützende Person zugeordnet sind.
 * Zusätzlich bleiben die ihr zugeordneten Helfer und Orte getrennt sichtbar.
 */
export function buildPersonalDashboard(input: BuildPersonalDashboardInput) {
  const tasks: PersonalDashboardTask[] = [
    ...input.prep
      .filter(task => belongsToCurrentPerson(task, input.ownContactIds, input.ownHelperIds))
      .map(task => ({
        id: task.id,
        scope: "Vorbereitung" as const,
        title: task.task,
        detail: compactDetail(task.category, task.dueText),
        status: taskStatus(task.status),
        href: "/vorbereitung?meine=1",
      })),
    ...input.post
      .filter(task => belongsToCurrentPerson(task, input.ownContactIds, input.ownHelperIds))
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

  const assignmentCountByHelper = new Map<number, number>();
  const ownHelperByShift = new Map<number, number>();
  for (const assignment of input.assignments) {
    assignmentCountByHelper.set(
      assignment.helperId,
      (assignmentCountByHelper.get(assignment.helperId) ?? 0) + 1
    );
    if (input.ownHelperIds.has(assignment.helperId) && !ownHelperByShift.has(assignment.shiftId)) {
      ownHelperByShift.set(assignment.shiftId, assignment.helperId);
    }
  }

  const responsibleHelpers = input.helpers
    .filter(helper => belongsToCurrentContact(helper, input.ownContactIds))
    .map(helper => {
      const firstContactOpen = isHelperWithoutFirstContact(helper, input.activeDays);
      const feedbackOpen = !firstContactOpen && helper.confirmed !== "ja";
      return {
        id: helper.id,
        name: helper.name,
        assignedShifts: assignmentCountByHelper.get(helper.id) ?? 0,
        firstContactOpen,
        feedbackOpen,
        status: firstContactOpen
          ? ("first_contact_open" as const)
          : feedbackOpen
            ? ("feedback_open" as const)
            : ("confirmed" as const),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "de"));

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

  const entriesByLocation = new Map<number, PersonalDashboardLocationEntry[]>();
  const addLocationEntry = (
    locationId: number | null | undefined,
    entry: PersonalDashboardLocationEntry
  ) => {
    if (!locationId) return;
    const entries = entriesByLocation.get(locationId) ?? [];
    entries.push(entry);
    entriesByLocation.set(locationId, entries);
  };
  const addTaskLocation = (
    task: PreparationTask | PostTask,
    sectionLabel: "Vorbereitung" | "Nachbereitung",
    href: string
  ) => {
    const status = taskStatus(task.status);
    addLocationEntry(task.locationId, {
      section: "preparation",
      label: `${sectionLabel}: ${task.task}`,
      status: status === "completed" ? "ERLEDIGT" : task.status.toUpperCase(),
      critical: status === "open" || status === "rejected",
      severity: mapSeverity(status),
      href,
      actionLabel: `${sectionLabel} öffnen`,
    });
  };
  for (const task of input.prep) {
    if (belongsToCurrentPerson(task, input.ownContactIds, input.ownHelperIds)) {
      addTaskLocation(task, "Vorbereitung", "/vorbereitung?meine=1");
    }
  }
  for (const task of input.post) {
    if (belongsToCurrentPerson(task, input.ownContactIds, input.ownHelperIds)) {
      addTaskLocation(task, "Nachbereitung", "/nachbereitung?meine=1");
    }
  }
  for (const material of input.materials) {
    if (!belongsToCurrentContact(material, input.ownContactIds)) continue;
    const status = taskStatus(material.status);
    addLocationEntry(material.locationId, {
      section: "materials",
      label: `Material: ${material.article}`,
      status: material.status.toUpperCase(),
      critical: status === "open",
      severity: mapSeverity(status),
      href: "/material?meine=1",
      actionLabel: "Material öffnen",
    });
  }

  const responsibleAreas = new Set(
    input.shiftAreaContacts
      .filter(item => typeof item.contactId === "number" && input.ownContactIds.has(item.contactId))
      .map(item => item.area.trim().toLocaleLowerCase("de-DE"))
  );
  const assignmentCountByShift = new Map<number, number>();
  for (const assignment of input.assignments) {
    assignmentCountByShift.set(
      assignment.shiftId,
      (assignmentCountByShift.get(assignment.shiftId) ?? 0) + 1
    );
  }
  for (const shift of input.shifts) {
    const isResponsibleArea = responsibleAreas.has(shift.area.trim().toLocaleLowerCase("de-DE"));
    const hasOwnAssignment = ownHelperByShift.has(shift.id);
    if (!isResponsibleArea && !hasOwnAssignment) continue;
    const assigned = assignmentCountByShift.get(shift.id) ?? 0;
    const needed = Math.max(1, shift.needed ?? 1);
    const severity = assigned >= needed ? "complete" : assigned > 0 ? "warning" : "critical";
    addLocationEntry(shift.locationId, {
      section: "shifts",
      label: `${shift.day} · ${shift.area}: ${shift.task}`,
      status: assigned >= needed ? "BESETZT" : `${assigned} / ${needed} BESETZT`,
      critical: severity === "critical",
      severity,
      href: "/einsatzplan",
      actionLabel: "Einsatzplan öffnen",
    });
  }

  const locations = input.locations
    .filter(
      location =>
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude) &&
        entriesByLocation.has(location.id)
    )
    .map(location => ({
      id: location.id,
      name: location.name,
      latitude: location.latitude!,
      longitude: location.longitude!,
      logoUrl: location.logoUrl,
      entries: entriesByLocation.get(location.id) ?? [],
    }));

  return {
    displayName: input.displayName,
    identityLinked: input.ownContactIds.size > 0 || input.ownHelperIds.size > 0,
    summary: { total, completed, open, inProgress, rejected, progress, allCompleted },
    nextTasks: [...tasks]
      .filter(task => task.status !== "completed")
      .sort((left, right) => {
        const statusDifference = taskStatusRank(left.status) - taskStatusRank(right.status);
        if (statusDifference !== 0) return statusDifference;
        return left.title.localeCompare(right.title, "de");
      })
      .slice(0, 6),
    shifts,
    helpers: {
      total: responsibleHelpers.length,
      firstContactOpen: responsibleHelpers.filter(helper => helper.firstContactOpen).length,
      feedbackOpen: responsibleHelpers.filter(helper => helper.feedbackOpen).length,
      assignedShifts: responsibleHelpers.reduce((total, helper) => total + helper.assignedShifts, 0),
      rows: responsibleHelpers,
    },
    locations,
  };
}
