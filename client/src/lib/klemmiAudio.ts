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
  "opening-clears-throat": "[clears throat] So, los geht's!",
  "opening-cough": "[cough] Hups, kurz sortiert. Jetzt aber!",
  "opening-sniff": "[sniffs] Alles klar, ich bin bereit!",
  "opening-ach-herrje": "Ach herrje, da bin ich ja!",
  "opening-servus": "Servus, Klemmi ist da!",
  "opening-gruess-gott": "Grüß Gott, schauen wir gemeinsam drauf!",
  "opening-hallo": "Hallo, ich helfe dir gern!",
  "opening-na-dann": "Na dann, legen wir los!",
  "opening-auf-gehts": "Auf geht's, ich bin dabei!",
  "opening-moin": "Moin, Klemmi ist startklar!",
  "opening-halloechen": "Hallöchen, schön, dass du da bist!",
  "opening-tadaa": "Tadaa, dein Klemmi ist da!",
  "opening-na-schau-an": "Na, schau an, dann gucken wir mal!",
  "opening-guten-tag": "Guten Tag, worum kümmern wir uns?",
  "opening-klingeling": "Klingeling, Klemmi meldet sich!",
  "opening-hmm": "Hmm, schauen wir mal.",
  "opening-jawohl": "Jawohl, ich bin zur Stelle!",
  "opening-aha": "Aha, das kriegen wir hin!",
  "opening-hey-ho": "Hey ho, Klemmi übernimmt!",
  "opening-na-endlich": "Na endlich, los geht's!",
  "opening-hoi": "Hoi, ich bin schon da!",
  "opening-bitte-sehr": "Bitte sehr, deine Hilfe ist da!",
  "opening-wir-packen-das": "Keine Sorge, wir packen das!",
  "opening-einen-moment": "Einen kleinen Moment, ich bin ganz Ohr!",
  "opening-hopp-hopp": "Hopp hopp, schauen wir rein!",
  "opening-zack": "Zack, Klemmi ist bereit!",
  "opening-lass-uns-schauen": "Lass uns gemeinsam schauen!",
  "opening-alles-klar": "Alles klar, ich zeig's dir!",
  "opening-ganz-entspannt": "Ganz entspannt, wir gehen das zusammen an!",
  "opening-wunderbar": "Wunderbar, dann starten wir!",

  "first-login-intro": "Hallo! Ich bin Klemmi. Und nein – nicht weil ich verklemmt bin. [laughing] Sondern weil ich immer genau dann zur Stelle bin, wenn es irgendwo klemmt, oder halt, wenn du das erste Mal hier bist! Egal ob Schichten, Helfer oder Event-Planung: Wenn du mal nicht weiterweißt, klick mich einfach an! Du findest mich ab jetzt auf jeder Seite ganz oben im Menü.",
  "first-login-co-admin": "Hallo! Ich bin Klemmi. Und nein – nicht weil ich verklemmt bin. [laughing] Sondern weil ich immer genau dann zur Stelle bin, wenn es irgendwo klemmt, oder halt, wenn du das erste Mal hier bist! Egal ob Schichten, Helfer oder Event-Planung: Wenn du mal nicht weiterweißt, klick mich einfach an! Du findest mich ab jetzt auf jeder Seite ganz oben im Menü. Und noch ein Tipp für dich als Co-Admin: Im nächsten Schritt siehst du deine wichtigsten Rechte. Die vollständige Rechte-Matrix findest du später jederzeit im Hilfe-Bereich.",
  "dashboard-intro": "Dein Dashboard auf einen Blick. Hier laufen die Informationen aus deiner Planung zusammen. Ich zeige dir jetzt nur die Bereiche, die auf diesem Dashboard wirklich sichtbar sind.",
  "dashboard-countdown-dated": "Countdown bis zum Event. Hier siehst du den Zeitraum der aktuellen Veranstaltung und den Countdown. Das Datum kommt direkt aus den Eventdaten und aktualisiert sich automatisch.",
  "dashboard-countdown-empty": "Zeitraum für den Countdown festlegen. Hier erscheint der Countdown, sobald du in den Eventdaten einen Start- und bei mehrtägigen Veranstaltungen auch einen Endtermin speicherst.",
  "dashboard-priorities-attention": "Was jetzt Aufmerksamkeit braucht. Diese Karten zeigen nur konkrete Warnungen oder offene Punkte, zum Beispiel unbesetzte Schichten, Ausfälle oder offene Vorbereitungen. Ein Klick führt direkt in den passenden Bereich.",
  "dashboard-priorities-clear": "Keine dringenden Punkte. Hier werden später nur Punkte eingeblendet, die unmittelbar Aufmerksamkeit brauchen. Sobald es offene Schichten, Konflikte oder Aufgaben gibt, erscheinen sie automatisch an dieser Stelle.",
  "dashboard-deadlines": "Datierte Vorbereitungsaufgaben. Diese Übersicht erscheint, wenn Vorbereitungsaufgaben ein Fälligkeitsdatum haben. Du siehst die nächsten Termine zuerst und öffnest per Klick direkt die zugehörige Aufgabe.",
  "dashboard-helpers-active": "Helferstatus je Festivaltag. Hier erkennst du pro Veranstaltungstag Besetzung und Bedarf, Rückmeldungen, Erstkontakte und Verpflegungsspenden. Klickbare Werte führen in die bereits passend gefilterte Helfer- oder Einsatzplanansicht.",
  "dashboard-helpers-empty": "Helferstatus entsteht mit deiner Planung. Sobald du Helfer anlegst und Schichten mit Bedarf planst, erscheinen hier Besetzung, Rückmeldungen und Erstkontakte. Erfasste Kuchen- und Salatspenden werden daneben automatisch zusammengefasst.",
  "dashboard-details-active": "Wer macht was – und wer ist frei? Links siehst du Verantwortlichkeiten nach Ansprechpartnern. Rechts zeigt die Helferauslastung alle eingeteilten Schichten je Tag. Ein Klick auf einen Namen oder Wert öffnet die passende gefilterte Einsatzplanung.",
  "dashboard-details-empty": "Details wachsen mit den Einträgen. Hier entstehen zwei Übersichten, sobald Ansprechpartner, Helfer und Schichten gepflegt sind: Zuständigkeiten auf der linken Seite und die tägliche Helferauslastung auf der rechten Seite.",
  "dashboard-map-active": "Live-Standortkarte nutzen. Diese Karte verbindet Orte mit Vorbereitung, Schichten und Material. Die Farben zeigen den jeweiligen Stand, und ein Klick auf einen Marker filtert den passenden Planungsbereich.",
  "dashboard-map-empty": "Standortkarte später aktivieren. Sobald du unter Orte und Standorte mindestens einen Standort mit Koordinaten anlegst, wird hier unten automatisch die Live-Standortkarte mit den zugehörigen Planungsinformationen eingeblendet.",
  "dashboard-complete": "Alles im Blick! Du weißt jetzt, wo das Dashboard den aktuellen Planungsstand zeigt – und welche Eingaben die einzelnen Übersichten füllen.",

  "helpers-intro": "Neue Helfer sicher anlegen. Ich führe dich direkt auf der echten Oberfläche durch die Anlage – vom Namen bis zum passenden Zeitfenster.",
  "helpers-person": "Name des Helfers. Starte mit dem Namen. Nur dieses Feld ist Pflicht – so erscheint die Person eindeutig in der Helferliste und später im Einsatzplan.",
  "helpers-contact": "Ansprechpartner und Telefonnummer. Wähle im nächsten Feld den Ansprechpartner aus und ergänze, falls vorhanden, die Telefonnummer des Helfers. Beides ist optional und lässt sich später noch ändern.",
  "helpers-details": "Hinweise und Begleitung. Notiere Besonderheiten für die persönliche Helfer-PDF oder eine zusätzliche Begleitung. Das ist praktisch für Absprachen und die spätere Einsatzplanung.",
  "helpers-donation": "Spende bei Bedarf ergänzen. Die Spende ist optional: Setze nur dann das Häkchen, wenn Kuchen, Salat, Snack oder eine andere Spende direkt mit erfasst werden soll.",
  "helpers-save-helper": "Helfer jetzt speichern. Klicke jetzt unten rechts auf Helfer anlegen. Klicke jetzt unten rechts auf den markierten Speichern-Button. Klemmi wartet auf die erfolgreiche Anlage und zeigt danach genau diesen neuen Helfer.",
  "helpers-save-donation": "Helfer jetzt speichern. Klicke jetzt unten rechts auf Helfer und Spende anlegen. Klicke jetzt unten rechts auf den markierten Speichern-Button. Klemmi wartet auf die erfolgreiche Anlage und zeigt danach genau diesen neuen Helfer.",
  "helpers-availability": "Zeitfenster des neuen Helfers festlegen. Hier legst du für den gerade angelegten Helfer direkt fest, ob und wann er verfügbar ist. Tippe auf einen Tag und wähle Ja, Nein oder ein Zeitfenster von bis.",
  "helpers-complete": "Geschafft! Du hast einen Helfer angelegt und kennst nun auch die Verfügbarkeit.",

  "contacts-intro": "Ansprechpartner von Anfang an pflegen. Ansprechpartner sind deine verlässlichen Kontaktpersonen für Teams, Helfer und PDFs. Ich führe dich kurz durch die Stammdatenanlage.",
  "contacts-name": "Name eindeutig eintragen. Trage zuerst den Namen ein. Diese Angabe ist erforderlich und erscheint später bei Zuordnungen, in Listen und in persönlichen Unterlagen.",
  "contacts-details": "E-Mail und Rufnummer ergänzen. E-Mail-Adresse und Rufnummer sind optional, aber für Rückfragen besonders hilfreich. Ein persönlicher Zugang wird bewusst getrennt unter Schutz und Protokoll eingerichtet.",
  "contacts-save": "Ansprechpartner hinzufügen. Klicke auf den markierten Button. Danach steht die Person direkt für Helfer, Aufgaben und Zuständigkeiten zur Auswahl bereit.",
  "contacts-complete": "Geschafft! Der Ansprechpartner ist angelegt und kann jetzt überall in der Planung zugeordnet werden.",

  "donations-intro": "Spenden übersichtlich erfassen. Kuchen, Salate und andere Verpflegungsspenden werden hier sauber mit Spender, Eigenschaften und Abgabe organisiert.",
  "donations-donor": "Spender zuordnen. Wähle einen bestehenden Helfer aus oder trage einen Namen frei ein. So bleibt nachvollziehbar, von wem die Spende kommt.",
  "donations-item": "Spende und Kategorie festlegen. Beschreibe kurz, was mitgebracht wird, und wähle die passende Kategorie. So bleibt der Überblick über Kuchen, Salate, Desserts und Sonstiges erhalten.",
  "donations-traits": "Allergene, Abgabe und Hinweise. Kennzeichne bei Bedarf vegan, glutenfrei, laktosefrei, Nüsse oder fleischhaltig. Abgabeort, Zeitpunkt und ein freier Hinweis helfen der Verpflegung am Veranstaltungstag.",
  "donations-save": "Spende speichern. Mit dem markierten Speichern-Button wird die Spende in die Übersicht übernommen und zählt automatisch für die aktuelle Veranstaltung.",
  "donations-complete": "Prima! Die Spende ist erfasst und bleibt für Verpflegung und Helferteam transparent sichtbar.",

  "finances-intro": "Finanzen einfach im Blick behalten. Hier werden Einnahmen und Ausgaben nach Kategorien getrennt geführt. Der Saldo wird für dich automatisch berechnet.",
  "finances-category": "Kostenart anlegen. Trage eine klare Kategorie ein, zum Beispiel Startgelder, Catering, Technik oder Sponsoring. Mit dem Button daneben wird die neue Zeile angelegt.",
  "finances-values": "Einnahmen und Ausgaben eintragen. In jeder Kategorie gibst du Einnahmen und Ausgaben ein. Die Werte werden beim Verlassen des Feldes gespeichert; die Differenz zeigt sofort den aktuellen Stand.",
  "finances-balance": "Saldo gemeinsam prüfen. Ganz unten fasst der Saldo alle Kategorien zusammen. So erkennst du schnell, ob deine Veranstaltung finanziell im Plan liegt.",
  "finances-complete": "Alles klar! Du weißt jetzt, wo Kategorien, Einzelwerte und der gesamte Saldo zusammenkommen.",

  "pdf-intro": "Passende PDFs gezielt erstellen. In der PDF-Ausgabe erzeugst du persönliche Helferunterlagen, Ansprechpartnerübersichten und gefilterte Einsatzpläne aus den realen Planungsdaten.",
  "pdf-helpers": "Helfer-PDFs bündeln. Wähle bei Bedarf einen Ansprechpartner aus. Anschließend erzeugst du entweder alle Helfer-PDFs als ZIP oder nur die passenden Unterlagen für diese Person.",
  "pdf-plan": "Einsatzplan filtern und drucken. Für den Einsatzplan wählst du Tag, Bereiche, Status und bei Bedarf Ansprechpartner. Das PDF enthält nur die Auswahl, die du wirklich brauchst.",
  "pdf-config": "Vorlage pro Veranstaltung pflegen. Administratoren können hier Logo, Titel, Zusatzspalten, Fußzeilen und WhatsApp-Vorlagen für die aktuell gewählte Veranstaltung konfigurieren. Andere sehen die fertigen PDFs weiterhin unverändert.",
  "pdf-complete": "Fertig! Damit kannst du genau die Unterlagen erzeugen, die dein Team gerade braucht.",

  "security-intro": "Schutz und Protokoll sicher nutzen. Dieser Bereich ist für Administratoren. Hier werden Zugänge, Notfallmaßnahmen und nachvollziehbare Protokolle getrennt und sicher verwaltet.",
  "security-accesses": "Planungsteam-Zugänge verwalten. Hier legst du gezielt Zugänge, Eventfreigaben und Bereichsrechte an. Ein Zugang ist erst nach der passenden Freigabe in der aktuellen Veranstaltung wirksam.",
  "security-audit": "Änderungen nachvollziehen. Das Logbuch trennt Sicherheitsereignisse, Aktivitäten sowie Datei- und Importvorgänge. So lässt sich jederzeit nachvollziehen, was wann passiert ist.",
  "security-emergency": "Notfallmaßnahmen bewusst einsetzen. Der globale Notfall-Stopp sperrt alle Planungsteam-Zugänge sofort. Der Gefahrenbereich löscht Planungsdaten des gewählten Jahres – nutze beides nur bewusst und nach Prüfung.",
  "security-complete": "Gut! Du weißt jetzt, wo du Zugänge sicher verwaltest und den Verlauf kontrollierst.",

  "help-intro": "Im Hilfe-Center schnell zurechtfinden. Hier findest du kurze Anleitungen für die gesamte Planung – von der ersten Orientierung bis zu PDFs, Rechten und Sicherungen.",
  "help-search": "Direkt nach einem Begriff suchen. Tippe einfach ein Stichwort wie Helfer, Einsatzplan, Material, PDF oder Passwort ein. Die sichtbaren Kapitel passen sich sofort an.",
  "help-filters": "Hilfe nach Rolle filtern. Mit den Rollenfiltern blendest du Inhalte für alle, für das Planungsteam oder für Administratoren ein. So bleibt die Anleitung passend zu deinen Rechten.",
  "help-chapters": "Kapitel öffnen und direkt weiterarbeiten. Öffne das passende Kapitel, lies die kompakten Schritte und nutze die Links direkt zum jeweiligen Arbeitsbereich. Klemmi bleibt auch dort wieder für dich erreichbar.",
  "help-complete": "Geschafft! Jetzt weißt du, wie du in der Hilfe schnell zur passenden Antwort und direkt weiter zur Arbeit kommst.",

  "plan-intro": "Schichten anlegen und Besetzung füllen. Ich begleite dich zuerst durch die Schichtanlage und zeige dir danach direkt an der neuen Kachel, wie du passende Helfer sicher einteilst.",
  "plan-basics": "Tag und Personalbedarf festlegen. Wähle den passenden Eventtag und die Zahl der benötigten Helferplätze. So wird Unterbesetzung später sofort sichtbar.",
  "plan-task": "Bereich und Aufgabe benennen. Ein klarer Bereich und eine konkrete Aufgabe helfen dem Team, die Schicht in der Liste und auf dem Gelände sofort einzuordnen.",
  "plan-time": "Zeitfenster und Besonderheiten ergänzen. Trage Beginn und Ende ein, wenn die Schicht zeitgebunden ist. Ort, Hinweise und flexible Belegung kannst du nach Bedarf ergänzen.",
  "plan-save": "Schicht speichern. Klicke auf den markierten Speichern-Button. Erst dein Klick legt die Schicht im Einsatzplan an.",
  "plan-created": "Neue Schicht in der Kachel finden. Die neue Schicht erscheint als Kachel mit Bedarf und Fortschrittsbalken. Links stehen die Eingeteilten, rechts wählst du passende Helfer aus.",
  "plan-candidates": "Statuszeichen vor dem Namen lesen. Neu heißt: noch in keiner Schicht eingeteilt. Die Tagessegmente zeigen Grün für frei, Gelb für an diesem Tag schon belegt und Rot für nicht verfügbar. Die Uhr steht für ein Zeitfenster; das Familiensymbol bedeutet, dass eine Begleitung mitkommt.",
  "plan-assign": "Passende Helfer gesammelt zuordnen. Setze vorne bei allen passenden Personen ein Häkchen und übernimm die Auswahl gesammelt. Ein Klick auf den Namen öffnet Hinweise, Verfügbarkeit und bisherige Einsätze.",
  "plan-complete": "Besetzung im Griff! Du erkennst jetzt neue Helfer, Tagesstatus, Begleitungen und bestehende Einsätze – und kannst freie Plätze gesammelt füllen.",

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

/**
 * Beim bewussten Öffnen einer Klemmi-Tour wählt der Browser genau einen dieser
 * kurzen Einstiege. Der letzte Clip wird ausgeschlossen, damit sich kein
 * Einstieg unmittelbar wiederholt.
 */
export const KLEMMI_OPENING_AUDIO_IDS = [
  "opening-clears-throat",
  "opening-cough",
  "opening-sniff",
  "opening-ach-herrje",
  "opening-servus",
  "opening-gruess-gott",
  "opening-hallo",
  "opening-na-dann",
  "opening-auf-gehts",
  "opening-moin",
  "opening-halloechen",
  "opening-tadaa",
  "opening-na-schau-an",
  "opening-guten-tag",
  "opening-klingeling",
  "opening-hmm",
  "opening-jawohl",
  "opening-aha",
  "opening-hey-ho",
  "opening-na-endlich",
  "opening-hoi",
  "opening-bitte-sehr",
  "opening-wir-packen-das",
  "opening-einen-moment",
  "opening-hopp-hopp",
  "opening-zack",
  "opening-lass-uns-schauen",
  "opening-alles-klar",
  "opening-ganz-entspannt",
  "opening-wunderbar",
] as const satisfies readonly KlemmiAudioId[];

/**
 * Neue Sprachfassungen erhalten eine eigene URL. Dadurch kann kein Browser
 * trotz langer Cache-Zeit versehentlich eine vorherige Klemmi-Aufnahme spielen.
 */
const KLEMMI_AUDIO_REVISIONS: Partial<Record<KlemmiAudioId, string>> = {
  "helpers-person": "20260927-detailed-guide-v1",
  "first-login-intro": "20260927-joke-v2",
  "first-login-co-admin": "20260927-joke-v2",
  "dashboard-intro": "20260927-dashboard-tour-v1",
  "dashboard-complete": "20260927-dashboard-tour-v1",
  "plan-intro": "20260927-assignment-guide-v1",
  "plan-created": "20260927-assignment-guide-v1",
  "plan-candidates": "20260927-assignment-guide-v1",
  "plan-assign": "20260927-assignment-guide-v1",
  "plan-complete": "20260927-assignment-guide-v1",
};

export function isKlemmiAudioId(value: string): value is KlemmiAudioId {
  return value in KLEMMI_AUDIO_SCRIPTS;
}

export function klemmiAudioUrl(id: KlemmiAudioId) {
  const revision = KLEMMI_AUDIO_REVISIONS[id];
  return revision ? `${KLEMMI_AUDIO_ROUTE}/${id}?v=${revision}` : `${KLEMMI_AUDIO_ROUTE}/${id}`;
}
