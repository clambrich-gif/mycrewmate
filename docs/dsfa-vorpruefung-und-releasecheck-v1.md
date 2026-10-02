# MyCrewMate – DSFA-Vorprüfung und Datenschutz-Releasecheck

**Version 1.0 · Stand 02.10.2026**

> Diese Vorprüfung dokumentiert, dass eine Datenschutz-Folgenabschätzung (DSFA) nach Art. 35 DSGVO zum aktuellen geschlossenen Pilotbetrieb geprüft wurde. Sie ersetzt keine DSFA, wenn sich Risiko, Umfang oder Art der Verarbeitung wesentlich ändern.

## 1. Ergebnis der Vorprüfung

| Prüfkriterium | Bewertung im aktuellen Pilot | Ergebnis |
| --- | --- | --- |
| Systematische und umfassende Bewertung persönlicher Aspekte mit automatisierten Entscheidungen | Keine Profilbildung, kein Scoring, keine automatisierten Entscheidungen mit rechtlicher/vergleichbar erheblicher Wirkung | Kein DSFA-Trigger erkennbar |
| Verarbeitung besonderer Kategorien in großem Umfang | Nicht vorgesehen; Freitextfelder dürfen hierfür nicht verwendet werden | Kein DSFA-Trigger bei eingehaltenem Zweck |
| Systematische Überwachung öffentlich zugänglicher Bereiche in großem Umfang | Nicht vorhanden | Kein DSFA-Trigger |
| Umfangreiche Verarbeitung von Kontaktdaten vieler Helfer | Möglich, aber mandantenbezogen; Zugriff ist rollenbasiert und keine öffentliche Veröffentlichung vorgesehen | Beobachten; bei starkem Wachstum neu bewerten |
| Orts-/Streckeninformationen | Optional, überwiegend veranstaltungsbezogen; Kartenabruf nur bewusst ausgelöst | Beobachten; bei Echtzeit-/Personentracking neu bewerten |
| Öffentliche Freigabe von Helferdaten | Nur begrenzte PDF-Ansichten mit Code, Laufzeit und Widerruf; Teamansicht bewusst auswählbar | Restrisiko reduziert; Schutzmechanismen laufend testen |

**Vorläufiges Ergebnis:** Für den beschriebenen Pilotbetrieb ist keine DSFA zwingend dokumentiert. Die Entscheidung ist spätestens jährlich und vor jeder der folgenden Änderungen neu zu bewerten.

## 2. Neubewertung zwingend bei

- öffentlicher Registrierung, Checkout oder Zahlungsdienstleister,
- Marketing-/Analyse-Tracker, Newsletter oder CRM-Integration,
- Foto-/Videofunktionen mit Personenbezug,
- Echtzeit-Standortdaten oder Personen-Tracking,
- KI-gestützter Bewertung/Profilbildung von Helfern,
- Verarbeitung besonderer Kategorien oder umfangreicher Datenmengen,
- neuen Datenübermittlungen außerhalb des bisherigen Kernbetriebs in Deutschland,
- sicherheitsrelevantem Vorfall mit hohem Risiko.

## 3. Datenschutz-Releasecheck

| Prüffrage | Ja/Nein | Nachweis vor Veröffentlichung |
| --- | --- | --- |
| Verarbeitet die Funktion neue personenbezogene Daten oder neue Empfänger? |  | VVT und Datenschutzhinweis aktualisiert |
| Greift die Funktion auf Browser-Speicher, Cookies oder Gerätekennungen zu? |  | TDDDG-Bewertung dokumentiert; Einwilligung nur falls erforderlich |
| Kommt ein externer Dienst hinzu? |  | Lieferantenregister, Vertrag/Rolle, Datenregion und Datenschutzhinweis geprüft |
| Werden Rechte, Exporte, Uploads oder Freigaben erweitert? |  | Serverseitige Autorisierung und Negativtests vorhanden |
| Gibt es eine neue Löschfrist oder ein neues Backup? |  | Löschkonzept, Code und AVV synchron |
| Sind Texte, UI und tatsächliches Verhalten identisch? |  | Produkt-/Datenschutz-Texttest durchgeführt |
| Wurde ein Sicherheits- und Datenschutztest ausgeführt? |  | Typecheck, relevante Tests, vollständige Suite, Produktionsbuild und Live-Smoke-Test dokumentiert |

## 4. Freigabeprotokoll

| Feld | Inhalt |
| --- | --- |
| Release / Commit |  |
| Fachliche Änderung |  |
| Datenschutzcheck durch |  |
| Datum |  |
| Offene Restrisiken |  |
| Entscheidung | freigegeben / nur Pilot / zurückgestellt |

## 5. Aktueller festgestellter Schutzstand

- Keine öffentlichen Analyse- oder Werbetracker im Produktauftritt.
- Lokale Inter-Schrift; keine Google-Fonts-Anfrage.
- QR-Vereinsdemo enthält nur fiktive Daten und löst keine Demo-Datenerhebung aus.
- Kerninfrastruktur und Sicherungen nach aktueller Betriebsdokumentation in Deutschland.
- Eventabschluss, Löschautomatik, Aufbewahrungsausnahmen, zeitlich begrenzte PDF-Freigaben und Asset-Schutz sind implementiert.
- Vor breitem Kundenbetrieb verbleiben der dokumentierte Restore-Test, benannte Incident-Vertretung und externe Rechtsfreigabe der finalen Texte.
