#!/usr/bin/env python3
"""Create small, synthetic PDF-policy fixtures; never read invoices or uploads.

Run from any directory with Python 3 and pypdf installed:
    python3 scripts/create-pdf-policy-test-fixtures.py

The output directory is fixed relative to this script. The printed JSON is also
saved as manifest.json. Structural checks and a second, byte-identical build run
before any files are written. No application code, database or API is used.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
from pathlib import Path
import xml.etree.ElementTree as ET
import zlib

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    ByteStringObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    IndirectObject,
    NameObject,
    NumberObject,
    StreamObject,
    TextStringObject,
)

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "server/test-fixtures/pdf-policy"
MAX_XML_BYTES = 2 * 1024 * 1024
CII_NS = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
UBL_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
CBC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
RAM_NS = "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
PROFILE = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"
BUSINESS_PROCESS = "urn:fdc:peppol.eu:2017:poacc:billing:01:1"
XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n'
JAVASCRIPT = 'app.alert("DEMO fixture only");'
URI = "https://example.invalid/pdf-policy-demo"
PASSWORD = "fixture-only"
BINARY_FILENAME = "fixture-placeholder-not-present.exe"
BINARY_MARKER = b"FICTIONAL BINARY ATTACHMENT - NOT EXECUTABLE.\n"
RAW_REVIEW_ACTIONS = {
    "duplicate-action.pdf": (
        f"<< /S /URI /URI ({URI}) /S /Launch /F ({BINARY_FILENAME}) >>"
    ).encode("ascii"),
    "partial-action.pdf": (
        f"<< /S /URI /URI ({URI}) /Invalid @ /S /Launch /F ({BINARY_FILENAME}) >>"
    ).encode("ascii"),
}

# Complete, well-formed synthetic invoice documents. No real parties, account
# numbers, tax identifiers, source invoice or customer data are used. The
# fixture checks namespaces/profiles; it does not claim formal XRechnung
# Schematron validation or PDF/A certification.
CII_XML = (XML_DECLARATION + f'''<rsm:CrossIndustryInvoice
 xmlns:rsm="{CII_NS}"
 xmlns:ram="{RAM_NS}"
 xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
 <rsm:ExchangedDocumentContext>
  <ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>{BUSINESS_PROCESS}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>
  <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>{PROFILE}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
 </rsm:ExchangedDocumentContext>
 <rsm:ExchangedDocument>
  <ram:ID>DEMO-001</ram:ID>
  <ram:TypeCode>380</ram:TypeCode>
  <ram:IssueDateTime><udt:DateTimeString format="102">20260101</udt:DateTimeString></ram:IssueDateTime>
  <ram:IncludedNote><ram:Content>FICTIONAL TEST INVOICE - NOT PAYABLE</ram:Content></ram:IncludedNote>
 </rsm:ExchangedDocument>
 <rsm:SupplyChainTradeTransaction>
  <ram:IncludedSupplyChainTradeLineItem>
   <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
   <ram:SpecifiedTradeProduct><ram:Name>Fictional fixture service</ram:Name></ram:SpecifiedTradeProduct>
   <ram:SpecifiedLineTradeAgreement>
    <ram:NetPriceProductTradePrice><ram:ChargeAmount>10.00</ram:ChargeAmount></ram:NetPriceProductTradePrice>
   </ram:SpecifiedLineTradeAgreement>
   <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
   <ram:SpecifiedLineTradeSettlement>
    <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
    <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>10.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
   </ram:SpecifiedLineTradeSettlement>
  </ram:IncludedSupplyChainTradeLineItem>
  <ram:ApplicableHeaderTradeAgreement>
   <ram:BuyerReference>DEMO-BUYER-REFERENCE</ram:BuyerReference>
   <ram:SellerTradeParty>
    <ram:Name>Fictional Fixture Seller</ram:Name>
    <ram:DefinedTradeContact><ram:PersonName>Fictional Test Contact</ram:PersonName><ram:TelephoneUniversalCommunication><ram:CompleteNumber>+49 000 000000</ram:CompleteNumber></ram:TelephoneUniversalCommunication><ram:EmailURIUniversalCommunication><ram:URIID>seller@example.invalid</ram:URIID></ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>
    <ram:PostalTradeAddress><ram:PostcodeCode>00000</ram:PostcodeCode><ram:LineOne>Fictional Test Street 1</ram:LineOne><ram:CityName>Demo City</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
    <ram:URIUniversalCommunication><ram:URIID schemeID="EM">seller@example.invalid</ram:URIID></ram:URIUniversalCommunication>
    <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">DEMO-TAX-NOT-REAL</ram:ID></ram:SpecifiedTaxRegistration>
   </ram:SellerTradeParty>
   <ram:BuyerTradeParty>
    <ram:Name>Fictional Fixture Buyer</ram:Name>
    <ram:PostalTradeAddress><ram:PostcodeCode>00000</ram:PostcodeCode><ram:LineOne>Fictional Test Street 2</ram:LineOne><ram:CityName>Demo City</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
    <ram:URIUniversalCommunication><ram:URIID schemeID="EM">buyer@example.invalid</ram:URIID></ram:URIUniversalCommunication>
   </ram:BuyerTradeParty>
  </ram:ApplicableHeaderTradeAgreement>
  <ram:ApplicableHeaderTradeDelivery>
   <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">20260101</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
  </ram:ApplicableHeaderTradeDelivery>
  <ram:ApplicableHeaderTradeSettlement>
   <ram:PaymentReference>DEMO-001</ram:PaymentReference>
   <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
   <ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>1</ram:TypeCode><ram:Information>Fictional invoice; do not pay</ram:Information></ram:SpecifiedTradeSettlementPaymentMeans>
   <ram:ApplicableTradeTax><ram:CalculatedAmount>1.90</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>10.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
   <ram:SpecifiedTradePaymentTerms><ram:Description>Fictional fixture, not payable</ram:Description><ram:DueDateDateTime><udt:DateTimeString format="102">20260131</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
   <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    <ram:LineTotalAmount>10.00</ram:LineTotalAmount>
    <ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>
    <ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>
    <ram:TaxBasisTotalAmount>10.00</ram:TaxBasisTotalAmount>
    <ram:TaxTotalAmount currencyID="EUR">1.90</ram:TaxTotalAmount>
    <ram:GrandTotalAmount>11.90</ram:GrandTotalAmount>
    <ram:TotalPrepaidAmount>0.00</ram:TotalPrepaidAmount>
    <ram:DuePayableAmount>11.90</ram:DuePayableAmount>
   </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
  </ram:ApplicableHeaderTradeSettlement>
 </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
''').encode("utf-8")

UBL_XML = (XML_DECLARATION + f'''<Invoice xmlns="{UBL_NS}"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="{CBC_NS}">
 <cbc:CustomizationID>{PROFILE}</cbc:CustomizationID>
 <cbc:ProfileID>{BUSINESS_PROCESS}</cbc:ProfileID>
 <cbc:ID>DEMO-001</cbc:ID>
 <cbc:IssueDate>2026-01-01</cbc:IssueDate>
 <cbc:DueDate>2026-01-31</cbc:DueDate>
 <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
 <cbc:Note>FICTIONAL TEST INVOICE - NOT PAYABLE</cbc:Note>
 <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
 <cbc:BuyerReference>DEMO-BUYER-REFERENCE</cbc:BuyerReference>
 <cac:AccountingSupplierParty><cac:Party>
  <cbc:EndpointID schemeID="EM">seller@example.invalid</cbc:EndpointID>
  <cac:PartyName><cbc:Name>Fictional Fixture Seller</cbc:Name></cac:PartyName>
  <cac:PostalAddress><cbc:StreetName>Fictional Test Street 1</cbc:StreetName><cbc:CityName>Demo City</cbc:CityName><cbc:PostalZone>00000</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
  <cac:PartyTaxScheme><cbc:CompanyID>DEMO-TAX-NOT-REAL</cbc:CompanyID><cac:TaxScheme><cbc:ID>TAX</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
  <cac:PartyLegalEntity><cbc:RegistrationName>Fictional Fixture Seller</cbc:RegistrationName></cac:PartyLegalEntity>
  <cac:Contact><cbc:Name>Fictional Test Contact</cbc:Name><cbc:Telephone>+49 000 000000</cbc:Telephone><cbc:ElectronicMail>seller@example.invalid</cbc:ElectronicMail></cac:Contact>
 </cac:Party></cac:AccountingSupplierParty>
 <cac:AccountingCustomerParty><cac:Party>
  <cbc:EndpointID schemeID="EM">buyer@example.invalid</cbc:EndpointID>
  <cac:PartyName><cbc:Name>Fictional Fixture Buyer</cbc:Name></cac:PartyName>
  <cac:PostalAddress><cbc:StreetName>Fictional Test Street 2</cbc:StreetName><cbc:CityName>Demo City</cbc:CityName><cbc:PostalZone>00000</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
  <cac:PartyLegalEntity><cbc:RegistrationName>Fictional Fixture Buyer</cbc:RegistrationName></cac:PartyLegalEntity>
 </cac:Party></cac:AccountingCustomerParty>
 <cac:Delivery><cbc:ActualDeliveryDate>2026-01-01</cbc:ActualDeliveryDate></cac:Delivery>
 <cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode><cbc:PaymentID>DEMO-001</cbc:PaymentID></cac:PaymentMeans>
 <cac:PaymentTerms><cbc:Note>Fictional fixture, not payable</cbc:Note></cac:PaymentTerms>
 <cac:TaxTotal>
  <cbc:TaxAmount currencyID="EUR">1.90</cbc:TaxAmount>
  <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">10.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">1.90</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
 </cac:TaxTotal>
 <cac:LegalMonetaryTotal>
  <cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount>
  <cbc:TaxExclusiveAmount currencyID="EUR">10.00</cbc:TaxExclusiveAmount>
  <cbc:TaxInclusiveAmount currencyID="EUR">11.90</cbc:TaxInclusiveAmount>
  <cbc:AllowanceTotalAmount currencyID="EUR">0.00</cbc:AllowanceTotalAmount>
  <cbc:ChargeTotalAmount currencyID="EUR">0.00</cbc:ChargeTotalAmount>
  <cbc:PrepaidAmount currencyID="EUR">0.00</cbc:PrepaidAmount>
  <cbc:PayableAmount currencyID="EUR">11.90</cbc:PayableAmount>
 </cac:LegalMonetaryTotal>
 <cac:InvoiceLine>
  <cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount>
  <cac:Item><cbc:Name>Fictional fixture service</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
  <cac:Price><cbc:PriceAmount currencyID="EUR">10.00</cbc:PriceAmount></cac:Price>
 </cac:InvoiceLine>
</Invoice>
''').encode("utf-8")

CASES = (
    ("plain.pdf", "allow"),
    ("xrechnung-cii.pdf", "allow"),
    ("ubl-invoice.pdf", "allow"),
    ("link.pdf", "allow"),
    ("dangerous-javascript.pdf", "deny"),
    ("escaped-javascript.pdf", "deny"),
    ("launch.pdf", "deny"),
    ("extra-attachment.pdf", "deny"),
    ("invalid-xml.pdf", "deny"),
    ("wrong-profile.pdf", "deny"),
    ("dtd-xml.pdf", "deny"),
    ("xinclude-xml.pdf", "deny"),
    ("encrypted.pdf", "deny"),
    ("compressed-javascript.pdf", "deny"),
    ("xml-bomb.pdf", "deny"),
    ("next-action.pdf", "deny"),
    ("automatic-action.pdf", "deny"),
    ("embedded-executable-only.pdf", "deny"),
    ("duplicate-action.pdf", "deny"),
    ("partial-action.pdf", "deny"),
    ("cii-binary-attachment.pdf", "deny"),
    ("type3-glyph-a.pdf", "allow"),
    ("type3-glyph-b.pdf", "allow"),
    ("object-stream-javascript.pdf", "deny"),
    ("xml-stylesheet.pdf", "deny"),
    ("xfa.pdf", "deny"),
    ("aa.pdf", "deny"),
    ("rich-media.pdf", "deny"),
)

README = """# PDF-Policy-Testfixtures

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
"""


class ParserDiagnostics(logging.Handler):
    """Count recovery warnings without retaining or emitting PDF contents."""

    def __init__(self) -> None:
        super().__init__(logging.WARNING)
        self.count = 0

    def emit(self, record: logging.LogRecord) -> None:
        self.count += 1


PARSER_DIAGNOSTICS = ParserDiagnostics()


class RawReviewAction(DictionaryObject):
    """Serialize intentional duplicate/invalid syntax before xref is written."""

    def __init__(self, payload: bytes) -> None:
        super().__init__({
            NameObject("/S"): NameObject("/URI"),
            NameObject("/URI"): TextStringObject(URI),
        })
        self.payload = payload

    def write_to_stream(self, stream: io.BytesIO, encryption_key=None) -> None:
        if encryption_key is not None:
            raise ValueError("Raw review actions must not be encrypted")
        stream.write(self.payload)


class EscapedJavaScriptName(NameObject):
    """Emit a valid escaped PDF name without breaking cross-reference offsets."""

    def __new__(cls) -> "EscapedJavaScriptName":
        return super().__new__(cls, "/JavaScript")

    def write_to_stream(self, stream: io.BytesIO, encryption_key=None) -> None:
        if encryption_key is not None:
            raise ValueError("Escaped name fixture must not be encrypted")
        stream.write(b"/Java#53cript")


def base_writer(filename: str) -> PdfWriter:
    writer = PdfWriter()
    writer.add_metadata({"/Producer": "Synthetic PDF policy fixture generator"})
    identifier = hashlib.sha256(filename.encode("ascii")).digest()[:16]
    writer._ID = ArrayObject([ByteStringObject(identifier), ByteStringObject(identifier)])
    page = writer.add_blank_page(width=320, height=120)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})
    })
    content = DecodedStreamObject()
    content.set_data((
        "BT /F1 11 Tf 20 85 Td (DEMO ONLY - fictional PDF fixture) Tj "
        f"0 -20 Td ({filename}) Tj ET\n"
    ).encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(content.flate_encode())
    return writer


def attach(writer: PdfWriter, filename: str, payload: bytes) -> None:
    attachment = writer.add_attachment(filename, payload)
    attachment.subtype = NameObject("/application/xml" if filename.endswith(".xml") else "/application/octet-stream")
    attachment.size = NumberObject(len(payload))
    attachment.associated_file_relationship = NameObject("/Data")
    ef = attachment.pdf_object["/EF"]
    stream = ef["/F"]
    ef[NameObject("/F")] = writer._add_object(stream.flate_encode())
    # Keep the associated-files array consistent with the embedded-files tree.
    if "/AF" not in writer.root_object:
        writer.root_object[NameObject("/AF")] = ArrayObject()
    writer.root_object["/AF"].append(attachment.pdf_object.indirect_reference)


def action(kind: str, value: str) -> DictionaryObject:
    payload_key = "/F" if kind == "/Launch" else "/URI"
    return DictionaryObject({
        NameObject("/Type"): NameObject("/Action"),
        NameObject("/S"): NameObject(kind),
        NameObject(payload_key): TextStringObject(value),
    })


def add_click_action(writer: PdfWriter, value: DictionaryObject) -> None:
    annotation = DictionaryObject({
        NameObject("/Type"): NameObject("/Annot"),
        NameObject("/Subtype"): NameObject("/Link"),
        NameObject("/Rect"): ArrayObject([NumberObject(n) for n in (20, 20, 300, 70)]),
        NameObject("/Border"): ArrayObject([NumberObject(0)] * 3),
        NameObject("/A"): writer._add_object(value),
    })
    writer.pages[0][NameObject("/Annots")] = ArrayObject([writer._add_object(annotation)])


def add_type3_glyph(writer: PdfWriter, glyph: str) -> None:
    """Use a real Type3 font: every CharProcs value is a pure glyph stream."""
    page = writer.pages[0]
    glyph_stream = DecodedStreamObject()
    outline = (
        b"50 0 m 300 700 l 550 0 l 450 0 l 380 220 l 220 220 l 150 0 l h f\n"
        if glyph == "A" else
        b"80 0 100 700 re f 180 360 300 340 re f 180 0 300 310 re f\n"
    )
    glyph_data = b"600 0 0 0 600 700 d1\n" + outline
    glyph_stream.set_data(glyph_data)
    char_procs = DictionaryObject({
        NameObject("/" + glyph): writer._add_object(glyph_stream.flate_encode()),
    })
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type3"),
        NameObject("/FontBBox"): ArrayObject([NumberObject(n) for n in (0, 0, 600, 700)]),
        NameObject("/FontMatrix"): ArrayObject([FloatObject(n) for n in (0.001, 0, 0, 0.001, 0, 0)]),
        NameObject("/CharProcs"): writer._add_object(char_procs),
        NameObject("/Encoding"): DictionaryObject({
            NameObject("/Type"): NameObject("/Encoding"),
            NameObject("/Differences"): ArrayObject([NumberObject(ord(glyph)), NameObject("/" + glyph)]),
        }),
        NameObject("/FirstChar"): NumberObject(ord(glyph)),
        NameObject("/LastChar"): NumberObject(ord(glyph)),
        NameObject("/Widths"): ArrayObject([NumberObject(600)]),
        NameObject("/Resources"): DictionaryObject(),
    })
    page["/Resources"]["/Font"][NameObject("/FType3")] = writer._add_object(font)
    content = DecodedStreamObject()
    content.set_data(page["/Contents"].get_data() + f"BT /FType3 16 Tf 20 25 Td ({glyph}) Tj ET\n".encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(content.flate_encode())


def serialize_object(value) -> bytes:
    output = io.BytesIO()
    value.write_to_stream(output)
    return output.getvalue()


def build_object_stream_pdf(filename: str) -> bytes:
    """Small PDF 1.5 with compressed object 10 and an actual xref stream.

    pypdf's writer does not produce ObjStm members, so serialize this one fixture
    explicitly. Every stream length and offset is calculated before emission;
    no replacement of already-written PDF bytes is used.
    """
    def flate_stream(payload: bytes, extra: bytes = b"") -> bytes:
        compressed = zlib.compress(payload)
        return (b"<< /Length " + str(len(compressed)).encode("ascii") +
                b" /Filter /FlateDecode " + extra + b">>\nstream\n" +
                compressed + b"\nendstream")

    js_action = DictionaryObject({
        NameObject("/Type"): NameObject("/Action"),
        NameObject("/S"): NameObject("/JavaScript"),
        NameObject("/JS"): TextStringObject(JAVASCRIPT),
    })
    member_header = b"10 0 "
    content = ("BT /F1 11 Tf 20 85 Td (DEMO ONLY - fictional PDF fixture) Tj "
               f"0 -20 Td ({filename}) Tj ET\n").encode("ascii")
    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
        3: b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 120] /Resources 8 0 R /Contents 5 0 R /Annots [6 0 R] >>",
        4: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        5: flate_stream(content),
        6: b"<< /Type /Annot /Subtype /Link /Rect [20 20 300 70] /Border [0 0 0] /A 10 0 R >>",
        7: b"<< /Producer (Synthetic PDF policy fixture generator) >>",
        8: b"<< /Font << /F1 4 0 R >> >>",
        9: flate_stream(member_header + serialize_object(js_action),
                        b"/Type /ObjStm /N 1 /First " + str(len(member_header)).encode("ascii") + b" "),
    }
    output = io.BytesIO()
    output.write(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    offsets = {}
    for oid, payload in objects.items():
        offsets[oid] = output.tell()
        output.write(f"{oid} 0 obj\n".encode("ascii") + payload + b"\nendobj\n")
    offsets[11] = output.tell()
    entries = []
    for oid in range(12):
        kind, field1, field2 = (0, 0, 65535) if oid == 0 else ((2, 9, 0) if oid == 10 else (1, offsets[oid], 0))
        entries.append(bytes([kind]) + field1.to_bytes(4, "big") + field2.to_bytes(2, "big"))
    identifier = hashlib.sha256(filename.encode("ascii")).digest()[:16].hex().encode("ascii")
    xref = flate_stream(b"".join(entries),
                        b"/Type /XRef /Size 12 /Root 1 0 R /Info 7 0 R /W [1 4 2] /Index [0 12] /ID [<" +
                        identifier + b"><" + identifier + b">] ")
    output.write(b"11 0 obj\n" + xref + b"\nendobj\nstartxref\n" +
                 str(offsets[11]).encode("ascii") + b"\n%%EOF\n")
    return output.getvalue()


def build_pdf(filename: str) -> bytes:
    if filename == "object-stream-javascript.pdf":
        return build_object_stream_pdf(filename)
    writer = base_writer(filename)
    if filename in {"xrechnung-cii.pdf", "extra-attachment.pdf"}:
        attach(writer, "xrechnung.xml", CII_XML)
        if filename == "extra-attachment.pdf":
            attach(writer, "demo.txt", b"FICTIONAL SECOND ATTACHMENT - TEST ONLY\n")
    elif filename == "ubl-invoice.pdf":
        attach(writer, "xrechnung.xml", UBL_XML)
    elif filename == "invalid-xml.pdf":
        attach(writer, "xrechnung.xml", b"This is deliberately not XML. DEMO ONLY.\n")
    elif filename == "wrong-profile.pdf":
        attach(writer, "xrechnung.xml", CII_XML.replace(PROFILE.encode(), b"urn:example:invalid-profile"))
    elif filename == "dtd-xml.pdf":
        dtd = b'<!DOCTYPE rsm:CrossIndustryInvoice [<!ENTITY demo "FICTIONAL DTD MARKER">]>\n'
        xml = CII_XML.replace(XML_DECLARATION.encode(), XML_DECLARATION.encode() + dtd)
        attach(writer, "xrechnung.xml", xml.replace(b"FICTIONAL TEST INVOICE - NOT PAYABLE", b"&demo;"))
    elif filename == "xinclude-xml.pdf":
        include = b'<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="https://example.invalid/fixture-only.xml"/>\n'
        attach(writer, "xrechnung.xml", CII_XML.replace(b"</rsm:CrossIndustryInvoice>", include + b"</rsm:CrossIndustryInvoice>"))
    elif filename == "cii-binary-attachment.pdf":
        document = (
            '<ram:AdditionalReferencedDocument><ram:IssuerAssignedID>FIXTURE-BINARY</ram:IssuerAssignedID>'
            '<ram:TypeCode>916</ram:TypeCode><ram:Name>FICTIONAL BINARY FIXTURE</ram:Name>'
            f'<ram:AttachmentBinaryObject mimeCode="application/octet-stream" filename="{BINARY_FILENAME}">'
        ).encode("ascii") + base64.b64encode(BINARY_MARKER) + b"</ram:AttachmentBinaryObject></ram:AdditionalReferencedDocument>\n"
        attach(writer, "xrechnung.xml", CII_XML.replace(b"</ram:ApplicableHeaderTradeAgreement>", document + b"</ram:ApplicableHeaderTradeAgreement>"))
    elif filename == "xml-stylesheet.pdf":
        stylesheet = b'<?xml-stylesheet type="text/xsl" href="https://example.invalid/fixture-only.xsl"?>\n'
        attach(writer, "xrechnung.xml", CII_XML.replace(XML_DECLARATION.encode(), XML_DECLARATION.encode() + stylesheet))
    elif filename == "xml-bomb.pdf":
        xml = CII_XML.replace(b"FICTIONAL TEST INVOICE - NOT PAYABLE", b"X" * (MAX_XML_BYTES + 1))
        attach(writer, "xrechnung.xml", xml)
    elif filename == "embedded-executable-only.pdf":
        attach(writer, "demo.exe", b"MZ\nNOT AN EXECUTABLE. FICTIONAL PDF POLICY FIXTURE ONLY.\n")
    elif filename in {"dangerous-javascript.pdf", "escaped-javascript.pdf", "compressed-javascript.pdf"}:
        js_action = DictionaryObject({
            NameObject("/Type"): NameObject("/Action"),
            NameObject("/S"): EscapedJavaScriptName() if filename == "escaped-javascript.pdf" else NameObject("/JavaScript"),
            NameObject("/JS"): TextStringObject(JAVASCRIPT),
        })
        if filename == "compressed-javascript.pdf":
            js_stream = DecodedStreamObject()
            js_stream.set_data(JAVASCRIPT.encode("ascii"))
            js_action[NameObject("/JS")] = writer._add_object(js_stream.flate_encode())
        add_click_action(writer, js_action)
    elif filename == "launch.pdf":
        add_click_action(writer, action("/Launch", "fixture-placeholder-not-present.exe"))
    elif filename in {"link.pdf", "next-action.pdf"}:
        uri_action = action("/URI", URI)
        if filename == "next-action.pdf":
            uri_action[NameObject("/Next")] = writer._add_object(action("/Launch", "fixture-placeholder-not-present.exe"))
        add_click_action(writer, uri_action)
    elif filename == "automatic-action.pdf":
        writer.root_object[NameObject("/OpenAction")] = writer._add_object(action("/URI", URI))
    elif filename in RAW_REVIEW_ACTIONS:
        add_click_action(writer, RawReviewAction(RAW_REVIEW_ACTIONS[filename]))
    elif filename in {"type3-glyph-a.pdf", "type3-glyph-b.pdf"}:
        add_type3_glyph(writer, "A" if filename == "type3-glyph-a.pdf" else "B")
    elif filename == "xfa.pdf":
        xfa = DecodedStreamObject()
        xfa.set_data(b'<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"><demo>FICTIONAL XFA FIXTURE ONLY</demo></xdp:xdp>\n')
        form = DictionaryObject({
            NameObject("/Fields"): ArrayObject(),
            NameObject("/XFA"): writer._add_object(xfa.flate_encode()),
        })
        writer.root_object[NameObject("/AcroForm")] = writer._add_object(form)
    elif filename == "aa.pdf":
        writer.pages[0][NameObject("/AA")] = DictionaryObject({
            NameObject("/O"): writer._add_object(action("/URI", URI)),
        })
    elif filename == "rich-media.pdf":
        annotation = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/RichMedia"),
            NameObject("/Rect"): ArrayObject([NumberObject(n) for n in (20, 20, 300, 70)]),
            NameObject("/RichMediaContent"): DictionaryObject(),
            NameObject("/RichMediaSettings"): DictionaryObject(),
        })
        writer.pages[0][NameObject("/Annots")] = ArrayObject([writer._add_object(annotation)])
    elif filename == "encrypted.pdf":
        pass  # Encrypt only after orphan removal, preserving the trailer entry.
    elif filename != "plain.pdf":
        raise ValueError(f"Unknown fixture: {filename}")

    # The installed pypdf version supports this helper. It removes the original
    # uncompressed attachment stream after replacement and deduplicates objects;
    # this helper does NOT create compressed /ObjStm objects.
    writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    if filename == "encrypted.pdf":
        # RC4 has no per-stream random IV. The fixed document identifier and
        # passwords make this detection-only encryption fixture reproducible.
        writer.encrypt(PASSWORD, owner_password="fixture-owner-only", algorithm="RC4-128")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def walk_pdf(value, seen: set[tuple[int, int]]) -> None:
    """Force parsing of every reachable object without executing PDF actions."""
    if isinstance(value, IndirectObject):
        key = (value.idnum, value.generation)
        if key in seen:
            return
        seen.add(key)
        walk_pdf(value.get_object(), seen)
    elif isinstance(value, DictionaryObject):
        for child in value.values():
            walk_pdf(child, seen)
    elif isinstance(value, ArrayObject):
        for child in value:
            walk_pdf(child, seen)


def xml_depth(root: ET.Element) -> int:
    return 1 + max((xml_depth(child) for child in root), default=0)


def validate_pdf(filename: str, data: bytes) -> None:
    require(data.startswith(b"%PDF-"), f"{filename}: missing PDF header")
    require(len(data) <= 20 * 1024, f"{filename}: fixture exceeds 20 KiB")
    intentional_recovery = filename in RAW_REVIEW_ACTIONS
    warnings_before = PARSER_DIAGNOSTICS.count
    reader = PdfReader(io.BytesIO(data), strict=not intentional_recovery)
    if filename == "encrypted.pdf":
        require(reader.is_encrypted, "encrypted.pdf: missing encryption")
        require(bool(reader.decrypt(PASSWORD)), "encrypted.pdf: cannot decrypt test password")
    else:
        require(not reader.is_encrypted, f"{filename}: unexpected encryption")
    require(len(reader.pages) == 1, f"{filename}: expected one page")
    require("DEMO ONLY" in reader.pages[0].extract_text(), f"{filename}: missing visible DEMO marker")
    if not intentional_recovery:
        seen = set()
        walk_pdf(reader.trailer.raw_get("/Root"), seen)
        for generation, entries in reader.xref.items():
            if generation != 65535:
                for oid in entries:
                    if oid != 0:
                        walk_pdf(IndirectObject(oid, generation, reader), seen)
        for oid in reader.xref_objStm:
            walk_pdf(IndirectObject(oid, 0, reader), seen)
    root = reader.root_object
    attachments = dict(reader.attachments)
    expected_attachments = {
        "xrechnung-cii.pdf": {"xrechnung.xml"},
        "ubl-invoice.pdf": {"xrechnung.xml"},
        "extra-attachment.pdf": {"xrechnung.xml", "demo.txt"},
        "invalid-xml.pdf": {"xrechnung.xml"},
        "wrong-profile.pdf": {"xrechnung.xml"},
        "dtd-xml.pdf": {"xrechnung.xml"},
        "xinclude-xml.pdf": {"xrechnung.xml"},
        "xml-bomb.pdf": {"xrechnung.xml"},
        "embedded-executable-only.pdf": {"demo.exe"},
        "cii-binary-attachment.pdf": {"xrechnung.xml"},
        "xml-stylesheet.pdf": {"xrechnung.xml"},
    }.get(filename, set())
    require(set(attachments) == expected_attachments, f"{filename}: unexpected attachments")
    for payloads in attachments.values():
        require(len(payloads) == 1, f"{filename}: duplicate attachment name")

    if filename in {"xrechnung-cii.pdf", "ubl-invoice.pdf", "cii-binary-attachment.pdf", "xml-stylesheet.pdf"}:
        xml = attachments["xrechnung.xml"][0]
        tree = ET.fromstring(xml)
        is_ubl = filename == "ubl-invoice.pdf"
        expected_root = f"{{{UBL_NS}}}Invoice" if is_ubl else f"{{{CII_NS}}}CrossIndustryInvoice"
        require(tree.tag == expected_root, f"{filename}: wrong root namespace")
        profile_path = f"{{{CBC_NS}}}CustomizationID" if is_ubl else f".//{{{RAM_NS}}}GuidelineSpecifiedDocumentContextParameter/{{{RAM_NS}}}ID"
        require(tree.findtext(profile_path) == PROFILE, f"{filename}: wrong profile")
        id_path = f"{{{CBC_NS}}}ID" if is_ubl else f"{{{CII_NS}}}ExchangedDocument/{{{RAM_NS}}}ID"
        require(tree.findtext(id_path) == "DEMO-001", f"{filename}: wrong invoice ID")
        if is_ubl:
            require(tree.findtext(f"{{{CBC_NS}}}ProfileID") == BUSINESS_PROCESS, "ubl-invoice.pdf: wrong process")
        require(len(xml) <= MAX_XML_BYTES and len(list(tree.iter())) <= 20_000 and xml_depth(tree) <= 64, f"{filename}: XML exceeds policy limits")
        require(b"<!DOCTYPE" not in xml and b"<!ENTITY" not in xml and b"http://www.w3.org/2001/XInclude" not in xml, f"{filename}: forbidden XML construct")
        if filename == "xml-stylesheet.pdf":
            require(b'<?xml-stylesheet type="text/xsl" href="https://example.invalid/fixture-only.xsl"?>' in xml, "xml-stylesheet.pdf: missing PI")
        else:
            require(b"xml-stylesheet" not in xml, f"{filename}: unexpected stylesheet")
        if filename == "cii-binary-attachment.pdf":
            binary = tree.find(f".//{{{RAM_NS}}}ApplicableHeaderTradeAgreement/{{{RAM_NS}}}AdditionalReferencedDocument/{{{RAM_NS}}}AttachmentBinaryObject")
            require(binary is not None, "cii-binary-attachment.pdf: missing binary element")
            require(binary.get("mimeCode") == "application/octet-stream" and binary.get("filename") == BINARY_FILENAME, "cii-binary-attachment.pdf: wrong binary attributes")
            require(base64.b64decode(binary.text, validate=True) == BINARY_MARKER, "cii-binary-attachment.pdf: wrong harmless marker")
    elif filename == "invalid-xml.pdf":
        try:
            ET.fromstring(attachments["xrechnung.xml"][0])
        except ET.ParseError:
            pass
        else:
            raise ValueError("invalid-xml.pdf: attachment unexpectedly parses as XML")
    elif filename == "wrong-profile.pdf":
        tree = ET.fromstring(attachments["xrechnung.xml"][0])
        require(tree.findtext(f".//{{{RAM_NS}}}GuidelineSpecifiedDocumentContextParameter/{{{RAM_NS}}}ID") != PROFILE, "wrong-profile.pdf: profile is valid")
    elif filename == "dtd-xml.pdf":
        xml = attachments["xrechnung.xml"][0]
        require(b"<!DOCTYPE" in xml and b"<!ENTITY" in xml, "dtd-xml.pdf: missing DTD/entity")
        ET.fromstring(xml)  # Only a single fixed literal entity; no resources.
    elif filename == "xinclude-xml.pdf":
        tree = ET.fromstring(attachments["xrechnung.xml"][0])
        require(tree.find("{http://www.w3.org/2001/XInclude}include") is not None, "xinclude-xml.pdf: missing include")
    elif filename == "xml-bomb.pdf":
        xml = attachments["xrechnung.xml"][0]
        require(len(xml) > MAX_XML_BYTES, "xml-bomb.pdf: payload too small")
        require(ET.fromstring(xml).tag == f"{{{CII_NS}}}CrossIndustryInvoice", "xml-bomb.pdf: invalid XML")

    if filename in RAW_REVIEW_ACTIONS:
        annotation = reader.pages[0]["/Annots"][0].get_object()
        require(annotation["/Subtype"] == "/Link", f"{filename}: missing link annotation")
        action_ref = annotation.raw_get("/A")
        require(isinstance(action_ref, IndirectObject), f"{filename}: action is not indirect")
        offset = reader.xref[action_ref.generation][action_ref.idnum]
        serialized = f"{action_ref.idnum} {action_ref.generation} obj\n".encode("ascii") + RAW_REVIEW_ACTIONS[filename] + b"\nendobj"
        require(data.startswith(serialized, offset), f"{filename}: incorrect raw action/xref offset")
        require(data.count(RAW_REVIEW_ACTIONS[filename]) == 1, f"{filename}: unexpected raw action count")
        # pypdf recovers the harmless prefix; that is the regression under test.
        click = annotation["/A"]
        require(click["/S"] == "/URI" and click["/URI"] == URI, f"{filename}: missing recovered URI prefix")
        if filename == "duplicate-action.pdf":
            require(click["/F"] == BINARY_FILENAME, "duplicate-action.pdf: missing trailing Launch filename")
        else:
            require("/Invalid" not in click and "/F" not in click, "partial-action.pdf: expected partial dictionary")
    elif filename == "rich-media.pdf":
        annotation = reader.pages[0]["/Annots"][0].get_object()
        require(annotation["/Subtype"] == "/RichMedia", "rich-media.pdf: wrong subtype")
        require(isinstance(annotation["/RichMediaContent"], DictionaryObject) and isinstance(annotation["/RichMediaSettings"], DictionaryObject), "rich-media.pdf: missing dictionaries")
    elif "/Annots" in reader.pages[0]:
        click = reader.pages[0]["/Annots"][0].get_object()["/A"]
        if "javascript" in filename:
            require(click["/S"] == "/JavaScript", f"{filename}: JavaScript action not parsed")
            if filename == "escaped-javascript.pdf":
                require(b"/Java#53cript" in data, "escaped-javascript.pdf: escaped name not preserved")
            if filename == "compressed-javascript.pdf":
                require(click["/JS"]["/Filter"] == "/FlateDecode", "compressed-javascript.pdf: missing compression")
                require(click["/JS"].get_data() == JAVASCRIPT.encode("ascii"), "compressed-javascript.pdf: wrong decoded JS")
                require(JAVASCRIPT.encode("ascii") not in data, "compressed-javascript.pdf: JS visible in raw bytes")
            else:
                require(click["/JS"] == JAVASCRIPT, f"{filename}: wrong JS string")
        elif filename == "launch.pdf":
            require(click["/S"] == "/Launch", "launch.pdf: missing action")
        else:
            require(click["/S"] == "/URI" and click["/URI"] == URI, f"{filename}: wrong link")
            if filename == "next-action.pdf":
                require(click["/Next"]["/S"] == "/Launch", "next-action.pdf: missing chained Launch")
            else:
                require("/Next" not in click and "/OpenAction" not in root, "link.pdf: unexpected active follow-up")
    if filename == "automatic-action.pdf":
        require(root["/OpenAction"]["/S"] == "/URI", "automatic-action.pdf: missing automatic URI")
    elif filename in {"type3-glyph-a.pdf", "type3-glyph-b.pdf"}:
        glyph = "A" if filename == "type3-glyph-a.pdf" else "B"
        font = reader.pages[0]["/Resources"]["/Font"]["/FType3"]
        require(font["/Type"] == "/Font" and font["/Subtype"] == "/Type3", f"{filename}: missing actual Type3 font")
        require(set(font["/CharProcs"]) == {"/" + glyph}, f"{filename}: wrong CharProcs")
        glyph_stream = font["/CharProcs"]["/" + glyph]
        require(isinstance(glyph_stream, StreamObject) and not set(glyph_stream).difference({"/Filter"}), f"{filename}: glyph must be a pure stream")
        require(glyph_stream.get_data().startswith(b"600 0 0 0 600 700 d1\n"), f"{filename}: missing glyph metrics")
        require(font["/FirstChar"] == ord(glyph) and font["/LastChar"] == ord(glyph) and font["/Widths"] == [600], f"{filename}: wrong font widths/encoding")
        require(font["/Encoding"]["/Differences"] == [ord(glyph), "/" + glyph], f"{filename}: wrong encoding")
    elif filename == "object-stream-javascript.pdf":
        require(data.startswith(b"%PDF-1.5"), "object-stream-javascript.pdf: wrong PDF version")
        require(reader.xref_objStm == {10: (9, 0)}, "object-stream-javascript.pdf: action must be compressed object 10")
        annotation = reader.pages[0]["/Annots"][0].get_object()
        action_ref = annotation.raw_get("/A")
        require(action_ref.idnum == 10 and action_ref.generation == 0, "object-stream-javascript.pdf: wrong link reference")
        objstm = reader.get_object(9)
        require(objstm["/Type"] == "/ObjStm" and objstm["/N"] == 1 and objstm["/First"] == 5 and objstm["/Filter"] == "/FlateDecode", "object-stream-javascript.pdf: invalid ObjStm")
        require(objstm.get_data().startswith(b"10 0 <<") and b"/S /JavaScript" in objstm.get_data(), "object-stream-javascript.pdf: wrong compressed member")
        xref = reader.get_object(11)
        require(xref["/Type"] == "/XRef" and xref["/W"] == [1, 4, 2], "object-stream-javascript.pdf: missing xref stream")
        require(xref.get_data()[70:77] == b"\x02\x00\x00\x00\x09\x00\x00", "object-stream-javascript.pdf: wrong type-2 xref entry")
        startxref = int(data.rsplit(b"startxref\n", 1)[1].splitlines()[0])
        require(data.startswith(b"11 0 obj\n", startxref), "object-stream-javascript.pdf: wrong startxref")
        require(b"/S /JavaScript" not in data and JAVASCRIPT.encode("ascii") not in data, "object-stream-javascript.pdf: action is not compressed")
    elif filename == "xfa.pdf":
        xfa = root["/AcroForm"]["/XFA"]
        require(isinstance(xfa, StreamObject) and b"FICTIONAL XFA FIXTURE ONLY" in xfa.get_data(), "xfa.pdf: missing harmless XFA stream")
        require(ET.fromstring(xfa.get_data()).tag == "{http://ns.adobe.com/xdp/}xdp", "xfa.pdf: invalid demo XML")
    elif filename == "aa.pdf":
        require(reader.pages[0]["/AA"]["/O"]["/S"] == "/URI", "aa.pdf: missing page additional action")
    warnings = PARSER_DIAGNOSTICS.count - warnings_before
    require(warnings > 0 if intentional_recovery else warnings == 0, f"{filename}: unexpected parser diagnostic count")


def main() -> None:
    parser_logger = logging.getLogger("pypdf")
    parser_logger.handlers = [PARSER_DIAGNOSTICS]
    parser_logger.propagate = False
    parser_logger.setLevel(logging.WARNING)
    fixtures = {}
    for filename, _expected in CASES:
        data = build_pdf(filename)
        require(data == build_pdf(filename), f"{filename}: non-deterministic generation")
        validate_pdf(filename, data)
        fixtures[filename] = data
    manifest = [{"filename": filename, "expected": expected} for filename, expected in CASES]
    serialized_manifest = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, data in fixtures.items():
        (OUTPUT_DIR / filename).write_bytes(data)
    (OUTPUT_DIR / "manifest.json").write_text(serialized_manifest, encoding="utf-8")
    (OUTPUT_DIR / "README.md").write_text(README, encoding="utf-8")
    print(serialized_manifest, end="")


if __name__ == "__main__":
    main()
