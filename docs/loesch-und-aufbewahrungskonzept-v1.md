# MyCrewMate – Lösch- und Aufbewahrungskonzept

> **Version 1.0 · Stand 01.10.2026 · Geltung: geschlossener Pilotbetrieb.**
>
> Dieses Dokument beschreibt die beschlossene Regel für die Aufbewahrung von MyCrewMate-Daten. Die Regel ist organisatorisch verbindlich, ersetzt aber keine Steuer- oder Rechtsberatung. Bevor ein breiter Kundenbetrieb startet, sind die markierten manuellen Schritte durch technische Löschläufe, ein Backup-Konzept und Testnachweise zu ergänzen.

## 1. Leitentscheidung

1. **Abgeschlossene Veranstaltungsdaten:** Drei Jahre ab dem dokumentierten Veranstaltungsabschluss (`closedAt`).
2. **Frühere Löschung:** Der Verein kann die Löschung unmittelbar nach Abschluss oder zu einem früheren Zeitpunkt anweisen, wenn keine weitere organisatorische, vertragliche oder gesetzliche Notwendigkeit besteht.
3. **Vorrang gesetzlicher Fristen:** Steuer-, handels- und vertragsrechtlich erforderliche Unterlagen werden nicht allein wegen des Drei-Jahres-Ablaufs gelöscht. Der jeweilige Verein dokumentiert die Ausnahme und prüft sie mit Buchhaltung oder Steuerberatung.
4. **Keine unbegrenzte Archivierung:** „Abgeschlossen“ oder „archiviert“ ist keine dauerhafte Aufbewahrungsfreigabe.
5. **Keine automatischen Infrastruktur-Backups aktuell:** Datenbank und Upload-Volume werden derzeit nicht über einen bestätigten automatisierten Offsite-Backup-Prozess gesichert. Bis zur Einführung eines solchen Prozesses dürfen keine anderen Backup-Fristen behauptet werden.

## 2. Datenklassen und Fristen

| Datenklasse                                                                  |                             Regel-Frist | Startpunkt                    | Ausnahme / Vorrang                                                    | Löschweg                                                  | Umsetzung im Pilot                                                |
| ---------------------------------------------------------------------------- | --------------------------------------: | ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Aktive Planungsdaten                                                         |             bis Veranstaltungsabschluss | Ende der Nutzung              | laufende Planung oder dokumentierter Zweck                            | fachliche Löschung durch Verein                           | in App verfügbar                                                  |
| Geschlossene Event-, Helfer-, Ansprechpartner-, Schicht- und Aufgabenplanung |                                 3 Jahre | `closedAt` des Events         | frühere Vereinsweisung; Legal Hold; nachgewiesene gesetzliche Pflicht | vollständige Löschung des Events samt abhängigen Daten    | **monatliche manuelle Prüfung**, technische Automatisierung folgt |
| Standort-, GPX- und zugehörige Uploaddaten                                   |                                 3 Jahre | `closedAt` des Events         | frühere Vereinsweisung; zwingender Nachweiszweck                      | Datenbankreferenz und physische Datei gemeinsam entfernen | **Orphan-Bereinigung ergänzen**                                   |
| Freiwillige Spenden- und Übergabeinformationen                               |                                 3 Jahre | `closedAt` des Events         | steuer- oder vertragsrelevante Ausnahme                               | fachliche Löschung mit Event                              | **monatliche manuelle Prüfung**                                   |
| Persönliche öffentliche PDF-Übersicht                                        |               nur für den Freigabezweck | Linkfreigabe / Eventabschluss | keine                                                                 | Link sperren, generierte PDF nicht dauerhaft speichern    | Minimal-PDF umgesetzt; Widerruf/TTL als R5 ergänzen               |
| Einladungs- und Passwort-Reset-Links                                         |         jeweilige technische Gültigkeit | Ausstellung                   | keine                                                                 | Ablauf / Einmalnutzung                                    | technisch vorhanden, regelmäßig testen                            |
| QR-Demo-Herkunftsauswahl                                                     |                                 90 Tage | Erfassung                     | keine                                                                 | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| Teamnotizen                                                                  |                              24 Stunden | Erstellung                    | keine                                                                 | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| kurzlebige Klemmi-Tippstatus                                                 |                              8 Sekunden | Erstellung                    | keine                                                                 | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| Wiederherstellungsprotokolle                                                 | 90 Tage bzw. max. 100 Vorgänge je Scope | Erstellung                    | begründete Sicherheitsuntersuchung                                    | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| Sicherheits-, Login- und Aktivitätsprotokolle                                |       **[Frist verbindlich festlegen]** | Erstellung                    | Sicherheitsuntersuchung / Rechtsanspruch                              | regelbasierte Löschung oder Pseudonymisierung             | noch offen                                                        |
| Buchungsbelege und Rechnungen                                                |        grundsätzlich mindestens 8 Jahre | Schluss des Kalenderjahres    | abweichende Spezialpflichten                                          | getrennt und fristgerecht löschen                         | durch Verein / Buchhaltung festlegen                              |
| Bücher, Inventare, Jahresabschlüsse und bestimmte Organisationsunterlagen    |       grundsätzlich mindestens 10 Jahre | Schluss des Kalenderjahres    | abweichende Spezialpflichten                                          | getrennt und fristgerecht löschen                         | durch Verein / Buchhaltung festlegen                              |
| Handels- und Geschäftsbriefe                                                 |                      regelmäßig 6 Jahre | Schluss des Kalenderjahres    | abweichende Spezialpflichten                                          | getrennt und fristgerecht löschen                         | durch Verein / Buchhaltung festlegen                              |

> Die gesetzlichen Fristen sind nur als operative Orientierung aufgeführt. Welche konkreten Daten eines Vereins tatsächlich aufbewahrungspflichtig sind, entscheidet der Verein mit seiner Buchhaltung oder Steuerberatung.

## 3. Monatliche Pilot-Prüfung

Bis die technische Löschautomatik eingeführt ist, führt der zuständige Vereinsadministrator monatlich diese Prüfung durch:

1. Abgeschlossene Events mit `closedAt` älter als drei Jahre ermitteln.
2. Pro Event prüfen: Gibt es eine Steuer-, Vertrags-, Versicherungs- oder Rechtsausnahme?
3. Falls nein: vollständige Eventlöschung in MyCrewMate auslösen und Ergebnis dokumentieren.
4. Falls ja: nur die erforderlichen Nachweisunterlagen außerhalb der operativen Helferplanung separieren; übrige Planungs- und Helferdaten löschen oder anonymisieren.
5. Physische Uploads, PDF-Freigaben und GPX-Dateien auf verwaiste Reste prüfen.
6. Prüfdatum, Event, Entscheidung, Ausnahmegrund und durchführende Person in einem geschützten Löschregister festhalten.

## 4. Mindestinhalt des Löschregisters

| Feld                | Inhalt                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| Prüfung am          | Datum                                                                                   |
| Verein / Event      | eindeutige Zuordnung                                                                    |
| Abschlussdatum      | `closedAt` / Veranstaltungsdatum                                                        |
| Regelfrist erreicht | ja / nein                                                                               |
| Ausnahme            | keine / Steuer / Vertrag / Versicherung / Rechtsanspruch / anderer dokumentierter Grund |
| Entscheidung        | löschen / anonymisieren / befristet weiter aufbewahren                                  |
| Ausgeführt von      | Name und Rolle                                                                          |
| Nachweis            | Löschprotokoll, Ticket oder bestätigte App-Aktion                                       |
| nächster Prüftermin | Datum                                                                                   |

## 5. Anforderungen vor automatisierten Backups

Bevor ein automatisches Backup eingerichtet wird, müssen für **Datenbank** und **Upload-Volume** separat festgelegt werden:

- Speicherort und Datenregion,
- Verschlüsselung bei Transport und Ablage,
- zugriffsberechtigte Personen,
- Sicherungsintervall, Rotation und maximale Aufbewahrungsdauer,
- RPO und RTO,
- Verfahren für Löschungen in Sicherungen,
- mindestens ein dokumentierter Restore-Test mit nichtproduktiven Daten.

Ein Backup darf nicht dazu führen, dass bereits zu löschende Planungsdaten unbegrenzt in Sicherungen fortbestehen. Nach Einführung sind die Backup-Frist und die Löschfrist in diesem Dokument und im AVV-Anhang gemeinsam zu aktualisieren.

## 6. Offene technische Folgepunkte

| Punkt | Ziel                                                                                       | Priorität |
| ----- | ------------------------------------------------------------------------------------------ | --------- |
| R5    | Persönliche PDF-Links zeitlich begrenzen, widerrufbar machen und beim Eventschluss sperren | hoch      |
| R10   | Dreijahresprüfung für geschlossene Events, Logs und Uploads automatisieren                 | hoch      |
| R11   | Verschlüsseltes Backup für DB und Upload-Volume samt Restore-Test einführen                | hoch      |
| B3    | Physische Datei-Löschung und Orphan-Bereinigung nachweisen                                 | mittel    |
| B4    | Jährlichen Lösch- und Restore-Test dokumentieren                                           | mittel    |
