# Entscheidende Befunde – Go-live-Audit MyCrewMate

**Freigabeempfehlung: Werbestart mit echter Pilot-Anfrage derzeit nicht freigeben.** Die zusammengeführten Audits bewerten den Stand insgesamt als **blocker**. Ausschlaggebend sind (1) die nachweislich falsche bzw. unvollständige Datenschutzerklärung für das bereits aktive Pilotformular, (2) widersprüchliche Preis- und Rabattkommunikation, (3) eine nicht einheitliche reale Einstiegsstrecke für Anzeigen sowie (4) ein mobiler horizontaler Überlauf auf `/pilot` bei 360 CSS-px. Diese Punkte sind voneinander unabhängig; eine Korrektur nur eines Punkts genügt nicht.

Die folgenden Feststellungen beruhen ausschließlich auf sechs vorliegenden Teilprüfungen mit Live-Stand **09.10.2026** sowie – soweit ausdrücklich benannt – auf den dort geprüften Quelldateien. Es wurden **keine** Formulare abgesendet, keine Demo-Instanz angelegt, keine Anmeldung ausgeführt und keine Last- oder destruktiven Tests vorgenommen. Aussagen zu produktiver Mailkonfiguration, Aufbewahrung, Verträgen, Abrechnung und Backend-Abläufen sind daher jeweils als **zu verifizieren**, nicht als bestätigt, ausgewiesen.

> **Nachtrag zum Quellstand vom 09.10.2026, 12:51 Uhr:** Seit diesem Audit wurden die Pilotdatenschutzhinweise, die serverseitige Speicherung und dreijährige Aufbewahrung von Pilotanfragen, Archivierung und Reaktivierung abgelaufener Pilotzugänge, die automatische Pilotende-Mail sowie die fristgerechte technische Bereinigung implementiert. Die Preisregel ist jetzt eindeutig: 50 % Pilotvorteil nur für Light und Pro im ersten kostenpflichtigen Veranstaltungsjahr; Event Pass und Enterprise sind ausgenommen. Die primären CTAs führen direkt zu `/pilot#pilot-anfrage`; die 360-px-Sichtprüfung von Pilotseite und Vereinsdemo zeigte keine abgeschnittenen Bedienelemente. **Weiter offen und vor Werbestart als Betreiber zu verifizieren:** produktive SMTP-Zustellung und Mailbox-Löschroutine bei Hetzner, rechtsverbindliche Prüfung der Pilotbedingungen/Datenschutzrollen sowie die übrigen in diesem Bericht gekennzeichneten Infrastruktur- und Faktenchecks.

| Priorität | Freigabestatus | Entscheidend, weil |
|---|---|---|
| **Blocker** | Vor Werbestart schließen | Reale Datenerhebung ist nicht transparent beschrieben; Preis-/Vorteilsbasis widerspricht sich; der Anzeigenfunnel ist nicht eindeutig; `/pilot` ist bei 360 px nicht vollständig nutzbar. |
| **Hoch** | Vor Start dringend schließen | Pilotbedingungen, Datenflüsse, Fristen, Formularhürden und Preisdetails sind für eine verlässliche Anfrageentscheidung noch nicht präzise genug. |
| **Mittel** | Binnen 1–2 Wochen umsetzen | Verbessert Conversion, wiederkehrende Ladezeit, mobile Bedienung, Datenschutztransparenz und Betriebshygiene. |
| **Niedrig/Info** | Geplant nachziehen | Sinnvolle Qualitäts-, SEO-, PWA- und Hardening-Verbesserungen ohne nachgewiesenen unmittelbaren Startstopp. |

> **Einordnung:** Dies ist eine risikoorientierte Vorprüfung und **keine Rechtsberatung**. Die rechtliche Freigabe, insbesondere von Datenschutztext, Rollenmodell/Auftragsverarbeitung, Preisstatus, Steuerstatus und Pilotbedingungen, sollte vor Veröffentlichung durch zuständige Fachberatung auf Basis der tatsächlichen Produktionskonfiguration erfolgen.

## 1) Nicht vor Werbestart übersehen

### 1.1 Blocker: Das aktive Pilotformular widerspricht der veröffentlichten Datenschutzerklärung

**Präziser Textwiderspruch:** Auf `/pilot` ist ein absendbares Formular sichtbar. Es erhebt Verein/Organisation, Ansprechperson, E-Mail, **verpflichtend** Telefonnummer, Anlass, gewünschten Startmonat und optionalen Freitext. Die verlinkte Erklärung auf `/datenschutz` bezeichnet den Auftritt dagegen als **„tracker- und formularfreien Startauftritt“** und sagt **„Sie enthält keinen Newsletter, kein Kontaktformular …“**. In einem weiteren geprüften Text heißt es, die Erklärung werde erst vor einer späteren Formular-Ergänzung angepasst. Der Widerspruch betrifft daher nicht nur fehlende Details, sondern die Existenz der realen Datenerhebung.

Bei direkter Erhebung personenbezogener Daten müssen die einschlägigen Informationen grundsätzlich zum Zeitpunkt der Erhebung bereitgestellt werden; hierzu gehören je nach Verarbeitung insbesondere Verantwortlicher, Zwecke und Rechtsgrundlage, Empfänger bzw. Empfängerkategorien, Drittlandtransfers, Speicherdauer oder Kriterien sowie Betroffenenrechte.[1][2][3] Die vorliegende Erklärung beschreibt diese Punkte nicht für die Pilot-Anfrage.

**Freigabe-Gate:** Das Formular bis zur Veröffentlichung eines sachlich zutreffenden Abschnitts **„Pilot-Anfrage“** deaktivieren **oder** diesen Abschnitt vor jedem weiteren Werbestart publizieren und unmittelbar am Formular verlinken. Er muss auf Basis der realen Konfiguration mindestens Folgendes enthalten:

- alle Felder, getrennt nach Pflicht- und freiwilligen Angaben;
- Zweck(e) der Anfrageprüfung, Bearbeitung, Kontaktaufnahme, Eingangsbestätigung und – soweit zutreffend – Pilotorganisation;
- dokumentierte Rechtsgrundlage je Zweck;
- tatsächliche Empfänger/Kategorien: Pilotteam, Hosting, SMTP-/E-Mail-Anbieter, CRM und eventuelle Dienstleister;
- etwaige Drittlandtransfers samt geeigneter Grundlage;
- reale Speicherfristen oder nachvollziehbare Löschkriterien für Anfrage-E-Mails, Mailbox-/Backup-Bestände, SMTP-Protokolle, Server-/WAF-Logs und Rate-Limit-Daten;
- Pflichtangaben und Folge der Nichtbereitstellung;
- Rechte, Kontaktweg und – nur sofern nach Prozessprüfung zutreffend – Information zu keiner automatisierten Entscheidung/kein Profiling.

**Kein Platzhalter-Text ohne Verifikation:** Die vorliegenden Prüfungen belegen, dass die Route die Anfrage per SMTP an `PILOT_INQUIRY_EMAIL` oder ersatzweise `support@mycrewmate.de` übermittelt und eine reduzierte Bestätigung an die anfragende Adresse senden kann. SMTP-Host, tatsächlicher Empfänger, Verarbeitungsort, Aufbewahrung und Backups wurden nicht übergeben. Deshalb dürfen Anbieter-, Deutschland- oder Löschfristen-Angaben erst nach Konfigurations- und Vertragsprüfung veröffentlicht werden.

**Checkbox berichtigen:** Die Pflicht-Checkbox lautet sinngemäß, die Angaben dürften ausschließlich zur Bearbeitung verwendet werden. Ist die Verarbeitung für vorvertragliche Maßnahmen bzw. die Anfragebearbeitung auf anderer Rechtsgrundlage gestützt, sollte sie ausschließlich die Kenntnisnahme dokumentieren, etwa: **„Ich habe die Datenschutzhinweise zur Pilot-Anfrage gelesen.“** Eine zusätzliche echte Einwilligung darf nur für einen getrennten, freiwilligen Zweck eingesetzt werden und muss entsprechend freiwillig, informiert, widerrufbar und nachweisbar sein.[1][3]

### 1.2 Blocker: Preisstatus, Angebotsseite und 50-%-Pilotvorteil sind widersprüchlich

**Präzise Textwidersprüche:**

1. Die Startseite bezeichnet Preise als **„Fiktive Musterangebote“** und die Fußnote als **„Fiktive Preisdarstellung dieser Musterdemo“**; Warenkorb und Checkout werden als Simulation beschrieben.
2. `/angebot-demo` spricht dagegen von **„Reguläre Preise ab 01.01.2027“**, **„Alle genannten Preise sind Endpreise“** und **„Buchung und Zahlung starten ab 01.01.2027“**.
3. `/pilot` verweist für **„Reguläre Preise ab 01.01.2027“** auf `/#pakete` – also genau auf den Bereich mit der fiktiven Preisdarstellung – und verspricht zugleich **50 % auf den bei Vertragsabschluss veröffentlichten regulären Jahrespreis**.
4. Der Event Pass ist laut Angebotsdarstellung **69 € einmalig pro Veranstaltung**; der Pilotvorteil bezieht sich dagegen auf das **erste kostenpflichtige Nutzungsjahr**. Seine Anwendung auf den Event Pass bleibt offen.

Damit ist für Interessenten nicht eindeutig, ob 69/149/299/„ab 449 €“ Musterwerte, künftige Endpreise oder der Referenzpreis für den Pilotvorteil sind. Preiswerbung gegenüber Verbrauchern unterliegt Anforderungen an den Gesamtpreis; zugleich können unklare Angaben zu Preis, Preisberechnung und Preisvorteil ein lauterkeitsrechtliches Transparenzrisiko begründen.[4][5] Die rechtliche Einordnung und der Adressatenkreis sind vor Start fachlich zu bestätigen.

**Freigabe-Gate:** Eine verbindliche Produkt- und Preisentscheidung treffen und anschließend **wortgleich** in Startseite, `/angebot-demo`, `/pilot`, Dialogen, Pilotbestätigung und Anzeigen ausspielen:

- **Variante A – verbindliche Preisliste:** Eine einzige kanonische URL, z. B. `/preise`, mit Gültigkeits-/Versionsdatum, Endpreisen und klarer Paketlogik veröffentlichen. Alle Aussagen „fiktiv/Musterdemo“ zu diesen Preisen löschen. `/pilot` exakt dorthin verlinken.
- **Variante B – reine Preisillustration:** Die Darstellung ausdrücklich unverbindlich belassen. Dann weder „reguläre Preise/Endpreise“ noch den 50-%-Vorteil auf diese Werte bewerben.

Die 50-%-Aussage darf erst nach einer vollständigen Vorteilsklausel erscheinen: berechtigter Kreis, Antrags-/Wechselfrist, Pilotbeginn/-ende, teilnehmende Pakete, Event-Pass-Regel, identisches begünstigtes Paket, einmaliger Zeitraum, maßgeblicher Preisstand, Enterprise-Umfang/Individualentwicklung, Ausschlüsse und keine automatische Verlängerung. Je teilnehmendem Paket sollte ein Rechenbeispiel folgen. Für öffentlich mögliche Verbraucheransprache sind je Preis Laufzeit, enthaltene Leistung, zwingende Zusatzkosten und der Endpreis klar auszuweisen; beim Kleinunternehmerstatus ist der zutreffende Hinweis unmittelbar konsistent zu führen.[4][8][9]

### 1.3 Blocker: Für Anzeigen fehlt eine einzige, reale Pilotstrecke

Die öffentliche Startseite ist zugleich Preis-/Paketübersicht und **Musterdemo**: Sie nennt „Fiktive Musterangebote“, „Simuliert in den Warenkorb“ sowie „Öffentliche Musterdemo: kein Live-Angebot, keine Zahlungsabwicklung und keine Datenübertragung“. Ihr Haupt-CTA führt zur Vereinsdemo. Der reale Prozess liegt dagegen auf `/pilot` und erhebt echte Kontaktdaten für einen Vereinspilot. Für Besucher aus generischen Anzeigen stehen somit fiktive Demo und echte Anfrage am allgemeinsten Einstieg nebeneinander; der reale nächste Schritt ist nicht der dominante Pfad.

**Freigabe-Gate:** Für bezahlte Anzeigen ausschließlich `https://mycrewmate.de/pilot` als Ziel-URL verwenden. Parallel vor breiterem Start entweder:

- die Startseite auf die reale Pilotstrecke ausrichten bzw. weiterleiten, **oder**
- dort einen dominanten CTA **„Kostenlosen Pilot am eigenen Event anfragen“** mit derselben Zusage wie auf `/pilot` platzieren.

Die drei Konzepte müssen sichtbar und inhaltsgleich getrennt sein: **Pilot = eigener Verein, reale Daten nur nach Abstimmung; Vereinsdemo = ausschließlich fiktive Daten; Preise = keine Bestellung vor 01.01.2027**, solange dies der gewählte Produktstatus bleibt.

### 1.4 Blocker: `/pilot` ist bei 360 CSS-px horizontal scrollbar; Formularelemente liegen außerhalb des Viewports

Im Mobile-Test misst `/pilot` bei 360 px eine Dokument-/Body-Breite von **389 px** (+29 px). Die Anfragefelder liegen bei x=37 bis x=368; damit ragen sie **8 px** über den 360-px-Viewport hinaus. Der Fokus auf das erste Feld war zwar erreichbar und nicht verdeckt, die Formularspalte ist bei der geforderten Mindestbreite aber nicht vollständig sichtbar. Bei 390 und 412 px entsprach die Dokumentbreite dem Viewport.

**Freigabe-Gate:** Die 360-px-Regeln des Pilotlayouts (Container, Padding, `min-width`) korrigieren, Formular und Header inklusive Innenabständen auf maximal 360 px begrenzen und nach Deployment Root-Überlauf, sichtbare Feldränder und Tastaturfokus bei 360/390/412 CSS-px erneut prüfen.

---

## 2) Vor dem Start dringend korrigieren

### 2.1 Datenfluss, Löschung und Pilotrollen schriftlich verifizieren

Der nachweisbare Anfragepfad ist Formular → öffentliche tRPC-Route → SMTP-Benachrichtigung an das Pilotteam → gegebenenfalls reduzierte Bestätigungs-E-Mail. Ein Datenbank-Speicheraufruf ist im geprüften Pilotpfad nicht erkennbar. Das ist jedoch **kein Nachweis** für eine fehlende Speicherung in Mailboxen, Backups, SMTP-, Hosting- oder Sicherheitslogs.

Vor Freigabe sind tatsächlicher Mailanbieter, Rechenzentrums-/Verarbeitungsorte, Unterauftragsverarbeiter, `PILOT_INQUIRY_EMAIL`, Mailbox-/Backup- und Logfristen sowie der produktive Reverse-Proxy-/WAF-Datenfluss zu dokumentieren. Die Speicherbegrenzung und die Information über Dauer oder Kriterien sind datenschutzrechtlich relevante Anforderungen.[1][2][7]

Zusätzlich bewirbt `/pilot` das Planen mit dem **„echten Team“**, während die Datenschutzerklärung bislang nur die fiktive Vereinsdemo beschreibt. Soweit Vereine Zwecke und Mittel der Helferdaten bestimmen und MyCrewMate diese Daten weisungsgebunden hostet/verarbeitet, ist eine Auftragsverarbeitung naheliegend; hierfür sieht Art. 28 DSGVO einen Vertrag oder ein anderes bindendes Rechtsinstrument mit konkretisiertem Gegenstand, Dauer, Zweck, Datenarten und Betroffenengruppen vor.[1][6] Das Rollenmodell ist vor dem Import echter Vereinsdaten festzulegen und durch passende Vereinbarungen, TOMs, Unterauftragsverarbeiter, Weisungsprozess, Unterstützung bei Betroffenenrechten sowie Rückgabe/Löschung abzusichern.

### 2.2 Pilotzeitraum, Kapazität und „verbindliche Zusage“ eindeutig machen

Auf `/pilot` stehen gleichzeitig **„Pilotprogramm bis 31.12.2026“**, Produktstart am **01.01.2027** und die FAQ-Aussage, ein großes Event könne das vereinbarte Veranstaltungsjahr 2027 begleiten. Nicht erkennbar ist, ob der 31.12. Antragsfrist, Auswahlfrist oder Testende bedeutet. „Plätze“ suggeriert Kapazitätsknappheit, ohne Anzahl oder Auswahlregel. Die Seite spricht zudem von einer **„Verbindlichen Zusage für den Pilotzeitraum“**, verlinkt aber keine Pilotbedingungen; im geprüften Entwurf war eine Aktivierung erst nach Prüfung der Pilotbedingungen und Formularanbindung vorgesehen.

**Vor Start festlegen und identisch veröffentlichen:**

- „Bewerbung bis [Datum]“;
- Regel für Pilotbeginn und Pilotende bzw. konkrete Daten;
- ob und wie Veranstaltungen 2027 begleitet werden;
- Anzahl der Plätze oder transparente Auswahlregel – anderenfalls „Plätze“ streichen;
- Wirksamwerden nur **„nach schriftlicher Pilotbestätigung“**;
- Leistungspaket, Onboarding/Support, berechtigte Zugriffe, Datenexport/-löschung und Ende ohne automatische Verlängerung.

Eine kurze, geprüfte Seite **„Pilotbedingungen“** ist direkt am CTA, am Datenschutzhinweis und beim 50-%-Vorteil zu verlinken. Die vorhandene Kommunikation „keine Zahlungsdaten“, „keine Rechnung“, „keine automatische Verlängerung“ und „Nutzung endet zum vereinbarten Termin“ ist positiv, muss aber durch Bestätigung, Vertrag und Backend-Logik gedeckt sein. Abweichende tatsächliche Verlängerung oder Abrechnung stünde im Spannungsverhältnis zu dieser Werbeaussage; bei späteren standardisierten Verbraucherdauerschuldverhältnissen gelten zudem gesetzliche Grenzen für stillschweigende Verlängerungen und Kündigungsfristen.[5][10]

### 2.3 Anfrageformular auf die angekündigte Erstinformation reduzieren

Live wird erklärt: **„Ein Anlass, eine grobe Teamgröße und ein Wunschzeitraum reichen.“** Im geprüften Formular sind jedoch Verein, Ansprechperson, E-Mail, Telefonnummer, Anlass-Auswahl und Startmonat Pflichtfelder; eine Teamgröße wird gar nicht abgefragt. Für die E-Mail-Bestätigung wird die E-Mail benötigt; im gelieferten Code geht die Telefonnummer nur an die interne Benachrichtigung. Eine Erforderlichkeit des Telefons für jede Anfrage ist deshalb nicht belegt. Der Freitext umfasst bis zu 2.000 Zeichen und wird vollständig gemailt.

**Vor Start umsetzen:**

- Pflichtfelder auf Verein/Organisation, E-Mail und Anlass begrenzen, sofern der geprüfte Prozess keine weiteren Pflichtangaben belegt;
- Telefon optional als „für schnelleren Rückruf“ ausweisen oder dessen zwingende Erforderlichkeit unmittelbar begründen;
- gewünschten Start optional machen bzw. „noch offen / bitte beraten“ anbieten;
- entweder eine optionale grobe Teamgröße ergänzen oder die Textzusage entfernen;
- am Freitext warnen: „Bitte keine Gesundheitsdaten oder sonstigen besonderen Kategorien personenbezogener Daten sowie keine Daten Dritter eintragen.“;
- CTA-Nähe mit „Dauert ca. 1 Minute · kein Vertrag · Paket und Zeitraum klären wir persönlich“ präzisieren.

Dies reduziert einen belegten Conversion-Widerspruch und folgt dem Grundsatz, personenbezogene Daten auf das für den Zweck erforderliche Maß zu beschränken.[1]

### 2.4 Preisdetails pro Paket, insbesondere Enterprise, absichern

Die Prüfer sahen auf `/angebot-demo` Paketbetrag und Zeiteinheit sowie die Fußnote „Alle genannten Preise sind Endpreise“. Bei Enterprise steht **„ab 449 €“**; individuelle Entwicklungen werden nur allgemein erwähnt. Im Impressum steht der Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen“.

Vor einem öffentlichen Angebotsstart ist pro Preis klarzustellen: Endpreis, Einheit/Laufzeit, enthaltene Menge, zwingende Zusatz- oder Einrichtungskosten und beim Enterprise-Preis ein Mindestumfang. Der Kleinunternehmerstatus ist für die Preislisten- und Rechnungserstellung 2027 fachlich zu prüfen und bei Statuswechsel zu aktualisieren. Ob der öffentliche Auftritt tatsächlich nur B2B ist, wurde nicht belegt; eine bloße Zielgruppenbezeichnung „Vereine oder Organisationen“ schließt Verbraucherinteressen nicht zuverlässig aus.[4][8][9]

### 2.5 Kontaktzusage und Eingangsbestätigung an das reale Verhalten anpassen

Die Seite verspricht eine persönliche Rückmeldung und unter dem Formular **„Wir bestätigen den Eingang zusätzlich per E-Mail“**. Der geprüfte Code unterscheidet nach erfolgreicher Übergabe jedoch `confirmationSent`: Je nach Ergebnis wird eine Bestätigung zugesagt oder nur späterer Kontakt per Telefon/E-Mail angekündigt. Eine garantierte Bestätigung ist damit nicht belegt.

**Vor Start:** eine betriebswirtschaftlich belastbare Antwortfrist und Pilot-Kontaktadresse nennen. Den Text zur Bestätigung beispielsweise konditional machen: „Wenn die Eingangsbestätigung nicht innerhalb von [X] Minuten eintrifft, ist eure Anfrage dennoch eingegangen; wir melden uns persönlich.“ Fristen dürfen nur veröffentlicht werden, wenn sie operativ eingehalten werden.

### 2.6 Mobile Vereinsdemo vor Kampagnenverkehr korrigieren

`/vereinsdemo` misst bei 360 px eine Layoutbreite von **420 px**, bei 390 und 412 px jeweils **421 px**. Der CTA „Eigenen Verein im Pilotprogramm testen“ liegt bei x=41 mit 353,8 px Breite und endet bei x=394,8; bei 360 px fehlen somit **34,8 px** außerhalb des sichtbaren Bereichs. Der Seiten-/CTA-Container ist bei allen geprüften Breiten horizontal scrollbar; die drei Auswahlbuttons selbst sind 44 px hoch.

Die feste bzw. minimale Breite ist zu entfernen oder mit `max-width: 100%` und mobil passenden Seitenrändern zu ersetzen. Nach Korrektur CTA und Root-Überlauf bei 360/390/412 CSS-px wiederholen.

---

## 3) Sinnvolle Nachbesserungen binnen 1–2 Wochen

### 3.1 Anfrage-CTA ohne unnötigen Zwischenschritt führen

Auf der Startseite führen „Pilot kostenlos anfragen“, Header-CTA „Pilot anfragen“ und „Im Pilot testen“ zu `/pilot`; das Formular liegt dort erst unten in `#pilot-anfrage`. Erst ein CTA auf der Pilotseite springt zu diesem Bereich. Für einen Anzeigenklick mit klarer Anfrageerwartung ist das ein zusätzlicher, nicht angekündigter Schritt.

**Empfehlung:** Kampagnennahe CTAs direkt auf `/pilot#pilot-anfrage` führen oder den vorgelagerten CTA in „Pilotprogramm ansehen“ umbenennen. Eine dauerhaft sichtbare Anfrage-Schaltfläche oder ein Formular-Teaser oberhalb der Falz auf `/pilot` reduziert die Distanz zum Ziel.

### 3.2 Login auf allen öffentlichen Landingpages konsistent anbieten

Start- und Legal-Seiten enthalten „Zum Login“ zu `https://app.mycrewmate.de/login`; die Header von `/pilot` und `/vereinsdemo` enthalten nur Logo/Seitennavigation bzw. Pilot-CTA. Der Login selbst lieferte einen funktionierenden Einstieg mit Kennungs-/E-Mail- und Passwortfeld; es wurde keine Anmeldung durchgeführt.

**Empfehlung:** In den globalen Header aller öffentlichen Landingpages – mindestens `/pilot` und `/vereinsdemo`, auch mobil – einen sekundären CTA **„Zum Login“** aufnehmen. So bleibt der Bestandskundenpfad ohne Umweg erreichbar.

### 3.3 Angebots-URL und Beispielansichten klarer benennen

Der Direktaufruf `/angebot-demo` lieferte HTTP 200 und sichtbaren Hero-, Paket- und Pilotinhalt wie die Startseite. Für einen Kampagnen- oder Linknamen „Angebot-Demo“ gibt es keine eigene Angebotsüberschrift oder direkten Paket-Einstieg. Zudem zeigt die Angebotsdarstellung eine dashboardartige Oberfläche mit „Nur noch 261 Tage“, „3 offene Schichten“, „12 Helfer bereit“ und „Streckenposten Nord besetzt“, ohne einen dauerhaft sichtbaren Hinweis auf die Beispielnatur.

**Empfehlung:** Vor externem Einsatz `/angebot-demo` in eine finale URL wie `/angebot` oder `/preise` überführen und die alte URL per 301 weiterleiten. Einen permanenten Hinweis **„Beispielansicht mit fiktiven Daten“** direkt an der Dashboard-Abbildung setzen. Wenn die bisherige URL nicht für Kampagnen dient, sollte sie nicht als Anzeigeziel verwendet werden.

### 3.4 Touch-Ziele für sekundäre Links vergrößern

Bei 360 px messen „Zurück zur Produktseite“ auf Impressum und Datenschutz 20 px Höhe. E-Mail-/Telefonlinks im Impressum bzw. E-Mail-/Loginlinks im Datenschutz messen 17 px; Footerlinks „Impressum“ und „Datenschutz“ auf Marketingseiten je 20 px. Sichtbare Buttons/CTAs messen überwiegend mindestens 44 px.

**Empfehlung:** Nicht nur Textgröße ändern, sondern anklickbaren Links eigenes vertikales Padding bzw. eine Zielhöhe von etwa 44 px und ausreichenden Abstand geben – insbesondere Zurück-, Kontakt- und Footerlinks.

### 3.5 Datenschutzergänzungen für Videos und Missbrauchsschutz nach Realitätsprüfung

Paketvideos sind im geprüften Code über `https://files.manuscdn.com/...` hinterlegt und werden beim Öffnen mit `preload="metadata"` geladen. Die Datenschutzerklärung nennt für technische Zugriffe dagegen Hetzner in Deutschland. Ob die Produktionsauslieferung den externen Videohost tatsächlich verwendet und welche Anbieterrolle/Region gilt, wurde nicht verifiziert. Falls technische Verbindungsdaten an einen zusätzlichen Anbieter fließen, sind Empfänger und gegebenenfalls Drittlandangaben in den Pflichtinformationen zu berücksichtigen.[1][3]

Ebenso existieren Honeypot und ein vorgeschaltetes Rate-Limit. Die Implementierungen von `allowPublicPilotInquiryAttempt` und `getClientKey` fehlten jedoch; Schlüsselart, Pseudonymisierung, Speicherort, Zeitraum und Löschung sind daher offen. Falls dabei personenbeziehbare Kennungen verarbeitet werden, sind Zweck, Rechtsgrundlage und Speicherdauer transparent zu dokumentieren.[1][7]

### 3.6 Bedingte Impressumsangaben abhaken

Das Live-Impressum enthält sichtbar Christian Lambrich, ladungsfähige Anschrift, Telefon und E-Mail. Damit sind die zentralen Angaben zum Anbieter und zur schnellen elektronischen Kontaktaufnahme vorhanden. Ob Registereintrag, USt-IdNr./W-IdNr., Aufsicht oder berufsrechtliche Angaben einschlägig sind, lässt sich aus Website und geprüftem Material nicht feststellen. Das Fehlen ist **nicht** als nachgewiesener Fehler zu werten.

**Empfehlung:** Eine Fakten-Checkliste abzeichnen: tatsächlicher Anbieter/Rechtsform/Vertretung, einschlägige Register, vorhandene USt-IdNr./W-IdNr. und etwaige Zulassung/Aufsicht. Zutreffende Angaben ergänzen. Die Anforderungen richten sich nach der tatsächlichen Einordnung des Diensteanbieters.[11]

### 3.7 Cache-Strategie für wiederkehrende Besuche verbessern

Die gehashten Dateien `/assets/index-0KVQmWtY.js` (800.210 B unkomprimiert, 239.402 B gzip) und `/assets/index-urfX5Iea.css` (224.615 B unkomprimiert, 36.927 B gzip) antworteten jeweils mit `Cache-Control: public, max-age=0`; dies galt auch für geprüfte dynamische Chunks, Font und Landingbilder. Die Hash-Namen erlauben sichere langlebige Immutable-Caches, derzeit werden die Ressourcen bei Wiederbesuchen jedoch revalidiert.

**Empfehlung:** Für inhaltsgehashte `/assets/*` `Cache-Control: public, max-age=31536000, immutable` setzen. Nicht gehashte Bilder versionieren und angemessen cachen; HTML und `service-worker.js` bewusst kurz/revalidierbar halten. Mit leerem Cache und Wiederbesuch nachmessen.

### 3.8 Mobile Erstlast und Rendering entkoppeln

Im isolierten Chromium-Test bei 390×844 CSS-px, Android-UA und synthetischem 4G-Profil (150 ms Latenz, 200 KB/s Download) lagen DOMContentLoaded und `load` bei rund **4,83 s**. Auf dem kritischen Pfad lagen unter anderem 238 KB gzip Haupt-JS, 37 KB CSS, 48 KB Font, 142 KB Wordmark und 48 KB Mascot. Vor React-Rendering enthielt die Startseite nur „Seite wird geladen …“. Dies ist ein Performance-Risikohinweis, **kein** Feldwert für LCP, INP oder CLS.

**Empfehlung:** Landing-Route stärker vom Anwendungsbundle trennen, Route-/Component-Code aufschieben, Above-the-fold-Logo/Bilder größenadäquat modern ausliefern und nichtkritische UI weiter lazy laden. Anschließend LCP/INP/CLS unter echter Mobilfunkmessung gegen ein festgelegtes Budget prüfen.

### 3.9 Kanonischen Host durchsetzen

Apex- und `www`-URLs lieferten jeweils HTTP 200 ohne Redirect, während `canonical` und `og:url` der Apex-Seiten auf `www` verweisen. Das führt zu zwei direkt erreichbaren Hosts mit gleichem Inhalt.

**Empfehlung:** Einen Primärhost festlegen und den anderen per 308/301 darauf leiten. `canonical`, `og:url`, Sitemap, interne Links und PWA-Umfang konsolidieren.

### 3.10 Offline-Erwartung bewusst festlegen

Manifest, Icons und Service Worker waren erreichbar; der Service Worker registrierte sich und cached genau neun Manifest/Icon-Dateien. Fetch bedient nur diese Liste. Weder Startseite noch App-Shell-JS/CSS noch Offline-Seite werden gecacht; eine Offline-Navigation zu `/` fällt auf Netzwerk zurück.

**Empfehlung:** Falls Offline-Nutzung versprochen oder gewünscht ist, eine kleine Offline-Seite bzw. ein Public-App-Shell mit Navigations-Fallback ergänzen und Offline-Start testen. Falls nicht, dies in Produktkommunikation und QA-Kriterien ausdrücklich festhalten.

---

## 4) Mobile-/Nutzerführungs-Check

### Prüfrahmen und Ergebnis

Geprüft wurden sichtbare Inhalte, Root-Horizontalüberlauf, Header/Navigation, CTA-Erreichbarkeit, das Pilotformular ohne Absenden, Vereinsdemo-Auswahl, Impressum/Datenschutz, Tastaturfokus und Zielmaße in isoliertem Chromium mit Android-/Touch-Emulation bei **360, 390 und 412 CSS-px**. Die mobilen Befunde sind wie folgt einzuordnen:

| Bereich | Befund | Bewertung | Erforderliche Maßnahme |
|---|---|---|---|
| `/pilot`, 360 px | Dokumentbreite 389 px; Felder ragen bis x=368 in einen 360-px-Viewport. | **Blocker** | Container/Padding/`min-width` korrigieren und Regressionstest durchführen. |
| `/pilot`, 390/412 px | Dokumentbreite entspricht dem Viewport; im 390-px-Test war der erste Pflichtfeld-Fokus nicht verdeckt. | Tragfähig mit Vorbehalt | 360-px-Fix darf Fokusverhalten nicht verschlechtern. |
| `/vereinsdemo`, 360/390/412 px | Layout 420/421/421 px breit; CTA bei 360 px rechts um 34,8 px abgeschnitten. | **Hoch** | Überbreiten Container entfernen; CTA vollständig sichtbar machen. |
| Primäre CTAs und Formularcontrols | Sichtbare CTAs auf Start-/Pilotseite und Demo-Auswahlbuttons mindestens 44 px hoch; Textfelder, Select und Submit auf `/pilot` bei 390 px jeweils 44 px. | Positiv | Nach Layoutfix erneut prüfen. |
| Sekundärlinks | Legal-, Kontakt- und Footerlinks nur 17–20 px hoch. | Mittel | Zielfläche auf etwa 44 px erweitern. |
| Navigation/Weiterführung | Pilot-CTAs verlangen teils einen zusätzlichen Sprung zur Anfrage; Login fehlt auf Pilot/Demo im Header. | Mittel | Direktanker bzw. Teaser und globalen Login-CTA ergänzen. |

### Positiv belegte mobile Grundlagen

- Die Startseite sowie Impressum und Datenschutz hatten bei 360, 390 und 412 px **keinen** Root-Horizontalüberlauf.
- Die sichtbaren Primär-CTAs auf Start- und Pilotseite sowie die Demo-Auswahlbuttons waren nach Scrollen ohne Überdeckung erreichbar.
- Das Pilotformular wurde nicht abgesendet. Der erste Pflichtfeld-Fokus war im 390-px-Test per Tastatur erreichbar und nicht überdeckt.
- Impressum und Datenschutz waren an den geprüften Breiten lesbar; kein Text-/Dokumentüberlauf wurde gemessen.

---

## 5) Technik-/Sicherheits-Check

### Nachweislich tragfähige technische Basis

Alle fünf geprüften HTTPS-Zielseiten (`/`, `/pilot`, `/vereinsdemo`, `/impressum`, `/datenschutz`) lieferten HTTP 200 ohne Redirect-Ketten. HTTP leitete die geprüften Pfade per 302 auf HTTPS. TLS 1.3 und Zertifikatsprüfung waren erfolgreich. Vorhandene Schutzheader umfassten HSTS mit einem Jahr und `includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` sowie eine Permissions-Policy mit deaktivierter Kamera, Mikrofon und Geolocation.

Die CSP war im Kern restriktiv: `default-src 'self'`, `script-src 'self'`, `connect-src 'self'`, `form-action 'self'`, `object-src 'none'` und `frame-ancestors 'self'`. Im Browser wurden keine HTTP-Mixed-Content-Ressourcen, keine Netzfehler, keine Runtime-Exceptions, keine Console-Meldungen und keine automatisch geladenen Drittanbieterhosts auf den geprüften Public-Routen beobachtet. Im 390-px-Test wurden 19 Ressourcen erfolgreich geladen. Die fünf großen Landingbilder waren `loading=lazy` und erschienen nicht im ersten mobilen Viewport.

Am Pilotformular wurden browserseitige Pflichtfelder, E-Mail-Typ, Telefon-Pattern, Datenschutz-Checkbox und ein nicht erforderliches Honeypot-Feld `website` mit `autocomplete=off` festgestellt. Die übergebene Route prüft Pflichtfelder serverseitig, begrenzt Feldlängen, prüft den Startmonat und setzt Honeypot sowie Rate-Limit ein. Keine dieser Feststellungen bestätigt jedoch serverseitige Eingabevalidierung in Produktion, Rate-Limit-Wirkung oder Speicherung nach dem Mailversand vollständig.

### Innerhalb von 1–2 Wochen umsetzen

| Befund | Evidenz | Maßnahme |
|---|---|---|
| CSP erlaubt `style-src 'self' 'unsafe-inline'` | Auf allen geprüften Seiten vorhanden; keine XSS-Schwachstelle wurde getestet oder behauptet. | Erforderliche Inline-Styles ermitteln, in externe bzw. nonce-/hash-basierte Styles überführen und zunächst Report-Only testen. |
| `X-Powered-By: Express` offengelegt | Auf allen fünf Zielseiten gesendet. | `app.disable('x-powered-by')` oder Proxy-Entfernung; auf allen Hosts/Pfaden kontrollieren. |
| Apex und `www` parallel | Beide Hosts HTTP 200, kein Redirect; Metadaten bevorzugen `www`. | Primärhost und 308/301 wie in Abschnitt 3.9. |
| Gehashte Assets nicht langlebig cachebar | `max-age=0` trotz fingerprinted Dateien. | Immutable-Caching wie in Abschnitt 3.7. |
| PWA ohne Offline-Navigation | Nur Manifest/Icon-Cache, kein Shell-/Navigation-Fallback. | Offline-Anspruch entscheiden und passend testen. |

### Nicht abgedeckte Testgrenzen

Nicht getestet bzw. nicht belegt wurden: produktive serverseitige Validierung und Rate-Limit-Implementierung, Datenbank-/Mailbox-/Backup-Speicherung, E-Mail-Zustellung, WAF-/Proxy-Konfiguration, Lastverhalten, Penetrationstests, tatsächliche Third-Party-Videoauslieferung, Vertrags-/Backend-Deckung der Pilotversprechen sowie eine Core-Web-Vitals-Feldmessung. Diese Grenzen dürfen nicht als Negativbefund missverstanden werden; sie sind offene Verifikationspunkte.

---

## 6) Was bereits tragfähig ist

1. **Klare Abgrenzung von Pilot und Vereinsdemo.** Die Pilotseiten beschreiben einen echten, zeitlich vereinbarten Test mit echten Vereinsdaten. Die Vereinsdemo kennzeichnet sich mehrfach als Übungsdemo mit ausschließlich fiktiven Daten und temporärer Löschung. Vor den drei Startbuttons wird eine eigene temporäre Demo-Umgebung mit fiktivem Mandanten erklärt. Die Buttons wurden bewusst nicht betätigt, um keine Demo-Instanz anzulegen.
2. **Verbraucherfreundliche Pilot-Grundbotschaften.** „Keine Lizenzkosten“, „keine Zahlungsdaten“, „keine Rechnung“, „keine automatische Verlängerung“ und ein vereinbartes Ende nehmen Kostenängste nachvollziehbar auf. Diese Aussagen können tragfähig bleiben, sobald sie mit Pilotbedingungen, Bestätigung und Backend-Logik übereinstimmen.
3. **Paketkommunikation ist verständlich.** Event Pass, Light, Pro und Enterprise sind in Vereinskontexte übersetzt; Paket-/Detail- und Branchen-CTAs wurden nicht als tote Links belegt. Im ausgelieferten Frontend waren für „Paketdetails ansehen“, „Kurzvideo ansehen“ und „Mehr erfahren“ Interaktionshandler vorhanden, ohne dass eine schreibende Aktion ausgelöst wurde.
4. **Kein getesteter Kaufabschluss.** Preis-/Paketführung zeigte Produktstart bzw. fehlende Bestellmöglichkeit. Es wurde kein Zahlungs- oder Bestellabschluss getestet. Die aktuelle Pilot-Anfrage ist daher nicht als zahlungspflichtiger Checkout bewertet. Sollte 2027 eine echte Online-Buchung hinzukommen, ist dies als eigener Legal-/QA-Release zu behandeln; für Verbraucher gelten vor Vertragsschluss besondere Informations- und Button-Anforderungen.[10]
5. **Basis der technischen Härtung ist gut.** HTTPS/TLS, HSTS, restriktive CSP-Grundregeln, wichtige Schutzheader, fehlender Mixed Content und fehlerfreies Browser-Rendering sind solide Ausgangspunkte.
6. **Mobile Basis ist überwiegend brauchbar.** Außer den zwei überbreiten Landinglayouts sind die geprüften Marketing-/Legal-Seiten über die Zielbreiten lesbar, zentrale CTAs ausreichend hoch und der Pilotformularfokus im 390-px-Test zugänglich.
7. **Impressum ist sichtbar angelegt.** Anbietername, Anschrift, Telefon und E-Mail sind vorhanden; nur die bedingten Angaben brauchen einen Tatsachenabgleich.

---

## Empfohlene Freigabereihenfolge

1. **Formular-/Datenschutz-Gate:** Produktionsdatenfluss erfassen, Datenschutzabschnitt samt Checkbox veröffentlichen, tatsächliche Speicher-/Empfängerangaben verifizieren und Pilotrollen/AV-Unterlagen vor Echtdatenbetrieb klären.
2. **Preis-/Vorteils-Gate:** Preisstatus wählen, eine kanonische Preisquelle erstellen, 50-%-Regel vollständig bestimmen und alle widersprüchlichen Texte/URLs bereinigen.
3. **Funnel-/Pilot-Gate:** Anzeigenziel ausschließlich `/pilot`; Pilotbedingungen, Fristen, Auswahl/Bestätigung, Dauer und Support verbindlich festlegen; Formulardaten minimieren.
4. **Mobile-Gate:** 360-px-Überlauf auf `/pilot` und alle Demo-Überbreiten entfernen; danach den kompletten Mobile-Regressionstest wiederholen.
5. **Betriebsgate:** Antwort- und Eingangsbestätigungsversprechen mit Mailbetrieb abgleichen; Cache, Performance, Hosts, Linkziele und Schutzheader nachziehen.
6. **Erst dann:** kleiner, messbarer Werbestart mit dokumentierten Screenshots der finalen Texte, Preisversion, Pilotbedingungen und Datenschutzversion. Nach Launch mobile Analytics/Core Web Vitals, Anfragepfad, E-Mail-Zustellung und tatsächliche Löschprozesse gesondert kontrollieren.

## Scope und Evidenzbasis

| Teilprüfung | Schwerpunkt | Ergebnis der vorliegenden Teilprüfung |
|---|---|---|
| Mobiler Nutzbarkeitstest | Chromium/Android-Touch bei 360/390/412 CSS-px; Überlauf, Fokus, CTA- und Zielmaße | **blocker** |
| Öffentliche Nutzerreise | CTAs, Pilot/Demo/Preise, Login, Legal-Links, Sackgassen | **conditional** |
| Passiver technischer Audit | Rendering, HTTP/TLS/Redirects, Header/CSP, Ressourcen, PWA/Cache, Pilotformular | **conditional** |
| Rechts-/Kommunikations-Vorprüfung | Datenschutz, Pilot mit echten Daten, Preis-/Vorteilsangaben, Impressum, künftiger Checkout | **blocker** |
| Datenschutz- und Code-Audit | `/pilot`, `/datenschutz`, vier gelieferte Dateien, SMTP-/Rate-Limit-Pfad | **blocker** |
| Vertrauens-/Conversion-Audit | Werbestart der kostenlosen Pilotphase für ehrenamtliche Vereinsvorstände | **blocker** |

Prüfgegenstand waren – je nach Teilprüfung – `https://mycrewmate.de/`, `/pilot`, `/vereinsdemo`, `/angebot-demo`, `/impressum`, `/datenschutz` sowie ergänzend einzelne `app.mycrewmate.de`-Ziele und die in den Teilprüfungen benannten Quelldateien. Fehlende Teilprüfungen wurden nicht gemeldet.

## References

[1] **Europäische Union. Verordnung (EU) 2016/679 (Datenschutz-Grundverordnung), insbesondere Art. 5, 6, 13, 28 und 44 ff.** EUR-Lex. https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679

[2] **Der Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI). Informationspflichten.** https://www.bfdi.bund.de/DE/Buerger/Inhalte/Allgemein/Datenschutz/Informationspflichten.html

[3] **Datenschutzkonferenz (DSK). Kurzpapier Nr. 10: Informationspflichten bei der Erhebung von personenbezogenen Daten bei der betroffenen Person nach Art. 13 DSGVO.** https://www.datenschutzkonferenz-online.de/media/kp/dsk_kpnr_10.pdf

[4] **Bundesministerium der Justiz. Preisangabenverordnung (PAngV), insbesondere §§ 2, 3 und 11.** https://www.gesetze-im-internet.de/pangv_2022/

[5] **Bundesministerium der Justiz. Gesetz gegen den unlauteren Wettbewerb (UWG), insbesondere §§ 5, 5a, 8 und 13.** https://www.gesetze-im-internet.de/uwg_2004/

[6] **Datenschutzkonferenz (DSK). Kurzpapier Nr. 13: Auftragsverarbeitung, Art. 28 DSGVO.** https://www.datenschutzkonferenz-online.de/media/kp/dsk_kpnr_13.pdf

[7] **Der Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI). Logfile-Analyse.** https://www.bfdi.bund.de/DE/Buerger/Inhalte/Telemedien/LogFile_Analyse.html

[8] **Bundesministerium der Justiz. Umsatzsteuergesetz (UStG), § 19.** https://www.gesetze-im-internet.de/ustg_1980/__19.html

[9] **Industrie- und Handelskammer zu Köln. Preisangaben gegenüber Verbrauchern.** https://www.ihk.de/koeln/hauptnavigation/recht-steuern/preisangaben-gegenueber-verbrauchern-5224662

[10] **Bundesministerium der Justiz. Bürgerliches Gesetzbuch (BGB), insbesondere § 13, § 309 Nr. 9 und § 312j.** https://www.gesetze-im-internet.de/bgb/

[11] **Bundesministerium der Justiz. Digitale-Dienste-Gesetz (DDG), § 5.** https://www.gesetze-im-internet.de/ddg/__5.html
