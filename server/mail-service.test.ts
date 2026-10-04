import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getSmtpConfig,
  isMailDeliveryConfigured,
  renderContractAcceptanceEmail,
  renderInvitationEmail,
  renderProductExpiryReminderEmail,
  renderTenantAccessStatusEmail,
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

    expect(result.success).toBe(false);
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

  it("rendert eine klare Ablauf-Erinnerung mit Datumsangabe und Handlungsoption", () => {
    const rendered = renderProductExpiryReminderEmail({
      tenantName: "RSC Eifelland Mayen e. V.",
      packageName: "Event Pass",
      packageStatus: "test",
      endsOn: "2026-10-06",
      daysRemaining: 7,
    });

    expect(rendered.subject).toContain("Ihr Testzugang läuft in 7 Tagen ab");
    expect(rendered.subject).toContain("MyCrewMate");
    expect(rendered.text).toContain("RSC Eifelland Mayen e. V.");
    expect(rendered.text).toContain("Event Pass");
    expect(rendered.text).toContain("06.10.2026");
    expect(rendered.text).toContain("Planungsdaten bleiben selbstverständlich erhalten");
    expect(rendered.html).toContain("06.10.2026");
    expect(rendered.html).toContain("Testzugang");
  });

  it("weist bei der Vertragsbestätigung verständlich auf den beigefügten PDF-Nachweis hin", () => {
    const rendered = renderContractAcceptanceEmail({
      recipientName: "Max Muster",
      tenantName: "Musterverein e. V.",
      packageName: "Pro",
      acceptedAt: new Date("2026-10-02T18:00:00.000Z"),
      documents: [{ title: "AGB", version: "1.0-2026-10-01" }],
    });

    expect(rendered.subject).toContain("Vertragsunterlagen digital bestätigt");
    expect(rendered.text).toContain("als PDF beigefügt");
    expect(rendered.html).toContain("als PDF beigefügt");
  });

  it("informiert Vereinsadministratoren verständlich über Pausierung und Archivierung", () => {
    const paused = renderTenantAccessStatusEmail({
      recipientName: "Max Muster",
      tenantName: "Musterverein e. V.",
      packageName: "Pro",
      status: "paused",
    });
    const archived = renderTenantAccessStatusEmail({
      recipientName: "Max Muster",
      tenantName: "Musterverein e. V.",
      status: "archived",
    });

    expect(paused.subject).toContain("pausiert");
    expect(paused.text).toContain("Eine neue Anmeldung");
    expect(paused.html).toContain("Musterverein e. V.");
    expect(archived.subject).toContain("archiviert");
    expect(archived.text).toContain("dreijährigen Aufbewahrungsfrist");
    expect(archived.html).toContain("neue persönliche Zugänge");
  });
});
