# System-Audit: Excel-Export, -Import und Datenintegrität

**Prüfdatum:** 18. September 2026  
**Umfang:** Ansprechpartner, Helfer, Einsatzplan, Vorbereitung, Nachbereitung, Material, Marketing, Genehmigungen, Kuchen und Finanzen  
**Ergebnis:** **Bestanden – zwei Befunde wurden während des Audits korrigiert.**

## Testansatz

Der Audit verwendete eine **vollständig isolierte Testveranstaltung im Jahr 2099**. Sie enthielt Ansprechpartner einschließlich automatisch verknüpfter eigener Helfereinträge, Helfer mit ganztägiger und zeitlich begrenzter Verfügbarkeit, flexible Schichten, eine manuell bestätigte zeitliche Unterdeckung, eine akzeptierte Doppelbelegung sowie Datensätze in allen weiteren Fachbereichen.

Die Testveranstaltung und die dabei erzeugten Importprotokolle wurden nach erfolgreichem Test vollständig gelöscht. Eine anschließende Datenbankprüfung bestätigte, dass **keine Audit-Veranstaltung und keine Audit-Protokolle** zurückgeblieben sind.

## Geprüfte Prozesskette

| Prüfbereich | Durchgeführter Test | Ergebnis |
|---|---|---|
| Gesamtexport | Projektübersicht mit allen zehn Datenblättern erstellt und auf vorhandene Blätter geprüft | Bestanden |
| Helferdaten | Tageswerte Fr/Sa/So, individuelle Von-/Bis-Zeiten, Ansprechpartner, Telefonnummer, PDF-Hinweis, Begleitinformation und Bestätigung exportiert | Bestanden |
| Einsatzplan | Beginn/Ende, Bedarf, flexible Belegung, beide manuellen Freigaben, Bereichskontakt und Helfer-Slots exportiert | Bestanden |
| Excel-Zeitwerte | Reale `HH:MM`-Werte und Zeitfenster im Excel-Import verarbeitet | Bestanden |
| Dominanter Gesamtimport | Änderungen, Neuanlagen und Löschungen in allen Fachbereichen in einem Import übernommen | Bestanden |
| Kaskadenbereinigung | Entfernte Helferzeile aus zugehörigem Einsatzplan-Slot entfernt; kein verwaister Bezug blieb zurück | Bestanden |
| Zeitliche Unterdeckung | Eine flexible Schicht mit Teilzeit-Helfer wurde nach geänderter Verfügbarkeit korrekt als `KNAPP 🕒` ausgewertet | Bestanden |
| Doppelbelegung | Drei bewusst überlappende Zuweisungen wurden angenommen, als Warnung erhalten und unmittelbar gezählt | Bestanden |
| Roundtrip | Importierten Stand erneut exportiert, geparst und inhaltlich gegen den Datenbankstand verglichen | Bestanden, 0 Folgeänderungen |
| Modularer Import | Anschließender Helfer-Modulimport mit geänderter Startzeit durchgeführt | Bestanden |

## Simulierte Änderungen im dominanten Import

Der Excel-Import behandelte die hochgeladene Datei als Zielstand. Im Durchlauf wurden ein Ansprechpartner und sieben Fachdatensätze geändert, ein neuer Helfer und eine neue Konfliktschicht angelegt sowie ein Helfer mitsamt seiner Einsatzzuweisung gelöscht. Insgesamt ergab die geprüfte Vorschau **3 Neuanlagen, 11 Änderungen und 2 Löschungen**.

Die gelöschte Helferzuweisung wurde vor der Wiederherstellung bereinigt. Die neu erzeugten Doppelbelegungen blieben bewusst erhalten und wurden als Warnungen ausgewiesen; sie blockierten den Import nicht. Damit entspricht das Verhalten der vorgesehenen Planungslogik: Konflikte werden transparent bewertet, nicht stillschweigend verworfen.

## Korrigierte Befunde

| Befund | Ursache | Korrektur |
|---|---|---|
| Die Spalte **„Doppelbelegung akzeptiert“** war als Datenwert vorhanden, jedoch nicht Teil der verbindlichen Reihenfolge der Einsatzplan-Kopfzeilen. | Der Feldname fehlte in `PROJECT_EXCEL_HEADERS.EINSATZPLAN`. | Die Spalte ist jetzt verbindlich direkt nach **„Manuell als OK bestätigt“** geführt. Dadurch bleibt sie im Gesamt- und Modul-Export sichtbar, in korrekter Reihenfolge und importierbar. |
| Manuelle Freigaben konnten bei einer Änderung per Excel an einer betroffenen Schicht hängen bleiben. | Die Rücksetzlogik war für interaktive Änderungen vorhanden, wurde beim Excel-Zielstand jedoch nicht durchgängig erzwungen. | Vor Vorschau **und** endgültiger Wiederherstellung werden betroffene manuelle Freigaben nun zurückgesetzt, wenn sich Schichtgrunddaten, Slot-Zuweisungen oder die für die Schicht relevante Helferverfügbarkeit ändern. Die Importwarnung benennt die Rücksetzung transparent. |
| Die interne, kompatible Sicherungs-Excel enthielt nicht alle Veranstaltungsmetadaten. | Die Legacy-Sicherungsfunktion schrieb nur einen verkürzten Metadatensatz. | Aktive Veranstaltungstage und PDF-Bildkonfiguration werden nun vollständig mitgeführt, sodass auch dieser geprüfte Backup-Parser den vollständigen Projektstand konsistent abbildet. |

> **Wichtige Einordnung:** Die sichtbare Seite „Excel-Projektübersicht“ dient weiterhin als Dokumentation; der produktive Gesamtstand wird über „Speichern/Laden“ als Projektdatei gesichert. Excel-Änderungen werden produktiv bereichsweise über den jeweiligen Modulimport übernommen. Der Audit hat zusätzlich den vorhandenen vollständigen, parserkompatiblen Excel-Roundtrip getestet, um die Datenmatrix bereichsübergreifend abzusichern.

## Validierung

Die ergänzten Regressionstests prüfen die neue verbindliche Spalte sowie das Zurücksetzen manueller Freigaben bei importierten Zeitfensteränderungen. Die abschließende technische Validierung war vollständig erfolgreich:

| Prüfung | Ergebnis |
|---|---|
| Vitest | **369 Tests bestanden**, 1 bestehender Test bewusst übersprungen |
| TypeScript | `pnpm check` erfolgreich |
| Produktionsbuild | `pnpm build` erfolgreich |
| Drizzle-Schemaabgleich | `pnpm exec drizzle-kit check` erfolgreich |
| Git-Diff-Prüfung | `git diff --check` ohne Fehler |

## Fazit

Der Excel-Datenpfad übernimmt geprüfte Änderungen jetzt robust als dominanten Zielstand, bereinigt gelöschte Verknüpfungen, akzeptiert fachliche Warnkonstellationen wie Doppelbelegungen und zeitliche Unterdeckung und berechnet den Einsatzplanstatus anschließend konsistent neu. Die beiden manuellen Freigaben bleiben nur so lange bestehen, wie die geprüfte Ausgangslage unverändert ist.
