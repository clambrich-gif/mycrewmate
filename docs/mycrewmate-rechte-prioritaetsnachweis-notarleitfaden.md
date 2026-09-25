# MyCrewMate: Urheberrecht, Nutzungsrechte und notarieller Prioritätsnachweis

**Stand:** 25. September 2026  
**Zweck:** Dieser Leitfaden beschreibt eine belastbare Vorgehensweise, um den aktuellen MyCrewMate-Quellstand, die menschlichen Entwicklungsbeiträge und die verfügbaren Nutzungsrechte nachvollziehbar zu dokumentieren. Er ersetzt keine individuelle Beratung durch einen auf IT- und Urheberrecht spezialisierten Rechtsanwalt oder durch den beauftragten Notar.

## Die rechtliche Ausgangslage

Der Gedanke, den Quellcode beweissicher zu dokumentieren, ist richtig. Für Software entsteht in Deutschland jedoch kein Urheberrecht erst durch einen Registereintrag. Computerprogramme einschließlich Entwurfsmaterial sind nach § 69a UrhG geschützt, wenn sie eine individuelle eigene geistige Schöpfung ihres Urhebers darstellen. Ideen, allgemeine Abläufe, Funktionen und zugrunde liegende Grundsätze werden dadurch nicht geschützt; geschützt ist ihre konkrete Ausdrucksform, insbesondere der konkrete Code. [1]

Urheber ist immer der menschliche Schöpfer. Das Urheberrecht entsteht mit der Schöpfung, muss nicht angemeldet werden und ist nicht als Ganzes übertragbar. Der Urheber kann aber einfache oder ausschließliche, räumlich, zeitlich und inhaltlich definierte Nutzungsrechte einräumen. [2] [3]

Eine notarielle Hinterlegung schafft deshalb **kein neues Urheberrecht und keine amtliche Eigentumsregistrierung**. Sie ist ein Prioritäts- und Beweismittel: Sie soll später belegen helfen, dass ein konkret identifizierter Entwicklungsstand spätestens an einem bestimmten Tag existierte und von wem hierzu eine Erklärung abgegeben wurde. Die Fachliteratur bezeichnet solche Vorgänge als „Prioritätsverhandlungen“ und trennt sie klar von einem Software-Escrow, der vor allem die spätere Herausgabe an Anwender regelt. [4]

> Für MyCrewMate sollten zwei Ziele getrennt behandelt werden: **(1) Prioritätsnachweis für den eigenen Entwicklungsstand** und **(2) Schutz der Betriebsfähigkeit bei Ausfall eines Herstellers**. Für Ziel 1 ist die notarielle Dokumentation sinnvoll. Ein Escrow-Vertrag ist erst relevant, wenn Dritte bei klar definierten Ereignissen Zugriff auf den Code erhalten sollen.

## Was bei KI-unterstützter Entwicklung besonders wichtig ist

Die Aussage „Wer eine KI steuert, ist automatisch Urheber des gesamten Codes“ wäre zu weitgehend. Nach der Information des Bundesministeriums der Justiz genießen rein KI-basierte Inhalte keinen urheberrechtlichen Schutz. Eine menschliche Urheberschaft kommt nur in Betracht, wenn die KI als untergeordnetes Hilfsmittel eingesetzt wird und ausreichender Einfluss auf die konkrete Formgestaltung beim Menschen verbleibt. Das ist eine Einzelfallfrage. [5]

Für MyCrewMate sollte deshalb **nicht** erklärt werden, eine Person habe jede einzelne Codezeile allein geschrieben, wenn dies tatsächlich nicht stimmt. Rechtssicherer ist eine wahrheitsgemäße Dokumentation der menschlichen Beiträge, zum Beispiel:

- Produktidee, Zielgruppen- und Funktionskonzept;
- konkrete Anforderungen, Priorisierung und Freigaben;
- Architekturentscheidungen, Datenmodell- und Sicherheitsvorgaben;
- konkrete Änderungsanweisungen, Auswahl zwischen Varianten sowie fachliche und gestalterische Entscheidungen;
- eigene Änderungen, Prüfung, Testvorgaben, Fehleranalyse und Abnahme;
- die nachweisbare Integration der Ergebnisse in den konkreten Produktstand.

Die aktuellen Manus-Bedingungen erklären im Verhältnis zwischen Manus und dem Nutzer, dass Manus weder Input noch Output beansprucht und der Nutzer die Rechte daran innehat. Zugleich weisen sie ausdrücklich darauf hin, dass Ergebnisse nicht einzigartig oder nach anwendbarem Recht schutzfähig sein müssen. Das ist eine wichtige **vertragliche Rechteposition gegenüber Manus**, ersetzt aber nicht die urheberrechtliche Prüfung der menschlichen Schöpfungshöhe oder die Prüfung fremder Rechte. [6]

## Wer hat welche Rechte?

| Bestandteil | Praktische Zuordnung | Nachweis oder Maßnahme |
|---|---|---|
| Eigene menschliche Beiträge | Der jeweilige menschliche Schöpfer ist Urheber. | Entwicklungsprotokoll, Git-Historie, Notarakte, Erklärung der eigenen Beiträge. |
| Nutzung für das Produkt | Der Urheber kann dem späteren Unternehmen oder der eigenen Tätigkeit ausschließliche Nutzungsrechte einräumen. | Schriftliche Rechteübertragung bzw. Lizenz mit klarer Produkt-, Änderungs-, Vertriebs- und Unterlizenzierungsbefugnis. |
| Arbeitnehmer-Code | Bei Computerprogrammen in Erfüllung der Aufgaben bzw. nach Weisung ist der Arbeitgeber grundsätzlich zur Ausübung der vermögensrechtlichen Befugnisse berechtigt. | Arbeitsvertrag, Aufgabenbeschreibung und Dokumentation; bei Unsicherheit zusätzlich ausdrückliche Klausel. [3] |
| Freelancer, Agenturen oder externe Entwickler | Es gibt keine entsprechende automatische gesetzliche Regel wie bei Arbeitnehmern. | Vor Beginn oder spätestens vor Übernahme: schriftliche Einräumung umfassender, ausschließlicher und übertragbarer Nutzungsrechte prüfen lassen. [7] |
| Manus-Output | Manus beansprucht nach den aktuell abrufbaren Bedingungen keinen Besitz an Input/Output gegenüber dem Nutzer. | Aktuelle Bedingungen als PDF sichern; menschliche Beiträge und die konkrete Integration dokumentieren. [6] |
| Open-Source-Bibliotheken, Fonts, Icons, Karten, Medien | Diese bleiben bei ihren jeweiligen Rechteinhabern und unterliegen ihren Lizenzen. | Lizenzinventar/SBOM, Lizenztexte und erforderliche Hinweise in das Beweispaket aufnehmen. |
| Markenname und Logo | Das ist nicht automatisch durch den Quellcode geschützt. | Marken- und Kollisionsrecherche; bei Bedarf deutsche oder Unionsmarke. Für ein prägnantes UI kann zusätzlich Designschutz geprüft werden. |

Wichtig für eine spätere Gesellschaft: **Die natürliche Person ist Urheber; ein Unternehmen ist regelmäßig Rechteinhaber aufgrund eines Nutzungsrechtsvertrags, nicht „Urheber“.** Wenn MyCrewMate später über eine UG oder GmbH vertrieben wird, sollten Sie die ausschließlichen, zeitlich und räumlich unbeschränkten Nutzungsrechte an den eigenen menschlichen Beiträgen ausdrücklich an diese Gesellschaft einräumen lassen. Das sollte ein IT-Rechtsanwalt konkret formulieren.

Nicht veröffentlichter Quellcode kann daneben Geschäftsgeheimnis sein. Das setzt unter anderem wirtschaftlichen Wert, ein berechtigtes Geheimhaltungsinteresse und angemessene Geheimhaltungsmaßnahmen voraus. [8] Zugriffsrechte, vertrauliche Verträge, kein Teilen von Produktionsgeheimnissen und eine saubere Geheimniskennzeichnung sind deshalb ebenso wichtig wie die notarielle Prioritätsdokumentation.

## Empfohlenes Zielbild: vier Beweisebenen

Eine einzelne Maßnahme reicht selten aus. Für MyCrewMate empfehle ich diese Kombination:

1. **Saubere Git-Historie.** Der aktuelle Stand liegt auf dem Branch `main` im Commit `63a27bd7a825` vom 25. September 2026, der Arbeitsbaum war bei der Prüfung sauber. Git allein ist hilfreich, aber kein unabhängiger amtlicher Zeitnachweis.
2. **Reproduzierbares Beweispaket.** Ein eingefrorenes Archiv enthält genau den Quellstand, ein vollständiges Dateiverzeichnis und kryptografische Prüfsummen.
3. **Unabhängiger Zeitnachweis.** Zusätzlich zur Notarakte sollte das unveränderte Archiv mit einem qualifizierten elektronischen Zeitstempel versehen werden. Für diesen gilt nach Art. 41 eIDAS die Vermutung der Richtigkeit von Datum und Uhrzeit sowie der Unversehrtheit der verknüpften Daten. [9]
4. **Notarielle Prioritätsdokumentation.** Der Notar hält Identität, Datum, Erklärung, Archivbezeichnung und Prüfsummen in einer geeigneten Urkunde oder Tatsachenbescheinigung fest und verwahrt das vereinbarte Material bzw. dessen beweiskräftig verknüpften Nachweis.

## Schritt für Schritt zum Notartermin

### 1. Rechtekette zuerst klären

Erstellen Sie vor dem Termin eine Liste aller Personen und Unternehmen, die am Produkt mitgewirkt haben. Für jede Position notieren Sie: Name, Rolle, Zeitraum, Beitrag und Vertragsgrundlage. Markieren Sie offene Punkte, etwa fremde Vorlagen, externe Aufträge, Designleistungen oder aus einem alten Projekt übernommene Dateien.

Ergebnis dieses Schritts ist keine pauschale Behauptung, sondern eine belastbare Rechtekette. Gibt es externe Mitwirkende ohne klare Vereinbarung, sollte zuerst ein IT-Rechtsanwalt eine Rechteübertragung beziehungsweise Lizenzvereinbarung vorbereiten.

### 2. Den Notar mit dem richtigen Auftrag anfragen

Bitten Sie nicht nur allgemein um „Hinterlegung von Code“. Fragen Sie gezielt nach einer **notariellen Prioritätsdokumentation für ein digitales Quellcode-Beweispaket**. Der Notar soll vorab bestätigen, welches Verfahren seine Kanzlei anbietet und ob sie digitale Datenträger bzw. verschlüsselte Archive verwahrt.

Vorschlag für die Anfrage:

> Ich möchte den Entwicklungsstand meiner Software „MyCrewMate“ zum Prioritätsnachweis dokumentieren lassen. Vorgesehen ist ein digital signiertes bzw. mit SHA-256-Prüfsummen identifiziertes Quellcode-Archiv ohne Zugangsdaten und ohne Produktivdaten. Ich bitte um Auskunft, ob Sie eine Tatsachenbescheinigung bzw. notarielle Niederschrift über die Vorlage und Verwahrung eines digitalen Beweispakets erstellen können, wie die Prüfsummen als Anlage aufgenommen werden und welche Form der Verwahrung Sie empfehlen. Es geht zunächst nicht um eine Herausgabe an Kunden im Sinne eines Software-Escrow.

Der Notar entscheidet über das passende Instrument. In Betracht kommen insbesondere eine Tatsachenbescheinigung über die Vorlage, eine notarielle Erklärung mit Unterschriftsbeglaubigung oder eine weitergehende Verwahrungsvereinbarung. Das deutsche Notarinstitut weist darauf hin, dass die konkrete Ausgestaltung der beweiskräftigen Verbindung und Verwahrung wesentlich ist. [4]

### 3. Das technische Beweispaket vorbereiten

Das Paket soll einen bestimmten Entwicklungsstand identifizieren und später reproduzierbar machen. Es sollte enthalten:

- den vollständigen eigenen Quellcode einschließlich Datenbankschema, Migrationen, Tests, Build- und Deploy-Konfigurationen;
- `package.json` und Lock-Dateien, damit der Abhängigkeitsstand feststeht;
- eine lesbare Datei `EVIDENCE-README.md` mit Produktname, Versionsstand, Git-Commit, Erstellungsdatum, Build-Anleitung und Dateizählung;
- `SHA256SUMS.txt` mit einer SHA-256-Prüfsumme für jede enthaltene Datei;
- einen Gesamt-Hash des finalen Archivs;
- eine Lizenzübersicht für Drittkomponenten und die erforderlichen Lizenztexte;
- eine kurze menschliche Beitrags- und Rechteerklärung, die nur wahre Tatsachen enthält;
- optional: Architekturübersicht, freigegebene Screenshots und Funktionsliste als ergänzende Entwurfsdokumentation.

Nicht in das Paket gehören: `.env`-Dateien, Datenbank-Dumps, Passwörter, API-Schlüssel, Tokens, SMTP-Zugangsdaten, Session-Schlüssel, personenbezogene Pilotdaten, echte E-Mail-Adressen oder sonstige Produktionsgeheimnisse. Diese Daten steigern den Beweiswert nicht, erhöhen aber das Sicherheits- und Datenschutzrisiko.

### 4. Integrität und Vertraulichkeit festlegen

Das finale Archiv wird erst nach Erzeugung aller Prüfsummen erstellt. Der Notarakte sollte mindestens der Dateiname des Archivs, dessen Größe, der SHA-256-Gesamt-Hash, die Hash-Methode und die Version der Manifestdatei beigefügt werden.

Wenn das komplette Archiv beim Notar verwahrt werden soll, gibt es zwei praktikable Varianten:

- **lesbar, versiegelt und vertraulich verwahrt:** Der Notar kann das Material identifizieren, die Kanzlei muss jedoch die sichere Verwahrung gewährleisten;
- **verschlüsselt verwahrt:** Das Archiv bleibt ohne Schlüssel unlesbar, später kann durch Entschlüsselung und Vergleich mit dem hinterlegten Hash gezeigt werden, dass der Inhalt identisch ist. Die Schlüsselverwahrung muss dann separat und kontrolliert geregelt werden.

Für den Prioritätsnachweis ist die kryptografische Identifikation zentral. Für ein späteres Escrow, bei dem ein Kunde tatsächlich arbeitsfähig mit dem Code weiterarbeiten soll, reichen Hash und Archiv alleine nicht aus; dann müssten Vollständigkeit, Lesbarkeit, Abhängigkeiten und gegebenenfalls ein Build getestet werden. [4]

### 5. Den qualifizierten Zeitstempel ergänzen

Lassen Sie das finale Archiv und idealerweise auch die Manifestdatei von einem qualifizierten Vertrauensdiensteanbieter mit einem qualifizierten elektronischen Zeitstempel versehen. Bewahren Sie Archiv, Zeitstempeldatei, Prüfprotokoll und Validierungsnachweis gemeinsam auf. Ein solcher Zeitstempel ergänzt den Notar: Er stärkt gerade die technische Integritäts- und Zeitdokumentation der Bytes. [9]

### 6. Notartermin durchführen und Unterlagen sichern

Zum Termin nehmen Sie mit:

- Personalausweis;
- das finale Beweispaket auf einem neuen, geprüften Datenträger oder nach Vorgabe des Notars über einen sicheren Übertragungsweg;
- das Prüfsummenblatt in Papierform und digital;
- die Rechte- und Beitragsliste;
- die gesicherten Manus-Nutzungsbedingungen und gegebenenfalls die aktuellen Bedingungen weiterer KI- oder Entwicklungswerkzeuge;
- eine kurze Produktbeschreibung mit Name, Stand und Zweck.

Bitten Sie darum, dass die Urkunde oder Anlage eindeutig auf die Prüfsummen verweist. Lassen Sie sich eine Ausfertigung bzw. Abschrift und die genaue Verwahrangabe geben. Dokumentieren Sie die Aktennummer sicher außerhalb des Quellcode-Archivs.

### 7. Danach laufend fortschreiben

Eine Hinterlegung vom heutigen Tag schützt nicht automatisch spätere Versionen. Wiederholen Sie das Verfahren bei wesentlichen Releases, insbesondere vor Pilot-Ausweitungen, größeren Architekturwechseln, einer Gesellschaftsgründung, einer Investition, einem Verkauf oder einer Markteinführung.

Praktisch empfehlenswert sind feste Meilensteine: Produktversion 1.0, jeder große Datenmodellwechsel, jedes größere Rechtekettenereignis und mindestens ein dokumentierter Jahresstand.

## Was ich technisch für Sie vorbereiten kann

Nach Ihrer Freigabe kann ich ein **notartaugliches MyCrewMate-Beweispaket** erzeugen. Es enthält keine Geheimnisse und keine Produktionsdaten. Ich liefere darin:

1. das bereinigte Quellarchiv des verifizierten Git-Standes;
2. ein vollständiges SHA-256-Dateimanifest und den Gesamt-Hash des Archivs;
3. eine reproduzierbare Build- und Versionsbeschreibung;
4. eine Inventarliste der Abhängigkeiten und Dritt-Lizenzen;
5. eine ausfüllbare, wahrheitsgemäße Erklärung zu Ihren menschlichen Beiträgen und zur Rechtekette;
6. einen kurzen Begleitbrief an die Notarkanzlei.

Ich kann technische Fakten und den konkreten Quellstand dokumentieren. Ich kann jedoch **keine Tatsachen in Ihrem Namen eidesstattlich oder notariell erklären** und auch keine fehlenden Rechte von Mitwirkenden ersetzen. Die abschließende rechtliche Prüfung der Rechtekette, der KI-Anteile, möglicher Marken sowie einer späteren Übertragung an eine UG/GmbH sollte deshalb ein spezialisierter IT-/IP-Rechtsanwalt übernehmen.

## Konkrete Entscheidung für den nächsten Schritt

Für den jetzigen Stand empfehle ich diese Reihenfolge:

1. Sie bestätigen, ob das Beweispaket den aktuellen Produktivstand oder zusätzlich den separaten Design-Vorschau-Stand erfassen soll.
2. Ich erzeuge das bereinigte Beweispaket samt Hashes, Manifest, Lizenzinventar und Notar-Anschreiben.
3. Sie ergänzen die persönliche Beitrags- und Mitwirkendenliste anhand der tatsächlichen Entwicklung.
4. Ein IT-/IP-Rechtsanwalt prüft die Rechtekette und formuliert bei Bedarf die Rechteübertragung an ein späteres Unternehmen.
5. Erst danach vereinbaren Sie den Notartermin für Prioritätsdokumentation und Verwahrung.

## References

[1]: https://www.gesetze-im-internet.de/urhg/__69a.html "UrhG § 69a – Gegenstand des Schutzes für Computerprogramme"

[2]: https://www.dpma.de/service/schutzrechte_kurz_erklaert/urheberrecht/index.html "DPMA – Urheberrecht entsteht mit der persönlichen geistigen Schöpfung"

[3]: https://www.gesetze-im-internet.de/urhg/BJNR012730965.html "UrhG §§ 7, 29, 31, 69b und 69c – Urheber, Nutzungsrechte und Computerprogramme"

[4]: https://www.dnoti.de/download/?tx_dnotionlineplusapi_download%5Bnodeid%5D=f68f00ee-7c0a-4cca-a784-7724f29f3856&cHash=ff8c294e788f3620465471c86b9f0cf8 "Deutsches Notarinstitut – Die Hinterlegung von Quellcodes und Prioritätsverhandlungen in der notariellen Praxis"

[5]: https://www.bmj.de/SharedDocs/Downloads/DE/Themen/Nav_Themen/240305_FAQ_KI_Urheberrecht.pdf?__blob=publicationFile&v=2 "BMJ – Künstliche Intelligenz und Urheberrecht: Fragen und Antworten"

[6]: https://manus.im/terms "Manus Terms – Content Ownership and License"

[7]: https://www.dpma.de/service/schutzrechte_kurz_erklaert/geistigeseigentumdigital/index.html "DPMA – Geistiges Eigentum in der digitalen Welt"

[8]: https://www.gesetze-im-internet.de/geschgehg/__2.html "GeschGehG § 2 – Definition des Geschäftsgeheimnisses"

[9]: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:02014R0910-20140917 "eIDAS-Verordnung Artikel 41 und 42 – Rechtswirkung qualifizierter elektronischer Zeitstempel"
