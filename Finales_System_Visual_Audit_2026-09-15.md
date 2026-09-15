# Finales System- & Visual-Audit – RSC Helferplanung

**Prüfdatum:** 15. September 2026  
**Prüfmodus:** Read-only; es wurden keine Quellcodedateien, Datenbankinhalte, Planungsdaten oder Konfigurationen verändert. Für die visuelle Prüfung wurde ausschließlich eine Administrator-Sitzung verwendet. Es wurden keine fachlichen Mutationen ausgelöst; das Chat-Fenster wurde lediglich geöffnet, ohne Nachricht, Typing-Status oder Löschung auszulösen.

## Management Summary

Die RSC Helferplanung besitzt eine **substanziell abgesicherte Fachlogik**. Besonders positiv sind die transaktionalen Kernoperationen, die Event-/Jahr-Scope-Prüfungen, die verbindliche Importvorschau, die Rollenprüfung auf Serverebene, der sessionversionsbasierte Passwortschutz und die zentrale Chat-Polling-Architektur. Der aktuelle Produktionsbuild und die statische Typprüfung sind fehlerfrei; **243 Tests bestanden, ein externer Excel-Vorlagentest ist wegen fehlender Vorlage übersprungen**.

Zwei Themen benötigen jedoch **vor jedem weiteren Schema- oder Sicherheitsausbau** Vorrang: Das versionierte Drizzle-Migrationsjournal verweist auf nicht vorhandene Migrationen, und der globale permanente Planungsteam-Lock lässt sich durch fünf anonyme Fehlversuche als Verfügbarkeitsangriff auslösen. Darüber hinaus bestehen Warnungen bei Import-ID-Konsistenz, Chat-Präsenz/Typing, mobilem Tablet-Verhalten, Recovery-Auditierung und der Abdeckung realer Datenbank-Integrationstests.

| Priorität | Anzahl | Einordnung |
|---|---:|---|
| **[KRITISCH]** | 2 | Vor weiteren Migrations- oder Produktivänderungen behandeln. |
| **[WARNUNG]** | 15 | Gezielte Reparatur in priorisierten Schritten empfohlen. |
| **[OPTIMIERUNG]** | 7 | Stabilitäts-, Nachweis- oder Bedienungsverbesserung ohne unmittelbar festgestellten Datenverlust. |

## Prüfmethodik und Grenzen

Die Prüfung umfasste Quellcode, Drizzle-Schema und -Migrationen, tRPC-Routen, Tests, UI-Komponenten, laufende Desktopansichten und nicht-destruktive DOM-Messungen. Die Einsatzplantabelle wurde in einer authentifizierten Desktopansicht mit realen Daten geprüft. Das Dokument hatte bei 1280 px Breite **keinen globalen horizontalen Überlauf**; die Tabelle nutzt bewusst einen eigenen horizontalen Scrollcontainer mit 959 px sichtbarer Breite und rund 1.477 px Tabellenbreite.

Die produktive Datenbank wurde nicht verändert. Es wurden keine tatsächlichen Excel-/JSON-Restores, keine Löschungen und keine Chatnachrichten ausgelöst. Eine echte iOS-/Android-Tastaturprüfung sowie eine externe Heartbeat-Konfiguration konnten deshalb nicht abschließend bestätigt werden. Diese Einschränkungen sind in den jeweiligen Befunden ausdrücklich markiert.

## 1. Excel-Import, Export, Projektdateien und Parsing

Die Import- und Wiederherstellungsarchitektur ist insgesamt robust. Projektdateien sind versioniert, als UTF-8 verarbeitet, am Dokumentrand validiert und über Snapshot-Digest, Event, Jahr, Benutzer sowie Operation an eine 15-minütige Vorschau gebunden. Fehlende optionale Spalten bleiben unverändert; vorhandene bewusst leere Zellen werden als Leerung interpretiert. Leere Fachzeilen werden verworfen, bevor leere Objekte entstehen. Umlaute und Datenidentitäten werden mit Unicode-Normalisierung und deutscher Groß-/Kleinschreibung abgeglichen. [2] [3]

| Priorität | Befund | Nachweis und Risiko | Empfohlene Reparatur |
|---|---|---|---|
| **[WARNUNG]** | Widersprüchliche technische ID und sichtbarer Name in Excel | Bei Ansprechpartner-, Helfer- oder Slotreferenzen kann eine aktuelle ID mit einem abweichenden sichtbaren Namen den Parser passieren. Die Transaktionsverifikation bricht später zwar vollständig zurück, die Ursache wird aber erst spät und nicht zeilenpräzise sichtbar. | ID und Namen bereits beim Parsen konsistent prüfen oder den Namen aus der gültigen ID kanonisch ableiten. Regressionstests für Ansprechpartner, Bereichsansprechpartner und Helferslots ergänzen. |
| **[WARNUNG]** | Kopierte technische IDs werden nur für Ansprechpartner und Helfer bereinigt | Für Einsatzplan, Aufgaben, Material, Marketing, Genehmigungen, Kuchen und Finanzen kann eine fremd mitkopierte ID als Update einer falschen Zeile interpretiert werden. Die Vorschau senkt das Risiko, verhindert die Fehlklassifikation aber nicht. | ID-Sanitisierung für jeden ID-tragenden Modulbereich verallgemeinern. Eine ID darf nur bleiben, wenn sie im aktuellen Scope existiert und fachlich zu genau dieser Zeile passt. |
| **[OPTIMIERUNG]** | Pflichtspalten im Modulimport sind zu strikt benannt | Datenwerte sind Unicode-normalisiert, Überschriften werden jedoch exakt geprüft. Varianten wie „Massnahme“ oder anders normalisierte Umlaute werden abgewiesen. | Enge Alias-Tabelle und Unicode-/Whitespace-Normalisierung ausschließlich für Spaltenüberschriften einführen; Mehrdeutigkeiten weiterhin hart ablehnen. |

> **Bewertung:** Der vollständige Restore ist deutlich besser abgesichert als ein üblicher Excel-Import. Die genannten Punkte betreffen vor allem präzisere Fehlerklassifikation und eine vollständige Abwehr kopierter IDs.

## 2. Datenbankintegrität, Löschpfade und Cleanup

Die regulären Löschpfade sind fachlich gut strukturiert. Kontaktlöschung, Ansprechpartner-Reset, Schichtlöschung, Bereichskontaktbereinigung, Helferzuweisungsleerung und Chat-Clear verwenden überwiegend Transaktionen, Scope-Filter, Zeilensperren und Auditdaten. Schicht- und Helferzuweisungen sind auf Event/Jahr-Ebene über zusammengesetzte Fremdschlüssel abgesichert. Die TTL-Tabellen für Notizen und Typing besitzen zeitführende Cleanup-Indizes. [1] [4]

| Priorität | Befund | Nachweis und Risiko | Empfohlene Reparatur |
|---|---|---|---|
| **[KRITISCH]** | Drizzle-Migrationsjournal ist inkonsistent | Das Journal enthält `0025_medical_snowbird` und `0026_young_speed_demon`, die als SQL-/Snapshot-Artefakte im Projekt nicht vorhanden sind. Zusätzlich ist `0024_brown_rage` doppelt mit Index 24 eingetragen. Eine frische Bereitstellung oder spätere Migration kann damit nicht reproduzierbar sein. | **Vor jeder weiteren Schemaänderung:** Historie gegen die Ziel-Datenbank abgleichen; fehlende Artefakte unverändert wiederherstellen oder einen getesteten Rebaseline-/Repair-Pfad erstellen; doppelten Eintrag entfernen; frischen Test-Deploy und Schema-/FK-Diff als CI-Gate durchführen. |
| **[WARNUNG]** | Ansprechpartner-FKs erzwingen Event-/Jahr-Kohärenz nicht vollständig | `helpers.contactId` und `shift_area_contacts.contactId` sind einspaltige FKs. Anwendungspfad-Validierung schützt aktuell, aber direkte DB- oder künftige Bulk-Schreibpfade können eine kontaktseitig fremde Event-/Jahr-Verknüpfung erzeugen. | Wenn technisch möglich zusammengesetzte FKs auf `(contactId, eventId, year)` wiederherstellen. Andernfalls jeden Bulk-/Importpfad zentral transaktional validieren und Cross-Scope-Regressionstests einführen. |
| **[WARNUNG]** | Autonomer 24h-Heartbeat ist im Repository nicht nachweisbar | Endpoint und Cron-Authentisierung sind vorhanden. Eine außerhalb des Repositories konfigurierte Ausführung konnte nicht belegt werden. Ohne sie greift physisches TTL-Cleanup nur bei Chataktivität. | Tatsächliche Heartbeat-Planung und Intervall dokumentieren und überwachen. Falls nicht vorhanden, einen idempotenten Betriebsweg sowie Statusmonitoring für letzte Ausführung und gelöschte Zeilen etablieren. |
| **[OPTIMIERUNG]** | Löschtests sind überwiegend modelliert statt DB-echt | Die vorhandenen Tests prüfen gute Reihenfolgen, verwenden bei zentralen Pfaden aber nachgebildete Transaktionen oder Mocks. | Isolierte MySQL-Integrationstests mit den echten Migrationen ergänzen: Kontakt-/Schichtlöschung, Reset, clearAssignments, Cross-Scope-Fälle und absichtlich ausgelöster Rollback. |

## 3. Live-Chat, Notiz-Widget und Polling

Die Grundarchitektur ist stabil. Das Layout besitzt den alleinigen Snapshot-Owner. In-flight-Sperre, Queue und Scope-Epoch verhindern, dass verspätete Antworten einen aktuellen Scope überschreiben. Der Vollsnapshot synchronisiert ein Chat-Clear zuverlässig auf weitere Clients. Unread-Zähler, wichtige Nachrichten, FAB-Signal und Typing-Debounce sind zentral angelegt. [5]

| Priorität | Befund | Nachweis und Risiko | Empfohlene Reparatur |
|---|---|---|---|
| **[WARNUNG]** | Alte wichtige Nachrichten können beim ersten Laden einen Warnton auslösen | Das Widget behandelt den initial leeren Props-Snapshot bereits als „initial“. Kommt danach die erste echte 24h-Historie mit einer wichtigen Nachricht, wird sie als neue Nachricht interpretiert. | Initialen Ton-Deduplizierer erst nach bestätigtem ersten Server-Snapshot setzen. Verhaltenstest ergänzen: historische wichtige Nachricht erzeugt keinen Ton; neue ID erzeugt genau einen Ton. |
| **[WARNUNG]** | Typing-Indikator läuft bei fortlaufendem Tippen ab | Der Server löscht Typing nach acht Sekunden. Der Client sendet bei weiterem Tippen keinen erneuten `true`-Refresh, solange sich der Zustand nicht ändert. | Bei fortlaufender Eingabe gedrosselt alle vier bis sechs Sekunden Typing auffrischen oder TTL abgestimmt erhöhen; `false` weiter sofort bei Senden, Leeren, Schließen und Unmount senden. |
| **[WARNUNG]** | Chatpoll verfälscht die Online-Präsenz | Jeder `notes.list`-Abruf aktualisiert Präsenz. Da das Layout alle fünf Sekunden pollt, zählen inaktive oder im Hintergrund verbliebene Tabs weiterhin als aktiv. | Chat-Snapshot-Lesen von Präsenzupdates trennen; echte Aktivitätsereignisse gedrosselt erfassen. Polling bei verborgenem Tab pausieren oder deutlich reduzieren, sofern die Benachrichtigungsanforderung dies erlaubt. |
| **[OPTIMIERUNG]** | Komplexe Chatabläufe sind kaum verhaltensbasiert getestet | Quelltextassertions decken wichtige UI-Verträge ab, nicht jedoch verspätete Antworten, Clear während In-flight-Poll, Ton-Deduplizierung oder Timerverhalten. | React-/Hook-Tests mit Fake-Timern ergänzen: ein Poll-Owner, Queue, Scopewechsel, Clear-Snapshot, Unread/Wichtig, Ton und Debounce-/Unmount-Cleanup. |

## 4. Mobile UX, Eingaben und Viewports

Die mobile Umsetzung ist in den Kernbereichen fortgeschritten. Eingaben sind unter 1024 px auf 16 px abgesichert. Der Einsatzplan nutzt unterhalb von `md` eine eigenständige Kartenansicht. Die mobilen Planaktionen sind als Raster angeordnet. Der geöffnete Chat nutzt ein breites Bottom-Sheet mit dynamischer Höhe, eigener Scrollzone und Safe-Area-geschütztem Composer. Der Schichtdialog besitzt bereits eine lokale `100dvh`-Absicherung. [6]

| Priorität | Befund | Nachweis und Risiko | Empfohlene Reparatur |
|---|---|---|---|
| **[WARNUNG]** | Nutzer-Zoom ist global deaktiviert | `maximum-scale=1.0` und `user-scalable=no` verhindern zwar Auto-Zoom, sperren aber auch notwendige Vergrößerung für sehbehinderte Nutzer. Die 16-px-Regel verhindert den Formular-Auto-Zoom bereits eigenständig. | Globale Zoomsperre aus dem Viewport-Meta entfernen und 16-px-Regel beibehalten. Dies verbessert Barrierefreiheit ohne Rückfall beim iOS-Formularzoom. |
| **[WARNUNG]** | 44-px-Touchflächen fallen bei 768–1023 px teilweise auf Desktopmaße zurück | Input, Select, Button und Checkbox wechseln bereits ab `md` auf kleinere Maße. Tablets sind oft weiterhin primär touchbasiert. | Touchmindestflächen bis mindestens 1023 px oder unter `(pointer: coarse)` beibehalten. Kompakte Desktopmaße nur bei feinem Pointer/hover anwenden und für 768/820/1024 px testen. |
| **[WARNUNG]** | Dialogstandard schützt nicht überall gegen Tastatur-/Höhenüberlauf | Einige Dialoge tragen lokale Absicherung, die Basis-Dialoge begrenzen aber Höhe und internes Scrollen nicht zentral. Bei kleiner Höhe, größerem Systemtext oder Tastatur können Aktionen abgeschnitten werden. | `max-h-[calc(100dvh-2rem)]`, Breitenbegrenzung, internes Scrollen, Overscroll-Containment und Safe-Area-Padding als Dialog-Primitive-Standard einführen. |
| **[WARNUNG]** | Geschlossener und minimierter Chat berücksichtigen Bottom Safe Area nicht | Nur der geöffnete Composer enthält Bottom-Safe-Area-Padding. Der FAB und die minimierte Leiste nutzen feste `bottom-*`-Werte. | Fixed-Offsets auf `max(env(safe-area-inset-bottom), …)` umstellen und auf Geräten mit Home-Indikator prüfen. |
| **[OPTIMIERUNG]** | Recovery-Textaktionen sind kleiner als übrige Touchziele | „Passwort vergessen / Recovery“ und „Zurück zur Anmeldung“ sind ungedimensionierte Text-Buttons. | Beide als mindestens 44 px hohe, aber visuell zurückhaltende Link-Buttons ausführen. |

## 5. Desktop- und Mobil-Layout sowie Farbkonzept

Die tatsächliche Desktopprüfung der authentifizierten Einsatzplanansicht bestätigt: Die Seite nutzt die verfügbare Content-Breite, das Dokument selbst läuft nicht horizontal über, und die breite Tabelle bleibt innerhalb eines intentionalen `overflow-x-auto`-Containers. Die Helferchipspalte ist sichtbar flexibel und kann mehrere Zuordnungen zeigen. Der Chat öffnet sich auf Desktop als überlagerndes, lesbares Fenster ohne die Tabelle strukturell zu verschieben. [7]

### Farbkonzept: dokumentierter Zielkonflikt

Der Prüfkatalog nennt mattes Mintgrün für Import/Upload und mattes Rot für Löschen/Reset. **Der aktuell geprüfte Stand erfüllt diese Regel absichtlich nicht**, weil eine spätere, explizite Anweisung die gesamte flächige Farbgebung wieder auf den neutralen vorherigen Stand zurückgesetzt hat. Der aktuelle Zustand verwendet neutrale Importauslöser, blaue Übernahmeaktionen sowie zurückhaltend rote Destruktivtexte/-rahmen. Dies ist daher **kein Fehler**, sondern eine dokumentierte, später getroffene Produktentscheidung.

| Priorität | Befund | Nachweis und Risiko | Empfohlene Reparatur |
|---|---|---|---|
| **[OPTIMIERUNG]** | Farbentscheidung ist nicht als verbindlicher UI-Vertrag getestet | Die bewusste Rücknahme der Mint-/Rotflächen ist in der Historie dokumentiert, aber nicht gezielt per Test oder Tokenvertrag geschützt. | Designentscheidung als Kommentar/Tokenvertrag dokumentieren und Quelltest für neutrale Import- sowie zurückhaltende Destruktivdarstellung ergänzen. |
| **[OPTIMIERUNG]** | Einsatzplanbreite ist überwiegend als Quelltextvertrag getestet | Klassen-Assertions bestehen. Es fehlt eine automatisierte visuelle Browserregression bei 1280/1366 px sowie für 320/390 px. | Nichtmutierende Screenshot-/Bounding-Box-Regression hinzufügen: Dokumentüberlauf, Tabellencontainer, Desktopbreite und mobile Kartenansicht prüfen. |

## 6. Rechte, Rollen und Passwortschutz

Die Anwendung trennt viele wichtige Rechte serverseitig. OAuth ist restriktiv auf Eigentümer/enge Identitätsmigration begrenzt. Passwortsitzungen sind zeitlich beschränkt, tokenversionsbasiert widerrufbar und kryptografisch signiert. Chat-Clear verlangt Adminrolle, erneute Passwortbestätigung, aktuellen Eventscope und Audit. Recovery-Key-Vergleich erfolgt zeitkonstant; ein falscher Key löst keine Mutation aus. [8]

| Priorität | Befund | Nachweis und Risiko | Empfohlene Reparatur |
|---|---|---|---|
| **[KRITISCH]** | Globaler permanenter Planungsteam-Lock ist durch fünf anonyme Fehlversuche als DoS auslösbar | Jede falsche Anfrage am öffentlichen Planungsteam-Login erhöht denselben globalen Zähler. Nach fünf Versuchen ist der gesamte Planungsteamzugang bis zur Admin-Freigabe blockiert. | Globalen permanenten Lock durch zentralen, TTL-basierten Rate-Limiter und progressive Verzögerung ersetzen. Globale Sperre nur als bewusste Adminmaßnahme; automatische Entsperrzeit und Alarmierung ergänzen. |
| **[WARNUNG]** | Lösch- und Reauth-Schutz ist nicht für jede destruktive Route gleich | Planungsteam kann Helfer und Kuchen in den vorgesehenen Fällen löschen. Weitere Admin-Einzellöschungen benötigen nicht immer eine frische Passwortbestätigung. | Verbindliche Löschmatrix festlegen. Entweder Planer-Löschrouten konsequent auf Admin beschränken oder für jede destruktive Aktion Reauth/zweckgebundene Bestätigung und vollständiges Audit verlangen. |
| **[WARNUNG]** | Rate-Limits sind pro Prozess flüchtig | Fehlversuche liegen in einer lokalen Map und hängen an `socket.remoteAddress`. Neustarts oder mehrere Instanzen umgehen Limits; ein gemeinsamer Proxy kann legitime Admins gegenseitig sperren. | Zentralen TTL-basierten Limiter einsetzen. Forwarded-Header nur innerhalb einer vertrauenswürdig konfigurierten Proxy-Kette verwenden. |
| **[WARNUNG]** | Logout meldet trotz fehlgeschlagenem serverseitigem Widerruf Erfolg | Fehler beim Persistieren des Widerrufseintrags werden protokolliert, aber nicht an den Benutzer zurückgegeben. | Widerruf als sicherheitskritisch behandeln: Fehler sichtbar machen, retry-/outbox-gestützt nachziehen oder zusätzliche atomare Sessioninvalidierung einsetzen. |
| **[WARNUNG]** | Recovery-Reset hat kein Security-Audit und Recovery-Key ist sichtbar | Ein Admin-Reset mit Master-Key erzeugt keinen separaten Sicherheits-Auditdatensatz. Das Eingabefeld ist als Klartextfeld umgesetzt. | Sicherheits-Audit ohne Geheimniswert und Eigentümerbenachrichtigung ergänzen; Key-Feld als Passwortfeld ausführen; Rotation und Mindestentropie dokumentieren. |
| **[OPTIMIERUNG]** | Sicherheitsflows sind überwiegend gemockt getestet | Routerlogik ist gut getestet. Eine echte Testdatenbankprüfung von Sessionversions-Update, Widerruf und Audittransaktion fehlt. | Testdatenbank-Suite mit echten Migrationen für Recovery, Logout-Widerruf, Chat-Clear-Audit und Negativpfade ergänzen. |

## Positive, bestätigte Kontrollen

| Bereich | Bestätigte Stärke |
|---|---|
| Import und Restore | HMAC-gebundene Vorschau, Snapshot-Schutz, Admin-Reauth, Transaktion und Inhaltsverifikation minimieren das Risiko unbeabsichtigter Datenübernahmen. |
| Datenintegrität | Zentrale Löschpfade arbeiten überwiegend transaktional und scoped; Assignments und Schichten sind gut gegen Event-/Jahr-Übergriffe abgesichert. |
| Chat | Ein zentraler Poll-Owner mit Queue/Epoch verhindert doppelte Poller und Scope-Race-Conditions. Vollsnapshots synchronisieren Löschungen robust. |
| Mobile | 16-px-Eingaben, mobile Kartenansicht des Einsatzplans, sichere Schichtdialoghöhe und Composer-Safe-Area sind solide Grundlagen. |
| Desktop | Einsatzplan nutzt die verfügbare Breite; der globale Dokumentüberlauf ist bei 1280 px nicht vorhanden. Der Tabellenüberlauf bleibt lokal und beabsichtigt. |
| Rechte | OAuth-Allowlist, Sessionversionen, sessionseitiger Widerruf, Admin-Reauth für besonders riskante Aktionen und Chat-Clear-Audit sind deutlich überdurchschnittliche Schutzmechanismen. |

## Empfohlene Reparaturreihenfolge

1. **Migrationshistorie stabilisieren.** Erst danach weitere Schema-/FK-Änderungen oder produktive Datenbankausbauten vornehmen.
2. **Planungsteam-Lock gegen externen DoS umbauen.** Dies schützt direkt die Verfügbarkeit bei Veranstaltungen.
3. **Import-IDs bereichsübergreifend sanitisieren.** Danach Excel-Referenzkonflikte zeilenpräzise ausweisen.
4. **Heartbeat-Betrieb nachweisen und überwachen.** Ergänzend echte Datenbankintegrationstests für Löschpfade und Sicherheitsflüsse aufbauen.
5. **Chat-Präsenz, Warnton und Typing-Refresh korrigieren.** Dies verbessert die kollaborative Zuverlässigkeit ohne Fachdatenrisiko.
6. **Mobile Standards zentralisieren.** Pinch-Zoom, Tablet-Touchziele, Dialoghöhen und Safe Areas in den Primitives bereinigen.
7. **Löschmatrix und Recovery-Audit schärfen.** Damit wird die vorhandene Rollenarchitektur nachvollziehbarer und forensisch belastbar.

## Schlussfolgerung

Die Anwendung ist funktional weit entwickelt und verfügt über viele robuste Schutz- und Validierungsschichten. Die beiden kritischen Befunde sind jedoch **infrastrukturell beziehungsweise verfügbarkeitsrelevant**. Sie sollten als nächster Reparaturschritt behandelt werden. Die übrigen Befunde sind klar abgrenzbar und eignen sich für sequenzielle, risikoarme Optimierungsschritte nach Ihrer Freigabe.

## Referenzen

[1]: file:///home/ubuntu/myeifelride/drizzle/meta/_journal.json "Drizzle-Migrationsjournal"
[2]: file:///home/ubuntu/myeifelride/server/project-file.ts "Projektdatei-Parser und Restore"
[3]: file:///home/ubuntu/myeifelride/server/module-excel-import.ts "Modularer Excel-Import"
[4]: file:///home/ubuntu/myeifelride/server/db.ts "Datenbanklogik, Löschpfade und Chat-Cleanup"
[5]: file:///home/ubuntu/myeifelride/client/src/components/LiveChatWidget.tsx "Live-Chat-Widget"
[6]: file:///home/ubuntu/myeifelride/client/src/index.css "Globale Mobile- und Formularelement-Regeln"
[7]: file:///home/ubuntu/myeifelride/client/src/pages/Plan.tsx "Einsatzplan-Layout und Tabellenansicht"
[8]: file:///home/ubuntu/myeifelride/server/routers.ts "Rollen-, Passwort- und Recovery-Routen"
