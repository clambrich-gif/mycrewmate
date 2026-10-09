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
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
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
    return { success: false, simulated: true };
  }

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    replyTo: config.replyToEmail ? `"${config.fromName} Support" <${config.replyToEmail}>` : undefined,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  });

  const normalizedRecipient = options.to.trim().toLocaleLowerCase("de-DE");
  const acceptedBySmtp = (info.accepted ?? []).some(
    address => address.trim().toLocaleLowerCase("de-DE") === normalizedRecipient
  );

  return {
    // Der SMTP-Server bestätigt damit nur die Annahme. Die endgültige
    // Zustellung im Zielpostfach (z. B. Spamfilter) liegt außerhalb der App.
    success: acceptedBySmtp,
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

function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailSubjectLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function pilotStartLabel(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${match[1]}-${match[2]}-01T12:00:00.000Z`));
}

export function renderPilotInquiryNotificationEmail(params: {
  clubName: string;
  contactName: string;
  email: string;
  phone: string;
  occasion: string;
  desiredStart: string;
  note?: string;
}): { subject: string; text: string; html: string } {
  const subject = `Neue Pilot-Anfrage · ${emailSubjectLine(params.clubName)}`;
  const desiredStart = pilotStartLabel(params.desiredStart);
  const note = params.note?.trim() || "Keine weiteren Angaben.";
  const rows = [
    ["Verein oder Organisation", params.clubName],
    ["Ansprechperson", params.contactName],
    ["E-Mail", params.email],
    ["Telefon", params.phone],
    ["Testanlass", params.occasion],
    ["Gewünschter Start", desiredStart],
    ["Weitere Angaben", note],
  ] as const;
  const text = `Neue unverbindliche Pilot-Anfrage\n\n${rows
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")}\n\nBitte den Verein persönlich kontaktieren und Paket, Zeitraum und nächsten Schritt abstimmen.`;
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 12px 8px 0;color:#475569;font-size:13px;vertical-align:top;">${escapeEmailHtml(label)}</th><td style="padding:8px 0;color:#0f172a;font-size:14px;white-space:pre-wrap;">${escapeEmailHtml(value)}</td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeEmailHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">Neue Pilot-Anfrage</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">MyCrewMate · persönliche Pilotbegleitung</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${htmlRows}</table>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#475569;margin:0;">Bitte den Verein persönlich kontaktieren und Paket, Zeitraum und nächsten Schritt abstimmen.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

export function renderPilotInquiryConfirmationEmail(params: {
  contactName: string;
  clubName: string;
}): { subject: string; text: string; html: string } {
  const subject = "Ihre Pilot-Anfrage ist eingegangen · MyCrewMate";
  const contactName = params.contactName.trim();
  const clubName = params.clubName.trim();
  const text = `Hallo ${contactName},

vielen Dank, dass ${clubName} MyCrewMate im Pilotprogramm ausprobieren möchte.

Wir haben eure unverbindliche Anfrage erhalten und melden uns in Kürze persönlich bei euch. Gemeinsam stimmen wir Anlass, passende Umgebung und den gewünschten Startzeitpunkt ab.

Bis dahin müsst ihr nichts weiter vorbereiten. Es entsteht kein Vertrag und keine automatische Verlängerung.

Viele Grüße
Euer MyCrewMate-Team

Fragen? support@mycrewmate.de`;
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">Vielen Dank für eure Pilot-Anfrage.</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">MyCrewMate · Vereins- &amp; Eventplanung</p>
    <p>Hallo <strong>${escapeEmailHtml(contactName)}</strong>,</p>
    <p>vielen Dank, dass <strong>${escapeEmailHtml(clubName)}</strong> MyCrewMate im Pilotprogramm ausprobieren möchte.</p>
    <div style="margin:24px 0;padding:16px 18px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;">
      <strong>Wie geht es weiter?</strong><br>Wir melden uns in Kürze persönlich bei euch. Gemeinsam stimmen wir Anlass, passende Umgebung und den gewünschten Startzeitpunkt ab.
    </div>
    <p>Bis dahin müsst ihr nichts weiter vorbereiten. Es entsteht kein Vertrag und keine automatische Verlängerung.</p>
    <p>Viele Grüße<br><strong>Euer MyCrewMate-Team</strong></p>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">Fragen? Antworte einfach auf diese E-Mail oder schreibe an <a href="mailto:support@mycrewmate.de" style="color:#2563eb;">support@mycrewmate.de</a>.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

/** Nachweis-Mail nach elektronischer Annahme von AGB, AVV und Datenschutz. */
export function renderContractAcceptanceEmail(params: {
  recipientName: string;
  tenantName: string;
  packageName: string;
  acceptedAt: Date;
  documents: Array<{ title: string; version: string }>;
}): { subject: string; text: string; html: string } {
  const acceptedAt = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(params.acceptedAt);
  const documents = params.documents
    .map(document => `- ${document.title} (Version ${document.version})`)
    .join("\n");
  const subject = `Vertragsunterlagen digital bestätigt · ${params.tenantName} · MyCrewMate`;
  const text = `Hallo ${params.recipientName},

für ${params.tenantName} wurden am ${acceptedAt} die folgenden Vertragsunterlagen für das Paket ${params.packageName} elektronisch bestätigt:

${documents}

Der digitale Vertragsnachweis mit Verein, Zeitpunkt, Dokumentversionen und Prüfsummen ist dieser E-Mail als PDF beigefügt. Diese E-Mail dient als Zustell- und Informationsnachweis.

Bei Fragen erreichen Sie uns unter info@mycrewmate.de.

Freundliche Grüße
MyCrewMate`;
  const documentList = params.documents
    .map(document => `<li>${document.title} <span style="color:#64748b;">(Version ${document.version})</span></li>`)
    .join("");
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">MyCrewMate</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">Digitaler Vertragsnachweis</p>
    <p>Hallo <strong>${params.recipientName}</strong>,</p>
    <p>für <strong>${params.tenantName}</strong> wurden am <strong>${acceptedAt}</strong> die folgenden Unterlagen für das Paket <strong>${params.packageName}</strong> elektronisch bestätigt:</p>
    <ul style="padding-left:20px;">${documentList}</ul>
    <p style="font-size:13px;color:#475569;">Der digitale Vertragsnachweis mit Verein, Zeitpunkt, Dokumentversionen und Prüfsummen ist dieser E-Mail als PDF beigefügt. Diese E-Mail dient als Zustell- und Informationsnachweis.</p>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">Fragen? info@mycrewmate.de</p>
  </div>
</body></html>`;
  return { subject, text, html };
}

/** Inhaltliche, transaktionale Erinnerung an den hinterlegten Vereinskontakt. */
export function renderProductExpiryReminderEmail(params: {
  tenantName: string;
  packageName: string;
  packageStatus: "test" | "active";
  endsOn: string;
  daysRemaining: number;
}): { subject: string; text: string; html: string } {
  const expiryDate = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${params.endsOn}T12:00:00Z`));
  const isTest = params.packageStatus === "test";
  const accessLabel = isTest ? "Testzugang" : "Paket";
  const dayLabel = params.daysRemaining === 0 ? "heute" : `in ${params.daysRemaining} Tagen`;
  const subject = `${isTest ? "Ihr Testzugang" : "Ihr MyCrewMate-Paket"} läuft ${dayLabel} ab · MyCrewMate`;
  const text = `Hallo,

der ${accessLabel.toLocaleLowerCase("de-DE")} für ${params.tenantName} (${params.packageName}) läuft am ${expiryDate} ab.

Ihre Planungsdaten bleiben selbstverständlich erhalten. Wenn Sie MyCrewMate danach weiter nutzen möchten, melden Sie sich bitte rechtzeitig beim MyCrewMate-Team.

Bei Fragen antworten Sie einfach auf diese E-Mail.

Freundliche Grüße
Ihr MyCrewMate-Team`;
  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">MyCrewMate</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">Vereins- &amp; Eventplanung</p>
    <p>Hallo,</p>
    <p>der <strong>${accessLabel.toLocaleLowerCase("de-DE")}</strong> für <strong>${params.tenantName}</strong> (${params.packageName}) läuft am <strong>${expiryDate}</strong> ab.</p>
    <div style="margin:24px 0;padding:16px 18px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;">
      <strong>Hinweis:</strong> Ihre Planungsdaten bleiben erhalten. Wenn Sie MyCrewMate weiter nutzen möchten, melden Sie sich bitte rechtzeitig beim MyCrewMate-Team.
    </div>
    <p style="font-size:13px;color:#475569;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">MyCrewMate · Vereins- &amp; Eventplanung</p>
  </div>
</body>
</html>`;
  return { subject, text, html };
}

/** Verständliche Information an alle hinterlegten Vereinsadministratoren. */
export function renderTenantAccessStatusEmail(params: {
  recipientName: string;
  tenantName: string;
  status: "paused" | "archived";
  packageName?: string;
}): { subject: string; text: string; html: string } {
  const isArchived = params.status === "archived";
  const subject = isArchived
    ? `Vereinszugang archiviert · ${params.tenantName} · MyCrewMate`
    : `Vereinszugang pausiert · ${params.tenantName} · MyCrewMate`;
  const action = isArchived ? "archiviert" : "vorübergehend pausiert";
  const packageHint = params.packageName ? ` für das Paket ${params.packageName}` : "";
  const body = isArchived
    ? `Der Vereinszugang für ${params.tenantName} wurde ${action}. Die bisherigen persönlichen Zugänge und Einladungen sind damit deaktiviert.

Die Veranstaltungs- und Planungsdaten bleiben erhalten. Der Verein kann innerhalb der regulären dreijährigen Aufbewahrungsfrist durch die Plattformverwaltung wieder aktiviert werden; anschließend werden neue persönliche Zugänge vergeben und die vorhandenen Daten können weiterverwendet werden.`
    : `Der Vereinszugang für ${params.tenantName}${packageHint} wurde ${action}. Eine neue Anmeldung und die Nutzung der Planung sind im Moment nicht möglich.

Die Veranstaltungs- und Planungsdaten bleiben unverändert erhalten. Sobald die Plattformverwaltung den Zugang wieder aktiviert, ist die Nutzung wieder möglich.`;
  const actionTitle = isArchived ? "Zugang archiviert" : "Zugang pausiert";
  const accent = isArchived ? "#475569" : "#9a3412";
  const background = isArchived ? "#f1f5f9" : "#fff7ed";
  const border = isArchived ? "#cbd5e1" : "#fed7aa";
  const htmlBody = isArchived
    ? `Der Vereinszugang für <strong>${params.tenantName}</strong> wurde archiviert. Die bisherigen persönlichen Zugänge und Einladungen sind damit deaktiviert.<br><br>Die Veranstaltungs- und Planungsdaten bleiben erhalten. Der Verein kann innerhalb der regulären dreijährigen Aufbewahrungsfrist durch die Plattformverwaltung wieder aktiviert werden; anschließend werden neue persönliche Zugänge vergeben und die vorhandenen Daten können weiterverwendet werden.`
    : `Der Vereinszugang für <strong>${params.tenantName}</strong>${params.packageName ? ` für das Paket <strong>${params.packageName}</strong>` : ""} wurde vorübergehend pausiert. Eine neue Anmeldung und die Nutzung der Planung sind im Moment nicht möglich.<br><br>Die Veranstaltungs- und Planungsdaten bleiben unverändert erhalten. Sobald die Plattformverwaltung den Zugang wieder aktiviert, ist die Nutzung wieder möglich.`;
  const text = `Hallo ${params.recipientName},

${body}

Bei Fragen antworten Sie einfach auf diese E-Mail.

Freundliche Grüße
Ihr MyCrewMate-Team`;
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">MyCrewMate</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">Vereins- &amp; Eventplanung</p>
    <p>Hallo <strong>${params.recipientName}</strong>,</p>
    <div style="margin:24px 0;padding:16px 18px;border-radius:10px;background:${background};border:1px solid ${border};color:${accent};">
      <strong>${actionTitle}</strong><br>${htmlBody}
    </div>
    <p style="font-size:13px;color:#475569;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">MyCrewMate · Vereins- &amp; Eventplanung</p>
  </div>
</body></html>`;
  return { subject, text, html };
}

/** Ein neutraler, nur einmal nutzbarer Link für den Masterzugang. */
export function renderMasterPasswordResetEmail(params: {
  resetUrl: string;
  expiresInMinutes: number;
}): { subject: string; text: string; html: string } {
  const subject = "Master-Passwort zurücksetzen · MyCrewMate";
  const text = `Hallo,

für das MyCrewMate-Masterportal wurde ein Passwort-Reset angefordert.

Über diesen einmal gültigen Link können Sie ein neues Master-Passwort festlegen:
${params.resetUrl}

Der Link ist ${params.expiresInMinutes} Minuten gültig. Nach dem erfolgreichen Reset werden aus Sicherheitsgründen alle bestehenden MyCrewMate-Sitzungen abgemeldet.

Falls Sie den Reset nicht angefordert haben, verwenden Sie den Link nicht und informieren Sie bitte umgehend support@mycrewmate.de.

MyCrewMate · Vereins- & Eventplanung`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">MyCrewMate</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">Sicherheitsmeldung zum Masterportal</p>
    <p>Für das Masterportal wurde ein Passwort-Reset angefordert.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${params.resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Neues Master-Passwort festlegen</a>
    </p>
    <p style="font-size:13px;color:#475569;">Dieser Link ist <strong>${params.expiresInMinutes} Minuten</strong> gültig und kann nur einmal verwendet werden. Nach dem Reset werden alle bestehenden MyCrewMate-Sitzungen sicher abgemeldet.</p>
    <p style="font-size:12px;color:#64748b;word-break:break-all;">Falls der Button nicht funktioniert:<br><a href="${params.resetUrl}" style="color:#2563eb;">${params.resetUrl}</a></p>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">War diese Anfrage nicht von Ihnen? Verwenden Sie den Link nicht und informieren Sie bitte <a href="mailto:support@mycrewmate.de" style="color:#2563eb;">support@mycrewmate.de</a>.</p>
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

/** Benachrichtigt ausschließlich zuständige Ansprechpartner über einen freigegebenen Plan. */
export function renderPlanReleaseContactEmail(params: {
  recipientName: string;
  eventName: string;
  helperOverviewUrl: string;
  kind: "released" | "changed";
}): { subject: string; text: string; html: string } {
  const changed = params.kind === "changed";
  const subject = changed
    ? `Einsatzplan für die Veranstaltung ${params.eventName} geändert – bitte Helfer prüfen`
    : `Einsatzplan für die Veranstaltung ${params.eventName} steht – bitte Helfer informieren`;
  const headline = changed
    ? `Der Einsatzplan für die Veranstaltung ${params.eventName} wurde geändert`
    : `Der Einsatzplan für die Veranstaltung ${params.eventName} steht`;
  const body = changed
    ? "Bei mindestens einem deiner zugeordneten Helfer hat sich eine Einteilung geändert. Bitte prüfe deine Helferübersicht und informiere nur die betroffenen Personen erneut."
    : "Für mindestens einen deiner zugeordneten Helfer liegt jetzt eine Einteilung vor. Bitte öffne deine Helferübersicht und informiere deine Helfer über die bestehende zweite WhatsApp-Vorlage oder persönlich.";
  const helperOverviewUrlHtml = params.helperOverviewUrl.replace(/&/g, "&amp;");
  const text = `Hallo ${params.recipientName},\n\n${headline}.\n\n${body}\n\nÖffne deine persönliche Helferübersicht:\n${params.helperOverviewUrl}\n\nFreundliche Grüße\nDein Planungsteam über MyCrewMate`;
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px;">MyCrewMate</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">Helferkoordination</p>
    <p>Hallo <strong>${params.recipientName}</strong>,</p>
    <div style="margin:22px 0;padding:16px 18px;border-radius:10px;background:${changed ? "#fff7ed" : "#eff6ff"};border:1px solid ${changed ? "#fed7aa" : "#bfdbfe"};">
      <strong>${headline}</strong><br>${body}
    </div>
    <p style="text-align:center;margin:28px 0;"><a href="${helperOverviewUrlHtml}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;">Meine Helferübersicht öffnen</a></p>
    <p style="font-size:12px;color:#64748b;word-break:break-all;">Falls der Button nicht funktioniert: <a href="${helperOverviewUrlHtml}" style="color:#2563eb;">${helperOverviewUrlHtml}</a></p>
  </div>
</body></html>`;
  return { subject, text, html };
}
