# RSC-Helferplanung – Gesamtbeschreibung für NotebookLM

**Zweck dieses Dokuments:** Diese Zusammenfassung beschreibt Aufbau, Rollen, Abläufe, Datenlogik und Bedienprinzipien der Webanwendung **RSC Helferplanung**. Sie ist als Ausgangsmaterial für NotebookLM gedacht, damit daraus eine verständliche Anwenderanleitung, Schulungsunterlagen oder häufige Fragen erstellt werden können.

> **Kurzdefinition:** Die RSC Helferplanung ist eine geschützte, mehrveranstaltungsfähige Webanwendung zur Organisation ehrenamtlicher Helferinnen und Helfer bei Vereinsfesten, Sportveranstaltungen und mehrtägigen Events. Sie verbindet Helferkartei, Ansprechpartner, Einsatzplan, Aufgabenlisten, Dokumente, Auswertungen und Rechteverwaltung in einer zentralen Datenhaltung.

## 1. Grundidee und Einsatzbereich

Die Anwendung richtet sich an Vereine und ehrenamtliche Organisationen, die Veranstaltungen mit vielen Helfern, mehreren Bereichen und mehreren Tagen planen. Beispiele sind Radsportveranstaltungen, Vereinsfeste, Feuerwehrfeste, Junggesellenfeste oder sonstige mehrtägige Veranstaltungen.

Ziel ist eine nachvollziehbare Planung ohne verstreute Excel-Dateien. Alle wichtigen Daten werden einer konkreten **Veranstaltung** und einem **Veranstaltungsjahr** zugeordnet. Eine Organisation kann daher zum Beispiel im Jahr 2027 gleichzeitig die Veranstaltungen „MyEifelRide“, „Cross-Veranstaltung“ und „Weihnachtsfeier“ verwalten, ohne dass deren Helfer, Schichten, Ansprechpartner oder PDF-Logos vermischt werden.

| Zentrales Objekt | Bedeutung |
|---|---|
| **Veranstaltungsjahr** | Kalenderjahr, beispielsweise 2026 oder 2027. |
| **Veranstaltung** | Eigenständiges Event innerhalb eines Jahres, beispielsweise „MyEifelRide“. |
| **Aktive Veranstaltungstage** | Bei der Anlage einer Veranstaltung auswählbare Wochentage von Montag bis Sonntag. Nur diese Tage stehen später für Verfügbarkeiten und Schichten bereit. |
| **Ansprechpartner** | Verantwortliche Person für Helfer oder einen Einsatzbereich. |
| **Helfer** | Person, die sich für Tätigkeiten und Schichten einteilen lässt. |
| **Schicht** | Konkreter Einsatz mit Tag, Bereich, Aufgabe, Uhrzeit und benötigter Helferzahl. |
| **Zuweisung / Belegung** | Verbindung zwischen einem Helfer und einem konkreten Helferplatz in einer Schicht. |

## 2. Anmeldung, Rollen und Passwortsystem

Der Zugang ist durch eine Anmeldemaske geschützt. Dort wird zwischen den beiden klar getrennten Rollen **Planungsteam** und **Administrator** gewählt. Die Rollen erscheinen als zusammenhängender Umschalter. Die gewählte Rolle bestimmt, welche Bereiche nur gelesen und welche Daten bearbeitet werden dürfen.

| Rolle | Hauptaufgabe | Wesentliche Rechte |
|---|---|---|
| **Planungsteam** | Operative Helferorganisation und Pflege laufender Listen. | Darf Helfer und Kucheneinträge anlegen, ändern und nach Bestätigung löschen. Darf die Einsatzplanung sehen, filtern und auswerten, jedoch nicht verändern. Darf persönliche Einteilungen teilen sowie PDF-Ausgaben und Hilfen nutzen. |
| **Administrator** | Gesamtverantwortung, Strukturpflege und sicherheitsrelevante Aktionen. | Darf alle Bereiche bearbeiten: Jahre, Veranstaltungen, Ansprechpartner, Helfer, Schichten, Bereichszuordnungen, Importe, Sicherungen, Passwörter, Zugriffsregeln, Löschprotokolle und Chatverlauf. |
| **Hauptadministrator per Manus/OAuth** | Gesonderter, serverseitig begrenzter Eigentümerzugang. | Ausschließlich der konfigurierte, bereits autorisierte Eigentümer kann sich über Manus/OAuth anmelden. Unbekannte OAuth-Konten werden weder angelegt noch angemeldet. |

Für Planungsteam und Administratoren gibt es getrennte Passwörter. Fehlversuche werden geschützt behandelt: Der Planungsteamzugang kann nach mehreren falschen Eingaben dauerhaft gesperrt werden, bis ein Administrator die Sperre gezielt aufhebt. Administrator-Sperren folgen einer zeitlich begrenzten Schutzlogik. Falsche Passwörter werden im Formular verständlich angezeigt und nicht als technische Fehlermeldung protokolliert.

Sitzungen sind serverseitig widerrufbar. Abmelden, Passwortwechsel und Sitzungsversionswechsel können bestehende Zugangstoken ungültig machen. Dadurch bleibt ein alter Browserzugang nach einer sicherheitsrelevanten Änderung nicht unbegrenzt nutzbar.

## 3. Navigation und allgemeine Bedienung

Nach der Anmeldung erscheint eine Desktop-Seitenleiste beziehungsweise ein mobiles Seitenmenü. Oben beziehungsweise in der Seitenleiste wird zuerst das **Veranstaltungsjahr** und darunter die **aktuelle Veranstaltung** ausgewählt. Ein Plus-Symbol ermöglicht das Anlegen weiterer Veranstaltungen. Administratoren können Veranstaltungen umbenennen oder löschen.

Für das Planungsteam sind die Bereiche **Helfer**, **Kuchen**, **PDF-Ausgabe** und **Hilfe** optisch hervorgehoben. Alle Menüpunkte bleiben klickbar. Die Darstellung ist mobil optimiert: Formulare besitzen auf kleinen Bildschirmen mindestens 16 Pixel Schriftgröße und Touch-Ziele von mindestens 44 Pixeln, damit Smartphones beim Antippen nicht ungewollt hineinzoomen und Schaltflächen gut erreichbar bleiben.

| Navigationsbereich | Zweck |
|---|---|
| **Dashboard** | Gesamtüberblick über Schichten, Helferbedarf, Belegung und Handlungsbedarf. |
| **Ansprechpartner** | Pflege der verantwortlichen Personen und deren Kontaktdaten. |
| **Helfer** | Zentrale Helferkartei mit Verfügbarkeit, Zuordnung, Bestätigung und PDF-Hinweisen. |
| **Einsatzplan** | Anlage, Bearbeitung, Filterung und Belegung von Schichten. |
| **Vorbereitung / Nachbereitung** | Aufgabenlisten vor und nach der Veranstaltung. |
| **Material / Marketing / Genehmigungen / Finanzen / Kuchen** | Fachlisten für die organisatorischen Teilbereiche. |
| **PDF-Ausgabe** | Erzeugung von Helferübersichten und Einsatzplänen als PDF. |
| **Excel-Projektübersicht** | Reiner Excel-Export zur Dokumentation und Weitergabe. |
| **Speichern / Laden** | Sicherung und Wiederherstellung des vollständigen Projektstands über eine JSON-Speicherdatei. |
| **Rollen und Protokolle / Zugangsschutz** | Administratorbereiche für Rechte, Passwörter, Sperren und nachvollziehbare Löschungen. |
| **Hilfe** | PDF-Anleitung und rollenabhängige Erklärvideos. |

## 4. Dashboard: Überblick und Priorisierung

Das Dashboard fasst den aktuellen Stand der gewählten Veranstaltung in drei farblich getrennten Bereichen zusammen. Die einzelnen Kennzahlen-Karten bleiben weiß; nur die jeweiligen umgebenden Bereiche sind farblich akzentuiert.

| Dashboard-Bereich | Kennzahlen | Zweck und Verhalten |
|---|---|---|
| **Bereich Schichten** (blau) | Schichten gesamt, Offen, Knapp besetzt, Voll besetzt | Zeigt, wie weit der Einsatzplan gefüllt ist. Ein Klick auf „Offen“ oder „Knapp besetzt“ führt direkt in den Einsatzplan mit passendem Filter. |
| **Bereich Helferbedarf & Belegung** (grün) | Helferbedarf, Besetzt, Helfer gesamt, Bestätigt | Zeigt die verfügbare Personalbasis und die Anzahl bereits eingeteilter sowie verbindlich bestätigter Helfer. |
| **Bereich Handlungsbedarf & Warnungen** (gelb) | Doppelbelegungen, Ausfälle, Offene Vorbereitung, Offene Nachbereitung | Macht problematische Punkte sichtbar. Ausfälle sind rot hervorgehoben, Doppelbelegungen orange. Ein Klick führt zu den relevanten gefilterten Schichten beziehungsweise Aufgaben. |

Karten ohne Treffer werden ausgegraut und zeigen keinen Hover-Effekt. Dadurch wirkt nur das klickbar, was tatsächlich eine offene Liste enthält.

Zusätzlich zeigt eine Tabelle die **Helferauslastung**. Sie enthält für jeden Helfer die Anzahl der eingeteilten Schichten an den aktivierten Veranstaltungstagen und eine Gesamtsumme. Bei null Schichten zeigt die Farbe der Null die hinterlegte Verfügbarkeit: Grün bedeutet „verfügbar“, Rot bedeutet „nicht verfügbar“. Die Tabelle passt sich auf Desktop-Bildschirmen ohne horizontales Scrollen an.

## 5. Ansprechpartner und Helferkartei

### 5.1 Ansprechpartner

Ansprechpartner sind die verantwortlichen Personen für Helfer und Einsatzbereiche. Zu jedem Ansprechpartner können Name, Telefonnummer und Bemerkung gepflegt werden. Beim Anlegen eines Ansprechpartners wird diese Person automatisch auch als Helfer angelegt; als eigener Ansprechpartner wird dabei die neu angelegte Person hinterlegt.

Administratoren können Ansprechpartner löschen. Die zugehörige eigene Helferzeile wird dabei automatisch und ohne zweite getrennte Bestätigung entfernt. Bereichsansprechpartner im Einsatzplan werden über eine eigene Zuordnung je Bereich gepflegt.

### 5.2 Helfer

Die Helferkartei ist das zentrale Verzeichnis aller möglichen Helfer. Die Desktop-Tabelle ist für eine breite Ansicht optimiert und besitzt einen fixierten Tabellenkopf. Auf Smartphones werden Helfer als übersichtliche Karten dargestellt. Der Helfername ist dort bewusst groß hervorgehoben; die Aktionsschaltflächen bleiben ausreichend groß für die Touch-Bedienung.

| Helferfeld | Inhalt und Bedeutung |
|---|---|
| **Name** | Vollständiger Name der Helferin oder des Helfers. |
| **Ansprechpartner** | Zugeordnete verantwortliche Person. Ein leeres Auswahlfeld wird gelb markiert. |
| **Telefon Helfer** | Rufnummer für Rückfragen; kann im Einsatzplan als direkter Anruf-Link erscheinen. |
| **Helfen?** | Grundsätzliche Bereitschaft: Ja oder Nein. |
| **Verfügbarkeit je Tag** | Ja, Nein oder „?“ für jeden aktivierten Veranstaltungstag. Nicht aktive Tage werden nicht angezeigt. |
| **Bestätigt?** | Rückmeldung zur finalen Einteilung: Ja oder Nein. |
| **Hinweis für PDF** | Freitext für wichtige Hinweise, die auf der persönlichen PDF-Einteilung erscheinen sollen. |

Die Helferliste kann nach Ansprechpartner filtern. Dabei können auch Helfer ohne Ansprechpartner gezielt angezeigt werden. Aufgabenlisten in Vorbereitung, Nachbereitung, Material, Marketing und Genehmigungen sind nach Aufgabe alphabetisch sortierbar und nach Verantwortlichen filterbar.

Beim Löschen eines Helfers fragt die Anwendung nach einer Bestätigung. Die löschende Person wählt einen Ansprechpartner als verantwortliche Person aus; diese Information wird im Löschprotokoll gespeichert. Administratoren dürfen eingeteilte Helfer bei Bedarf einschließlich ihrer Planbelegungen löschen. Das Planungsteam darf Helfer nur im zulässigen, bestätigten Rahmen entfernen.

### 5.3 Teilen einer Helfereinteilung

In der Helferübersicht steht für beide Rollen eine Teilen-Funktion bereit. Sie erzeugt einen fertigen Nachrichtentext für den jeweiligen Helfer. Der Text enthält Helfername, Veranstaltungsname sowie Name und Telefonnummer des zugeordneten Ansprechpartners. Falls kein Ansprechpartner gepflegt ist, wird als Ersatz die Haupt-Helferleitung aus den Ansprechpartnerdaten verwendet.

Auf geeigneten Geräten öffnet sich über die Web-Share-Funktion das systemweite Teilen-Menü. Falls dieses nicht verfügbar ist, wird der Text in die Zwischenablage kopiert und eine Bestätigung angezeigt. Der kopierte Text kann anschließend beispielsweise in WhatsApp oder einer E-Mail eingefügt werden.

## 6. Einsatzplan und Schichten

Der Einsatzplan ist die zentrale Arbeitsansicht für Administratoren. Er verbindet Bereiche, Aufgaben, Zeiten, Helferbedarf und konkrete Helferzuweisungen.

### 6.1 Aufbau einer Schicht

Eine Schicht enthält mindestens folgende Angaben:

| Schichtfeld | Bedeutung |
|---|---|
| **Wochentag** | Einer der bei der Veranstaltung aktivierten Tage von Montag bis Sonntag. |
| **Bereich** | Einsatzort oder Arbeitsbereich, beispielsweise Anmeldung, Start, Strecke oder Kuchenbuffet. |
| **Aufgabe** | Konkrete Tätigkeit, beispielsweise „Startnummernausgabe“. |
| **Beginn / Ende** | Einsatzzeit im Format Uhrzeit. Die Endzeit muss nach der Startzeit liegen. |
| **Benötigt** | Anzahl der für die Schicht benötigten Helferplätze. |
| **Bemerkung** | Zusätzlicher Freitext, der im Einsatzplan und in den persönlichen Helfer-PDFs erscheint. |
| **Status** | Abgeleiteter Belegungsstand, beispielsweise offen, knapp oder voll besetzt. |

Der Schichtdialog ist für mobile Geräte an die dynamische Bildschirmhöhe angepasst und besitzt bei Bedarf einen eigenen Innen-Scrollbereich. Die Formulare bleiben auch bei eingeblendeter Smartphone-Tastatur bedienbar.

### 6.2 Bereichsansprechpartner

Für jeden im Einsatzplan verwendeten Bereich kann ein eigener Ansprechpartner hinterlegt werden. Das Raster ist auf Desktop-Geräten kompakt angeordnet und auf Smartphones standardmäßig eingeklappt. Ein Ausklappknopf zeigt die Zuordnungen bei Bedarf an, ohne die Bedienbarkeit einzuschränken.

Wenn eine Schicht gelöscht oder so geändert wird, dass ein Bereich keine Schicht mehr besitzt, prüft das System die Bereichsansprechpartner. Verwaiste Zuordnungen werden atomar in derselben Datenbanktransaktion entfernt. So bleiben keine alten Bereichskontakte ohne zugehörigen Einsatzbereich zurück.

### 6.3 Helfer zu Schichten einteilen

Jede Schicht enthält Helferplätze. Administratoren weisen Helfer einem freien Platz zu oder entfernen Zuweisungen. Die Anwendung prüft vor der Übernahme:

1. Der Helfer darf nicht bereits in derselben Schicht eingeteilt sein.
2. Der gewünschte Platz muss innerhalb des angegebenen Helferbedarfs liegen und frei sein.
3. Die Tagesverfügbarkeit des Helfers darf nicht „Nein“ sein.
4. Zeitlich überlappende Schichten desselben Tages werden erkannt.
5. Wird eine bestehende Schicht verändert, dürfen vorhandene Belegungen nicht auf ungültige Tage, Zeiten oder Kapazitäten fallen.

Eine zeitliche Überschneidung wird direkt im Helfer-Dropdown gelb markiert. Die Übernahme einer bereits parallel verplanten Person bleibt möglich, damit die Planung bewusst entscheiden kann. Wird eine Schicht nachträglich verändert, prüft die Anwendung die bestehenden Einteilungen transaktional erneut und lehnt ungültige Änderungen mit einer verständlichen Meldung ab.

Die eingesetzten Helfer erscheinen als Karten beziehungsweise Chips. Sie sind mit Tastatur erreichbar. Ein Tooltip zeigt nach kurzer Verzögerung Name, Telefonnummer, PDF-Hinweis und Tagesverfügbarkeiten. Auf Mobilgeräten wird derselbe Inhalt per Antippen geöffnet; die Telefonnummer ist direkt als `tel:`-Link nutzbar.

Die Suchleiste durchsucht nicht nur Bereich und Aufgabe, sondern auch Namen bereits eingeteilter Helfer. Treffer werden im angezeigten Ergebnis farblich hervorgehoben. Filter können unter anderem nach Tag, Bereich, Status, Ansprechpartner und Warnfall gesetzt werden. Beim Löschen einer Schicht erscheint ein internes Bestätigungsfenster mit dem Hinweis, dass auch alle zugehörigen Helferplätze entfernt werden.

## 7. Fachbereiche und Aufgabenlisten

Die weiteren Module ergänzen den Einsatzplan um die organisatorische Vorbereitung einer Veranstaltung. Sie folgen einem gemeinsamen, einfach verständlichen Listenprinzip: Eintrag anlegen, bearbeiten, nach Status filtern und nach Bedarf löschen.

| Bereich | Typische Inhalte |
|---|---|
| **Vorbereitung** | Aufgaben vor dem Event, Verantwortlichkeit, Status und ein frei formuliertes Feld „zu erledigen bis“. |
| **Nachbereitung** | Abbau, Rückgaben, Abrechnung, Dankeschön, Auswertung und offene Nacharbeiten. |
| **Material** | Geräte, Absperrungen, Technik, Mengen, Lagerort, Verantwortlichkeit und Beschaffungsstatus. |
| **Marketing** | Website, Social Media, Presse, Flyer, Sponsorenkommunikation und Veröffentlichungsstatus. |
| **Genehmigungen** | Behördengänge, Fristen, eingereichte Unterlagen, Zuständigkeiten und Genehmigungsstatus. |
| **Finanzen** | Einnahmen und Ausgaben, Plan- und Ist-Werte, Kostenarten, Bemerkungen und Zuständigkeiten. |
| **Kuchen** | Kuchenspenden und zugehörige Helferinformationen. Das Planungsteam darf diese Liste vollständig bearbeiten. |

Einträge in diesen Listen aktualisieren sich ohne Seitenwechsel. Bei Änderungen und Löschungen wird die aktuelle Ansicht sofort neu geladen beziehungsweise aktualisiert.

## 8. PDFs, Logos und Dokumentausgabe

Die Anwendung kann unterschiedliche PDF-Ausgaben erzeugen:

1. **Persönliche Helfereinteilung:** Enthält die Schichten einer einzelnen Person, die jeweiligen Ansprechpartner mit Telefonnummern sowie Schichtbemerkungen und Hinweise für PDF.
2. **Helferübersicht für mehrere oder alle Helfer:** Dient zur Weitergabe und Übersicht für die Organisation.
3. **Einsatzplan-PDF:** Kann als Blanko-Plan oder als gefüllter Einsatzplan ausgegeben werden.

Für den Einsatzplan-PDF-Export können Filter wie Tag, Bereich, Status und Ansprechpartner berücksichtigt werden. Dadurch lässt sich zum Beispiel nur der Samstag für den Bereich „Strecke Nord“ ausdrucken.

Ein PDF-Logo oder Bild ist **veranstaltungsspezifisch**. Ein für „Weihnachtsfeier 2027“ hochgeladenes Bild wird nur in deren PDFs verwendet und nicht in den PDFs von „MyEifelRide“. Fehlt ein individuelles Bild, kann je Veranstaltung ein definierter Fallback, etwa kein Bild oder ein Markenlogo, eingestellt werden.

## 9. Speichern, Laden und Excel

### 9.1 Projekt-Speicherdatei

Der vollständige Projektstand wird nicht über Excel gesichert, sondern über eine leichtgewichtige **JSON-Speicherdatei**. Der globale Button „Speichern“ erzeugt diese Datei. Sie enthält die Daten der aktuellen Veranstaltung und ihrer verknüpften Objekte, beispielsweise Ansprechpartner, Helfer, Schichten, Zuweisungen und Fachlisten.

Der Button „Laden“ steht Administratoren zur Verfügung. Vor der tatsächlichen Übernahme erscheint ein Bestätigungsdialog. Dieser weist darauf hin, dass alle seit der letzten Sicherung vorgenommenen Online-Änderungen überschrieben werden. Der Dialog zeigt außerdem Datum und Uhrzeit des ausgewählten Speicherstands.

Das Wiederherstellen setzt den betroffenen aktuellen Datenstand transaktional zurück und importiert die Sicherung anschließend vollständig. Damit verursachen zwischenzeitlich gelöschte oder veränderte Ansprechpartner keine Abhängigkeitsfehler. Der Import validiert Beziehungen, Verfügbarkeiten und Schichtkonflikte.

### 9.2 Excel-Projektübersicht

Der Excel-Export des Gesamtprojekts dient ausschließlich als **lesbare Übersicht und Dokumentation**. Er ist nicht der primäre Sicherungsmechanismus. Die erzeugte Datei enthält den aktuellen Stand der ausgewählten Veranstaltung.

### 9.3 Modularer Excel-Import

Für einzelne Module, beispielsweise Helfer oder Ansprechpartner, gibt es eigene Import-Schaltflächen. Der Import durchläuft immer zwei Schritte:

1. **Vorschau:** Die Anwendung vergleicht Datei und aktuellen Datenstand und zeigt neue, geänderte und zu löschende Datensätze. Filter erlauben beispielsweise die Anzeige nur neuer Daten oder nur geplanter Löschungen.
2. **Bestätigte Übernahme:** Erst nach ausdrücklicher Bestätigung, Administratorpasswort und gültiger Vorschau-Freigabe werden die Änderungen angewandt.

Die Vorschau ist kryptografisch an Datei, aktuellen Datenstand, Veranstaltung, Jahr, Importart und Benutzer gebunden. Eine alte oder für eine andere Datei erzeugte Vorschau kann nicht zur Übernahme benutzt werden. Namen werden bei Helfern und Ansprechpartnern auf Dubletten geprüft. Technische IDs aus importierten Dateien werden nicht blind übernommen. Leere optionale Spalten werden von bewusst geleerten Feldern unterschieden.

Der frühere ungeschützte Legacy-Excel-Import wurde entfernt. Es bleiben nur die geschützten, bestätigungspflichtigen Importwege bestehen.

## 10. Löschprotokoll, Rückgängig-Funktion und Datenschutz im Chat

Wichtige Löschungen werden für Administratoren in einem **Löschprotokoll** nachvollziehbar gespeichert. Das Protokoll enthält unter anderem, was gelöscht wurde, wer die Aktion quittiert hat und welche verantwortliche Person ausgewählt wurde. Administratoren können einzelne protokollierte Löschungen rückgängig machen. Sie können das Löschprotokoll außerdem nach erneuter Passwortbestätigung zurücksetzen.

Das Live-Notiz- und Chat-Widget ist ein schwebendes Fenster für die Zusammenarbeit von Planungsteam und Administratoren. Es ist auf allen Seiten erreichbar und kann minimiert oder geschlossen werden. Beim ersten Öffnen wählt die Person einen Namen aus den Ansprechpartnern oder verwendet eine freie Eingabe. Name und Rolle erscheinen bei Nachrichten.

| Chat-Funktion | Verhalten |
|---|---|
| **Live-Synchronisation** | Ein zentraler Abruf aktualisiert Nachrichten ungefähr alle fünf Sekunden, ohne doppelte Abrufe oder konkurrierende Zustände. |
| **Ungelesene Nachrichten** | Der auffällige Chat-Knopf unten rechts zeigt neue Nachrichten. Bei wichtigen Nachrichten leuchtet er rot und pulsiert. Der Header enthält bewusst keinen zusätzlichen roten Chat-Punkt. |
| **Wichtige Durchsage** | Ein Umschalter markiert eine Nachricht als wichtig. Die Nachricht erhält eine auffällige Hervorhebung. Optional kann ein Warnton aktiviert werden. |
| **Tippt-Anzeige** | Zeigt dezent an, wenn eine andere Person gerade schreibt. |
| **Mobilansicht** | Öffnet sich als breites Bottom-Sheet mit großer Schrift, sicherem Abstand zu Bildschirmrändern und gut erreichbarer Eingabezeile. |
| **Aufbewahrung** | Chatnachrichten werden nach 24 Stunden automatisch bereinigt. Tippstatus verfallen nach wenigen Sekunden. |
| **Chatverlauf leeren** | Nur Administratoren dürfen den Verlauf der aktuellen Veranstaltung löschen. Dazu sind Admin-Passwort und Audit-Protokoll erforderlich. |

## 11. Datenintegrität und technische Schutzprinzipien

Die Anwendung schützt die Zuordnung der Daten zu Jahr und Veranstaltung nicht nur in der Oberfläche, sondern auch in der Datenbank. Eventgebundene Tabellen verwenden zusammengesetzte Beziehungen aus **Event-ID und Jahr**. Dadurch kann ein Datensatz nicht versehentlich mit einer Veranstaltung eines anderen Jahres verbunden werden.

Schreibvorgänge der Einsatzplanung werden serialisiert und in Datenbanktransaktionen durchgeführt. Damit werden parallele Änderungen kontrolliert und fehlerhafte Zwischenzustände vermieden. Das gilt besonders für Zuweisungen, Schichtänderungen, Bereichsresets, Löschungen und Wiederherstellungen.

Für die automatische Datenpflege besitzen die Chatnachrichten und Tippstatus eigene zeitbasierte Datenbankindizes. Dies ermöglicht eine schnelle, regelmäßige Bereinigung alter Daten ohne unnötige Belastung des normalen Veranstaltungsbetriebs.

## 12. Empfohlener Standardablauf für die Helfereinteilung

Der folgende Ablauf bildet den vorgesehenen praktischen Prozess ab:

1. **Veranstaltung vorbereiten:** Administrator legt Jahr, Veranstaltung und aktive Veranstaltungstage an.
2. **Ansprechpartner pflegen:** Verantwortliche Personen mit Namen und Telefonnummern anlegen; sie erscheinen automatisch auch als Helfer.
3. **Helfer erfassen:** Helfer eintragen, Ansprechpartner zuordnen und Kontaktdaten ergänzen.
4. **Verfügbarkeiten klären:** Mit jedem Helfer abstimmen, an welchen aktiven Veranstaltungstagen er verfügbar ist. Rückmeldungen und Hinweise für die PDF festhalten.
5. **Einsatzplan erstellen:** Administrator legt Bereiche, Schichten, Zeiten, Helferbedarf und Bereichsansprechpartner an.
6. **Helfer einteilen:** Geeignete Personen Schichten zuordnen. Gelbe Hinweise bei Überschneidungen bewusst prüfen.
7. **Offene Punkte bearbeiten:** Dashboard für offene, knapp besetzte, doppelt belegte oder ausgefallene Einsätze verwenden.
8. **Einteilung versenden:** Persönliche PDF-Einteilung erzeugen oder den vorbereiteten Nachrichtentext über die Teilen-Funktion versenden.
9. **Bestätigung eintragen:** Rückmeldung des Helfers abwarten und die Spalte „Bestätigt?“ auf Ja oder Nein setzen.
10. **Aktuellen Stand sichern:** JSON-Speicherdatei erzeugen und bei Bedarf eine Excel-Projektübersicht oder gefilterte PDFs ausgeben.

## 13. Anleitungshinweise für NotebookLM

Eine aus diesem Dokument erzeugte Anleitung sollte klar zwischen beiden Rollen unterscheiden. Schritte, die nur Administratoren ausführen dürfen, sollten mit **„Nur Administratoren“** markiert werden. Operative Schritte für das Planungsteam sollten mit **„Planungsteam und Administratoren“** gekennzeichnet werden. Besonders wichtig sind die Bedienabläufe Helfer anlegen, Verfügbarkeit pflegen, Schichten anlegen, Helfer zuweisen, Einteilung ausgeben, Bestätigung erfassen und Sicherung wiederherstellen.

Bei der Beschreibung sicherheitsrelevanter Funktionen sollte die Anleitung betonen, dass Importe erst nach Vorschau und ausdrücklicher Bestätigung übernommen werden, dass JSON-Speicherstände bestehende Daten überschreiben können und dass Löschungen beziehungsweise Chat-Resets zusätzliche Berechtigungen oder Passwortbestätigungen benötigen.

## References

[1]: https://eifelride-jq8ejdus.manus.space "RSC Helferplanung – Webanwendung"
