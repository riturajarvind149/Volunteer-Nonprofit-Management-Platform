const { config } = require('../config/env');
const logger = require('../utils/logger');
const { getTransport, explainError, isServerWideError } = require('./emailTransports');

/**
 * Transactional email delivery.
 *
 * - BREVO_API_KEY set: mail goes through Brevo's HTTPS API (works where SMTP ports are blocked).
 * - Otherwise SMTP_* configured: mail is sent via SMTP (Brevo, Gmail app password, SendGrid…).
 * - Neither (local development): mail is written to the log instead.
 * - In NODE_ENV=test mail is captured in-memory (see getOutbox) for assertions.
 *
 * Sending never throws to the caller: failures are logged so that a mail
 * outage can't break signups, registrations, etc.
 */

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
 * @param {{label: string, value: string}} [opts.code] - one-time code shown in a large box
 * @param {string} [opts.footer]
 */
const renderLayout = ({ heading, paragraphs = [], cta, code, footer }) => {
  const body =
    paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`).join('') +
    (code
      ? `<p style="margin:20px 0 6px;font-size:13px;color:#6b7280">${escapeHtml(code.label)}</p>
         <div style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;font-family:Consolas,Menlo,monospace;background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:12px 20px">${escapeHtml(code.value)}</div>`
      : '');
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

const renderText = ({ heading, paragraphs = [], cta, code }) =>
  [heading, '', ...paragraphs, code ? `\n${code.label}: ${code.value}` : '', cta ? `\n${cta.label}: ${cta.url}` : ''].join('\n');

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
const sendEmail = async ({ to, subject, heading, paragraphs, cta, code, footer, attachments }) => {
  if (!to) return { delivered: false };

  const mail = {
    from: config.smtp.from,
    to,
    subject,
    text: renderText({ heading, paragraphs, cta, code }),
    html: renderLayout({ heading, paragraphs, cta, code, footer }),
    attachments,
  };

  if (config.isTest) {
    testOutbox.push({ to, subject, text: mail.text, cta, code: code?.value, attachments });
    return { delivered: true, captured: true };
  }

  const transport = getTransport();
  if (!transport) {
    const devCode = config.isProduction ? undefined : code?.value;
    logger.info({ to, subject, link: cta?.url, code: devCode }, '[email] Email not configured — email logged instead of sent');
    return { delivered: false, logged: true };
  }

  try {
    await transport.send(mail);
    setStatus('ok');
    return { delivered: true };
  } catch (err) {
    // Only server-wide problems (login, connection, sender) mark email as broken;
    // a single rejected recipient address must not switch verification off for everyone.
    if (isServerWideError(err)) setStatus('failed', explainError(err));
    logger.error({ err: err.response || err.message, via: transport.label, to, subject }, `[email] Failed to send email. ${explainError(err)}`);
    // Local development only: print the link so testing can continue while email is misconfigured.
    if (!config.isProduction && (cta?.url || code)) {
      logger.warn({ to, link: cta?.url, code: code?.value }, '[email] (development) Link/code from the email that could not be sent');
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

const PLACEHOLDER_SENDER = /yourdomain\.org|example\.(com|org)|servehub\.local/i;

/**
 * Check the email setup once at startup and log a clear verdict, so a wrong
 * password shows up immediately instead of only when someone requests an email.
 * Never throws and never sends a message.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
const checkEmailSetup = async () => {
  if (config.isTest) return { ok: true, reason: 'test' };

  const transport = getTransport();
  if (!transport) {
    logger.warn('[email] Email is not configured — emails will be written to this log instead of being sent. Set BREVO_API_KEY (recommended on Render) or SMTP_HOST/SMTP_USER/SMTP_PASS, plus EMAIL_FROM.');
    if (config.requireEmailVerification) {
      logger.warn('[email] Email verification is switched OFF until email works, so new users are not locked out.');
    }
    setStatus('not_configured', 'Neither BREVO_API_KEY nor SMTP_HOST is set.');
    return { ok: false, reason: 'not-configured' };
  }

  if (PLACEHOLDER_SENDER.test(config.smtp.from)) {
    logger.warn({ from: config.smtp.from }, '[email] EMAIL_FROM still looks like a placeholder — set it to a sender address you have verified with your email provider, or messages will be rejected.');
  }

  try {
    await transport.verify();
    logger.info({ via: transport.label }, '[email] Email login OK — emails will be sent');
    setStatus('ok');
    return { ok: true };
  } catch (err) {
    const hint = explainError(err);
    logger.error({ via: transport.label, error: err.response || err.message }, `[email] Email check FAILED — emails will not be delivered. ${hint}`);
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
  if (!getTransport()) return false;
  return emailStatus.state !== 'failed';
};

/** Status for the admin console — no secrets, just the method, sender and the verdict. */
const getEmailStatus = () => {
  const transport = config.isTest ? null : getTransport();
  return {
    state: config.isTest ? 'ok' : !transport ? 'not_configured' : emailStatus.state,
    detail: emailStatus.detail,
    checked_at: emailStatus.checkedAt,
    host: transport ? transport.label : null,
    from: transport ? config.smtp.from : null,
    verification_required: config.requireEmailVerification && canDeliverEmail(),
  };
};

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
