import type { KlemmiSurfaceStep } from "@/components/KlemmiSurfaceGuide";

export const CONTACTS_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="contacts-new"]',
    eyebrow: "Klemmi zeigt's",
    title: "Ansprechpartner von Anfang an pflegen",
    text: "Ansprechpartner sind deine verlässlichen Kontaktpersonen für Teams, Helfer und PDFs. Ich führe dich kurz durch die Stammdatenanlage.",
    action: "Anlage zeigen",
  },
  {
    key: "name",
    selector: '[data-klemmi-target="contacts-name"]',
    eyebrow: "Schritt 1 von 3",
    title: "Name eindeutig eintragen",
    text: "Trage zuerst den Namen ein. Diese Angabe ist erforderlich und erscheint später bei Zuordnungen, in Listen und in persönlichen Unterlagen.",
    action: "Kontaktdaten zeigen",
  },
  {
    key: "details",
    selector: '[data-klemmi-target="contacts-details"]',
    eyebrow: "Schritt 2 von 3",
    title: "E-Mail und Rufnummer ergänzen",
    text: "E-Mail-Adresse und Rufnummer sind optional, aber für Rückfragen besonders hilfreich. Ein persönlicher Zugang wird bewusst getrennt unter Schutz und Protokoll eingerichtet.",
    action: "Speichern zeigen",
  },
  {
    key: "save",
    selector: '[data-klemmi-target="contacts-save"]',
    eyebrow: "Schritt 3 von 3",
    title: "Ansprechpartner hinzufügen",
    text: "Klicke auf den markierten Button. Danach steht die Person direkt für Helfer, Aufgaben und Zuständigkeiten zur Auswahl bereit.",
    waitsForSuccess: true,
  },
];

export const DONATIONS_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="donations-create"]',
    eyebrow: "Klemmi zeigt's",
    title: "Spenden übersichtlich erfassen",
    text: "Kuchen, Salate und andere Verpflegungsspenden werden hier sauber mit Spender, Eigenschaften und Abgabe organisiert. Ich zeige dir alles – du musst dafür nichts eintragen oder speichern.",
    action: "Spendenformular öffnen",
  },
  {
    key: "donor",
    selector: '[data-klemmi-target="donation-donor"]',
    eyebrow: "Schritt 1 von 7",
    title: "Spender zuordnen",
    text: "Wähle einen bestehenden Helfer aus oder trage einen Namen frei ein. So bleibt nachvollziehbar, von wem die Spende kommt.",
    action: "Spende beschreiben",
  },
  {
    key: "item",
    selector: '[data-klemmi-target="donation-item"]',
    eyebrow: "Schritt 2 von 7",
    title: "Spende und Kategorie festlegen",
    text: "Beschreibe kurz, was mitgebracht wird, und wähle die passende Kategorie. So bleibt der Überblick über Kuchen, Salate, Desserts und Sonstiges erhalten.",
    action: "Hinweise zeigen",
  },
  {
    key: "traits",
    selector: '[data-klemmi-target="donation-traits"]',
    eyebrow: "Schritt 3 von 7",
    title: "Allergene, Abgabe und Hinweise",
    text: "Kennzeichne bei Bedarf vegan, glutenfrei, laktosefrei, Nüsse oder fleischhaltig. Abgabeort, Zeitpunkt und ein freier Hinweis helfen der Verpflegung am Veranstaltungstag.",
    action: "Speichern zeigen",
  },
  {
    key: "save",
    selector: '[data-klemmi-target="donation-save"]',
    eyebrow: "Schritt 4 von 7",
    title: "Spende speichern",
    text: "Mit dem markierten Speichern-Button wird die Spende in die Übersicht übernommen und zählt automatisch für die aktuelle Veranstaltung. Für diese Erklärung klickst du nicht auf Speichern.",
    action: "Übersicht zeigen",
  },
  {
    key: "overview",
    selector: '[data-klemmi-target="donations-overview"]',
    eyebrow: "Schritt 5 von 7",
    title: "Spendenübersicht lesen",
    text: "Nach dem Speichern erscheint jede Spende mit Spender, Kategorie, Eigenschaften, Abgabeort und Zeitpunkt. So sieht das Verpflegungsteam sofort, was zugesagt wurde und welche Hinweise wichtig sind.",
    action: "Filter zeigen",
  },
  {
    key: "filters",
    selector: '[data-klemmi-target="donations-filters"]',
    eyebrow: "Schritt 6 von 7",
    title: "Gezielt nach Spenden suchen",
    text: "Mit Kategorie, Eigenschaften, Abgabetag, Standort und Suche filterst du die Liste. Das ist besonders hilfreich, wenn kurz vor dem Event nur vegane Kuchen, eine bestimmte Abgabezeit oder ein Standort geprüft werden soll.",
    action: "Ausgabe zeigen",
  },
  {
    key: "outputs",
    selector: '[data-klemmi-target="donations-pdf"]',
    eyebrow: "Schritt 7 von 7",
    title: "Übersicht drucken oder Ansicht wechseln",
    text: "Der PDF-Druck erstellt eine kompakte Übersicht der aktuell sichtbaren Spenden. Mit Liste und Kacheln wählst du einfach die Darstellung, die für deine Arbeit gerade am besten passt. In dieser Tour wird nichts gedruckt oder verändert.",
    action: "Fertig",
  },
];

export const FINANCES_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="finances-category"]',
    eyebrow: "Klemmi zeigt's",
    title: "Finanzen einfach im Blick behalten",
    text: "Hier werden Einnahmen und Ausgaben nach Kategorien getrennt geführt. Der Saldo wird für dich automatisch berechnet.",
    action: "Kategorie zeigen",
  },
  {
    key: "category",
    selector: '[data-klemmi-target="finances-category"]',
    eyebrow: "Schritt 1 von 3",
    title: "Kostenart anlegen",
    text: "Trage eine klare Kategorie ein, zum Beispiel Startgelder, Catering, Technik oder Sponsoring. Mit dem Button daneben wird die neue Zeile angelegt.",
    action: "Werte zeigen",
  },
  {
    key: "values",
    selector: '[data-klemmi-target="finances-values"]',
    eyebrow: "Schritt 2 von 3",
    title: "Einnahmen und Ausgaben eintragen",
    text: "In jeder Kategorie gibst du Einnahmen und Ausgaben ein. Die Werte werden beim Verlassen des Feldes gespeichert; die Differenz zeigt sofort den aktuellen Stand.",
    action: "Saldo zeigen",
  },
  {
    key: "balance",
    selector: '[data-klemmi-target="finances-balance"]',
    eyebrow: "Schritt 3 von 3",
    title: "Saldo gemeinsam prüfen",
    text: "Ganz unten fasst der Saldo alle Kategorien zusammen. So erkennst du schnell, ob deine Veranstaltung finanziell im Plan liegt.",
    action: "Fertig",
  },
];

export const PDF_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="pdf-helper-overviews"]',
    eyebrow: "Klemmi zeigt's",
    title: "Passende PDFs gezielt erstellen",
    text: "In der PDF-Ausgabe erzeugst du persönliche Helferunterlagen, Ansprechpartnerübersichten und gefilterte Einsatzpläne aus den realen Planungsdaten.",
    action: "Helfer-PDFs zeigen",
  },
  {
    key: "helpers",
    selector: '[data-klemmi-target="pdf-helper-overviews"]',
    eyebrow: "Schritt 1 von 3",
    title: "Helfer-PDFs bündeln",
    text: "Wähle bei Bedarf einen Ansprechpartner aus. Anschließend erzeugst du entweder alle Helfer-PDFs als ZIP oder nur die passenden Unterlagen für diese Person.",
    action: "Einsatzplan zeigen",
  },
  {
    key: "plan",
    selector: '[data-klemmi-target="pdf-plan"]',
    eyebrow: "Schritt 2 von 3",
    title: "Einsatzplan filtern und drucken",
    text: "Für den Einsatzplan wählst du Tag, Bereiche, Status und bei Bedarf Ansprechpartner. Das PDF enthält nur die Auswahl, die du wirklich brauchst.",
    action: "Vorlage zeigen",
  },
  {
    key: "config",
    selector: '[data-klemmi-target="pdf-config"]',
    eyebrow: "Schritt 3 von 3",
    title: "Vorlage pro Veranstaltung pflegen",
    text: "Administratoren können hier Logo, Titel, Zusatzspalten, Fußzeilen und WhatsApp-Vorlagen für die aktuell gewählte Veranstaltung konfigurieren. Andere sehen die fertigen PDFs weiterhin unverändert.",
    action: "Fertig",
  },
];

export const PDF_KLEMMI_STEPS_READONLY = PDF_KLEMMI_STEPS.slice(0, 3);

export const SECURITY_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="security-accesses"]',
    eyebrow: "Klemmi zeigt's",
    title: "Schutz und Protokoll sicher nutzen",
    text: "Dieser Bereich ist für Administratoren. Hier werden Zugänge, Notfallmaßnahmen und nachvollziehbare Protokolle getrennt und sicher verwaltet.",
    action: "Zugänge zeigen",
  },
  {
    key: "accesses",
    selector: '[data-klemmi-target="security-accesses"]',
    eyebrow: "Schritt 1 von 3",
    title: "Planungsteam-Zugänge verwalten",
    text: "Hier legst du gezielt Zugänge, Eventfreigaben und Bereichsrechte an. Ein Zugang ist erst nach der passenden Freigabe in der aktuellen Veranstaltung wirksam.",
    action: "Protokolle zeigen",
  },
  {
    key: "audit",
    selector: '[data-klemmi-target="security-audit"]',
    eyebrow: "Schritt 2 von 3",
    title: "Änderungen nachvollziehen",
    text: "Das Logbuch trennt Sicherheitsereignisse, Aktivitäten sowie Datei- und Importvorgänge. So lässt sich jederzeit nachvollziehen, was wann passiert ist.",
    action: "Notfallbereich zeigen",
  },
  {
    key: "emergency",
    selector: '[data-klemmi-target="security-emergency"]',
    eyebrow: "Schritt 3 von 3",
    title: "Notfallmaßnahmen bewusst einsetzen",
    text: "Der globale Notfall-Stopp sperrt alle Planungsteam-Zugänge sofort. Der Gefahrenbereich löscht Planungsdaten des gewählten Jahres – nutze beides nur bewusst und nach Prüfung.",
    action: "Fertig",
  },
];

export const HELP_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="help-search"]',
    eyebrow: "Klemmi zeigt's",
    title: "Im Hilfe-Center schnell zurechtfinden",
    text: "Hier findest du kurze Anleitungen für die gesamte Planung – von der ersten Orientierung bis zu PDFs, Rechten und Sicherungen.",
    action: "Suche zeigen",
  },
  {
    key: "search",
    selector: '[data-klemmi-target="help-search"]',
    eyebrow: "Schritt 1 von 3",
    title: "Direkt nach einem Begriff suchen",
    text: "Tippe einfach ein Stichwort wie Helfer, Einsatzplan, Material, PDF oder Passwort ein. Die sichtbaren Kapitel passen sich sofort an.",
    action: "Rollenfilter zeigen",
  },
  {
    key: "filters",
    selector: '[data-klemmi-target="help-filters"]',
    eyebrow: "Schritt 2 von 3",
    title: "Hilfe nach Rolle filtern",
    text: "Mit den Rollenfiltern blendest du Inhalte für alle, für das Planungsteam oder für Administratoren ein. So bleibt die Anleitung passend zu deinen Rechten.",
    action: "Kapitel zeigen",
  },
  {
    key: "chapters",
    selector: '[data-klemmi-target="help-chapters"]',
    eyebrow: "Schritt 3 von 3",
    title: "Kapitel öffnen und direkt weiterarbeiten",
    text: "Öffne das passende Kapitel, lies die kompakten Schritte und nutze die Links direkt zum jeweiligen Arbeitsbereich. Klemmi bleibt auch dort wieder für dich erreichbar.",
    action: "Fertig",
  },
];
