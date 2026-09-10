import TaskGeneric from "./TaskGeneric";

export default function Materials() {
  return (
    <TaskGeneric
      kind="materials"
      title="Material"
      addLabel="Artikel"
      nameKey="article"
      columns={[
        { key: "category", label: "Kategorie" },
        { key: "quantity", label: "Menge" },
        { key: "unit", label: "Einheit" },
      ]}
      extraField={{
        key: "ordered",
        label: "Bestellt?",
        options: [
          { v: "nein", l: "Nein" },
          { v: "ja", l: "Ja" },
        ],
      }}
      noStatus
      sortableAndFilterable
    />
  );
}
