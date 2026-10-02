# MyCrewMate – Go-live-Checkliste für den Betreiber

**Stand:** 02. Oktober 2026  
**Status:** Technische Grundlage für den kontrollierten Marktstart vorhanden; die markierten Betreiberprüfungen bleiben vor einer offenen Selbstbedienungs-Buchung verbindlich.

---

## 1. Bereits erledigte technische & organisatorische Maßnahmen

* [x] **Datensparsamkeit:** Google Fonts entfernt, Inter lokal gebündelt; Esri-Satellit entfernt, OpenStreetMap / OpenTopoMap ohne Tracking integriert.
* [x] **Öffentliche Demo:** Speicherfreie Musterdemo ohne Datenbankeintrag und ohne SessionStorage (`/vereinsdemo`).
* [x] **Zweite Anmeldestufe (MFA):** Authenticator-App (TOTP) mit 8 Offline-Recovery-Codes für persönliche Vereins- und Master-Administratoren implementiert; die Aktivierung erfolgt bewusst einmalig durch jeden privilegierten Zugang.
* [x] **Vertragsnachweis:** Digitale, revisionssichere Annahme von AGB, AVV und Datenschutzhinweisen beim Erstlogin (Art. 28 Abs. 9 DSGVO).
* [x] **Automatisierte Löschung:** 3 Jahre Aufbewahrung für geschlossene Events; gesetzliche Holds im Event-Manager dokumentierbar.
* [x] **Sicherheitsheader:** HSTS (in Produktion), Content Security Policy, X-Frame-Options, Referrer-Policy und Permissions-Policy aktiv.
* [x] **Rate-Limiting:** Brute-Force-Schutz für Login, Master-Reset, Planungsteam und PDF-Zugangscodes aktiv.
* [x] **Betriebsmappe:** DSAR- und Incident-Runbook, Verzeichnis von Verarbeitungstätigkeiten (VVT) und AVV-Muster vorhanden.

---

## 2. Letzte Prüfungen vor dem ersten externen Verein

| Bereich | Prüfpunkt | Zuständig | Status |
|---|---|---|---|
| **Rechtlich** | Fachjuristische Endprüfung von AGB und AVV | Fachanwalt IT-Recht | Empfohlen vor Massenbuchungen |
| **Kaufmännisch** | Steuernummer / USt-ID im Impressum hinterlegen | Christian Lamprich | Sobald erteilt |
| **Betrieblich** | Probe-Restore eines Coolify-Dumps in Test-DB | Christian Lamprich | Halbjährlich |
| **Betrieblich** | Upload-Volume-Sicherung konfigurieren und mindestens eine Datei testweise wiederherstellen | Christian Lamprich | **Vor offenem Verkauf zwingend** |
| **Sicherheit** | Master-MFA im Masterportal und MFA der eigenen Vereinsadminzugänge aktivieren; Recovery-Codes offline sichern | Christian Lamprich / Vereinsadmins | **Vor echter Vereinsfreischaltung dringend** |
| **Support** | Postfach `info@mycrewmate.de` regelmäßig überwachen | Christian Lamprich | Täglich |
| **Zahlung** | Stripe-Konto eröffnen & API-Schlüssel einbinden | Christian Lamprich | Wenn Selbstbedienungs-Checkout gewünscht |

---

## 3. Notfallkontakte

* **Technischer Betrieb & Hosting:** Hetzner Online GmbH (Rechenzentrum Deutschland)
* **Bereitstellung:** Coolify auf persönlicher Cloud-Instanz
* **Datenschutzbeauftragter / Kontakt:** Christian Lamprich (`info@mycrewmate.de`)
* **Aufsichtsbehörde:** Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz (LfDI RLP)
