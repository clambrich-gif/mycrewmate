type SearchableAssignment = {
  helperId: number;
};

type SearchableShiftEvaluation = {
  shift: {
    task: string;
    area: string;
  };
  assigned: SearchableAssignment[];
};

export const normalizePlanSearchText = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("de-DE");

export function planEvaluationMatchesSearch(
  evaluation: SearchableShiftEvaluation,
  query: string,
  helperNameById: ReadonlyMap<number, string>
) {
  const normalizedQuery = normalizePlanSearchText(query);
  if (!normalizedQuery) return true;

  return (
    normalizePlanSearchText(evaluation.shift.task).includes(normalizedQuery) ||
    normalizePlanSearchText(evaluation.shift.area).includes(normalizedQuery) ||
    evaluation.assigned.some(assignment =>
      normalizePlanSearchText(
        helperNameById.get(assignment.helperId) ?? ""
      ).includes(normalizedQuery)
    )
  );
}
