const nodemailer = require('nodemailer');
const { config } = require('../config/env');

/**
 * Ways of delivering email. Each transport exposes the same shape:
 *   { kind, label, send(mail) -> Promise, verify() -> Promise }
 * `mail` is { from, to, subject, text, html, attachments }.
 *
 *  - Brevo HTTPS API (BREVO_API_KEY): uses port 443, so it works on hosts that block
 *    SMTP ports — e.g. Render's free plan blocks 25/465/587 since Sept 2025.
 *  - SMTP (SMTP_HOST + SMTP_USER/SMTP_PASS): any provider; fine for local development
 *    and paid hosting plans.
 */

const BREVO_API = 'https://api.brevo.com/v3';
const REQUEST_TIMEOUT_MS = 15000;

/** "ServeHub <a@b.org>" → { name: 'ServeHub', email: 'a@b.org' } */
const parseAddress = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim() || undefined, email: match[2].trim() };
  return { email: text };
};

/** Error carrying a nodemailer-like `code` so callers can classify it uniformly. */
const transportError = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });

const brevoRequest = async (path, { method = 'GET', body } = {}) => {
  let res;
  try {
    res = await fetch(`${BREVO_API}${path}`, {
      method,
      headers: {
        'api-key': config.brevoApiKey,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw transportError(`Could not reach the Brevo API: ${err.message}`, err.name === 'TimeoutError' ? 'ETIMEDOUT' : 'ECONNECTION');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  const message = data.message || `Brevo API responded with HTTP ${res.status}`;
  if (res.status === 401 || res.status === 403) {
    // Brevo also uses 401 when the request comes from an IP address that isn't authorised.
    throw transportError(message, /\bip\b/i.test(message) ? 'EIPBLOCKED' : 'EAUTH', { response: message });
  }
  if (res.status === 400 && /sender/i.test(message)) throw transportError(message, 'ESENDER', { response: message });
  throw transportError(message, 'EAPI', { response: message, responseCode: res.status });
};

const createBrevoApiTransport = () => ({
  kind: 'brevo-api',
  label: 'Brevo API (HTTPS)',
  async verify() {
    // Reads account details; never sends anything.
    await brevoRequest('/account');
  },
  async send(mail) {
    const sender = parseAddress(mail.from);
    await brevoRequest('/smtp/email', {
      method: 'POST',
      body: {
        sender,
        to: [parseAddress(mail.to)],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
        attachment: (mail.attachments || []).length
          ? mail.attachments.map((a) => ({
              name: a.filename,
              content: Buffer.from(a.content).toString('base64'),
            }))
          : undefined,
      },
    });
  },
});

const createSmtpTransport = () => {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    pool: true,
    maxConnections: 3,
    // Fail fast when a host blocks SMTP ports instead of hanging for minutes.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return {
    kind: 'smtp',
    label: `SMTP ${config.smtp.host}:${config.smtp.port}`,
    verify: () => transporter.verify(),
    send: (mail) => transporter.sendMail(mail),
  };
};

let cached = null;

/** The configured transport (Brevo API preferred), or null when email isn't set up. */
const getTransport = () => {
  if (cached) return cached;
  if (config.brevoApiKey) cached = createBrevoApiTransport();
  else if (config.smtp.host) cached = createSmtpTransport();
  return cached;
};

const errorText = (err) =>
  `${err.responseCode || ''} ${err.response || ''} ${err.code || ''} ${err.message || ''}`;

/** Plain-language hint for the delivery errors people hit most often. */
const explainError = (err) => {
  const text = errorText(err);
  if (/EIPBLOCKED/.test(text)) {
    return 'Brevo blocked the request because it came from an unrecognised IP address. In Brevo go to Security → Authorised IPs and deactivate IP blocking (hosting providers like Render change IP addresses).';
  }
  if (/ESENDER/.test(text)) {
    return 'Brevo rejected the sender. EMAIL_FROM must use an address verified under Senders, Domains & Dedicated IPs.';
  }
  if (/535|EAUTH|authentication/i.test(text)) {
    return config.brevoApiKey
      ? 'Brevo rejected BREVO_API_KEY. Create an API key under SMTP & API → API Keys (it starts with "xkeysib-"; the SMTP key "xsmtpsib-" does not work here).'
      : 'The mail server rejected SMTP_USER / SMTP_PASS. Use the SMTP *login* your provider shows (Brevo: "Login" on the SMTP page, e.g. 123abc@smtp-brevo.com; Gmail: your address + an App Password).';
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return 'The mail server host name could not be found. Check SMTP_HOST for typos.';
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNECTION|Greeting never received/i.test(text)) {
    return config.brevoApiKey
      ? 'Could not reach the Brevo API. Check the server’s internet access.'
      : 'Could not connect to the mail server. Many hosts block SMTP ports (Render’s free plan blocks 25, 465 and 587) — set BREVO_API_KEY to send over HTTPS instead, or check SMTP_PORT/SMTP_SECURE.';
  }
  return 'Check the email settings in your environment.';
};

/** Problems that affect every message (credentials, connectivity, sender), not one recipient. */
const isServerWideError = (err) =>
  /535|EAUTH|EIPBLOCKED|ESENDER|authentication|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNECTION|Greeting never received/i.test(
    errorText(err)
  );

module.exports = { getTransport, explainError, isServerWideError, parseAddress };
