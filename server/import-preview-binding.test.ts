import { describe, expect, it, vi } from "vitest";
import {
  createPreviewBinding,
  uploadedFileDigest,
  verifyPreviewBinding,
} from "./import-preview-binding";

const sourceDigest = uploadedFileDigest(
  Buffer.from("geprüfte Datei").toString("base64")
);
const currentDigest = "a".repeat(64);
const bindingInput = {
  sourceDigest,
  currentDigest,
  year: 2027,
  eventId: 44,
  operation: "project-file" as const,
  userId: 7,
};

describe("signierte Vorschau-Freigabe", () => {
  it("akzeptiert nur die exakt geprüfte Datei im selben Scope und für denselben Administrator", () => {
    const binding = createPreviewBinding(bindingInput);

    expect(() => verifyPreviewBinding(binding, bindingInput)).not.toThrow();
    expect(() =>
      verifyPreviewBinding(binding, {
        ...bindingInput,
        sourceDigest: uploadedFileDigest(
          Buffer.from("andere Datei").toString("base64")
        ),
      })
    ).toThrow("erneut prüfen");
    expect(() =>
      verifyPreviewBinding(binding, { ...bindingInput, userId: 8 })
    ).toThrow("erneut prüfen");
    expect(() =>
      verifyPreviewBinding(binding, {
        ...bindingInput,
        operation: "module:HELFER",
      })
    ).toThrow("erneut prüfen");
  });

  it("weist manipulierbare und abgelaufene Freigaben zurück", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T18:00:00.000Z"));
    const binding = createPreviewBinding(bindingInput);
    const [claims, signature] = binding.split(".");
    const tampered = `${claims.slice(0, -1)}x.${signature}`;

    expect(() => verifyPreviewBinding(tampered, bindingInput)).toThrow(
      "ungültig oder abgelaufen"
    );
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(() => verifyPreviewBinding(binding, bindingInput)).toThrow(
      "ungültig oder abgelaufen"
    );
    vi.useRealTimers();
  });
});
