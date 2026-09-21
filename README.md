# MyCrewMate

MyCrewMate ist eine passwortgeschützte Webanwendung zur Helfer-, Schicht- und Eventplanung. Dieses Repository ist für den **eigenständigen Betrieb auf Coolify mit MySQL oder MariaDB** vorbereitet. Es benötigt zur Laufzeit weder Manus Storage noch eine Manus-App-ID oder Manus-OAuth.

## Schnellstart mit Coolify

1. In Coolify eine **MySQL- oder MariaDB-Datenbank** anlegen und deren interne `DATABASE_URL` kopieren.
2. Für kleine Coolify-Server zuerst den GitHub-Actions-Lauf **„MyCrewMate – Container veröffentlichen“** abwarten und in Coolify als Quelle **Docker Image** `ghcr.io/clambrich-gif/mycrewmate:latest` wählen. Dadurch findet der speicherintensive Build außerhalb des Servers statt. Die Dockerfile-Quelle bleibt als Alternative verfügbar.
3. In Coolify die in [`docs/COOLIFY.md`](docs/COOLIFY.md) dokumentierten Variablen setzen. Erforderlich sind mindestens `DATABASE_URL` und ein langer, zufällig erzeugter `JWT_SECRET`.
4. Ein **persistentes Volume** mit Zielpfad `/app/data` einrichten. Dort liegen hochgeladene Vereins-, Standort- und PDF-Logos sowie GPX-Dateien. Ohne Volume gehen neue Uploads bei einem Container-Neustart verloren.
5. Port `3000` und als Health-Check `/healthz` konfigurieren. Die Anwendung hört auf `0.0.0.0:$PORT`.
6. Deploy starten. Im Docker-Image führt der integrierte Runner `dist/migrate.js` zuerst die versionierten Drizzle-Migrationen aus und startet danach die Anwendung. **Keinen zusätzlichen Startbefehl** in Coolify hinterlegen.

Eine detaillierte Anleitung mit Diagnose- und Updateablauf befindet sich in [`docs/COOLIFY.md`](docs/COOLIFY.md).

## Lokale Entwicklung

```bash
corepack enable
pnpm install --frozen-lockfile
# DATABASE_URL und JWT_SECRET als lokale Umgebungsvariablen setzen
pnpm db:migrate
pnpm dev
```

Für einen Produktionscheck:

```bash
pnpm test -- --reporter=dot
pnpm check
pnpm build
pnpm exec drizzle-kit check
```

## Datenbankmigrationen

Alle Migrationen befinden sich versioniert im Ordner [`drizzle/`](drizzle/). Neue Änderungen am Schema werden ausschließlich als neue, additive Migration eingecheckt:

```bash
pnpm db:generate
pnpm db:migrate
```

`db:push` kombiniert beide Befehle für die Entwicklung. Im produktiven Container werden **nur die bereits eingecheckten Migrationen** durch den integrierten Runner angewendet. Bei einer älteren Datenbank mit einem unvollständigen Drizzle-Journal kann er ausschließlich nachgewiesen bereits vorhandene `ALTER TABLE … ADD`-Spalten kompatibel übernehmen; andere Datenbankfehler bleiben absichtlich blockierend.

## Dateispeicher und Logos

Markenlogo, PWA-Icons und Hilfebilder sind im Repository unter `client/public/` enthalten. Zur Laufzeit gespeicherte Dateien liegen lokal unter `LOCAL_STORAGE_PATH` (standardmäßig `/app/data/uploads`) und werden über Same-Origin-Routen ausgeliefert. Für produktive Daten ist deshalb das Coolify-Volume zwingend.

## Künftige Updates

1. Änderungen in Manus vollständig testen und committen/checkpointen.
2. Den aktuellen `main`-Branch an `github` pushen: `git push github main`.
3. Der GitHub-Workflow baut das Container-Image außerhalb des Coolify-Servers. Nach einem erfolgreichen Workflow-Lauf in Coolify **Pull latest image / Redeploy** ausführen oder einen Registry-Webhook aktivieren.
4. Coolify lädt das fertige Image, wendet beim Start die noch fehlenden Drizzle-Migrationen an und behält Datenbank sowie `/app/data`-Volume unverändert bei.

Der Remote `github` zeigt auf `https://github.com/clambrich-gif/mycrewmate.git`.
