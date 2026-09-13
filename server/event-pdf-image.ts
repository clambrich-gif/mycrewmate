import { RSC_BRAND_LOGO } from "./brand-assets";

export type EventPdfImageSettings = {
  pdfLogoKey: string | null;
  pdfLogoFallback: "none" | "brand";
};

export function resolveEventPdfLogoKey(event: EventPdfImageSettings) {
  return (
    event.pdfLogoKey ??
    (event.pdfLogoFallback === "brand" ? RSC_BRAND_LOGO.storageKey : null)
  );
}
