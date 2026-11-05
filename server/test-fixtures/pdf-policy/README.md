# PDF-Policy-Testfixtures

Alle Dateien werden ausschließlich durch
`python3 scripts/create-pdf-policy-test-fixtures.py` erstellt. Sie enthalten
fiktive DEMO-Daten, eine sichtbare Testkennzeichnung und keine Kundendaten.
Der Generator liest keine Originalbelege oder Uploads und verwendet weder
Datenbank noch API. Er schreibt nur dieses Fixture-Verzeichnis, prüft alle PDFs
mit `PdfReader(strict=True)` und erstellt jedes PDF zweimal zum Bytevergleich.
Ausnahmen sind ausschließlich `duplicate-action.pdf` und `partial-action.pdf`:
diese absichtlich mehrdeutigen/fehlerhaften Aktionswörterbücher werden mit
`strict=False`, korrekten xref-Offsets, exakten Rohbytes und erwarteten
Parser-Warnungen geprüft, nicht mit einem strikten Objekt-Walk. Parser-Meldungen
werden nur gezählt; Rohinhalte gelangen nicht auf stdout oder stderr.
`manifest.json` enthält für jeden Dateinamen `expected: allow` oder `deny` und
wird ebenfalls als JSON auf stdout ausgegeben. Reproduzierbarkeit gilt bei
identischer Python-/pypdf-/zlib-Version; die Fixtures wurden mit pypdf 6.19.0
erstellt. Die festen Daten enthalten keine Zeitstempel des Generatorlaufs.

## Erlaubte Fälle

| Fixture | Zweck |
| --- | --- |
| `plain.pdf` | Eine normale einseitige PDF ohne Anhänge oder Aktionen. |
| `xrechnung-cii.pdf` | Genau ein komprimierter Anhang `xrechnung.xml`, CII-Wurzel `CrossIndustryInvoice`, Namespace `urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100`, Rechnung `DEMO-001` und XRechnung-3.0-Profil. |
| `ubl-invoice.pdf` | Genau ein komprimierter Anhang `xrechnung.xml`, UBL-Wurzel `Invoice`, Namespace `urn:oasis:names:specification:ubl:schema:xsd:Invoice-2`; `cbc:CustomizationID` ist das XRechnung-3.0-Profil und `cbc:ProfileID` der Peppol-Abrechnungsprozess. |
| `link.pdf` | Normale HTTPS-Linkannotation mit `/A /S /URI`, ohne automatische Auslösung oder Folgeaktion. |
| `type3-glyph-a.pdf` | Korrekte Type3-Schrift mit `/CharProcs << /A ... >>`; `/A` bezeichnet ausschließlich einen reinen Glyph-Stream, keine Aktion. |
| `type3-glyph-b.pdf` | Gleiche Type3-Struktur mit `/CharProcs << /B ... >>` als positiver Vergleichsfall. |

Profil: `urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`.
Prozess: `urn:fdc:peppol.eu:2017:poacc:billing:01:1`.
Beide positiven XML-Dokumente sind vollständig und wohlgeformt und enthalten
Rechnungsdatum, fiktive Parteien, eine Position, Steuer und stimmige Summen.
Sie sind Policy-Fixtures, keine Behauptung formeller XSD-/Schematron-Konformität
oder einer PDF/A-Zertifizierung. Sie enthalten keine DTD, Entity-Deklarationen,
XInclude-Elemente oder Stylesheet-Verarbeitungsanweisungen.

## Abzuweisende Fälle

| Fixture | Zweck |
| --- | --- |
| `dangerous-javascript.pdf` | Klickaktion `/S /JavaScript` mit String-`/JS`; der Testcode zeigt nur einen DEMO-Dialog. |
| `escaped-javascript.pdf` | Gleiches JavaScript, aber tatsächlich als `/Java#53cript` serialisiert. pypdf normalisiert beim Lesen zu `/JavaScript`. Der Writer erzeugt korrekte xref-Offsets; keine nachträgliche Byte-Manipulation. |
| `launch.pdf` | Klickaktion `/S /Launch` auf einen nicht vorhandenen fiktiven Dateinamen. |
| `extra-attachment.pdf` | Gültiges CII-XML plus ein zweiter, harmloser Textanhang. |
| `invalid-xml.pdf` | Anhang heißt `xrechnung.xml`, enthält aber keinen XML-Inhalt. |
| `wrong-profile.pdf` | Vollständiges CII-Dokument mit absichtlich falschem Profil. |
| `dtd-xml.pdf` | CII-XML mit interner `DOCTYPE`-/`ENTITY`-Deklaration; nur ein harmloses Literal, keine externen Ressourcen und keine Entity-Bombe. |
| `xinclude-xml.pdf` | CII-XML mit XInclude-Element und `.invalid`-URL; der Generator führt kein Include aus. |
| `encrypted.pdf` | Deterministisch RC4-128-verschlüsselte PDF; Testpasswort `fixture-only`. Diese alte Verschlüsselung dient ausschließlich als Erkennungsfixture. |
| `compressed-javascript.pdf` | `/S /JavaScript` mit indirektem `/JS`-Stream unter `/Filter /FlateDecode`; JavaScript liegt nicht im Klartext in den PDF-Bytes. Streamkompression, nicht Objektstromkompression. |
| `xml-bomb.pdf` | Vollständiges CII-XML mit hochkomprimierbarer langer Notiz: dekomprimiert mehr als 2 MiB, die gesamte PDF höchstens 20 KiB. Keine rekursiven Entities. |
| `next-action.pdf` | Normale URI-Klickaktion mit indirekter `/Next`-Launch-Aktion. |
| `automatic-action.pdf` | Katalog-`/OpenAction` mit URI: normale URI wird automatisch aktiv und muss deshalb blockiert werden. |
| `embedded-executable-only.pdf` | Ausschließlich `demo.exe`; Inhalt ist ein nicht ausführbarer ASCII-Marker mit `MZ`-Präfix, kein echtes Programm. |
| `duplicate-action.pdf` | Linkaktion als exaktes Rohwörterbuch mit `/S /URI`, normaler `/URI` und zweitem `/S /Launch /F (fixture-placeholder-not-present.exe)`. Der xref ist korrekt; der doppelte Schlüssel ist absichtlich ungültig. Recovery kann nur den ersten `/S` behalten: Parser-Warnungen müssen fail-closed abweisen. |
| `partial-action.pdf` | Linkaktion mit gültigem `/S /URI`-Präfix, anschließend `/Invalid @` und `/S /Launch /F (fixture-placeholder-not-present.exe)`. Der xref ist korrekt; `@` ist ein absichtlich ungültiges PDF-Element. Auch ein vom Parser zurückgegebenes Teilwörterbuch darf nicht freigegeben werden. |
| `cii-binary-attachment.pdf` | Wohlgeformtes CII mit gültigem Profil und `ram:AdditionalReferencedDocument/ram:AttachmentBinaryObject`, MIME `application/octet-stream`, fiktivem `.exe`-Dateinamen und harmlosem Base64-ASCII-Marker. Nur ein PDF-XML-Anhang; binäre Inhalte innerhalb des XML müssen trotzdem abgewiesen werden. |
| `object-stream-javascript.pdf` | Echte PDF 1.5 mit Flate-komprimiertem `/ObjStm` (Objekt 9) und xref-Stream (Objekt 11). Die Linkannotation verweist über `/A 10 0 R` auf die komprimierte JavaScript-Aktion; xref-Eintrag 10 hat Typ 2, Container 9 und Index 0. Kein bloßer `/JS`-Stream. |
| `xml-stylesheet.pdf` | Gültiges CII mit `xml-stylesheet`-Verarbeitungsanweisung und `.invalid`-URL; keine Stylesheet-Auflösung. |
| `xfa.pdf` | Katalog-`/AcroForm` mit `/XFA`-Stream und reinem DEMO-XML ohne Skript. |
| `aa.pdf` | Seiten-`/AA` mit Öffnungsereignis `/O` und URI-Aktion auf `.invalid`. |
| `rich-media.pdf` | Annotation mit `/Subtype /RichMedia` und leeren `/RichMediaContent`-/`RichMediaSettings`-Wörterbüchern, ohne Medien oder ausführbaren Inhalt. |

Die Sollwerte beziehen sich auf die geplante Schutzpolicy: maximal ein
XML-Anhang und 2 MiB **dekomprimierter** XML-Inhalt, maximal 20.000 XML-Knoten
und Tiefe 64; keine DOCTYPE/ENTITY, XInclude oder XML-Stylesheets. JavaScript,
Launch, RichMedia, XFA, OpenAction, AA sowie unbekannte aktive Aktionen bleiben
blockiert. Diese kleine Sammlung deckt die oben aufgeführten Fälle ab; eigene
Grenzfälle für Knotenanzahl/Tiefe und weitere unbekannte Aktionen sind hier
nicht enthalten. Es sind genau 18 ursprüngliche und 10 Review-Fixtures.
Der Generator implementiert keinen
Policy-Inspector und verändert keine Anwendungstests.

Sicherheits-Fixtures nur mit PDF-Parsern prüfen: nicht in einem interaktiven
PDF-Viewer öffnen. Keine Veröffentlichung oder Übertragung ist vorgesehen.
