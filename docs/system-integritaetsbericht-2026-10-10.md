# System-Integritätstest – MyCrewMate

**Prüfzeitpunkt:** 10.10.2026  
**Geltungsbereich:** Quellcode, Tests, Datenmodell, aktive Vereinsdaten, Zugriffsgrenzen, öffentliche Erreichbarkeit und Produktionsabhängigkeiten.

> **Kurzfazit:** Die geprüften Kernfunktionen und die Datenstruktur sind konsistent. Der aktive RSC-Verein enthält genau die zwei gewünschten Veranstaltungen inklusive ihrer Zeiträume. Die reguläre Testreihe, Typprüfung, Produktionsbuild und Migrationsprüfung sind erfolgreich. Zwei externe Bibliotheksrisiken bleiben beobachtungsbedürftig; sie sind unten transparent beschrieben.

## 1. Geprüfte Daten des aktiven RSC-Vereins

Für den einzigen relevanten laufenden Verein `rsc-eifelland-mayen` wurden die gespeicherten Veranstaltungen direkt in der Datenbank geprüft.

| Veranstaltung | Jahr | Gespeicherter Zeitraum | Status |
|---|---:|---|---|
| Weihnachtsfeier | 2026 | 12.12.2026 | aktiv |
| MyEifelRide | 2027 | 11.06.2027–13.06.2027 | aktiv |

Zusätzlich wurde geprüft:

- **0 verwaiste Veranstaltungen:** Jede vorhandene Veranstaltung gehört zu einem existierenden Verein.
- Es wurden keine alten RSC-Veranstaltungen oder Archivvereinsreste im aktiven RSC-Kontext gefunden.
- Die Daten für MyEifelRide liefern damit wieder eine vollständige Grundlage für den Countdown.

## 2. Automatisierte Funktionsprüfung

| Prüfung | Ergebnis |
|---|---|
| Vollständige sichere Testreihe | **983 Tests bestanden** |
| Bewusst übersprungene Tests | 6 Tests in 5 Dateien |
| TypeScript-Prüfung | **bestanden** |
| Produktionsbuild | **bestanden** |
| Drizzle-Migrationsprüfung | **bestanden** |
| Git-Objektprüfung | **bestanden** |
| Diff-/Formatprüfung | **bestanden** |

### Bewusst nicht automatisch ausgeführte Tests

Einige Tests erzeugen echte Kontakte, Helfer, Zugänge oder Chatnachrichten. Damit ein normaler Testlauf niemals versehentlich Planungsdaten verändert, laufen diese nur noch mit der ausdrücklichen Umgebungsfreigabe `RUN_DATABASE_E2E=1` gegen eine separate Testdatenbank.

Das ist eine Schutzmaßnahme und kein Funktionsverlust der App.

## 3. Zugriffs- und Live-Prüfung

| Ziel | Ergebnis |
|---|---|
| `https://mycrewmate.de/` | erreichbar (HTTP 200) |
| `https://app.mycrewmate.de/` | erreichbar (HTTP 200) |
| `https://admin.mycrewmate.de/` | erreichbar (HTTP 200) |
| Anonyme Abfrage geschützter Veranstaltungsdaten | korrekt abgewiesen (HTTP 401) |

Damit sind öffentliche Website, App und Master-Portal erreichbar, während Veranstaltungsdaten ohne Anmeldung nicht ausgeliefert werden.

## 4. Aktualisierte Sicherheitsbibliotheken

Folgende direkt verwendete Bibliotheken wurden auf verfügbare Sicherheitsstände aktualisiert und anschließend vollständig getestet:

| Bereich | Aktualisiert auf |
|---|---|
| Webserver / Proxy-Verarbeitung | Express 4.22.3 |
| Anwendungs-API | tRPC 11.19.0 |
| Datenbankzugriff | Drizzle ORM 0.45.4, mysql2 3.24.5 |
| Serverseitige HTTP-Anfragen | Axios 1.20.0 |
| Zufallskennungen | nanoid 5.1.16 |

Außerdem liegt die Paketmanagerkonfiguration jetzt in `pnpm-workspace.yaml`. Dadurch werden die bestehende Wouter-Korrektur und die feste Tailwind-Unterabhängigkeit auch bei späteren Neuinstallationen zuverlässig berücksichtigt. Die frühere, von der aktuellen pnpm-Version nicht mehr gelesene Konfiguration in `package.json` wurde entfernt.

## 5. Verbleibende Sicherheitsbeobachtung

### Excel-Bibliothek `xlsx`

Für die verwendete SheetJS-Bibliothek `xlsx` 0.18.5 meldet der Sicherheitscheck zwei bekannte Warnungen. Der Hersteller stellt für die verwendete Open-Source-Paketlinie derzeit **keinen gepatchten Versionsstand** bereit.

Die Anwendung begrenzt den Import bereits mehrfach:

- nur für berechtigte Nutzerinnen und Nutzer,
- höchstens 15 MB pro Excel-Datei,
- höchstens 1.000 ZIP-Einträge,
- höchstens 100 MB entpackte Daten,
- höchstens 10.000 Zeilen pro Blatt,
- höchstens zwei gleichzeitige Excel-Vorgänge,
- Prüfung beschädigter, verschlüsselter und ZIP64-Dateien vor dem Einlesen.

Diese Grenzen senken das Risiko deutlich, ersetzen aber keinen Bibliothekswechsel. **Empfehlung für einen späteren Wartungstermin:** Excel-Import in einen isolierten Prozess verlagern oder auf eine aktiv gepflegte Parser-Bibliothek umstellen. Bis dahin sollten ausschließlich bekannte und vertrauenswürdige Excel-Dateien importiert werden.

### `brace-expansion` innerhalb der ZIP-Erstellung

Eine weitere Warnung betrifft `brace-expansion` als Unterabhängigkeit von `archiver`. Die derzeitige Archiver-Kette liefert noch Version 5.0.9 aus; ein aktualisierter Archiver-Nachfolger ist nicht verfügbar.

In MyCrewMate wird diese Kette nur genutzt, um serverseitig erzeugte ZIP-/PDF-Ausgaben zu erstellen. Es werden keine von außen hochgeladenen ZIP-Pfade oder Muster an diese Bibliothek übergeben. Das begrenzt die praktische Angriffsfläche, die Warnung bleibt aber für eine spätere Aktualisierung von `archiver` vorgemerkt.

## 6. Nicht sicherheitskritische Wartungshinweise

- Das Entwicklungs-Plugin `@builder.io/vite-plugin-jsx-loc` erwartet offiziell Vite 4 oder 5; die App verwendet Vite 7. Der Produktionsbuild ist erfolgreich. Vor einem späteren großen Vite-Update sollte das Plugin aktualisiert oder ersetzt werden.
- Einige reine Entwicklungsunterabhängigkeiten sind als veraltet markiert. Sie werden nicht in den Produktionscontainer ausgeliefert und blockieren den Betrieb nicht.

## 7. Empfohlene nächste Routine

1. **Quartalsweise:** `pnpm audit --prod`, vollständige Testreihe und Migrationsprüfung erneut ausführen.
2. **Vor größeren Excel-Erweiterungen:** isolierten Excel-Parser oder Bibliothekswechsel entscheiden.
3. **Bei neuen Archiv-/ZIP-Versionen:** `archiver` und dessen Unterabhängigkeiten erneut prüfen.
4. **Vor produktiven Schemaänderungen:** erst Sicherung prüfen, dann Migration und gezielte Datenintegritätsprüfung ausführen.
