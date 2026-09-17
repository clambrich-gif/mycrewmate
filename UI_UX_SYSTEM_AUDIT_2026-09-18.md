# Systemweiter UI/UX-Audit der RSC Helferplanung

**Datum:** 18. September 2026  
**Prüfgegenstand:** MyEifelRide 2027 mit realem Planungsstand  
**Autor:** Manus AI

## Gesamturteil

Die Anwendung bietet für die Planung eines mehrtägigen Radsportfestivals eine **ruhige, konsistente und praxistaugliche Arbeitsoberfläche**. Navigation, Statusfarben, Karten, Dialoge und Formularfelder folgen einer erkennbaren gemeinsamen Gestaltung. Die wichtigsten operativen Themen — offene oder knappe Schichten, Fristen, Helferpotenziale und Rückmeldungen — werden klar priorisiert und verlinken direkt in den passenden Arbeitsbereich.

Die systemweite Prüfung hat **keinen globalen horizontalen Seitenüberlauf** festgestellt. Die für umfangreiche Daten vorgesehenen Tabellen behalten bewusst einen eigenen horizontalen Scrollbereich. Dadurch bleiben die Seiten selbst auf Tablet und Smartphone stabil. Für die operative Arbeit unter Zeitdruck sind die entscheidenden Aktionen gut erreichbar und die komplexen Eingaben sind auf mobilen Geräten als Karten statt als komprimierte Tabellen verfügbar.

## Geprüfte Oberflächen und Geräteklassen

Es wurden zwölf Routen mit dem befüllten MyEifelRide-2027-Planungsstand geprüft. Jede Route wurde auf Desktop, Tablet und Smartphone gerendert. Die Prüfung umfasste Dashboard, Ansprechpartner, Helfer, Einsatzplan, Vorbereitung, Nachbereitung, Material, Kuchen, Finanzen, PDF-Ausgabe, Excel-Projektübersicht und Hilfe.

| Geräteklasse | Auflösung | Prüfumfang | Ergebnis |
|---|---:|---:|---|
| Desktop | 1366 × 768 px | Alle zwölf Seiten, Navigation, Tabellen, Karten und Aktionsleisten | Kein globaler Überlauf; Tabellenköpfe lesbar |
| Tablet | 768 × 1024 px | Alle zwölf Seiten, responsive Zwischenansicht und Aktionsumbruch | Keine abgeschnittenen Bedienelemente |
| Smartphone | 390 × 844 px | Alle zwölf Seiten, Kartenansichten, Filter und Touchaktionen | Einspaltiges Layout, volle Breite der Eingaben und ausreichend große Touchziele |

Die automatisierte Viewport-Prüfung erfasste insgesamt **36 Seiten-Viewport-Kombinationen**. Es wurden **0 globale Überlaufverletzungen** und **0 verbliebene Ladezustände** festgestellt.

## Behobene Punkte

### Einsatzplan: Bereichsansprechpartner kompakt halten

Die Konfiguration „Ansprechpartner je Bereich“ war auf breiten Bildschirmen dauerhaft aufgeklappt. Bei vielen Bereichen nahm sie dadurch wertvolle vertikale Fläche ein und schob die für die tägliche Arbeit wichtigeren Bereiche — Suche, Filter und Schichtliste — nach unten. Die Konfiguration ist nun auf **allen Bildschirmgrößen zunächst kompakt** und lässt sich bei Bedarf über die eindeutig beschriftete Zeile „Ansprechpartner je Bereich · X Bereiche“ aufklappen.

Die Zuordnungen wurden nicht entfernt und bleiben mit einem Klick erreichbar. Die Änderung reduziert den Einstieg in die operative Schichtplanung, ohne Informationen zu verstecken oder Arbeitsabläufe zu verändern.

### Dashboard: Prio-Aktionen optisch ausbalancieren

Die Aktionsleiste „Heute priorisieren“ nutzte auf Desktop immer ein Viererspaltenraster. Wenn nur ein oder zwei Themen akut waren, blieb ein großer Teil der Fläche ungenutzt. Das Raster reagiert jetzt auf die tatsächliche Anzahl akuter Punkte:

| Anzahl akuter Punkte | Desktopdarstellung |
|---:|---|
| 1 | Eine Karte über volle Breite |
| 2 | Zwei gleich breite Karten |
| 3–4 | Viererspaltenraster |

Die fachliche Priorisierung, Reihenfolge und Verlinkung der Aktionen bleiben unverändert. Die Änderung verbessert ausschließlich die Lesbarkeit und Balance der aktuell relevanten Arbeitshinweise.

## Funktionale und visuelle Befunde

### Dashboard und Priorisierung

Das Dashboard ist für einen Eventbetrieb sinnvoll aufgebaut. Akute Themen stehen zuerst, gefolgt von datierten Fristen, tagesbezogener Einsatzbereitschaft, Rückmeldequote und Erstkontakt-Quote. Der direkte Übergang aus Kennzahl oder Frist in die gefilterte Fachansicht reduziert Suchaufwand. Die Ampelfarben bleiben zurückhaltend eingesetzt: Grün steht für bestätigte beziehungsweise vollständige Zustände, Gelb und Orange für prüfbare Risiken, Rot für dringende Ausfälle oder Ablehnungen.

### Helferkartei und Einsatzplan

Die Helferkartei bündelt Stammdaten, Ansprechpersonen, Verfügbarkeit, Zeitfenster, Begleitung und Rückmeldung nachvollziehbar. Die Desktoptabelle ist bewusst informationsdicht, bleibt aber durch feste Spalten und einen separaten Scrollbereich stabil. Die Mobilansicht löst dieselben Daten in übersichtliche Karten auf.

Der Einsatzplan bildet die kritischen Entscheidungen verständlich ab. Statuschips, Ausfall- und Doppelbelegungsindikatoren sowie Zeitfensterwarnungen sind lesbar voneinander getrennt. Die zuletzt ergänzten manuellen Freigaben sind klar beschriftet und behalten eine sichtbare Kontrolle durch `OK ✓`. Im Live-Dialog „Schicht bearbeiten“ waren Formular, Warnhinweis, Freigabefeld sowie die Aktionen „Abbrechen“ und „Speichern“ gleichzeitig sichtbar. Ein horizontaler Modalüberlauf wurde nicht festgestellt.

### Fachmodule, PDF und Excel

Vorbereitung, Nachbereitung, Material, Kuchen und Finanzen verwenden die gleiche helle Kartenoptik, klare Eingabefelder und zurückhaltende farbliche Akzente. Die PDF-Ausgabe trennt Ausgabemodus, Filter und Vorlagenkonfiguration logisch. Die Excel-Projektübersicht erklärt verständlich, dass sie der Dokumentation dient, während die vollständige Projektsicherung über „Speichern“ und „Laden“ erfolgt. Die Hilfe bietet ein rollenbezogenes Video, eine durchsuchbare Anleitung und den gut sichtbaren Einstieg zur PWA-Installation.

## Praxisbewertung für den Festivalbetrieb

Im Stress kurz vor oder während einer Veranstaltung werden die kritischen Aufgaben mit wenigen Klicks erreicht. Das Dashboard verweist direkt auf offene Schichten, knappe Belegung, Doppelbelegungen, Rückmeldungen und Fristen. Im Einsatzplan sind Filter, Suche, neue Schicht und die wichtigsten Statuswerte unmittelbar im oberen Bereich verfügbar. Die kompaktere Bereichskontaktsektion schafft hierfür zusätzliche Sichtfläche.

Die Anwendung trennt fachlich richtige Warnungen von bewusst akzeptierten Abweichungen. Das ist für eine ehrenamtlich organisierte Veranstaltung wichtig: Die Einsatzleitung kann eine zeitliche Unterdeckung oder eine geprüfte Doppelbelegung dokumentiert akzeptieren, ohne dass diese Entscheidung später als unbemerkter Fehler erscheint. Die Statuskennzeichnung `OK ✓` erhält diese Nachvollziehbarkeit.

## Empfehlungen für die nächsten Ausbauschritte

Die folgenden Punkte wurden bewusst **nicht** in diesem Audit umgesetzt, weil sie größere Arbeitsabläufe verändern würden und als eigener, testbarer Schritt sicherer sind.

1. **Erfassungsdialoge in älteren Fachmodulen vereinheitlichen.** Nachbereitung, Material und Kuchen verwenden aktuell eine schnelle Inline-Neuanlage. Helfer, Vorbereitung und Einsatzplan nutzen bereits fokussierte Dialoge. Beide Varianten funktionieren mobil, aber ein gemeinsames Erfassungsmuster könnte neuen Vereinsmitgliedern den Einstieg weiter erleichtern.

2. **Einsatzplan für die unmittelbare Eventphase um eine „Nur heute“-Ansicht ergänzen.** Eine gespeicherte Schnellansicht für den aktuellen Festivaltag mit Kontakt, Zeit, Aufgabe und Status würde die Einsatzleitung bei kurzfristigen Änderungen weiter beschleunigen. Die vorhandenen Filter bieten dafür bereits eine tragfähige Grundlage.

3. **Kontaktaufnahme als Arbeitsfortschritt weiterführen.** Die Erstkontakt-Quote ist ein wirksamer Frühindikator. Eine optionale, direkt aus der Helferansicht auslösbare Kontaktliste mit priorisierten fehlenden Rückmeldungen könnte den Prozess zwischen Zuordnung und Bestätigung noch weiter verkürzen.

4. **Die interne Tabellenlogik beibehalten.** Für umfangreiche Desktoptabellen ist der vorhandene eigene Scrollbereich angemessen. Eine erzwungene Verkleinerung der Spalten würde die Lesbarkeit von Ansprechpartnern, Zeitfenstern und Helferchips verschlechtern.

5. **Startpaket mittelfristig beobachten.** Der Produktionsbuild war erfolgreich, meldet jedoch für das zentrale JavaScript-Paket eine Größe oberhalb der voreingestellten Vite-Warnschwelle. Das ist kein Funktionsfehler und hat die geprüften Ansichten nicht beeinträchtigt. Für schwächere Mobilfunkverbindungen wäre eine spätere Prüfung weiterer, sicher abtrennbarer Bibliotheken sinnvoll.

## Validierung

Nach den zwei gezielten Layoutkorrekturen wurden die UI-Regressionen und die TypeScript-Prüfung erfolgreich ausgeführt. Die abschließende vollständige Validierung umfasst **369 bestandene Tests in 43 Testdateien**; ein bestehender Test ist bewusst übersprungen. Zusätzlich waren Produktionsbuild, Drizzle-Schemaabgleich und Git-Diff-Prüfung erfolgreich. Der Build erzeugt eine nicht-blockierende Größenwarnung für das zentrale JavaScript-Paket; die Auslieferung bleibt erfolgreich.

## References

[1]: https://eifelride-jq8ejdus.manus.space "RSC Helferplanung"
