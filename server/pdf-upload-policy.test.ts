import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { inspectPdfUpload } from "./pdf-upload-policy";
import { validateFinancePdf } from "./finance-documents";

const fixture = (name: string) =>
  readFileSync(`server/test-fixtures/pdf-policy/${name}`);
const manifest = JSON.parse(fixture("manifest.json").toString()) as Array<{
  filename: string;
  expected: "allow" | "deny";
}>;
afterEach(() => vi.unstubAllEnvs());

describe("Gemeinsame PDF-Uploadpolitik — ausschließlich synthetische Dateien", () => {
  it.each(manifest)("$filename: $expected", async ({ filename, expected }) => {
    const original = fixture(filename);
    const validation = validateFinancePdf(
      filename,
      original.toString("base64")
    );
    if (expected === "allow") {
      const result = await validation;
      expect(result.bytes).toEqual(original);
    } else {
      await expect(validation).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
  it("erlaubt eine Standardrechnung mit externem Link ohne Aufruf des Links", async () => {
    await expect(
      inspectPdfUpload(fixture("link.pdf"))
    ).resolves.toBeUndefined();
  });
  it("verweigert die Speicherung, wenn die Parser-Laufzeit nicht verfügbar ist", async () => {
    vi.stubEnv("PDF_INSPECTOR_PYTHON", "/nonexistent-fixture-only-python");
    await expect(inspectPdfUpload(fixture("plain.pdf"))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    vi.unstubAllEnvs();
    await expect(
      inspectPdfUpload(fixture("plain.pdf"))
    ).resolves.toBeUndefined();
  });
  it("begrenzt parallele Prüfungen und gibt die Warteschlange danach wieder frei", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => inspectPdfUpload(fixture("plain.pdf")))
    );
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(5);
    const rejected = results.find(result => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "TOO_MANY_REQUESTS" },
    });
    await expect(
      inspectPdfUpload(fixture("plain.pdf"))
    ).resolves.toBeUndefined();
  }, 10000);
  it("liefert verständliche unterschiedliche Ablehnungsgründe", async () => {
    await expect(
      inspectPdfUpload(fixture("extra-attachment.pdf"))
    ).rejects.toThrow("XML-E-Rechnung");
    await expect(inspectPdfUpload(fixture("encrypted.pdf"))).rejects.toThrow(
      "Passwortgeschützte"
    );
    await expect(
      inspectPdfUpload(fixture("dangerous-javascript.pdf"))
    ).rejects.toThrow("aktive");
  });
  it("packt den geprüften Parser ins Runtime-Image und prüft dort eine fiktive Rechnung", () => {
    const docker = readFileSync("Dockerfile", "utf8");
    expect(docker).toContain(
      "PDF_INSPECTOR_PYTHON=/opt/mycrewmate-pdf/bin/python"
    );
    expect(docker).toContain("pdf-inspector-requirements.txt");
    expect(docker).toContain(
      "scripts/inspect-invoice-pdf.py < /tmp/pdf-policy-fixture.pdf"
    );
    expect(docker).not.toContain("PokaleNRW134572");
    expect(
      readFileSync("scripts/pdf-inspector-requirements.txt", "utf8")
    ).toContain("pypdf==6.19.0");
  });
});
