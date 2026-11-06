import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KLEMMI_AUDIO_SCRIPTS, KLEMMI_AUDIO_VOICE_MANIFEST, klemmiAudioUrl } from "../client/src/lib/klemmiAudio";

const ids = ["preparation-documents", "postprocessing-documents", "finances-receipts"] as const;
const shortText = "Belege und Dokumente gibt es ab Pro. Je nach Berechtigung kannst du sie hochladen, anschauen oder bearbeiten.";

describe("Kurze Klemmi-Anhangshinweise ab Pro", () => {
  it.each(ids)("erklärt %s ohne ausführliche persönliche Rechtematrix", id => {
    expect(KLEMMI_AUDIO_SCRIPTS[id]).toBe(shortText);
    expect(KLEMMI_AUDIO_SCRIPTS[id].split(/\s+/).length).toBeLessThan(25);
    expect(KLEMMI_AUDIO_SCRIPTS[id]).not.toMatch(/Bereichsschreiber|Finanzschreiber|Aufgabenverantwortliche|Bezahlt von|ZIP/);
    expect(KLEMMI_AUDIO_VOICE_MANIFEST[id].voice).toBe("Klemmi-Stimme");
    expect(klemmiAudioUrl(id)).toContain("20261106-attachments-pro-short-v2");
  });

  it("verwendet in allen drei Bereichen dieselbe geprüfte Aufnahme ohne Stimmenwechsel", async () => {
    const files = await Promise.all(ids.map(id => readFile(path.resolve("server/assets/klemmi-voice", `${id}.mp3`))));
    for (const file of files) {
      expect(file.byteLength).toBeGreaterThan(1_000);
      expect(file.equals(files[0])).toBe(true);
    }
  });
});
