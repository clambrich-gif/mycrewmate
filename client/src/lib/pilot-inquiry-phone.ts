export type PilotInquiryPhoneLink = {
  label: string;
  telHref: string;
};

/**
 * Bereitet eine freiwillige Rückrufnummer für die geschützte Pilotübersicht vor.
 * Leere oder nicht sinnvoll wählbare Angaben bleiben bewusst ohne Telefonlink.
 */
export function pilotInquiryPhoneLink(
  phone: string | null | undefined
): PilotInquiryPhoneLink | null {
  const label = phone?.trim() ?? "";
  if (!label) return null;

  const dialValue = label.replace(/[^+0-9]/g, "");
  if (!dialValue) return null;

  return {
    label,
    telHref: `tel:${dialValue}`,
  };
}
