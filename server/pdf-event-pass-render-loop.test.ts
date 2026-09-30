import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pdfExportSource = () =>
  readFileSync(
    path.resolve(process.cwd(), "client/src/pages/PdfExport.tsx"),
    "utf8"
  );

describe("PDF-Ausgabe im Event Pass", () => {
  it("deaktiviert die gesperrte Ansprechpartner-Abfrage und verwendet einen stabilen Leerwert", () => {
    const page = pdfExportSource();

    expect(page).toContain('const EMPTY_CONTACTS: ReadonlyArray<{ id: number; name: string }> = [];');
    expect(page).toContain("enabled: allowsContacts");
    expect(page).toContain("const contacts = contactRows ?? EMPTY_CONTACTS;");
    expect(page).not.toContain("const { data: contacts = [] } = trpc.contacts.list.useQuery();");
  });

  it("schreibt den Auswahlzustand nur bei tatsächlicher Änderung", () => {
    const page = pdfExportSource();

    expect(page).toContain("if (!allowsContacts)");
    expect(page).toContain("current.length === 0 ? current : []");
    expect(page).toContain("return unchanged ? current : next;");
    expect(page).toContain("}, [allowsContacts, contacts]);");
  });
});
