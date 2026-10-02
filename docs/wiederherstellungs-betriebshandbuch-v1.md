# MyCrewMate – Wiederherstellungs- und Backup-Betriebshandbuch (Runbook)

**Stand:** 02. Oktober 2026  
**Geltungsbereich:** Plattform- und Vereinsdaten (Coolify, Hetzner Cloud Deutschland, TiDB/MySQL-Datenbank, persistente Dateispeicher)  
**Verantwortlich:** Plattform-Inhaber (`info@mycrewmate.de`)

---

## 1. Sicherungsarchitektur & Standorte

| Komponente | Speicherort | Sicherungszyklus | Aufbewahrung | Verschlüsselung |
|---|---|---|---|---|
| **Relationaler Datenbestand (MySQL/TiDB)** | Hetzner Rechenzentrum Deutschland | Täglich automatisiert in Coolify (konfiguriert) | Nach Coolify-Retention | Gemäß Hetzner/Coolify-Konfiguration |
| **Persistente Uploads (PDF-Logos, Standortbilder, GPX)** | Getrenntes Docker-Volume auf dem Host | **Vor Marktöffnung zu bestätigen** | **Vor Marktöffnung festzulegen** | Infrastrukturkonfiguration dokumentieren |
| **Vertragsnachweise & Audit-Protokolle** | Datenbank (`tenant_contract_acceptances`, `activity_logs`) | Im täglichen Datenbank-Dump enthalten | 12 Monate aktiv, Archiv nach gesetzlichen Fristen | Revisionsfähige SHA-256-Hashes |

---

## 2. Wiederherstellungsszenarien & RTO / RPO

* **RPO (Recovery Point Objective):** Für Datenbankdaten maximal 24 Stunden bei katastrophalem Totalausfall (bezogen auf den bestätigten täglichen Sicherungsstand). Für Uploads erst nach dokumentierter Volume-Sicherung verbindlich festlegen.
* **RTO (Recovery Time Objective):** Wiederherstellung des Kernbetriebs innerhalb von maximal 4 Stunden ab Alarmierung.

### Szenario A: Versehentliche Löschung durch Vereinsadministrator
1. **Prüfung:** Der Verein meldet den Vorfall an `info@mycrewmate.de`.
2. **Identitätsprüfung:** Bestätigung über die im Masterportal hinterlegte Admin-E-Mail oder Telefonnummer.
3. **Wiederherstellung:**
   * Dump des Vortags in einer isolierten Staging-Datenbank einspielen.
   * Betroffene Datensätze (z. B. Helfer, Schichten, Planungsbereiche) mandantenscharf über die `tenantId` selektieren.
   * Rückübertrag in die Produktivdatenbank per transaktionalem SQL-Skript.
4. **Dokumentation:** Eintrag im Sicherheits- und Audit-Logbuch.

### Szenario B: Vollständiger Serverausfall (Bare Metal / Host)
1. Bereitstellung eines neuen Linux-Hosts im Hetzner Rechenzentrum Deutschland.
2. Installation von Coolify und Einbindung des Git-Repositories `clambrich-gif/mycrewmate`.
3. Einspielen des letzten validierten Datenbank-Dumps über Coolify Database Restore.
4. Wiederherstellung des Upload-Volumes aus dem zuletzt erfolgreich geprüften Volume-Snapshot.
5. Zuweisung der DNS-Einträge (`www.mycrewmate.de`, `app.mycrewmate.de`).
6. Funktionstest über die Health-Check-Route `/api/trpc/system.health`.

---

## 3. Periodischer Wiederherstellungstest (Halbjährlich)

| Schritt | Prüfpunkt | Bestanden-Kriterium |
|---|---|---|
| 1 | Dump-Download aus Coolify | Datei ist vollständig, nicht beschädigt und lesbar |
| 2 | Test-Restore in temporärer Instanz | Schema 0001–0086 wird fehlerfrei geladen |
| 3 | Integritätsprüfung Mandanten | Pilotverein und Testvereine sind mit allen FKs konsistent |
| 4 | Upload-Snapshot testen | Mindestens eine PDF-/Bild-/GPX-Datei ist in der isolierten Instanz verfügbar |
| 5 | Wiederherstellungsprotokoll ablegen | Datum, Prüfer und Dauer werden in dieser Betriebsmappe dokumentiert |

---

## 4. Eskalationskette & Meldewege

* **Primärer Kontakt:** Christian Lamprich (`info@mycrewmate.de`)
* **Datenschutzvorfälle (Art. 33 DSGVO):** Ersteinschätzung binnen 24 Stunden, Meldung an Aufsichtsbehörde (LfDI RLP) binnen 72 Stunden gemäß Runbook.
