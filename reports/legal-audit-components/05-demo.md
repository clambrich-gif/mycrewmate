# 05 — Vereinsdemo und Nutzerkommunikation

**Prüfstand:** Frische, rein lesende Live-Abrufe am 09.10.2026, ca. 13:11–13:15 Uhr CEST. Geprüft wurden `https://mycrewmate.de/vereinsdemo`, `https://mycrewmate.de/datenschutz` und `https://mycrewmate.de/pilot`; ergänzend wurde der öffentlich erreichbare App-Datenschutzhinweis unter `https://app.mycrewmate.de/datenschutz` gelesen, weil die Demo ausdrücklich die normale App öffnet und Karten/GPX bewirbt. Es wurden **keine Formulare abgesendet, keine Demo gestartet und keine Testeingaben erzeugt**.

Die Einordnung ist keine abschließende Rechtsberatung. **Nachgewiesen** bedeutet hier: im öffentlichen Live-Text ausdrücklich belegt. **Plausibles Risiko** bezeichnet die rechtliche Folge, falls die beschriebene Verarbeitung stattfindet. **Nicht verifizierbare Betriebsannahme** bezeichnet technische Tatsachen, die ohne Start einer Demo bzw. ohne Backend-Einsicht nicht prüfbar waren.

## Dringend — Unbestimmte Demo-Löschzusage und möglicher Backup-Vorbehalt

**Nachgewiesen:** Die Vereinsdemo verspricht, Eingaben lägen nur in einem „eigenen, temporären Demo-Bereich“ und würden „beim Verlassen der Demo sowie spätestens nach kurzer Zeit gelöscht“. Derselbe unbestimmte Maßstab steht in Abschnitt 2.3 der öffentlichen Datenschutzerklärung. Eine konkrete Höchstdauer, ein objektives Ereignis für „Verlassen“ oder der Umgang mit Sicherungen wird dort nicht genannt. [1] [2]

Der App-Datenschutzhinweis erklärt für die Anwendung tägliche Datenbank-/Upload-Sicherungen und höchstens sieben Wiederherstellungspunkte. Weil die Landingpage die „normale MyCrewMate-App“ und einen eigenen Demo-Mandanten ankündigt, ist dies für die Reichweite der Löschzusage relevant. [1] [4]

**Plausibles Risiko:** Werden entgegen der Anweisung doch echte Namen, Kontakte oder andere personenbeziehbare Angaben eingegeben, genügt „nach kurzer Zeit“ nicht als klare Speicherfrist oder nachvollziehbares Kriterium. Art. 13 Abs. 2 Buchst. a DSGVO verlangt die Speicherdauer oder, wenn dies nicht möglich ist, deren Kriterien. Art. 5 Abs. 1 Buchst. e DSGVO verlangt eine auf das notwendige Maß begrenzte Speicherzeit. Eine uneingeschränkte öffentliche Aussage „gelöscht“ kann außerdem irreführen, falls sie nur die Produktionsdatenbank betrifft, während ein Wiederherstellungspunkt fortbesteht. [5]

**Nicht verifizierbare Betriebsannahme:** Nicht geprüft wurde, ob Demo-Mandanten tatsächlich in dieselben Backups gelangen, ob der Löschjob beim Tab-/Browser-Schließen zuverlässig greift, ob er überwacht wird und ob ein Restore gelöschte Demos wiederherstellen kann. Daraus folgt **kein festgestellter technischer Löschfehler**.

**Abhilfe vor Go-live:**

- Auf Landingpage und in Abschnitt 2.3 einen messbaren Maximalwert nennen, etwa: „Produktivzugriff wird beim Beenden und spätestens X Stunden nach Start gelöscht; nach Y Minuten Inaktivität erfolgt die Löschung.“ Nur Werte nennen, die der Job nachweisbar einhält.
- Den Backup-Fall präzise und verständlich ergänzen: entweder Demo-Daten technisch aus Backups ausschließen oder klar sagen, dass sie aus dem aktiven System gelöscht und nur in verschlüsselten, nicht produktiv nutzbaren Sicherungen bis maximal sieben Wiederherstellungspunkte vorliegen. Ein Restore muss die erneute Freischaltung eines abgelaufenen Demo-Mandanten verhindern.
- Einen internen, automatisierten Nachweis für Mandantenanlage, Ablaufzeit, Löschung, erfolglose Wiederherstellung und Alarm bei Jobfehlern als Release-Gate führen. Die öffentliche Aussage erst nach diesem Nachweis freigeben.

## Empfehlung — „Nur fiktive Daten“ ist wichtig, aber keine belastbare Schutzschranke für tatsächliche Eingaben

**Nachgewiesen:** Die Abgrenzung wird mehrfach richtig kommuniziert: Die Demo ist „kein Testzugang für euren eigenen Verein“, alle Personen, Vereine, Kontakte und Strecken seien erfunden und es heißt „Bitte teste nur mit erfundenen Namen und Kontakten“. Zugleich darf der Besucher laut Landingpage Helfer anlegen sowie Schichten und Aufgaben ändern; die Datenschutzerklärung nennt exemplarische Änderungen von Helfern, Aufgaben und Schichten. [1] [2]

**Plausibles Risiko:** Ein echter Name oder eine echte Kontaktangabe bleibt ein personenbezogenes Datum, auch wenn die Eingabe gegen den Hinweis erfolgt. Dann verarbeitet MyCrewMate das Datum zumindest vorübergehend. Der Demo-Abschnitt benennt Zweck und Löschankündigung, aber keine eigenständige Rechtsgrundlage, Empfänger-/Dienstleisterkategorien oder konkretisierte Dauer für diesen Fehlfall. Der Verantwortliche ist zwar allgemein genannt; die restliche Transparenz muss jedoch bei der Erhebung personenbezogener Daten nach Art. 13 DSGVO gegeben sein. Die BfDI fasst zutreffend zusammen, dass Verarbeitung grundsätzlich einen Erlaubnistatbestand aus Art. 6 Abs. 1 DSGVO benötigt. [2] [5] [6]

**Nicht verifizierbare Betriebsannahme:** Ohne eine Demo anzulegen war nicht prüfbar, ob Freitext, E-Mail-, Telefon- oder Kontaktfelder technisch eingeschränkt, zurückgesetzt oder auf bekannte Testdomänen begrenzt werden. Ebenso ist nicht belegt, dass tatsächlich personenbezogene Testeingaben vorkommen. Das ist daher **kein festgestellter Datenschutzverstoß**.

**Abhilfe:**

- Direkt vor Start und an jedem bearbeitbaren Kontakt-/Freitextbereich einen kurzen, nicht übersehbaren Hinweis einsetzen: „Keine echten Namen, E-Mail-Adressen, Telefonnummern, Gesundheits- oder Vereinsdaten eingeben. Die Umgebung wird automatisch zurückgesetzt.“ Die bestehende Warnung im Pilotformular zu Gesundheitsdaten und Daten Dritter ist hierfür ein gutes Vorbild. [3]
- Risikoarme Eingaben vorsehen: voreingestellte Dummy-Werte, Muster-E-Mail-Domäne, Sperre offensichtlicher E-Mail-/Telefonformate in der Demo und beim Erkennen solcher Werte Warnung plus Rücksetzen statt Speicherung. Eine reine Checkbox ist kein Ersatz für Datenminimierung.
- Für den unvermeidbaren Fehlfall ein abgestimmtes Mini-Datenschutzkonzept festlegen und verlinken: Zweck, tragfähige Rechtsgrundlage, Empfängerkategorien, feste Lösch-/Backupfrist, Rechtekontakt und Zuständigkeit. Welche Rechtsgrundlage tragfähig ist, ist vorab anhand der tatsächlichen Umsetzung zu bestimmen, nicht nachträglich per Textbaustein.

## Empfehlung — Karten- und GPX-Demo mit sichtbarer Datenschutz- und Erwartungshand-off versehen

**Nachgewiesen:** Die Vereinsdemo bewirbt für „Pro“ Karte, Standorte und GPX-Strecken und sagt, die Ortsansicht sei hinterlegt. Der separate, öffentliche App-Datenschutzhinweis benennt die optionale Live-Karte ausdrücklich: Sie lädt Kacheln von OpenStreetMap und OpenTopoMap; beim Aufruf würden IP-Adresse, Browserdaten, Kacheln und regelmäßig die Herkunftsseite an die Kartenanbieter übermittelt. Diese Information und die Rechtsgrundlage Art. 6 Abs. 1 Buchst. f DSGVO sind im App-Hinweis erfreulich konkret. [1] [4]

**Nachgewiesen:** Die Datenschutzseite der öffentlichen Website gilt nach ihrem eigenen Text auch für die fiktive Vereinsdemo. Sie verweist auf getrennte Datenschutzhinweise jedoch ausdrücklich beim Button „Zum Login“. Die Vereinsdemo selbst sagt lediglich, danach öffne sich die normale App; auf der Demo-Landingpage ist vor dem Start nur der Link zur öffentlichen Datenschutzseite sichtbar. [1] [2]

**Plausibles Risiko:** Wenn die Karte bei oder nach Start einer öffentlichen Demo ohne vorherigen klaren Verweis geladen wird, erfahren Besucher den externen Abruf und seine Datenkategorien möglicherweise zu spät. Das betrifft auch das Erwartungsmanagement: „keine Analyse- oder Werbetracker“ ist kein Hinweis auf notwendige externe Kartenkacheln. Die App-Erklärung ist inhaltlich ein starker Baustein, aber der Zugang zu ihr im konkreten Demo-Ablauf wurde ohne Start nicht bestätigt. Art. 13 DSGVO und der Transparenzgrundsatz aus Art. 5 Abs. 1 Buchst. a DSGVO sind dafür der Maßstab. [2] [4] [5]

**Nicht verifizierbare Betriebsannahme:** Es wurde keine Pro-Demo geöffnet. Deshalb ist nicht festgestellt, ob Karten automatisch laden, erst nach bewusster Auswahl starten, welche konkrete Kachelquelle im Live-Fall gewählt wird oder ob GPX-Dateien an weitere Stellen übertragen werden.

**Abhilfe:**

- Den Pro-Start klar ergänzen: „Kartenansicht optional; beim Öffnen werden Kartenkacheln von OpenStreetMap/OpenTopoMap geladen. Details im App-Datenschutz.“ Den App-Hinweis direkt verlinken.
- Kartenkacheln erst nach bewusster Aktion in der Karte laden, nicht bereits beim Laden der Demo. Für einen reinen Funktionsüberblick zunächst eine lokale Vorschau nutzen.
- Vor Veröffentlichung technisch prüfen und dokumentieren: aktive externe Hosts, Referrer-Policy, konkrete Kartenanbieter, Länder/Empfängerkategorien und ob GPX-Downloads oder Links weitere Datenübermittlungen auslösen. Datenschutzhinweise und CSP/Implementierung müssen deckungsgleich bleiben.

## Nice to have — Pilotende ist sauber von Vertragsverlängerung abgegrenzt, aber nicht von Datenarchivierung

**Nachgewiesen:** Die Pilotseite kommuniziert klar und mehrfach: kostenlos im vereinbarten Zeitraum, keine Zahlungsdaten, keine Rechnung und keine automatische Verlängerung; die Nutzung ende zum vereinbarten Termin. Die öffentliche Datenschutzerklärung ergänzt dagegen, dass ein zustande gekommener Pilotzugang nach Ende archiviert wird und Daten drei Jahre reaktivierbar bleiben; ein vorzeitiger Löschwunsch sei möglich. Damit wird **keine Löschung zum Pilotende versprochen**. Die konkrete Dreijahresfrist ist im Datenschutzhinweis immerhin transparent genannt. [2] [3]

**Plausibles Risiko:** Ein Verein kann „Nutzung endet“ und „danach entscheidet ihr“ als Ende der Datenhaltung verstehen. Das ist kein belegter Widerspruch und wegen des verlinkten Datenschutzhinweises kein festgestellter Transparenzmangel. Ein kritischer Interessent kann aber die Differenz zwischen Zugangsende und dreijähriger Reaktivierbarkeit leicht übersehen. Für echte Team- und Helferdaten muss die dreijährige Speicherung außerdem intern anhand eines Zweckes und der Erforderlichkeit nach Art. 5 Abs. 1 Buchst. b und e DSGVO belegbar sein. [2] [3] [5]

**Nicht verifizierbare Betriebsannahme:** Nicht geprüft wurden der individuelle Pilotvertrag, die vor Freischaltung angekündigten Rollen/AV-Vereinbarungen, tatsächliche Veranstaltungsdaten, gesetzliche Aufbewahrungspflichten und die technische Archivierung.

**Abhilfe:** In die schriftliche Pilotbestätigung und gut sichtbar direkt vor Freischaltung aufnehmen: „Der Zugang endet am …; Daten werden anschließend für maximal drei Jahre nur zur Reaktivierung archiviert; eine vorzeitige Löschung ist unter … möglich; Sicherungen folgen der benannten Frist.“ Die Dreijahresregel mit einem dokumentierten Zweck und einer Prüfung „früher löschen/anonymisieren, soweit keine Pflicht entgegensteht“ hinterlegen. Das ist vorrangig Klarheit, nicht die Empfehlung, eine rechtmäßige Aufbewahrung zu verschweigen.

## Nice to have — Die Werbeclaims sind verständlich; ihre technische Belastbarkeit sollte je Release belegt werden

**Nachgewiesen und positiv:** Die Website trennt Demo und Pilot besonders deutlich: fiktive Musterumgebung ohne Zugang für den eigenen Verein gegenüber gemeinsam vereinbartem Pilot mit echtem Team und echten Daten. Auch „kein Kauf auf dieser Seite“, „keine automatische Verlängerung“ und die Pilotkonditionen sind klar formuliert. Dies reduziert gerade die Gefahr, dass eine Demo als kostenloser Echtzugang missverstanden wird. [1] [3]

**Plausibles Risiko:** Aussagen wie „die echte App“, „jede gestartete Demo erhält einen eigenen, fiktiven Mandanten“, automatische Entfernung, konkrete Helfer-/Kontaktzahlen sowie Karte/GPX sind Aussagen über Art, Verfügbarkeit, Ausführung und Vorteile der Dienstleistung. Sind sie in einer Variante nicht erreichbar, nicht mandantengetrennt oder weichen Funktionen wesentlich ab, kann dies nach § 5 UWG für Verbraucher **und sonstige Marktteilnehmer** irreführend sein. Ein Mitbewerber kann bei unzulässiger geschäftlicher Handlung grundsätzlich Beseitigung und Unterlassung verlangen (§ 8 UWG). [1] [7] [8]

**Nicht verifizierbare Betriebsannahme:** Wegen des ausdrücklichen Verbots von Eingaben/Start wurde keine der drei Demos aktiviert. Es gibt daher **keinen festgestellten UWG-Verstoß und keinen Nachweis eines Funktionsfehlers**.

**Abhilfe:** Einen nichtöffentlichen Release-Nachweis für jede Demo-Variante führen: richtiger Umfang, getrennte Mandanten, keine Fremddatensicht, Erreichbarkeit von Karte/GPX soweit beworben, Ablauf/Löschung und richtige Preis-/Pilottexte. Bei Störung Pro-Karte/GPX am besten die Funktion bzw. den Claim temporär ausblenden statt eine „echte App“-Erwartung offen zu lassen.

## Positiv festzuhalten

- Die Demo/Pilot-Grenze ist auf den geprüften Seiten ungewöhnlich klar und konsistent: Demo = fiktiv und temporär; Pilot = echter Verein nach persönlicher Abstimmung. [1] [3]
- Die Pilotkommunikation verneint einen automatischen Kauf, Zahlungsdaten und eine automatische Verlängerung deutlich. [3]
- Die öffentliche Datenschutzerklärung benennt Verantwortlichen, Pilotdatenkategorien, Speicherfrist für Anfrage/Pilot und einen Löschkontakt. [2]
- Der ergänzend geprüfte App-Hinweis benennt Kartenanbieter, übermittelte technische Daten, Sicherungsrhythmus und externe Kommunikation konkret. [4]
- Das Pilotformular fordert keine Gesundheitsdaten oder personenbezogenen Daten Dritter an; es warnt ausdrücklich davor. [3]

## Quellen

[1]: https://mycrewmate.de/vereinsdemo "MyCrewMate Vereinsdemo — Live-Abruf"

[2]: https://mycrewmate.de/datenschutz "MyCrewMate Datenschutz — Live-Abruf"

[3]: https://mycrewmate.de/pilot "MyCrewMate Pilotprogramm — Live-Abruf"

[4]: https://app.mycrewmate.de/datenschutz "Datenschutz für die MyCrewMate-App — öffentlicher Live-Abruf"

[5]: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679 "Verordnung (EU) 2016/679 (DSGVO), insbesondere Art. 4, 5, 6, 13, 17 und 32 — amtliche Fassung"

[6]: https://www.bfdi.bund.de/DE/Buerger/Inhalte/Allgemein/Datenschutz/GrundlagenDatenschutzrecht.html "BfDI: Die Grundlagen des Datenschutzrechts"

[7]: https://www.gesetze-im-internet.de/uwg_2004/__5.html "UWG § 5 — Irreführende geschäftliche Handlungen"

[8]: https://www.gesetze-im-internet.de/uwg_2004/__8.html "UWG § 8 — Beseitigung und Unterlassung"
