export const KLEMMI_AUDIO_ROUTE = "/api/klemmi/audio";

/** Einheitliche Markenstimme für alle bestehenden und zukünftigen Klemmi-Touren. */
export const KLEMMI_VOICE_PROFILE = {
  voice: "Achird",
  label: "Klemmi – warm und organisatorisch",
  description:
    "Freundliche männliche Cartoon-Stimme: warm, klar, leicht verspielt und strukturiert.",
} as const;

/**
 * Feste, vorproduzierte Klemmi-Texte. Die Dateien liegen ausschließlich im
 * Produkt-Container und werden erst ausgeliefert, wenn eine Tour bewusst
 * geöffnet wurde. Es werden keine Eingaben oder personenbezogenen Daten an
 * einen Sprachdienst übertragen.
 */
export const KLEMMI_AUDIO_SCRIPTS = {
  "first-login-intro": "Hallo! Ich bin Klemmi. Und nein – nicht weil ich verklemmt bin. [laughing] Sondern weil ich immer genau dann zur Stelle bin, wenn es irgendwo klemmt, oder halt, wenn du das erste Mal hier bist! Egal ob Schichten, Helfer oder Event-Planung: Wenn du mal nicht weiterweißt, klick mich einfach an! Du findest mich ab jetzt auf jeder Seite ganz oben im Menü.",
  "first-login-co-admin": "Hallo! Ich bin Klemmi. Und nein – nicht weil ich verklemmt bin. [laughing] Sondern weil ich immer genau dann zur Stelle bin, wenn es irgendwo klemmt, oder halt, wenn du das erste Mal hier bist! Egal ob Schichten, Helfer oder Event-Planung: Wenn du mal nicht weiterweißt, klick mich einfach an! Du findest mich ab jetzt auf jeder Seite ganz oben im Menü. Und noch ein Tipp für dich als Co-Admin: Im nächsten Schritt siehst du deine wichtigsten Rechte. Die vollständige Rechte-Matrix findest du später jederzeit im Hilfe-Bereich.",
  "dashboard-intro": "Dein Überblick im Dashboard. Hier siehst du die wichtigsten nächsten Schritte, Fristen und Kennzahlen. Klicke einfach auf eine Karte, um direkt in den passenden Planungsbereich zu wechseln.",
  "dashboard-complete": "Alles im Blick! Klemmi bleibt oben in jedem Bereich für dich erreichbar.",

  "helpers-intro": "Neue Helfer sicher anlegen. Ich führe dich direkt auf der echten Oberfläche durch die Anlage – vom Namen bis zum passenden Zeitfenster.",
  "helpers-person": "Person erfassen. Der Name ist die einzige Pflichtangabe. Ansprechpartner, Telefonnummer und Hinweis kannst du ergänzen, wenn du sie schon kennst.",
  "helpers-donation": "Spende bei Bedarf ergänzen. Die Spende ist optional: Setze nur dann das Häkchen, wenn Kuchen, Salat, Snack oder eine andere Spende direkt mit erfasst werden soll.",
  "helpers-save-helper": "Helfer jetzt speichern. Klicke jetzt unten rechts auf Helfer anlegen. Klicke jetzt unten rechts auf den markierten Speichern-Button. Klemmi wartet auf die erfolgreiche Anlage und zeigt danach genau diesen neuen Helfer.",
  "helpers-save-donation": "Helfer jetzt speichern. Klicke jetzt unten rechts auf Helfer und Spende anlegen. Klicke jetzt unten rechts auf den markierten Speichern-Button. Klemmi wartet auf die erfolgreiche Anlage und zeigt danach genau diesen neuen Helfer.",
  "helpers-availability": "Zeitfenster des neuen Helfers festlegen. Hier legst du für den gerade angelegten Helfer direkt fest, ob und wann er verfügbar ist. Tippe auf einen Tag und wähle Ja, Nein oder ein Zeitfenster von bis.",
  "helpers-complete": "Geschafft! Du hast einen Helfer angelegt und kennst nun auch die Verfügbarkeit.",

  "plan-intro": "Schichten Schritt für Schritt anlegen. Ich zeige dir die echte Schichtanlage: Bedarf festlegen, Bereich und Aufgabe beschreiben, Zeit eintragen und die Schicht speichern.",
  "plan-basics": "Tag und Personalbedarf festlegen. Wähle den passenden Eventtag und die Zahl der benötigten Helferplätze. So wird Unterbesetzung später sofort sichtbar.",
  "plan-task": "Bereich und Aufgabe benennen. Ein klarer Bereich und eine konkrete Aufgabe helfen dem Team, die Schicht in der Liste und auf dem Gelände sofort einzuordnen.",
  "plan-time": "Zeitfenster und Besonderheiten ergänzen. Trage Beginn und Ende ein, wenn die Schicht zeitgebunden ist. Ort, Hinweise und flexible Belegung kannst du nach Bedarf ergänzen.",
  "plan-save": "Schicht speichern. Klicke auf den markierten Speichern-Button. Erst dein Klick legt die Schicht im Einsatzplan an.",
  "plan-complete": "Schicht angelegt! Die Schicht erscheint jetzt im Einsatzplan. Als Nächstes kannst du passende Helfer auswählen und einteilen.",

  "preparation-intro": "Vorbereitungsaufgaben sicher planen. Ich zeige dir die echte Aufgabenanlage: Aufgabe formulieren, Zuständigkeit und Termin festlegen und den ersten Stand sauber festhalten.",
  "preparation-task": "Aufgabe klar formulieren. Beschreibe konkret, was erledigt werden soll. Bereich und Ort helfen, die Aufgabe später schnell wiederzufinden.",
  "preparation-details": "Verantwortung und Frist zuordnen. Wähle bei Bedarf eine verantwortliche Person und einen Termin. Beides kann später jederzeit angepasst werden.",
  "preparation-logbook": "Ersten Stand notieren. Im Logbuch gehören wichtige Hinweise, Absprachen und nächste Schritte. Der Eintrag bleibt nachvollziehbar gespeichert.",
  "preparation-save": "Aufgabe speichern. Klicke auf den markierten Speichern-Button. Erst dein Klick legt die Vorbereitungsaufgabe an.",
  "preparation-complete": "Vorbereitungsaufgabe angelegt! Die Aufgabe steht jetzt in der Vorbereitung. Zuständige, Frist und Logbuch kannst du jederzeit weiterführen.",

  "postprocessing-intro": "Nachbereitung verbindlich festhalten. Ich zeige dir die echte Nachbereitungsanlage: Aufgabe benennen, Verantwortliche und Termin einordnen und Übergaben dokumentieren.",
  "postprocessing-task": "Aufgabe konkret benennen. Schreibe kurz und eindeutig, was nach dem Event erledigt werden muss – zum Beispiel Rückgabe, Abbau oder Abrechnung.",
  "postprocessing-details": "Verantwortung und Termin setzen. Ordne die Aufgabe bei Bedarf einer Person zu und lege eine Frist fest. Beides darf später angepasst werden.",
  "postprocessing-logbook": "Übergabe und Hinweise dokumentieren. Im Logbuch kommen wichtige Hinweise, Ergebnisse und nächste Schritte. So bleibt der Abschluss nachvollziehbar.",
  "postprocessing-save": "Aufgabe speichern. Klicke auf den markierten Speichern-Button. Erst dein Klick legt die Nachbereitungsaufgabe an.",
  "postprocessing-complete": "Nachbereitungsaufgabe angelegt! Die Aufgabe steht jetzt in der Nachbereitung. So bleiben Abbau, Rückgaben und offene Punkte für das Team sichtbar.",

  "materials-intro": "Material schnell und sauber erfassen. Ich zeige dir die echte Materialanlage: Artikel benennen, Menge eintragen und Beschaffung oder Einsatzort eindeutig festhalten.",
  "materials-name": "Artikel klar benennen. Trage zuerst ein, was benötigt wird – zum Beispiel Bierzeltgarnitur, Kabeltrommel oder Kaffeebecher.",
  "materials-details": "Menge und Einordnung festhalten. Menge, Einheit und Kategorie machen den Bedarf nachvollziehbar. Ort und Beschaffungsstand kannst du bei Bedarf direkt ergänzen.",
  "materials-save": "Materialposition speichern. Klicke auf den markierten Speichern-Button. Erst dein Klick legt den Artikel tatsächlich im Materialplan an.",
  "materials-complete": "Materialposition angelegt! Der Artikel ist jetzt im Materialplan. Status, Verantwortliche und Ort kannst du später jederzeit ergänzen oder anpassen.",

  "locations-intro": "Orte und Standorte sauber anlegen. Ich zeige dir die echte Standortanlage: Namen vergeben, Koordinaten eintragen und den Ort anschließend in Schichten, Material und Vorbereitung verwenden.",
  "locations-name": "Ort eindeutig benennen. Gib dem Standort einen Namen, den das Team auf Anhieb versteht – zum Beispiel VP acht, Pumptrack oder Kuchenstand.",
  "locations-coordinates": "Position auf der Karte festlegen. Breiten- und Längengrad positionieren den Standort auf der Live-Karte. Ein Marker-Logo darunter ist optional.",
  "locations-save": "Standort speichern. Klicke auf den markierten Button. Erst dein Klick legt den Standort wirklich an.",
  "locations-complete": "Standort angelegt! Der Ort steht jetzt in Schichten, Vorbereitung und Material zur Auswahl und erscheint auf der Live-Standortkarte.",
} as const;

export type KlemmiAudioId = keyof typeof KLEMMI_AUDIO_SCRIPTS;

export function isKlemmiAudioId(value: string): value is KlemmiAudioId {
  return value in KLEMMI_AUDIO_SCRIPTS;
}

export function klemmiAudioUrl(id: KlemmiAudioId) {
  return `${KLEMMI_AUDIO_ROUTE}/${id}`;
}
