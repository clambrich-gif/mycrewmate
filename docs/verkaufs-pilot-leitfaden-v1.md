# MyCrewMate – Verkaufs-Pilot und Vorbuchungsleitfaden

**Stand:** 02. Oktober 2026  
**Ziel:** Kontrollierter Start mit zahlenden Pilot- und Partnervereinen vor der automatisierten Zahlungsanbindung (Stripe).

---

## 1. Ablauf: Vom Erstkontakt bis zur Freischaltung

```
Interessierter Verein
       │
       ▼
1. Unverbindliche Anfrage (/angebot oder E-Mail an info@mycrewmate.de)
       │
       ▼
2. Bereitstellung Angebot & Muster-Rechnung durch Plattformbetreiber
       │
       ▼
3. Vorzahlung (Banküberweisung / SEPA) durch den Verein
       │
       ▼
4. Anlage im Masterportal mit Status „aktiv“ und gebuchtem Paket
       │
       ▼
5. Versand des persönlichen Einrichtungslinks an den Vereinsadministrator
       │
       ▼
6. Erstlogin: Verbindliche digitale Bestätigung von AGB, AVV & Datenschutzhinweisen
       │
       ▼
7. Vollständige Nutzung der Planungsmodule
```

---

## 2. Rechtliche Mindeststandards vor Geldannahme

1. **Rechnung mit Pflichtangaben:** Name, Anschrift, Steuernummer/USt-ID (bzw. Hinweis auf Kleinunternehmerregelung § 19 UStG, falls zutreffend), Leistungszeitraum.
2. **Keine automatische Verlängerung:** Jedes Paket endet nach dem vereinbarten Veranstaltungsjahr bzw. der Einzelveranstaltung.
3. **Vertragsgrundlage:** Mit dem Erstlogin bestätigt der Vereinsadmin digital:
   * Allgemeine Geschäftsbedingungen (AGB v1.0)
   * Auftragsverarbeitungsvertrag (AVV v1.3 mit deutschem Rechenzentrum Hetzner)
   * Datenschutzhinweise (App-Datenschutz v1.3)
   * Revisionsfähiger Zeitstempel und Hash werden in der Datenbank gesichert.

---

## 3. Preise & Leistungsumfang im Vorverkaufs-Pilot

| Paket | Preis | Abrechnung | Zielgruppe |
|---|---|---|---|
| **Event Pass** | 69 € | Einmalig pro Event | Einzelfest, bis 50 Helfer, schlanker Orga-Zugang |
| **Light** | 149 € | Pro Veranstaltungsjahr | 1 Hauptevent, bis 150 Helfer, bis 5 persönliche Zugänge |
| **Pro** | 299 € | Pro Veranstaltungsjahr | Bis 5 Events, bis 350 Helfer/Event, Karten, Chat, Vorlagen |
| **Enterprise** | ab 449 € | Nach Vereinbarung | Mehrveranstaltungs- & Verbandslösungen, individuelle Betreuung |

---

## 4. Automatisierte Zahlungsanbindung (Stripe – geplanter Schritt 2)

Sobald ein Stripe-Unternehmenskonto eingerichtet ist:
* Aktivierung des Schalters in `platform_launch_settings`.
* Öffentlicher Checkout mit automatischer Rechnung und sofortiger Bereitstellung.
* Bis dahin schützt der manuelle Vorbuchungsablauf vor unkontrollierten Buchungen und rechtlichen Grauzonen.
