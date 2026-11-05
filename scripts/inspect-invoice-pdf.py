#!/usr/bin/env python3
"""Read-only PDF policy. Input: original PDF on stdin; output: small JSON result.
No network, rendering, scripts, external XML resolution or document rewriting.
"""
import io
import json
import logging
import re
import resource
import sys
from urllib.parse import urlsplit

# Applied before loading the parser. A hostile document cannot consume the app's
# memory indefinitely; Node also enforces a wall-clock deadline and bounded queue.
resource.setrlimit(resource.RLIMIT_AS, (192 * 1024 * 1024, 192 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))

from defusedxml import ElementTree as SafeET
from pypdf import PdfReader, overwrite_configuration
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, StreamObject

class ParserDiagnostics(logging.Handler):
    """Fail closed on parser recovery, without logging PDF contents anywhere."""
    def __init__(self):
        super().__init__(logging.WARNING)
        self.ambiguous = False
        self.missing_refs = set()

    def emit(self, record):
        message = record.getMessage()
        missing = re.fullmatch(r"Object (\d+) (\d+) not defined\.", message)
        if missing:
            self.missing_refs.add((int(missing[1]), int(missing[2])))
            return
        cache = re.fullmatch(r"Overwriting cache for (\d+) (\d+)", message)
        if cache and (int(cache[2]), int(cache[1])) in self.missing_refs:
            return  # Repeated null-cache insertion of the same missing font ref.
        self.ambiguous = True  # Includes duplicate keys and partial dictionaries.


diagnostics = ParserDiagnostics()
parser_logger = logging.getLogger("pypdf")
parser_logger.handlers = [diagnostics]
parser_logger.propagate = False
parser_logger.setLevel(logging.WARNING)
MAX_PDF = 5 * 1024 * 1024
MAX_XML = 2 * 1024 * 1024
MAX_STREAM = 8 * 1024 * 1024
MAX_OBJECTS = 20000
MAX_DEPTH = 64
POLICY_VERSION = "einvoice-xml-v1"
overwrite_configuration(
    maximum_declared_stream_length=MAX_STREAM,
    array_based_stream_maximum_output_length=MAX_STREAM,
    zlib_maximum_output_length=MAX_STREAM,
    zlib_maximum_recovery_input_length=MAX_PDF,
    lzw_maximum_output_length=MAX_STREAM,
    run_length_maximum_output_length=MAX_STREAM,
    image_maximum_buffer_size=MAX_STREAM,
    jbig2_maximum_output_length=MAX_STREAM,
    page_tree_maximum_entries=2000,
    page_tree_maximum_depth=MAX_DEPTH,
    jbig2dec_binary=None,
)


class Rejected(Exception):
    def __init__(self, reason):
        self.reason = reason


def name(value):
    return re.sub(r"#([0-9A-Fa-f]{2})", lambda m: chr(int(m.group(1), 16)), str(value))


def resolve(value):
    return value.get_object() if isinstance(value, IndirectObject) else value


def check_xml(data):
    if not data or len(data) > MAX_XML:
        raise Rejected("attachment_limits")
    # Restrict encoding before parsing so DTD/PI checks cannot be bypassed with
    # UTF-16/NUL bytes. Ordinary CII/UBL invoices use UTF-8 (optional BOM).
    try:
        text = data.decode("utf-8-sig", errors="strict")
    except UnicodeError:
        raise Rejected("attachment")
    if "\x00" in text or re.search(r"<!\s*(DOCTYPE|ENTITY)\b", text, re.I):
        raise Rejected("attachment")
    if re.search(r"<\?(?!xml\s)[\s\S]*?\?>", text, re.I):
        raise Rejected("attachment")
    try:
        root = SafeET.fromstring(text, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except Exception:
        raise Rejected("attachment")
    count = 0
    stack = [(root, 0)]
    while stack:
        element, depth = stack.pop()
        count += 1
        if count > MAX_OBJECTS or depth > MAX_DEPTH:
            raise Rejected("attachment_limits")
        tag = str(element.tag)
        if tag.startswith("{http://www.w3.org/2001/XInclude}") or tag.startswith("{http://www.w3.org/1999/XSL/Transform}"):
            raise Rejected("attachment")
        if tag.split("}")[-1] in {"EmbeddedDocumentBinaryObject", "AttachmentBinaryObject", "BinaryObject", "Base64BinaryObject"}:
            raise Rejected("attachment")
        stack.extend((child, depth + 1) for child in element)
    cii = "{urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100}CrossIndustryInvoice"
    ram = "{urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100}"
    rsm = "{urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100}"
    if root.tag == cii:
        profile = root.findtext(rsm + "ExchangedDocumentContext/" + ram + "GuidelineSpecifiedDocumentContextParameter/" + ram + "ID", default="").strip()
        invoice_id = root.findtext(rsm + "ExchangedDocument/" + ram + "ID", default="").strip()
    elif root.tag in {
        "{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice",
        "{urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2}CreditNote",
    }:
        cbc = "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}"
        profile = root.findtext(cbc + "CustomizationID", default="").strip()
        invoice_id = root.findtext(cbc + "ID", default="").strip()
    else:
        raise Rejected("attachment")
    accepted_profile = (
        profile == "urn:cen.eu:en16931:2017"
        or bool(re.fullmatch(r"urn:cen\.eu:en16931:2017#compliant#urn:xeinkauf\.de:kosit:xrechnung_[23]\.\d+(?:\.\d+)?", profile))
        or bool(re.fullmatch(r"urn:factur-x\.eu:1p0:(?:minimum|basicwl|basic|en16931|extended)", profile))
        or profile in {"urn:zugferd.de:2p0:minimum", "urn:zugferd.de:2p0:basicwl", "urn:zugferd.de:2p0:basic", "urn:zugferd.de:2p0:extended"}
    )
    if not accepted_profile or not invoice_id:
        raise Rejected("attachment")


def inspect_pdf(data):
    if not data or len(data) > MAX_PDF:
        raise Rejected("limits")
    diagnostics.ambiguous = False
    diagnostics.missing_refs.clear()
    # Some invoicing tools leave unused font/metadata references unresolved.
    # Recover those as null, but independently require catalog/pages and reject
    # absent or invalid action/attachment dictionaries below (fail closed).
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted or "/Encrypt" in reader.trailer:
        raise Rejected("password")
    root = resolve(reader.trailer.get("/Root"))
    if not isinstance(root, DictionaryObject) or name(root.get("/Type")) != "/Catalog":
        raise Rejected("invalid")
    if not 1 <= len(reader.pages) <= 200:
        raise Rejected("limits")
    visited_refs, visited_objects = set(), set()
    embedded_streams, file_specs = {}, []
    glyph_dictionaries = set()
    budget = 0
    forbidden_keys = {
        "/JavaScript", "/JS", "/Launch", "/RichMedia", "/RichMediaContent",
        "/RichMediaSettings", "/XFA", "/Encrypt", "/OpenAction", "/AA",
    }
    forbidden_types = {"/JavaScript", "/Launch", "/Rendition", "/Movie", "/Sound", "/3D", "/RichMedia", "/SubmitForm", "/ImportData", "/GoToR", "/GoToE"}

    def check_action(value):
        action = resolve(value)
        if not isinstance(action, DictionaryObject):
            raise Rejected("active")
        action_type = name(action.get("/S"))
        if action_type == "/URI":
            uri = str(resolve(action.get("/URI", "")))
            parsed = urlsplit(uri)
            if any(ord(c) < 32 for c in uri) or parsed.scheme.lower() not in {"https", "http", "mailto"}:
                raise Rejected("active")
            if parsed.scheme.lower() in {"https", "http"} and not parsed.netloc:
                raise Rejected("active")
        elif action_type != "/GoTo":
            raise Rejected("active")
        next_action = action.get("/Next")
        if next_action is not None:
            next_action = resolve(next_action)
            for item in next_action if isinstance(next_action, ArrayObject) else [next_action]:
                # Cyclic action chains are invalid; ordinary invoice links need
                # no action chain at all. Reject instead of recursive evaluation.
                raise Rejected("active")

    def walk(value, depth=0):
        nonlocal budget
        if depth > MAX_DEPTH:
            raise Rejected("limits")
        if isinstance(value, IndirectObject):
            ref = (value.idnum, value.generation)
            if ref in visited_refs:
                return
            visited_refs.add(ref)
            if len(visited_refs) > MAX_OBJECTS:
                raise Rejected("limits")
            value = value.get_object()
        if not isinstance(value, (DictionaryObject, ArrayObject)):
            return
        identity = id(value)
        if identity in visited_objects:
            return
        visited_objects.add(identity)
        budget += len(value) + 1
        if budget > MAX_OBJECTS * 5:
            raise Rejected("limits")
        if isinstance(value, DictionaryObject):
            normalized = {name(key): resolve(item) for key, item in value.items()}
            if forbidden_keys.intersection(normalized):
                raise Rejected("active")
            if name(normalized.get("/S")) in forbidden_types or name(normalized.get("/Subtype")) in forbidden_types:
                raise Rejected("active")
            if "/A" in normalized and identity not in glyph_dictionaries:
                check_action(normalized["/A"])
            if name(normalized.get("/Type")) == "/Action" or name(normalized.get("/S")) in {"/URI", "/GoTo"}:
                check_action(value)
            if isinstance(value, StreamObject) and name(normalized.get("/Type")) == "/EmbeddedFile":
                subtype = name(normalized.get("/Subtype", "/application/xml"))
                if subtype not in {"/application/xml", "/text/xml"}:
                    raise Rejected("attachment")
                embedded_streams[identity] = value
            if "/EF" in normalized:
                ef = normalized["/EF"]
                if not isinstance(ef, DictionaryObject):
                    raise Rejected("attachment")
                filenames = [str(normalized[key]) for key in ("/F", "/UF") if key in normalized]
                if not filenames or any(not re.fullmatch(r"[^/\\\x00-\x1f]{1,196}\.xml", f, re.I) for f in filenames):
                    raise Rejected("attachment")
                targets = {id(resolve(item)) for item in ef.values()}
                if len(targets) != 1 or any(name(key) not in {"/F", "/UF"} for key in ef):
                    raise Rejected("attachment")
                file_specs.append(targets)
            for item in value.values():
                walk(item, depth + 1)
        else:
            for item in value:
                walk(item, depth + 1)

    # Inspect all current xref objects, including unreferenced objects and members
    # of compressed object streams; scanning visible pages/filename alone is not
    # sufficient. pypdf resolves the newest incremental revision and escaped names.
    object_refs = {(oid, generation) for generation, entries in reader.xref.items() if generation != 65535 for oid in entries if oid != 0}
    object_refs.update((oid, 0) for oid in reader.xref_objStm)
    if len(object_refs) > MAX_OBJECTS:
        raise Rejected("limits")
    objects = [reader.get_object(IndirectObject(oid, generation, reader)) for oid, generation in object_refs]
    # /A inside an actual Type3 /CharProcs is the letter A, not an action.
    # Register only dictionaries consisting entirely of glyph streams; inspect
    # those streams normally. Never blanket-ignore arbitrary /A dictionaries.
    for obj in objects:
        if isinstance(obj, DictionaryObject) and name(obj.get("/Type")) == "/Font" and name(obj.get("/Subtype")) == "/Type3":
            glyphs = resolve(obj.get("/CharProcs"))
            if not isinstance(glyphs, DictionaryObject) or any(not isinstance(resolve(item), StreamObject) for item in glyphs.values()):
                raise Rejected("invalid")
            glyph_dictionaries.add(id(glyphs))
    walk(reader.trailer)
    for oid, generation in object_refs:
        walk(IndirectObject(oid, generation, reader))
    if embedded_streams or file_specs:
        if len(embedded_streams) != 1 or len(file_specs) != 1 or file_specs[0] != set(embedded_streams):
            raise Rejected("attachment")
        stream = next(iter(embedded_streams.values()))
        # Decode with parser limits, then bound actual bytes, not an untrusted
        # /Params /Size. No embedded data is written to disk or served separately.
        check_xml(stream.get_data())
    if diagnostics.ambiguous:
        raise Rejected("invalid")
    return {"ok": True, "policyVersion": POLICY_VERSION, "invoiceAttachments": len(embedded_streams)}


def main():
    try:
        result = inspect_pdf(sys.stdin.buffer.read(MAX_PDF + 1))
    except Rejected as error:
        result = {"ok": False, "reason": error.reason}
    except (MemoryError, RecursionError):
        result = {"ok": False, "reason": "limits"}
    except Exception:
        result = {"ok": False, "reason": "invalid"}
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
