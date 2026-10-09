# MyCrewMate – Technische Logaufbewahrung

> **Version 1.0 · Stand 09.10.2026 · Geltung: Produktionsserver bei Hetzner mit Coolify und Docker.**
>
> Diese Richtlinie ergänzt das Lösch- und Aufbewahrungskonzept. Sie beschreibt ausschließlich technische Server-, Reverse-Proxy- und Containerprotokolle. Fachliche Sicherheits-, Login- und Aktivitätsprotokolle innerhalb der MyCrewMate-Anwendung werden getrennt nach dem Löschkonzept behandelt.

## 1. Beschlossene Fristen

| Datenklasse | Zweck | Maximale Frist | Technische Umsetzung |
| --- | --- | ---: | --- |
| Webserver-, Reverse-Proxy- und Container-Laufzeitprotokolle | Bereitstellung, Fehleranalyse, Missbrauchsabwehr, Verfügbarkeit | **14 Tage** | Docker schreibt neue Containerprotokolle in das persistente systemd-Journal; `MaxRetentionSec=14day` begrenzt die Aufbewahrung. |
| Unstrukturierte Anwendungsfehler im Container-Standardausgabestrom | Fehleranalyse und Betriebssicherheit | **14 Tage** | Gleiche Journalrotation wie Containerprotokolle. |
| Kurzlebige Sicherheitsdaten, Einladungen, Übergaben und Sitzungswiderrufe in MyCrewMate | Abwehr und Nachweis technischer Sicherheitsvorgänge | **30 Tage** | Automatische Bereinigung in der Anwendung. |
| Strukturierte Sicherheits-, Login- und Aktivitätsprotokolle in MyCrewMate | Rechte-, Sicherheits- und Änderungskontrolle | **12 Monate** | Stündliche regelbasierte Bereinigung in der Anwendung. |
| Datenbank- und Upload-Sicherungen | Wiederherstellung nach technischem Ausfall | **Sieben tägliche Wiederherstellungspunkte** | Getrennte Backup-Rotation; keine Wiederöffnung fiktiver Vereinsdemos. |

> Die 14-Tage-Frist betrifft nicht rechtlich erforderliche Geschäftsunterlagen, fachliche Sicherheitsprotokolle oder vereinbarte Pilot- und Planungsdaten. Für diese gelten die jeweils gesonderten Fristen im Lösch- und Aufbewahrungskonzept.

## 2. Technische Konfiguration auf dem Produktionsserver

### 2.1 Aktivierter Zielzustand

Docker verwendet für neu erzeugte Container den Logging-Treiber `journald`. Das persistente systemd-Journal begrenzt die technische Aufbewahrung auf 14 Tage und zusätzlich den belegbaren Speicher. Die MyCrewMate-Anwendung und der Coolify-Reverse-Proxy wurden am **09.10.2026** nach der Serverumstellung kontrolliert neu erzeugt und verwenden beide `journald`.

Diese Kombination ist bewusst gewählt:

- Die Docker-Dokumentation weist darauf hin, dass `json-file` ohne Logrotation unkontrolliert wachsen kann.
- `journald` kann eine echte zeitliche Obergrenze (`MaxRetentionSec`) durchsetzen.
- Die zusätzliche Speichergrenze verhindert, dass Protokolle die 40-GB-Systemplatte erschöpfen.
- Der Wechsel wird nach der Konfiguration durch einen kontrollierten Redeploy der MyCrewMate-Anwendung wirksam, weil Docker Logging-Treiber nur beim Erzeugen eines Containers übernimmt.

### 2.2 Dateien auf dem Hetzner-Server

**Ergänzung in `/etc/docker/daemon.json`**

Falls die Datei bereits andere Docker-Einstellungen enthält, bleiben deren unabhängige Schlüssel (beispielsweise `default-address-pools`) unverändert. Beim Wechsel von `json-file` zu `journald` müssen jedoch die bisherigen, nur für `json-file` gültigen Optionen `max-size` und `max-file` entfernt werden, weil Docker sie für `journald` nicht akzeptiert. `log-opts.tag` wird anschließend gesetzt. Wenn noch keine Datei vorhanden ist, lautet der vollständige Inhalt:

```json
{
  "log-driver": "journald",
  "log-opts": {
    "tag": "docker/{{.Name}}"
  }
}
```

**`/etc/systemd/journald.conf.d/90-mycrewmate-retention.conf`**

```ini
[Journal]
Storage=persistent
MaxRetentionSec=14day
SystemMaxUse=256M
SystemKeepFree=1G
SystemMaxFileSize=32M
```

Die Werte wirken auf das systemd-Journal des Produktionsservers. `SystemMaxUse` begrenzt die belegte Journalgröße, `SystemKeepFree` hält auch bei Fehlerfällen mindestens 1 GB freien Plattenplatz zurück und `SystemMaxFileSize` begrenzt einzelne Journaldateien.

### 2.3 Kontrollierter Einspielablauf

> **Wichtig:** Das Anwenden startet Docker neu. Coolify und die laufende MyCrewMate-Anwendung werden dabei kurz unterbrochen. Deshalb nur in einem abgestimmten Wartungsfenster einspielen und danach sofort den Health Check prüfen.

1. Bestehende Konfiguration sichern, vorgefundenen Inhalt dokumentieren und Serverzustand prüfen:

   ```bash
   sudo install -d -m 0755 /etc/docker /etc/systemd/journald.conf.d
   sudo cp -a /etc/docker/daemon.json "/etc/docker/daemon.json.before-log-retention.$(date +%F-%H%M%S)" 2>/dev/null || true
   sudo cat /etc/docker/daemon.json 2>/dev/null || true
   sudo docker info --format 'Logging Driver: {{.LoggingDriver}}'
   sudo systemctl is-active docker
   ```

2. Die Docker-Konfiguration ohne Verlust bestehender Schlüssel ergänzen, die Journald-Drop-in-Datei schreiben und die Konfiguration prüfen:

   ```bash
   sudo python3 - <<'PY'
   import json
   from pathlib import Path

   path = Path('/etc/docker/daemon.json')
   config = json.loads(path.read_text()) if path.exists() else {}
   options = dict(config.get('log-opts', {}))
   options.pop('max-size', None)
   options.pop('max-file', None)
   options['tag'] = 'docker/{{.Name}}'
   config['log-driver'] = 'journald'
   config['log-opts'] = options
   path.write_text(json.dumps(config, indent=2) + '\n')
   PY
   sudo tee /etc/systemd/journald.conf.d/90-mycrewmate-retention.conf >/dev/null <<'EOF'
   [Journal]
   Storage=persistent
   MaxRetentionSec=14day
   SystemMaxUse=256M
   SystemKeepFree=1G
   SystemMaxFileSize=32M
   EOF
   sudo systemd-analyze cat-config systemd/journald.conf
   sudo systemctl restart systemd-journald
   sudo systemctl restart docker
   sudo docker info --format 'Logging Driver: {{.LoggingDriver}}'
   sudo journalctl --disk-usage
   ```

3. In Coolify die Anwendung **MyCrewMate** über „Pull latest image / Redeploy“ neu erzeugen. Auch den Coolify-Reverse-Proxy über seine Compose-Konfiguration kontrolliert neu erzeugen. Erst die neuen Container übernehmen den Docker-Treiber `journald`. Danach prüfen:

   ```bash
   sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
   sudo docker inspect -f '{{.HostConfig.LogConfig.Type}}' <MYCREWMATE-CONTAINER>
   sudo docker inspect -f '{{.HostConfig.LogConfig.Type}}' coolify-proxy
   sudo journalctl -n 20 CONTAINER_NAME=<MYCREWMATE-CONTAINER> --no-pager
   curl -fsS https://mycrewmate.de/
   ```

4. Zwei Wochen nach der Umstellung und danach quartalsweise nachweisen:

   ```bash
   sudo journalctl --since '15 days ago' --until '14 days ago' -q
   sudo journalctl --disk-usage
   sudo systemd-analyze cat-config systemd/journald.conf | grep -E 'MaxRetentionSec|SystemMaxUse|SystemKeepFree|SystemMaxFileSize'
   ```

## 3. Einspielnachweis und Veröffentlichungsvoraussetzung für den Datenschutztext

Der öffentliche Datenschutztext darf die konkrete 14-Tage-Frist erst nennen, wenn alle Punkte erfüllt und im Betriebsprotokoll dokumentiert sind. Der Nachweis wurde am **09.10.2026** erbracht:

1. `docker info` zeigt `journald` als Standardtreiber.
2. Der neu erzeugte MyCrewMate-Container zeigt in `docker inspect` den Treiber `journald` und den Status `healthy`.
3. Der neu erzeugte Reverse-Proxy `coolify-proxy` zeigt in `docker inspect` ebenfalls den Treiber `journald`; die Access-Log-Funktion ist nicht aktiviert.
4. Die `journald`-Drop-in-Datei enthält `MaxRetentionSec=14day`, `SystemMaxUse=256M`, `SystemKeepFree=1G` und `SystemMaxFileSize=32M`.
5. Der Live-Health-Check von MyCrewMate lieferte nach den Neuerstellungen erfolgreich `200`.

Die konkrete 14-Tage-Frist kann daher im öffentlichen Datenschutztext veröffentlicht werden.

## 4. Quellen und Verantwortlichkeit

- [Docker: Configure logging drivers](https://docs.docker.com/engine/logging/configure/)
- [Docker: Journald logging driver](https://docs.docker.com/engine/logging/drivers/journald/)
- [systemd: journald.conf](https://www.freedesktop.org/software/systemd/man/journald.conf.html)

Der Betreiber dokumentiert den Einspielzeitpunkt, die vorgefundene Konfiguration, die ausgeführten Prüfungen sowie etwaige Abweichungen im technischen Betriebsprotokoll.
