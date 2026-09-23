import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getSmtpConfig,
  isMailDeliveryConfigured,
  renderInvitationEmail,
  sendTransactionalEmail,
} from "./mail-service";

describe("Mail-Service (Hetzner SMTP & Transactional)", () => {
  beforeEach(() => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
  });

  it("erkennt unkonfiguriertes SMTP und fällt auf Simulation zurück", async () => {
    expect(isMailDeliveryConfigured()).toBe(false);
    expect(getSmtpConfig()).toBeNull();

    const result = await sendTransactionalEmail({
      to: "test@verein.de",
      subject: "Test-Betreff",
      text: "Test-Text",
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
  });

  it("liest die Hetzner-Standardkonfiguration bei gesetzten Zugangsdaten", () => {
    process.env.SMTP_USER = "info@mycrewmate.de";
    process.env.SMTP_PASS = "Geheim123!";

    const config = getSmtpConfig();
    expect(config).not.toBeNull();
    expect(config?.host).toBe("mail.your-server.de");
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
    expect(config?.user).toBe("info@mycrewmate.de");
    expect(config?.fromEmail).toBe("info@mycrewmate.de");
    expect(config?.replyToEmail).toBe("support@mycrewmate.de");
  });

  it("rendert eine ansprechende und sichere Einladungs-E-Mail", () => {
    const rendered = renderInvitationEmail({
      recipientName: "Max Mustermann",
      tenantName: "RSC Eifelland Mayen e. V.",
      invitationUrl: "https://app.mycrewmate.de/invite?token=abc-123",
      expiresInHours: 48,
    });

    expect(rendered.subject).toContain("RSC Eifelland Mayen e. V.");
    expect(rendered.subject).toContain("MyCrewMate");
    expect(rendered.text).toContain("Max Mustermann");
    expect(rendered.text).toContain("https://app.mycrewmate.de/invite?token=abc-123");
    expect(rendered.text).toContain("support@mycrewmate.de");
    expect(rendered.html).toContain("Zugang einrichten & Passwort wählen");
    expect(rendered.html).toContain("48 Stunden");
  });
});
