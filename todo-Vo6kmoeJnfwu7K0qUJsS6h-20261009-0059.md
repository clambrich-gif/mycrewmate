# Sitzungs-To-do · Vereinsdemo

## Abgeschlossen

- [x] Öffentliche Seite `/vereinsdemo` als schlanke Auswahlseite für Event Pass, Light und Pro umgesetzt.
- [x] Ultimate als reine Erläuterung für Verbände und große Mehrspartenvereine positioniert.
- [x] Für jeden Start einen eigenen, fiktiven und temporären Demo-Mandanten mit Musterdaten erzeugt.
- [x] Echte MyCrewMate-App statt einer separaten Dashboard-Kopie geöffnet.
- [x] Musterhelfer, Ansprechpartner, Aufgaben, Schichten, Material, Orte und für Pro GPX-Dateien angelegt.
- [x] Klemmi in Auswahlseite und bestehender App-Führung eingebunden.
- [x] Temporäre Sitzungen beim Klick auf „Demo beenden“, beim Verlassen und zusätzlich nach Ablauf bereinigt.
- [x] Vertragsdialog für rein technische, fiktive Demozugänge unterdrückt.
- [x] Manuell geprüft: Demo starten, Dashboard laden, Helfer anlegen und Demo beenden.
- [x] Typecheck, Demo-Tests und Produktionsbuild erfolgreich ausgeführt.
- [x] Pro-Demo um ein fiktives EifelRide-Eventlogo ergänzt.
- [x] Drei realistischere GPX-Teststrecken mit Distanz, Höhenmetern, Streckenprofil, Verpflegungs- und Zeitnahmeinformationen ergänzt.
- [x] GPX-Metadaten in Karten-Popups und der Streckensteuerung sichtbar gemacht.
- [x] Zusätzliche Pro-Standorte für Verpflegung, Zeitnahme und Technik auf der Live-Karte angelegt.
- [x] Globale 8-Sekunden-Synchronisierung, Präsenz-Heartbeat und Chat-Polling für Demozugänge abgeschaltet.
- [x] Pro-Logo und GPX-Dateien als wiederverwendete, rein fiktive Demo-Assets gecacht statt pro Start neu anzulegen.
- [x] Speichern/Laden, Import/Export, PDF-Downloads, Freigabelinks, WhatsApp und Datei-Uploads in der Demo in Oberfläche und Serverlogik gesperrt.
- [x] „Schutz & Protokoll“ als reine Audit-Ansicht ohne Verwaltungs- und Wiederherstellungsaktionen umgesetzt.
- [x] MyCrewMate-Logo in der Demo an `https://mycrewmate.de` gebunden.
- [x] Manuell geprüft: Pro-Demo, Eventlogo und GPX-Karte, schreibgeschütztes Schutzprotokoll, ausgeblendete PDF-/WhatsApp-Aktionen, gesperrte GPX-Uploads und vollständige Bereinigung beim Demoende.
- [x] IP-basierte Startgrenze durch eine anonyme, browserbezogene Kennung ersetzt: bis zu neun Starts je Browser in fünf Minuten, ohne Sperren für andere Besucher derselben Internetverbindung.
- [x] Zusätzliche globale Parallelkapazität von 20 temporären Demos ergänzt und die Tab-Schließ-Bereinigung mit `sendBeacon` abgesichert.
- [x] Manuell geprüft: Nach Rücksetzen des alten Startzählers startet die Pro-Demo wieder; der Klick auf das App-Logo führt zu `https://mycrewmate.de/`.
- [x] Einsatzplan-Kachelansicht für große Helferzahlen optimiert: Kandidatendaten werden nur nach bestätigten Planänderungen berechnet, einzelne Helferzeilen memoisiert und lange Listen virtualisiert.
- [x] Auswahlzustand je Schicht lokal isoliert: Ein Haken rendert nicht mehr den gesamten Einsatzplan neu. Messung in der Pro-Demo: Auswahlreaktion ca. 15–25 ms bei 150 Musterhelfern.
- [x] Mehrfachzuweisung serverseitig beschleunigt: Redundante vollständige Listenabfragen entfernt; die bestehende atomare Datenbankprüfung bleibt allein maßgeblich für Verfügbarkeit, Doppelzuweisungen und freie Plätze. Manuelle Messung: Schreibvorgang ca. 386 ms.
- [x] Typecheck, 205 relevante Server-/UI-/Demo-Tests und Produktionsbuild nach der Einsatzplanoptimierung erfolgreich ausgeführt.
- [x] Zweite Zuweisungsoptimierung umgesetzt: Auswahl wird beim Speicherklick unmittelbar quittiert, Klemmi reagiert vor der aufwendigen Plan-Neubewertung und ein nicht blockierender Hinweis zeigt die Hintergrundaktualisierung an.
- [x] Live-Domain geprüft: `app.mycrewmate.de` liefert noch den alten Produktionsbuild (u. a. mit Demo-Chat, Speichern/Laden und PDF-Ausgabe). Für die Veröffentlichung ist der im Projekt dokumentierte GitHub-/Coolify-Deploy-Schritt erforderlich; in dieser Sitzung ist kein Coolify- oder GitHub-Deploy-Connector verbunden.
- [x] Den bestätigten Hero-Einstieg der Hauptseite wiederhergestellt: „Vereins- und Eventplanung, die Freude macht.“ sowie den früheren beschreibenden Absatz aus dem Stand `ed906d40`.

## Später prüfen

- [ ] Öffentliche Startseite erst in einem separaten Schritt inhaltlich und visuell überarbeiten.
- [ ] Nach Veröffentlichung die Vereinsdemo auf der echten Marketing- und App-Domain einmal end-to-end testen.
