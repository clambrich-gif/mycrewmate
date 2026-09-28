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
      klemmiGuide={{
        guideId: "marketing",
        title: "Marketingmaßnahmen verständlich planen",
        introText:
          "Ich zeige dir, wie du eine Maßnahme mit Kanal, Status und Verantwortlichkeit planst und in der Übersicht nachhältst.",
        completionTitle: "Marketing im Blick!",
        completionText:
          "Du weißt jetzt, wie Maßnahmen angelegt, nachverfolgt und bei Bedarf wieder entfernt werden.",
        steps: [
          {
            key: "intro",
            selector: '[data-klemmi-target="marketing-new"]',
            eyebrow: "Klemmi zeigt’s",
            title: "Marketingmaßnahmen verständlich planen",
            text: "Ich führe dich durch die echte Anlage einer Maßnahme.",
            action: "Maßnahme anlegen",
          },
          {
            key: "name",
            selector: '[data-klemmi-target="marketing-name"]',
            eyebrow: "Schritt 1 von 4",
            title: "Maßnahme klar benennen",
            text: "Trage ein, was veröffentlicht oder organisiert werden soll, zum Beispiel Pressemitteilung, Plakataktion oder Social-Media-Beitrag.",
            action: "Kanal festlegen",
          },
          {
            key: "details",
            selector: '[data-klemmi-target="marketing-details"]',
            eyebrow: "Schritt 2 von 4",
            title: "Kanal und Zuständigkeit einordnen",
            text: "Der Kanal macht sofort klar, wo die Maßnahme stattfindet. Verantwortliche und Status helfen dem Team, die Umsetzung verlässlich nachzuhalten.",
            action: "Speichern zeigen",
          },
          {
            key: "save",
            selector: '[data-klemmi-target="marketing-save"]',
            eyebrow: "Schritt 3 von 4",
            title: "Maßnahme speichern",
            text: "Mit dem markierten Button wird die Marketingmaßnahme in die Planung übernommen.",
            waitsForSuccess: true,
          },
        ],
      }}
    />
  );
}
