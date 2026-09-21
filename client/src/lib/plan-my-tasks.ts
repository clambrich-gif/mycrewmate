export type MyScheduleAssignment = {
  helperId: number;
};

export type MyScheduleMatchInput = {
  area: string;
  areaContactMap: ReadonlyMap<string, number | null | undefined>;
  ownContactIds: ReadonlySet<number>;
  assigned: readonly MyScheduleAssignment[];
  ownHelperIds: ReadonlySet<number>;
};

/** Normalisiert Personenbezeichnungen ausschließlich für den Namensgleichheitsvergleich. */
export function normalizeSchedulePersonName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");
}

/**
 * Liefert ausschließlich Helfer, deren eigener, gespeicherter Name mit der
 * Sitzungsidentität übereinstimmt. Eine Ansprechpartner-Verknüpfung des
 * Helfers zählt ausdrücklich nicht als eigene Helferzuweisung.
 */
export function deriveOwnAssignedHelperIds(
  helpers: readonly { id: number; name: string | null | undefined }[],
  signedInName: string | null | undefined
) {
  const normalizedSignedInName = normalizeSchedulePersonName(signedInName);
  if (!normalizedSignedInName) return new Set<number>();

  return new Set(
    helpers
      .filter(
        helper =>
          normalizeSchedulePersonName(helper.name) === normalizedSignedInName
      )
      .map(helper => helper.id)
  );
}

/**
 * Strikter Filter für „Meine Aufgaben“: Nur echte Bereichsverantwortung oder
 * eine direkte Helferzuweisung zählt. Anzeigezusätze wie
 * „Max Mustermann (Ansprechpartner: Anne Veling)“ werden nie ausgewertet.
 */
export function matchesMyScheduleAssignment({
  area,
  areaContactMap,
  ownContactIds,
  assigned,
  ownHelperIds,
}: MyScheduleMatchInput) {
  const contactId = areaContactMap.get(area);
  const isResponsibleContact =
    typeof contactId === "number" && ownContactIds.has(contactId);
  const isDirectlyAssignedHelper = assigned.some(assignment =>
    ownHelperIds.has(assignment.helperId)
  );

  return isResponsibleContact || isDirectlyAssignedHelper;
}
