# MyCrewMate – priorisierte DSGVO- und Live-Rollout-Auswertung

## Ampel und Prioritäten – zuerst entscheiden, dann ausrollen

| Priorität | Freigabestatus | Was muss geschehen? |
|---|---|---|
| **Rot – Go-live-Blocker** | **Kein produktiver SaaS-Rollout mit personenbezogenen Vereins-, Helfer- oder Planungsdaten.** | App-Transparenz, Rollen/AVV/TOM/VVT, Zugriffsgrenzen, öffentliche Freigaben, Datenlebenszyklus sowie Kern-Betriebsprozesse nachweisbar schließen und testen. |
| **Gelb – vor regulärem Kundenbetrieb** | Erst nach den roten Punkten bzw. spätestens vor breitem Onboarding erledigen. | MFA und belastbare Abuse-Abwehr, Datenminimierung in PDFs, externe Dienste/Karten/Kommunikation, DSFA-Vorprüfung, Support- und Schulungsprozesse, aktuelle Rechtstexte. |
| **Blau – danach verbessern** | Kein eigenständiger Freigabestopp, aber in den nächsten Hardening- und Compliance-Sprint einplanen. | Security-Header/Log-Redaction, Sitzungsrichtlinie, Container-Lieferkette, Datei-Lifecycle, Impressums-Detailprüfung und Preview-/Medienhygiene. |

> **Freigabeempfehlung:** Die im Audit als `rollout_gate` markierten Punkte sind **kumulativ** zu schließen. Ein einzelnes Feature-Fix genügt nicht: Die Freigabe braucht eine nachvollziehbare Evidenzmappe aus Konfiguration, Tests, Verträgen und freigegebenen Rechtstexten.

## Einordnung, Umfang und Lesart

- **Stand:** Konsolidierung der fünf vorliegenden Audit-Ergebnisse vom **01.10.2026**. Es wurden **keine Code- oder Konfigurationsänderungen** vorgenommen.
- **Nachgewiesene Befunde** beziehen sich auf die im Audit benannten Live-Abrufe sowie statisch geprüfte Repository-Dateien unter `/home/ubuntu/myeifelride/`.
- **Offene Betriebs-/Vertragsfragen** (z. B. produktiver Hoster, Backups, SMTP-Anbieter, Regionen, AV-Verträge, Proxy-Konfiguration) waren nicht aus dem Repository belegbar. Sie sind daher **nicht als fehlend bewiesen**, aber vor Freigabe verbindlich zu klären und zu dokumentieren.
- **Rechtliche Einordnung:** Dieser Bericht ist eine technische und organisatorische Compliance-Arbeitshilfe auf Basis der Auditunterlagen, **keine Rechtsberatung** und keine verbindliche rechtliche Würdigung. Verantwortliche, Auftragsverarbeiter und gegebenenfalls Datenschutzbeauftragte sollten Rechtstexte, Rechtsgrundlagen, Verträge und Fristen freigeben.
- **Begriff „vor Go-live“:** meint vor Verarbeitung realer personenbezogener Kundendaten im produktiven SaaS-Betrieb – nicht nur vor öffentlicher Vermarktung.

---

## Rot – Go-live-Blocker

### R1. Eine zur SaaS-App passende Datenschutzinformation fehlt

- **Konkrete Aussage:** Der sichtbare Datenschutzlink im App-Login führt auf `https://mycrewmate.de/datenschutz`. Diese Erklärung grenzt ihren Geltungsbereich jedoch ausdrücklich auf die öffentliche Muster-/Produktseite ein und verweist für die Anwendung auf getrennte Hinweise. Ein solcher anwendungsbezogener Hinweis ist im Audit nicht nachgewiesen.
- **Warum relevant:** Für die eingeloggte Anwendung werden unter anderem Kontakt-, Helfer-, Verfügbarkeits-, Schicht-, Spenden-, Freitext-, Login- und Protokolldaten verarbeitet. Betroffene benötigen bei Erhebung transparente Angaben zu Verantwortlichem/Rollen, Zweck, Rechtsgrundlage, Empfängern, Transfers, Fristen und Rechten; bei von Vereinen bereitgestellten Daten ist Art. 14 DSGVO zu prüfen [1].
- **Nachgewiesener App-Bezug:** `client/src/components/ImpressumDialog.tsx` verlinkt die öffentliche Erklärung; `PublicLegal.tsx` beschränkt sie auf den Startauftritt; `App.tsx` trennt Marketing- und App-Routing. Das Datenmodell umfasst u. a. Kontakte, Helfer, Einsätze, Spenden und Logs (`drizzle/schema.ts`).
- **Pragmatische Maßnahme:** Eine **versionierte App-Datenschutzerklärung** unter eigener App-URL veröffentlichen und im Login sowie in der App direkt verlinken. Sie muss das Rollenmodell (Verein als Verantwortlicher; MyCrewMate regelmäßig Auftragsverarbeiter; eigene MyCrewMate-Zwecke getrennt), Datenkategorien, Zwecke/Rechtsgrundlagen, Empfänger/AV, Drittlandtransfers, Fristen, PDF-Link-Risiken, Supportzugriff, Rechtekanal und Aufsicht sauber abgrenzen. Zusätzlich eine Art.-13/14-Vorlage für Vereine im Onboarding bereitstellen.
- **Abnahme-Evidenz:** URL und Login-Screenshot, Rechtstext-Version/Freigabe, Datenfluss-/VVT-Abgleich, Test für App- und Marketing-Domain.

### R2. Öffentliche Rechtstexte bilden tatsächliche Verarbeitungen und Empfänger nicht vollständig ab

- **Konkrete Aussage:** Die öffentlichen Legal-Seiten laden Google Fonts über `fonts.googleapis.com` und `fonts.gstatic.com`. Der Hinweis nennt nach Auditstand nur Serverprotokolle und ein allgemeines berechtigtes Interesse, nicht aber konkrete Empfänger, Logfristen/-kriterien, Interessen oder mögliche Transfers.
- **Warum relevant:** Direkte Abrufe externer Ressourcen führen mindestens zu Verbindungs- und Protokolldaten beim Anbieter. Transparenzangaben müssen sich an der realen Produktionskette orientieren, nicht allein an der Aussage „trackerfrei“ [1].
- **Nachgewiesener App-Bezug:** `client/index.html:17–22` enthält Google-Fonts-Preconnect und Stylesheet; die Live-Abrufe von `/impressum` und `/datenschutz` zeigten laut Audit dieselben Google-Domains. Initial wurde kein `Set-Cookie` festgestellt – das ist positiv, ersetzt die Informationspflicht aber nicht.
- **Pragmatische Maßnahme:** **Inter lokal und versionsfest ausliefern**, Google-CSS und beide Preconnects entfernen. Parallel die reale Kette für Hosting, CDN, Logging und Support dokumentieren: Anbieter, Rolle, Datenarten, Zweck, Rechtsgrundlage, Interessen, Speicherfristen, Transfers und Garantien. Falls externe Fonts ausnahmsweise bleiben sollen, ist dies vorab gesondert rechtlich und technisch freizugeben.
- **Abnahme-Evidenz:** Produktions-Build-/Network-Check ohne Google-Font-Abruf, aktualisierter Hinweis/VVT, Lieferantennachweise.

### R3. QR-/Vereinsdemo erhebt Daten ohne vollständige unmittelbare Information; `sessionStorage` ist ungeklärt

- **Konkrete Aussage:** Der öffentliche Demoflow speichert freiwillige Herkunftsauswahl und optionalen Freitext serverseitig. Zusätzlich wird ein Auswahlkennzeichen in `sessionStorage` gelesen/geschrieben. Der sichtbare Hinweis erklärt Freiwilligkeit, aber nicht die vollständige Verarbeitung bzw. den Endgerätespeicherzugriff.
- **Warum relevant:** Freitext kann trotz Auswahlcharakter personenbezogene Informationen enthalten. Bei Direkterhebung ist die Verarbeitung unmittelbar transparent zu machen [1]. Das Speichern/Auslesen von Informationen auf dem Endgerät ist nach § 25 TDDDG grundsätzlich einwilligungsbedürftig, sofern die enge Ausnahme der unbedingt erforderlichen Bereitstellung nicht tragfähig dokumentiert ist [2].
- **Nachgewiesener App-Bezug:** `ClubDemoLanding.tsx` sendet `source`/`eventLabel` ohne Authentifizierung; `server/routers.ts`, `server/db.ts` und `drizzle/schema.ts` speichern Werte und Zeitstempel. `mycrewmate.club-demo-source-recorded` wird in `sessionStorage` verwendet.
- **Pragmatische Maßnahme:** Direkt am Formular oder über einen eindeutig zugeordneten Link einen vollständigen Kurz-Hinweis nach Art. 13 bereitstellen. Zweck, Rechtsgrundlage, Empfänger, Transfer, Frist und fehlende automatisierte Entscheidung festlegen. Freitext entfernen oder begrenzen, mit „keine personenbezogenen Daten eingeben“ versehen und eine **technisch erzwungene Löschfrist** umsetzen. Für `sessionStorage` die Erforderlichkeit schriftlich bewerten; falls nicht zwingend erforderlich, In-Memory-State verwenden oder vor Speicherung eine wirksame §-25-Einwilligung einholen.
- **Abnahme-Evidenz:** Formular-Screenshot, VVT-Eintrag, Retention-Job/Test, dokumentierte §-25-Entscheidung.

### R4. Direkte Asset-Routen können die Mandanten- und Fachrechteprüfung umgehen (IDOR)

- **Konkrete Aussage:** Bestimmte Express-Routen authentisieren zwar, leiten aber keinen serverseitig autorisierten Tenant-/Event-Scope ab und fragen Ressourcen nur anhand von IDs ab. Ein angemeldeter Nutzer könnte fremde, erratene Ressourcen anfragen.
- **Warum relevant:** Dies gefährdet die zentrale Vertraulichkeitsgrenze zwischen Vereinen/Mandanten und ist ein unmittelbares Risiko für unbefugte Offenlegung [1].
- **Nachgewiesener App-Bezug:** `server/event-pdf-image-routes.ts`, `server/location-logo-routes.ts` und `server/tenant-logo-routes.ts` wurden im Audit gegenüber den zentralen, scoped tRPC-Pfaden in `server/routers.ts` kontrastiert.
- **Pragmatische Maßnahme:** Alle Direkt-Routen an den vorhandenen Autorisierungspfad angleichen: Nutzer authentisieren, `authorizedPlanningScope` serverseitig ermitteln, Scope setzen und Tenant-, Event- sowie Modulrecht in der Datenbankabfrage prüfen. Nicht auf Client-IDs oder bloße Anmeldung vertrauen.
- **Abnahme-Evidenz:** Automatisierte Negativtests für fremden Tenant, fremdes Event und fehlendes Locations-/PDF-Leserecht; Review aller Nicht-tRPC-Routen.

### R5. Persönliche Helfer-PDFs sind über langlebige öffentliche Bearer-Links erreichbar

- **Konkrete Aussage:** Die neue Route `/p/:shortCode` löst einen dauerhaft gespeicherten 48-Bit-Kurzcode ohne Ablauf-, Widerrufs- oder Eventstatusprüfung auf. Der zurückgegebene „90 Tage“-Wert wird nicht erzwungen. Die ältere HMAC-Variante läuft zwar nach 90 Tagen ab, kennt aber keinen individuellen Widerruf.
- **Warum relevant:** Jeder Linkinhaber kann persönliche Einsatzinformationen abrufen und weitergeben. Die neue Freigabe bleibt mindestens bis zur Helferlöschung bzw. über Eventschluss hinaus wirksam. Das ist weder datenschutzfreundliche Voreinstellung noch belastbare Zugriffskontrolle [1].
- **Nachgewiesener App-Bezug:** `server/routers.ts:4362–4379`, `server/db.ts:2961–3025` und `server/public-helper-pdf-routes.ts:135–186`; der Kurzcode ist in `helpers.pdfShareCode` ohne `expiresAt`/`revokedAt` modelliert. Fehlerlogs können zusätzlich den Code enthalten.
- **Pragmatische Maßnahme:** Kurzcode-Freigabe bis zum Umbau deaktivieren. Neue Freigaben nur als pro Helfer und Zweck erzeugte, kryptografisch starke, **gehasht gespeicherte** Tokens mit kurzer Ereignis-TTL, `expiresAt`, `revokedAt`, `createdBy`, Rotation und sofortigem Einzelwiderruf. Ablauf bei jedem Abruf prüfen; bei Eventschluss, Rechteentzug sowie Helfer-/Kontaktlöschung widerrufen. Öffentliche Abrufe drosseln und Tokens nicht loggen. Für sensible Planungen eine authentifizierte Helferansicht statt Linkfreigabe vorsehen.
- **Abnahme-Evidenz:** Datenmigration/Rotation bestehender Codes, Zugriffstests vor/nach Ablauf und Widerruf, Rate-Limit-Test, Log-Redaction-Test.

### R6. Öffentliche PDF-Inhalte sind nicht auf den Empfänger minimiert

- **Konkrete Aussage:** Die öffentlich auslieferbare Helfer-PDF kann Mithelfende, Schichtbemerkungen, Spenden/Allergenhinweise, Namen und Telefonnummern von Ansprechpersonen sowie eigene Einsatz-/Verfügbarkeitsdaten enthalten.
- **Warum relevant:** Bei Verlust oder Weitergabe eines Links wären auch Daten Dritter betroffen. Schutz-Header wie `no-store`, `no-referrer` und `noindex` sind sinnvoll, verhindern aber keine freiwillige Weitergabe.
- **Nachgewiesener App-Bezug:** Inhaltserzeugung in `server/pdf.ts:483–498, 730–770`; anonyme Auslieferung in `server/public-helper-pdf-routes.ts`.
- **Pragmatische Maßnahme:** Eine separate **öffentliche Minimal-PDF** einführen: standardmäßig nur eigene Aufgabe, Zeit, Ort und Funktionskontakt. Mithelfende, private Notizen, Spenden, Allergene und persönliche Rufnummern Dritter standardmäßig ausschließen. Erforderliche Ausnahmen gesondert freigeben, scopebar machen und dokumentieren.
- **Abnahme-Evidenz:** Feldmatrix „authentifiziert / öffentliche PDF“, Snapshot-Tests ohne Drittpersonendaten, UX-Freigabe der Ausnahmefälle.

### R7. Der generische Upload-Endpunkt macht Mandanten- und GPX-Dateien öffentlich erreichbar

- **Konkrete Aussage:** `storage.ts` liefert nahezu jede Datei unter `/uploads/*` ohne Authentisierung aus. Vereins-/Standortlogos und GPX-Dateien werden dort abgelegt; die achtstelligen Zufallsanteile sind keine Zugriffskontrolle.
- **Warum relevant:** Öffentliche URLs können vertrauliche Veranstaltungs-, Standort- oder gegebenenfalls personenbezogene Informationen offenlegen und unterlaufen die vorgesehenen dedizierten, authentisierten Routen.
- **Nachgewiesener App-Bezug:** `server/storage.ts:124–157`; Ablage u. a. aus `server/routers.ts:3532, 3757, 3843`. Die Betriebsdokumentation beschreibt für Logos/GPX dagegen geschützte Nutzung.
- **Pragmatische Maßnahme:** Öffentliche und geschützte Speicherbereiche trennen. Die generische Public-Route abschalten oder auf eine explizite Allowlist nachweislich öffentlicher Dateien reduzieren. Mandanten-, Standort-, GPX- und PDF-Dateien nur per autorisierter Tenant-/Event-Prüfung oder per kurzlebiger signierter URL ausliefern. Bestehende URLs, DB-Felder, Caches und Objekte inventarisieren, nötigenfalls rotieren/migrieren/löschen.
- **Abnahme-Evidenz:** Zugriffstest ohne Login und mit fremdem Tenant, Inventar alter Objektkeys, Migrationsprotokoll, Negative-Tests für GPX und Logos.

### R8. Rollenmodell, AVV, TOM und VVT sind vor Kunden-Onboarding nicht nachgewiesen

- **Konkrete Aussage:** Für das Kernmodell fehlen im Repository ein nachweisbarer Art.-28-AVV/DPA, eine versionsgeführte TOM-Anlage und ein belastbares VVT. Die SaaS-Rollen sind in Rechtstexten/Onboarding nicht verbindlich beschrieben.
- **Warum relevant:** Bei Helfer-, Kontakt-, Schicht- und Eventplanung bestimmt regelmäßig der jeweilige Verein Zweck und Mittel im fachlichen Kern und ist damit Verantwortlicher; MyCrewMate verarbeitet diese Mandantendaten regelmäßig weisungsgebunden als Auftragsverarbeiter. MyCrewMate bleibt für klar getrennte eigene Zwecke (z. B. Produktwebsite, Vertrag, Abrechnung, Sicherheitsbetrieb) selbst Verantwortlicher. Eine gemeinsame Verantwortlichkeit entsteht nicht allein durch SaaS-Nutzung [1].
- **Nachgewiesener App-Bezug:** Datenmodell und Rollenrechte in `drizzle/schema.ts`/`shared/permissions.ts`; kein AVV-/VVT-/TOM-Dokument im Repository. `docs/COOLIFY.md` nennt technische Basisparameter, aber keine vertragsfähige TOM oder Subprozessorsteuerung.
- **Pragmatische Maßnahme:** Vor Onboarding eine verbindliche **Rollenmatrix**, einen elektronisch abschließbaren AVV nach Art. 28 und eine TOM-Anlage bereitstellen. Zwei VVT-Ebenen führen: Vereinsvorlage als Verantwortlicher und MyCrewMate-Verzeichnis der Verarbeitungskategorien im Auftrag; eigene MyCrewMate-Zwecke separat. AVV/TOM/VVT müssen dieselben Datenflüsse, Unterauftragsverarbeiter, Fristen und Zuständigkeiten wiedergeben.
- **Abnahme-Evidenz:** Freigegebene Versionen mit Änderungsstand, Onboarding-/AVV-Abschlussnachweis, VVT-Datenflussabgleich, TOM-Evidenzlinks und Verantwortliche.

### R9. Lieferanten, Subprozessoren und Drittlandtransfers sind nicht vollständig gesteuert

- **Konkrete Aussage:** Hoster, DB, Backups, SMTP, CDN/Medien, Kartenkacheln sowie browserseitige Google-/WhatsApp-Aufrufe sind nicht in einer vollständigen Lieferanten-/Datenflussliste mit Rolle, Region, Vertrag und Transfergrundlage belegt.
- **Warum relevant:** Art. 28 DSGVO verlangt bei Unterauftragsverarbeitung eine geregelte Genehmigung und gleichwertige Pflichten; Drittlandtransfers benötigen eine konkrete Grundlage und gegebenenfalls Transferbewertung. Eine EU-US-DPF-Eignung gilt nicht pauschal für jeden US-Dienst oder jede Konzerngesellschaft [1][7].
- **Nachgewiesener App-Bezug:** Coolify-/DB-/Volume-/GHCR-Hinweise in `docs/COOLIFY.md` und Workflow; konfigurierbarer SMTP in `server/mail-service.ts`; externe Karten, Google Fonts und WhatsApp im Client; nachgeladene Medien über `files.manuscdn.com` via Same-Origin-Proxy.
- **Pragmatische Maßnahme:** Ein lebendes **Datenfluss- und Lieferantenregister** erstellen: Dienst, Zweck, Rolle (AV/eigenständiger Empfänger), Datenkategorien, Region, Subprozessoren, AV/Vertrag, Löschung, TOM, Art.-44-Mechanismus, Eigentümer und Exit-Plan. Allgemeine Unterauftragsgenehmigung im AVV nur mit Vorabinformation und Widerspruchsprozess. DPF-Status stets für konkrete Gesellschaft und Dienst prüfen.
- **Abnahme-Evidenz:** Lieferantenliste, Verträge/AV, Transferakten/SCC/TIA soweit erforderlich, Freigabeprozess für neue Integrationen.

### R10. Lösch- und Aufbewahrungskonzept fehlt für Kernfachdaten, Auditlogs, Backups und Objekte

- **Konkrete Aussage:** Geschlossene Events bleiben ausdrücklich als volle Historie erhalten. Für Kontakte, Helfer, Verfügbarkeiten, Einsätze, Spenden, viele Logs und Uploads sind keine durchgängigen Fristen oder automatischen Lösch-/Anonymisierungsjobs belegt. Lösch-Auditlogs speichern umfangreiche personenbezogene Snapshots unbefristet und erlauben Wiederherstellung; `activity_logs` haben ebenfalls keine Frist.
- **Warum relevant:** Eine UI-Löschung ist keine vollständige Löschung, wenn personenbezogene Inhalte ohne bestimmte Ausnahme dauerhaft in Auditlogs, Objekten und Backups fortbestehen. Speicherbegrenzung muss nach Zweck, Klasse und Ausnahme nachvollziehbar sein [1].
- **Nachgewiesener App-Bezug:** `server/db.ts:4556–5079` (Lösch-Audit/Wiederherstellung), `drizzle/schema.ts:1020–1127` (Logs), `server/db.ts:3330–3367` (Eventschluss), `server/storage.ts`/GPX-Referenzen (Objekte). Positiv: Teamnotizen werden nach 24 Stunden, Tippstatus nach acht Sekunden bereinigt.
- **Pragmatische Maßnahme:** Eine Datenklassen-Matrix beschließen: Zweck, Frist, Trigger, Rechts-/Aufbewahrungspflicht, Sperre, Löschmethode, Backup-Ablauf und Eigner pro Klasse. Wiederherstellbare Lösch-Snapshots zeitlich kurz halten und danach zu minimalen/pseudonymisierten Nachweisen reduzieren; Legal Hold nur mit Begründung. Closed/archived darf keine pauschale Daueraufbewahrung sein. Automatisierte Purges für Audit-/Aktivitätslogs, Sessions, Token-/Einladungsreste, Dateien und Backups implementieren und testen.
- **Abnahme-Evidenz:** Freigegebenes Löschkonzept, zeitgesteuerte Jobs, Testnachweise für Primärdaten/Objekte/Logs/Backups sowie jährlicher Review.

### R11. Betroffenenrechte und Backup-Betrieb sind keine belastbaren End-to-End-Prozesse

- **Konkrete Aussage:** Projekt-/Excel-Exporte sind vorhanden, exportieren aber veranstaltungsweit Daten mehrerer Personen und ersetzen keinen individuellen Auskunfts-, Berichtigungs-, Lösch-, Einschränkungs- oder Portabilitätsprozess. Ein Backup-Konzept mit Datenorten, Verschlüsselung, RPO/RTO, Rotation, Restore-Tests und Löschbehandlung ist nicht im Repository belegt.
- **Warum relevant:** Betroffenenrechte benötigen Identitätsprüfung, Fristensteuerung, Drittpersonenprüfung und Datensuche über Primärdaten, PDFs, Logs, Exporte und Backups. Verfügbarkeit und Wiederherstellbarkeit gehören ebenso zur risikogerechten Sicherheit wie begrenzte Backup-Aufbewahrung [1].
- **Nachgewiesener App-Bezug:** Export-/Importpfade in `server/excel-backup.ts` und `server/routers.ts:5254–5357`. Restore-Logs sind positiv auf 90 Tage bzw. 100 Vorgänge begrenzt; ein operativer Infrastruktur-Backup-Plan fehlt jedoch.
- **Pragmatische Maßnahme:** Ein DSAR-Runbook mit sicherem Eingang, Identitätsprüfung, Ticket-/Ein-Monats-Frist, Daten-Mapping, Drittrechteprüfung, dokumentierter Antwort und Empfängermitteilung einführen. Individuelle CSV/JSON-Exporte nur für die betreffende Person erzeugen. Ein Backup-Konzept mit DB, Uploads, Provider-Snapshots, Admin-Downloads, Verschlüsselung, Rollen, Regionen, RPO/RTO, Rotation, Restore-Test und Löschwiederanwendung beschließen. Admin-Exporte mit Audit, Ablauf/Einmalabruf und Löschhinweis schützen.
- **Abnahme-Evidenz:** Übungs-DSAR, Restore-Testprotokoll, Verschlüsselungs-/Rotationsnachweise, Export- und Berechtigungstests.

### R12. Incident-/Breach-Prozess und 24/7-Eskalation sind nicht nachgewiesen

- **Konkrete Aussage:** Es gibt Aktivitäts-, Lösch- und Restore-Logs, aber kein dokumentiertes Datenschutzvorfall-Runbook mit Erkennung, Triage, Kundenmeldung, 72-Stunden-Unterstützung, Vorlagen und Verantwortlichkeiten.
- **Warum relevant:** Der Auftragsverarbeiter muss den Verantwortlichen bei Verletzungen unverzüglich unterstützen; der Verantwortliche bewertet die Meldung an die Aufsicht innerhalb der gesetzlichen Frist und gegebenenfalls Betroffeneninformation [1]. Logs allein bilden keinen Reaktionsprozess.
- **Nachgewiesener App-Bezug:** Kein Incident-/Breach-Dokument im Repository; `activity_logs`, `deletion_audit_logs` und `backup_restore_logs` ersetzen kein Vorfallregister.
- **Pragmatische Maßnahme:** 24/7 erreichbaren Prozess mit Stellvertretung festlegen: Erkennen, sichere Meldung, Beweissicherung, CIA-Triage, Eindämmung, Risikobewertung, Incident-Register, stufenweise Kundeninformation, Unterstützung nach Art. 33/34, Lessons Learned und Testübungen. Im AVV eine interne Erstmeldefrist (z. B. binnen 24 Stunden nach Kenntnis) und sichere Kontakte vereinbaren, ohne die gesetzliche Bewertung des Vereins zu ersetzen.
- **Abnahme-Evidenz:** Runbook, Kontaktliste, AVV-Klausel, Vorlagen, dokumentierte Tabletop-Übung.

---

## Gelb – vor regulärem Kundenbetrieb erledigen

### G1. Administrationsschutz: MFA, individuelle Identitäten und Break-glass

- **Konkrete Aussage:** Für Master- und Tenant-Admin-Zugänge ist keine MFA/TOTP/WebAuthn-/Passkey-Implementierung nachgewiesen. Ein statischer `ADMIN_RECOVERY_KEY` kann direkt ein neues Admin-Passwort und eine Sitzung erzeugen; Master-Sitzungen verwenden zudem einen frei eingegebenen Namen.
- **Warum relevant:** Weitreichende Berechtigungen benötigen stärkeren Schutz als ein Passwort allein. Ein dauerhafter statischer Recovery-Key ist ein Ein-Faktor-Break-glass-Risiko; frei behauptete Sitzungsidentität ist kein belastbarer Auditnachweis [5].
- **Nachgewiesener App-Bezug:** Passwort- und Recovery-Flows in `server/routers.ts:1855–2382`; fehlender MFA-Pfad im Repository.
- **Pragmatische Maßnahme:** Für Plattform- und Tenant-Admins **phishing-resistente MFA** (bevorzugt WebAuthn/FIDO2, alternativ TOTP plus Recovery-Codes) verpflichtend machen, bei Passwortreset/neuer Sitzung/risikoreichen Aktionen erneut verlangen und persönliche Admin-Identitäten erzwingen. Recovery nur als zeitlich enges, rotierbares, dokumentiertes Offline-/Vier-Augen-Verfahren oder deaktiviert betreiben.
- **Abnahme-Evidenz:** MFA-Enforcement-Test, persönliche Admin-Konten, Break-glass-Runbook und manipulationsgeschütztes Audit.

### G2. Login- und Link-Abuse-Abwehr ist nicht mehrinstanz-/proxyfest

- **Konkrete Aussage:** Fehlversuche liegen in Prozess-Maps; Neustarts oder mehrere Replikas teilen diese nicht. Die IP-Ermittlung berücksichtigt die Proxy-Kette nicht belastbar. Die vorgesehene progressive Planungsteam-Drosselung ist nicht an Produktionspfade angeschlossen; öffentliche PDF-Routen haben kein Rate Limit.
- **Warum relevant:** Brute Force, Credential Stuffing und Tokenraten können nicht zuverlässig begrenzt werden; hinter einem Proxy drohen globale Sperren oder mangelhafte Clientzuordnung.
- **Nachgewiesener App-Bezug:** `server/password-auth.ts`, `server/_core/index.ts`, nicht verwendete Planning-Team-Limiter sowie öffentliche PDF-Routen.
- **Pragmatische Maßnahme:** Zentralen, atomaren Limiter (z. B. Redis/API-Gateway) je vertrauenswürdig ermittelter IP und gehashtem Konto-/Tokenpräfix einsetzen; nur kontrollierte Forwarded-Header akzeptieren. Progressive Verzögerung, `Retry-After`, Konto- und globale Abuse-Limits ergänzen; PDF-Abrufe gleichfalls begrenzen. Mit echter Coolify-Proxykette und mindestens zwei Instanzen testen.
- **Abnahme-Evidenz:** E2E-Tests für Proxy-IP, Mehrinstanz, Konto-/Tokenlimits und PDF-Abrufe.

### G3. Passwort- und Sitzungsrichtlinien müssen risikobasiert vereinheitlicht werden

- **Konkrete Aussage:** Neue Passwörter haben Mindestlänge zehn, aber kein nachgewiesenes Screening gegen kompromittierte/häufige Kennwörter oder Passphrasen-Policy. Passwortsitzungen sind zwölf Stunden begrenzt; ein SDK-Default kann jedoch ein Jahr betragen. Kein genereller Idle-Timeout, Geräteüberblick oder Re-Authentisierungsstandard ist sichtbar.
- **Warum relevant:** Mindestlänge allein ist bei privilegierten Konten kein ausreichendes Steuerungsmodell; uneinheitliche Tokenlaufzeiten erschweren das Risikomanagement.
- **Nachgewiesener App-Bezug:** `server/routers.ts`, `server/password-auth.ts`, `shared/const.ts`, `server/_core/sdk.ts`. Positiv: bcrypt Kostenfaktor 12, serverseitiger Logout-Widerruf und `sessionVersion`-Prüfung sind vorhanden.
- **Pragmatische Maßnahme:** Mindestens 12–14 Zeichen bzw. Passphrasen fördern, kompromittierte Kennwörter per k-anonymisierter Prüfung oder lokaler Sperrliste ablehnen und Passwortmanager zulassen. Eine Sitzungsmatrix mit kurzen absoluten/Idle-Timeouts für Admins, Re-Authentisierung bei kritischen Aktionen, aktiven Sitzungen und zentralem Logout festlegen. Jede Token-Erzeugung mit expliziter Laufzeit versehen.
- **Abnahme-Evidenz:** Policy, Tests kompromittierter Kennwörter, Session-Lifetime-Review, Admin-Sitzungsverwaltung.

### G4. Externe Karte, WhatsApp und SMTP sind echte Datenflüsse, nicht nur UI-Details

- **Konkrete Aussage:** Kartenkacheln werden direkt von OpenStreetMap, Esri oder OpenTopoMap geladen; Kartenausschnitte lassen Rückschlüsse auf Standorte/GPX zu. Eine bewusste Aktion öffnet `wa.me` mit Helfertelefonnummer, Nachricht und teils persönlichem PDF-Link. SMTP verarbeitet Namen, Rechte und Einladungs-/Reset-URLs, sobald Zugangsdaten gesetzt sind.
- **Warum relevant:** Es handelt sich um direkte Empfänger- bzw. Kommunikationsübermittlungen. Rollen, Verträge, Speicherorte, Transfers, Rechtsgrundlagen und transparente Vorabinformation sind je Dienst zu prüfen [1][8][9][10].
- **Nachgewiesener App-Bezug:** `LocationMapClient.tsx`, `Helpers.tsx`, `whatsappShare.ts`, `server/mail-service.ts`. WhatsApp sendet nicht beim bloßen Rendern; die Kartenanbieter sehen jedoch schon beim Tile-Laden Request-Metadaten.
- **Pragmatische Maßnahme:** Karten-/Tile-Register führen und datensparsame Voreinstellung einsetzen (eigener/vertraglich geklärter Dienst oder Zwei-Klick-Aktivierung; sensible GPX erst bewusst laden). Vor WhatsApp-Weiterleitung Empfänger, Nummer, Text/PDF-Link und Alternative (E-Mail/manuell) transparent anzeigen. SMTP-Anbieter, Region, AV/Rolle, Spamfilter und Löschfristen feststellen; TLS verpflichtend konfigurieren (`requireTLS`/SMTPS) und Token kurzlebig/einmalig machen.
- **Abnahme-Evidenz:** Datenflussregister, UX-Hinweis, gewählte Kartenstrategie, SMTP-TLS-Test, Vertrags-/Transferfreigabe.

### G5. DSFA-Vorprüfung, Supportzugriff und Mitarbeitendenprozesse benötigen Betriebsreife

- **Konkrete Aussage:** Eine dokumentierte DSFA-Vorprüfung fehlt. Ebenso fehlen ein verbindlicher Need-to-know-/Break-glass-Prozess für Support und Nachweise zu Vertraulichkeitsverpflichtung, Schulung sowie Joiner-Mover-Leaver. Das Co-Browsing-Dokument ist ausdrücklich nur ein nicht produktives Konzept.
- **Warum relevant:** Die aktuelle Kernplanung löst nicht automatisch eine DSFA aus; Freitexte, Allergie-/Gesundheitsangaben, Standortdaten, viele Vereine oder künftige Aufzeichnungen/Session Replay können das Risiko aber deutlich erhöhen. Plattformzugriffe und Support sind ohne enges Scope-Konzept besonders sensibel [1].
- **Nachgewiesener App-Bezug:** `docs/remote-assistent-co-browsing-konzept.md` verlangt selbst Zustimmung, Whitelist, kurze Sitzung und DSFA-Vorprüfung; Plattformrechte und Tenant-Handoffs sind im Datenmodell vorhanden. Kein Betriebsprozess im Repository gefunden.
- **Pragmatische Maßnahme:** Je Verarbeitung/Release eine DSFA-Vorprüfung mit Kriterien, Ergebnis und Review führen; bei Hochrisikokriterien vollständige DSFA vor Einführung. Support nur ticketbezogen, freigegeben, personengebunden, kurzzeitig und mandanten-/datenscope-minimal zulassen; für kritische Eingriffe Vier-Augen-Prinzip. Vertraulichkeitsverpflichtung vor Zugriff, jährliche Rollen-Schulung, JML-Checkliste und Access-Rezertifizierung verbindlich machen. Kein informelles Co-Browsing einführen.
- **Abnahme-Evidenz:** DSFA-Screening, Support-Runbook/Logs, Schulungsregister, Rechte-Review-Protokoll.

### G6. Überholte OS-Plattform-Verlinkung und Impressums-Prüfpunkt bereinigen

- **Konkrete Aussage:** Der In-App-Impressumsdialog enthält weiterhin einen Link zur EU-OS-Plattform, die mit Wirkung zum 20.07.2025 eingestellt wurde. Öffentliche und In-App-Texte sind dadurch inkonsistent. Die Kernangaben nach § 5 DDG (Name, Anschrift, Telefon, E-Mail) sind vorhanden; weitere Angaben hängen von den tatsächlichen Unternehmensverhältnissen ab.
- **Warum relevant:** Der OS-Link ist zum Prüfzeitpunkt 2026 sachlich überholt. Register-, USt-/Wirtschafts-IdNr., Zulassungs-/Aufsichts- oder Berufsangaben dürfen weder fehlen, wenn einschlägig, noch als unzutreffende Platzhalter erscheinen [3][4].
- **Nachgewiesener App-Bezug:** `ImpressumDialog.tsx:69–77`, `Layout.tsx`; öffentliche Seite und `PublicLegal.tsx` enthalten Basisdaten, aber keinen OS-Abschnitt.
- **Pragmatische Maßnahme:** OS-Plattform-Abschnitt und Link entfernen. Verbraucherschlichtungshinweis nur nach Prüfung der konkret anwendbaren nationalen Pflicht beibehalten. Rechtsform, Register, IDs, Aufsicht, Beruf und audiovisuelle Angebote anhand verbindlicher Unternehmensunterlagen prüfen. Public- und In-App-Texte aus einer gemeinsamen versionierten Quelle ausspielen.
- **Abnahme-Evidenz:** Rechtsdaten-Freigabe, aktualisierte Screenshots beider Ausgabekanäle, kurze Unternehmensdaten-Checkliste.

---

## Blau – danach verbessern und dauerhaft steuern

### B1. Globalen Browser-, CSRF- und Logschutz standardisieren

- **Konkrete Aussage:** Für HTML/API fehlt eine globale Security-Header-Baseline (CSP, HSTS bei gesichertem HTTPS, `frame-ancestors`, `nosniff`, Referrer-/Permissions-Policy). Mehrere Wege loggen vollständige Fehlerobjekte; Redaction, Zugriff und Fristen sind nicht geregelt.
- **Warum relevant:** Dies erhöht Clickjacking-/XSS-Folgerisiken und kann Tokens, Identitäts- oder Fehlerdaten in Logs unnötig verbreiten.
- **Nachgewiesener App-Bezug:** `server/_core/index.ts`, `server/storage.ts`, `server/event-pdf-image-routes.ts`, `server/public-helper-pdf-routes.ts`. Positiv: Cookies sind `HttpOnly`, bei HTTPS `Secure` und `SameSite=Lax`; einzelne Medienrouten setzen gute Header.
- **Pragmatische Maßnahme:** Baseline am Reverse Proxy und in Express testen; für zustandsändernde Anfragen ein Origin-/CSRF-Konzept festlegen. Strukturierte Logs mit Redaction für Token, Cookie/Authorization, E-Mail, Namen und Secrets einführen; Logzugriffe, Fristen und Alarmierung dokumentieren.

### B2. Container- und Lieferkettenhärtung erhöhen

- **Konkrete Aussage:** Das Multi-Stage-Image ist sinnvoll, läuft aber ohne `USER` typischerweise als root; Basisimage ist nicht per Digest fixiert; SBOM und Provenance sind im Publish-Workflow deaktiviert.
- **Warum relevant:** Für einen Dienst mit personenbezogenen Daten sollten Runtime-Privilegien, Patchbarkeit und Artefaktherkunft nachvollziehbar sein.
- **Nachgewiesener App-Bezug:** `Dockerfile`, `.github/workflows/publish-container.yml`, `.dockerignore`. Ein Paket-Audit konnte laut Audit wegen einer Corepack-Signaturstörung nicht ausgeführt werden; daraus folgt ausdrücklich **kein** konkreter Vulnerability-Befund.
- **Pragmatische Maßnahme:** Nichtprivilegierten Runtime-User, read-only Root-Filesystem (mit eng beschränkten Schreibpfaden), Capability-Drop und Limits nutzen. Basisimage per Digest verwalten, SBOM/Provenance einschalten sowie Dependency-/Container-/Secret-Scanning mit Patch-SLA einführen.

### B3. Datei-Lifecycle und alte Medien-/Preview-Pfade aufräumen

- **Konkrete Aussage:** Das Ersetzen/Löschen von Referenzen entfernt nicht durchgehend physische Objekte; eine allgemeine `storageDelete`-/Orphan-Bereinigung ist nicht belegt. Medien werden teilweise serverseitig von Manus-CDN nachgeladen; Debug-Collector läuft nur außerhalb der Produktion, kann aber in Preview/Test personenbezogene Testdaten erfassen.
- **Warum relevant:** Verwaiste Dateien und Testlogs widersprechen dem Ziel eines klaren Datenlebenszyklus. Der Same-Origin-Medienproxy reduziert Browserdatenübermittlungen, der CDN-Abruf bleibt jedoch ein Backend-Lieferantenkontakt.
- **Nachgewiesener App-Bezug:** `server/storage.ts`, GPX-/Logo-Pfade, `server/*-video-routes.ts`, `server/game-asset-routes.ts`, `vite.config.ts`, `server/_core/vite.ts`.
- **Pragmatische Maßnahme:** Ownership/Retention pro Uploadtyp führen, Ersetzen/Löschen physisch kaskadieren und periodisch Orphans bereinigen. Medien in eigenen persistenten oder vertraglich geklärten EU-Speicher migrieren. Preview/Entwicklung als eigene Verarbeitung behandeln: keine Echt-/Zugangsdaten, Zugriff auf `.manus-logs` beschränken und kurze Fristen festlegen.

### B4. Regelmäßige Governance und Wirksamkeitsprüfung institutionalisieren

- **Konkrete Aussage:** Technische Grundlagen sind vorhanden, aber TOM, Rechte-Review, Monitoring, Lieferantenprüfung, Backup-/Restore- und Löschtests sind nicht als wiederkehrender Betriebsnachweis belegt.
- **Warum relevant:** Angemessenheit ist kein einmaliger Dokumentenstand; Rollen, Integrationen und Datenklassen ändern sich laufend [1][5].
- **Nachgewiesener App-Bezug:** `docs/COOLIFY.md` empfiehlt manuelle Sicherung vor Releases; es fehlen im Audit automatisiertes Offsite-Backup, RPO/RTO, Monitoring-/Incident-Prozess und regelmäßige Wirksamkeitsprüfung.
- **Pragmatische Maßnahme:** Jahreskalender mit quartalsweisem Rechte-/Lieferantenreview, halbjährlichem Restore-Test, Löschtest, Security-Header-/Network-Check pro Release, jährlicher Schulung sowie anlassbezogenem VVT-/DSFA-/Rechtstextreview einführen. Prüfartefakte revisionssicher außerhalb des Anwendungscodes speichern.

---

## Vorhandene Schutzansätze und positive Befunde

Die folgenden Punkte sind eine gute Grundlage, **heben die oben genannten Blocker aber nicht auf**:

- Die öffentlichen URLs `/impressum` und `/datenschutz` waren im Audit erreichbar (HTTP 200); die öffentliche Anbieterkennzeichnung enthält Name, postalische Anschrift sowie unmittelbar nutzbare Telefon- und E-Mail-Kontakte.
- Bei den initialen Legal-Seiten-Abrufen wurde kein `Set-Cookie` festgestellt und keine klassische Analyse-/Werbetracker-Einbindung nachgewiesen.
- Zentrale tRPC-Wege besitzen serverseitige Rechte-, Produkt-, Event- und Mandantenprüfungen; es gibt relevante Isolations-/Hardening-Tests.
- Passwörter werden mit bcrypt Kostenfaktor 12 gehasht; Cookies sind `HttpOnly`, bei HTTPS `Secure` und `SameSite=Lax`; Logout widerruft Sitzungen serverseitig, und Änderungen nutzen Sitzungs-Versionierung.
- Die ältere signierte PDF-Route besitzt HMAC-Signatur, Ablaufprüfung und Schutzheader (`no-store`, `no-referrer`, `nosniff`, `noindex/noarchive`). Dieses Muster sollte zum verbindlichen Standard für jede Ausnahmefreigabe werden.
- Kontakt-/Helferlöschungen sind transaktional; zahlreiche Relationen räumen abhängige Daten auf. Teamnotizen (24 Stunden), Tippstatus (8 Sekunden) sowie Restore-Logs (90 Tage/100 Vorgänge) haben bereits begrenzende Mechanismen.
- Uploadpfade normalisieren Schlüssel, verhindern Traversal, begrenzen Größen und prüfen bei Logos Signaturen bzw. SVG-Inhalte grob. Docker-Multistage, `.dockerignore`, Startchecks und Healthcheck sind vorhanden.
- Der reguläre Kartenpfad nutzt nicht Google Maps. Der Google-Maps-Link in der PDF ist ein bloßer Link; erst der Klick des Empfängers führt zu einem Google-Abruf. WhatsApp wird ebenfalls erst durch eine bewusste Nutzeraktion geöffnet.
- Statische Hilfebilder und die meisten Assets werden lokal ausgeliefert; der Same-Origin-Proxy für Manus-Medien reduziert direkte Browserübermittlungen. Forge-/KI-Hilfsfunktionen sind im Code vorhanden, für den Produktkern aber nicht als aktiv konfigurierte Übermittlung nachgewiesen.
- Das nicht produktive Co-Browsing-Konzept enthält datensparsame Leitplanken (keine Bildschirm-/DOM-/Tastatur-/Zwischenablagenübertragung, Zustimmung, Mandantenbindung, Whitelist, kurze Laufzeit).

---

## Empfohlene Freigabereihenfolge und Minimal-Evidenzpaket

| Reihenfolge | Paket | Mindestabschluss vor dem nächsten Schritt |
|---|---|---|
| 1 | **Akute Exposition schließen** | R4 (IDOR), R5/R6 (PDF), R7 (Uploads): Produktionsroute sperren/umbauen, negative Zugriffstests, Rotation betroffener URLs/Tokens. |
| 2 | **Transparenz und Datenminimierung** | R1–R3: freigegebene App-/Demo-Hinweise, lokale Fonts bzw. freigegebene Datenflüsse, Retention für Demo, dokumentierte `sessionStorage`-Entscheidung. |
| 3 | **SaaS-Governance aufsetzen** | R8/R9/R12: Rollenmatrix, AVV, TOM, VVT, Subprozessor-/Transferregister und Incident-Runbook. |
| 4 | **Lebenszyklus und Resilienz operationalisieren** | R10/R11: Datenklassen-/Löschkonzept, DSAR-Verfahren, Backup-Rotation, Restore- und Löschtests. |
| 5 | **Kundenbetrieb härten** | G1–G6: MFA, zentraler Limiter, Passwort-/Session-Policy, Drittservice-UX/Verträge, DSFA-/Support-/Schulungsprozesse, Rechtstextkonsistenz. |
| 6 | **Dauerbetrieb** | B1–B4: Header/Logs, Supply Chain, Datei-/Preview-Bereinigung und regelmäßige Compliance-/Security-Reviews. |

**Mindestfreigabeprotokoll:** Für jeden roten Punkt sollten Produktverantwortung, Technik, Datenschutz/Legal und Betrieb schriftlich festhalten: (a) Maßnahme, (b) Test/Beleg, (c) Restrisiko, (d) Verantwortlicher, (e) Datum und (f) Abhängigkeiten. Offene Betriebs- oder Vertragsfragen dürfen nicht mit einer Codeänderung als erledigt markiert werden.

---

## References

[1] **DSGVO – Verordnung (EU) 2016/679**, insbesondere Art. 5, 12–15, 17–20, 24, 25, 28, 30, 32–35 und 44 ff., amtliche Fassung: <https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679>

[2] **§ 25 TDDDG**, Gesetze im Internet: <https://www.gesetze-im-internet.de/ttdsg/__25.html>

[3] **§ 5 DDG**, Gesetze im Internet: <https://www.gesetze-im-internet.de/ddg/__5.html>

[4] **Verordnung (EU) 2024/3228** zur Einstellung der EU-OS-Plattform, Art. 1–2: <https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=OJ:L_202403228>

[5] **BSI IT-Grundschutz-Kompendium ORP.4 – Identitäts- und Berechtigungsmanagement**: <https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium_Einzel_PDFs_2023/02_ORP_Organisation_und_Personal/ORP_4_Identitaets-_und_Berechtigungsmanagement_Editon_2023.pdf?__blob=publicationFile&v=3>; ergänzend **BSI Zwei-Faktor-Authentisierung**: <https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Informationen-und-Empfehlungen/Cyber-Sicherheitsempfehlungen/Accountschutz/Zwei-Faktor-Authentisierung/zwei-faktor-authentisierung_node.html>

[6] **BfDI/DSK – Orientierungshilfe für Anbieter:innen von digitalen Diensten**, Stand November 2024: <https://www.bfdi.bund.de/SharedDocs/Downloads/DE/DSK/Orientierungshilfen/OH_Digitale-Dienste.pdf?__blob=publicationFile&v=1>

[7] **Durchführungsbeschluss (EU) 2021/914 – Standardvertragsklauseln für Drittlandübermittlungen**, insbesondere Klausel 14: <https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj/deu>; EU-Kommission, Angemessenheitsbeschlüsse: <https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en>

[8] **OpenStreetMap Foundation – Tile Usage Policy**: <https://operations.osmfoundation.org/policies/tiles/>

[9] **Google Datenschutzerklärung** (IP-, Geräte- und Protokolldaten): <https://policies.google.com/privacy?hl=de>

[10] **WhatsApp Datenschutzerklärung EWR**: <https://www.whatsapp.com/legal/privacy-policy-eea>

[11] **Auditgrundlage / Code- und Live-Belege, Stand 01.10.2026:** die fünf bereitgestellten Audit-Ergebnisse; insbesondere `/home/ubuntu/myeifelride/client/index.html`, `client/src/pages/PublicLegal.tsx`, `client/src/components/ImpressumDialog.tsx`, `client/src/pages/ClubDemoLanding.tsx`, `client/src/components/LocationMapClient.tsx`, `client/src/pages/Helpers.tsx`, `client/src/lib/whatsappShare.ts`, `server/routers.ts`, `server/db.ts`, `server/storage.ts`, `server/pdf.ts`, `server/public-helper-pdf-routes.ts`, `server/public-helper-pdf-token.ts`, `server/mail-service.ts`, `server/password-auth.ts`, `server/_core/*`, `server/excel-backup.ts`, `drizzle/schema.ts`, `shared/permissions.ts`, `docs/COOLIFY.md` und `docs/remote-assistent-co-browsing-konzept.md`; Live-Abrufe von `https://mycrewmate.de/impressum`, `https://mycrewmate.de/datenschutz` und `https://app.mycrewmate.de/login` laut Audit.
