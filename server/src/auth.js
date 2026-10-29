// Accounts: password hashing and tokens. No Node imports: this file also runs inside the browser preview.
// Passwords are never stored. PBKDF2-SHA256 with a random salt is used (Web Crypto, available in Node and browsers).
const ITER = 100_000;
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array((hex.match(/../g) || []).map((h) => parseInt(h, 16)));

async function derive(password, salt, iter) {
  const key = await subtle().importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${toHex(salt)}$${toHex(await derive(password, salt, ITER))}`;
}

export async function verifyPassword(password, stored) {
  const [kind, iter, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const got = toHex(await derive(password, fromHex(salt), Number(iter)));
  let diff = got.length ^ hash.length;
  for (let i = 0; i < got.length; i += 1) diff |= got.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return diff === 0;
}

export const randomToken = () => toHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
export async function sha256(text) {
  return toHex(await subtle().digest('SHA-256', enc.encode(String(text))));
}

export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
// At least 8 characters with a letter and a number. Long passphrases are fine.
export function passwordProblem(p) {
  const s = String(p || '');
  if (s.length < 8) return 'Use at least 8 characters for the password.';
  if (s.length > 200) return 'The password is too long.';
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use at least one letter and one number in the password.';
  return '';
}

// Thrown by an identity provider. status is the HTTP status the caller sees; the message is safe to show.
export class AuthError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
