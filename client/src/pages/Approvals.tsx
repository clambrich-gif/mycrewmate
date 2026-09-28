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
      klemmiGuide={{
        guideId: "approvals",
        title: "Genehmigungen nachvollziehbar verwalten",
        introText:
          "Ich zeige dir, wie du einen Antrag erfasst, seinen Status pflegst und in der Übersicht den aktuellen Stand abliest.",
        completionTitle: "Genehmigungen im Blick!",
        completionText:
          "Du weißt jetzt, wie ein Antrag angelegt, sein Status nachgeführt und ein nicht mehr benötigter Eintrag entfernt wird.",
        steps: [
          {
            key: "intro",
            selector: '[data-klemmi-target="approvals-new"]',
            eyebrow: "Klemmi zeigt’s",
            title: "Genehmigungen nachvollziehbar verwalten",
            text: "Ich führe dich durch die echte Anlage eines Genehmigungsantrags.",
            action: "Antrag anlegen",
          },
          {
            key: "name",
            selector: '[data-klemmi-target="approvals-name"]',
            eyebrow: "Schritt 1 von 3",
            title: "Antrag eindeutig benennen",
            text: "Trage klar ein, welche Genehmigung gebraucht wird, zum Beispiel Straßensperrung, GEMA oder Sanitätsdienst. So ist der Vorgang später sofort wiederzufinden.",
            action: "Speichern zeigen",
          },
          {
            key: "save",
            selector: '[data-klemmi-target="approvals-save"]',
            eyebrow: "Schritt 2 von 3",
            title: "Antrag speichern",
            text: "Mit dem markierten Button wird der Antrag in die Genehmigungsübersicht übernommen.",
            waitsForSuccess: true,
          },
        ],
      }}
    />
  );
}
