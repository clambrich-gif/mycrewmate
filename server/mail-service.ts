import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
}

let cachedTransporter: Transporter | null = null;

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST || "mail.your-server.de";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "MyCrewMate";
  const fromEmail = process.env.SMTP_FROM_EMAIL || "info@mycrewmate.de";
  const replyToEmail = process.env.SMTP_REPLY_TO_EMAIL || "support@mycrewmate.de";

  if (!user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    fromName,
    fromEmail,
    replyToEmail,
  };
}

export function isMailDeliveryConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export function getMailTransporter(): Transporter | null {
  const config = getSmtpConfig();
  if (!config) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }
  return cachedTransporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendTransactionalEmail(options: SendMailOptions): Promise<{
  success: boolean;
  messageId?: string;
  simulated?: boolean;
}> {
  const config = getSmtpConfig();
  const transporter = getMailTransporter();

  if (!config || !transporter) {
    console.info(
      `[MailService:Simuliert] E-Mail an ${options.to} mit Betreff "${options.subject}" aufgezeichnet (SMTP nicht konfiguriert).`
    );
    return { success: true, simulated: true };
  }

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    replyTo: config.replyToEmail ? `"${config.fromName} Support" <${config.replyToEmail}>` : undefined,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  return {
    success: true,
    messageId: info.messageId,
    simulated: false,
  };
}

export function renderInvitationEmail(params: {
  recipientName: string;
  tenantName: string;
  invitationUrl: string;
  expiresInHours: number;
}): { subject: string; text: string; html: string } {
  const subject = `Einladung zur Vereinsplanung für ${params.tenantName} · MyCrewMate`;
  const text = `Hallo ${params.recipientName},

Sie wurden als Administrator für ${params.tenantName} bei MyCrewMate eingeladen.

Über den folgenden Link können Sie Ihr persönliches Passwort festlegen und die Vereinsplanung öffnen:
${params.invitationUrl}

Dieser Einladungslink ist ${params.expiresInHours} Stunden lang gültig und kann nur einmal verwendet werden.

Bei Fragen erreichen Sie das MyCrewMate-Team jederzeit unter support@mycrewmate.de.

Mit freundlichen Grüßen
Ihr MyCrewMate-Team`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">MyCrewMate</h1>
      <p style="font-size: 13px; color: #64748b; margin: 0;">Vereins- & Eventplanung</p>
    </div>
    
    <p style="margin-top: 0;">Hallo <strong>${params.recipientName}</strong>,</p>
    <p>Sie wurden als Administrator für <strong>${params.tenantName}</strong> bei MyCrewMate eingeladen.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${params.invitationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
        Zugang einrichten & Passwort wählen
      </a>
    </div>
    
    <p style="font-size: 12px; color: #64748b;">
      Alternativ können Sie diesen Link in Ihren Browser kopieren:<br>
      <a href="${params.invitationUrl}" style="color: #2563eb; word-break: break-all;">${params.invitationUrl}</a>
    </p>
    
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    
    <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
      Dieser Link ist ${params.expiresInHours} Stunden gültig und verfällt nach einmaliger Nutzung. Bei Fragen antworten Sie einfach auf diese E-Mail oder kontaktieren Sie <a href="mailto:support@mycrewmate.de" style="color: #2563eb;">support@mycrewmate.de</a>.
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

export function renderPlanningTeamInvitationEmail(params: {
  recipientName: string;
  tenantName: string;
  invitationUrl: string;
  modulesSummary: string;
  expiresInHours: number;
}): { subject: string; text: string; html: string } {
  const subject = `Dein persönlicher Zugang zur Planung für ${params.tenantName} · MyCrewMate`;
  const text = `Hallo ${params.recipientName},

für dich wurde ein persönlicher Zugang zum Planungsteam von ${params.tenantName} freigeschaltet.

Freigeschaltete Bereiche:
${params.modulesSummary}

Über den folgenden Link kannst du dein persönliches Passwort festlegen und direkt mit der Planung starten:
${params.invitationUrl}

Dieser Link ist ${params.expiresInHours} Stunden lang gültig und kann nur einmal verwendet werden.

Viele Grüße
Dein Planungsteam von ${params.tenantName} über MyCrewMate`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff;">
        <h1 style="font-size: 20px; font-weight: 700; margin: 0;">MyCrewMate</h1>
        <p style="font-size: 13px; color: #bfdbfe; margin: 4px 0 0 0;">Planungsteam-Zugang</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">Hallo <strong>${params.recipientName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
          für dich wurde ein persönlicher Zugang zum Planungsteam von <strong>${params.tenantName}</strong> freigeschaltet.
        </p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px 0;">
          <p style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 4px 0;">Deine freigeschalteten Arbeitsbereiche:</p>
          <p style="font-size: 13px; color: #1e293b; margin: 0;">${params.modulesSummary}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.invitationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
            Persönliches Passwort festlegen &amp; loslegen
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0;">
          Dieser Link ist <strong>${params.expiresInHours} Stunden</strong> lang gültig und kann nur einmal verwendet werden.
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0; word-break: break-all;">
          Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>${params.invitationUrl}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        MyCrewMate · Vereins- &amp; Eventplanung
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
