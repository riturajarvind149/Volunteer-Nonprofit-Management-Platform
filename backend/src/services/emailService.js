const nodemailer = require('nodemailer');
const { config } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Transactional email delivery.
 *
 * - With SMTP_* configured, mail is sent via SMTP (works with SendGrid, Resend,
 *   Mailgun, Amazon SES, Gmail app passwords, Brevo...).
 * - Without SMTP (local development), mail is written to the log instead.
 * - In NODE_ENV=test mail is captured in-memory (see getOutbox) for assertions.
 *
 * Sending never throws to the caller: failures are logged so that a mail
 * outage can't break signups, registrations, etc.
 */

let transporter = null;
const testOutbox = [];

/**
 * Latest known delivery status, updated by the startup check and by every send.
 * state: 'unknown' (not checked yet) | 'ok' | 'not_configured' | 'failed'
 */
const emailStatus = { state: 'unknown', detail: null, checkedAt: null };
const setStatus = (state, detail = null) => {
  emailStatus.state = state;
  emailStatus.detail = detail;
  emailStatus.checkedAt = new Date().toISOString();
};

const getTransporter = () => {
  if (transporter) return transporter;
  if (!config.smtp.host) return null;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    pool: true,
    maxConnections: 3,
  });
  return transporter;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Wrap content in a simple, client-safe HTML layout.
 * @param {Object} opts
 * @param {string} opts.heading
 * @param {string[]} opts.paragraphs - plain text paragraphs (escaped)
 * @param {{label: string, url: string}} [opts.cta]
 * @param {string} [opts.footer]
 */
const renderLayout = ({ heading, paragraphs = [], cta, footer }) => {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#6b7280;word-break:break-all">If the button doesn't work, copy this link: ${escapeHtml(cta.url)}</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
  <div style="font-weight:700;color:#2563eb;font-size:18px;margin-bottom:20px">${escapeHtml(config.appName)}</div>
  <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(heading)}</h1>
  ${body}${button}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
  <p style="font-size:12px;color:#6b7280;margin:0">${escapeHtml(footer || `You are receiving this email because you have an account on ${config.appName}.`)}</p>
  </td></tr></table></td></tr></table></body></html>`;
};

const renderText = ({ heading, paragraphs = [], cta }) =>
  [heading, '', ...paragraphs, cta ? `\n${cta.label}: ${cta.url}` : ''].join('\n');

/**
 * Send an email. Never throws.
 * @param {Object} message
 * @param {string} message.to
 * @param {string} message.subject
 * @param {string} message.heading
 * @param {string[]} [message.paragraphs]
 * @param {{label: string, url: string}} [message.cta]
 * @param {Array} [message.attachments] - nodemailer attachments
 */
const sendEmail = async ({ to, subject, heading, paragraphs, cta, footer, attachments }) => {
  if (!to) return { delivered: false };

  const mail = {
    from: config.smtp.from,
    to,
    subject,
    text: renderText({ heading, paragraphs, cta }),
    html: renderLayout({ heading, paragraphs, cta, footer }),
    attachments,
  };

  if (config.isTest) {
    testOutbox.push({ to, subject, text: mail.text, cta, attachments });
    return { delivered: true, captured: true };
  }

  const transport = getTransporter();
  if (!transport) {
    logger.info({ to, subject, link: cta?.url }, '[email] SMTP not configured — email logged instead of sent');
    return { delivered: false, logged: true };
  }

  try {
    await transport.sendMail(mail);
    setStatus('ok');
    return { delivered: true };
  } catch (err) {
    // Only server-wide problems (login, connection) mark email as broken;
    // a single rejected recipient address must not switch verification off for everyone.
    if (isServerWideError(err)) setStatus('failed', explainSmtpError(err));
    logger.error({ err: err.response || err.message, to, subject }, `[email] Failed to send email. ${explainSmtpError(err)}`);
    // Local development only: print the link so testing can continue while email is misconfigured.
    if (!config.isProduction && cta?.url) {
      logger.warn({ to, link: cta.url }, '[email] (development) Link from the email that could not be sent');
    }
    return { delivered: false, error: err.message };
  }
};

/** Fire-and-forget helper for non-critical mail. */
const queueEmail = (message) => {
  setImmediate(() => {
    sendEmail(message).catch(() => {});
  });
};

const getOutbox = () => testOutbox;
const clearOutbox = () => {
  testOutbox.length = 0;
};

/** Plain-language hints for the SMTP errors people hit most often. */
const explainSmtpError = (err) => {
  const text = `${err.responseCode || ''} ${err.response || ''} ${err.code || ''} ${err.message || ''}`;
  if (/535|EAUTH|authentication/i.test(text)) {
    return 'The mail server rejected SMTP_USER / SMTP_PASS. Use the SMTP *login* your provider shows (Brevo: "Login" on the SMTP page, e.g. 123abc@smtp-brevo.com; Gmail: your address + an App Password).';
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return 'SMTP_HOST could not be found. Check the host name for typos.';
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET/i.test(text)) {
    return 'Could not connect to the mail server. Check SMTP_PORT/SMTP_SECURE (587 + false, or 465 + true) and that your network allows outgoing mail.';
  }
  return 'Check the SMTP_* settings in your environment.';
};

const isServerWideError = (err) =>
  /535|EAUTH|authentication|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNECTION/i.test(
    `${err.responseCode || ''} ${err.response || ''} ${err.code || ''} ${err.message || ''}`
  );

const PLACEHOLDER_SENDER = /yourdomain\.org|example\.(com|org)|servehub\.local/i;

/**
 * Check the email setup once at startup and log a clear verdict, so a wrong
 * password shows up immediately instead of only when someone requests an email.
 * Never throws and never sends a message.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
const checkEmailSetup = async () => {
  if (config.isTest) return { ok: true, reason: 'test' };

  const transport = getTransporter();
  if (!transport) {
    logger.warn('[email] SMTP is not configured — emails will be written to this log instead of being sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM to send real email.');
    if (config.requireEmailVerification) {
      logger.warn('[email] Email verification is switched OFF until email works, so new users are not locked out.');
    }
    setStatus('not_configured', 'SMTP_HOST is not set.');
    return { ok: false, reason: 'not-configured' };
  }

  if (PLACEHOLDER_SENDER.test(config.smtp.from)) {
    logger.warn({ from: config.smtp.from }, '[email] EMAIL_FROM still looks like a placeholder — set it to a sender address you have verified with your email provider, or messages will be rejected.');
  }

  try {
    await transport.verify();
    logger.info({ host: config.smtp.host }, '[email] SMTP login OK — emails will be sent');
    setStatus('ok');
    return { ok: true };
  } catch (err) {
    const hint = explainSmtpError(err);
    logger.error({ host: config.smtp.host, error: err.response || err.message }, `[email] SMTP check FAILED — emails will not be delivered. ${hint}`);
    if (config.requireEmailVerification) {
      logger.warn('[email] Email verification is switched OFF until email works, so new users are not locked out.');
    }
    setStatus('failed', hint);
    return { ok: false, reason: hint };
  }
};

/**
 * Whether the platform can currently deliver email. Unknown counts as yes
 * (startup check still running); tests capture mail in memory, so always yes.
 */
const canDeliverEmail = () => {
  if (config.isTest) return true;
  if (!config.smtp.host) return false;
  return emailStatus.state !== 'failed';
};

/** Status for the admin console — no secrets, just host, sender and the verdict. */
const getEmailStatus = () => ({
  state: config.isTest ? 'ok' : !config.smtp.host ? 'not_configured' : emailStatus.state,
  detail: emailStatus.detail,
  checked_at: emailStatus.checkedAt,
  host: config.smtp.host || null,
  from: config.smtp.host ? config.smtp.from : null,
  verification_required: config.requireEmailVerification && canDeliverEmail(),
});

module.exports = {
  checkEmailSetup,
  canDeliverEmail,
  getEmailStatus,
  sendEmail,
  queueEmail,
  escapeHtml,
  getOutbox,
  clearOutbox,
};
