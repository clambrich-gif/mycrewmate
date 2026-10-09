## Befunde

Die Bewertung beruht auf frischen, passiven Live-Abrufen von `https://mycrewmate.de/`, `https://mycrewmate.de/pilot` und `https://mycrewmate.de/datenschutz` am **09.10.2026**. Es wurden keine Formulare ausgefüllt oder abgesendet. Sie ist eine risikoorientierte Go-live-Prüfung, keine verbindliche Rechtsberatung.

### Dringend — Mindestkontrast auf Start- und Pilotseite nachweislich unterschritten

**Nachgewiesener Befund:** Der WCAG-2.1-AA-Scan im frisch gerenderten Chromium-DOM meldete auf der Startseite mehrere Kombinationen mit weißem Text auf `#ff6900` (Kontrast **2,82–2,88:1**) sowie orangefarbene Fließ-/Beschriftungstexte mit **3,51–3,60:1**. Betroffen sind unter anderem die sichtbaren CTA-Schaltflächen zur Pilotanfrage, der Tarif-Banner „FLEXIBEL · JEDES JAHR NEU“ und Abschnitts-Teaser. Auf `/pilot` wurden drei sichtbare orange CTA-/Submit-Schaltflächen mit **2,82 bzw. 2,88:1** festgestellt.

Für normalen Text verlangt WCAG 2.1 SC 1.4.3 mindestens **4,5:1**; nur großformatiger Text darf auf 3:1 zurückfallen. Gerade die 12- bzw. 14-px-CTAs und der 12-px-Bannertext sind nicht als Großtext privilegiert. [12] Die BFSGV verlangt, soweit das BFSG einschlägig ist, Webseiten wahrnehmbar, bedienbar, verständlich und robust zu gestalten; die Bundesfachstelle verweist für Websites und Apps auf EN 301 549. [9] [11]

**Rechtsrisiko:** Die technischen Abweichungen sind belegt. Ob daraus bereits ein BFSG-Verstoß folgt, ist **nicht allein aus der Website verifizierbar**: Das BFSG erfasst den elektronischen Geschäftsverkehr nur bei digitalen Diensten, die auf individuelle Anfrage eines Verbrauchers im Hinblick auf einen Verbrauchervertrag erbracht werden; Kleinstunternehmen sind bei Dienstleistungen ausgenommen. [4] [5] [6] Das Angebot adressiert sichtbar „Vereine“ und „Organisationen“ und die Pilotanfrage ist als unverbindlich bezeichnet. Es lässt daher weder einen Verbrauchervertrag noch die Unternehmensgröße zuverlässig erkennen. Bei jetziger oder geplanter B2C-Vertragsanbahnung ist die Abweichung vor Aktivierung dieses Pfads dringlich zu beheben.

**Umsetzung:** Zentralen Orange-Token und Orange-Texttoken so ändern, dass die konkret gerenderten Paare mindestens 4,5:1 erreichen (z. B. ein deutlich dunklerer Orange-Ton statt `#ff6900`; anschließend in allen Zuständen erneut messen). Nicht nur Hover-Zustände prüfen: Desktop, mobile Ansicht, Fokus, disabled und Text auf Farbverläufen abdecken. Ergebnis als automatisierten Kontrasttest im Release-Check festhalten.

### Dringend — falls BFSG anwendbar: keine auffindbare Barrierefreiheitsinformation in den geprüften Nutzerpfaden

**Nachgewiesener Befund:** Auf allen drei geprüften und gerenderten Seiten gab es weder sichtbaren Text noch einen Link mit „Barriere…“/„Accessibility“. Dies umfasst Startseite, Pilotpfad und Datenschutzhinweise. Eine möglicherweise separate AGB-Seite wurde nicht geprüft; deshalb ist das vollständige Fehlen einer Information im gesamten Angebot **nicht nachgewiesen**.

**Plausibles Risiko:** Gilt das BFSG, darf der Dienstleistungserbringer die Dienstleistung nur anbieten, wenn er die Informationen nach Anlage 3 erstellt und der Allgemeinheit in barrierefreier Form zugänglich macht. [7] Die Information muss deutlich wahrnehmbar erläutern, wie die Dienstleistung die Anforderungen erfüllt, und u. a. allgemeine Dienstleistungsbeschreibung, relevante Erklärungen und zuständige Marktüberwachungsbehörde enthalten. [8] Ein reiner Datenschutzlink ersetzt diese Information nicht.

**Umsetzung:** Vor einem B2C-Launch zunächst schriftlich klären und dokumentieren: (a) gibt es Verbraucher-Vertragsschlüsse bzw. eine darauf gerichtete individuelle Anfrage, (b) greift die Kleinstunternehmensausnahme tatsächlich? Falls BFSG anwendbar, eine leicht auffindbare, selbst barrierefreie Seite „Information zur Barrierefreiheit“ im Footer und im Anfrage-/Vertragspfad veröffentlichen. Sie muss den tatsächlichen Status beschreiben, bekannte Einschränkungen nicht verschweigen, die zuständige Marktüberwachungsbehörde nennen und nach jeder Produktänderung aktualisiert werden. Die Erklärung erst nach manueller Prüfung gegen EN 301 549/WCAG finalisieren.

### Dringend — horizontale Tarifvergleichstabelle nicht für Tastaturzugriff ausgelegt

**Nachgewiesener Befund:** Auf der Startseite ist der Tarifvergleich in einem horizontal scrollbaren Container (`overflow-x-auto`, `data-offer-comparison="true"`) ausgegeben. Der Scanner meldete: Container weder selbst fokussierbar noch mit fokussierbarem Inhalt. Der Container hat zwar einen Wisch-Hinweis per `aria-describedby`, aber keine fokussierbare Tastaturbedienung.

**Risiko:** Die Scannerfeststellung ist ein belastbarer Implementierungsbefund; die konkrete Bedienwirkung mit allen Browser-/Assistenztechnologien wurde nicht manuell durchgetestet. Praktisch besteht jedoch das naheliegende Risiko, dass reine Tastaturnutzende die rechts liegenden Vergleichsspalten nicht erreichen. WCAG 2.1 verlangt, dass alle Funktionen über eine Tastaturschnittstelle bedienbar sind. [13] Bei BFSG-Anwendbarkeit fällt dies in die gesetzliche Anforderung an eine bedienbare Website. [9]

**Umsetzung:** Vergleichsregion mit aussagekräftigem Namen als Region auszeichnen, fokussierbar machen (z. B. `tabindex="0"`) und eine echte, getestete horizontale Tastaturbedienung anbieten (Pfeiltasten bzw. klar beschriftete „nach links/rechts“-Bedienelemente, sichtbarer Fokus). Den Hinweis für Touch beibehalten, aber um einen Tastaturhinweis ergänzen. Mit Tab, Shift+Tab, Pfeiltasten und mindestens einem Screenreader testen.

### Empfehlung — „Nicht enthalten“ ist für Assistenztechnik semantisch fehlerhaft umgesetzt

**Nachgewiesener Befund:** In sieben Zellen des Tarifvergleichs stehen generische `<span>`-Elemente mit `aria-label="Nicht enthalten"`, jedoch ohne zulässige Rolle. Axe meldete jeweils `aria-prohibited-attr`; ein `aria-label` ist an einem rollenlosen `span` nicht zulässig. Damit ist nicht verlässlich, dass der visuelle Status „nicht enthalten“ in der Zelle vorgelesen wird.

**Umsetzung:** Den Status als echten Text im Tabellenfeld ausgeben, z. B. visuelles Symbol mit `aria-hidden="true"` und zusätzlich `<span class="sr-only">Nicht enthalten</span>`. Alternativ nur bei einem tatsächlich bildhaften Icon `role="img"` mit passendem zugänglichem Namen einsetzen. Danach Tabellenkopf-/Zellbeziehungen und Screenreader-Ausgabe in NVDA/VoiceOver prüfen.

### Dringend — Datenschutzhinweise nennen keine Speicherdauer/Kriterien für Serverprotokolle

**Nachgewiesener Befund:** Abschnitt „3. Technische Zugriffe“ der live veröffentlichten Datenschutzhinweise nennt IP-Adresse, Zeitpunkt, angeforderte Seite und Browserinformationen, Zweck/Sicherheit, Art. 6 Abs. 1 lit. f DSGVO sowie Hetzner in Deutschland. Für **diese Serverprotokolle** fehlt aber eine Dauer oder ein Kriterium der Festlegung. Die Dreijahresfrist der Seite betrifft ausdrücklich Pilotanfragen bzw. Pilotdaten, nicht Webserver-/Reverse-Proxy-/Anwendungslogs.

**Rechtsrisiko:** Bei Erhebung personenbezogener Daten verlangt Art. 13 Abs. 2 Buchst. a DSGVO die Speicherdauer oder, falls das nicht möglich ist, die Kriterien für ihre Festlegung. [2] IP-Adressen und Online-Kennungen können personenbezogene Daten bzw. identifizierende Spuren sein. [2] Der Informationsmangel ist damit für den sichtbaren Webzugriff plausibel und konkret, unabhängig von Cookies.

**Umsetzung:** Tatsächliche Retention je Logquelle verbindlich ermitteln (Hosting, Reverse Proxy/CDN, Webserver, Anwendung, Sicherheits-/Fehlerlogs, Backups), Löschjob und Zugriffsrechte verifizieren und dann präzise veröffentlichen. Nur die reale Regel nennen, etwa „Zugriffsprotokolle werden nach X Tagen gelöscht, sofern kein sicherheitsrelevanter Vorfall eine längere Aufbewahrung erfordert“; für Ausnahmen das Kriterium und die maximale Dauer benennen. Bei mehreren Quellen transparent unterscheiden.

### Nice to have — Sicherheitsheader weiter härten und Produktfingerprint reduzieren

**Nachgewiesener Befund:** Positiv ist eine restriktive CSP vorhanden; zugleich senden alle drei Antworten `x-powered-by: Express` und die CSP enthält `style-src 'self' 'unsafe-inline'`. Das ist kein nachgewiesener Datenschutzverstoß und kein akuter Exploitnachweis, schwächt aber Defense-in-depth bzw. verrät unnötig Framework-Informationen.

**Umsetzung:** `X-Powered-By` serverseitig entfernen. Prüfen, ob Inline-Styles durch Nonces/Hashes oder mindestens eine engere CSP abgelöst werden können, ohne die App zu brechen. CSP in Report-Only testen und anschließend produktiv schärfen; die bereits guten Vorgaben `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` und `frame-ancestors 'self'` beibehalten.

### Nice to have — Freigabe externer Medien/Map-Tiles nur mit Release-Gate

**Nachgewiesener Befund:** In der CSP sind `https://*.tile.openstreetmap.org`, `https://*.tile.opentopomap.org` (Bilder) und `https://files.manuscdn.com` (Medien) erlaubt. Bei frischen Abrufen der drei Scope-Seiten wurde von diesen Hosts **keine** Ressource geladen; tatsächlich gingen alle dokumentierten Laufzeitrequests an `mycrewmate.de`. Somit ist gegenwärtig kein externer Tracker oder externer Cookie-Zugriff nachgewiesen.

**Plausibles Betriebsrisiko:** Werden Maps oder externe Medien später aktiviert, erhält der jeweilige Anbieter mindestens die Verbindungsdaten/IP-Adresse. Ob zusätzlich Endeinrichtungszugriffe stattfinden, hängt von der konkreten Einbindung ab und ist derzeit nicht verifizierbar. Speichern/Auslesen auf Endgeräten verlangt grundsätzlich die vorherige, klar informierte DSGVO-konforme Einwilligung, soweit keine enge Ausnahme greift. [1] Die DSK betont zudem aktive Einwilligung, gleich leichte Ablehnung und Widerruf, wenn eine Einwilligung nötig ist. [3]

**Umsetzung:** Vor jeder Aktivierung fremder Ressourcen einen technischen Laufzeittest mit frischem Profil durchführen: Request-Domains, Cookies, Local/Session Storage, Transfers und Empfänger dokumentieren. Datenschutztext, Art.-6-Rechtsgrundlage, ggf. §-25-TDDDG-Einwilligung und Consent-UI nur bei tatsächlicher Einwilligungspflicht ergänzen. Bis dahin die erlaubten Hosts in der CSP auf tatsächlich benötigte Quellen beschränken.

## Positiv verifiziert

- **Keine aktuelle Cookie-/Tracker-Abweichung sichtbar:** Im frischen Chromium-Profil setzten alle drei Scope-Seiten keine Cookies sowie keinen Local- oder Session-Storage. Es wurde kein Consent-Banner angezeigt. Das ist bei dem beobachteten, trackerfreien Betrieb kein Mangel: § 25 TDDDG verlangt eine Einwilligung erst für Speichern/Auslesen in der Endeinrichtung, soweit keine Ausnahme gilt; ein Banner „auf Vorrat“ wäre nicht sinnvoll. [1] Die live veröffentlichte Aussage „keine Analyse- oder Werbetracker“ wird durch diesen begrenzten Erstaufruf gestützt.
- **Keine externen Laufzeitressourcen im Scope:** Die frischen Netzwerkmitschnitte enthielten nur First-Party-Requests an `mycrewmate.de` (HTML, JavaScript/CSS, Schrift, Manifest, Markenbild, interne Maskottchen-API). Kein Google-, Meta-, Analyse-, Chat-, Zahlungs- oder CDN-Request wurde beobachtet. Das ist eine Momentaufnahme der drei Seiten ohne Klicks und keine Zusicherung für andere Routen.
- **Sicherheitsgrundlage der Antworten ist solide:** HTTP leitete mit 307 auf HTTPS um; vorhanden sind HSTS inklusive Subdomains, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, restriktive Permissions-Policy (Kamera/Mikrofon/Geolocation deaktiviert) und Frame-Schutz (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`).
- **Nutzbare Grundstruktur:** `lang="de"`, sichtbarer „Zum Inhalt springen“-Link sowie `main`, `header`, `nav` und `footer` sind auf Start- und Pilotseite vorhanden. Der Pilotfragebogen zeigte im Scanner keine Label-, Titel-, Sprach- oder Formularnamen-Verstöße; die Datenschutzerklärung hat keine Axe-Fehler, nur einen wegen Farbverlauf nicht automatisch abschließend bewertbaren Kontrasthinweis.
- **Datenschutzinformation im Übrigen konkret:** Verantwortlicher/Kontakt, Zweck und Datenfelder der Pilotanfrage, Rechtsgrundlagen, Hetzner als Mail-/Hostingempfänger, Dreijahresfrist für Pilotanfragen und Rechte der betroffenen Personen sind veröffentlicht. Damit ist die „keine Tracker“-Aussage nicht isoliert, sondern in einen nachvollziehbaren Webdatenschutztext eingebettet.

## Nicht verifizierbare Betriebsannahmen und Scope-Grenzen

- **BFSG-Anwendbarkeit:** Aus den drei öffentlichen Seiten ist nicht feststellbar, ob MyCrewMate Verbrauchern einen Vertrag anbietet bzw. die Anfrage auf einen Verbrauchervertrag gerichtet ist, und ob die Kleinstunternehmensausnahme nach § 3 Abs. 3 BFSG greift. [4] [5] [6] Die Dringlichkeit der BFSG-Befunde ist deshalb als bedingter Go-live-Blocker formuliert, nicht als pauschale Feststellung.
- **Formular-Back-End und Schutzmaßnahmen:** Wegen der ausdrücklich unterlassenen Formularabsendung sind Übertragungsweg, serverseitige Validierung, CSRF-/Spam-Schutz, Rate Limits, tatsächliche Empfänger, Datenbank-/Backup-Löschung und E-Mail-Header nicht geprüft. Die Darstellung `method="get"` im gerenderten DOM beweist keine Datenübertragung, weil die React-Anwendung einen Submit-Handler verwenden kann; daraus wird kein Befund abgeleitet.
- **Weitere Routen und getrennte Anwendung:** Nicht geprüft sind insbesondere `https://app.mycrewmate.de`, die fiktive Demo nach Interaktion, AGB/AVV, Login, eingeloggte Funktionen, Service Worker nach späterer Nutzung sowie mobil/hochkant und mit realen Assistenztechnologien. Die Prüfung belegt daher nicht, dass dort keine Cookies, Tracker oder Zugänglichkeitsmängel vorkommen.
- **Serverlogs:** Dass Hetzner- oder Anwendungslogs tatsächlich nur wie angekündigt verarbeitet und gelöscht werden, kann öffentlich nicht überprüft werden. Der fehlende veröffentlichte Zeitraum ist der Befund; die reale Retention ist eine zu belegende Betriebsannahme.

## Quellen

[1]: https://www.gesetze-im-internet.de/ttdsg/__25.html "TDDDG § 25 Schutz der Privatsphäre bei Endeinrichtungen"
[2]: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679 "Datenschutz-Grundverordnung, insbesondere Artikel 5 bis 7 und 13"
[3]: https://www.datenschutzkonferenz-online.de/media/oh/20221205_oh_Telemedien_2021_Version_1_1_Vorlage_104_DSK_final.pdf "DSK Orientierungshilfe für Anbieterinnen und Anbieter von Telemedien, Version 1.1"
[4]: https://www.gesetze-im-internet.de/bfsg/__1.html "BFSG § 1 Zweck und Anwendungsbereich"
[5]: https://www.gesetze-im-internet.de/bfsg/__2.html "BFSG § 2 Begriffsbestimmungen"
[6]: https://www.gesetze-im-internet.de/bfsg/__3.html "BFSG § 3 Barrierefreiheit und Kleinstunternehmen"
[7]: https://www.gesetze-im-internet.de/bfsg/__14.html "BFSG § 14 Pflichten des Dienstleistungserbringers"
[8]: https://www.gesetze-im-internet.de/bfsg/anlage_3.html "BFSG Anlage 3 Informationen über Dienstleistungen, die den Barrierefreiheitsanforderungen entsprechen"
[9]: https://www.gesetze-im-internet.de/bfsgv/__12.html "BFSGV § 12 Allgemeine Anforderungen an Dienstleistungen"
[10]: https://www.gesetze-im-internet.de/bfsgv/__19.html "BFSGV § 19 Zusätzliche Anforderungen an Dienstleistungen im elektronischen Geschäftsverkehr"
[11]: https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/FAQ-elektronischer-Geschaeftsverkehr/faq-elektronischer-Geschaeftsverkehr_node.html "Bundesfachstelle Barrierefreiheit: FAQ Dienstleistungen im elektronischen Geschäftsverkehr"
[12]: https://www.w3.org/TR/WCAG21/#contrast-minimum "WCAG 2.1, Erfolgskriterium 1.4.3 Contrast Minimum"
[13]: https://www.w3.org/TR/WCAG21/#keyboard "WCAG 2.1, Erfolgskriterium 2.1.1 Keyboard"
