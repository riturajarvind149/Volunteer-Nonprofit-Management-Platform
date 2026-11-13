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
    return { delivered: true };
  } catch (err) {
    logger.error({ err: err.message, to, subject }, '[email] Failed to send email');
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

module.exports = {
  sendEmail,
  queueEmail,
  escapeHtml,
  getOutbox,
  clearOutbox,
};
