import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';
import { createMailer } from '../src/mailer.js';

const sent = [];
const mailer = { mode: 'live', async send(m) { sent.push(m); } };
let app;
let service;
before(async () => {
  app = await startApp({ mailer, publicUrl: 'http://api.test' });
  service = app.service;
});
after(() => app.stop());

const V = { 'x-visitor-id': 'visitor-email-0001' };
const tokenOf = (text, kind) => /token=([0-9a-f]+)/.exec(text.split('\n').find((l) => l.includes(`/api/email/${kind}`)))[1];

test('opt-in needs a valid email and sends only a confirmation message', async () => {
  assert.equal((await app.call('PUT', '/api/settings', { emailOptIn: true, email: 'nope' }, V)).status, 400);
  assert.equal(sent.length, 0);
  const r = await app.call('PUT', '/api/settings', { emailOptIn: true, email: 'Owner@Example.com' }, V);
  assert.equal(r.status, 200);
  assert.equal(r.body.emailConfirmed, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'owner@example.com');
  assert.match(sent[0].subject, /Confirm/);
});

test('no reminder is sent before the address is confirmed', async () => {
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'x' }, V);
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await app.call('PUT', '/api/checklist/renewal', { ruleId: 'sos', date: soon }, V);
  const before = sent.length;
  assert.deepEqual(await service.runReminders(), { checked: 0, sent: 0, failed: 0 });
  assert.equal(sent.length, before);
});

test('confirm link turns reminders on, due reminders send once, with unsubscribe link and disclaimer', async () => {
  const token = tokenOf(sent[0].text, 'confirm');
  const res = await fetch(`${app.base}/api/email/confirm?token=${token}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /html/);
  assert.equal((await app.call('GET', '/api/notifications', undefined, V)).body.emailConfirmed, true);

  const before = sent.length;
  const first = await service.runReminders();
  assert.equal(first.sent, 1);
  const mail = sent[before];
  assert.match(mail.text, /Demo only, not official guidance/);
  assert.match(mail.text, /\/api\/email\/unsubscribe\?token=/);
  assert.match(mail.subject, /in 3 days/);
  // Same window again: nothing new is sent.
  assert.equal((await service.runReminders()).sent, 0);
  assert.equal(sent.length, before + 1);
  const notes = (await app.call('GET', '/api/notifications', undefined, V)).body.notifications;
  assert.equal(notes[0].simulated, false);
});

test('a date more than 30 days away and a past date send nothing', async () => {
  const far = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  await app.call('PUT', '/api/checklist/renewal', { ruleId: 'sos', date: far }, V);
  const n = sent.length;
  assert.equal((await service.runReminders()).sent, 0);
  await app.call('PUT', '/api/checklist/renewal', { ruleId: 'sos', date: '2020-01-01' }, V);
  assert.equal((await service.runReminders()).sent, 0);
  assert.equal(sent.length, n);
});

test('unsubscribe removes the address and stops reminders', async () => {
  const s = sent.find((m) => m.text.includes('/api/email/unsubscribe'));
  const token = tokenOf(s.text, 'unsubscribe');
  const res = await fetch(`${app.base}/api/email/unsubscribe?token=${token}`);
  assert.equal(res.status, 200);
  const settings = (await app.call('GET', '/api/notifications', undefined, V)).body;
  assert.equal(settings.emailOptIn, false);
  assert.equal(settings.email, '');
  // A bad or reused token never reveals anything.
  assert.equal((await fetch(`${app.base}/api/email/confirm?token=bad`)).status, 404);
});

test('without a mailer the demo stays simulated and stores no address', async () => {
  const plain = await startApp({ mailer: null });
  try {
    const r = await plain.call('PUT', '/api/settings', { emailOptIn: true, email: 'a@b.co' }, V);
    assert.equal(r.body.emailMode, 'off');
    assert.equal((await plain.call('GET', '/api/notifications', undefined, V)).body.email, '');
  } finally {
    await plain.stop();
  }
});

test('log mailer never needs a key; resend mailer refuses to start without one', () => {
  assert.equal(createMailer({}).mode, 'log');
  assert.throws(() => createMailer({ EMAIL_PROVIDER: 'resend' }), /RESEND_API_KEY/);
  assert.equal(createMailer({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'k' }).mode, 'live');
});

/* ---- SMTP provider, tested against a local throw-away SMTP server (nothing leaves this computer) ---- */
import { SMTPServer } from 'smtp-server';

// Mail bodies may be quoted-printable (long lines are split with "=" at the end). Undo that before reading them.
const qp = (t) => t.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

async function withSmtp(fn, { password = 'secret' } = {}) {
  const got = [];
  const server = new SMTPServer({
    authOptional: false,
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth(auth, _s, cb) { return auth.username === 'me@example.test' && auth.password === password ? cb(null, { user: 1 }) : cb(new Error('bad login')); },
    onData(stream, _s, cb) { let b = ''; stream.on('data', (c) => { b += c; }); stream.on('end', () => { got.push(qp(b)); cb(); }); },
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { return await fn(server.server.address().port, got); } finally { await new Promise((r) => server.close(r)); }
}
const smtpEnv = (port, over = {}) => ({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false', SMTP_USER: 'me@example.test', SMTP_PASS: 'secret', ...over });

test('smtp mailer delivers a message to the SMTP server with the right sender, recipient and subject', async () => {
  await withSmtp(async (port, got) => {
    const m = createMailer(smtpEnv(port));
    assert.equal(m.mode, 'live');
    await m.send({ to: 'owner@example.com', subject: 'Hello there', text: 'Body line' });
    assert.equal(got.length, 1);
    assert.match(got[0], /Subject: Hello there/);
    assert.match(got[0], /To: owner@example\.com/);
    assert.match(got[0], /From: me@example\.test/);
    assert.match(got[0], /Body line/);
  });
});

test('smtp mailer: a wrong password fails with a safe message that never contains the password', async () => {
  await withSmtp(async (port) => {
    const m = createMailer(smtpEnv(port, { SMTP_PASS: 'wrong-password-123' }));
    await assert.rejects(m.send({ to: 'a@b.co', subject: 's', text: 't' }), (err) => {
      assert.match(err.message, /SMTP send failed/);
      assert.doesNotMatch(err.message, /wrong-password-123/);
      return true;
    });
  });
});

test('smtp mailer refuses to start when settings are missing, naming only the missing keys', () => {
  assert.throws(() => createMailer({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'x' }), /SMTP_USER, SMTP_PASS/);
});

test('whole flow over SMTP: opting in sends the confirmation message to the visitor address', async () => {
  await withSmtp(async (port, got) => {
    const smtpApp = await startApp({ mailer: createMailer(smtpEnv(port)), publicUrl: 'http://api.test' });
    try {
      const r = await smtpApp.call('PUT', '/api/settings', { emailOptIn: true, email: 'someone@example.com' }, { 'x-visitor-id': 'visitor-smtp-0001' });
      assert.equal(r.status, 200);
      assert.equal(got.length, 1);
      assert.match(got[0], /Subject: Confirm your renewal reminder emails/);
      assert.match(got[0], /To: someone@example\.com/);
      assert.match(got[0], /http:\/\/api\.test\/api\/email\/confirm\?token=/);
    } finally {
      await smtpApp.stop();
    }
  });
});

/* ---- SendGrid provider, tested with a fake fetch (no network, no real key) ---- */
async function withFakeFetch(status, fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { status, ok: status < 300 }; };
  try { return await fn(calls); } finally { globalThis.fetch = real; }
}
const SG = { EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'fake-sendgrid-key-for-tests', EMAIL_FROM: 'WA One-Stop <reminders@example.test>' };

test('sendgrid mailer posts to the SendGrid API with the key in the header, the right recipient and a parsed sender', async () => {
  await withFakeFetch(202, async (calls) => {
    const m = createMailer(SG);
    assert.equal(m.mode, 'live');
    await m.send({ to: 'owner@example.com', subject: 'Hi', text: 'Body' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer fake-sendgrid-key-for-tests');
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(body.personalizations, [{ to: [{ email: 'owner@example.com' }] }]);
    assert.deepEqual(body.from, { email: 'reminders@example.test', name: 'WA One-Stop' });
    assert.equal(body.subject, 'Hi');
    assert.equal(body.content[0].value, 'Body');
  });
});

test('sendgrid mailer accepts a plain address as the sender', async () => {
  await withFakeFetch(202, async (calls) => {
    await createMailer({ ...SG, EMAIL_FROM: 'me@example.test' }).send({ to: 'a@b.co', subject: 's', text: 't' });
    assert.deepEqual(JSON.parse(calls[0].init.body).from, { email: 'me@example.test' });
  });
});

test('sendgrid mailer: a refusal gives a safe message that never contains the key', async () => {
  await withFakeFetch(401, async () => {
    await assert.rejects(createMailer(SG).send({ to: 'a@b.co', subject: 's', text: 't' }), (err) => {
      assert.match(err.message, /SendGrid refused the message \(HTTP 401\)/);
      assert.doesNotMatch(err.message, /fake-sendgrid-key/);
      return true;
    });
  });
});

test('sendgrid mailer refuses to start without a key or a verified sender address', () => {
  assert.throws(() => createMailer({ EMAIL_PROVIDER: 'sendgrid', EMAIL_FROM: 'a@b.co' }), /SENDGRID_API_KEY/);
  assert.throws(() => createMailer({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'x' }), /EMAIL_FROM/);
});
