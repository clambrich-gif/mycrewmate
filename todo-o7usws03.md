# Prüfung und Planungssimulation – Sitzung o7USWs03

- [x] Projektlogik, Datenmodell und vorhandene Tests geprüft
- [x] Typprüfung, bestehende Tests und Produktions-Build als Ausgangslage ausgeführt
- [x] Vollständige Drei-Tage-Planung simuliert: Entwurf mit Engpässen, Ausfall und Doppelbelegung erkannt; korrigierter Plan deckt 14 von 14 Plätzen konfliktfrei ab
- [x] Uhrzeitvalidierung korrigiert: nur reale HH:MM-Werte, vollständige Zeitpaare und Ende nach Beginn
- [x] Doppelzuweisungen eines Helfers und Mehrfachbelegung eines Slots in API und Datenbank verhindert
- [x] Doppelbelegungswarnung auf die tatsächlich betroffenen Schichten begrenzt
- [x] Veraltete doppelte Zuordnungszeilen werden bei der Auswertung nicht mehr mehrfach gezählt
- [x] Löschkaskaden und Ansprechpartner-Referenzen gegen verwaiste Datensätze abgesichert
- [x] Persistenz von Einnahmen und Ausgaben korrigiert
- [x] Finanz-Eingabefelder browserkompatibel formatiert
- [x] 16 automatisierte Tests erfolgreich; TypeScript-Prüfung und Produktions-Build erfolgreich

## Erweiterung 2026-09-10

- [x] Passwortmaske erscheint für abgemeldete Benutzer und das initiale Passwort meldet erfolgreich als Bearbeiter an
- [x] Administrator-Anmeldung über Manus bleibt als Rückfallebene erhalten
- [x] PDF-Ausgabeseite zeigt ZIP-Sammelabruf, Blanko-PDF und konfigurierbare Vorlagenfelder
- [x] Persönliches A4-PDF mit realistischen Aufgaben, Mithelfern, Ansprechpartner und Rufnummer visuell geprüft
- [x] Blanko-PDF im A4-Querformat ohne Leerseite geprüft; ZIP-Sammelabruf technisch validiert
- [x] 22 automatisierte Tests, TypeScript-Prüfung und Produktions-Build erfolgreich
- [x] Bearbeiter sehen weder den Navigationspunkt „Zugangsschutz“ noch die Passwortänderungsmaske; Direktzugriff wird abgewiesen
