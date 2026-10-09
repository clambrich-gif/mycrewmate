import { describe, expect, it } from "vitest";
import { pilotInquiryPhoneLink } from "../client/src/lib/pilot-inquiry-phone";

describe("pilotInquiryPhoneLink", () => {
  it("liefert bei einer freiwillig nicht angegebenen Telefonnummer keinen Link", () => {
    expect(pilotInquiryPhoneLink(null)).toBeNull();
    expect(pilotInquiryPhoneLink(undefined)).toBeNull();
    expect(pilotInquiryPhoneLink("   ")).toBeNull();
  });

  it("behält die lesbare Telefonnummer und erzeugt einen wählbaren Link", () => {
    expect(pilotInquiryPhoneLink("  +49 (0) 2651 / 12-34  ")).toEqual({
      label: "+49 (0) 2651 / 12-34",
      telHref: "tel:+49026511234",
    });
  });

  it("unterdrückt nicht sinnvoll wählbare Angaben", () => {
    expect(pilotInquiryPhoneLink("(---) / ...")).toBeNull();
  });
});
