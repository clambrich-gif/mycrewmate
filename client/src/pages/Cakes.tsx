import TaskGeneric from "./TaskGeneric";

export default function Cakes() {
  return (
    <TaskGeneric
      kind="cakes"
      title="Kuchen"
      addLabel="Spender"
      nameKey="donor"
      columns={[
        { key: "cake", label: "Kuchen" },
        { key: "dropoffTime", label: "Abgabezeit" },
      ]}
      noContact
      noStatus
      teamCanDelete
    />
  );
}
