export type EventPdfImageSettings = {
  pdfLogoKey: string | null;
};

export function resolveEventPdfLogoKey(event: EventPdfImageSettings) {
  return event.pdfLogoKey;
}
