import { createHash } from "node:crypto";
import { LEGAL_DOCUMENTS, type LegalDocumentId } from "../shared/legal-contract-documents";

export type LegalDocumentSnapshot = {
  documentId: LegalDocumentId;
  title: string;
  version: string;
  content: string;
  hash: string;
};

function contentHash(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Historische Originalfassungen, die bereits vor Einführung der
 * Dokument-Schnappschüsse elektronisch bestätigt werden konnten. Sie werden
 * ausschließlich serverseitig gehalten und über ihren SHA-256-Nachweis
 * eindeutig zugeordnet.
 */
const HISTORICAL_LEGAL_DOCUMENT_SNAPSHOTS: LegalDocumentSnapshot[] = [
  {
    "documentId": "terms",
    "title": "Allgemeine Geschäftsbedingungen für MyCrewMate",
    "version": "1.0-2026-10-01",
    "content": "# Allgemeine Geschäftsbedingungen für MyCrewMate\n\nVersion 1.0 · Stand 01.10.2026\n\n## 1. Anbieter und Geltungsbereich\nMyCrewMate ist ein Angebot von Christian Lambrich, Eichenweg 4, 56729 Nachtsheim, Deutschland. Diese Bedingungen gelten gegenüber Vereinen, Verbänden und sonstigen Organisationen, die MyCrewMate für ihre Vereins- und Eventplanung nutzen.\n\n## 2. Leistungsgegenstand\nMyCrewMate stellt eine mandantengetrennte Software zur Planung von Veranstaltungen, Aufgaben, Helfern, Schichten, Ansprechpartnern, Material und zugehöriger Kommunikation bereit. Maßgeblich ist der Funktionsumfang des bei Vertragsbeginn oder später ausgewählten Pakets.\n\n## 3. Vertragsschluss und digitale Unterlagen\nEin Vertrag kann digital geschlossen werden. Die vertretungsberechtigte Person des Vereins bestätigt vor der erstmaligen Nutzung die AGB, die Vereinbarung zur Auftragsverarbeitung und die Datenschutzhinweise durch aktive Auswahl. MyCrewMate speichert dafür Verein, bestätigende Person, Zeitpunkt, Paket, Dokumentversion und Integritätsnachweis. Die Bestätigung wird dem Verein per E-Mail dokumentiert.\n\n## 4. Pflichten des Vereins\nDer Verein bleibt für seine Planungsdaten, die Rechtmäßigkeit der Datenerhebung, die Information betroffener Personen und die Vergabe interner Rechte verantwortlich. Zugangsdaten sind persönlich zu behandeln. Der Verein hinterlegt keine besonderen Kategorien personenbezogener Daten in Freitextfeldern, sofern keine dokumentierte Rechtsgrundlage und geeignete Schutzmaßnahme besteht.\n\n## 5. Pakete, Entgelte und Laufzeit\nPaketumfang, Preis und Laufzeit ergeben sich aus der bei Vertragsschluss angezeigten Auswahl oder einer individuellen Vereinbarung. Testzugänge sind zeitlich begrenzt und unverbindlich, sofern nicht ausdrücklich etwas anderes vereinbart ist. Entgeltliche Pakete werden erst nach der dokumentierten Bestellung und dem dort ausgewiesenen Zahlungsweg aktiviert.\n\n## 6. Verfügbarkeit und Support\nMyCrewMate wird mit angemessener Sorgfalt betrieben. Wartung, Sicherheitsmaßnahmen und technische Weiterentwicklungen können zeitweise zu Einschränkungen führen. Der Anbieter informiert über erhebliche planbare Einschränkungen in angemessener Weise.\n\n## 7. Datenschutz\nSoweit MyCrewMate personenbezogene Planungsdaten für den Verein verarbeitet, handelt MyCrewMate auf Grundlage der gesondert bestätigten Vereinbarung zur Auftragsverarbeitung. Eigene Vertrags-, Sicherheits- und Abrechnungsdaten verarbeitet MyCrewMate in eigener Verantwortlichkeit nach den Datenschutzhinweisen der App.\n\n## 8. Laufzeit, Beendigung und Daten\nNach Vertragsende erhält der Verein nach Weisung eine Rückgabe oder Löschung seiner Mandantendaten, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Die in der App dokumentierten Lösch- und Aufbewahrungsregeln bleiben anwendbar.\n\n## 9. Änderungen dieser Unterlagen\nWesentliche Änderungen dieser Bedingungen, der Auftragsverarbeitung oder eingesetzter Unterauftragsverarbeiter werden vor ihrer Geltung nachvollziehbar dokumentiert. Erfordern sie eine erneute Annahme, wird diese vor der weiteren Nutzung aktiv eingeholt.\n\n## 10. Schlussbestimmungen\nEs gilt deutsches Recht. Gesetzliche zwingende Zuständigkeiten bleiben unberührt.",
    "hash": "463a80b90fa19c357f3f0a6173f547400de8ffff5bf8f8e7a66f6e3e7ef8618d"
  },
  {
    "documentId": "avv",
    "title": "Vereinbarung zur Auftragsverarbeitung (AVV)",
    "version": "1.2-2026-10-01",
    "content": "# Vereinbarung zur Auftragsverarbeitung (AVV)\n\nVersion 1.2 · Stand 01.10.2026\n\n## 1. Vertragsparteien\nDer bei der Aktivierung benannte Verein ist Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO. Christian Lambrich / MyCrewMate, Eichenweg 4, 56729 Nachtsheim, Deutschland, Datenschutzkontakt: info@mycrewmate.de, ist Auftragsverarbeiter im Sinne von Art. 4 Nr. 8 DSGVO.\n\n## 2. Gegenstand und Dauer\nMyCrewMate verarbeitet die vom Verein eingegebenen Planungsdaten ausschließlich zur Bereitstellung der gebuchten Vereins- und Eventplanung. Die Verarbeitung beginnt mit der Aktivierung des Vereinszugangs und endet mit Rückgabe oder Löschung nach Ende des Hauptvertrags, soweit keine gesetzlichen Pflichten entgegenstehen.\n\n## 3. Art, Zweck und Datenkategorien\nVerarbeitet werden je nach Nutzung insbesondere Kontaktdaten, Helfer- und Ansprechpartnerdaten, Verfügbarkeiten, Schicht- und Aufgabeninformationen, Organisationsdaten sowie technisch erforderliche Sicherheits- und Protokolldaten. Betroffene Personen sind insbesondere Vereinsadministratoren, Planungsteam, Ansprechpartner, Helfer und freiwillige Spender. Der Zweck ist die Vorbereitung, Durchführung und Nachbereitung der Vereins- und Veranstaltungsarbeit.\n\n## 4. Weisungen und Vertraulichkeit\nMyCrewMate verarbeitet personenbezogene Daten nur auf dokumentierte Weisung des Vereins, soweit keine gesetzliche Pflicht besteht. Weisungen ergeben sich aus dem Hauptvertrag, den gebuchten Funktionen, dieser Vereinbarung oder aus einer textlich dokumentierten Weisung. Personen mit Zugriff auf Mandantendaten sind auf Vertraulichkeit verpflichtet und erhalten nur erforderliche Zugriffe.\n\n## 5. Technische und organisatorische Maßnahmen\nMyCrewMate setzt insbesondere individuelle Zugänge, rollen- und fachbereichsbezogene Rechte, serverseitige Mandanten- und Veranstaltungsprüfungen, sichere Passwortspeicherung, HTTPS, TLS-gesicherten E-Mail-Versand, Sicherheitsprotokolle, widerrufbare und zeitlich begrenzte PDF-Freigaben sowie regelmäßige Sicherungen der Datenbank und des Upload-Volumes ein.\n\n## 6. Unterauftragsverarbeiter und Dienste\nDer Verein stimmt der Nutzung folgender für den Betrieb erforderlicher Dienste zu: Hetzner Online GmbH für Hosting, Maildienst und Object Storage; Coolify als selbst gehostete Betriebsoberfläche auf der Hetzner-Infrastruktur; OpenStreetMap und OpenTopoMap nur bei bewusster Nutzung der optionalen Kartenansicht. Die Datenbank und das Upload-Volume werden innerhalb der produktiven Hetzner-Betriebsumgebung geführt; Datenbank- und Uploadsicherungen werden täglich erstellt und zusätzlich in Hetzner Object Storage gesichert. Weitere Dienstleister werden vor einem Einsatz nach den gesetzlichen Vorgaben dokumentiert und mit angemessener Widerspruchsmöglichkeit angekündigt.\n\n## 7. Unterstützung und Datenschutzvorfälle\nMyCrewMate unterstützt den Verein angemessen bei Betroffenenanfragen, Sicherheitsvorfällen und der Erfüllung von Pflichten nach Art. 32 bis 36 DSGVO. Über bekannt gewordene Datenschutzvorfälle im Auftragsverarbeitungsbereich informiert MyCrewMate den Verein ohne unangemessene Verzögerung unter info@mycrewmate.de.\n\n## 8. Rückgabe und Löschung\nDer Verein kann für abgeschlossene Veranstaltungen eine frühere Löschung anweisen. Als Regelwert gilt eine Aufbewahrung von drei Jahren ab Veranstaltungsabschluss, soweit keine gesetzliche oder dokumentierte Ausnahme entgegensteht. Steuer-, vertrags- oder buchhaltungsrelevante Unterlagen können längeren Fristen unterliegen. Sicherungen werden im Rahmen der festgelegten Rotation vorgehalten und nicht für neue Verarbeitungszwecke verwendet.\n\n## 9. Kontrolle und elektronischer Abschluss\nDer Verein darf die Einhaltung dieser Vereinbarung nach angemessener Vorankündigung anhand geeigneter Nachweise prüfen. Diese Vereinbarung wird nach Art. 28 Abs. 9 DSGVO in elektronischem Format geschlossen. Die aktive Annahme durch die berechtigte Vereinsadministration wird mit Dokumentversion, Integritätsnachweis, Zeitpunkt, Verein und ausgewähltem Paket dokumentiert und per E-Mail bestätigt.",
    "hash": "daeae72375be898a63301b713272685763db5d6624b36e38479d2158a1161fd1"
  },
  {
    "documentId": "privacy",
    "title": "Datenschutzhinweise für die MyCrewMate-App",
    "version": "1.2-2026-10-01",
    "content": "# Datenschutzhinweise für die MyCrewMate-App\n\nVersion 1.2 · Stand 01.10.2026\n\nFür die Verarbeitung der Vereins-, Helfer- und Veranstaltungsdaten ist regelmäßig der jeweilige Verein verantwortlich. MyCrewMate verarbeitet diese Mandantendaten im Auftrag des Vereins. Für Plattformbetrieb, Vertragsverwaltung, Sicherheit und Abrechnung ist Christian Lambrich, Eichenweg 4, 56729 Nachtsheim, Deutschland verantwortlich. Datenschutzanfragen können an info@mycrewmate.de gerichtet werden.\n\nDie App verarbeitet je nach Nutzung Kontakt- und Zugangsdaten, Planungsdaten, Helfer-, Ansprechpartner- und Schichtdaten, organisatorische Hinweise sowie Sicherheits- und Aktivitätsprotokolle. Die Nutzung dient der Vereins- und Eventplanung. Persönliche Einsatzübersichten werden nur bei bewusster Freigabe erstellt, sind sieben Tage gültig, mit einem getrennten Zugangscode geschützt und können sofort widerrufen werden.\n\nDie Anwendung wird auf Hetzner-Infrastruktur betrieben. Erforderliche transaktionale E-Mails werden über den Hetzner-Maildienst versandt. Datenbank und Upload-Volume werden täglich gesichert; Sicherungen liegen zusätzlich in Hetzner Object Storage. Die optionale Kartenansicht bindet OpenStreetMap und OpenTopoMap erst beim Aufruf der Karte ein. Der WhatsApp-Button öffnet erst nach einem bewussten Klick einen externen Chat.\n\nAbgeschlossene Veranstaltungen werden regulär drei Jahre ab Abschluss aufbewahrt, sofern keine frühere Löschweisung oder gesetzliche Aufbewahrungspflicht entgegensteht. Betroffene Personen haben nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit sowie ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.",
    "hash": "8b5aa30dac20290d1e6537578fed3990b9bf20f3b77f3492a2c85263b47a1a5f"
  }
];

export function currentLegalDocumentSnapshot(documentId: LegalDocumentId): LegalDocumentSnapshot {
  const document = LEGAL_DOCUMENTS[documentId];
  return {
    documentId,
    title: document.title,
    version: document.version,
    content: document.content,
    hash: contentHash(document.content),
  };
}

export function legalDocumentSnapshotHasExpectedHash(
  snapshot: Pick<LegalDocumentSnapshot, "content" | "hash">
) {
  return contentHash(snapshot.content) === snapshot.hash;
}

/**
 * Liefert ausschließlich die textlich exakte Fassung, deren gespeicherter
 * Versions- und Integritätsnachweis passt. Unbekannte oder manipulierte
 * Kombinationen werden bewusst nicht auf eine andere Fassung abgebildet.
 */
export function resolveLegalDocumentSnapshot(input: {
  documentId: LegalDocumentId;
  version: string;
  hash: string;
  storedTitle?: string | null;
  storedContent?: string | null;
}): LegalDocumentSnapshot | null {
  if (input.storedTitle && input.storedContent) {
    const stored: LegalDocumentSnapshot = {
      documentId: input.documentId,
      title: input.storedTitle,
      version: input.version,
      content: input.storedContent,
      hash: input.hash,
    };
    if (legalDocumentSnapshotHasExpectedHash(stored)) return stored;
  }

  const current = currentLegalDocumentSnapshot(input.documentId);
  if (current.version === input.version && current.hash === input.hash) {
    return current;
  }

  return (
    HISTORICAL_LEGAL_DOCUMENT_SNAPSHOTS.find(
      snapshot =>
        snapshot.documentId === input.documentId &&
        snapshot.version === input.version &&
        snapshot.hash === input.hash
    ) ?? null
  );
}

/** Für die einmalige Datenmigration: nur bekannte Originalfassungen. */
export function knownLegalDocumentSnapshots() {
  return [
    ...HISTORICAL_LEGAL_DOCUMENT_SNAPSHOTS,
    ...(["terms", "avv", "privacy"] as LegalDocumentId[]).map(
      currentLegalDocumentSnapshot
    ),
  ];
}
