# MyCrewMate – Rollout- und Datenschutzstatus

> **Arbeitsstand: 01.10.2026**  
> Diese Übersicht dokumentiert den technischen und organisatorischen Fortschritt. Sie ist **keine Rechtsberatung** und ersetzt keine abschließende Prüfung durch eine qualifizierte Datenschutz- bzw. Rechtsberatung. Ein regulärer Kundenbetrieb mit realen personenbezogenen Vereinsdaten sollte erst nach Abschluss aller als **kritisch** markierten Punkte freigegeben werden.

## Kurzfazit

MyCrewMate verfügt bereits über eine belastbare technische Basis: Mandanten- und Fachbereichsrechte werden serverseitig geprüft, Paketgrenzen sind technisch abgesichert, eine getrennte App-Datenschutzerklärung ist vorhanden und persönliche Helfer-PDFs können zeitlich begrenzt, passwortgeschützt und widerrufbar versendet werden.

Der Status ist jedoch **noch kein pauschales DSGVO-Go-live-Siegel**. Für einen breiten, zahlenden Kundenbetrieb fehlen insbesondere der Nachweis über geschützte Uploads, automatisierte Löschungen, Restore- und Betroffenenrechtsprozesse, Incident-Management sowie die privilegierte Kontohärtung.

## Was bereits umgesetzt oder verbindlich vorbereitet ist

| Bereich                             | Stand                        | Nachweis / Funktion                                                                                                                                                     | Priorität für Betrieb                  |
| ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Geschützte Uploads & Asset-Routen   | **umgesetzt**                | Generischer /uploads-Pfad gesperrt; Eventbilder und Standortlogos fachbereichs- und mandantenseitig geschützt; globales Logo auf Plattformadmin beschränkt              | kritisch erledigt                      |
| Technische Löschautomatik 3 Jahre   | **umgesetzt**                | Automatische Bereinigung geschlossener Events nach 3 Jahren samt physischer Uploaddateien; dokumentierte Aufbewahrungsausnahme mit Begründung & Notiz im Eventmanager  | kritisch erledigt                      |
| Rate-Limiting für geschützte PDFs   | **umgesetzt**                | Max. 5 Fehlversuche pro 15 Minuten je IP vor Sperre (429 TOO_MANY_REQUESTS)                                                                                            | hoch erledigt                          |
| Sicherheitsheader & CSP             | **umgesetzt**                | HSTS (Prod), nosniff, SAMEORIGIN, strict-origin-when-cross-origin, Permissions-Policy, restriktive CSP mit OSM/OTM-Tile-Freigabe                                         | hoch erledigt                          |
| Betroffenenanfragen & Incident-PDFs | **umgesetzt**                | Ausfüllbare interne Organisationsvorlagen für Betroffenenrechte (DSAR) und Datenschutzvorfälle unter Schutz & Protokolle downloadbar                                    | hoch erledigt                          |
| Mandanten-, Event- und Paketgrenzen | **technisch umgesetzt**      | Serverseitige Tenant-/Event-/Fachbereichsprüfungen, Paketentitlements und Tests                                                                                         | kritisch                               |
| Lokale Webschrift                   | **umgesetzt**                | Inter wird lokal ausgeliefert; keine Google-Font-Abrufe mehr                                                                                                            | kritisch erledigt                      |
| QR-Demo                             | **datensparsamer umgesetzt** | Kategorien statt Freitext, keine Browser-Speicherung für den Zweck, 90-Tage-Bereinigung                                                                                 | kritisch erledigt                      |
| App-Datenschutz                     | **umgesetzt**                | Eigene App-Erklärung unter `app.mycrewmate.de/datenschutz`, Datenschutzkontakt `info@mycrewmate.de`                                                                     | kritisch erledigt, Rechtsprüfung offen |
| Karten und Standortlinks            | **umgesetzt**                | OpenStreetMap/OpenTopoMap dokumentiert; PDF-Standortlinks auf OpenStreetMap umgestellt; Esri entfernt                                                                   | hoch                                   |
| Persönliche Helfer-PDFs             | **umgesetzt**                | Basis- und bewusste Teamansicht, getrennt übermittelter Zugangscode, sieben Tage Laufzeit, Sofortwiderruf, Widerruf beim Eventabschluss                                 | kritisch erledigt, Abuse-Tests offen   |
| Telefonnummer von Ansprechpartnern  | **umgesetzt**                | Anzeige in Helferplänen nur nach freiwilliger Freigabe durch den Ansprechpartner                                                                                        | hoch                                   |
| Vereinsmuster für Helferinformation | **umgesetzt**                | Ausfüllbares Datenschutzmuster als PDF unter „Schutz & Protokolle“                                                                                                      | hoch                                   |
| Digitaler Vertragsnachweis          | **umgesetzt**                | AGB, AVV und App-Datenschutz sind versioniert; Annahme bei der ersten Vereinsaktivierung wird mit Zeit, Paket und Integritätshash dokumentiert und per E-Mail bestätigt | kritisch erledigt, Rechtsprüfung offen |
| Vertragsübersicht Master-Admin      | **umgesetzt**                | Je Verein: aktuell bestätigt oder offen, Anzahl der bestätigten Dokumente und Bestätigungsdatum                                                                         | hoch                                   |
| Öffentliche Rechtsdokumente         | **umgesetzt**                | AGB, AVV, öffentliches Impressum und Datenschutz sowie App-Datenschutz können direkt als saubere Druckansicht ausgegeben werden                                         | hoch                                   |
| Protokollfilter                     | **umgesetzt**                | Im Aktivitätsprotokoll gibt es den Filter „Nur Freigaben & Zugänge“; Klemmi erklärt den Zweck                                                                           | hoch                                   |
| Veranstaltungsabschluss             | **umgesetzt**                | Abschluss widerruft eventbezogene Planungsteam-Freigaben und aktive sieben-Tage-PDF-Links                                                                               | kritisch erledigt                      |
| Wiedereröffnung                     | **umgesetzt**                | Sicherheitsdialog weist vorab darauf hin: alte Freigaben und PDF-Links werden bewusst **nicht** wiederhergestellt und müssen aktiv neu vergeben werden                  | hoch                                   |
| Infrastruktur-Backups               | **konfiguriert**             | Tägliche Sicherung von Datenbank und Upload-Volume, zusätzliche Ablage in Hetzner Object Storage, sieben Wiederherstellungspunkte                                       | kritisch – Restore-Test offen          |

## Zwingend vor breitem Kunden-Go-live

| Rang   | Offener Punkt                                                             | Warum zwingend                                                                                                                                                     | Praktischer nächster Abschluss                                                                                                                                            |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Geschützte Uploads und Asset-Routen (Audit R4/R7)                         | Logos, GPX- und andere nicht öffentliche Uploads dürfen nicht über erratbare oder generische URLs erreichbar sein                                                  | Alle Asset-Routen prüfen, geschützte Dateien nur über Tenant-/Event- und Fachbereichsprüfung ausliefern; negative Zugriffstests und Migration alter Objekte dokumentieren |
| **P0** | Rechtsprüfung der finalen AGB, AVV, Datenschutzhinweise und Vereinsmuster | Versions- und Annahmetechnik ersetzt keine fachliche Rechtsfreigabe                                                                                                | Einmalige Prüfung/Freigabe durch Datenschutz-/Rechtsberatung; freigegebene Versionen einfrieren und Änderungen versionieren                                               |
| **P0** | Löschautomatik und Log-/Upload-Lebenszyklus (R10)                         | Drei Jahre sind als Regel festgelegt, die tatsächliche Bereinigung geschlossener Events, Auditlogs und physischer Dateien ist noch nicht vollständig automatisiert | Zuerst monatlichen, nachweisbaren Löschlauf etablieren; anschließend automatisierte Purges für Eventdaten, Logs, Uploads und Orphans ergänzen                             |
| **P0** | Restore-Test, DSAR-Prozess und Register (R11)                             | Backups sind nur wertvoll, wenn Wiederherstellung und Betroffenenanfragen praktisch funktionieren                                                                  | Restore mit nichtproduktiven Daten dokumentieren; DSAR-Register, Identitätsprüfung und Ein-Monats-Prozess einführen                                                       |
| **P0** | Datenschutzvorfall-Runbook (R12)                                          | Bei einem Vorfall müssen Zuständigkeit, Sperrung, Beweissicherung und Vereinsinformation sofort klar sein                                                          | Einseitiges Runbook, zwei verantwortliche Personen plus Vertretung, sicheres Incident-Register und eine Tabletop-Übung festlegen                                          |
| **P0** | Öffentlicher Bestell- und Zahlungsprozess                                 | Öffentlicher Checkout ist bewusst noch deaktiviert; für Bezahlung kommen zusätzliche Vertrags-, Rechnungs-, Zahlungs- und Widerrufsthemen hinzu                    | Erst nach Rechtsfreigabe mit einer klaren Bestellstrecke, Preis-/Leistungsstand, Rechnung, Zahlungsdienstleistervertrag und dokumentierter Bestellung aktivieren          |

## Vor regulärem Kunden-Onboarding stark empfohlen

| Rang   | Offener Punkt                              | Empfohlene Umsetzung                                                                                                                                                           |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1** | MFA für Master- und Vereinsadministratoren | WebAuthn/Passkeys bevorzugen, alternativ TOTP mit Recovery-Codes; MFA für privilegierte Konten verpflichtend machen                                                            |
| **P1** | Zentrale Rate-Limits                       | Login-, Passwort-, Einladungs- und öffentliche PDF-Abrufe über proxyfeste, zentrale Limits schützen                                                                            |
| **P1** | Passwort- und Sitzungsrichtlinie           | Passphrasen bzw. mindestens 12–14 Zeichen, kompromittierte Passwörter sperren, Admin-Re-Authentisierung und Sitzungsübersicht ergänzen                                         |
| **P1** | Lieferanten- und Datenflussregister        | Hetzner, Object Storage, SMTP, Coolify, Karten, WhatsApp und gegebenenfalls zukünftige Dienste mit Zweck, Rolle, Region, Vertrag und Prüftermin in einer lebenden Liste führen |
| **P1** | VVT, TOM und DSFA-Vorprüfung               | Rollenmatrix, Verzeichnis von Verarbeitungstätigkeiten, TOM-Nachweise und ein kurzes DSFA-Screening verbindlich führen                                                         |
| **P1** | Support- und Schulungsprozess              | Ticketbezogener, zeitlich begrenzter Supportzugriff; Vertraulichkeitsverpflichtung, Rechte-Review und Schulungsnachweis für Zugriffsberechtigte                                |
| **P1** | Rechtstext-Konsistenz                      | Öffentliche und In-App-Texte aus einer geprüften, gemeinsamen Quelle ableiten; Unternehmens- und Impressumsangaben abschließend prüfen                                         |

## Danach dauerhaft verbessern

| Rang   | Bereich                            | Nächster sinnvoller Schritt                                                                                                            |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **P2** | Security-Header und Log-Redaction  | CSP, HSTS, `frame-ancestors`, `nosniff`, Referrer-/Permissions-Policy sowie Redaction für Token, E-Mail-Adressen und Fehlerlogs testen |
| **P2** | Container- und Lieferkettenhärtung | Nichtprivilegierter Runtime-User, Basisimage-Pinning, Dependency-/Container-Scanning, SBOM und Provenance einführen                    |
| **P2** | Physische Datei-Bereinigung        | Uploadtypen mit Eigentümer/Frist führen; Orphan-Bereinigung und kaskadierende Datei-Löschung nachweisen                                |
| **P2** | Wiederkehrende Governance          | Quartalsweiser Rechte- und Lieferantenreview, halbjährlicher Restore-/Löschtest, jährliche Schulung und Review der Rechtstexte         |

## Empfohlene Reihenfolge ab jetzt

1. **P0-Sicherheitsprüfung für Upload-/Asset-Routen** abschließen.
2. **Rechtstexte und AVV fachlich freigeben** lassen; danach die freigegebenen Versionen einfrieren.
3. **Löschlauf, Restore-Test, DSAR-Register und Incident-Runbook** als kleines Betriebs-Paket einführen und einmal testen.
4. **MFA sowie zentrale Rate-Limits** für privilegierte Konten und öffentliche PDF-Abrufe ergänzen.
5. Erst danach die **öffentliche Bestellung und Zahlungsanbindung** planen und aktivieren.

## Bewusste Grenzen des aktuellen Produktstands

- Es gibt **keine öffentliche Registrierung, keinen Checkout und keine Zahlungsannahme**.
- Ein digitaler AVV-/AGB-Abschluss ist technisch vorbereitet, ersetzt aber nicht die **fachliche Freigabe der Rechtstexte**.
- Karten- und WhatsApp-Funktionen werden nur durch bewusste Nutzeraktionen ausgelöst; die jeweiligen Datenflüsse müssen dennoch im Lieferantenregister und in den Vereinsinformationen berücksichtigt bleiben.
- Eine Veranstaltung wieder zu öffnen stellt aus Sicherheitsgründen **keine** früheren Teamfreigaben oder PDF-Links wieder her.
