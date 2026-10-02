import { describe, expect, it } from "vitest";
import {
  currentLegalDocumentSnapshot,
  knownLegalDocumentSnapshots,
  legalDocumentSnapshotHasExpectedHash,
  resolveLegalDocumentSnapshot,
} from "./legal-contract-document-snapshots";

describe("Dokumentschnappschüsse für bestätigte Vertragsunterlagen", () => {
  it("liefert für aktuelle Dokumente den exakt passenden Hashwert", () => {
    for (const documentId of ["terms", "avv", "privacy"] as const) {
      const snapshot = currentLegalDocumentSnapshot(documentId);
      expect(snapshot.title.length).toBeGreaterThan(5);
      expect(snapshot.content.length).toBeGreaterThan(100);
      expect(snapshot.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(legalDocumentSnapshotHasExpectedHash(snapshot)).toBe(true);
    }
  });

  it("löst historische Bestätigungen mit übereinstimmendem Hash auf", () => {
    const historical = resolveLegalDocumentSnapshot({
      documentId: "avv",
      version: "1.2-2026-10-01",
      hash: "daeae72375be898a63301b713272685763db5d6624b36e38479d2158a1161fd1",
    });

    expect(historical).not.toBeNull();
    expect(historical?.title).toBe("Vereinbarung zur Auftragsverarbeitung (AVV)");
    expect(historical?.content).toContain("Version 1.2 · Stand 01.10.2026");
  });

  it("verwirft manipulierte oder inkonsistente Schnappschüsse", () => {
    const manipulated = resolveLegalDocumentSnapshot({
      documentId: "terms",
      version: "1.0-2026-10-01",
      hash: "463a80b90fa19c357f3f0a6173f547400de8ffff5bf8f8e7a66f6e3e7ef8618d",
      storedTitle: "Manipulierte AGB",
      storedContent: "# Fälschung",
    });

    expect(manipulated?.content).not.toBe("# Fälschung");
    expect(manipulated?.content).toContain("Version 1.0 · Stand 01.10.2026");
  });

  it("stellt alle bekannten Schnappschüsse für Migration und Backfill bereit", () => {
    const snapshots = knownLegalDocumentSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(6);
    expect(snapshots.every(legalDocumentSnapshotHasExpectedHash)).toBe(true);
  });
});
