import TaskGeneric from "./TaskGeneric";

export default function Approvals() {
  return (
    <TaskGeneric
      kind="approvals"
      title="Genehmigungen"
      addLabel="Antrag"
      nameKey="request"
      columns={[]}
      statusOptions={[
        { v: "offen", l: "offen" },
        { v: "beantragt", l: "beantragt" },
        { v: "genehmigt", l: "genehmigt" },
        { v: "abgelehnt", l: "abgelehnt" },
      ]}
      sortableAndFilterable
    />
  );
}
