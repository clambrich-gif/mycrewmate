# MyCrewMate – Runbook für Betroffenenanfragen und Datenschutzvorfälle

**Version 1.0 · Stand 02.10.2026 · Geltung: geschlossener Pilotbetrieb**

> Dieses Runbook ist verbindliche Betriebsanweisung für den Plattformbetrieb. Es ist keine Rechtsberatung. Die Entscheidung über eine Meldung an die Aufsicht oder Betroffene trifft der jeweils datenschutzrechtlich Verantwortliche nach Prüfung des Einzelfalls.

## 1. Zuständigkeiten

| Rolle | Person / Kontakt | Aufgabe |
| --- | --- | --- |
| Plattformbetreiber und Erstkontakt | Christian Lambrich · info@mycrewmate.de | Triage, technische Sicherung, Dokumentation, Unterstützung des Vereins |
| Vertretung bei Abwesenheit | **Vor breitem Kundenbetrieb schriftlich benennen** | Übernimmt Erstreaktion, Fristenkontrolle und Dokumentation |
| Verantwortlicher für Planungsdaten | Jeweiliger Verein | Rechtsgrundlage, Betroffenenkommunikation, Entscheidung zu Art. 33/34 DSGVO |
| Auftragsverarbeiter | MyCrewMate | Unverzügliche Information und technische Unterstützung nach Art. 28 Abs. 3 lit. f DSGVO |

## 2. Betroffenenanfragen (DSAR)

### Eingang und Frist

| Schritt | Vorgabe |
| --- | --- |
| Eingang | Anfragen an info@mycrewmate.de sofort als „DSAR“ registrieren und Eingangszeit erfassen. |
| Zuständigkeit | Geht es um Helfer-/Planungsdaten, den Verein als Verantwortlichen unverzüglich einbeziehen; MyCrewMate unterstützt technisch. Plattformdaten bearbeitet MyCrewMate selbst. |
| Frist | Grundsätzlich innerhalb eines Monats nach Art. 12 Abs. 3 DSGVO beantworten. Fristverlängerung nur nach dokumentierter Prüfung und rechtzeitiger Information. |
| Identitätsprüfung | Nur wenn angemessene Zweifel bestehen: datensparsame, verhältnismäßige Bestätigung anfordern. Keine Ausweiskopie ohne besonderen Grund. |
| Kommunikationskanal | Antwort nur an nachvollziehbar verifizierten Kontakt; keine Auskunft über offene Chatkanäle oder fremde E-Mail-Adressen. |

### Datenquellen-Checkliste

1. Nutzer-/Vereinsadministrationskonto, Rollen und Sitzungen.
2. Verein, Event, Ansprechpartner, Helfer, Aufgaben, Schichten, Material, Standort-/GPX- und Finanzplanungsdaten im passenden Mandanten.
3. Geschützte PDF-Freigaben und Widerrufe.
4. Sicherheits-, Aktivitäts-, Import-/Export- und Löschprotokolle innerhalb der geltenden Frist.
5. Vertragsannahmen und transaktionale Kommunikationsnachweise.
6. Sicherungen nur dann, wenn eine Wiederherstellung für die Beantwortung zwingend erforderlich ist; Wiederherstellung ausschließlich isoliert und danach wieder löschen.

### Mindestregister für jede Anfrage

| Feld | Inhalt |
| --- | --- |
| Vorgangs-ID | Eindeutige Kennung |
| Eingang / Frist | Zeitstempel, Monatsfrist, eventuelle Verlängerung |
| Antragstellende Person | Minimal erforderliche Identitätsdaten |
| Zuständiger Verein | Falls Mandantendaten betroffen |
| Anliegen | Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung, Datenübertragbarkeit |
| Identitätsprüfung | Nicht erforderlich / Art und Ergebnis |
| Datenquellen und Ergebnis | Durchsuchte Systeme und Ergebnis |
| Entscheidung | Erledigt, teilweise erledigt, abgelehnt mit Begründung |
| Antwort / Abschluss | Versandzeitpunkt und verantwortliche Person |

## 3. Datenschutzvorfälle

### Auslöser

Dieses Runbook ist anzuwenden bei möglichem unbefugtem Zugriff, fehlgeleiteter E-Mail, verdächtigem Login, verlorener Zugangsmöglichkeit, falsch freigegebener PDF, Fremdzugriff auf Mandantendaten, Malware, kompromittiertem Passwort oder Sicherheitslücke.

### Sofortmaßnahmen in den ersten 30 Minuten

1. **Nicht vertuschen, nicht löschen:** Zeitpunkt, Beobachtung, betroffene Systeme und Handlungen sichern.
2. **Eindämmen:** Betroffenen PDF-Link widerrufen; Zugang sperren bzw. Sitzung widerrufen; bei Bedarf Planungsteam-Notfallstopp nutzen; Passwort zurücksetzen.
3. **Umfang abgrenzen:** Mandant, Event, Datenarten, Zeitraum, mögliche Empfänger und betroffene Personen bestimmen.
4. **Sicher kommunizieren:** Keine personenbezogenen Details in ungeschützte Messenger oder frei zugängliche Tickets schreiben.
5. **Verein informieren:** Bei Mandantendaten ohne unangemessene Verzögerung die vereinbarte Vereinsansprechperson informieren.

### Entscheidung und Fristen

| Frage | Zuständigkeit / Frist |
| --- | --- |
| Ist ein personenbezogener Datenschutzvorfall wahrscheinlich? | Plattformbetreiber dokumentiert technische Tatsachen; Verein bewertet als Verantwortlicher mit Unterstützung. |
| Muss die Aufsicht informiert werden? | Verein prüft Art. 33 DSGVO; bei Meldepflicht grundsätzlich binnen 72 Stunden ab Kenntnis. |
| Müssen Betroffene benachrichtigt werden? | Verein prüft Art. 34 DSGVO; MyCrewMate liefert technische Informationen und Textentwurf. |
| Muss der Vorfall auch ohne Meldung dokumentiert werden? | Ja, jedes Ergebnis mit Risikoabwägung und Maßnahmen im Incident-Register festhalten. |

### Mindestregister für jeden Vorfall

| Feld | Inhalt |
| --- | --- |
| Incident-ID / Entdeckung | Eindeutige Kennung und Zeitstempel |
| Meldende Person / System | Quelle ohne unnötige Zusatzdaten |
| Betroffener Verein / Event | Scope des Vorfalls |
| Daten und Personengruppen | Kategorien, Menge/Größenordnung soweit bekannt |
| Ursache / Angriffsweg | Tatsachen und noch offene Annahmen trennen |
| Eindämmung | Sperrung, Widerruf, Reset, Patch, Sicherung |
| Information an Verein | Zeitpunkt, Empfänger, Kurzinhalt |
| Bewertung Art. 33/34 | Verantwortliche Person, Ergebnis, Begründung |
| Abschluss / Lessons learned | dauerhafte Maßnahme, Test, Verantwortliche Person |

## 4. Übung und Nachweis

- **Vor breitem Kundenbetrieb:** Ein Tabletop-Fall „geschützter Team-PDF-Link versehentlich weitergegeben“ wird vollständig durchgespielt.
- **Ergebnis:** Laufzeit, gewählte Sperrmaßnahmen, Kommunikationsweg und Verbesserungen werden im Incident-Register festgehalten.
- **Wiederholung:** jährlich sowie nach jeder schwerwiegenden Sicherheitsänderung.

## 5. Bereits verfügbare Produktfunktionen

- Sofortwiderruf geschützter PDF-Freigaben.
- Automatischer Widerruf eventbezogener Freigaben beim Veranstaltungsabschluss.
- Sperrung von Planungsteam-Zugängen und Widerruf bestehender Sitzungen.
- Auditfilter für Freigaben, Zugänge und Dateiexporte.
- Downloadbare Vorlagen für Betroffenenanfragen und Datenschutzvorfälle unter **Schutz & Protokolle**.
