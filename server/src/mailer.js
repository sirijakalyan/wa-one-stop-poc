// Email sending for opt-in renewal reminders. Node only (the in-browser preview has no mailer).
//   EMAIL_PROVIDER=log     (default) prints each email to the server log. Nothing is delivered.
//   EMAIL_PROVIDER=smtp    sends through any SMTP mailbox, for example your own Zoho or Gmail account.
//                          Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. EMAIL_FROM defaults to SMTP_USER.
//   EMAIL_PROVIDER=sendgrid sends through SendGrid. Needs SENDGRID_API_KEY and EMAIL_FROM (a sender you verified in SendGrid).
//   EMAIL_PROVIDER=resend  sends through Resend (https://resend.com). Needs RESEND_API_KEY and EMAIL_FROM.
// Add another provider by returning { mode, send({ to, subject, text }) } from createMailer.
import nodemailer from 'nodemailer';

export function createMailer(env = process.env) {
  const provider = String(env.EMAIL_PROVIDER || 'log').toLowerCase();
  const from = env.EMAIL_FROM || 'WA One-Stop Demo <onboarding@resend.dev>';

  if (provider === 'smtp') {
    const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !env[k]);
    if (missing.length) throw new Error(`EMAIL_PROVIDER=smtp needs ${missing.join(', ')} in server/.env`);
    const port = Number(env.SMTP_PORT) || 465;
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE !== 'false' : port === 465, // 465 = SSL from the start, 587 = STARTTLS
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      ...(env.SMTP_ALLOW_SELF_SIGNED === 'true' ? { tls: { rejectUnauthorized: false } } : {}),
    });
    return {
      mode: 'live',
      async send({ to, subject, text }) {
        try {
          await transport.sendMail({ from: env.EMAIL_FROM || env.SMTP_USER, to, subject, text });
        } catch (err) {
          // Never put the password or the full server reply in the error. The code is enough to find the cause.
          throw new Error(`SMTP send failed (${err.code || err.responseCode || 'error'}). Check SMTP_HOST, port, user and password in server/.env.`);
        }
      },
    };
  }

  if (provider === 'sendgrid') {
    if (!env.SENDGRID_API_KEY) throw new Error('EMAIL_PROVIDER=sendgrid needs SENDGRID_API_KEY in server/.env');
    if (!env.EMAIL_FROM) throw new Error('EMAIL_PROVIDER=sendgrid needs EMAIL_FROM in server/.env (a sender address you verified in SendGrid)');
    const m = /^(?:\s*"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/.exec(env.EMAIL_FROM);
    const sender = m ? { email: m[2], ...(m[1] ? { name: m[1].trim() } : {}) } : { email: env.EMAIL_FROM.trim() };
    return {
      mode: 'live',
      async send({ to, subject, text }) {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: sender, subject, content: [{ type: 'text/plain', value: text }] }),
        });
        // SendGrid answers 202 when it accepts the message. The key never appears in an error message.
        if (res.status !== 202) throw new Error(`SendGrid refused the message (HTTP ${res.status}). Check the key and that EMAIL_FROM is a verified sender.`);
      },
    };
  }

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('EMAIL_PROVIDER=resend needs RESEND_API_KEY in server/.env');
    return {
      mode: 'live',
      async send({ to, subject, text }) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [to], subject, text }),
        });
        if (!res.ok) throw new Error(`Email provider refused the message (HTTP ${res.status}).`);
      },
    };
  }

  return {
    mode: 'log',
    async send({ to, subject, text }) {
      console.log(`[email:log] To: ${to}\n[email:log] Subject: ${subject}\n${text.split('\n').map((l) => `[email:log] ${l}`).join('\n')}`);
    },
  };
}
