# MyEifelRide Planungsplattform – TODO

## Kern & Sicherheit
- [x] Rollenbasierter Login (Admin/Editor) für mehrere Organisatoren
- [x] Zentrale Datenhaltung (Datenbank), keine öffentliche Helfer-Selbstregistrierung

## Datenmodule
- [x] Ansprechpartner verwalten (CRUD)
- [x] Helfer verwalten (bis 200): Ansprechpartner, Helfen?, Verfügbarkeit Fr/Sa/So, Bestätigt?
- [x] Einsatzplan: Schichten (Tag, Bereich, Aufgabe, Beginn, Ende, Bedarf), Mehrfachzuordnung Helfer
- [x] Vorbereitung (Aufgabe, Verantwortlich, Status)
- [x] Nachbereitung (Aufgabe, Verantwortlich, Status)
- [x] Material (Artikel, Kategorie, Menge, Einheit, Verantwortlich, Bestellt?)
- [x] Marketing (Maßnahme, Kanal, Verantwortlich, Status)
- [x] Genehmigungen (Antrag, Verantwortlich, Status)
- [x] Kuchen (Spender, Kuchen, Abgabezeit)
- [x] Finanzen (Kategorie, Einnahmen, Ausgaben, Differenz, Saldo)

## Einsatzlogik
- [x] Nur verfügbare + aktive Helfer (Helfen?=Ja, Tag=Ja) auswählbar
- [x] Absage (Helfen?=Nein) markiert Einsätze als Ausfall (rot) und zählt nicht mehr mit
- [x] Doppelbelegung am selben Tag (Zeitüberschneidung) in Echtzeit warnen (orange)
- [x] Dominanz: Ausfall (rot) vor Doppelbelegung (orange)
- [x] Ampel: Bedarf grün (offen), Status OFFEN/KNAPP/OK, Zähler Doppel + Ausfall

## Ansichten & Dashboard
- [x] Filter & Sortierung: Schichten, Ansprechpartner, Helfer, Status, Probleme
- [x] Dashboard: Kennzahlen, Verantwortlichkeiten pro Ansprechpartner, Helferauslastung (Fr/Sa/So/Gesamt)

## Excel
- [x] Import der bestehenden MyEifelRide-Excel-Datei
- [x] Export der Planungsdaten als Excel-Datei

## Qualität
- [x] Vitest-Tests für Kernlogik (7 Tests bestanden)
- [x] Excel-Roundtrip mit Originaldatei prüfen (Import-Logik an echter Datei verifiziert)
- [x] Elegantes, einheitliches Design (Light, klare Ampelfarben)

## Nachbesserungen (aus Review)
- [ ] Ansprechpartner: Umbenennen/Bearbeiten (Backend + UI)
- [ ] Einsatzplan: Schichten im UI anlegen/bearbeiten (Tag, Bereich, Aufgabe, Zeiten, Bedarf)
- [ ] Material/Marketing/Genehmigungen/Kuchen: alle Felder im UI editierbar
- [ ] Dashboard: Verantwortlichkeiten über alle Bereiche (nicht nur betreute Helfer)
- [ ] Excel-Import: alle Bereiche (Vorbereitung, Nachbereitung, Material, Marketing, Genehmigungen, Kuchen, Finanzen)
- [ ] Excel-Import: bestehende Helfer-Zuordnungen aus Originaldatei übernehmen
- [ ] Echter Import→DB→Export→Validierungs-Roundtrip als automatisierter Test
