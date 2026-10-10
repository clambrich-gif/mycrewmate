import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  LEGAL_DOCUMENTS,
  REQUIRED_LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "../shared/legal-contract-documents";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function normalizedSource(relativePath: string) {
  return source(relativePath).replace(/\s+/g, " ");
}

function documentHash(documentId: LegalDocumentId) {
  return createHash("sha256")
    .update(LEGAL_DOCUMENTS[documentId].content, "utf8")
    .digest("hex");
}

describe("Digitale Vertragsannahme, Freigabefilter und Veranstaltungsabschluss", () => {
  it("definiert AGB und AVV mit festen Versionen und Hashwerten", () => {
    expect(REQUIRED_LEGAL_DOCUMENT_IDS).toEqual(["terms", "avv", "privacy"]);
    expect(LEGAL_DOCUMENTS.terms.version).toBe("1.1-2026-10-10");
    expect(LEGAL_DOCUMENTS.avv.version).toBe("1.3-2026-10-02");
    expect(LEGAL_DOCUMENTS.privacy.version).toBe("1.4-2026-10-04");
    expect(documentHash("terms")).toMatch(/^[a-f0-9]{64}$/);
    expect(documentHash("avv")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("erläutert Eigenverantwortung, eigene Sicherung und zulässige Haftungsgrenzen", () => {
    const terms = LEGAL_DOCUMENTS.terms.content;

    expect(terms).toContain("ehrenamtlichen Initiativen sowie kommunalen Organisationen");
    expect(terms).toContain("nicht für private Feiern, Firmenveranstaltungen oder gewerbliche Eventdienstleistungen vorgesehen");
    expect(terms).toContain("MyCrewMate ist ein Planungswerkzeug und übernimmt nicht die Rolle des Veranstalters");
    expect(terms).toContain("sichere Durchführung seiner Veranstaltung, erforderliche Genehmigungen, Versicherungen");
    expect(terms).toContain("## 4. Pflichten des Vereins");
    expect(terms).toContain("Er richtet Zugänge nur für berechtigte Personen ein");
    expect(terms).toContain("einen eigenen Stand seiner für die Veranstaltung wesentlichen Planungsdaten");
    expect(terms).toContain("Excel- oder vergleichbare Exportdateien");
    expect(terms).toContain("ergänzen, ersetzen aber nicht den eigenen Arbeitsstand des Vereins");
    expect(terms).toContain("Eine automatische Verlängerung erfolgt nur");
    expect(terms).toContain("Eine ununterbrochene, jederzeit und fehlerfrei verfügbare Nutzung kann technisch jedoch nicht zugesagt werden");
    expect(terms).toContain("## 7. Haftung");
    expect(terms).toContain("haftet unbeschränkt bei Vorsatz, grober Fahrlässigkeit");
    expect(terms).toContain("vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden");
    expect(terms).toContain("bei einer nach Abschnitt 4 ordnungsgemäßen, regelmäßigen eigenen Sicherung");
    expect(terms).toContain("Vor einer angewiesenen Löschung sichert der Verein");
  });

  it("bindet die Vertragsannahme an das Initialpasswort-Modal und den Server-Router", () => {
    const modal = source("client/src/components/ForcePasswordChangeModal.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const router = source("server/routers.ts");
    const db = source("server/db.ts");

    expect(modal).toContain("requiresContractAcceptance");
    expect(modal).toContain("contractDocumentsAccepted");
    expect(modal).toContain("Ich handle vertretungsberechtigt");
    expect(modal).toContain("/agb");
    expect(modal).toContain("/avv");
    expect(modal).toContain("/datenschutz");
    expect(layout).toContain("acceptContractDocuments: true");
    expect(router).toContain("acceptContractDocuments: z.literal(true");
    expect(router).toContain("acceptCurrentTenantContractDocuments");
    expect(router).toContain(
      "Bitte bestätigen Sie zuerst die aktuelle AGB, AVV und Datenschutzerklärung"
    );
    expect(db).toContain("tenantContractAcceptances");
    expect(db).toContain("tenantNeedsCurrentContractAcceptance");
  });

  it("sperrt eine bestehende Vereinsadminsitzung bis zur erneuten Annahme", () => {
    const layout = normalizedSource("client/src/components/Layout.tsx");
    const router = source("server/routers.ts");
    const db = source("server/db.ts");

    expect(layout).toContain("currentContractAcceptanceDialog");
    expect(layout).toContain("Aktualisierte {CURRENT_TERMS_LABEL} bestätigen");
    expect(layout).toContain("Ihre bisherige Annahme bleibt als Nachweis erhalten.");
    expect(layout).toContain("Für die weitere Nutzung gilt die neue Fassung erst nach Ihrer aktiven Bestätigung.");
    expect(layout).toContain("Verbindlich bestätigen & fortfahren");
    expect(layout).toContain("acceptCurrentTenantContractDocuments.mutate");
    expect(router).toContain(
      "acceptCurrentTenantContractDocuments: baseProtectedProcedure"
    );
    expect(router).toContain(
      "tenantNeedsCurrentContractAcceptance(membership.tenantId)"
    );
    expect(db).toContain("documentVersion === document.version");
    expect(db).toContain("documentHash === legalDocumentHash(documentId)");
  });

  it("stellt AGB und AVV über eigene öffentliche Seiten bereit", () => {
    const app = source("client/src/App.tsx");
    const page = source("client/src/pages/LegalDocument.tsx");

    expect(app).toContain('path="/agb"');
    expect(app).toContain('path="/avv"');
    expect(page).toContain("LEGAL_DOCUMENTS[documentId]");
  });

  it("stellt bestätigenden Vereinsadmins einen PDF-Vertragsnachweis bereit und hängt ihn der Bestätigungsmail an", () => {
    const router = source("server/routers.ts");
    const db = source("server/db.ts");
    const pdf = source("server/pdf.ts");
    const security = source("client/src/pages/Security.tsx");
    const mail = source("server/mail-service.ts");

    expect(router).toContain("contractAcceptanceReceipt: baseProtectedProcedure");
    expect(router).toContain("contractAcceptedDocuments: baseProtectedProcedure");
    expect(router).toContain("Digitaler_Vertragsnachweis.pdf");
    expect(router).toContain("Meine_bestaetigten_Vertragsunterlagen.pdf");
    expect(router).toContain("attachments:");
    expect(db).toContain("getCurrentTenantContractReceipt");
    expect(pdf).toContain("renderTenantContractReceiptPdf");
    expect(pdf).toContain("renderTenantAcceptedContractDocumentsPdf");
    expect(security).toContain("Meine bestätigten Vertragsunterlagen herunterladen");
    expect(security).toContain("Kurzen Vertragsnachweis herunterladen");
    expect(mail).toContain("als PDF beigefügt");
  });

  it("bietet im Aktivitätsprotokoll einen Filter für Freigaben und Zugänge", () => {
    const permissions = source("client/src/pages/Permissions.tsx");
    const router = source("server/routers.ts");
    const klemmiAudio = source("client/src/lib/klemmiAudio.ts");

    expect(permissions).toContain("activityKindFilter");
    expect(permissions).toContain("Nur Freigaben &amp; Zugänge");
    expect(router).toContain('planningTeamAccesses: "Zugänge & Freigaben"');
    expect(klemmiAudio).toContain("security-audit-activity");
    expect(klemmiAudio).toContain("Nur Freigaben und Zugänge");
  });

  it("erläutert beim Schließen den sofortigen Widerruf von Freigaben und Links", () => {
    const layout = normalizedSource("client/src/components/Layout.tsx");
    const closureRecommendation = source(
      "client/src/components/KlemmiEventClosureRecommendation.tsx"
    );

    expect(layout).toContain("Alle eventbezogenen Planungsteam-Freigaben");
    expect(layout).toContain("sieben-Tage-PDF-Links werden sofort widerrufen");
    expect(layout).toContain("andere aktive Veranstaltungen des Vereins");
    expect(closureRecommendation).toContain("Klemmi widerruft dabei sofort");
    expect(closureRecommendation).toContain("sieben-Tage-PDF-Links");
  });
});
