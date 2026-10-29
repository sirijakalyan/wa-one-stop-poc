// Identity provider backed by AWS Cognito. People, passwords and sign-in live in the Cognito user pool.
// Passwords are set by the person (sign up or reset code), so they are permanent, never temporary.
// The app keeps only what a person did (plan, steps, activity), keyed by their Cognito id (the "sub").
//
// Needs: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID (an app client with no secret), AWS_REGION (or the region inside the pool id).
// The server runs with an IAM role (see infra/cognito-and-secrets.yaml), so no AWS key is stored anywhere.
import {
  CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, ResendConfirmationCodeCommand, InitiateAuthCommand,
  GlobalSignOutCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, ListUsersCommand, AdminGetUserCommand,
  AdminListGroupsForUserCommand, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AuthError, normalizeEmail, validEmail, passwordProblem } from './auth.js';

export const ADMIN_GROUP = 'admins';
const attr = (list, name) => (list || []).find((a) => a.Name === name)?.Value || '';

// Turns an AWS error into a message a person can act on. Nothing here says whether an email has an account.
function friendly(err) {
  const n = err?.name || '';
  switch (n) {
    case 'UsernameExistsException': return new AuthError('An account with this email already exists. Sign in instead.', 409);
    case 'InvalidPasswordException': return new AuthError('Use at least 8 characters, with a letter and a number.');
    case 'CodeMismatchException': return new AuthError('That code is not right. Check it and try again.');
    case 'ExpiredCodeException': return new AuthError('That code has expired. Ask for a new one.');
    case 'NotAuthorizedException': case 'UserNotFoundException': return new AuthError('The email or password is not right.', 401);
    case 'LimitExceededException': case 'TooManyRequestsException': case 'TooManyFailedAttemptsException': return new AuthError('Too many tries. Wait a few minutes and try again.', 429);
    case 'InvalidParameterException': return new AuthError('Check what you entered and try again.');
    default: console.error('[cognito]', n, err?.message); return new AuthError('Something went wrong with sign in. Try again in a moment.', 502);
  }
}

export function createCognitoIdp({ userPoolId, clientId, region, adminEmails = [], client, verifier } = {}) {
  if (!userPoolId || !clientId) throw new Error('Cognito needs COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID');
  const rg = region || userPoolId.split('_')[0];
  const cog = client || new CognitoIdentityProviderClient({ region: rg });
  const ver = verifier || CognitoJwtVerifier.create({ userPoolId, tokenUse: 'id', clientId });
  const admins = adminEmails.map(normalizeEmail);
  const send = async (cmd) => { try { return await cog.send(cmd); } catch (e) { throw friendly(e); } };
  const userFrom = (payload) => ({
    id: payload.sub, name: payload.name || payload.email || '', email: payload.email || '',
    role: (payload['cognito:groups'] || []).includes(ADMIN_GROUP) ? 'admin' : 'user',
  });
  async function groupsOf(username) {
    const r = await send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }));
    return (r.Groups || []).map((g) => g.GroupName);
  }
  async function toUser(u) {
    const email = attr(u.Attributes || u.UserAttributes, 'email');
    return {
      id: attr(u.Attributes || u.UserAttributes, 'sub') || u.Username, name: attr(u.Attributes || u.UserAttributes, 'name') || email, email,
      role: (await groupsOf(u.Username)).includes(ADMIN_GROUP) ? 'admin' : 'user',
      createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : '', lastLoginAt: '',
    };
  }
  // Signs in with email and password. Returns the tokens, or { unconfirmed: true } for someone who never entered the email code.
  async function tokensFor(email, password) {
    let r;
    try {
      r = await cog.send(new InitiateAuthCommand({ AuthFlow: 'USER_PASSWORD_AUTH', ClientId: clientId, AuthParameters: { USERNAME: email, PASSWORD: password } }));
    } catch (e) {
      if (e?.name === 'UserNotConfirmedException') return { unconfirmed: true };
      throw friendly(e);
    }
    // A person created by an admin with a temporary password would land here. The app never creates people that way.
    if (r.ChallengeName) throw new AuthError('This account needs a new password. Use "Forgot your password?" to set one.', 401);
    return r.AuthenticationResult;
  }

  return {
    mode: 'cognito',
    needsCode: true,

    async signup({ name, email, password }) {
      name = String(name || '').trim().slice(0, 80);
      email = normalizeEmail(email);
      if (!name) throw new AuthError('Enter your name.');
      if (!validEmail(email)) throw new AuthError('Enter a valid email address.');
      const problem = passwordProblem(password);
      if (problem) throw new AuthError(problem);
      await send(new SignUpCommand({ ClientId: clientId, Username: email, Password: String(password), UserAttributes: [{ Name: 'email', Value: email }, { Name: 'name', Value: name }] }));
      return { needsConfirm: true };
    },
    async confirm({ email, code }) {
      if (!validEmail(email) || !code) throw new AuthError('Enter the code from your email.');
      await send(new ConfirmSignUpCommand({ ClientId: clientId, Username: email, ConfirmationCode: code }));
      // The first people named in ADMIN_EMAILS become admins as soon as they confirm.
      if (admins.includes(email)) {
        try { await send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: email, GroupName: ADMIN_GROUP })); } catch (e) { console.error('[cognito] could not add admin group:', e.message); }
      }
    },
    async resend({ email }) {
      if (!validEmail(email)) return;
      try { await cog.send(new ResendConfirmationCodeCommand({ ClientId: clientId, Username: email })); } catch { /* same answer either way */ }
    },
    async login({ email, password }) {
      email = normalizeEmail(email);
      if (!validEmail(email) || !password) throw new AuthError('The email or password is not right.', 401);
      let t = await tokensFor(email, String(password));
      if (t.unconfirmed) return { needsConfirm: true };
      let payload = await ver.verify(t.IdToken);
      // Anyone named in ADMIN_EMAILS is put in the admins group the first time they sign in, and gets a token that shows it.
      if (admins.includes(email) && !(payload['cognito:groups'] || []).includes(ADMIN_GROUP)) {
        try {
          await send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: email, GroupName: ADMIN_GROUP }));
          t = await tokensFor(email, String(password));
          payload = await ver.verify(t.IdToken);
        } catch (e) { console.error('[cognito] could not add admin group:', e.message); }
      }
      return { token: t.IdToken, refreshToken: t.RefreshToken, user: userFrom(payload) };
    },
    async refresh({ refreshToken }) {
      if (!refreshToken) throw new AuthError('Sign in again.', 401);
      let r;
      try { r = await cog.send(new InitiateAuthCommand({ AuthFlow: 'REFRESH_TOKEN_AUTH', ClientId: clientId, AuthParameters: { REFRESH_TOKEN: refreshToken } })); } catch { throw new AuthError('Sign in again.', 401); }
      const token = r.AuthenticationResult.IdToken;
      return { token, user: userFrom(await ver.verify(token)) };
    },
    async logout({ token, account }) {
      // Ends the person's refresh tokens everywhere. Needs the access token; the id token alone cannot, so this is best effort.
      void token; void account;
    },
    async resolve(token) {
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
      try { return userFrom(await ver.verify(token)); } catch { return null; }
    },

    // Cognito emails a 6-digit code (never a link), valid for one hour. Same answer whether or not the email has an account.
    async forgot({ email }) {
      email = normalizeEmail(email);
      const out = { message: 'If an account uses this email, a code is on its way. It works for one hour.', codeSent: true };
      if (!validEmail(email)) return out;
      try { await cog.send(new ForgotPasswordCommand({ ClientId: clientId, Username: email })); } catch (e) { if (e?.name === 'LimitExceededException') throw friendly(e); }
      return out;
    },
    async reset({ email, code, password }) {
      const problem = passwordProblem(password);
      if (problem) throw new AuthError(problem);
      if (!validEmail(email) || !code) throw new AuthError('Enter your email and the code from the email.');
      await send(new ConfirmForgotPasswordCommand({ ClientId: clientId, Username: email, ConfirmationCode: code, Password: String(password) }));
      return { message: 'Your password was changed. Sign in with the new password.' };
    },

    async listUsers() {
      const out = [];
      let token;
      do {
        const r = await send(new ListUsersCommand({ UserPoolId: userPoolId, Limit: 60, PaginationToken: token }));
        for (const u of r.Users || []) out.push(await toUser(u));
        token = r.PaginationToken;
      } while (token && out.length < 500);
      return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async getUser(id) {
      // The id is the Cognito "sub"; it is also accepted as the username.
      const r = await cog.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `sub = "${String(id).replace(/[^a-f0-9-]/gi, '')}"`, Limit: 1 })).catch((e) => { throw friendly(e); });
      return r.Users?.[0] ? toUser(r.Users[0]) : null;
    },
    async setRole(id, role) {
      const u = await this.getUser(id);
      if (!u) return null;
      const Username = u.email;
      if (role === 'admin') await send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username, GroupName: ADMIN_GROUP }));
      else await send(new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username, GroupName: ADMIN_GROUP }));
      return { ...u, role };
    },
  };
}
