export type PersonalTaskCandidate = {
  contactId?: number | null;
  helperId?: number | null;
  helperIds?: readonly number[] | null;
};

/** Normalisiert Namen ausschließlich für den Abgleich mit der Sitzungsidentität. */
export function normalizePersonalTaskPersonName(
  value: string | null | undefined
) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");
}

/**
 * Liefert nur den eigenen Helferdatensatz der angemeldeten Person.
 * Helfende, die dieser Person lediglich als Ansprechpartner zugeordnet sind,
 * zählen ausdrücklich nicht als direkte persönliche Aufgaben-Zuweisung.
 */
export function deriveOwnDirectHelperIds(
  helpers: readonly { id: number; name: string | null | undefined }[],
  signedInName: string | null | undefined
) {
  const normalizedSignedInName = normalizePersonalTaskPersonName(signedInName);
  if (!normalizedSignedInName) return new Set<number>();
  return new Set(
    helpers
      .filter(
        helper =>
          normalizePersonalTaskPersonName(helper.name) ===
          normalizedSignedInName
      )
      .map(helper => helper.id)
  );
}

/**
 * Strikter Filter für persönliche Vor- und Nachbereitungsaufgaben: Eine
 * Aufgabe gehört nur zur angemeldeten Person, wenn sie selbst verantwortlich
 * oder direkt als unterstützender Helfer eingetragen ist.
 */
export function matchesMyDirectTaskAssignment({
  task,
  ownContactIds,
  ownHelperIds,
}: {
  task: PersonalTaskCandidate;
  ownContactIds: ReadonlySet<number>;
  ownHelperIds: ReadonlySet<number>;
}) {
  return (
    (typeof task.contactId === "number" && ownContactIds.has(task.contactId)) ||
    (typeof task.helperId === "number" && ownHelperIds.has(task.helperId)) ||
    (task.helperIds ?? []).some(helperId => ownHelperIds.has(helperId))
  );
}
