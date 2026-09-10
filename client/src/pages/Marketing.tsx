import TaskGeneric from "./TaskGeneric";

export default function Marketing() {
  return (
    <TaskGeneric
      kind="marketing"
      title="Marketing"
      addLabel="Maßnahme"
      nameKey="measure"
      columns={[{ key: "channel", label: "Kanal" }]}
      statusField
      sortableAndFilterable
    />
  );
}
