# Sitzungs-To-do · Vereinsdemo

## Abgeschlossen

- [x] Öffentliche Seite `/vereinsdemo` als schlanke Auswahlseite für Event Pass, Light und Pro umgesetzt.
- [x] Enterprise als individuelle Lösung für Verbände und große Mehrspartenvereine positioniert.
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
- [x] Hauptseite als transparente Produkt- und Preisseite weiterentwickelt: reguläre Endpreise ab 01.01.2027, Vergleichstabelle und Enterprise bleiben sichtbar; Warenkorb- und Checkout-Simulation sind entfernt.
- [x] Pilotprogramm als eigenständige Zweitseite `/pilot` integriert: kostenloser, individuell abgestimmter Test bis 31.12.2026, keine automatische Verlängerung, 50%-Pilotvorteil und noch nicht sendendes Anfrageformular.
- [x] Hauptseite und Pilotseite klar verknüpft: Pilot-Anfrage als Hauptweg, Vereinsdemo als separater Zweitweg, Preisrücklink auf `/pilot` sowie Enterprise statt Ultimate in der Pilotumgebung.
- [x] Öffentliche Vereinsdemo sprachlich eindeutig abgegrenzt: reine Übungsumgebung mit fiktiven Daten; Pilotprogramm als einziger Weg für eigene Vereine, echte Anlässe und reale Daten. Enterprise ersetzt dort die frühere sichtbare Bezeichnung Ultimate.
- [x] Steuerkennzeichnung bewusst bis zur Rücksprache mit dem Steuerberater offen gelassen; die Website zeigt bis dahin ausschließlich bestätigte Endpreise ohne MwSt.-/USt.-Aussage.
- [x] Pilot-Anfrageformular als echten, SMTP-basierten Versand an `support@mycrewmate.de` fertiggestellt: vertikale Felder, freiwillige Rückrufnummer, serverseitige Validierung, Spam-Schutz und automatische Eingangsbestätigung.
- [x] Öffentliche MyCrewMate-Logos auf Hauptseite, Pilotseite, Vereinsdemo und Rechtstexten einheitlich mit `https://mycrewmate.de/` verlinkt.
- [x] Pilotanfragen als geschützte Vorgänge mit Entscheidung, Löschwunsch und dreijähriger Aufbewahrungsfrist im Master-Portal dokumentiert.
- [x] Ablaufende Pilotzugänge werden im bestehenden täglichen Produktablauf archiviert, Zugänge widerrufen und per E-Mail über Reaktivierung bis zur festen Dreijahresfrist informiert.
- [x] Archivierte Pilotmandanten werden nach Ablauf der Frist einschließlich Planungsdaten, Zugängen und zugehörigen Uploads technisch bereinigt.
- [x] Öffentliche Datenschutzhinweise, Löschkonzept, Betriebsmappe und Produktionshandbuch um Pilotanfragen, Hetzner-Mailpostfächer, Reaktivierung und Löschwünsche ergänzt.
- [x] Pilotvorteil verständlich begrenzt: 50 % nur für Light (149 € → 74,50 €) und Pro (299 € → 149,50 €) im ersten kostenpflichtigen Veranstaltungsjahr; Event Pass und Enterprise sind ausgenommen.
- [x] Primäre Werbe-CTAs auf der Hauptseite führen unmittelbar zur Pilotanfrage; „Plätze“ wurde durch die klare Antragsfrist bis 31.12.2026 ersetzt.
- [x] Sichtprüfung bei 360 px: Pilotseite und Vereinsdemo sind ohne abgeschnittene Primär-CTAs oder sichtbaren Horizontalüberlauf nutzbar.
- [x] Dringende Transparenzkorrekturen umgesetzt: Pflicht-/Freiwilligkeits- und Aufbewahrungshinweis direkt im Pilotformular, eindeutige 50%-Regel für Light/Pro, präzise Demo-Lösch- und Sicherungsinformation.
- [x] Dringende Zugänglichkeitskorrekturen umgesetzt: kontraststarke orange Aktionsflächen (mindestens 4,5:1) sowie Tastaturnavigation und Screenreader-Text im Tarifvergleich.
- [x] Öffentliche Demosicherheit verstärkt: Bereinigungs-Heartbeat `public-demo-cleanup` alle zehn Minuten registriert; technische Höchstalterung bleibt 35 Minuten.
- [x] 50%-Pilotvorteil als einheitlicher Regelblock ergänzt: sichtbar bei der Preisübersicht, auf der Pilotseite und in der automatischen Eingangsbestätigung; nur Light/Pro, einmalig, unmittelbar anschließend, ohne Rabattkombination und ohne automatische Verlängerung.
- [x] Bestätigte Wirtschafts-Identifikationsnummer `DE428034222` im Impressum ergänzt; die interne Steuernummer wird nicht veröffentlicht.
- [x] Zielgruppen- und Annahmeregel auf Start- und Pilotseite umgesetzt: ausschließlich Vereine/Verbände, ehrenamtliche Organisationsteams oder Initiativen sowie Gemeinden/kommunale Veranstalter mit ehrenamtlich getragenem Anlass; private Feiern, Firmenveranstaltungen und gewerbliche Eventdienstleistungen sind ausgeschlossen.
- [x] Pilotformular um Organisationsform und bestätigten Ehrenamtsbezug ergänzt, serverseitig validiert, in Anfrage-E-Mail und geschütztem Pilotportal angezeigt sowie revisionsfähig gespeichert.
- [x] Organisation als Nutzungsinhaber im öffentlichen Zielgruppenblock und Pilotformular klargestellt: Eine Person aus dem Verein, der Initiative oder der Gemeinde kann anfragen; ein Pilotzugang ist ausschließlich für die genannte Organisation möglich.

## In Umsetzung

- [x] Geprüften Pilotaufbewahrungsstand veröffentlicht; der vorhandene Heartbeat `product-expiry-reminders` läuft täglich um 08:00 UTC und führt nach dem Deploy automatisch die neue Pilotlogik aus.
- [x] Hetzner-AVV mit den tatsächlichen Verarbeitungskategorien verbindlich angelegt.
- [x] B2B-Ausrichtung für die aktuelle Website festgelegt: ausschließlich Vereine/Verbände, ehrenamtliche Organisationsteams oder Initiativen sowie Gemeinden/kommunale Veranstalter; keine Privatpersonen, Firmenveranstaltungen oder gewerblichen Eventdienstleistungen.
- [x] Technische Logfristen auf Produktionsserver und Reverse Proxy aktiviert und live geprüft: Docker-Standardtreiber `journald`, `MaxRetentionSec=14day`, Speichergrenzen, neu erzeugte MyCrewMate- und Coolify-Proxy-Container mit `journald` sowie öffentlicher Health Check `200`. Der Nachweis steht in `docs/server-log-retention-v1.md`.
- [x] Echte Pilot-Testanfrage über das Live-Formular durchgeführt: sichtbare Erfolgsmeldung, interne Benachrichtigung und automatische Eingangsbestätigung sind im verbundenen Mailpostfach eingegangen. Den klar markierten Testeintrag anschließend im Master-Portal vollständig gelöscht.
- [x] Master-Portal gegen freiwillig fehlende Rückrufnummern abgesichert: Anzeige „Nicht angegeben“ statt Fehler; Regressionstest, Typecheck und Produktionsbuild erfolgreich, live veröffentlicht.
- [x] Nicht benötigte Pilotvertragsfunktion vollständig entfernt: keine separaten Entwürfe, PDFs oder Vertragsdaten mehr. Der kurze Pilotablauf bleibt bei Pilotanfrage, persönlicher Abstimmung sowie Vereins- und Paketverwaltung im Master-Portal.
- [x] Aktuellen Projektstand erneut ohne falsche Domainverweise geprüft; die Master-Portal-Domain bleibt `admin.mycrewmate.de`.
- [x] Master-Portal übersichtlicher aufgebaut: aktive Master-MFA zeigt nur noch eine kompakte Leiste; sicherheitsrelevante Bedienung öffnet sich erst über „Sicherheitsdetails“.
- [x] Persönliche Vereinszugänge werden je Verein in einer eigenen einklappbaren Liste verwaltet; mehrere Vereine eines Zugangs werden gegen versehentliche Löschung geschützt.
- [x] Abgelaufene Master-Sitzungen werden klar als erneute Anmeldung erklärt, statt eine technische Fehlermeldung anzuzeigen.
- [x] Frühere WBT-Schulungsfunktion vollständig entfernt: keine Master-Aktion, keine Hilfe-/Klemmi-Verlinkung, keine öffentliche oder geschützte Route, keine PDF-Erzeugung und keine Schulungsdateien. Die historische Tabelle `wbt_training_links` wurde nach bestätigter Löschentscheidung aus Schema und Entwicklungsdatenbank entfernt; die Produktionsmigration `0100_chemical_captain_marvel` ist vorbereitet.
- [x] Master-Portal sprachlich präzisiert: „Pilotzugang“ statt Testzugang, „Zustimmungen für den Vereinszugang“ statt Vertragsunterlagen, „Admin-Zugang einrichten“ sowie eine eindeutige endgültige Vereinslöschung. Paketzuordnungen und der noch deaktivierte Marktstart sind klar benannt.
- [x] Typecheck, 46 gezielte Regressionstests und Produktionsbuild für die Master-Portal-Bereinigung erfolgreich ausgeführt; Laufzeitcode und Domains zusätzlich ohne WBT- bzw. `micromate`-Treffer geprüft.
- [x] Vereinsanlage im Master-Portal vereinfacht: ein Name statt doppelter Bezeichnung, kein sichtbarer interner Status, kein separater Supportkontakt und eine klare Auswahl aus Pilotzugang, Testzugang, Aktiv, Pausiert oder Abgelaufen. Bestehende Vereine – insbesondere RSC Eifelland Mayen – wurden dabei nicht verändert; keine Datenmigration.
- [x] Aktivierungs-E-Mails für neue Planungs- und Vereinszugänge gegen falsche Vorbelegungen abgesichert: Empfänger starten leer, Versandhaken starten aus, Vereinswechsel und Formularneustart löschen alte Auswahlwerte; auf dem Server ist der Versand ohne ausdrückliche Bestätigung ebenfalls aus. Mandantentrennung, Typprüfung, Build und 53 gezielte Regressionstests erfolgreich geprüft.
- [x] Persönliche E-Mail im neuen Planungszugang zusätzlich gegen Browser-Autofill und Referenzreste abgesichert: Ohne gewählten Ansprechpartner ist das Feld gesperrt und erklärt den nächsten Schritt; jeder neue Entwurf erhält ein frisches Formularobjekt, damit keine frühere Adresse sichtbar bleiben kann. 53 gezielte Regressionstests, Typecheck und Produktionsbuild erfolgreich.
- [x] Container-Veröffentlichung gegen die externe Docker-Hub-Abrufgrenze abgesichert: Build und Laufzeit verwenden den geprüften öffentlichen AWS-ECR-Spiegel des offiziellen Node-22-Bookworm-Slim-Images. Manifestabruf HTTP 200, Dockerfile-Regressionstest, 54 gezielte Tests, Typecheck und Produktionsbuild erfolgreich.
- [x] GitHub-Containerbuild zusätzlich gegen Docker-Hub-Ausfälle beim BuildKit-Start abgesichert: `docker/setup-buildx-action` verwendet den öffentlichen ECR-Spiegel `public.ecr.aws/vend/moby/buildkit:buildx-stable-1` statt `moby/buildkit` von Docker Hub.
- [x] Verbliebene Docker-Hub-Abhängigkeit im Dockerfile entfernt: Die externe Syntaxzeile `docker/dockerfile:1` wurde nicht benötigt und hätte Docker Hub erneut kontaktiert. Der Build nutzt nun die Standard-Dockerfile-Syntax des gespiegelt gestarteten BuildKit.
- [x] Wechsel von Pilot zu einem aktiven regulären Paket abgesichert: Bei Light, Pro oder Enterprise mit Status „Aktiv“ wird der Verein einmalig als regulärer Zugang übernommen. Daten und Zugänge bleiben bestehen; die automatische Pilotarchivierung greift nicht mehr. Der Master-Dialog, Sicherheitsprotokoll, Ablaufhinweise und Regressionstests dokumentieren diesen Schritt.
- [x] Aktive Vereinsverwaltung im Master-Portal vervollständigt: Tarifbeginn/-ende und Ablaufhinweis sind direkt auf der Vereinskarte sichtbar; Produktverwaltung, Vereinsansicht, Adminzugang und Archivierung stehen auch aktiven Vereinen zur Verfügung. Endgültige Löschung ist nur nach bewusster Archivierung möglich.
- [x] Sicheren Adminwechsel ergänzt: Ein alter Vereinsadmin kann nur nach Anlegen mindestens eines weiteren aktiven Admins und nur für den betreffenden Verein entzogen werden. Andere Vereinsmitgliedschaften, Planungsdaten und Ansprechpartner bleiben unverändert; ein Verein kann nie ohne aktiven Admin zurückbleiben.
- [x] Pilotformular ohne doppelte Hinweiskästen vereinfacht: Der große Datenhinweis entfällt; Zielgruppe ist allgemein für MyCrewMate und verständlicher formuliert; die Ehrenamtsbestätigung ist kurz. Datenschutz bleibt über den Link und einen knappen Hinweis direkt an der Checkbox transparent.
- [x] Hilfe und Klemmi-Führung zur Planfreigabe ergänzt: Suche nach „Einsatzplan“ oder „Planfreigabe“ erklärt die bewusste Freigabe, den optionalen Ansprechpartner-Versand, die Versandhistorie und Hinweise nach späteren Änderungen. Klemmi zeigt diesen zusätzlichen Schritt nur bei vorhandenem Planfreigaberecht und führt niemals selbst eine Freigabe oder E-Mail aus.
- [x] Zwei Klemmi-Aufnahmen im Einsatzplan korrigiert: Schritt 7 („Schichtkachel und Bedarf lesen“) wurde mit der einheitlichen freundlichen Achird-Stimme neu vertont; Schritt 15 („Planfreigabe“) erhielt erstmals eine vollständige Aufnahme. Beide MP3-Dateien wurden dekodiert, transkribiert, versionssicher referenziert und per Laufzeitregression geprüft.
- [ ] Vor dem geplanten Kaufstart am 01.01.2027 Checkout, Steuerstatus und eine etwaige BFSG-/Barrierefreiheitsinformation für den dann verbindlich bestätigten Vertriebspfad freigeben.

## Später prüfen

- [ ] Nach Steuerberatung die rechtlich korrekte Umsatzsteuer-/Mehrwertsteuerkennzeichnung vor dem Buchungsstart ergänzen.
- [x] Tatsächlichen SMTP-Liveversand mit einer eindeutig markierten Testanfrage geprüft: Nachricht an `support@mycrewmate.de` und automatische Bestätigung wurden zugestellt.
- [ ] Hetzner-Mailpostfach monatlich nach dem dokumentierten Dreijahresprozess bereinigen; SMTP kann eingegangene oder gesendete Mailkopien nicht automatisch aus der Mailbox löschen.
- [ ] Nach Veröffentlichung die Vereinsdemo auf der echten Marketing- und App-Domain einmal end-to-end testen.
- [ ] Falls nach der kurzen Pilotphase später wieder schriftliche Vereinbarungen in MyCrewMate verwaltet werden sollen, Bedarf, Rechtsprüfung, Unterschrift und sichere Ablage zuerst gemeinsam neu festlegen.
- [ ] Bei Gelegenheit die 20 verbleibenden, fachlich überholten Volltests auf die vereinsneutrale Architektur und die aktuellen öffentlichen Texte umstellen. Sie betreffen derzeit nur alte Testannahmen, nicht den hier geprüften Master-Portal- oder WBT-Laufzeitcode.
