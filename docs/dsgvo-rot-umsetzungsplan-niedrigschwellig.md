# MyCrewMate – niedrigschwelliger Umsetzungsplan für die roten DSGVO-Punkte

> **Zweck:** Praktische Reihenfolge für einen ersten sicheren Kunden-Rollout. Der Plan trennt bewusst **sofort absicherbare Technik**, **einfach dokumentierbare Betriebsabläufe** und **Rechtstexte/Verträge**, die vor Freigabe fachlich oder rechtlich geprüft werden müssen.
>
> **Wichtig:** Dies ist eine technische und organisatorische Arbeitsgrundlage, keine Rechtsberatung. AVV, Datenschutzerklärung, TOM, Rechtsgrundlagen und Fristen müssen vor dem Go-live rechtlich freigegeben werden.

## Leitentscheidung für einen einfachen Start

Für den ersten Rollout ist der sicherste, leicht programmierbare Weg:

1. **Alles Öffentliche mit Personenbezug vorübergehend schließen oder minimieren.** Keine dauerhaft erreichbaren PDF-, GPX- oder Helferdatei-Links.
2. **Die App zunächst als geschlossenen B2B-Pilot betreiben.** Nur handverlesen angelegte Vereine, keine Selbstregistrierung und keine nicht freigegebenen Drittdienste.
3. **Dokumentation schlank, aber vollständig führen.** Eine Datenflussliste, ein AVV, eine TOM, ein Löschblatt und ein Incident-Runbook sind wirksamer als viele lose Textdateien.
4. **Automatisierung nur dort bauen, wo sie echte Risiken reduziert.** Erst Zugriffsrechte, Freigabelinks und Löschfristen; danach Komfortfunktionen.

## Empfohlene Reihenfolge

| Paket | Inhalt | Ergebnis |
|---|---|---|
| **A – Sofort absichern** | R4, R5, R6, R7 | Keine leicht zugänglichen fremden Daten oder dauerhaften öffentlichen Helferlinks mehr. |
| **B – Transparenz reduzieren und erklären** | R1, R2, R3 | Saubere App-Datenschutzerklärung, keine externen Fonts, datensparsame Demo. |
| **C – Verträge und Betrieb festlegen** | R8, R9, R12 | Rollenmodell, AVV, TOM, Lieferantenliste und Notfallablauf stehen. |
| **D – Daten sauber beenden und wiederherstellen** | R10, R11 | Klare Fristen, Löschung, DSAR- und Backup-Ablauf mit Testnachweis. |

---

## R1 – Passende Datenschutzerklärung für die App

**Ziel:** Login, App und Onboarding verweisen auf einen wirklich zur SaaS-App passenden Datenschutzhinweis.

### Plan A – schlank und sinnvoll

1. Eine getrennte Seite **„Datenschutz für die MyCrewMate-App“** anlegen, zum Beispiel unter `app.mycrewmate.de/datenschutz`.
2. Den bestehenden Link im Login und im In-App-Impressum auf diese Seite umstellen.
3. Den Text aus einer gemeinsamen Quelle ausspielen, damit Login, App und öffentliche Website nicht auseinanderlaufen.
4. Für den Start den Text auf die tatsächlich genutzten Funktionen beschränken: Konto, Vereins-/Eventverwaltung, Helfer, Einsatzplanung, PDF-Freigaben, E-Mail, Backups, Support und Protokolle.
5. Eine kurze Vereinsvorlage ergänzen: „Datenschutzhinweis für Helfer und Ansprechpartner“, den der Verein in seine Kommunikation übernehmen kann.

### Alternative

- **Eine gemeinsame Gesamterklärung** für Website und App verwenden, aber mit klaren Abschnitten „öffentliche Website“, „Interessenten/Demo“ und „eingeloggte Vereinsanwendung“.
- Das spart eine Route, wird aber schnell unübersichtlich. Für MyCrewMate ist die getrennte App-Seite leichter wartbar.

### Nicht programmierbar, aber notwendig

- Verantwortlichenrolle, Rechtsgrundlagen, tatsächliche Empfänger, Fristen und Transfers müssen verbindlich entschieden bzw. rechtlich geprüft werden.

### Abgehakt, wenn

- Login und App zeigen denselben aktuellen Link.
- Die App-Erklärung nennt Daten, Zwecke, Rollen, Empfänger, Fristen, Rechte und Kontaktweg.
- Eine Versionsnummer und ein Freigabedatum sind dokumentiert.

---

## R2 – Externe Google Fonts und unvollständige Transparenz

**Ziel:** Beim Seitenaufruf keine unnötige Verbindung zu Google Fonts und keine unklare Drittübermittlung.

### Plan A – technisch einfachster Weg

1. Die verwendete Schrift **Inter lokal** in das Projekt aufnehmen und per lokalem `@font-face` ausliefern.
2. Die beiden Google-Preconnect-Einträge und das Google-Stylesheet aus `client/index.html` entfernen.
3. Einmal im Browser-Netzwerk prüfen: kein Abruf von `fonts.googleapis.com` oder `fonts.gstatic.com`.
4. In der Datenschutzerklärung nur die tatsächlich verbleibenden Dienstleister aufführen.

### Alternative

- Ausschließlich eine Systemschrift nutzen. Das ist am datensparsamsten und ohne Font-Dateien möglich, verändert aber die Optik leicht.

### Abgehakt, wenn

- Der Produktions-Build keine Google-Font-Anfragen mehr auslöst.
- Die Dienstleister-/Datenflussliste aktualisiert ist.

---

## R3 – QR-/Vereinsdemo datensparsam gestalten

**Ziel:** Die Demo bleibt hilfreich, speichert aber möglichst wenig und erklärt jede Speicherung klar.

### Plan A – niedrigschwelliger Pilotweg

1. Das optionale Freitextfeld **„Woher kennen Sie uns?“** entfernen.
2. Wenn Herkunftsauswertung wichtig ist, nur eine feste Auswahl wie „Veranstaltung“, „Empfehlung“, „Internet“, „Sonstiges“ speichern.
3. Die Auswahl nur nach einem bewussten Klick speichern; vorher direkt einen kurzen Datenschutzlink zeigen.
4. `sessionStorage` entfernen und den Auswahlstatus nur im aktuellen React-Speicher halten.
5. Eine kurze automatische Löschfrist einführen, zum Beispiel 30 oder 90 Tage, und diese im Text nennen.

### Alternative

- Gar nichts serverseitig speichern: QR-Code führt unmittelbar zur Demo. Die Herkunft kann später ausschließlich über unterschiedliche Landing-URLs oder UTM-Parameter ausgewertet werden – aber nur nach rechtlicher Prüfung der Messmethode.

### Abgehakt, wenn

- Kein Freitext mehr gespeichert wird.
- Kein nicht erforderlicher Browser-Speicher genutzt wird.
- Speicherung, Zweck, Frist und Ansprechpartner direkt am Formular erklärt sind.
- Ein Test die automatische Löschung nachweist.

---

## R4 – Mandantentrennung bei direkten Asset-Routen (IDOR)

**Ziel:** Niemand kann durch Manipulation einer Event-, Logo- oder Bild-ID Daten eines anderen Vereins sehen.

### Plan A – vorhandene Autorisierung wiederverwenden

1. Eine kleine gemeinsame Server-Hilfsfunktion für Direkt-Routen schaffen: **„aktuellen Nutzer, Mandant und Recht prüfen“**.
2. Diese Funktion in jede Express-Route für Event-PDF-Bilder, Vereinslogos und Standortlogos einhängen.
3. Jede Abfrage zusätzlich mit `tenantId`, `eventId` und erforderlichem Leserecht einschränken.
4. Drei automatisierte Negativtests ergänzen:
   - fremder Verein,
   - fremdes Event im selben Verein,
   - fehlendes Fachbereichsrecht.

### Sofortmaßnahme vor dem Umbau

- Betroffene Direkt-Routen vorübergehend deaktivieren oder nur für den Master-Admin erlauben, wenn sie nicht zwingend für den Pilotbetrieb gebraucht werden.

### Alternative

- Assetdaten ausschließlich über vorhandene tRPC- oder autorisierte Downloadrouten ausliefern. Das reduziert Sonderlogik, kann aber mehr UI-Anpassung erfordern.

### Abgehakt, wenn

- Alle direkten Routen den serverseitig abgeleiteten Mandantenscope nutzen.
- Die drei Negativtests zuverlässig mit `403` oder `404` enden.
- Ein Code-Review alle Express-Routen außerhalb von tRPC erfasst hat.

---

## R5 – Öffentliche Helfer-PDF-Links absichern

**Ziel:** Ein per WhatsApp verschickter Link ist zeitlich begrenzt, widerrufbar und nur für die freigegebene Aufgabe verwendbar.

### Plan A – erst schließen, dann sicher neu öffnen

1. Den neuen dauerhaften Kurzlink `/p/:shortCode` sofort nicht mehr zur Veröffentlichung verwenden.
2. Für den Pilotbetrieb zunächst nur die **angemeldete Helferansicht** oder PDF-Download innerhalb der App anbieten.
3. Anschließend eine einheitliche Freigabe bauen:
   - zufälliger, langer Token,
   - Token nur gehasht in der Datenbank speichern,
   - `expiresAt`, `revokedAt`, `createdBy`, Helfer- und Eventbezug speichern,
   - standardmäßig kurze Laufzeit, etwa 7 Tage oder bis zum Ende des Events,
   - „Link widerrufen und neu erzeugen“ in der Oberfläche.
4. Link bei Eventschluss, Kontakt-/Helferlöschung und Rechteentzug automatisch sperren.
5. Fehler- und Zugriffslogs dürfen keine vollständigen Tokens enthalten.

### Alternative

- Eine Helfer-PIN zusätzlich zum Link verlangen. Das steigert Schutz, ist für Ehrenamtliche aber umständlicher und daher nicht die erste Wahl.

### Abgehakt, wenn

- Alte Codes sind deaktiviert oder rotiert.
- Ein abgelaufener, widerrufener oder eventgeschlossener Link ist unbrauchbar.
- Linkabrufe sind rate-limitiert.
- Ein UI-Test bestätigt, dass der Widerruf für Admins verständlich funktioniert.

---

## R6 – Öffentliche Helfer-PDF datensparsam machen

**Ziel:** Ein möglicher Linkverlust offenbart nicht die Daten anderer Personen.

### Plan A – separate Minimal-PDF

1. Für öffentliche Links eine eigene PDF-Variante erzeugen.
2. Sie zeigt nur:
   - Name der empfangenden Person,
   - eigene Aufgabe,
   - Datum, Uhrzeit und Ort,
   - einen Funktionskontakt, etwa „Einsatzleitung“.
3. Standardmäßig **nicht** zeigen:
   - Mithelfende,
   - private Hinweise,
   - Spenden, Allergene, Verfügbarkeiten,
   - persönliche Telefonnummern anderer Personen,
   - interne Bemerkungen.
4. Die ausführlichere PDF bleibt ausschließlich hinter dem Login verfügbar.

### Alternative

- Öffentliche PDFs vollständig abschaffen und nur eine mobile Helferansicht nach Anmeldung anbieten. Das ist datenschutzfreundlicher, aber im Verein weniger komfortabel.

### Abgehakt, wenn

- Eine Feldmatrix „öffentlich / angemeldet“ vorliegt.
- Snapshot-Tests bestätigen, dass die Minimal-PDF keine Daten Dritter enthält.
- Die Oberfläche erläutert verständlich, was über einen öffentlichen Link mitgeteilt wird.

---

## R7 – Uploads, Logos und GPX nicht allgemein öffentlich ausliefern

**Ziel:** Persönliche und vereinsbezogene Dateien sind nur mit passendem Recht abrufbar.

### Plan A – Public/Private sauber trennen

1. Den generischen öffentlichen `/uploads/*`-Zugriff auf eine kleine **Allowlist rein öffentlicher Markenbilder** beschränken.
2. Alles andere – GPX, Vereinslogos, Standortlogos, PDF-Dateien, Exporte – über einen geschützten Pfad ausliefern.
3. Geschützte Downloads prüfen immer Nutzer, Mandant, Event und Fachbereichsrecht.
4. Bestehende GPX- und Dateilinks inventarisieren; öffentliche Schlüssel nach der Umstellung ersetzen oder löschen.

### Sofortmaßnahme vor dem Umbau

- GPX und Standortlogos im Pilotbetrieb ausblenden oder nur nach Login aus der App laden.

### Alternative

- Kurzlebige signierte Download-URLs erzeugen. Das ist bei externem Objektspeicher sinnvoll, bei lokaler Speicherung aber aufwendiger als ein geschützter App-Download.

### Abgehakt, wenn

- Ohne Login sind private Dateien nicht erreichbar.
- Ein Nutzer eines anderen Vereins erhält weder Datei noch Metadaten.
- Alte öffentliche URLs wurden geprüft und bei Bedarf rotiert.

---

## R8 – Rollenmodell, AVV, TOM und VVT pragmatisch aufsetzen

**Ziel:** Jeder Kunde und jedes Teammitglied weiß, wer wofür datenschutzrechtlich zuständig ist.

### Plan A – ein schlankes Dokumentenpaket

1. Eine einseitige Rollenmatrix erstellen:
   - Verein: Verantwortlicher für seine Helfer-/Planungsdaten.
   - MyCrewMate: Auftragsverarbeiter für die Mandantendaten.
   - MyCrewMate: eigener Verantwortlicher für Website, Vertrag, Abrechnung und Plattform-Sicherheit.
2. Einen AVV auf Basis einer geprüften Art.-28-Vorlage erstellen lassen und elektronisch vor Freischaltung abschließen.
3. Eine TOM-Anlage in verständlichen Kategorien führen: Zugang, Zugriff, Verschlüsselung, Backups, Protokollierung, Löschung, Incident, Lieferanten, Rechteprüfung.
4. Ein VVT als Tabelle führen; pro Verarbeitung nur eine Zeile mit Zweck, Daten, Betroffenen, Empfängern, Frist und Maßnahme.
5. Im Master-Admin einen einfachen Status ergänzen: „AVV liegt vor / noch nicht freigeschaltet“.

### Alternative

- Für die ersten zwei oder drei Pilotvereine AVV, TOM und VVT zunächst manuell per PDF/Signaturprozess abschließen. Die spätere digitale Bestätigung kann danach erfolgen.

### Abgehakt, wenn

- Rollenmatrix, AVV, TOM und VVT freigegeben und versioniert sind.
- Kein Verein ohne dokumentierten AVV in den Produktivmodus geht.
- Die technischen Datenflüsse zu den Angaben in den Dokumenten passen.

---

## R9 – Lieferanten und Datenflüsse vereinfachen

**Ziel:** Nur Dienste verwenden, die bewusst ausgewählt, dokumentiert und vertraglich geklärt sind.

### Plan A – ein schlankes Lieferantenregister

1. Eine Tabelle mit je einer Zeile pro Dienst anlegen:
   - Dienst,
   - Zweck,
   - Datenarten,
   - Rolle (Auftragsverarbeiter oder eigener Empfänger),
   - Speicherregion,
   - Vertrag/AVV,
   - Drittlandgrundlage,
   - Eigentümer und Prüfdatum.
2. Für den ersten Rollout möglichst wenige Dienste aktiv lassen:
   - lokales Hosting/DB/Uploads,
   - ein festgelegter SMTP-Anbieter,
   - keine externen Google Fonts,
   - Karten nur nach bewusster Aktivierung,
   - WhatsApp erst nach sichtbarer Nutzerbestätigung.
3. Manus-CDN-/Medienpfade und zukünftige KI-Dienste getrennt als „noch nicht für Kundendaten freigegeben“ markieren, solange Vertrag, Region und Datenfluss nicht geprüft sind.

### Alternative

- Für Karten zunächst gar keine Live-Karte in neuen Kundenmandanten aktivieren. Orte können als Text geführt werden; Karten werden erst nach Dienstleisterfreigabe eingeschaltet.

### Abgehakt, wenn

- Für jeden tatsächlichen Dienst ein Registereintrag, Vertragstatus und Verantwortlicher vorhanden sind.
- Nicht freigegebene Dienste technisch deaktiviert oder klar von Kundendaten getrennt sind.
- Die Datenschutzerklärung deckt die freigegebenen Dienste ab.

---

## R10 – Lösch- und Aufbewahrungsregeln einführen

**Ziel:** „Abgeschlossen“ bedeutet nicht unbegrenzte Speicherung.

### Plan A – zuerst Regeln, dann wenige gezielte Jobs

1. Eine kurze Datenklassen-Tabelle beschließen: aktive Helferplanung, geschlossene Events, Spenden, Teamnotizen, PDFs/Links, Einladungen, Aktivitätslogs, Lösch-Logs, Backups, Uploads.
2. Für jede Klasse nur diese sieben Werte festlegen: Zweck, Frist, Trigger, Ausnahme, Löschmethode, Backuplaufzeit, verantwortliche Person.
3. Zuerst die riskantesten Klassen automatisieren:
   - abgelaufene PDF-Tokens und Einladungen löschen,
   - öffentliche Freigaben widerrufen,
   - vollständige Lösch-Snapshots nach kurzer Wiederherstellungsfrist entfernen,
   - alte Aktivitätslogs bereinigen,
   - verwaiste Uploads entfernen.
4. Eventhistorie fachlich erhalten, aber personenbezogene Detaildaten nach einer festgelegten Nachbereitungsfrist anonymisieren oder löschen.

### Alternative

- Für die erste kleine Pilotphase eine feste, monatlich dokumentierte manuelle Löschung durch zwei benannte Personen. Das ist nur als Übergang vertretbar; die Frist und Prüfung müssen dennoch verbindlich sein.

### Abgehakt, wenn

- Eine Datenklassenmatrix freigegeben ist.
- Automatische oder dokumentiert manuelle Bereinigung je Frist nachweisbar erfolgt.
- Closed/archived-Events keine dauerhafte Ausnahme ohne Entscheidung mehr darstellen.

---

## R11 – Betroffenenrechte und Backups praktikabel organisieren

**Ziel:** Anfragen, Löschung und Wiederherstellung funktionieren auch ohne sofort ein neues großes Modul zu bauen.

### Plan A – betrieblicher Start, danach Produktfunktion

1. Einen geschützten Kontaktweg für Datenschutzanfragen einrichten.
2. Ein internes DSAR-Register mit wenigen Feldern führen: Eingang, Person, Identitätsprüfung, Frist, betroffene Mandanten, Entscheidung, Antwortdatum.
3. Zu Beginn individuelle Auskunft/Export **manuell** aus den vorhandenen Daten erzeugen und vorher Daten Dritter prüfen.
4. Die vorhandenen veranstaltungsweiten Excel-Exporte nicht als personenbezogenen Export verwenden.
5. Ein Backup-Blatt führen: Datenbank, Uploads, Speicherort, Verschlüsselung, Zugriffsberechtigte, Aufbewahrungsdauer, RPO/RTO, letzter erfolgreicher Restore-Test.
6. Mindestens einen echten Restore-Test mit nichtproduktiven Daten dokumentieren.

### Alternative

- Danach ein kleines Admin-Tool bauen: „Personenbezogenen Export erzeugen“ und „Löschantrag protokollieren“. Das lohnt sich, sobald mehr als wenige Vereine produktiv arbeiten.

### Abgehakt, wenn

- Eine Übungsanfrage innerhalb eines Monats vollständig durchgespielt wurde.
- Ein Restore-Test protokolliert vorliegt.
- Backup- und Löschfristen miteinander abgestimmt sind.

---

## R12 – Notfall- und Datenschutzverletzungsprozess

**Ziel:** Bei einem Vorfall keine Zeit mit Zuständigkeitssuche verlieren.

### Plan A – ein einseitiges Runbook statt eines großen Systems

1. Eine Seite „Datenschutzvorfall – Sofortmaßnahmen“ erstellen.
2. Zwei namentlich benannte Verantwortliche und eine Vertretung festlegen.
3. Einen sicheren Meldekanal einrichten: Funktionspostfach plus Telefonnummer für dringende Fälle.
4. Reihenfolge klar festlegen:
   - Zugang/Link sperren,
   - Beweise sichern,
   - Umfang prüfen,
   - Verein ohne unangemessene Verzögerung informieren,
   - Vorfall dokumentieren,
   - technische und organisatorische Nacharbeit festlegen.
5. Eine interne Zielzeit festlegen, zum Beispiel erste strukturierte Kundeninformation binnen 24 Stunden nach Kenntnis, damit der Verein seine gesetzlichen Pflichten bewerten kann.
6. Einmal pro Jahr eine kurze Tabletop-Übung durchführen: „öffentlicher Helferlink wurde weitergegeben“.

### Alternative

- Ein Ticket-System nutzen, wenn bereits eines vorhanden ist. Für den ersten Rollout reicht ein geschütztes Incident-Register mit festen Vorlagen.

### Abgehakt, wenn

- Runbook, Ansprechpartner, Vorlagen und Incident-Register vorhanden sind.
- Eine kurze Übung dokumentiert ist.
- Der AVV beschreibt die unverzügliche Meldung von MyCrewMate an den Verein.

---

## Was bewusst nicht sofort gebaut werden sollte

Diese Punkte sind sinnvoll, aber für die erste sichere Rollout-Stufe nicht der schnellste Hebel:

- komplexes Kundenportal für DSAR-Anträge,
- vollständige eigene Karteninfrastruktur,
- Passkey-/MFA-Ausbau für alle Nutzer statt zuerst Admins,
- vollständige automatisierte Rechtsdokumentenverwaltung,
- umfassendes Support-/Co-Browsing-System.

Sie folgen nach der Schließung der roten Risiken. Vor allem darf Komfort nicht dazu führen, dass öffentliche Freigaben oder Dritttransfers schneller wachsen als die Kontrollmechanismen.

## Konkrete Entscheidungspunkte vor Beginn

1. **Öffentliche Helfer-PDFs:** Soll die erste Produktivversion sie vorläufig deaktivieren oder den kurzen, widerrufbaren Link direkt bauen?
2. **Karten:** Für den Start deaktivieren oder als bewusste Zwei-Klick-Funktion weiterführen?
3. **QR-Demo:** Nur ohne Speicherung oder mit wenigen Kategorien und kurzer Löschfrist?
4. **Pilotumfang:** Wie viele Vereine erhalten vor Abschluss von MFA und DSAR-Automatisierung Zugang?
5. **Betrieb:** Wer ist für Datenschutzanfragen, Backups und Incidents namentlich zuständig?

## Minimaler Freigabebeleg pro Rotpunkt

| Nachweis | Praktische Form |
|---|---|
| Maßnahme | Link zum Ticket, Commit oder Dokument |
| Test | Screenshot, automatisierter Test oder Testprotokoll |
| Restrisiko | Ein Satz mit Begründung und Freigabe |
| Zuständigkeit | Rolle und vertretende Person |
| Datum | Umsetzung und letzter Review |
| Abhängigkeit | Vertrag, Rechtstext, Serverkonfiguration oder Migration |

Erst wenn jeder rote Punkt einen solchen Nachweis besitzt, sollte MyCrewMate von einem geschlossenen Testbetrieb in den regulären Kundenbetrieb übergehen.
