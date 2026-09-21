# MyCrewMate auf Coolify betreiben

Diese Anleitung beschreibt den eigenständigen Produktionsbetrieb von MyCrewMate auf `mycrewmate.de`. Sie vermeidet Abhängigkeiten von Manus Storage, Manus-OAuth und Manus-Runtime-Assets.

## Empfohlen: Image extern über GitHub Actions bauen

Ein lokaler Node-/Vite-Docker-Build kann kleine Coolify-Server kurzzeitig stark belasten. Das Repository enthält daher den Workflow [`.github/workflows/publish-container.yml`](../.github/workflows/publish-container.yml). Bei jedem Push nach `main` baut er das Image auf einem GitHub-Runner und veröffentlicht es als:

```text
ghcr.io/clambrich-gif/mycrewmate:latest
```

Wählen Sie in Coolify dann als Quelle **Docker Image** und tragen Sie diese Image-Adresse ein. Coolify muss das fertige Image nur noch herunterladen und starten; der speicherintensive Build entfällt auf dem eigenen Server. Warten Sie vor dem ersten Pull den erfolgreichen Lauf unter **GitHub → Actions → MyCrewMate – Container veröffentlichen** ab.

> Das GHCR-Paket kann beim ersten Publish privat angelegt werden. Für ein privates Paket hinterlegen Sie in Coolify eine GHCR-Registry mit GitHub-Benutzername und einem Classic Personal Access Token mit `read:packages`. Alternativ kann das Paket in GitHub unter **Packages → mycrewmate → Package settings** auf öffentlich gestellt werden.

## Voraussetzungen

| Bestandteil                 | Anforderung                                                                    | Zweck                                                      |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Coolify-Anwendung           | Bevorzugt: Docker Image; alternativ: GitHub-Repository, Build Pack: Dockerfile | Lädt das fertige Image oder baut es lokal.                 |
| MySQL oder MariaDB          | Netzwerkzugriff vom App-Container                                              | Speichert alle Planungs-, Nutzer- und Protokolldaten.      |
| Persistentes Coolify-Volume | Zielpfad `/app/data`                                                           | Bewahrt hochgeladene Dateien über Containerwechsel hinweg. |
| Domain                      | `mycrewmate.de` mit HTTPS                                                      | Sichere, Same-Origin-Sitzungscookies und PWA.              |

## Coolify-Konfiguration

### 1. Anwendung

Für den empfohlenen Weg legen Sie eine Anwendung mit der Quelle **Docker Image** an und verwenden `ghcr.io/clambrich-gif/mycrewmate:latest`. Es ist kein Build- oder Startbefehl erforderlich. Das Image startet automatisch die ausstehenden Drizzle-Migrationen und anschließend den Server.

Die lokale Alternative bleibt möglich: Legen Sie eine Anwendung aus dem GitHub-Repository an und wählen Sie **Dockerfile**. Das Dockerfile begrenzt dabei den Build-Heap auf 512 MB und entfernt nach dem Build Entwicklungsabhängigkeiten.

| Feld in Coolify   | Wert                    |
| ----------------- | ----------------------- |
| Exposed Port      | `3000`                  |
| Health Check Path | `/healthz`              |
| Persistent Volume | `/app/data`             |
| Restart Policy    | Always / Unless stopped |

> Das Volume darf nicht nach `/app` selbst gemountet werden, da sonst der gebaute Anwendungscode überdeckt wird. Verwenden Sie ausschließlich `/app/data`.

### 2. Umgebungsvariablen

| Variable             |   Pflicht | Beispiel / Hinweis                                                                                                              |
| -------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       |        Ja | `mysql://USER:PASSWORT@mysql:3306/mycrewmate` – URL-kodieren Sie Sonderzeichen im Passwort.                                     |
| `JWT_SECRET`         |        Ja | Mindestens 32 zufällige Zeichen. Mit `openssl rand -base64 48` erzeugen. Ein Wechsel macht alle bestehenden Sitzungen ungültig. |
| `LOCAL_STORAGE_PATH` | Empfohlen | `/app/data/uploads`; dies ist im Dockerfile bereits voreingestellt.                                                             |
| `PORT`               |      Nein | Standard `3000`; Coolify setzt bei Bedarf einen eigenen Wert.                                                                   |
| `MYCREWMATE_APP_ID`  |      Nein | Optionaler stabiler Kennzeichner für signierte Sitzungen. Standard: `mycrewmate-selfhosted`.                                    |
| `ADMIN_RECOVERY_KEY` |      Nein | Separater langer Geheimwert für die Administrator-Recovery, falls verwendet.                                                    |

Nicht erforderlich sind `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` und Manus-Storage-Variablen.

### 3. Datenbank und Migrationen

Der Container führt vor dem Webstart `drizzle-kit migrate` aus. Dadurch werden die eingecheckten Dateien unter `drizzle/` in ihrer Journal-Reihenfolge angewendet. Der Befehl ist wiederholbar: bereits angewendete Migrationen werden übersprungen.

Vor einem produktiven Erststart empfiehlt sich eine leere Datenbank, die ausschließlich MyCrewMate gehört. Geben Sie dem Datenbankkonto Rechte für Tabellen, Indizes und die Drizzle-Migrationstabelle. MyCrewMate startet in Produktion absichtlich nicht, wenn `DATABASE_URL` oder `JWT_SECRET` fehlen.

## Dateiablage und Altbestände

| Dateiart                                      | Ziel im Eigenbetrieb                                                        | Schutz                                         |
| --------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| MyCrewMate-Markenlogo, PWA-Icons, Hilfebilder | Im Git-Repository: `client/public/`                                         | Öffentlich statisch, ohne externe Storage-URL. |
| Vereins- und Standortlogos                    | `/app/data/uploads/tenant-logos` bzw. `location-logos`                      | Nur über authentifizierte Same-Origin-Routen.  |
| Event-/PDF-Logos                              | `/app/data/uploads/pdf-logos`                                               | Nicht direkt öffentlich abrufbar.              |
| GPX-Dateien                                   | `/app/data/uploads/gpx-tracks`                                              | Über die App verarbeitet.                      |
| Handbuch                                      | Im Image unter `client/public/handbook/`; optional im Volume überschreibbar | Authentifizierter Download.                    |

Bestehende, früher in Manus Storage gespeicherte Uploads werden nicht automatisch auf den eigenen Server kopiert. Falls sie weiterhin benötigt werden, laden Sie sie in MyCrewMate erneut hoch oder kopieren Sie sie einmalig unter Beibehaltung des in der Datenbank gespeicherten Dateischlüssels in das Volume. Die Datenbank allein enthält keine Dateibytes.

## Diagnose

| Symptom                                                  | Prüfung                                                          | Behebung                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oberfläche lädt, Eingaben/API reagieren nicht            | Coolify-Logs und `/healthz` prüfen; `DATABASE_URL` kontrollieren | Datenbankdienst und Netzwerkverbindung herstellen; Container neu deployen.                                                                        |
| Anmeldung hält nicht                                     | Browser-DevTools auf Cookie prüfen; HTTPS/Domain prüfen          | `JWT_SECRET` setzen und Domain ausschließlich über HTTPS betreiben.                                                                               |
| Logo oder GPX fehlt                                      | Volume-Mount und Dateischlüssel prüfen                           | `/app/data` dauerhaft mounten; Datei erneut hochladen oder Altbestand übertragen.                                                                 |
| Migration schlägt fehl                                   | Containerlogs mit `drizzle-kit migrate` prüfen                   | Datenbankrechte/URL korrigieren; keine alten Migrationen umbenennen oder löschen.                                                                 |
| Nach Update fehlen Dateien                               | Volume prüfen                                                    | `/app/data` als persistenten Mount verwenden, nicht als temporären Containerpfad.                                                                 |
| Build bleibt nach „Building docker image started“ stehen | Server auf CPU-, RAM- und OOM-Ereignisse prüfen                  | Den externen GitHub-Image-Build verwenden; für lokale Builds zusätzlich ausreichend RAM oder Swap bereitstellen.                                  |
| `Cannot find matching keyid` bei Corepack                | Buildlog auf die Corepack-Signaturmeldung prüfen                 | Mit diesem Repositorystand behoben: Das Dockerfile installiert die gepinnte pnpm-Version direkt und umgeht die veraltete Corepack-Schlüsselliste. |

## Sichere Updates über GitHub

1. Änderungen werden in Manus getestet und auf den `main`-Branch übertragen: `git push github main`.
2. GitHub Actions baut das Image extern und veröffentlicht den neuen `latest`-Tag.
3. Coolify zieht das neue Image nach manuellem **Pull latest image / Redeploy** oder über einen Registry-Webhook. Persistente Datenbank und `/app/data` bleiben außerhalb des Images und unverändert.
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
