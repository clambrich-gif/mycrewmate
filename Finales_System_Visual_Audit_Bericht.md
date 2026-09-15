# Finales System- & Visual-Audit: RSC Helferplanung (15. September 2026)

**Prüfdatum:** 15. September 2026, 13:54 Uhr  
**Prüfmodus:** Vollständig schreibgeschützt (Read-Only). Es wurden keinerlei Quellcodedateien, Datenbankeinträge, Schemata oder Konfigurationen modifiziert.  
**Systemzustand bei Prüfung:** 237 Vitest-Tests erfolgreich, TypeScript-Check (`pnpm check`) fehlerfrei, Produktionsbuild (`pnpm build`) erfolgreich, Drizzle-Kit-Prüfung fehlerfrei, Git-Status sauber (`HEAD` bei Checkpoint `8f2e0322`).

---

## 1. Management Summary & Prioritätenmatrix

Das finale System- und Visual-Audit der Webanwendung **RSC Helferplanung** wurde über alle sechs geforderten Kernbereiche hinweg schreibgeschützt durchgeführt. Die jüngsten Optimierungen an den mobilen 2-Spalten-Kopfzeilen, den 16px-Eingabefeldern und den PWA-Installationsdialogen greifen fehlerfrei. Zugleich zeigen die Quell- und Laufzeitanalysen konkrete Risiken in den Bereichen Datenbank-Konsistenz, Chat-Skalierung, Re-Authentifizierung und semantisches Aktionsstyling auf.

### Prioritätenübersicht

| Priorität | Bereich | Befund / Risiko | Betroffene Komponenten |
| :--- | :--- | :--- | :--- |
| **[KRITISCH]** | 2. Datenbankintegrität | **Migrationsjournal enthält mehrfache doppelte Tags und Indizes.** Das Journal führt Einträge 22, 23 und 24 doppelt mit abweichenden Zeitstempeln, während im SQL-Ordner nur jeweils eine Datei existiert. | `drizzle/meta/_journal.json`, `drizzle/0022_...` bis `0024_...` |
| **[WARNUNG]** | 1. Import & Parsing | **Excel-Header-Leerzeichen führen zu silent data drop.** Überschriften wie `Name ` oder `E-Mail ` bestehen die Prüfung `trim()`, erzeugen aber abweichende JSON-Schlüssel und leeren Werte. | `server/module-excel-import.ts` |
| **[WARNUNG]** | 2. Datenbankintegrität | **Kontakt-Fremdschlüssel sind nur einspaltig angebunden.** In Migration 0024 wurden zusammengesetzte FKs `(contactId, eventId, year)` auf reine `contactId` reduziert. | `drizzle/schema.ts`, `helpers`, `shift_area_contacts` |
| **[WARNUNG]** | 3. Live-Chat & Polling | **Chat-Snapshot liest ab 151 Nachrichten nur alte Einträge.** Durch aufsteigende Sortierung mit Limit 150 fallen neuere und wichtige Nachrichten aus dem aktiven Snapshot heraus. | `client/src/components/Layout.tsx`, `server/db.ts` |
| **[WARNUNG]** | 3. Live-Chat & Polling | **Typing-Status kann durch ungeschützte Race Conditions reanimiert werden.** Ein verzögertes `typing=true` überschreibt serverseitig ein früheres `typing=false`. | `client/src/components/LiveChatWidget.tsx`, `server/db.ts` |
| **[WARNUNG]** | 4. Mobile UX | **Touch-Ziele fallen ab 768px unter 44px.** Buttons und Selects reduzieren ihre Höhe ab Breakpoint `md` auf 36px, obwohl Tablets bis 1024px als Touchgeräte gelten. | `client/src/components/ui/button.tsx`, `select.tsx` |
| **[WARNUNG]** | 4. Mobile UX | **Spaltensortierung der Helfertabelle ist per Tastatur nicht erreichbar.** Der Tabellenkopf nutzt ein reines `th` mit Klick-Handler ohne Button, Tabindex oder `aria-sort`. | `client/src/pages/Helpers.tsx` |
| **[WARNUNG]** | 5. Layout & Styling | **Das semantische Mint-/Matt-Rot-Konzept ist unvollständig umgesetzt.** Import-Buttons sind weiß/blau; die Farbgebung widerspricht der früheren Rücknahme neutraler Buttons. | `client/src/components/ModuleExcelImportButton.tsx`, `ResetAreaButton.tsx` |
| **[WARNUNG]** | 6. Rechte & Rollen | **Irreversible Einzellöschungen durch Admins verlangen keine Re-Authentifizierung.** Im Gegensatz zu Bereichs-Resets genügen für Schicht- und Aufgabenlöschungen einfache Admin-Rechte. | `server/routers.ts` (`shifts.remove`, `prep.remove`, etc.) |
| **[WARNUNG]** | 6. Rechte & Rollen | **Passwortänderungen im Adminbereich verlangen kein aktuelles Passwort.** Eine übernommene Sitzung kann Passwörter ohne Kenntnis des bisherigen Kennworts überschreiben. | `server/routers.ts` (`auth.setPassword`, `auth.setAdminPassword`) |
| **[WARNUNG]** | 6. Rechte & Rollen | **Logout meldet Erfolg auch bei fehlschlagendem Session-Widerruf.** Ein DB-Fehler beim Widerruf wird nur geloggt; der Client erhält dennoch ein Erfolgs-Feedback. | `server/routers.ts` (`auth.logout`) |
| **[WARNUNG]** | 6. Rechte & Rollen | **Frei wählbare Chat-Absendernamen ermöglichen Personenfälschung.** Das System erzwingt die Rolle, gestattet aber die beliebige Eingabe fremder Personennamen. | `client/src/components/LiveChatWidget.tsx`, `server/routers.ts` |
| **[OPTIMIERUNG]** | 1. Import & Parsing | **Excel-Backup-Parser korrigiert veraltete Blattbereiche nicht.** `sheet_to_json` in `excel-backup.ts` nutzt kein Range-Normalizing wie im Modulimport. | `server/excel-backup.ts` |
| **[OPTIMIERUNG]** | 3. Live-Chat & Polling | **5s-Polling läuft in inaktiven Hintergrund-Tabs ungebremst weiter.** Verursacht unnötige Abfragen, obwohl die Online-Präsenz dort bereits pausiert wird. | `client/src/components/Layout.tsx` |
| **[OPTIMIERUNG]** | 4. Mobile UX | **PWA-Safe-Areas werden nicht durch `viewport-fit=cover` aktiviert.** Insets wie `env(safe-area-inset-bottom)` wirken in Standard-Viewports nur defensiv. | `client/index.html`, `LiveChatWidget.tsx` |
| **[OPTIMIERUNG]** | 6. Rechte & Rollen | **Rate-Limiter und Cooldowns arbeiten nur im lokalen Arbeitsspeicher.** Ein Server-Neustart setzt Zähler und Sperrzeiten vorzeitig zurück. | `server/password-auth.ts` |

---

## 2. Detaillierte Prüfbefunde nach Kernbereichen

### Bereich 1: Excel-Import/Export, Projektdateien & Daten-Parsing

1. **[WARNUNG] Leerzeichen in Tabellenüberschriften führen zu leer gelesenen Zeilen**
   * *Befund:* In `server/module-excel-import.ts:87-113` werden Kopfzeilen mit `.trim()` validiert. Beim Auslesen der Daten via `XLSX.utils.sheet_to_json` in Zeile 574–577 wird jedoch die Originalzeile ohne Schlüsselnormalisierung genutzt.
   * *Auswirkung:* Eine Tabellenspalte `Name ` oder `E-Mail ` besteht die Prüfung, wird aber als `row["Name "]` statt `row.Name` erfasst. Bei Ansprechpartnern werden Zeilen dadurch als leer interpretiert und in der Vorschau fälschlicherweise als Massenlöschung deklariert.
   * *Empfehlung:* Header vor dem Einlesen auf kanonische Schlüssel abbilden oder strikt gegen Whitespace abgleichen.

2. **[OPTIMIERUNG] Veraltete Blattbereichsangaben im Legacy-Backup-Parser**
   * *Befund:* In `server/excel-backup.ts:389-401` fehlt die Bereichsnormalisierung `normalizeModuleSheetRange`, die im Modulimport (`server/module-excel-import.ts:126-159`) bereits erfolgreich vor abgeschnittenen Tabellenzeilen schützt.
   * *Auswirkung:* Werden Projektdateien über alte Backup-Routinen eingelesen, können Zeilen außerhalb eines statischen `!ref`-Bereichs verloren gehen.
   * *Empfehlung:* Den Bereichsabgleich als gemeinsame Hilfsfunktion bereitstellen oder nicht mehr genutzte Altexporte vollständig entfernen.

---

### Bereich 2: Datenbank-Integrität, Kaskadierendes Löschen & Cleanup

1. **[KRITISCH] Asynchrones und inkonsistentes Drizzle-Migrationsjournal**
   * *Befund:* Die Datei `drizzle/meta/_journal.json` enthält für die Einträge 22, 23 und 24 doppelte Migrationstags mit unterschiedlichen Zeitstempeln (`1789420369793` vs. `1789420491728`). Im Dateisystem existiert die Migrationsdatei `0024_brown_rage.sql` jedoch nur einfach.
   * *Auswirkung:* Bei künftigen Schemagenerierungen oder automatisierten Neu-Deployments kann Drizzle inkonsistente Zustände annehmen oder versuchen, bereits bestehende Tabellenelemente erneut anzulegen.
   * *Empfehlung:* Das Journal vor neuen Migrationen auf eine streng fortlaufende, eindeutige Kette bereinigen.

2. **[WARNUNG] Reduzierung der zusammengesetzten Fremdschlüssel auf contacts**
   * *Befund:* Migration `0024_brown_rage.sql` hat die Integritäts-Fremdschlüssel `helpers_contact_event_year_fk` und `shift_area_contacts_contact_event_year_fk` entfernt und durch einfache Fremdschlüssel auf `contacts.id` ersetzt.
   * *Auswirkung:* Auf Datenbankebene wird nicht mehr garantiert, dass ein Helfer oder Bereichsansprechpartner zwingend mit einem Kontakt desselben Jahres und derselben Veranstaltung verknüpft ist. Zwar sichert der Anwendungscode dies ab, die relationale Schutzgrenze in der Datenbank ist jedoch geschwächt.
   * *Empfehlung:* Die zusammengesetzten Fremdschlüssel `(contactId, eventId, year)` auf Datenbankebene reaktivieren.

3. **Status des 24h-Chat-Cleanups:**
   * *Befund:* Die Überprüfung über `manus-heartbeat list` ergab, dass der periodische Cleanup-Job `team-notes-cleanup` mit Task-UID `aX92k9u88aLRBfk89oEqkc` aktiv registriert ist, stündlich ausgeführt wird (`0 0 * * * *`) und zuletzt erfolgreich gelaufen ist. Die Datenbank verfügt über die passenden zeitbasierten Indizes `team_notes_created_at_cleanup_idx` und `team_note_typings_updated_at_cleanup_idx`.

---

### Bereich 3: Live-Chat / Notiz-Widget & Polling

1. **[WARNUNG] Begrenzung auf 150 Nachrichten verhindert Anzeige neuer Meldungen**
   * *Befund:* In `client/src/components/Layout.tsx:274` wird der Snapshot mit `{ limit: 150 }` abgefragt. `server/db.ts:2511-2521` sortiert nach `id ASC` und limitiert auf 150.
   * *Auswirkung:* Sobald innerhalb des 24h-Fensters mehr als 150 Nachrichten auflaufen, liefert die Datenbank stets die ältesten 150 Einträge. Neu hinzukommende Nachrichten und wichtige Ankündigungen werden im Client weder angezeigt noch lösen sie Warntöne oder Badges aus.
   * *Empfehlung:* Sortierung auf `id DESC` mit Umkehrung im Client umstellen oder auf einen inkrementellen Cursor (`sinceId`) wechseln.

2. **[WARNUNG] Race Condition bei schnellem Wechsel des Tippstatus**
   * *Befund:* `LiveChatWidget.tsx:237-248` feuert `notes.typing` ungesperrt. Ein beim Verlassen oder Minimieren des Widgets gesendetes `false` kann durch Netzwerkverzögerung vor einem früheren `true` eintreffen.
   * *Auswirkung:* Der Benutzer wird auf anderen Bildschirmen bis zum Ablauf der 8-Sekunden-TTL fälschlicherweise als "tippt gerade..." angezeigt.
   * *Empfehlung:* Tippmutationen mit AbortController abbrechen oder serverseitig Sequenznummern/Zeitstempel je Session berücksichtigen.

3. **[OPTIMIERUNG] Ununterbrochenes Polling in minimierten Hintergrund-Tabs**
   * *Befund:* Das 5-Sekunden-Intervall in `Layout.tsx:338-349` läuft ungedrosselt weiter, auch wenn der Browser-Tab inaktiv (`document.hidden`) oder das Chat-Widget geschlossen ist.
   * *Auswirkung:* Unnötige Datenbanklast auf dem Server, während das Präsenz-Tracking in Hintergrund-Tabs bereits vorbildlich pausiert.
   * *Empfehlung:* Abfrageintervall bei inaktiven Tabs auf 30–60 Sekunden reduzieren.

---

### Bereich 4: Mobile UX & Viewports

1. **[WARNUNG] Touch-Targets sinken ab 768px Viewportbreite unter 44 Pixel**
   * *Befund:* In `client/src/components/ui/button.tsx:8` und `select.tsx:38` werden Mindestmaße ab Breakpoint `md` auf Standardwerte (36px / 32px) zurückgesetzt. Die CSS-Regel für 16px-Schriften gilt dagegen bis `1024px`.
   * *Auswirkung:* Auf Tablets (z. B. iPads im Hoch- und Querformat) sind Buttons und Dropdowns kleiner als 44px, was zu Fehleingaben führen kann.
   * *Empfehlung:* Touch-Targets primär über Media-Queries wie `(pointer: coarse)` steuern statt ausschließlich an Bildschirmbreiten zu koppeln.

2. **[WARNUNG] Tabellensortierung in der Helferübersicht nicht tastaturzugänglich**
   * *Befund:* In `client/src/pages/Helpers.tsx:539-543` ist der Spaltenkopf "Name" als klickbares `<th>` deklariert, besitzt jedoch weder Tastatur-Handler (`onKeyDown`) noch ein interaktives Button-Element oder `aria-sort`.
   * *Auswirkung:* Reine Tastaturnutzer oder Screenreader können die Namenssortierung nicht bedienen.
   * *Empfehlung:* Sortierbare Tabellenköpfe mit regulären Buttons und Barrierefreiheitsattributen ausstatten.

3. **[OPTIMIERUNG] PWA-Vollbild ohne explizites viewport-fit**
   * *Befund:* `client/index.html` definiert Standard-Viewports ohne `viewport-fit=cover`, obwohl im Chat `env(safe-area-inset-bottom)` bereits hinterlegt ist.
   * *Auswirkung:* In installierten iOS-PWAs wirken Aussparungen und Home-Balken defensiv, nutzen den Bildschirmrand aber nicht randlos aus.

---

### Bereich 5: UI-Layout & Farbkonzept (Desktop vs. Mobil)

1. **[WARNUNG] Status des semantischen Farbkonzepts (Mint / Matt-Rot)**
   * *Befund:* Der Prüfauftrag verlangt Matt-Mintgrün für Import/Uploads und Matt-Rot für Löschen/Zurücksetzen. In der Codebasis wurde diese Farbgebung nach dem Checkpoint `24e4d5e7` auf ausdrücklichen Wunsch in Checkpoint `71d2fd20` zurückgenommen (neutrale weiße Outline-Buttons, um eine optische Überfrachtung zu vermeiden).
   * *Ist-Zustand:* Import-Buttons sind dezent weiß mit blauem Bestätigungsdialog; Reset-Buttons besitzen rote Text-/Rahmen-Akzente; finale Löschbuttons sind signalrot (`red-600`).
   * *Empfehlung:* Vor einer erneuten Einfärbung sollte verbindlich geklärt werden, ob das semantische Farbmuster gewünscht ist oder der bewährte neutrale Zustand beibehalten werden soll.

2. **Desktop-Breite der Einsatzplantabelle:**
   * *Messung:* Die Einsatzplantabelle nutzt die Containerbreite voll aus (`w-full`). Bei einer Bildschirmbreite von 1280px beträgt die Tabellenbreite 1477px, sodass wie vorgesehen horizontales Scrollen innerhalb der Karte greift, während auf Displays ab 1500px alle Spalten ohne Scrollbalken nebeneinanderstehen.

---

### Bereich 6: Rechte, Rollen & Passwort-Schutz

1. **[WARNUNG] Fehlende Re-Authentifizierung bei irreversiblen Admin-Aktionen**
   * *Befund:* Während Bereichs-Resets und das Chat-Leeren ein Admin-Passwort erzwingen, sind Einzellöschungen (`shifts.remove`, `prep.remove`, `materials.remove` etc.) in `server/routers.ts` nur durch die allgemeine Admin-Session geschützt.
   * *Auswirkung:* Eine verwaiste oder ungesperrte Admin-Sitzung ermöglicht das punktuelle Löschen von Schichten und Aufgaben ohne erneute Passwortabfrage.
   * *Empfehlung:* Für kritische Löschvorgänge eine einheitliche Re-Authentifizierung vorsehen oder Sitzungs-Timeouts verkürzen.

2. **[WARNUNG] Passwortänderungen ohne Abfrage des aktuellen Kennworts**
   * *Befund:* In `server/routers.ts:538-548` können Administratoren das Planungsteam- und Administrator-Passwort direkt überschreiben, ohne das bisherige Kennwort einzugeben.
   * *Auswirkung:* Ein Angreifer mit kurzzeitigem Zugriff auf ein Admin-Gerät kann den Administratorzugang dauerhaft an sich reißen.
   * *Empfehlung:* Passwortwechsel zwingend an die Bestätigung des aktuellen Administratorpassworts binden.

3. **[WARNUNG] Fehlertoleranter Logout mit inkonsistentem Server-Widerruf**
   * *Befund:* In `server/routers.ts:558-575` fängt `auth.logout` Datenbankfehler beim Session-Widerruf ab und meldet dem Client dennoch `{ success: true }`.
   * *Auswirkung:* Schlägt der Datenbankzugriff fehl, wird zwar das Cookie gelöscht, das JWT-Token bleibt serverseitig jedoch bis zu seinem natürlichen Ablauf gültig.

4. **[WARNUNG] Frei wählbare Chat-Identitäten ohne Identitätsnachweis**
   * *Befund:* `LiveChatWidget.tsx` gestattet die Eingabe freier Namen, die in `server/routers.ts:1602-1619` ungeprüft in die Datenbank übernommen werden.
   * *Auswirkung:* Organisationsmitglieder können Nachrichten unter dem Namen anderer Personen verfassen.

---

## 3. Empfohlener Fahrplan für Folgeschritte

Sobald die Freigabe vorliegt, wird folgende sequenzielle Abarbeitung empfohlen:

1. **Schritt 1 (Datenbank & Migrationsstabilität - Priorität KRITISCH):**
   * Bereinigung des Migrationsjournals `_journal.json` von doppelten Tags.
   * Wiederherstellung der zusammengesetzten Fremdschlüssel auf `contacts`.
2. **Schritt 2 (Sicherheit & Authentifizierung - Priorität HOCH):**
   * Re-Authentifizierung für Passwortwechsel und sensible Einzellöschungen.
   * Striktes Widerrufs-Handling beim Logout.
3. **Schritt 3 (Live-Chat & Datenkonsistenz - Priorität MITTEL):**
   * Umstellung der Chat-Snapshot-Abfrage auf neueste Nachrichten (Fix für das 150-Nachrichten-Limit).
   * Header-Normalisierung bei Excel-Importen gegen versehentliche Leerzeilen/Leerzeichen.
4. **Schritt 4 (UI-Konsistenz & Barrierefreiheit - Priorität OPTIMIERUNG):**
   * Grundsatzentscheidung zum semantischen Farbkonzept (Mint/Rot vs. Neutral).
   * Tastaturbedienbare Tabellenköpfe und Touch-Flächen für Tablet-Viewports.
