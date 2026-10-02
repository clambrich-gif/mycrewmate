# MyCrewMate – Datenschutz-Betriebsmappe und Verzeichnis der Verarbeitungstätigkeiten

**Version 1.0 · Stand 02.10.2026 · Geltung: geschlossener Pilotbetrieb**

> Dieses Dokument dient der Rechenschaftspflicht nach Art. 5 Abs. 2 und Art. 30 DSGVO. Es ist eine Betriebsdokumentation und keine Rechtsberatung. Vor öffentlichem Zahlungsbetrieb sind die Rechtstexte, Lieferantenunterlagen und die tatsächlichen Betriebsnachweise durch eine qualifizierte Datenschutz-/Rechtsberatung abschließend zu prüfen.

## 1. Zulässige Außendarstellung

Die nachfolgende Aussage darf nur verwendet werden, solange der technische und organisatorische Stand dieser Mappe eingehalten wird:

> **„MyCrewMate wurde datenschutzorientiert entwickelt. Anwendung, Datenbank, Upload-Speicher und Sicherungen werden in Deutschland betrieben. Vereine erhalten eine digitale AVV, dokumentierte technische und organisatorische Schutzmaßnahmen sowie Funktionen für Löschung, Zugriffsschutz und Betroffenenanfragen.“**

Nicht verwenden: „vollständig DSGVO-zertifiziert“, „garantiert DSGVO-konform“ oder eine gleichwertige pauschale Rechtszusage.

## 2. Deutschlandbetrieb und Datenfluss

| Verarbeitung / Komponente | Zweck | Betreiberrolle | Datenregion nach aktueller Betriebsdokumentation | Datenarten | Nachweis / Prüfrhythmus |
| --- | --- | --- | --- | --- | --- |
| Anwendung, Container und MySQL | Bereitstellung der geschützten Vereins- und Eventplanung | MyCrewMate als Auftragsverarbeiter für Mandantendaten; im Übrigen eigener Verantwortlicher | Deutschland, Hetzner-Betriebsumgebung | Konto-, Vereins-, Planungs- und Sicherheitsdaten | Betreiberkonfiguration und Vertrag mit Hetzner; mindestens jährlich sowie bei Infrastrukturwechsel prüfen |
| Upload-Volume | Eventbilder, Standortlogos, GPX und zugehörige geschützte Dateien | Auftragsverarbeiter | Deutschland, Hetzner-Betriebsumgebung | Uploads und technische Metadaten | Geschützte Asset-Routen, Löschtests, Storage-/Backupnachweis |
| Object Storage / Sicherungen | Wiederherstellung von Datenbank und Upload-Volume | Auftragsverarbeiter | Deutschland, Hetzner Object Storage | Sicherungskopien der vorgenannten Daten | Tägliche Sicherung, maximal sieben Wiederherstellungspunkte, halbjährlicher Restore-Test |
| SMTP-Maildienst | Einladungen, Passwort-Resets, Vertrags- und Sicherheitskommunikation | Auftragsverarbeiter bzw. eigener Verantwortlicher je Mailzweck | Deutschland, Hetzner-Maildienst | Empfängeradresse, Name, Betreff, Nachricht, Einmal-Link | Maildienstkonfiguration, TLS-Prüfung, jährliche Lieferantenprüfung |
| OpenStreetMap / OpenTopoMap | Optionale Kartenkacheln bei bewusstem Kartenaufruf | Externer Empfänger; Rolle je Dienst prüfen | Externer Abruf; nicht Teil der Deutschlandzusage | technisch notwendige Browser-/Verbindungsdaten, Kachelabruf, Referrer | Datenschutzhinweis, sichtbare Attribution, jährlicher Nutzungs-/Lieferantencheck |
| WhatsApp | Ausschließlich nach bewusstem Klick durch den Verein | Externer Kommunikationsdienst; nicht Teil der Kernplanung | nach Dienstbedingungen; nicht Teil der Deutschlandzusage | Zielrufnummer und optional vorbereiteter Nachrichtentext | Freiwillige Aktivierung, Vereinsinformation, jährlicher Check |

**Wichtig:** Die Aussage „Server in Deutschland“ bezieht sich auf die MyCrewMate-Kerninfrastruktur und Sicherungen. Sie schließt freiwillig ausgelöste externe Dienste wie Kartenkacheln oder WhatsApp nicht ein.

## 3. Verarbeitungstätigkeit A – Plattform- und Vertragsbetrieb

| Merkmal | Festlegung |
| --- | --- |
| Verantwortlicher | Christian Lambrich / MyCrewMate, Eichenweg 4, 56729 Nachtsheim, Deutschland; Datenschutzkontakt: info@mycrewmate.de |
| Zweck | Bereitstellung und Absicherung der Plattform, Vertragsverwaltung, Kontaktaufnahme, Versand transaktionaler E-Mails, Missbrauchsschutz, Nachweis digitaler Vertragsannahmen |
| Betroffene Personen | Vereinsadministratoren, Planungsteam, Interessierte bei direkter Kontaktaufnahme |
| Datenkategorien | Name, E-Mail-Adresse, Passwort-Hash, Rollen/Rechte, Sitzungsversion, Sicherheits-, Vertragsannahme- und Kommunikationsdaten |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO für Vertrag/Anbahnung; Art. 6 Abs. 1 lit. c DSGVO bei gesetzlichen Pflichten; Art. 6 Abs. 1 lit. f DSGVO für Sicherheit und Missbrauchsschutz |
| Empfänger | Hetzner für Hosting, Mail und Sicherungen; keine Analyse-/Werbetracker |
| Löschfristen | Sicherheits-, Login- und Aktivitätsprotokolle 12 Monate; abgelaufene Einladungen, Sitzungswiderrufe und vergleichbare kurzlebige Sicherheitsdaten 30 Tage; Vertragsunterlagen gemäß jeweiliger gesetzlicher/vertraglicher Pflicht |
| TOM | HTTPS, sichere Passwort-Hashes, rollenbasierte Rechte, 12-Stunden-Sitzungen, Sitzungswiderruf, Fehlversuchsschutz, HSTS/CSP/NoSniff/Referrer-Policy, Auditierung |

## 4. Verarbeitungstätigkeit B – Vereins- und Eventplanung im Auftrag

| Merkmal | Festlegung |
| --- | --- |
| Verantwortlicher | Jeweiliger Verein |
| Auftragsverarbeiter | Christian Lambrich / MyCrewMate gemäß digital angenommener AVV |
| Zweck | Vorbereitung, Durchführung und Nachbereitung von Vereins- und Veranstaltungsarbeit; Helferkoordination, Einsatzplanung und organisationsbezogene Kommunikation |
| Betroffene Personen | Vereinsadministratoren, Planungsteam, Ansprechpartner, Helfer, freiwillige Spender und sonstige vom Verein angelegte Beteiligte |
| Datenkategorien | Kontakt- und Zugangsdaten, Verfügbarkeiten, Schichten, Aufgaben, Standortdaten, Material-/Finanzplanungsdaten, aufgabenbezogene Hinweise, freiwillige Spendeninformationen |
| Besondere Kategorien | Nicht für Freitext vorgesehen. Falls ein Verein sie ausnahmsweise verarbeitet, muss er Notwendigkeit, Rechtsgrundlage und zusätzliche Maßnahmen dokumentieren. |
| Empfänger | Verein und berechtigte Planungsrollen; bei bewusster Freigabe zeitlich begrenzte PDF-Ansicht; optionale externe Karten-/WhatsApp-Dienste nur durch bewussten Klick |
| Löschfristen | Geschlossene Events regulär 3 Jahre ab `closedAt`; frühere Löschweisung möglich; dokumentierte Steuer-/Vertrags-/Versicherungs-/Rechtsausnahme als Hold. Technische Bereinigung stündlich einschließlich eventbezogener Uploads. |
| TOM | Mandanten-/Event-/Fachbereichsprüfungen, Paketrechte, Asset-Schutz, PDF-Code plus 7 Tage plus Widerruf, Auditierung, Abschluss widerruft Zugänge und Freigaben |

## 5. TOM-Kurzregister

| Schutzziel | Umgesetzte Maßnahme | Betriebsnachweis |
| --- | --- | --- |
| Vertraulichkeit | Individuelle Vereinsadministrationskonten, Rollen, Fachbereichsrechte, Mandanten- und Event-Scope | Berechtigungstests, Aktivitätsprotokoll, jährlicher Rechte-Review |
| Integrität | Serverseitige Produkt- und Fachbereichsgates, Auditierung kritischer Änderungen, versionierte Vertragsdokumente | Test-Suite, Vertragsnachweis, Releaseprotokoll |
| Verfügbarkeit | Tägliche DB-/Upload-Sicherungen und sieben Wiederherstellungspunkte | Halbjährlicher Restore-Test mit Testdaten, Restoreprotokoll |
| Belastbarkeit | HSTS, CSP, Referrer-Policy, `nosniff`, Sitzungswiderruf, Fehlversuchsschutz und zeitlich begrenzte Links | Quartalsweiser Security-Smoke-Test |
| Datenminimierung | Trackerfreie Produktseite, lokale Schrift, speicherfreie öffentliche Musterdemo, Minimalansicht bei Helfer-PDFs | Network-/Texttest vor Release |
| Löschung | Stündlicher, idempotenter Bereinigungsjob; dokumentierte Holds | Heartbeat-Ausführung, Löschtest und Löschregister |

## 6. Betreiberpflichten und Nachweisplan

| Intervall | Pflicht | Verantwortlich | Nachweis |
| --- | --- | --- | --- |
| Bei jedem Release | Datenschutz-/TDDDG-/Lieferantencheck für neue externe Dienste, Endgerätezugriffe oder Datenkategorien | Plattformbetreiber | Release-Checkliste |
| Monatlich | Heartbeat-Ausführung, Löschprotokoll und offene Aufbewahrungsausnahmen prüfen | Plattformbetreiber | Heartbeat-Log / Löschregister |
| Quartalsweise | Berechtigungen, aktive Admins, Freigaben und Security-Headers prüfen | Plattformbetreiber | Reviewprotokoll |
| Halbjährlich | Restore-Test mit nichtproduktiven Daten durchführen | Plattformbetreiber | Restoreprotokoll |
| Jährlich | VVT, TOM, Lieferantenregister, DSFA-Vorprüfung und Rechtstexte aktualisieren | Plattformbetreiber | Aktualisierte Betriebsmappe |

## 7. Noch zwingend manuell zu schließen

1. **Hetzner-Vertrags-/Datenschutzunterlagen** und tatsächliche Datenregion als Nachweis ablegen.
2. **Vertretung für Datenschutzvorfälle** schriftlich benennen.
3. **Ersten Restore-Test** mit nichtproduktiven Daten und Ergebnis dokumentieren.
4. **Rechtsprüfung** der finalen AGB, AVV und Datenschutzhinweise veranlassen; danach freigegebene Versionen einfrieren.
