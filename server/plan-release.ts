export type PlanReleaseContact = {
  id: number;
  name: string;
  email: string | null;
};

export type PlanReleaseHelper = {
  id: number;
  contactId: number | null;
};

export type PlanReleaseAssignment = {
  helperId: number;
};

/**
 * Ermittelt ausschließlich Ansprechpartner, denen mindestens ein tatsächlich
 * eingeteilter Helfer zugeordnet ist. Es gibt keine Sammelmails an Personen
 * ohne konkreten Bezug zum fertigen Einsatzplan.
 */
export function selectPlanReleaseContacts(input: {
  contacts: readonly PlanReleaseContact[];
  helpers: readonly PlanReleaseHelper[];
  assignments: readonly PlanReleaseAssignment[];
}) {
  const assignedHelperIds = new Set(input.assignments.map(assignment => assignment.helperId));
  const contactIds = new Set(
    input.helpers
      .filter(helper => assignedHelperIds.has(helper.id))
      .map(helper => helper.contactId)
      .filter((contactId): contactId is number => typeof contactId === "number")
  );

  return input.contacts
    .filter(contact => contactIds.has(contact.id))
    .sort((left, right) => left.name.localeCompare(right.name, "de"));
}

/**
 * Ein Planwechsel betrifft nur die Ansprechpartner der Helfer, deren
 * Zuweisung oder Schicht konkret geändert wurde.
 */
export function selectAffectedPlanContactIds(input: {
  helpers: readonly PlanReleaseHelper[];
  affectedHelperIds: readonly number[];
}) {
  const affectedHelpers = new Set(input.affectedHelperIds);
  return Array.from(
    new Set(
      input.helpers
        .filter(helper => affectedHelpers.has(helper.id))
        .map(helper => helper.contactId)
        .filter((contactId): contactId is number => typeof contactId === "number")
    )
  ).sort((left, right) => left - right);
}

export function isPlanInformationOutstanding(input: {
  helpersInformedAt: Date | null;
  changePendingAt: Date | null;
}) {
  if (!input.helpersInformedAt) return true;
  return Boolean(
    input.changePendingAt && input.helpersInformedAt.getTime() < input.changePendingAt.getTime()
  );
}
