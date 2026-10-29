// Identity provider kept in the app's own store (demo, local development and the in-page preview).
// The AWS version is in cognito.js. Both give service.js the same small interface.
// No Node imports here: this file also runs inside the browser preview.
import { renderEmail } from './emailTemplate.js';
import { hashPassword, verifyPassword, randomToken, sha256, normalizeEmail, validEmail, passwordProblem, AuthError } from './auth.js';

const SESSION_MS = 30 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function createLocalIdp({ store, adminEmails = [], mailer = null, publicUrl = '', demoResetLinks = false, footer = '' }) {
  const admins = adminEmails.map(normalizeEmail);
  const pub = (a, role = a.role) => ({ id: a.id, name: a.name, email: a.email, role });
  async function startSession(a) {
    const token = randomToken();
    const now = Date.now();
    const sessions = [...(a.sessions || []).filter((x) => x.exp > now), { hash: await sha256(token), exp: now + SESSION_MS }].slice(-10);
    await store.updateAccount(a.id, { sessions, lastLoginAt: new Date(now).toISOString(), failed: 0, lockedUntil: 0 });
    return token;
  }
  return {
    mode: 'local',
    needsCode: false,

    async signup({ name, email, password }) {
      name = String(name || '').trim().slice(0, 80);
      email = normalizeEmail(email);
      if (!name) throw new AuthError('Enter your name.');
      if (!validEmail(email)) throw new AuthError('Enter a valid email address.');
      const problem = passwordProblem(password);
      if (problem) throw new AuthError(problem);
      const acct = {
        id: randomToken().slice(0, 24), name, email, passHash: await hashPassword(String(password)), role: admins.includes(email) ? 'admin' : 'user',
        createdAt: new Date().toISOString(), lastLoginAt: '', sessions: [], failed: 0, lockedUntil: 0,
      };
      if (!(await store.createAccount(acct))) throw new AuthError('An account with this email already exists. Sign in instead.', 409);
      return { token: await startSession(acct), user: pub(acct) };
    },
    async confirm() { throw new AuthError('No code is needed here.'); },
    async resend() { return { ok: true }; },

    async login({ email, password }) {
      email = normalizeEmail(email);
      const bad = () => new AuthError('The email or password is not right.', 401);
      const a = validEmail(email) ? await store.findAccountByEmail(email) : null;
      if (!a) { await hashPassword('timing'); throw bad(); } // same work whether or not the account exists
      if (a.lockedUntil > Date.now()) throw new AuthError('Too many wrong passwords. Try again in 15 minutes or reset your password.', 429);
      if (!(await verifyPassword(String(password || ''), a.passHash))) {
        const failed = (a.failed || 0) + 1;
        await store.updateAccount(a.id, failed >= MAX_FAILS ? { failed: 0, lockedUntil: Date.now() + LOCK_MS } : { failed });
        throw bad();
      }
      const role = admins.includes(email) && a.role !== 'admin' ? 'admin' : a.role;
      if (role !== a.role) await store.updateAccount(a.id, { role });
      return { token: await startSession({ ...a, role }), user: pub(a, role) };
    },
    async refresh() { throw new AuthError('Sign in again.', 401); },
    async logout({ account, sessionHash }) {
      if (account && sessionHash) await store.updateAccount(account.id, { sessions: (account.sessions || []).filter((x) => x.hash !== sessionHash) });
    },
    // Returns the account for a session token, or null.
    async resolve(token) {
      const hash = await sha256(token);
      const a = await store.findAccountBySession(hash);
      return a ? { ...pub(a), sessions: a.sessions, sessionHash: hash } : null;
    },

    // The answer is the same whether or not the email has an account, so nobody can use this to find out who is registered.
    async forgot({ email }) {
      email = normalizeEmail(email);
      const out = { message: 'If an account uses this email, a reset link is on its way. It works for one hour.' };
      if (!validEmail(email)) return out;
      const a = await store.findAccountByEmail(email);
      if (!a) return out;
      if (a.resetSentAt && Date.now() - a.resetSentAt < 60_000) return out; // one email a minute
      const token = randomToken();
      await store.updateAccount(a.id, { resetHash: await sha256(token), resetExp: Date.now() + 3600_000, resetSentAt: Date.now() });
      const link = `${publicUrl}/reset-password?token=${token}`;
      if (mailer) {
        try {
          const m = renderEmail({
            heading: 'Choose a new password',
            paragraphs: [`Hello ${a.name},`, 'We got a request to reset the password for your account. The link below works once and expires in one hour.'],
            button: { label: 'Choose a new password', url: link },
            note: 'If you did not ask for this, ignore this email. Your password stays the same.',
          });
          await mailer.send({ to: a.email, subject: 'Reset your password', text: m.text, html: m.html });
        } catch (err) {
          console.error('reset email failed:', err.message);
        }
      }
      // Only a deliberate demo setting (no email service) shows the link on screen. Never on a real server.
      if (demoResetLinks) out.demoLink = `/reset-password?token=${token}`;
      return out;
    },
    async reset({ token, password }) {
      const problem = passwordProblem(password);
      if (problem) throw new AuthError(problem);
      const a = await store.findAccountByResetToken(await sha256(String(token || '')));
      if (!a) throw new AuthError('This reset link has expired or was already used. Ask for a new one.', 400);
      await store.updateAccount(a.id, { passHash: await hashPassword(String(password)), resetHash: '', resetExp: 0, sessions: [], failed: 0, lockedUntil: 0 });
      return { id: a.id, message: 'Your password was changed. Sign in with the new password.' };
    },

    async listUsers() {
      return (await store.listAccounts()).map((a) => ({ ...pub(a), createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || '' }));
    },
    async getUser(id) {
      const a = await store.getAccount(id);
      return a ? { ...pub(a), createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || '' } : null;
    },
    async setRole(id, role) {
      const a = await store.getAccount(id);
      if (!a) return null;
      await store.updateAccount(id, { role });
      return pub(a, role);
    },
  };
}
