# MyCrewMate – Lösch- und Aufbewahrungskonzept

> **Version 1.1 · Stand 02.10.2026 · Geltung: geschlossener Pilotbetrieb.**
>
> Dieses Dokument beschreibt die beschlossene Regel für die Aufbewahrung von MyCrewMate-Daten. Die Regel ist organisatorisch verbindlich, ersetzt aber keine Steuer- oder Rechtsberatung. Ein plattformverwalteter, stündlicher Bereinigungsjob führt die beschriebenen technischen Löschungen idempotent aus. Der dokumentierte Restore-Test bleibt vor breitem Kundenbetrieb offen.

## 1. Leitentscheidung

1. **Abgeschlossene Veranstaltungsdaten:** Drei Jahre ab dem dokumentierten Veranstaltungsabschluss (`closedAt`).
2. **Frühere Löschung:** Der Verein kann die Löschung unmittelbar nach Abschluss oder zu einem früheren Zeitpunkt anweisen, wenn keine weitere organisatorische, vertragliche oder gesetzliche Notwendigkeit besteht.
3. **Vorrang gesetzlicher Fristen:** Steuer-, handels- und vertragsrechtlich erforderliche Unterlagen werden nicht allein wegen des Drei-Jahres-Ablaufs gelöscht. Der jeweilige Verein dokumentiert die Ausnahme und prüft sie mit Buchhaltung oder Steuerberatung.
4. **Keine unbegrenzte Archivierung:** „Abgeschlossen“ oder „archiviert“ ist keine dauerhafte Aufbewahrungsfreigabe.
5. **Tägliche Infrastruktur-Backups:** Datenbank und Upload-Volume werden täglich gesichert und zusätzlich in Hetzner Object Storage abgelegt. Die Rotation ist auf sieben Wiederherstellungspunkte begrenzt; Sicherungen dienen ausschließlich der Wiederherstellung.

## 2. Datenklassen und Fristen

| Datenklasse                                                                  |                             Regel-Frist | Startpunkt                    | Ausnahme / Vorrang                                                    | Löschweg                                                  | Umsetzung im Pilot                                                |
| ---------------------------------------------------------------------------- | --------------------------------------: | ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Aktive Planungsdaten                                                         |             bis Veranstaltungsabschluss | Ende der Nutzung              | laufende Planung oder dokumentierter Zweck                            | fachliche Löschung durch Verein                           | in App verfügbar                                                  |
| Geschlossene Event-, Helfer-, Ansprechpartner-, Schicht- und Aufgabenplanung |                                 3 Jahre | `closedAt` des Events         | frühere Vereinsweisung; Legal Hold; nachgewiesene gesetzliche Pflicht | vollständige Löschung des Events samt abhängigen Daten    | **stündliche technische Automatisierung**                         |
| Standort-, GPX- und zugehörige Uploaddaten                                   |                                 3 Jahre | `closedAt` des Events         | frühere Vereinsweisung; zwingender Nachweiszweck                      | Datenbankreferenz und physische Datei gemeinsam entfernen | **stündliche Eventbereinigung inklusive physischer Löschung**     |
| Freiwillige Spenden- und Übergabeinformationen                               |                                 3 Jahre | `closedAt` des Events         | steuer- oder vertragsrelevante Ausnahme                               | fachliche Löschung mit Event                              | **stündliche technische Automatisierung**                         |
| Persönliche öffentliche PDF-Übersicht                                        |               nur für den Freigabezweck | Linkfreigabe / Eventabschluss | keine                                                                 | Link sperren, generierte PDF nicht dauerhaft speichern    | Sieben-Tage-Laufzeit, Zugangscode und Sofortwiderruf umgesetzt     |
| Einladungs- und Passwort-Reset-Links                                         |         jeweilige technische Gültigkeit | Ausstellung                   | keine                                                                 | Ablauf / Einmalnutzung                                    | technisch vorhanden, regelmäßig testen                            |
| QR-Demo-Herkunftsauswahl                                                     |                keine Neuerhebung | —                             | historische Bestandszeilen bis Ablauf der Altfrist                    | automatisierte Bereinigung                                | Musterdemo ist seit 02.10.2026 speicherfrei                       |
| Teamnotizen                                                                  |                              24 Stunden | Erstellung                    | keine                                                                 | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| kurzlebige Klemmi-Tippstatus                                                 |                              8 Sekunden | Erstellung                    | keine                                                                 | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| Wiederherstellungsprotokolle                                                 | 90 Tage bzw. max. 100 Vorgänge je Scope | Erstellung                    | begründete Sicherheitsuntersuchung                                    | automatisierte Bereinigung                                | technisch umgesetzt                                               |
| Sicherheits-, Login- und Aktivitätsprotokolle                                |                         12 Monate | Erstellung                    | dokumentierte Sicherheitsuntersuchung / Rechtsanspruch                | stündliche regelbasierte Löschung                         | technisch umgesetzt                                               |
| Buchungsbelege und Rechnungen                                                |        grundsätzlich mindestens 8 Jahre | Schluss des Kalenderjahres    | abweichende Spezialpflichten                                          | getrennt und fristgerecht löschen                         | durch Verein / Buchhaltung festlegen                              |
| Bücher, Inventare, Jahresabschlüsse und bestimmte Organisationsunterlagen    |       grundsätzlich mindestens 10 Jahre | Schluss des Kalenderjahres    | abweichende Spezialpflichten                                          | getrennt und fristgerecht löschen                         | durch Verein / Buchhaltung festlegen                              |
| Handels- und Geschäftsbriefe                                                 |                      regelmäßig 6 Jahre | Schluss des Kalenderjahres    | abweichende Spezialpflichten                                          | getrennt und fristgerecht löschen                         | durch Verein / Buchhaltung festlegen                              |

> Die gesetzlichen Fristen sind nur als operative Orientierung aufgeführt. Welche konkreten Daten eines Vereins tatsächlich aufbewahrungspflichtig sind, entscheidet der Verein mit seiner Buchhaltung oder Steuerberatung.

## 3. Monatliche Nachweisprüfung im Pilot

Die technische Löschung läuft stündlich. Der zuständige Vereinsadministrator prüft monatlich deren Nachweisbarkeit und dokumentiert Ausnahmen:

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

## 5. Betrieb der automatisierten Backups

Für **Datenbank** und **Upload-Volume** gelten aktuell folgende Mindestvorgaben:

- Speicherort und Datenregion,
- Verschlüsselung bei Transport und Ablage,
- zugriffsberechtigte Personen,
- Sicherungsintervall, Rotation und maximale Aufbewahrungsdauer,
- RPO und RTO,
- Verfahren für Löschungen in Sicherungen,
- mindestens ein dokumentierter Restore-Test mit nichtproduktiven Daten vor dem breiten Kundenbetrieb.

Ein Backup darf nicht dazu führen, dass bereits zu löschende Planungsdaten unbegrenzt in Sicherungen fortbestehen. Nach Einführung sind die Backup-Frist und die Löschfrist in diesem Dokument und im AVV-Anhang gemeinsam zu aktualisieren.

## 6. Offene technische Folgepunkte

| Punkt | Ziel                                                                                       | Priorität |
| ----- | ------------------------------------------------------------------------------------------ | --------- |
| R5    | Persönliche PDF-Links zeitlich begrenzen, widerrufbar machen und beim Eventschluss sperren | erledigt  |
| R10   | Dreijahresprüfung für geschlossene Events, Logs und Uploads automatisieren                 | technisch umgesetzt (stündlicher Heartbeat + dokumentierte Hold-Ausnahme; operative Logs 12 Monate) |
| R11   | Tägliche DB- und Upload-Backups samt dokumentiertem Restore-Test nachweisen                | hoch      |
| B3    | Physische Datei-Löschung und Orphan-Bereinigung nachweisen                                 | umgesetzt (storageDelete für Event-PDF-Bilder, Standorte & GPX) |
| B4    | Jährlichen Lösch- und Restore-Test dokumentieren                                           | mittel    |
