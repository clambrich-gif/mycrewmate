import { describe, expect, it } from "vitest";
import {
  buildWhatsAppShareUrl,
  normalizeWhatsAppPhone,
  renderWhatsAppMessage,
} from "./whatsappShare";

describe("WhatsApp-Freigabe", () => {
  it("bereitet einen direkten WhatsApp-Chat für deutsche und internationale Helfernummern vor", () => {
    expect(normalizeWhatsAppPhone("0171 123 45 67")).toBe("491711234567");
    expect(normalizeWhatsAppPhone("+49 (171) 123-45-67")).toBe(
      "491711234567"
    );
    expect(normalizeWhatsAppPhone("0049 171 1234567")).toBe(
      "491711234567"
    );

    const url = new URL(
      buildWhatsAppShareUrl("Hallo Anna", "0171 123 45 67")
    );
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/491711234567");
    expect(url.searchParams.get("text")).toBe("Hallo Anna");
  });

  it("fällt ohne gespeicherte Helfernummer transparent auf den WhatsApp-Teilen-Dialog zurück", () => {
    const url = new URL(buildWhatsAppShareUrl("Hallo zusammen", null));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("text")).toBe("Hallo zusammen");
  });

  it("übernimmt Eventname und PDF-Link in die gespeicherte Nachrichtenvorlage", () => {
    expect(
      renderWhatsAppMessage(
        "Hallo {EVENT_NAME}! Dein Plan: {PDF_LINK}",
        "MyEifelRide 2027",
        "https://mycrewmate.de/p/Ab3dE9F_"
      )
    ).toBe(
      "Hallo MyEifelRide 2027! Dein Plan: https://mycrewmate.de/p/Ab3dE9F_"
    );
  });
});
