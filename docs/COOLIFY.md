# MyCrewMate auf Coolify betreiben

Diese Anleitung beschreibt den eigenständigen Produktionsbetrieb von MyCrewMate auf `mycrewmate.de`. Sie gilt für das Dockerfile im Repository und vermeidet Abhängigkeiten von Manus Storage, Manus-OAuth und Manus-Runtime-Assets.

## Voraussetzungen

| Bestandteil | Anforderung | Zweck |
|---|---|---|
| Coolify-Anwendung | Quelle: GitHub-Repository, Build Pack: Dockerfile | Baut und startet die App reproduzierbar. |
| MySQL oder MariaDB | Netzwerkzugriff vom App-Container | Speichert alle Planungs-, Nutzer- und Protokolldaten. |
| Persistentes Coolify-Volume | Zielpfad `/app/data` | Bewahrt hochgeladene Dateien über Containerwechsel hinweg. |
| Domain | `mycrewmate.de` mit HTTPS | Sichere, Same-Origin-Sitzungscookies und PWA. |

## Coolify-Konfiguration

### 1. Anwendung

Legen Sie eine neue Anwendung aus dem GitHub-Repository an und wählen Sie **Dockerfile**. Es ist kein eigener Build- oder Startbefehl erforderlich. Das Dockerfile baut das Frontend, bündelt den Node-Server und startet mit `pnpm start:coolify`.

| Feld in Coolify | Wert |
|---|---|
| Exposed Port | `3000` |
| Health Check Path | `/healthz` |
| Persistent Volume | `/app/data` |
| Restart Policy | Always / Unless stopped |

> Das Volume darf nicht nach `/app` selbst gemountet werden, da sonst der gebaute Anwendungscode überdeckt wird. Verwenden Sie ausschließlich `/app/data`.

### 2. Umgebungsvariablen

| Variable | Pflicht | Beispiel / Hinweis |
|---|---:|---|
| `DATABASE_URL` | Ja | `mysql://USER:PASSWORT@mysql:3306/mycrewmate` – URL-kodieren Sie Sonderzeichen im Passwort. |
| `JWT_SECRET` | Ja | Mindestens 32 zufällige Zeichen. Mit `openssl rand -base64 48` erzeugen. Ein Wechsel macht alle bestehenden Sitzungen ungültig. |
| `LOCAL_STORAGE_PATH` | Empfohlen | `/app/data/uploads`; dies ist im Dockerfile bereits voreingestellt. |
| `PORT` | Nein | Standard `3000`; Coolify setzt bei Bedarf einen eigenen Wert. |
| `MYCREWMATE_APP_ID` | Nein | Optionaler stabiler Kennzeichner für signierte Sitzungen. Standard: `mycrewmate-selfhosted`. |
| `ADMIN_RECOVERY_KEY` | Nein | Separater langer Geheimwert für die Administrator-Recovery, falls verwendet. |

Nicht erforderlich sind `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` und Manus-Storage-Variablen.

### 3. Datenbank und Migrationen

Der Container führt vor dem Webstart `pnpm db:migrate` aus. Dadurch werden die eingecheckten Dateien unter `drizzle/` in ihrer Journal-Reihenfolge angewendet. Der Befehl ist wiederholbar: bereits angewendete Migrationen werden übersprungen.

Vor einem produktiven Erststart empfiehlt sich eine leere Datenbank, die ausschließlich MyCrewMate gehört. Geben Sie dem Datenbankkonto Rechte für Tabellen, Indizes und die Drizzle-Migrationstabelle. MyCrewMate startet in Produktion absichtlich nicht, wenn `DATABASE_URL` oder `JWT_SECRET` fehlen.

## Dateiablage und Altbestände

| Dateiart | Ziel im Eigenbetrieb | Schutz |
|---|---|---|
| MyCrewMate-Markenlogo, PWA-Icons, Hilfebilder | Im Git-Repository: `client/public/` | Öffentlich statisch, ohne externe Storage-URL. |
| Vereins- und Standortlogos | `/app/data/uploads/tenant-logos` bzw. `location-logos` | Nur über authentifizierte Same-Origin-Routen. |
| Event-/PDF-Logos | `/app/data/uploads/pdf-logos` | Nicht direkt öffentlich abrufbar. |
| GPX-Dateien | `/app/data/uploads/gpx-tracks` | Über die App verarbeitet. |
| Handbuch | Im Image unter `client/public/handbook/`; optional im Volume überschreibbar | Authentifizierter Download. |

Bestehende, früher in Manus Storage gespeicherte Uploads werden nicht automatisch auf den eigenen Server kopiert. Falls sie weiterhin benötigt werden, laden Sie sie in MyCrewMate erneut hoch oder kopieren Sie sie einmalig unter Beibehaltung des in der Datenbank gespeicherten Dateischlüssels in das Volume. Die Datenbank allein enthält keine Dateibytes.

## Diagnose

| Symptom | Prüfung | Behebung |
|---|---|---|
| Oberfläche lädt, Eingaben/API reagieren nicht | Coolify-Logs und `/healthz` prüfen; `DATABASE_URL` kontrollieren | Datenbankdienst und Netzwerkverbindung herstellen; Container neu deployen. |
| Anmeldung hält nicht | Browser-DevTools auf Cookie prüfen; HTTPS/Domain prüfen | `JWT_SECRET` setzen und Domain ausschließlich über HTTPS betreiben. |
| Logo oder GPX fehlt | Volume-Mount und Dateischlüssel prüfen | `/app/data` dauerhaft mounten; Datei erneut hochladen oder Altbestand übertragen. |
| Migration schlägt fehl | Containerlogs mit `drizzle-kit migrate` prüfen | Datenbankrechte/URL korrigieren; keine alten Migrationen umbenennen oder löschen. |
| Nach Update fehlen Dateien | Volume prüfen | `/app/data` als persistenten Mount verwenden, nicht als temporären Containerpfad. |

## Sichere Updates über GitHub

1. Änderungen werden in Manus getestet und auf den `main`-Branch übertragen: `git push github main`.
2. Coolify zieht den Commit nach manuellem **Redeploy** oder über einen aktivierten GitHub-Webhook.
3. Der Container baut neu. Persistente Datenbank und `/app/data` bleiben außerhalb des Images und unverändert.
4. Der Start führt nur ausstehende Migrationen aus und startet danach den Server.

> Sichern Sie Datenbank und `/app/data` vor größeren Releases getrennt. Ein JSON-Planungsexport ersetzt kein vollständiges Datenbank- und Upload-Backup.

## Lokaler Produktionscheck

```bash
corepack enable
pnpm install --frozen-lockfile
# DATABASE_URL und JWT_SECRET als Umgebungsvariablen setzen
pnpm db:migrate
pnpm build
NODE_ENV=production pnpm start
```

Anschließend muss `curl http://127.0.0.1:3000/healthz` den Status `200` liefern.
