/**
 * Email transport selection and the Brevo HTTPS API client.
 * The network is mocked — nothing is sent and no credentials are needed.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';

const c = { green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m', reset: '\x1b[0m' };
let passed = 0;
let failed = 0;
const assert = (cond, label, detail = '') => {
  if (cond) {
    passed++;
    console.log(` ${c.green}✔ PASS${c.reset} - ${label}`);
  } else {
    failed++;
    console.error(` ${c.red}✖ FAIL${c.reset} - ${label}`);
    if (detail) console.error(`        Detail: ${detail}`);
  }
};

/** Load a fresh copy of the transports module with the given environment. */
const loadTransports = (env) => {
  for (const key of ['BREVO_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']) delete process.env[key];
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../src/services/emailTransports')];
  return require('../src/services/emailTransports');
};

const realFetch = global.fetch;
const mockFetch = (status, body, capture = []) => {
  global.fetch = async (url, init) => {
    capture.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return capture;
};

const run = async () => {
  console.log(`${c.bold}EMAIL TRANSPORTS${c.reset}`);

  // ---- Selection ----
  assert(loadTransports({}).getTransport() === null, 'No email settings → no transport (emails are logged)');
  assert(loadTransports({ SMTP_HOST: 'smtp.example.org' }).getTransport().kind === 'smtp', 'SMTP_HOST only → SMTP transport');
  assert(
    loadTransports({ SMTP_HOST: 'smtp.example.org', BREVO_API_KEY: 'xkeysib-test' }).getTransport().kind === 'brevo-api',
    'BREVO_API_KEY wins over SMTP (works on hosts that block SMTP ports)'
  );

  // ---- Address parsing ----
  const { parseAddress } = loadTransports({});
  const parsed = parseAddress('ServeHub <hello@servehub.org>');
  assert(parsed.name === 'ServeHub' && parsed.email === 'hello@servehub.org', 'Parses "Name <email>" sender');
  assert(parseAddress('"Serve Hub" <a@b.org>').name === 'Serve Hub', 'Parses quoted sender names');
  assert(parseAddress('plain@b.org').email === 'plain@b.org', 'Parses a bare email address');

  // ---- Sending through the Brevo API ----
  let t = loadTransports({ BREVO_API_KEY: 'xkeysib-test', EMAIL_FROM: 'ServeHub <hello@servehub.org>' });
  const calls = mockFetch(201, { messageId: '<1@brevo>' });
  await t.getTransport().send({
    from: 'ServeHub <hello@servehub.org>',
    to: 'asha@example.org',
    subject: 'Hello',
    text: 'plain',
    html: '<p>html</p>',
    attachments: [{ filename: 'event.ics', content: 'BEGIN:VCALENDAR' }],
  });
  const req = calls[0];
  const payload = JSON.parse(req.init.body);
  assert(req.url === 'https://api.brevo.com/v3/smtp/email' && req.init.method === 'POST', 'Sends to the Brevo transactional endpoint over HTTPS');
  assert(req.init.headers['api-key'] === 'xkeysib-test', 'Authenticates with the api-key header');
  assert(
    payload.sender.email === 'hello@servehub.org' && payload.sender.name === 'ServeHub' && payload.to[0].email === 'asha@example.org',
    'Maps sender and recipient'
  );
  assert(payload.htmlContent === '<p>html</p>' && payload.textContent === 'plain', 'Includes HTML and text bodies');
  assert(
    payload.attachment[0].name === 'event.ics' && Buffer.from(payload.attachment[0].content, 'base64').toString() === 'BEGIN:VCALENDAR',
    'Attachments (calendar invites) are base64-encoded'
  );

  // ---- Error classification ----
  const { explainError, isServerWideError } = t;
  const attempt = async (status, body) => {
    mockFetch(status, body);
    try {
      await t.getTransport().send({ from: 'a@b.org', to: 'c@d.org', subject: 's', text: 't', html: 'h' });
      return null;
    } catch (err) {
      return err;
    }
  };

  const badKey = await attempt(401, { code: 'unauthorized', message: 'Key not found' });
  assert(badKey?.code === 'EAUTH' && isServerWideError(badKey), 'Wrong API key is a server-wide failure');
  assert(/xkeysib-/.test(explainError(badKey)), 'Wrong API key explains which kind of key to use');

  const ipBlocked = await attempt(401, { code: 'unauthorized', message: 'We have detected you are using an unrecognised IP address' });
  assert(ipBlocked?.code === 'EIPBLOCKED' && /Authorised IPs/.test(explainError(ipBlocked)), 'Brevo IP blocking is detected and explained');

  const badSender = await attempt(400, { code: 'invalid_parameter', message: 'Sender is not valid' });
  assert(badSender?.code === 'ESENDER' && isServerWideError(badSender), 'Unverified sender is detected');

  const badRecipient = await attempt(400, { code: 'invalid_parameter', message: 'email is not valid in to' });
  assert(badRecipient && !isServerWideError(badRecipient), 'One bad recipient does not mark email as broken');

  // ---- Verify (startup check) never sends ----
  const verifyCalls = mockFetch(200, { email: 'owner@servehub.org' });
  await t.getTransport().verify();
  assert(verifyCalls[0].url === 'https://api.brevo.com/v3/account' && (verifyCalls[0].init.method || 'GET') === 'GET', 'Startup check only reads the account (sends nothing)');

  // ---- SMTP timeout hint points to the HTTPS option ----
  t = loadTransports({ SMTP_HOST: 'smtp.example.org' });
  const hint = t.explainError(Object.assign(new Error('Greeting never received'), { code: 'ETIMEDOUT' }));
  assert(/BREVO_API_KEY/.test(hint) && /Render/.test(hint), 'SMTP timeouts suggest BREVO_API_KEY (blocked SMTP ports)');
};

run()
  .catch((err) => {
    failed++;
    console.error('Unexpected failure:', err);
  })
  .finally(() => {
    global.fetch = realFetch;
    console.log(`\n${c.bold}EMAIL TRANSPORTS: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
