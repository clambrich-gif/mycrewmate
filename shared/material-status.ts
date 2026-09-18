export const MATERIAL_STATUSES = ["offen", "bestellt", "geliefert"] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  offen: "🔴 Offen",
  bestellt: "🟡 Bestellt",
  geliefert: "🟢 Geliefert",
};

export const MATERIAL_STATUS_TEXT: Record<MaterialStatus, string> = {
  offen: "Offen",
  bestellt: "Bestellt",
  geliefert: "Geliefert",
};

/**
 * Akzeptiert sowohl den neuen dreistufigen Materialstand als auch historische
 * Ja/Nein-Werte aus älteren Projekt- und Excel-Dateien.
 */
export function normalizeMaterialStatus(value: unknown): MaterialStatus {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("de-DE");

  if (
    value === true ||
    normalized === "ja" ||
    normalized === "true" ||
    normalized === "geliefert"
  ) {
    return "geliefert";
  }
  if (normalized === "bestellt") return "bestellt";
  return "offen";
}

export function materialStatusLabel(value: unknown): string {
  return MATERIAL_STATUS_LABELS[normalizeMaterialStatus(value)];
}

/** Für PDF- und Textausgaben ohne Emoji-fähige Schriftart. */
export function materialStatusText(value: unknown): string {
  return MATERIAL_STATUS_TEXT[normalizeMaterialStatus(value)];
}
